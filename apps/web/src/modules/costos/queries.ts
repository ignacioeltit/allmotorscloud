// Lecturas de costos para gestión (admin, jefe de taller, recepción).
//
// Las columnas de costo no son legibles con SELECT directo (migration 058); se
// leen solo con estas RPCs, que validan rol y org en la base. Para otros roles
// las RPCs devuelven vacío, y aquí ni siquiera se llaman.

import type { DbClient } from '@/lib/supabase/types'
import { mapPostgrestError } from '@/lib/errors'
import { mapaDeCostos } from './merge'

interface CostoItemRow { item_id: string; costo_compra_unitario: number | string | null }
interface CostoRepuestoRow { repuesto_id: string; precio_costo: number | string | null }
interface CostoMovimientoRow { movimiento_id: string; costo_unitario: number | string | null }

/** Costo de compra de cada ítem de reparación de una OT. */
export async function getCostosItemsOT(
  supabase: DbClient,
  ordenTrabajoId: string,
): Promise<Map<string, number | null>> {
  const { data, error } = await supabase.rpc('fn_costos_items_ot', { p_ot_id: ordenTrabajoId })
  if (error) throw mapPostgrestError(error)
  return mapaDeCostos(data as CostoItemRow[] | null, (r) => r.item_id, (r) => r.costo_compra_unitario)
}

/** Precio de costo de repuestos. Sin `ids`, todos los de la org. */
export async function getCostosRepuestos(
  supabase: DbClient,
  ids?: readonly string[],
): Promise<Map<string, number | null>> {
  if (ids && ids.length === 0) return new Map()
  const { data, error } = await supabase.rpc('fn_costos_repuestos', { p_ids: ids ? [...ids] : null })
  if (error) throw mapPostgrestError(error)
  return mapaDeCostos(data as CostoRepuestoRow[] | null, (r) => r.repuesto_id, (r) => r.precio_costo)
}

/** Costo unitario de los movimientos de stock de un repuesto. */
export async function getCostosMovimientos(
  supabase: DbClient,
  repuestoId: string,
): Promise<Map<string, number | null>> {
  const { data, error } = await supabase.rpc('fn_costos_movimientos', { p_repuesto_id: repuestoId })
  if (error) throw mapPostgrestError(error)
  return mapaDeCostos(data as CostoMovimientoRow[] | null, (r) => r.movimiento_id, (r) => r.costo_unitario)
}

/** Costo total del stock activo (precio_costo × stock). */
export async function getCostoStock(supabase: DbClient): Promise<number> {
  const { data, error } = await supabase.rpc('fn_valor_stock_costo')
  if (error) throw mapPostgrestError(error)
  return data == null ? 0 : Number(data)
}
