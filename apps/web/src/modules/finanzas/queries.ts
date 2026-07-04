// Lecturas de finanzas: libro de movimientos, resumen y cuentas por cobrar.

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import type { TipoMovimiento, EstadoPago, TipoDocumento, CondicionPago } from './constants'

export interface Movimiento {
  id: string
  tipo: TipoMovimiento
  categoria: string | null
  monto: number
  fecha: string
  descripcion: string | null
  forma_pago: string | null
  orden_trabajo_id: string | null
  numero_ot: string | null
  /** 'manual' = fila de movimientos_financieros (borrable); 'entrega' = ingreso derivado de una OT pagada (no borrable acá). */
  origen: 'manual' | 'entrega'
}

export interface ResumenFinanzas {
  ingresos: number
  gastos: number
  balance: number
}

/** Cuenta por cobrar: entrega a crédito aún pendiente de pago. */
export interface CuentaPorCobrar {
  entrega_id: string
  orden_trabajo_id: string
  numero_ot: string | null
  cliente_nombre: string | null
  numero_factura: string | null
  monto: number
  vence_en: string | null
  vencida: boolean
  creado_en: string
}

/**
 * Libro de movimientos del período: une los movimientos manuales
 * (movimientos_financieros: gastos + ingresos manuales) con los ingresos
 * derivados de las OT pagadas (entregas con estado_pago='pagada'). Así el pago
 * de una OT SIEMPRE aparece como ingreso sin depender de una segunda escritura.
 */
export async function listMovimientos(
  supabase: DbClient,
  params: { desde: string; hasta: string } = { desde: '', hasta: '' },
): Promise<Movimiento[]> {
  const { orgId } = await getAuthContext(supabase)

  // 1) Movimientos manuales (gastos + ingresos manuales).
  let mq = supabase
    .from('movimientos_financieros')
    .select('id, tipo, categoria, monto, fecha, descripcion, forma_pago, orden_trabajo_id, ordenes_trabajo(numero_ot)')
    .eq('org_id', orgId)
    .is('eliminado_en', null)
    .limit(500)
  if (params.desde) mq = mq.gte('fecha', params.desde)
  if (params.hasta) mq = mq.lte('fecha', params.hasta)

  // 2) Ingresos de OT pagadas (por fecha de pago).
  let eq = supabase
    .from('entregas')
    .select('id, monto_pagado, forma_pago, pagado_en, numero_factura, ordenes_trabajo(numero_ot)')
    .eq('org_id', orgId)
    .eq('estado_pago', 'pagada')
    .not('pagado_en', 'is', null)
    .limit(500)
  if (params.desde) eq = eq.gte('pagado_en', params.desde)
  if (params.hasta) eq = eq.lte('pagado_en', params.hasta)

  const [movRes, entRes] = await Promise.all([mq, eq])
  if (movRes.error) throw new Error(movRes.error.message)
  if (entRes.error) throw new Error(entRes.error.message)

  type MovRow = Omit<Movimiento, 'numero_ot' | 'origen'> & { ordenes_trabajo: { numero_ot: string } | null }
  const manuales: Movimiento[] = ((movRes.data ?? []) as unknown as MovRow[]).map((r) => ({
    id: r.id,
    tipo: r.tipo,
    categoria: r.categoria,
    monto: r.monto,
    fecha: r.fecha,
    descripcion: r.descripcion,
    forma_pago: r.forma_pago,
    orden_trabajo_id: r.orden_trabajo_id,
    numero_ot: r.ordenes_trabajo?.numero_ot ?? null,
    origen: 'manual',
  }))

  type EntRow = {
    id: string
    monto_pagado: number | null
    forma_pago: string | null
    pagado_en: string
    numero_factura: string | null
    ordenes_trabajo: { numero_ot: string } | null
  }
  const ingresosOT: Movimiento[] = ((entRes.data ?? []) as unknown as EntRow[]).map((e) => ({
    id: `entrega:${e.id}`,
    tipo: 'ingreso',
    categoria: 'pago_ot',
    monto: e.monto_pagado ?? 0,
    fecha: e.pagado_en,
    descripcion: e.numero_factura ? `Documento N° ${e.numero_factura}` : null,
    forma_pago: e.forma_pago,
    orden_trabajo_id: null,
    numero_ot: e.ordenes_trabajo?.numero_ot ?? null,
    origen: 'entrega',
  }))

  return [...manuales, ...ingresosOT].sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/** Suma de ingresos (manuales + OT pagadas) y gastos del período. */
export async function getResumenFinanzas(
  supabase: DbClient,
  desde: string,
  hasta: string,
): Promise<ResumenFinanzas> {
  const { orgId } = await getAuthContext(supabase)

  const [movRes, entRes] = await Promise.all([
    supabase
      .from('movimientos_financieros')
      .select('tipo, monto')
      .eq('org_id', orgId)
      .is('eliminado_en', null)
      .gte('fecha', desde)
      .lte('fecha', hasta),
    supabase
      .from('entregas')
      .select('monto_pagado')
      .eq('org_id', orgId)
      .eq('estado_pago', 'pagada')
      .not('pagado_en', 'is', null)
      .gte('pagado_en', desde)
      .lte('pagado_en', hasta),
  ])
  if (movRes.error) throw new Error(movRes.error.message)
  if (entRes.error) throw new Error(entRes.error.message)

  let ingresos = 0
  let gastos = 0
  for (const m of (movRes.data ?? []) as { tipo: TipoMovimiento; monto: number }[]) {
    if (m.tipo === 'ingreso') ingresos += m.monto
    else gastos += m.monto
  }
  for (const e of (entRes.data ?? []) as { monto_pagado: number | null }[]) {
    ingresos += e.monto_pagado ?? 0
  }
  return { ingresos, gastos, balance: ingresos - gastos }
}

/** Entregas a crédito aún pendientes de cobro (cuentas por cobrar). */
export async function listCuentasPorCobrar(supabase: DbClient): Promise<CuentaPorCobrar[]> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('entregas')
    .select('id, orden_trabajo_id, numero_factura, monto_pagado, vence_en, creado_en, ordenes_trabajo(numero_ot, vehiculo_id)')
    .eq('org_id', orgId)
    .eq('estado_pago', 'pendiente')
    .order('vence_en', { ascending: true, nullsFirst: false })

  if (error) throw new Error(error.message)

  type Row = {
    id: string
    orden_trabajo_id: string
    numero_factura: string | null
    monto_pagado: number | null
    vence_en: string | null
    creado_en: string
    ordenes_trabajo: { numero_ot: string | null; vehiculo_id: string } | null
  }
  const rows = (data ?? []) as unknown as Row[]

  // Cliente = propietario activo del vehículo de la OT (segunda consulta, robusta).
  const vehiculoIds = [...new Set(rows.map((r) => r.ordenes_trabajo?.vehiculo_id).filter(Boolean))] as string[]
  const nombrePorVehiculo: Record<string, string> = {}
  if (vehiculoIds.length > 0) {
    const { data: pvData } = await supabase
      .from('propietarios_vehiculo')
      .select('vehiculo_id, clientes(nombre)')
      .eq('org_id', orgId)
      .is('fecha_fin', null)
      .in('vehiculo_id', vehiculoIds)
    for (const pv of (pvData ?? []) as unknown as { vehiculo_id: string; clientes: { nombre: string | null } | null }[]) {
      if (pv.clientes?.nombre && !nombrePorVehiculo[pv.vehiculo_id]) {
        nombrePorVehiculo[pv.vehiculo_id] = pv.clientes.nombre
      }
    }
  }

  const hoy = new Date().toISOString().slice(0, 10)
  return rows.map((r) => ({
    entrega_id: r.id,
    orden_trabajo_id: r.orden_trabajo_id,
    numero_ot: r.ordenes_trabajo?.numero_ot ?? null,
    cliente_nombre: r.ordenes_trabajo?.vehiculo_id
      ? nombrePorVehiculo[r.ordenes_trabajo.vehiculo_id] ?? null
      : null,
    numero_factura: r.numero_factura,
    monto: r.monto_pagado ?? 0,
    vence_en: r.vence_en,
    vencida: r.vence_en != null && r.vence_en < hoy,
    creado_en: r.creado_en,
  }))
}

/** Datos de facturación de una entrega (para la sección de la OT). */
export interface FacturacionEntrega {
  numero_factura: string | null
  tipo_documento: TipoDocumento
  condicion_pago: CondicionPago
  estado_pago: EstadoPago
  vence_en: string | null
  pagado_en: string | null
}
