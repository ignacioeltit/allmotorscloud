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

export interface BuscarOtParams {
  q?: string
  estado?: string   // 'todas' | 'en_taller' | <estado exacto>
  limit?: number
  offset?: number
}

/**
 * Busca OTs en la base (N° OT, patente, marca/modelo, cliente) con filtro de
 * estado y paginación, vía fn_buscar_ordenes_trabajo. Necesario porque el
 * universo de OTs (miles) supera el tope de 1.000 filas de PostgREST.
 */
export async function buscarOrdenesTrabajo(
  supabase: DbClient,
  params: BuscarOtParams = {},
): Promise<{ rows: OtListadoRow[]; total: number }> {
  const limit = params.limit ?? 50
  const { data, error } = await supabase.rpc('fn_buscar_ordenes_trabajo', {
    p_q: params.q?.trim() || null,
    p_estado: params.estado || 'todas',
    p_limit: limit,
    p_offset: params.offset ?? 0,
  })
  if (error) throw error

  type Raw = OtListadoRow & { total: number | string }
  const raw = (data ?? []) as Raw[]
  const total = raw.length > 0 ? Number(raw[0]!.total) : 0
  const rows: OtListadoRow[] = raw.map((r) => ({
    id: r.id,
    numero_ot: r.numero_ot,
    estado: r.estado,
    creado_en: r.creado_en,
    patente: r.patente,
    marca: r.marca,
    modelo: r.modelo,
    cliente_nombre: r.cliente_nombre,
  }))
  return { rows, total }
}

export interface ServicioHistorialRow {
  itemId: string
  otId: string
  numeroOt: string
  fecha: string
  km: number | null
  tipo: string
  descripcion: string
  cantidad: number
}

/**
 * Historial plano de servicios de un vehículo: TODAS las líneas (mano de obra,
 * repuestos, otros) de TODAS sus OTs, con su fecha y N° de OT. Permite buscar
 * "cuándo se cambió el filtro" sin abrir OT por OT. Ámbito por vehículo → acotado.
 */
export async function getHistorialServiciosVehiculo(
  supabase: DbClient,
  vehiculoId: string,
): Promise<ServicioHistorialRow[]> {
  const { orgId } = await getAuthContext(supabase)

  const { data: ots, error: e1 } = await supabase
    .from('ordenes_trabajo')
    .select('id, numero_ot, creado_en, cerrado_en, km_ingreso')
    .eq('org_id', orgId)
    .eq('vehiculo_id', vehiculoId)
    .is('eliminado_en', null)
  if (e1) throw e1
  if (!ots || ots.length === 0) return []

  type Ot = { id: string; numero_ot: string; creado_en: string; cerrado_en: string | null; km_ingreso: number | null }
  const otById = new Map((ots as Ot[]).map((o) => [o.id, o]))

  const { data: reps, error: e2 } = await supabase
    .from('reparaciones')
    .select('id, orden_trabajo_id')
    .in('orden_trabajo_id', (ots as Ot[]).map((o) => o.id))
  if (e2) throw e2
  if (!reps || reps.length === 0) return []

  const otByRep = new Map(
    (reps as { id: string; orden_trabajo_id: string }[]).map((r) => [r.id, r.orden_trabajo_id]),
  )

  const { data: items, error: e3 } = await supabase
    .from('items_reparacion')
    .select('id, tipo, descripcion, cantidad, reparacion_id')
    .in('reparacion_id', (reps as { id: string }[]).map((r) => r.id))
    .is('eliminado_en', null)
  if (e3) throw e3

  type It = { id: string; tipo: string; descripcion: string; cantidad: number; reparacion_id: string }
  const rows = (items as It[] | null ?? []).flatMap((it) => {
    const otId = otByRep.get(it.reparacion_id)
    const ot = otId ? otById.get(otId) : undefined
    if (!ot) return []
    return [{
      itemId: it.id,
      otId: ot.id,
      numeroOt: ot.numero_ot,
      fecha: ot.cerrado_en ?? ot.creado_en,
      km: ot.km_ingreso,
      tipo: it.tipo,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
    }]
  })
  rows.sort((a, b) => b.fecha.localeCompare(a.fecha))
  return rows
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
