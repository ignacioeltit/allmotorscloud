// Escrituras del módulo entregas.
//
// La entrega es el cierre operativo de la OT frente al cliente: registra forma
// de pago, monto y km de salida, y deja la OT en estado 'entregada'. RLS:
// admin/jefe_taller/recepcionista (migration 003). UNIQUE(orden_trabajo_id) →
// una sola entrega por OT (el comprobante es único).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { ValidationError } from '@/lib/errors'
import { cambiarEstadoOrdenTrabajo } from '@/modules/repair-orders/mutations'
import { FORMAS_PAGO, type FormaPago } from './constants'

export interface RegistrarEntregaInput {
  ordenTrabajoId: string
  formaPago: FormaPago
  montoPagado: number
  kmSalida?: number | null
  notas?: string | null
}

/**
 * Registra la entrega del vehículo y mueve la OT a 'entregada'. El cambio de
 * estado pasa por cambiarEstadoOrdenTrabajo, que exige km_ingreso (regla del
 * taller). Si el km de salida viene, se guarda en la entrega.
 */
export async function registrarEntrega(
  supabase: DbClient,
  input: RegistrarEntregaInput,
): Promise<{ id: string }> {
  if (!FORMAS_PAGO.includes(input.formaPago)) {
    throw new ValidationError('Forma de pago inválida.')
  }
  const { userId, orgId } = await getAuthContext(supabase)

  // Regla del taller: sin km de ingreso no se entrega. Se valida ANTES de
  // insertar la entrega para no dejar un registro huérfano.
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

  const { data, error } = await supabase
    .from('entregas')
    .insert({
      org_id: orgId,
      orden_trabajo_id: input.ordenTrabajoId,
      forma_pago: input.formaPago,
      monto_pagado: input.montoPagado,
      ...(input.kmSalida != null ? { km_salida: Math.round(input.kmSalida) } : {}),
      ...(input.notas?.trim() ? { notas: input.notas.trim() } : {}),
      creado_por: userId,
    })
    .select('id')

  const entrega = unwrapWritten<{ id: string }>(data, error)

  // La OT queda 'entregada'. Si falla (ej: falta km_ingreso), se propaga el
  // error pero la entrega ya quedó — el estado se puede ajustar arriba.
  await cambiarEstadoOrdenTrabajo(supabase, input.ordenTrabajoId, { estado: 'entregada' })

  return entrega
}
