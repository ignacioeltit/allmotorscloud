// Lecturas del módulo reparaciones (SELECT sobre `reparaciones` e `items_reparacion`).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapList } from '@/lib/supabase/result'
import type { Reparacion, ItemReparacion, ReparacionConItems, TotalesOT } from './types'

const REP_COLUMNS =
  'id, org_id, orden_trabajo_id, evento_trabajo_id, mecanico_id, descripcion, observaciones, inicio_en, fin_en, creado_en, actualizado_en, creado_por'

const ITEM_COLUMNS =
  'id, org_id, reparacion_id, item_presupuesto_id, tipo, descripcion, repuesto_id, cantidad, costo_unitario, costo_total, costo_compra_unitario, inicio_en, fin_en, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por, servicio_catalogo_id, plantilla_id, nombre_servicio_snapshot, horas_estandar_snapshot, valor_hora_snapshot, precio_catalogo_snapshot, estado_compra, nota_compra'

/** Lista las reparaciones de una OT con sus ítems, en orden cronológico. */
export async function listReparacionesByOT(
  supabase: DbClient,
  ordenTrabajoId: string,
): Promise<ReparacionConItems[]> {
  const { orgId } = await getAuthContext(supabase)

  const { data: repsData, error: repsError } = await supabase
    .from('reparaciones')
    .select(REP_COLUMNS)
    .eq('org_id', orgId)
    .eq('orden_trabajo_id', ordenTrabajoId)
    .order('creado_en', { ascending: true })

  const reps = unwrapList<Reparacion>(repsData, repsError)
  if (reps.length === 0) return []

  const repIds = reps.map((r) => r.id)
  const { data: itemsData, error: itemsError } = await supabase
    .from('items_reparacion')
    .select(ITEM_COLUMNS)
    .eq('org_id', orgId)
    .in('reparacion_id', repIds)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: true })

  const items = unwrapList<ItemReparacion>(itemsData, itemsError)

  const byRepId = new Map<string, ItemReparacion[]>()
  for (const item of items) {
    const arr = byRepId.get(item.reparacion_id) ?? []
    arr.push(item)
    byRepId.set(item.reparacion_id, arr)
  }

  return reps.map((r) => ({ ...r, items: byRepId.get(r.id) ?? [] }))
}

/** Calcula totales de mano de obra y repuestos para todos los ítems de una OT. */
export async function getTotalesByOT(
  supabase: DbClient,
  ordenTrabajoId: string,
): Promise<TotalesOT> {
  const { orgId } = await getAuthContext(supabase)

  const { data: repsData, error: repsError } = await supabase
    .from('reparaciones')
    .select('id')
    .eq('org_id', orgId)
    .eq('orden_trabajo_id', ordenTrabajoId)

  const repIds = unwrapList<{ id: string }>(repsData, repsError).map((r) => r.id)
  if (repIds.length === 0) return { total_mano_obra: 0, total_repuestos: 0, total: 0 }

  const { data: itemsData, error: itemsError } = await supabase
    .from('items_reparacion')
    .select('tipo, costo_total')
    .eq('org_id', orgId)
    .in('reparacion_id', repIds)
    .is('eliminado_en', null)

  const items = unwrapList<{ tipo: string; costo_total: number }>(itemsData, itemsError)

  let total_mano_obra = 0
  let total_repuestos = 0
  for (const item of items) {
    if (item.tipo === 'mano_obra') total_mano_obra += item.costo_total
    else total_repuestos += item.costo_total
  }

  return { total_mano_obra, total_repuestos, total: total_mano_obra + total_repuestos }
}
