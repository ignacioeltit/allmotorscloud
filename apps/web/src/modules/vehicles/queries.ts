// Lecturas del módulo vehicles (SELECT sobre `vehiculos`).

import { normalizarPatente } from '@/lib/identificadores'
import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapList, unwrapMaybe, unwrapRequired } from '@/lib/supabase/result'
import { VEHICULOS_PAGE_SIZE } from './constants'
import type { Vehiculo, ListVehiculosParams } from './types'

const COLUMNS =
  'id, org_id, patente, vin, marca, modelo, anio, anio_por_confirmar, color, cilindrada, tipo, km_actual, notas, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

/** Lista los vehículos activos del tenant, ordenados por fecha de creación desc. */
export async function listVehiculos(
  supabase: DbClient,
  params: ListVehiculosParams = {},
): Promise<Vehiculo[]> {
  const { orgId } = await getAuthContext(supabase)
  const limit = params.limit ?? VEHICULOS_PAGE_SIZE
  const offset = params.offset ?? 0

  let query = supabase
    .from('vehiculos')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false })
    .range(offset, offset + limit - 1)

  const search = params.search?.trim()
  if (search) {
    // Patente normalizada (sin guion): "hdcx-10" encuentra "HDCX10".
    const pat = normalizarPatente(search)
    const raw = search.replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.or(
      `patente.ilike.%${pat}%,marca.ilike.%${raw}%,modelo.ilike.%${raw}%`,
    )
  }

  const { data, error } = await query
  return unwrapList<Vehiculo>(data, error)
}

/**
 * Lista vehículos con búsqueda server-side (patente, VIN, marca o modelo),
 * paginación y conteo total — para el listado principal /vehicles.
 */
export async function listVehiculosPaged(
  supabase: DbClient,
  params: { query?: string; page?: number; pageSize?: number } = {},
): Promise<{ data: Vehiculo[]; total: number }> {
  const { orgId } = await getAuthContext(supabase)
  const pageSize = params.pageSize ?? VEHICULOS_PAGE_SIZE
  const page = Math.max(1, params.page ?? 1)
  const from = (page - 1) * pageSize

  let q = supabase
    .from('vehiculos')
    .select(COLUMNS, { count: 'exact' })
    .eq('org_id', orgId)
    .is('eliminado_en', null)

  const term = params.query?.trim()
  if (term) {
    const escaped = term.replace(/%/g, '\\%').replace(/_/g, '\\_')
    const pat = normalizarPatente(term)
    q = q.or(
      `patente.ilike.%${pat}%,vin.ilike.%${pat}%,marca.ilike.%${escaped}%,modelo.ilike.%${escaped}%`,
    )
  }

  const { data, error, count } = await q
    .order('patente', { ascending: true })
    .range(from, from + pageSize - 1)

  if (error) throw new Error(error.message)
  return { data: (data ?? []) as Vehiculo[], total: count ?? 0 }
}

/** Obtiene un vehículo por id. Lanza NotFoundError si no existe en el tenant. */
export async function getVehiculoById(supabase: DbClient, id: string): Promise<Vehiculo> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('vehiculos')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .maybeSingle()

  return unwrapRequired<Vehiculo>(data as Vehiculo | null, error)
}

/** Busca un vehículo por patente exacta (normalizada). Devuelve null si no existe. */
export async function getVehiculoByPatente(
  supabase: DbClient,
  patente: string,
): Promise<Vehiculo | null> {
  const { orgId } = await getAuthContext(supabase)
  const normalizada = patente.toUpperCase().replace(/[\s-]/g, '')

  const { data, error } = await supabase
    .from('vehiculos')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('patente', normalizada)
    .is('eliminado_en', null)
    .maybeSingle()

  return unwrapMaybe<Vehiculo>(data as Vehiculo | null, error)
}
