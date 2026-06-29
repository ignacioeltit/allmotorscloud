// Lecturas del módulo vehicles (SELECT sobre `vehiculos`).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapList, unwrapMaybe, unwrapRequired } from '@/lib/supabase/result'
import { VEHICULOS_PAGE_SIZE } from './constants'
import type { Vehiculo, ListVehiculosParams } from './types'

const COLUMNS =
  'id, org_id, patente, vin, marca, modelo, anio, color, tipo, km_actual, notas, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

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
    // Búsqueda en patente, marca o modelo.
    query = query.or(
      `patente.ilike.%${search}%,marca.ilike.%${search}%,modelo.ilike.%${search}%`,
    )
  }

  const { data, error } = await query
  return unwrapList<Vehiculo>(data, error)
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
