// Lecturas del módulo repair-orders (SELECT sobre `ordenes_trabajo`).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapList, unwrapMaybe, unwrapRequired } from '@/lib/supabase/result'
import { ESTADOS_OT_TERMINALES, ORDENES_TRABAJO_PAGE_SIZE } from './constants'
import type { OrdenTrabajo, ListOrdenesTrabajoParams } from './types'

const COLUMNS =
  'id, org_id, vehiculo_id, numero_ot, estado, sucursal_id, recepcionista_id, km_ingreso, fecha_prometida_entrega, notas, cerrado_en, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

/** Lista las OT activas (no eliminadas) del tenant, más recientes primero. */
export async function listOrdenesTrabajo(
  supabase: DbClient,
  params: ListOrdenesTrabajoParams = {},
): Promise<OrdenTrabajo[]> {
  const { orgId } = await getAuthContext(supabase)
  const limit = params.limit ?? ORDENES_TRABAJO_PAGE_SIZE
  const offset = params.offset ?? 0

  let query = supabase
    .from('ordenes_trabajo')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false })
    .range(offset, offset + limit - 1)

  if (params.estado) {
    query = query.eq('estado', params.estado)
  }

  const { data, error } = await query
  return unwrapList<OrdenTrabajo>(data, error)
}

/** Obtiene una OT por id. Lanza NotFoundError si no existe en el tenant. */
export async function getOrdenTrabajoById(
  supabase: DbClient,
  id: string,
): Promise<OrdenTrabajo> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .maybeSingle()

  return unwrapRequired<OrdenTrabajo>(data as OrdenTrabajo | null, error)
}

/** Lista todas las OT de un vehículo (historial), más recientes primero. */
export async function listOrdenesTrabajoByVehiculo(
  supabase: DbClient,
  vehiculoId: string,
): Promise<OrdenTrabajo[]> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('vehiculo_id', vehiculoId)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false })

  return unwrapList<OrdenTrabajo>(data, error)
}

export interface OtListadoRow {
  id: string
  numero_ot: string
  estado: string
  creado_en: string
  patente: string | null
  marca: string | null
  modelo: string | null
  cliente_nombre: string | null
}

/**
 * Lista OTs del tenant para la pantalla de listado (buscador + filtro estado).
 * Incluye datos del vehículo (embed) y resuelve el cliente propietario en una
 * segunda consulta batcheada. El universo por taller es chico (cientos), así
 * que trae hasta `limit` filas y el filtrado fino se hace en el cliente.
 */
export async function listOrdenesTrabajoParaListado(
  supabase: DbClient,
  limit = 500,
): Promise<OtListadoRow[]> {
  const { orgId } = await getAuthContext(supabase)

  const { data: otData, error } = await supabase
    .from('ordenes_trabajo')
    .select('id, numero_ot, estado, creado_en, vehiculo_id, vehiculos(patente, marca, modelo)')
    .eq('org_id', orgId)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false })
    .limit(limit)
  if (error) throw error

  type Raw = {
    id: string
    numero_ot: string
    estado: string
    creado_en: string
    vehiculo_id: string | null
    vehiculos: { patente: string | null; marca: string | null; modelo: string | null } | null
  }
  const rows = (otData ?? []) as unknown as Raw[]

  // Cliente = propietario activo del vehículo (segunda consulta, robusta).
  const vehiculoIds = [...new Set(rows.map((r) => r.vehiculo_id).filter(Boolean) as string[])]
  const nombrePorVehiculo: Record<string, string> = {}
  if (vehiculoIds.length > 0) {
    const { data: pvData } = await supabase
      .from('propietarios_vehiculo')
      .select('vehiculo_id, clientes(nombre)')
      .in('vehiculo_id', vehiculoIds)
      .is('fecha_fin', null)
    for (const pv of (pvData ?? []) as unknown as {
      vehiculo_id: string
      clientes: { nombre: string | null } | null
    }[]) {
      if (pv.clientes?.nombre && !nombrePorVehiculo[pv.vehiculo_id]) {
        nombrePorVehiculo[pv.vehiculo_id] = pv.clientes.nombre
      }
    }
  }

  return rows.map((r) => ({
    id: r.id,
    numero_ot: r.numero_ot,
    estado: r.estado,
    creado_en: r.creado_en,
    patente: r.vehiculos?.patente ?? null,
    marca: r.vehiculos?.marca ?? null,
    modelo: r.vehiculos?.modelo ?? null,
    cliente_nombre: r.vehiculo_id ? nombrePorVehiculo[r.vehiculo_id] ?? null : null,
  }))
}

/**
 * Devuelve la OT activa de un vehículo, o null si no hay ninguna.
 * Por invariante de dominio (trigger) hay como máximo una OT activa por vehículo.
 */
export async function getOrdenTrabajoActivaByVehiculo(
  supabase: DbClient,
  vehiculoId: string,
): Promise<OrdenTrabajo | null> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('vehiculo_id', vehiculoId)
    .is('eliminado_en', null)
    .not('estado', 'in', `(${ESTADOS_OT_TERMINALES.join(',')})`)
    .maybeSingle()

  return unwrapMaybe<OrdenTrabajo>(data as OrdenTrabajo | null, error)
}

/**
 * Genera el siguiente número de OT correlativo del tenant, con formato `OT-000001`.
 * Toma el mayor numero_ot existente (incluye soft-deleted: el UNIQUE no es parcial) y suma 1.
 * Nota: bajo alta concurrencia dos recepciones simultáneas podrían generar el mismo número;
 * el UNIQUE(org_id, numero_ot) lo rechaza y la orquestación reintenta.
 */
export async function getSiguienteNumeroOt(supabase: DbClient): Promise<string> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select('numero_ot')
    .eq('org_id', orgId)
    .order('numero_ot', { ascending: false })
    .limit(1)
    .maybeSingle()

  const row = unwrapMaybe<{ numero_ot: string }>(
    data as { numero_ot: string } | null,
    error,
  )

  let siguiente = 1
  if (row?.numero_ot) {
    const match = /(\d+)\s*$/.exec(row.numero_ot)
    const grupo = match?.[1]
    if (grupo) siguiente = Number.parseInt(grupo, 10) + 1
  }
  return `OT-${String(siguiente).padStart(6, '0')}`
}
