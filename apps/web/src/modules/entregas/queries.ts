// Lecturas del módulo entregas (tabla `entregas` + vista `v_ot_totales`).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import type { FormaPago } from './constants'
import type { TipoDocumento, CondicionPago, EstadoPago } from '@/modules/finanzas/constants'

export interface Entrega {
  id: string
  orden_trabajo_id: string
  km_salida: number | null
  forma_pago: FormaPago | null
  monto_pagado: number | null
  notas: string | null
  creado_en: string
  // Facturación / cobro (migration 027)
  numero_factura: string | null
  tipo_documento: TipoDocumento
  condicion_pago: CondicionPago
  estado_pago: EstadoPago
  vence_en: string | null
  pagado_en: string | null
}

const ENTREGA_COLUMNS =
  'id, orden_trabajo_id, km_salida, forma_pago, monto_pagado, notas, creado_en,' +
  ' numero_factura, tipo_documento, condicion_pago, estado_pago, vence_en, pagado_en'

/** Totales fiscales de una OT (base afecta, IVA 19%, total con IVA). */
export interface TotalesOT {
  subtotal_mano_obra: number
  subtotal_repuestos: number
  subtotal_otros_trabajos: number
  subtotal_neto_afecto: number
  iva: number
  total_con_iva: number
}

/** La entrega registrada de una OT, o null si aún no se entrega. */
export async function getEntregaByOT(
  supabase: DbClient,
  ordenTrabajoId: string,
): Promise<Entrega | null> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('entregas')
    .select(ENTREGA_COLUMNS)
    .eq('org_id', orgId)
    .eq('orden_trabajo_id', ordenTrabajoId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as Entrega | null) ?? null
}

/** Totales de la OT desde la vista v_ot_totales. */
export async function getTotalesOT(
  supabase: DbClient,
  ordenTrabajoId: string,
): Promise<TotalesOT> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('v_ot_totales')
    .select('subtotal_mano_obra, subtotal_repuestos, subtotal_otros_trabajos, subtotal_neto_afecto, iva, total_con_iva')
    .eq('org_id', orgId)
    .eq('id', ordenTrabajoId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const t = (data as TotalesOT | null) ?? null
  return (
    t ?? {
      subtotal_mano_obra: 0,
      subtotal_repuestos: 0,
      subtotal_otros_trabajos: 0,
      subtotal_neto_afecto: 0,
      iva: 0,
      total_con_iva: 0,
    }
  )
}
