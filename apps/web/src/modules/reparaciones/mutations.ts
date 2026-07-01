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
import { validationErrorFromZod, mapPostgrestError } from '@/lib/errors'
import { createEvento } from '@/modules/events/mutations'
import {
  crearReparacionSchema,
  addItemReparacionSchema,
  type Reparacion,
  type ItemReparacion,
  type CrearReparacionInput,
  type AddItemReparacionInput,
} from './types'

const REP_COLUMNS =
  'id, org_id, orden_trabajo_id, evento_trabajo_id, mecanico_id, descripcion, observaciones, inicio_en, fin_en, creado_en, actualizado_en, creado_por'

const ITEM_COLUMNS =
  'id, org_id, reparacion_id, item_presupuesto_id, tipo, descripcion, repuesto_id, cantidad, costo_unitario, costo_total, costo_compra_unitario, inicio_en, fin_en, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por, servicio_catalogo_id, plantilla_id, nombre_servicio_snapshot, horas_estandar_snapshot, valor_hora_snapshot, precio_catalogo_snapshot'

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
    reparacionId, tipo, descripcion, cantidad, costoUnitario, repuestoId,
    servicioCatalogoId, nombreServicioSnapshot, horasEstandarSnapshot,
    valorHoraSnapshot, precioCatalogoSnapshot, costoCompraUnitario,
  } = parsed.data

  const costo_total = Math.round(cantidad * costoUnitario * 100) / 100

  const { data, error } = await supabase
    .from('items_reparacion')
    .insert({
      org_id: orgId,
      reparacion_id: reparacionId,
      tipo,
      descripcion,
      cantidad,
      costo_unitario: costoUnitario,
      costo_total,
      ...(repuestoId          ? { repuesto_id: repuestoId }                         : {}),
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
