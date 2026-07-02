// Lecturas del módulo catálogo (tabla `catalogo_servicios`).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapList } from '@/lib/supabase/result'
import { normalizarBusqueda } from '@/lib/search/normalize'
import type { CatalogoServicio } from './types'

const SERVICIO_COLUMNS =
  'id, org_id, codigo, nombre, descripcion, categoria, precio_unitario, unidad_precio, horas_estandar, activo, es_checklist, fuente, requiere_revision, frecuencia_uso, creado_en, actualizado_en, eliminado_en'

/**
 * Busca servicios aprobados en el catálogo por nombre o código.
 * Solo devuelve servicios activos, aprobados y no eliminados.
 * Máximo 10 resultados ordenados por frecuencia_uso desc.
 */
export async function buscarServiciosCatalogo(
  supabase: DbClient,
  query: string,
  categoria?: string,
): Promise<CatalogoServicio[]> {
  const { orgId } = await getAuthContext(supabase)

  let req = supabase
    .from('catalogo_servicios')
    .select(SERVICIO_COLUMNS)
    .eq('org_id', orgId)
    .eq('activo', true)
    .eq('requiere_revision', false)
    .is('eliminado_en', null)
    .order('frecuencia_uso', { ascending: false, nullsFirst: false })
    .limit(10)

  // Búsqueda por palabras e insensible a tildes: se normaliza el término (sin
  // acentos, minúsculas) y se filtra sobre la columna generada `busqueda`. Cada
  // token debe aparecer (AND vía chaining de ilike).
  for (const token of normalizarBusqueda(query).split(/\s+/)) {
    if (token) req = req.ilike('busqueda', `%${token}%`)
  }

  if (categoria) {
    req = req.eq('categoria', categoria)
  }

  const { data, error } = await req
  return unwrapList<CatalogoServicio>(data, error)
}

/**
 * Cuenta servicios pendientes de revisión de la organización.
 * Para mostrar el badge en la OT y en el sidebar.
 */
export async function contarServiciosPendientes(supabase: DbClient): Promise<number> {
  const { orgId } = await getAuthContext(supabase)

  const { count, error } = await supabase
    .from('catalogo_servicios')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('requiere_revision', true)
    .is('eliminado_en', null)

  if (error) return 0
  return count ?? 0
}

/**
 * Lista todos los servicios aprobados del catálogo oficial con paginación.
 * Solo devuelve servicios activos, aprobados y no eliminados.
 */
export async function listarServiciosCatalogo(
  supabase: DbClient,
  opts: { query?: string; categoria?: string; page: number; pageSize: number },
): Promise<{ data: CatalogoServicio[]; total: number }> {
  const { orgId } = await getAuthContext(supabase)
  const offset = (opts.page - 1) * opts.pageSize

  let req = supabase
    .from('catalogo_servicios')
    .select(SERVICIO_COLUMNS, { count: 'exact' })
    .eq('org_id', orgId)
    .eq('activo', true)
    .eq('requiere_revision', false)
    .is('eliminado_en', null)
    .order('nombre', { ascending: true })
    .range(offset, offset + opts.pageSize - 1)

  if (opts.query?.trim()) {
    req = req.or(`nombre.ilike.%${opts.query.trim()}%,codigo.ilike.%${opts.query.trim()}%`)
  }
  if (opts.categoria) {
    req = req.eq('categoria', opts.categoria)
  }

  const { data, error, count } = await req
  if (error) throw new Error(error.message)
  return { data: (data ?? []) as CatalogoServicio[], total: count ?? 0 }
}

/**
 * Lista todos los servicios pendientes de revisión de la organización.
 * Solo accesible por admin y jefe_taller (el caller valida el rol).
 */
export async function listarServiciosPendientes(
  supabase: DbClient,
  opts: { query?: string; categoria?: string } = {},
): Promise<CatalogoServicio[]> {
  const { orgId } = await getAuthContext(supabase)

  let req = supabase
    .from('catalogo_servicios')
    .select(SERVICIO_COLUMNS)
    .eq('org_id', orgId)
    .eq('requiere_revision', true)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false })

  if (opts.query?.trim()) {
    req = req.ilike('nombre', `%${opts.query.trim()}%`)
  }
  if (opts.categoria) {
    req = req.eq('categoria', opts.categoria)
  }

  const { data, error } = await req
  if (error) throw new Error(error.message)
  return (data ?? []) as CatalogoServicio[]
}
