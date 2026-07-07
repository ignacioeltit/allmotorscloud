// Orquestación del flujo "Recibir vehículo".
//
// Desde Migration 011 la escritura completa (cliente → vehículo → propietario →
// OT → evento) se ejecuta en UNA transacción vía RPC fn_recibir_vehiculo:
// o entra todo, o no entra nada. La función es SECURITY INVOKER, así que cada
// INSERT interno pasa por las mismas policies RLS del usuario autenticado.
//
// Acá queda lo que corresponde al cliente: validación/normalización con zod
// (ej: patente a mayúsculas sin guiones) y la composición de textos (specs del
// vehículo → notas, checklist → descripción del evento).

import type { DbClient } from '@/lib/supabase/types'
import { ValidationError, validationErrorFromZod, mapPostgrestError } from '@/lib/errors'
import { clienteCreateSchema } from '@/modules/customers/types'
import { vehiculoCreateSchema } from '@/modules/vehicles/types'
import { CHECKLIST_RECEPCION } from './constants'
import type { RecibirVehiculoInput, ResultadoRecepcion } from './types'

/** Arma el texto estructurado que se guarda en la descripción del evento de recepción. */
function construirDescripcion(input: RecibirVehiculoInput): string {
  const lineas: string[] = []
  lineas.push(`Motivo de ingreso: ${input.motivo}`)
  if (input.prioridad?.trim()) lineas.push(`Prioridad: ${input.prioridad.trim()}`)
  if (input.km != null) lineas.push(`Kilometraje: ${input.km.toLocaleString('es-CL')} km`)
  if (input.observaciones?.trim()) lineas.push(`Síntomas y observaciones: ${input.observaciones.trim()}`)

  lineas.push('')
  lineas.push('Checklist de recepción:')
  for (const item of CHECKLIST_RECEPCION) {
    const ok = input.checklist[item.key] === true
    lineas.push(`  ${ok ? '✓' : '✗'} ${item.label}`)
  }
  return lineas.join('\n').slice(0, 5000)
}

export async function recibirVehiculo(
  supabase: DbClient,
  input: RecibirVehiculoInput,
): Promise<ResultadoRecepcion> {
  // Cliente nuevo: validar y normalizar antes de enviarlo a la función
  let clienteJson: Record<string, unknown> | null = null
  if (!input.clienteId) {
    if (!input.clienteNuevo) throw new ValidationError('Falta el cliente.')
    const parsed = clienteCreateSchema.safeParse(input.clienteNuevo)
    if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())
    clienteJson = parsed.data
  }

  // Vehículo nuevo: specs sin columna dedicada → se anexan a notas
  let vehiculoJson: Record<string, unknown> | null = null
  if (!input.vehiculoId) {
    if (!input.vehiculoNuevo) throw new ValidationError('Falta el vehículo.')
    const { motor, combustible, transmision, notas, ...base } = input.vehiculoNuevo
    const specs = [
      motor?.trim() && `Motor: ${motor.trim()}`,
      combustible?.trim() && `Combustible: ${combustible.trim()}`,
      transmision?.trim() && `Transmisión: ${transmision.trim()}`,
    ].filter(Boolean)
    const notasFinal = [notas?.trim(), specs.join(' · ')].filter(Boolean).join('\n')

    const parsed = vehiculoCreateSchema.safeParse({
      ...base,
      ...(notasFinal ? { notas: notasFinal } : {}),
    })
    if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())
    vehiculoJson = parsed.data
  }

  const { data, error } = await supabase.rpc('fn_recibir_vehiculo', {
    p_tipo_evento_recepcion_id: input.tipoEventoRecepcionId,
    p_cliente_id: input.clienteId,
    p_cliente: clienteJson,
    p_vehiculo_id: input.vehiculoId,
    p_vehiculo: vehiculoJson,
    p_titulo: 'Recepción del vehículo',
    p_descripcion: construirDescripcion(input),
    p_km: input.km ?? null,
    p_motivo: input.motivo.trim() || null,
  })

  if (error) throw mapPostgrestError(error)

  const result = data as { orden_trabajo_id: string; numero_ot: string; reused: boolean }
  return {
    ordenTrabajoId: result.orden_trabajo_id,
    numeroOt: result.numero_ot,
    reused: result.reused,
  }
}
