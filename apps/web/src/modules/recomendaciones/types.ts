// Recomendaciones para la próxima visita del vehículo (tabla
// `recomendaciones_vehiculo`, migration 041).

import { z } from 'zod'

export type PrioridadRecomendacion = 'alta' | 'normal'
export type EstadoRecomendacion = 'pendiente' | 'resuelta'

export interface Recomendacion {
  id: string
  vehiculo_id: string
  orden_trabajo_id: string | null
  descripcion: string
  prioridad: PrioridadRecomendacion
  estado: EstadoRecomendacion
  creado_por: string | null
  creado_en: string
  resuelta_en: string | null
  resuelta_por: string | null
}

export const RECOMENDACION_COLUMNS =
  'id, vehiculo_id, orden_trabajo_id, descripcion, prioridad, estado, creado_por, creado_en, resuelta_en, resuelta_por'

export const crearRecomendacionSchema = z.object({
  vehiculoId: z.string().uuid(),
  ordenTrabajoId: z.string().uuid().nullish(),
  descripcion: z.string().trim().min(1, 'Escribe la recomendación').max(1000),
  prioridad: z.enum(['alta', 'normal']).default('normal'),
})
export type CrearRecomendacionInput = z.infer<typeof crearRecomendacionSchema>

export const editarRecomendacionSchema = z.object({
  descripcion: z.string().trim().min(1).max(1000).optional(),
  prioridad: z.enum(['alta', 'normal']).optional(),
})
export type EditarRecomendacionInput = z.infer<typeof editarRecomendacionSchema>
