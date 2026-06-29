import type { DbClient } from '@/lib/supabase/types'
import type {
  Repuesto,
  RepuestoResumen,
  MovimientoStock,
  EstadoStock,
  ListRepuestosParams,
} from './types'

const REPUESTO_COLUMNS =
  'id, org_id, sucursal_id, codigo, codigo_barra, nombre, descripcion, marca, modelo_aplicacion, categoria, unidad, precio_costo, precio_venta, stock_actual, stock_minimo, ubicacion, proveedor, activo, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

const REPUESTO_RESUMEN_COLUMNS =
  'id, codigo, nombre, marca, unidad, precio_venta, precio_costo, stock_actual, stock_minimo'

function calcularEstadoStock(stock_actual: number, stock_minimo: number): EstadoStock {
  if (stock_actual <= 0) return 'sin_stock'
  if (stock_actual < stock_minimo) return 'bajo_stock'
  return 'en_stock'
}

/** Lista repuestos del org con filtros opcionales. */
export async function listRepuestos(
  supabase: DbClient,
  params: ListRepuestosParams = {},
): Promise<Repuesto[]> {
  const { query, categoria, solo_bajo_stock, limit = 50, offset = 0 } = params

  let q = supabase
    .from('repuestos')
    .select(REPUESTO_COLUMNS)
    .eq('activo', true)
    .order('nombre')
    .range(offset, offset + limit - 1)

  if (query?.trim()) {
    q = q.or(`codigo.ilike.%${query.trim()}%,nombre.ilike.%${query.trim()}%,marca.ilike.%${query.trim()}%`)
  }

  if (categoria) {
    q = q.eq('categoria', categoria)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as Repuesto[]
}

/**
 * Búsqueda de repuestos para autocomplete en OT.
 * Retorna repuestos con estado_stock calculado.
 * Limit 8 para uso en dropdown de selección.
 */
export async function searchRepuestos(
  supabase: DbClient,
  query: string,
): Promise<RepuestoResumen[]> {
  if (!query.trim()) return []

  const { data, error } = await supabase
    .from('repuestos')
    .select(REPUESTO_RESUMEN_COLUMNS)
    .eq('activo', true)
    .or(`codigo.ilike.%${query.trim()}%,nombre.ilike.%${query.trim()}%,marca.ilike.%${query.trim()}%`)
    .order('nombre')
    .limit(8)

  if (error) throw new Error(error.message)

  return ((data ?? []) as Array<Repuesto>).map((r) => ({
    ...r,
    estado_stock: calcularEstadoStock(r.stock_actual, r.stock_minimo),
  }))
}

/** Obtiene un repuesto por ID. Lanza si no existe o no tiene acceso. */
export async function getRepuestoById(supabase: DbClient, id: string): Promise<Repuesto> {
  const { data, error } = await supabase
    .from('repuestos')
    .select(REPUESTO_COLUMNS)
    .eq('id', id)
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Repuesto no encontrado')
  return data as Repuesto
}

/** Repuestos bajo su stock mínimo (para alertas). Usa la vista definida en migration 004. */
export async function getRepuestosBajoStock(supabase: DbClient): Promise<Repuesto[]> {
  const { data, error } = await supabase
    .from('v_repuestos_bajo_stock')
    .select('id, org_id, codigo, nombre, marca, stock_actual, stock_minimo, unidad, ubicacion, proveedor')
    .order('nombre')

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Repuesto[]
}

/** Historial de movimientos de un repuesto. */
export async function listMovimientosByRepuesto(
  supabase: DbClient,
  repuestoId: string,
  limit = 20,
): Promise<MovimientoStock[]> {
  const { data, error } = await supabase
    .from('movimientos_stock')
    .select('id, org_id, repuesto_id, tipo, cantidad, stock_antes, stock_despues, costo_unitario, precio_venta_unitario, referencia_tipo, referencia_id, motivo, actor_id, creado_en')
    .eq('repuesto_id', repuestoId)
    .order('creado_en', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as MovimientoStock[]
}

export { calcularEstadoStock }
