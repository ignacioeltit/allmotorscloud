// Lecturas del módulo estimates (SELECT sobre `presupuestos` e `items_presupuesto`).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapList, unwrapMaybe } from '@/lib/supabase/result'
import type { Presupuesto, ItemPresupuesto, PresupuestoConItems } from './types'
import type { EstadoPresupuesto } from './constants'

const PRES_COLUMNS =
  'id, org_id, orden_trabajo_id, presupuesto_anterior_id, version, estado, total_mano_obra, total_repuestos, total_otros, total_descuentos, total_neto, notas, enviado_en, autorizado_en, autorizado_por_nombre, rechazado_en, razon_rechazo, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

const ITEM_COLUMNS =
  'id, org_id, presupuesto_id, tipo, descripcion, repuesto_id, cantidad, precio_unitario, descuento_porcentaje, precio_total, autorizador_id, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

/** Fila del listado global de presupuestos (vista v_presupuestos_listado). */
export interface PresupuestoListado {
  id: string
  orden_trabajo_id: string | null
  estado: EstadoPresupuesto
  total_neto: number
  creado_en: string
  numero_ot: string | null
  patente: string | null
  marca: string | null
  modelo: string | null
  cliente_nombre: string | null
}

/** Detalle de cotización: presupuesto + ítems + cliente y vehículo directos. */
export interface CotizacionDetalle extends PresupuestoConItems {
  cliente: { id: string; nombre: string; rut: string | null; telefono: string | null } | null
  vehiculo: { id: string; patente: string; marca: string; modelo: string; anio: number | null } | null
  token_publico: string | null
  nota_cliente: string | null
  agendar_solicitado: boolean
}

/** Obtiene una cotización (o presupuesto) por id, con ítems, cliente y vehículo. */
export async function getCotizacionById(
  supabase: DbClient,
  id: string,
): Promise<CotizacionDetalle | null> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('presupuestos')
    .select(PRES_COLUMNS + ', cliente_id, vehiculo_id, token_publico, nota_cliente, agendar_solicitado')
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .maybeSingle()

  type PresExtra = Presupuesto & {
    cliente_id: string | null
    vehiculo_id: string | null
    token_publico: string | null
    nota_cliente: string | null
    agendar_solicitado: boolean
  }
  const pres = unwrapMaybe<PresExtra>(data as PresExtra | null, error)
  if (!pres) return null

  const { data: itemsData, error: itemsError } = await supabase
    .from('items_presupuesto')
    .select(ITEM_COLUMNS)
    .eq('org_id', orgId)
    .eq('presupuesto_id', pres.id)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: true })
  const items = unwrapList<ItemPresupuesto>(itemsData, itemsError)

  let cliente: CotizacionDetalle['cliente'] = null
  if (pres.cliente_id) {
    const { data: c } = await supabase
      .from('clientes')
      .select('id, nombre, rut, telefono')
      .eq('org_id', orgId)
      .eq('id', pres.cliente_id)
      .maybeSingle()
    cliente = (c as CotizacionDetalle['cliente']) ?? null
  }

  let vehiculo: CotizacionDetalle['vehiculo'] = null
  if (pres.vehiculo_id) {
    const { data: v } = await supabase
      .from('vehiculos')
      .select('id, patente, marca, modelo, anio')
      .eq('org_id', orgId)
      .eq('id', pres.vehiculo_id)
      .maybeSingle()
    vehiculo = (v as CotizacionDetalle['vehiculo']) ?? null
  }

  return { ...pres, items, cliente, vehiculo }
}

/**
 * Lista presupuestos del tenant (incluye cotizaciones sueltas sin OT) con
 * búsqueda server-side por N° de OT, patente o cliente, paginación y conteo.
 */
export async function listPresupuestosPaged(
  supabase: DbClient,
  params: { query?: string; page?: number; pageSize?: number } = {},
): Promise<{ data: PresupuestoListado[]; total: number }> {
  const { orgId } = await getAuthContext(supabase)
  const pageSize = params.pageSize ?? 50
  const page = Math.max(1, params.page ?? 1)
  const from = (page - 1) * pageSize

  let q = supabase
    .from('v_presupuestos_listado')
    .select(
      'id, orden_trabajo_id, estado, total_neto, creado_en, numero_ot, patente, marca, modelo, cliente_nombre',
      { count: 'exact' },
    )
    .eq('org_id', orgId)
    .is('eliminado_en', null)

  const term = params.query?.trim()
  if (term) {
    const escaped = term.replace(/%/g, '\\%').replace(/_/g, '\\_')
    q = q.or(
      `numero_ot.ilike.%${escaped}%,patente.ilike.%${escaped}%,cliente_nombre.ilike.%${escaped}%`,
    )
  }

  const { data, error, count } = await q
    .order('creado_en', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) throw new Error(error.message)
  return { data: (data ?? []) as PresupuestoListado[], total: count ?? 0 }
}

/** Cotización que el cliente ya respondió por el enlace público (para el dashboard). */
export interface CotizacionRespondida {
  id: string
  orden_trabajo_id: string | null
  estado: 'autorizado' | 'rechazado'
  total_neto: number
  respondido_en: string | null
  agendar_solicitado: boolean
  nota_cliente: string | null
  patente: string | null
  marca: string | null
  modelo: string | null
  cliente_nombre: string | null
}

/**
 * Últimas cotizaciones respondidas por el cliente (autorizadas o rechazadas),
 * ordenadas por fecha de respuesta. Las que piden agendar salen resaltadas en el
 * dashboard. Lee directo de `presupuestos` (los campos de respuesta existen desde
 * la migration 019) embebiendo cliente y vehículo — directo o vía la OT.
 */
export async function listCotizacionesRespondidas(
  supabase: DbClient,
  limit = 8,
): Promise<CotizacionRespondida[]> {
  const { orgId } = await getAuthContext(supabase)

  type Row = {
    id: string
    orden_trabajo_id: string | null
    estado: 'autorizado' | 'rechazado'
    total_neto: number
    autorizado_en: string | null
    rechazado_en: string | null
    agendar_solicitado: boolean
    nota_cliente: string | null
    clientes: { nombre: string | null } | null
    vehiculos: { patente: string | null; marca: string | null; modelo: string | null } | null
    ordenes_trabajo:
      | { vehiculos: { patente: string | null; marca: string | null; modelo: string | null } | null }
      | null
  }

  const { data, error } = await supabase
    .from('presupuestos')
    .select(
      'id, orden_trabajo_id, estado, total_neto, autorizado_en, rechazado_en, agendar_solicitado, nota_cliente,' +
        ' clientes(nombre), vehiculos(patente,marca,modelo), ordenes_trabajo(vehiculos(patente,marca,modelo))',
    )
    .eq('org_id', orgId)
    .is('eliminado_en', null)
    .in('estado', ['autorizado', 'rechazado'])
    .order('actualizado_en', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as Row[]).map((r) => {
    const veh = r.vehiculos ?? r.ordenes_trabajo?.vehiculos ?? null
    return {
      id: r.id,
      orden_trabajo_id: r.orden_trabajo_id,
      estado: r.estado,
      total_neto: r.total_neto,
      respondido_en: r.autorizado_en ?? r.rechazado_en,
      agendar_solicitado: r.agendar_solicitado,
      nota_cliente: r.nota_cliente,
      patente: veh?.patente ?? null,
      marca: veh?.marca ?? null,
      modelo: veh?.modelo ?? null,
      cliente_nombre: r.clientes?.nombre ?? null,
    }
  })
}

/**
 * Devuelve el presupuesto activo (borrador o enviado) de una OT con sus ítems, o null.
 * Por UNIQUE parcial idx_presupuestos_ot_version_activa solo hay uno a la vez.
 */
export async function getPresupuestoActivoByOT(
  supabase: DbClient,
  ordenTrabajoId: string,
): Promise<PresupuestoConItems | null> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('presupuestos')
    .select(PRES_COLUMNS)
    .eq('org_id', orgId)
    .eq('orden_trabajo_id', ordenTrabajoId)
    .is('eliminado_en', null)
    .in('estado', ['borrador', 'enviado'])
    .maybeSingle()

  const presupuesto = unwrapMaybe<Presupuesto>(data as Presupuesto | null, error)
  if (!presupuesto) return null

  const { data: itemsData, error: itemsError } = await supabase
    .from('items_presupuesto')
    .select(ITEM_COLUMNS)
    .eq('org_id', orgId)
    .eq('presupuesto_id', presupuesto.id)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: true })

  const items = unwrapList<ItemPresupuesto>(itemsData, itemsError)
  return { ...presupuesto, items }
}
