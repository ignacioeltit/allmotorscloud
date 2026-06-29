// Escrituras del módulo inventory (INSERT/UPDATE sobre `repuestos` y `movimientos_stock`).
//
// Reglas de dominio (migration 004):
//   - stock_actual NUNCA se actualiza directamente: solo vía movimientos_stock.
//   - Trigger fn_actualizar_stock_repuesto actualiza stock de forma atómica.
//   - movimientos_stock es append-only: no hay UPDATE ni DELETE.
//   - soft_delete/restore_deleted via RPC incluyen 'repuestos' desde migration 004.

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { validationErrorFromZod, mapPostgrestError } from '@/lib/errors'
import {
  repuestoCreateSchema,
  repuestoUpdateSchema,
  registrarMovimientoSchema,
  type Repuesto,
  type MovimientoStock,
  type RepuestoCreateInput,
  type RepuestoUpdateInput,
  type RegistrarMovimientoInput,
} from './types'
import { calcularEstadoStock } from './queries'

const REPUESTO_COLUMNS =
  'id, org_id, sucursal_id, codigo, codigo_barra, nombre, descripcion, marca, modelo_aplicacion, categoria, unidad, precio_costo, precio_venta, stock_actual, stock_minimo, ubicacion, proveedor, activo, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

const MOV_COLUMNS =
  'id, org_id, repuesto_id, tipo, cantidad, stock_antes, stock_despues, costo_unitario, precio_venta_unitario, referencia_tipo, referencia_id, motivo, actor_id, creado_en'

/** Crea un repuesto en el catálogo del org. */
export async function createRepuesto(
  supabase: DbClient,
  input: RepuestoCreateInput,
): Promise<Repuesto> {
  const parsed = repuestoCreateSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)
  const { stock_actual: stockInicial, ...rest } = parsed.data

  // 1. Crear el repuesto con stock 0 (el stock_actual lo gestiona el trigger via movimientos_stock)
  const { data, error } = await supabase
    .from('repuestos')
    .insert({ ...rest, org_id: orgId, creado_por: userId, stock_actual: 0 })
    .select(REPUESTO_COLUMNS)

  const repuesto = unwrapWritten<Repuesto>(data, error)

  // 2. Si hay stock inicial, registrar movimiento de entrada
  if (stockInicial && stockInicial > 0) {
    await registrarMovimientoStock(supabase, {
      repuesto_id: repuesto.id,
      tipo: 'entrada',
      cantidad: stockInicial,
      stock_antes: 0,
      motivo: 'Stock inicial al crear repuesto',
    })
  }

  // Refrescar para obtener stock_actual actualizado por el trigger
  const { data: updated } = await supabase
    .from('repuestos')
    .select(REPUESTO_COLUMNS)
    .eq('id', repuesto.id)
    .single()

  return (updated ?? repuesto) as Repuesto
}

/** Actualiza datos de un repuesto. No toca stock_actual (solo vía movimientos). */
export async function updateRepuesto(
  supabase: DbClient,
  id: string,
  input: RepuestoUpdateInput,
): Promise<Repuesto> {
  const parsed = repuestoUpdateSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { orgId } = await getAuthContext(supabase)

  // Excluir stock_actual del update: solo se modifica vía movimientos_stock
  const { stock_actual, ...safeFields } = parsed.data

  const { data, error } = await supabase
    .from('repuestos')
    .update(safeFields)
    .eq('id', id)
    .eq('org_id', orgId)
    .is('eliminado_en', null)
    .select(REPUESTO_COLUMNS)

  return unwrapWritten<Repuesto>(data, error)
}

/** Soft-delete de un repuesto. */
export async function softDeleteRepuesto(supabase: DbClient, id: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete', { p_table: 'repuestos', p_id: id })
  if (error) throw mapPostgrestError(error)
}

/** Restaura un repuesto eliminado (requiere admin o jefe_taller). */
export async function restoreRepuesto(supabase: DbClient, id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_deleted', { p_table: 'repuestos', p_id: id })
  if (error) throw mapPostgrestError(error)
}

/**
 * Registra un movimiento de stock.
 * El trigger fn_actualizar_stock_repuesto actualiza repuestos.stock_actual de forma atómica.
 * stock_despues en el movimiento es un snapshot calculado en app (informativo).
 */
export async function registrarMovimientoStock(
  supabase: DbClient,
  input: RegistrarMovimientoInput,
): Promise<MovimientoStock> {
  const parsed = registrarMovimientoSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)
  const { repuesto_id, tipo, cantidad, stock_antes, referencia_tipo, referencia_id, motivo } =
    parsed.data

  // Calcular stock_despues (snapshot — el trigger actualiza stock_actual atómicamente)
  const stock_despues =
    tipo === 'entrada' || tipo === 'devolucion'
      ? stock_antes + cantidad
      : Math.max(0, stock_antes - cantidad)

  const { data, error } = await supabase
    .from('movimientos_stock')
    .insert({
      org_id: orgId,
      repuesto_id,
      tipo,
      cantidad,
      stock_antes,
      stock_despues,
      referencia_tipo: referencia_tipo ?? null,
      referencia_id: referencia_id ?? null,
      motivo: motivo ?? null,
      actor_id: userId,
    })
    .select(MOV_COLUMNS)

  return unwrapWritten<MovimientoStock>(data, error)
}

/**
 * Consume stock de un repuesto al usarlo en un ítem de OT.
 * Registra tipo='consumo_ot' con trazabilidad al item_reparacion.
 * No lanza si no hay stock (no bloquea la OT — ver Sprint 8 §FASE 5).
 */
export async function consumirStockParaOT(
  supabase: DbClient,
  params: {
    repuestoId: string
    itemReparacionId: string
    cantidad: number
    stockActual: number
    descripcion: string
  },
): Promise<MovimientoStock | null> {
  const { repuestoId, itemReparacionId, cantidad, stockActual, descripcion } = params
  if (stockActual <= 0) return null // sin stock → no registrar movimiento

  return registrarMovimientoStock(supabase, {
    repuesto_id: repuestoId,
    tipo: 'consumo_ot',
    cantidad: Math.min(cantidad, stockActual), // no consumir más del disponible
    stock_antes: stockActual,
    referencia_tipo: 'items_reparacion',
    referencia_id: itemReparacionId,
    motivo: `Consumo en OT: ${descripcion}`,
  })
}

export { calcularEstadoStock }
