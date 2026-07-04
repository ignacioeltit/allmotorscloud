// Escrituras de finanzas: movimientos (ingresos/gastos), cobro de entregas.
//
// RLS: admin/jefe_taller/recepcionista (migration 027). El ingreso de una OT se
// crea al marcarla pagada; el índice único uq_mov_fin_entrega_ingreso evita el
// doble registro (se ignora el 23505).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { mapPostgrestError, ValidationError } from '@/lib/errors'
import { TIPOS_MOVIMIENTO, type TipoMovimiento } from './constants'

export interface RegistrarMovimientoInput {
  tipo: TipoMovimiento
  monto: number
  fecha: string
  categoria?: string | null
  descripcion?: string | null
  formaPago?: string | null
  ordenTrabajoId?: string | null
}

/** Registra un ingreso o gasto manual en el libro. */
export async function registrarMovimiento(
  supabase: DbClient,
  input: RegistrarMovimientoInput,
): Promise<{ id: string }> {
  if (!TIPOS_MOVIMIENTO.includes(input.tipo)) throw new ValidationError('Tipo de movimiento inválido.')
  if (!Number.isFinite(input.monto) || input.monto < 0) throw new ValidationError('Monto inválido.')
  if (!input.fecha) throw new ValidationError('La fecha es obligatoria.')

  const { userId, orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('movimientos_financieros')
    .insert({
      org_id: orgId,
      tipo: input.tipo,
      monto: Math.round(input.monto * 100) / 100,
      fecha: input.fecha,
      ...(input.categoria?.trim() ? { categoria: input.categoria.trim() } : {}),
      ...(input.descripcion?.trim() ? { descripcion: input.descripcion.trim() } : {}),
      ...(input.formaPago?.trim() ? { forma_pago: input.formaPago.trim() } : {}),
      ...(input.ordenTrabajoId ? { orden_trabajo_id: input.ordenTrabajoId } : {}),
      creado_por: userId,
    })
    .select('id')

  return unwrapWritten<{ id: string }>(data, error)
}

/** Borra en blando un movimiento (corrección). Solo admin/jefe_taller por RLS. */
export async function eliminarMovimiento(supabase: DbClient, id: string): Promise<void> {
  const { userId, orgId } = await getAuthContext(supabase)
  const { error } = await supabase
    .from('movimientos_financieros')
    .update({ eliminado_en: new Date().toISOString(), eliminado_por: userId })
    .eq('org_id', orgId)
    .eq('id', id)
  if (error) throw mapPostgrestError(error)
}

/**
 * Marca una entrega (a crédito) como pagada: fija estado, fecha de pago y forma
 * de pago. El ingreso NO se escribe aparte — Finanzas lo deriva de las entregas
 * pagadas (fuente única, sin doble escritura frágil).
 */
export async function marcarEntregaPagada(
  supabase: DbClient,
  input: { entregaId: string; formaPago: string; fecha?: string },
): Promise<void> {
  const { orgId } = await getAuthContext(supabase)
  const fecha = input.fecha || new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('entregas')
    .update({ estado_pago: 'pagada', pagado_en: fecha, forma_pago: input.formaPago })
    .eq('org_id', orgId)
    .eq('id', input.entregaId)
    .select('id')

  unwrapWritten<{ id: string }>(data, error)
}
