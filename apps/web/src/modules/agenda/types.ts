// Tipos y validación del módulo agenda (tabla citas).

import { z } from 'zod'
import { ESTADOS_CITA } from './constants'
import type { EstadoCita } from './constants'

/** Cita con cliente y vehículo embebidos para la agenda. */
export interface CitaConDetalle {
  id: string
  fecha_cita: string
  duracion_estimada_min: number | null
  tipo_servicio: string | null
  estado: EstadoCita
  notas: string | null
  cliente_id: string | null
  vehiculo_id: string
  cliente: { nombre: string | null; telefono: string | null } | null
  vehiculo: { patente: string | null; marca: string | null; modelo: string | null } | null
}

export const crearCitaSchema = z.object({
  vehiculoId: z.string().uuid('Vehículo inválido'),
  clienteId: z.string().uuid().nullable().optional(),
  fechaCita: z.string().min(1, 'La fecha y hora son obligatorias'),
  tipoServicio: z.string().trim().max(200).optional(),
  duracionMin: z.number().int().positive().max(600).nullable().optional(),
  notas: z.string().trim().max(1000).optional(),
})

export type CrearCitaInput = z.infer<typeof crearCitaSchema>

export const actualizarEstadoCitaSchema = z.object({
  citaId: z.string().uuid(),
  estado: z.enum(ESTADOS_CITA),
})

export type ActualizarEstadoCitaInput = z.infer<typeof actualizarEstadoCitaSchema>
