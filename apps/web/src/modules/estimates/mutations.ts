// Escrituras del módulo estimates (INSERT/UPDATE sobre `presupuestos` e `items_presupuesto`).
//
// Reglas de dominio (migration 003):
//   - presupuestos.orden_trabajo_id NOT NULL: cada presupuesto pertenece a una OT.
//   - Solo puede existir un presupuesto activo (borrador/enviado) por OT (índice único parcial
//     idx_presupuestos_ot_version_activa) — un segundo INSERT activo lanzará error de la DB.
//   - version se autogenera vía trigger fn_versionar_presupuesto — nunca se envía en el INSERT.
//   - items_presupuesto.precio_total = cantidad * precio_unitario * (1 - descuento/100):
//     denormalización deliberada.
//   - Los totales del presupuesto (total_mano_obra, total_repuestos, total_neto) no tienen
//     trigger de agregación en la DB — se recalculan en la aplicación tras cada cambio de ítems.
//   - RLS excluye rol 'mecanico' (presupuestos contienen precios).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { validationErrorFromZod, mapPostgrestError } from '@/lib/errors'
import {
  crearPresupuestoSchema,
  addItemPresupuestoSchema,
  addItemsPresupuestoSchema,
  type Presupuesto,
  type ItemPresupuesto,
  type CrearPresupuestoInput,
  type AddItemPresupuestoInput,
  type AddItemsPresupuestoInput,
} from './types'

const PRES_COLUMNS =
  'id, org_id, orden_trabajo_id, presupuesto_anterior_id, version, estado, total_mano_obra, total_repuestos, total_descuentos, total_neto, notas, enviado_en, autorizado_en, autorizado_por_nombre, rechazado_en, razon_rechazo, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

const ITEM_COLUMNS =
  'id, org_id, presupuesto_id, tipo, descripcion, repuesto_id, cantidad, precio_unitario, descuento_porcentaje, precio_total, autorizador_id, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

/** Crea un presupuesto borrador (versión 1, sin presupuesto_anterior_id) para una OT. */
export async function crearPresupuesto(
  supabase: DbClient,
  input: CrearPresupuestoInput,
): Promise<Presupuesto> {
  const parsed = crearPresupuestoSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)
  const { ordenTrabajoId, notas } = parsed.data

  const { data, error } = await supabase
    .from('presupuestos')
    .insert({
      org_id: orgId,
      orden_trabajo_id: ordenTrabajoId,
      ...(notas ? { notas } : {}),
      creado_por: userId,
    })
    .select(PRES_COLUMNS)

  return unwrapWritten<Presupuesto>(data, error)
}

/** Agrega un ítem (mano de obra o repuesto) a un presupuesto y recalcula sus totales. */
export async function addItemPresupuesto(
  supabase: DbClient,
  input: AddItemPresupuestoInput,
): Promise<ItemPresupuesto> {
  const parsed = addItemPresupuestoSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)
  const {
    presupuestoId, tipo, descripcion, cantidad,
    precioUnitario, descuentoPorcentaje, repuestoId,
  } = parsed.data

  const descuento = descuentoPorcentaje ?? 0
  const precio_total = Math.round(cantidad * precioUnitario * (1 - descuento / 100) * 100) / 100

  const { data, error } = await supabase
    .from('items_presupuesto')
    .insert({
      org_id: orgId,
      presupuesto_id: presupuestoId,
      tipo,
      descripcion,
      cantidad,
      precio_unitario: precioUnitario,
      descuento_porcentaje: descuento,
      precio_total,
      ...(repuestoId ? { repuesto_id: repuestoId } : {}),
      creado_por: userId,
    })
    .select(ITEM_COLUMNS)

  const item = unwrapWritten<ItemPresupuesto>(data, error)
  await recalcularTotalesPresupuesto(supabase, presupuestoId)
  return item
}

/**
 * Agrega varias líneas de una vez (ficha de ingreso): un solo INSERT y un solo
 * recálculo de totales. Ignora líneas vacías desde la UI; acá ya llegan validadas.
 */
export async function addItemsPresupuesto(
  supabase: DbClient,
  input: AddItemsPresupuestoInput,
): Promise<void> {
  const parsed = addItemsPresupuestoSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)
  const { presupuestoId, items } = parsed.data

  const rows = items.map((it) => {
    const descuento = it.descuentoPorcentaje ?? 0
    const precio_total = Math.round(it.cantidad * it.precioUnitario * (1 - descuento / 100) * 100) / 100
    return {
      org_id: orgId,
      presupuesto_id: presupuestoId,
      tipo: it.tipo,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unitario: it.precioUnitario,
      descuento_porcentaje: descuento,
      precio_total,
      creado_por: userId,
    }
  })

  const { error } = await supabase.from('items_presupuesto').insert(rows)
  if (error) throw mapPostgrestError(error)
  await recalcularTotalesPresupuesto(supabase, presupuestoId)
}

/** Recalcula y persiste los totales del presupuesto a partir de sus ítems activos. */
export async function recalcularTotalesPresupuesto(
  supabase: DbClient,
  presupuestoId: string,
): Promise<void> {
  const { orgId } = await getAuthContext(supabase)

  const { data: itemsData, error: itemsError } = await supabase
    .from('items_presupuesto')
    .select('tipo, precio_total')
    .eq('org_id', orgId)
    .eq('presupuesto_id', presupuestoId)
    .is('eliminado_en', null)

  if (itemsError) throw mapPostgrestError(itemsError)

  let total_mano_obra = 0
  let total_repuestos = 0
  for (const item of (itemsData ?? []) as { tipo: string; precio_total: number }[]) {
    if (item.tipo === 'mano_obra') total_mano_obra += item.precio_total
    else total_repuestos += item.precio_total
  }
  const total_neto = total_mano_obra + total_repuestos

  const { error } = await supabase
    .from('presupuestos')
    .update({ total_mano_obra, total_repuestos, total_neto })
    .eq('id', presupuestoId)
    .eq('org_id', orgId)

  if (error) throw mapPostgrestError(error)
}

/** Marca un presupuesto como enviado al cliente. No se puede modificar después (UC-P03). */
export async function enviarPresupuesto(
  supabase: DbClient,
  presupuestoId: string,
): Promise<Presupuesto> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('presupuestos')
    .update({ estado: 'enviado', enviado_en: new Date().toISOString() })
    .eq('id', presupuestoId)
    .eq('org_id', orgId)
    .select(PRES_COLUMNS)

  return unwrapWritten<Presupuesto>(data, error)
}
