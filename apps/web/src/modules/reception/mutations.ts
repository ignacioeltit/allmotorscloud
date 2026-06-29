// Orquestación del flujo "Recibir vehículo".
//
// Ejecuta en secuencia (desde el browser client, RLS activo):
//   1. cliente   → crear si es nuevo
//   2. vehículo  → crear si es nuevo (el trigger crea su historia técnica 1:1)
//   3. propietario → vincular cliente↔vehículo si no hay propietario activo
//   4. OT activa preexistente → si existe, reutilizarla (invariante "una OT activa por vehículo")
//   5. OT nueva  → con número correlativo (reintenta ante colisión de número)
//   6. evento "Recepción" → con motivo, síntomas, observaciones y checklist; ligado a la OT
//
// LIMITACIÓN CONOCIDA: sin migraciones no es posible una transacción atómica multi-tabla
// (PostgREST no agrupa varias escrituras). Si una falla a mitad, puede quedar estado parcial.
// El orden minimiza el daño (cliente/vehículo persisten; la OT se reintenta).

import type { DbClient } from '@/lib/supabase/types'
import { ConflictError, DatabaseError, ValidationError } from '@/lib/errors'
import { createCliente, vincularPropietario } from '@/modules/customers/mutations'
import { getPropietarioActivoByVehiculo } from '@/modules/customers/queries'
import { createVehiculo } from '@/modules/vehicles/mutations'
import { getHistoriaByVehiculoId } from '@/modules/technical-history/queries'
import {
  createOrdenTrabajo,
} from '@/modules/repair-orders/mutations'
import {
  getOrdenTrabajoActivaByVehiculo,
  getSiguienteNumeroOt,
} from '@/modules/repair-orders/queries'
import { createEvento } from '@/modules/events/mutations'
import { CHECKLIST_RECEPCION } from './constants'
import type { OrdenTrabajo } from '@/modules/repair-orders/types'
import type { RecibirVehiculoInput, ResultadoRecepcion } from './types'

/** Arma el texto estructurado que se guarda en la descripción del evento de recepción. */
function construirDescripcion(input: RecibirVehiculoInput): string {
  const lineas: string[] = []
  lineas.push(`Motivo de ingreso: ${input.motivo}`)
  if (input.prioridad?.trim()) lineas.push(`Prioridad: ${input.prioridad.trim()}`)
  if (input.km != null) lineas.push(`Kilometraje: ${input.km.toLocaleString('es-CL')} km`)
  if (input.sintomas?.trim()) lineas.push(`Síntomas: ${input.sintomas.trim()}`)
  if (input.observaciones?.trim()) lineas.push(`Observaciones: ${input.observaciones.trim()}`)

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
  // 1) Cliente
  let clienteId = input.clienteId
  if (!clienteId) {
    if (!input.clienteNuevo) throw new ValidationError('Falta el cliente.')
    const cliente = await createCliente(supabase, input.clienteNuevo)
    clienteId = cliente.id
  }

  // 2) Vehículo
  let vehiculoId = input.vehiculoId
  let vehiculoEsNuevo = false
  if (!vehiculoId) {
    if (!input.vehiculoNuevo) throw new ValidationError('Falta el vehículo.')
    const { motor, combustible, transmision, notas, ...base } = input.vehiculoNuevo
    // Specs sin columna dedicada → se anexan a notas del vehículo.
    const specs = [
      motor?.trim() && `Motor: ${motor.trim()}`,
      combustible?.trim() && `Combustible: ${combustible.trim()}`,
      transmision?.trim() && `Transmisión: ${transmision.trim()}`,
    ].filter(Boolean)
    const notasFinal = [notas?.trim(), specs.join(' · ')].filter(Boolean).join('\n')
    const vehiculo = await createVehiculo(supabase, {
      ...base,
      ...(notasFinal ? { notas: notasFinal } : {}),
    })
    vehiculoId = vehiculo.id
    vehiculoEsNuevo = true
  }

  // 3) Propietario (vincular si no hay uno activo)
  if (vehiculoEsNuevo) {
    await vincularPropietario(supabase, { vehiculoId, clienteId })
  } else {
    const propietario = await getPropietarioActivoByVehiculo(supabase, vehiculoId)
    if (!propietario) {
      await vincularPropietario(supabase, { vehiculoId, clienteId })
    }
  }

  // 4) OT activa preexistente → reutilizar
  const activa = await getOrdenTrabajoActivaByVehiculo(supabase, vehiculoId)
  if (activa) {
    return { ordenTrabajoId: activa.id, numeroOt: activa.numero_ot, reused: true }
  }

  // 5) Historia + OT nueva (con reintento ante colisión de número)
  const historia = await getHistoriaByVehiculoId(supabase, vehiculoId)

  let orden: OrdenTrabajo | null = null
  for (let intento = 0; intento < 4 && !orden; intento++) {
    const numeroOt = await getSiguienteNumeroOt(supabase)
    try {
      orden = await createOrdenTrabajo(supabase, {
        vehiculo_id: vehiculoId,
        numero_ot: numeroOt,
        ...(input.km != null ? { km_ingreso: input.km } : {}),
        ...(input.motivo.trim() ? { notas: input.motivo.trim() } : {}),
      })
    } catch (e) {
      if (e instanceof ConflictError && intento < 3) continue
      throw e
    }
  }
  if (!orden) {
    throw new DatabaseError('No se pudo generar el número de OT. Inténtalo de nuevo.')
  }

  // 6) Evento de recepción, ligado a la OT
  await createEvento(supabase, {
    historia_tecnica_id: historia.id,
    tipo_evento_id: input.tipoEventoRecepcionId,
    titulo: 'Recepción del vehículo',
    descripcion: construirDescripcion(input),
    orden_trabajo_id: orden.id,
    ...(input.km != null ? { km_vehiculo: input.km } : {}),
  })

  return { ordenTrabajoId: orden.id, numeroOt: orden.numero_ot, reused: false }
}
