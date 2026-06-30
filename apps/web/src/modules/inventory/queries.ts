import type { DbClient } from '@/lib/supabase/types'
import type {
  Repuesto,
  RepuestoResumen,
  MovimientoStock,
  EstadoStock,
  ListRepuestosParams,
  ListRepuestosResult,
} from './types'

const REPUESTO_COLUMNS =
  'id, org_id, sucursal_id, codigo, codigo_barra, nombre, descripcion, marca, modelo_aplicacion, categoria, unidad, precio_costo, precio_venta, stock_actual, stock_minimo, ubicacion, proveedor, activo, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

const REPUESTO_RESUMEN_COLUMNS =
  'id, codigo, nombre, descripcion, marca, unidad, precio_venta, precio_costo, stock_actual, stock_minimo'

function calcularEstadoStock(stock_actual: number, stock_minimo: number): EstadoStock {
  if (stock_actual <= 0) return 'sin_stock'
  if (stock_actual < stock_minimo) return 'bajo_stock'
  return 'en_stock'
}

const DEFAULT_PAGE_SIZE = 50

/** Lista repuestos del org con búsqueda server-side, paginación y conteo total. */
export async function listRepuestos(
  supabase: DbClient,
  params: ListRepuestosParams = {},
): Promise<ListRepuestosResult> {
  const { query, categoria, page = 1, pageSize = DEFAULT_PAGE_SIZE } = params
  const safePage = Math.max(1, page)
  const safeSize = Math.min(Math.max(1, pageSize), 200)
  const offset   = (safePage - 1) * safeSize
  const term     = query?.trim() ?? ''

  let q = supabase
    .from('repuestos')
    .select(REPUESTO_COLUMNS, { count: 'exact' })
    .eq('activo', true)
    .is('eliminado_en', null)
    .range(offset, offset + safeSize - 1)

  if (term) {
    // Busca en código, nombre, marca, proveedor y descripción.
    // Escapar % y _ para evitar wildcards accidentales en el term literal.
    const escaped = term.replace(/%/g, '\\%').replace(/_/g, '\\_')
    q = q.or(
      `codigo.ilike.%${escaped}%,nombre.ilike.%${escaped}%,marca.ilike.%${escaped}%,proveedor.ilike.%${escaped}%,descripcion.ilike.%${escaped}%`,
    )
    // Ordenar primero por código para que matches exactos de código aparezcan antes
    q = q.order('codigo').order('nombre')
  } else {
    q = q.order('nombre')
  }

  if (categoria) q = q.eq('categoria', categoria)

  const { data, error, count } = await q
  if (error) throw new Error(error.message)
  return { data: (data ?? []) as Repuesto[], total: count ?? 0 }
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

export interface UsoEnOt {
  id: string
  descripcion: string
  cantidad: number
  costo_total: number
  creado_en: string
  ot_id: string | null
  ot_numero: string | null
}

/** Últimas OTs donde se usó este repuesto (vía items_reparacion). */
export async function getUsoEnOts(
  supabase: DbClient,
  repuestoId: string,
  limit = 10,
): Promise<UsoEnOt[]> {
  const { data: items, error } = await supabase
    .from('items_reparacion')
    .select('id, descripcion, cantidad, costo_total, creado_en, reparacion_id')
    .eq('repuesto_id', repuestoId)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  if (!items || items.length === 0) return []

  const repIds = [...new Set(items.map((i) => i.reparacion_id as string))]
  const { data: reps } = await supabase
    .from('reparaciones')
    .select('id, orden_trabajo_id')
    .in('id', repIds)

  const otIds = [...new Set((reps ?? []).map((r) => r.orden_trabajo_id as string))]
  const { data: ots } = await supabase
    .from('ordenes_trabajo')
    .select('id, numero_ot')
    .in('id', otIds)

  const repMap = Object.fromEntries((reps ?? []).map((r) => [r.id, r]))
  const otMap  = Object.fromEntries((ots  ?? []).map((o) => [o.id, o]))

  return items.map((item) => {
    const rep = repMap[item.reparacion_id as string]
    const ot  = rep ? otMap[rep.orden_trabajo_id as string] : null
    return {
      id:          item.id as string,
      descripcion: item.descripcion as string,
      cantidad:    item.cantidad as number,
      costo_total: item.costo_total as number,
      creado_en:   item.creado_en as string,
      ot_id:       ot?.id       ?? null,
      ot_numero:   ot?.numero_ot ?? null,
    }
  })
}

export { calcularEstadoStock }
