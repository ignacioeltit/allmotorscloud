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
}

/** Obtiene una cotización (o presupuesto) por id, con ítems, cliente y vehículo. */
export async function getCotizacionById(
  supabase: DbClient,
  id: string,
): Promise<CotizacionDetalle | null> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('presupuestos')
    .select(PRES_COLUMNS + ', cliente_id, vehiculo_id')
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .maybeSingle()

  const pres = unwrapMaybe<Presupuesto & { cliente_id: string | null; vehiculo_id: string | null }>(
    data as (Presupuesto & { cliente_id: string | null; vehiculo_id: string | null }) | null,
    error,
  )
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
