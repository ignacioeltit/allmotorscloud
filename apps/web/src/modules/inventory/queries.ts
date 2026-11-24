import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { puedeVerCostos } from '@/lib/auth/roles'
import { getCostosRepuestos, getCostosMovimientos, getCostoStock } from '@/modules/costos/queries'
import { aplicarCostos } from '@/modules/costos/merge'
import { REPUESTO_COLUMNS, REPUESTO_RESUMEN_COLUMNS, MOVIMIENTO_COLUMNS } from './columns'
import { normalizarBusqueda } from '@/lib/search/normalize'
import type {
  Repuesto,
  RepuestoResumen,
  MovimientoStock,
  EstadoStock,
  ListRepuestosParams,
  ListRepuestosResult,
} from './types'

/**
 * Completa `precio_costo` en repuestos leídos sin él. Solo gestión lo recibe de
 * la base (migration 058); para otros roles queda en null.
 */
export async function conPrecioCosto(
  supabase: DbClient,
  repuestos: readonly Omit<Repuesto, 'precio_costo'>[],
): Promise<Repuesto[]> {
  if (repuestos.length === 0) return []
  const { rol } = await getAuthContext(supabase)
  const costos = puedeVerCostos(rol)
    ? await getCostosRepuestos(supabase, repuestos.map((r) => r.id))
    : null
  return aplicarCostos(repuestos, 'precio_costo', costos)
}

/** Igual que conPrecioCosto, para un solo repuesto. */
export async function conPrecioCostoUno(
  supabase: DbClient,
  repuesto: Omit<Repuesto, 'precio_costo'>,
): Promise<Repuesto> {
  const [conCosto] = await conPrecioCosto(supabase, [repuesto])
  return conCosto ?? { ...repuesto, precio_costo: null }
}

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
  const repuestos = await conPrecioCosto(supabase, (data ?? []) as Omit<Repuesto, 'precio_costo'>[])
  return { data: repuestos, total: count ?? 0 }
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

  let req = supabase
    .from('repuestos')
    .select(REPUESTO_RESUMEN_COLUMNS)
    .eq('activo', true)
    .order('nombre')
    .limit(8)

  // Búsqueda por palabras e insensible a tildes sobre la columna generada `busqueda`.
  for (const token of normalizarBusqueda(query).split(/\s+/)) {
    if (token) req = req.ilike('busqueda', `%${token}%`)
  }

  const { data, error } = await req

  if (error) throw new Error(error.message)

  return ((data ?? []) as Array<Omit<RepuestoResumen, 'estado_stock'> & { stock_minimo: number }>).map((r) => ({
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
  const repuesto = await conPrecioCostoUno(supabase, data as Omit<Repuesto, 'precio_costo'>)
  return repuesto
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
    .select(MOVIMIENTO_COLUMNS)
    .eq('repuesto_id', repuestoId)
    .order('creado_en', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  const { rol } = await getAuthContext(supabase)
  const costos = puedeVerCostos(rol) ? await getCostosMovimientos(supabase, repuestoId) : null
  return aplicarCostos((data ?? []) as Omit<MovimientoStock, 'costo_unitario'>[], 'costo_unitario', costos)
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

/** Resumen del inventario completo: ítems, críticos, valor y costo de stock. */
export interface ResumenInventario {
  items: number
  criticos: number
  valorStock: number
  /** Costo del stock a precio de compra. null si el usuario no es de gestión. */
  costoStock: number | null
}

export async function getResumenInventario(supabase: DbClient): Promise<ResumenInventario> {
  const { orgId, rol } = await getAuthContext(supabase)
  const { data, error } = await supabase
    .from('repuestos')
    .select('stock_actual, stock_minimo, precio_venta')
    .eq('org_id', orgId)
    .eq('activo', true)
    .is('eliminado_en', null)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as {
    stock_actual: number
    stock_minimo: number
    precio_venta: number | null
  }[]
  let valorStock = 0
  let criticos = 0
  for (const r of rows) {
    valorStock += r.stock_actual * (r.precio_venta ?? 0)
    if (r.stock_actual < r.stock_minimo) criticos++
  }
  // Costo del stock: solo gestión (migration 058). null = no mostrar.
  const costoStock = puedeVerCostos(rol) ? await getCostoStock(supabase) : null
  return { items: rows.length, criticos, valorStock, costoStock }
}
