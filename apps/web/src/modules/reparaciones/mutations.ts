// Escrituras del módulo reparaciones (INSERT/UPDATE/soft-delete sobre `reparaciones` e `items_reparacion`).
//
// Reglas de dominio (migration 003):
//   - reparaciones.evento_trabajo_id NOT NULL: se crea un evento de trabajo ANTES de la reparación.
//   - items_reparacion.costo_total = cantidad * costo_unitario: denormalización deliberada.
//   - reparaciones SIN eliminado_en: inmutables (errores se corrigen con evento 'correccion').
//   - items_reparacion tienen soft-delete.
//   - RLS items_reparacion INSERT: subquery cross-tenant verifica org_id de reparacion padre.

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { validationErrorFromZod, mapPostgrestError, ValidationError } from '@/lib/errors'
import { createEvento } from '@/modules/events/mutations'
import {
  crearReparacionSchema,
  addItemReparacionSchema,
  actualizarCompraItemSchema,
  type Reparacion,
  type ItemReparacion,
  type CrearReparacionInput,
  type AddItemReparacionInput,
  type ActualizarCompraItemInput,
} from './types'

const REP_COLUMNS =
  'id, org_id, orden_trabajo_id, evento_trabajo_id, mecanico_id, descripcion, observaciones, inicio_en, fin_en, creado_en, actualizado_en, creado_por'

const ITEM_COLUMNS =
  'id, org_id, reparacion_id, item_presupuesto_id, tipo, codigo, descripcion, repuesto_id, cantidad, costo_unitario, costo_total, costo_compra_unitario, inicio_en, fin_en, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por, servicio_catalogo_id, plantilla_id, nombre_servicio_snapshot, horas_estandar_snapshot, valor_hora_snapshot, precio_catalogo_snapshot, estado_compra, nota_compra'

/**
 * Crea una reparación para una OT.
 * Crea primero un evento de trabajo técnico (requerido por la FK NOT NULL),
 * luego la reparación vinculada a ese evento.
 */
export async function crearReparacion(
  supabase: DbClient,
  input: CrearReparacionInput,
): Promise<Reparacion> {
  const parsed = crearReparacionSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)
  const { ordenTrabajoId, historiaId, tipoEventoId, descripcion, observaciones, mecanicoId } =
    parsed.data

  // 1. Crear el evento de trabajo técnico ligado a la OT
  const evento = await createEvento(supabase, {
    historia_tecnica_id: historiaId,
    tipo_evento_id: tipoEventoId,
    titulo: descripcion?.slice(0, 255) || 'Trabajo técnico',
    ...(observaciones ? { descripcion: observaciones } : {}),
    orden_trabajo_id: ordenTrabajoId,
    ...(mecanicoId ? { asignado_a: mecanicoId } : {}),
  })

  // 2. Crear la reparación vinculada al evento
  const { data, error } = await supabase
    .from('reparaciones')
    .insert({
      org_id: orgId,
      orden_trabajo_id: ordenTrabajoId,
      evento_trabajo_id: evento.id,
      ...(mecanicoId ? { mecanico_id: mecanicoId } : {}),
      ...(descripcion ? { descripcion } : {}),
      ...(observaciones ? { observaciones } : {}),
      creado_por: userId,
    })
    .select(REP_COLUMNS)

  return unwrapWritten<Reparacion>(data, error)
}

/** Agrega un ítem (mano de obra o repuesto/material) a una reparación. */
export async function addItemReparacion(
  supabase: DbClient,
  input: AddItemReparacionInput,
): Promise<ItemReparacion> {
  const parsed = addItemReparacionSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)
  const {
    reparacionId, tipo, codigo, descripcion, cantidad, costoUnitario, repuestoId,
    itemPresupuestoId, servicioCatalogoId, nombreServicioSnapshot,
    horasEstandarSnapshot, valorHoraSnapshot, precioCatalogoSnapshot,
    costoCompraUnitario,
  } = parsed.data

  const costo_total = Math.round(cantidad * costoUnitario * 100) / 100

  const { data, error } = await supabase
    .from('items_reparacion')
    .insert({
      org_id: orgId,
      reparacion_id: reparacionId,
      tipo,
      ...(codigo ? { codigo } : {}),
      descripcion,
      cantidad,
      costo_unitario: costoUnitario,
      costo_total,
      ...(repuestoId          ? { repuesto_id: repuestoId }                         : {}),
      ...(itemPresupuestoId   ? { item_presupuesto_id: itemPresupuestoId }          : {}),
      ...(servicioCatalogoId  ? { servicio_catalogo_id: servicioCatalogoId }         : {}),
      ...(nombreServicioSnapshot != null ? { nombre_servicio_snapshot: nombreServicioSnapshot } : {}),
      ...(horasEstandarSnapshot  != null ? { horas_estandar_snapshot: horasEstandarSnapshot }   : {}),
      ...(valorHoraSnapshot      != null ? { valor_hora_snapshot: valorHoraSnapshot }           : {}),
      ...(precioCatalogoSnapshot != null ? { precio_catalogo_snapshot: precioCatalogoSnapshot } : {}),
      ...(costoCompraUnitario   != null ? { costo_compra_unitario: costoCompraUnitario }       : {}),
      creado_por: userId,
    })
    .select(ITEM_COLUMNS)

  return unwrapWritten<ItemReparacion>(data, error)
}

/**
 * Pasa un presupuesto (autorizado) a Trabajos: crea UNA reparación y copia cada
 * ítem del presupuesto como item_reparacion, enlazando item_presupuesto_id para
 * trazabilidad (así se sabe qué se ejecutó de lo aprobado y se evita duplicar).
 * El costo unitario respeta el descuento del ítem presupuestado.
 */
export async function pasarPresupuestoATrabajos(
  supabase: DbClient,
  input: {
    ordenTrabajoId: string
    historiaId: string
    tipoEventoReparacionId: string
    folio: string | null
    items: Array<{
      id: string
      tipo: 'mano_obra' | 'repuesto' | 'otros'
      codigo?: string | null
      descripcion: string
      cantidad: number
      precio_unitario: number
      descuento_porcentaje: number
    }>
    mecanicoId?: string | null
  },
): Promise<Reparacion> {
  if (input.items.length === 0) {
    throw new ValidationError('El presupuesto no tiene ítems que pasar a trabajos.')
  }

  const reparacion = await crearReparacion(supabase, {
    ordenTrabajoId: input.ordenTrabajoId,
    historiaId: input.historiaId,
    tipoEventoId: input.tipoEventoReparacionId,
    descripcion: `Trabajo según presupuesto${input.folio ? ` ${input.folio}` : ''} autorizado`,
    ...(input.mecanicoId ? { mecanicoId: input.mecanicoId } : {}),
  })

  for (const it of input.items) {
    const costoUnitario =
      Math.round(it.precio_unitario * (1 - (it.descuento_porcentaje ?? 0) / 100) * 100) / 100
    await addItemReparacion(supabase, {
      reparacionId: reparacion.id,
      tipo: it.tipo,
      ...(it.codigo ? { codigo: it.codigo } : {}),
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      costoUnitario,
      itemPresupuestoId: it.id,
    })
  }

  return reparacion
}

/** Asigna (o cambia/quita) el mecánico responsable de un trabajo ya creado. */
export async function asignarMecanicoReparacion(
  supabase: DbClient,
  reparacionId: string,
  mecanicoId: string | null,
): Promise<void> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('reparaciones')
    .update({ mecanico_id: mecanicoId })
    .eq('org_id', orgId)
    .eq('id', reparacionId)
    .select('id')

  unwrapWritten<{ id: string }>(data, error)
}

/**
 * Actualiza el estado de compra, la nota y/o el costo de compra de un repuesto.
 * Se usa desde la sección de Compras de la OT (marcar por comprar / comprado /
 * recibido, y al volver el comprador, ingresar el costo).
 */
export async function actualizarCompraItem(
  supabase: DbClient,
  input: ActualizarCompraItemInput,
): Promise<void> {
  const parsed = actualizarCompraItemSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { orgId } = await getAuthContext(supabase)
  const { itemId, estadoCompra, notaCompra, costoCompraUnitario } = parsed.data

  const cambios: Record<string, unknown> = {}
  if (estadoCompra !== undefined) cambios.estado_compra = estadoCompra
  if (notaCompra !== undefined) cambios.nota_compra = notaCompra?.trim() || null
  if (costoCompraUnitario !== undefined) cambios.costo_compra_unitario = costoCompraUnitario
  if (Object.keys(cambios).length === 0) return

  const { data, error } = await supabase
    .from('items_reparacion')
    .update(cambios)
    .eq('org_id', orgId)
    .eq('id', itemId)
    .is('eliminado_en', null)
    .select('id')

  unwrapWritten<{ id: string }>(data, error)
}

/** Soft-delete de un ítem de reparación. */
export async function softDeleteItemReparacion(supabase: DbClient, itemId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete', {
    p_table: 'items_reparacion',
    p_id: itemId,
  })
  if (error) throw mapPostgrestError(error)
}

/** Restaura un ítem de reparación eliminado (requiere admin o jefe_taller). */
export async function restoreItemReparacion(supabase: DbClient, itemId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_deleted', {
    p_table: 'items_reparacion',
    p_id: itemId,
  })
  if (error) throw mapPostgrestError(error)
}
