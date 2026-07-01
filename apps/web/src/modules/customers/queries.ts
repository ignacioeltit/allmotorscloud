// Lecturas del módulo customers (SELECT sobre `clientes`).
// Pueden ejecutarse desde Server Components (server client) o Client Components (browser client).
// RLS filtra por org_id; además filtramos explícitamente (BACKEND_ARCHITECTURE regla 3).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapList, unwrapMaybe, unwrapRequired } from '@/lib/supabase/result'
import { CLIENTES_PAGE_SIZE } from './constants'
import type { Cliente, ListClientesParams } from './types'
import type { Vehiculo } from '@/modules/vehicles/types'

const COLUMNS =
  'id, org_id, tipo, nombre, rut, telefono, email, direccion, notas, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

const VEHICULO_COLUMNS =
  'id, org_id, patente, vin, marca, modelo, anio, color, tipo, km_actual, notas, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

/** Lista los clientes activos (no eliminados) del tenant, ordenados por nombre. */
export async function listClientes(
  supabase: DbClient,
  params: ListClientesParams = {},
): Promise<Cliente[]> {
  const { orgId } = await getAuthContext(supabase)
  const limit = params.limit ?? CLIENTES_PAGE_SIZE
  const offset = params.offset ?? 0

  let query = supabase
    .from('clientes')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .is('eliminado_en', null)
    .order('nombre', { ascending: true })
    .range(offset, offset + limit - 1)

  if (params.search && params.search.trim().length > 0) {
    query = query.ilike('nombre', `%${params.search.trim()}%`)
  }

  const { data, error } = await query
  return unwrapList<Cliente>(data, error)
}

/** Obtiene un cliente por id dentro del tenant. Lanza NotFoundError si no existe. */
export async function getClienteById(supabase: DbClient, id: string): Promise<Cliente> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('clientes')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .maybeSingle()

  return unwrapRequired<Cliente>(data as Cliente | null, error)
}

/**
 * Lista los vehículos actualmente asociados a un cliente (propiedad activa:
 * propietarios_vehiculo con fecha_fin = null), ordenados por fecha de creación desc.
 */
export async function listVehiculosByCliente(
  supabase: DbClient,
  clienteId: string,
): Promise<Vehiculo[]> {
  const { orgId } = await getAuthContext(supabase)

  const { data: rels, error: relErr } = await supabase
    .from('propietarios_vehiculo')
    .select('vehiculo_id')
    .eq('org_id', orgId)
    .eq('cliente_id', clienteId)
    .is('fecha_fin', null)

  const relRows = unwrapList<{ vehiculo_id: string }>(rels, relErr)
  if (relRows.length === 0) return []

  const vehiculoIds = relRows.map((r) => r.vehiculo_id)
  const { data, error } = await supabase
    .from('vehiculos')
    .select(VEHICULO_COLUMNS)
    .eq('org_id', orgId)
    .in('id', vehiculoIds)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false })

  return unwrapList<Vehiculo>(data, error)
}

/**
 * Devuelve el cliente propietario actual de un vehículo (propietarios_vehiculo activo),
 * o null si el vehículo no tiene propietario asignado.
 */
export async function getPropietarioActivoByVehiculo(
  supabase: DbClient,
  vehiculoId: string,
): Promise<Cliente | null> {
  const { orgId } = await getAuthContext(supabase)

  const { data: rel, error: relErr } = await supabase
    .from('propietarios_vehiculo')
    .select('cliente_id')
    .eq('org_id', orgId)
    .eq('vehiculo_id', vehiculoId)
    .is('fecha_fin', null)
    .order('fecha_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  const row = unwrapMaybe<{ cliente_id: string }>(
    rel as { cliente_id: string } | null,
    relErr,
  )
  if (!row) return null

  const { data, error } = await supabase
    .from('clientes')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('id', row.cliente_id)
    .is('eliminado_en', null)
    .maybeSingle()

  return unwrapMaybe<Cliente>(data as Cliente | null, error)
}
