// Escrituras del módulo entregas.
//
// La entrega es el cierre operativo + facturación de la OT: registra forma de
// pago, monto, km de salida, N° de documento (boleta/factura) y condición de
// pago (contado/crédito). Deja la OT en 'entregada'. Si es al contado, además
// registra el ingreso en el libro de finanzas. RLS: admin/jefe_taller/
// recepcionista (migration 003 + 027). UNIQUE(orden_trabajo_id): una por OT.

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { ValidationError } from '@/lib/errors'
import { cambiarEstadoOrdenTrabajo } from '@/modules/repair-orders/mutations'
import type { TipoDocumento, CondicionPago } from '@/modules/finanzas/constants'
import { FORMAS_PAGO, type FormaPago } from './constants'

export interface RegistrarEntregaInput {
  ordenTrabajoId: string
  formaPago: FormaPago
  montoPagado: number
  kmSalida?: number | null
  notas?: string | null
  // Facturación
  tipoDocumento: TipoDocumento
  numeroFactura?: string | null
  condicionPago: CondicionPago
  /** Solo para crédito: fecha de vencimiento (YYYY-MM-DD). */
  venceEn?: string | null
}

/**
 * Registra la entrega + facturación y mueve la OT a 'entregada'. Al contado, la
 * entrega queda pagada y se registra el ingreso; a crédito queda pendiente (va a
 * cuentas por cobrar) y el ingreso se registra al cobrar (marcarEntregaPagada).
 */
export async function registrarEntrega(
  supabase: DbClient,
  input: RegistrarEntregaInput,
): Promise<{ id: string }> {
  if (!FORMAS_PAGO.includes(input.formaPago)) throw new ValidationError('Forma de pago inválida.')
  const { userId, orgId } = await getAuthContext(supabase)

  // Regla del taller: sin km de ingreso no se entrega (valida antes de insertar).
  const { data: ot } = await supabase
    .from('ordenes_trabajo')
    .select('km_ingreso')
    .eq('org_id', orgId)
    .eq('id', input.ordenTrabajoId)
    .maybeSingle()
  if ((ot as { km_ingreso: number | null } | null)?.km_ingreso == null) {
    throw new ValidationError(
      'La OT no tiene kilometraje de ingreso. Regístralo en la cabecera antes de entregar.',
    )
  }

  const esContado = input.condicionPago === 'contado'
  const hoy = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('entregas')
    .insert({
      org_id: orgId,
      orden_trabajo_id: input.ordenTrabajoId,
      forma_pago: input.formaPago,
      monto_pagado: input.montoPagado,
      tipo_documento: input.tipoDocumento,
      condicion_pago: input.condicionPago,
      estado_pago: esContado ? 'pagada' : 'pendiente',
      ...(esContado ? { pagado_en: hoy } : {}),
      ...(!esContado && input.venceEn ? { vence_en: input.venceEn } : {}),
      ...(input.numeroFactura?.trim() ? { numero_factura: input.numeroFactura.trim() } : {}),
      ...(input.kmSalida != null ? { km_salida: Math.round(input.kmSalida) } : {}),
      ...(input.notas?.trim() ? { notas: input.notas.trim() } : {}),
      creado_por: userId,
    })
    .select('id')

  const entrega = unwrapWritten<{ id: string }>(data, error)

  // La OT queda 'entregada'. El ingreso (si es al contado) lo deriva Finanzas
  // de la entrega pagada — sin escritura aparte.
  await cambiarEstadoOrdenTrabajo(supabase, input.ordenTrabajoId, { estado: 'entregada' })

  return entrega
}
