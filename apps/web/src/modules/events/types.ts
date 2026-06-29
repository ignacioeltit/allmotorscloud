// Tipos y schemas Zod del módulo events (tabla `eventos`, migration 002).

import { z } from 'zod'
import {
  ESTADOS_EVENTO,
  ESTADOS_EVENTO_ACTIVOS,
  CATEGORIAS_TIPO_EVENTO,
} from './constants'

/** Fila de la tabla `eventos`. */
export interface Evento {
  id: string
  historia_tecnica_id: string
  org_id: string
  tipo_evento_id: string
  sucursal_id: string | null
  conductor_id: string | null
  orden_trabajo_id: string | null
  estado: (typeof ESTADOS_EVENTO)[number]
  titulo: string | null
  descripcion: string | null
  asignado_a: string | null
  km_vehiculo: number | null
  visible_cliente: boolean
  cerrado_en: string | null
  cancelado_en: string | null
  cancelado_por: string | null
  razon_cancelacion: string | null
  creado_en: string
  actualizado_en: string
  creado_por: string
  eliminado_en: string | null
  eliminado_por: string | null
}

/** Fila de la tabla `tipos_evento` (catálogo per-tenant). */
export interface TipoEvento {
  id: string
  org_id: string
  nombre: string
  slug: string
  descripcion: string | null
  categoria: (typeof CATEGORIAS_TIPO_EVENTO)[number]
  activo: boolean
}

// ── Schemas Zod ────────────────────────────────────────────────────────────

const uuid = z.string().uuid('Identificador inválido')
const kmSchema = z.number().int().min(0, 'El kilometraje no puede ser negativo')
const tituloSchema = z.string().trim().min(1).max(255)
const descripcionSchema = z.string().trim().min(1).max(5000)

/** Input para crear un evento. org_id/creado_por los inyecta el servidor. */
export const eventoCreateSchema = z.object({
  historia_tecnica_id: uuid,
  tipo_evento_id: uuid,
  estado: z.enum(ESTADOS_EVENTO_ACTIVOS).optional(),
  titulo: tituloSchema.optional(),
  descripcion: descripcionSchema.optional(),
  sucursal_id: uuid.optional(),
  conductor_id: uuid.optional(),
  orden_trabajo_id: uuid.optional(),
  asignado_a: uuid.optional(),
  km_vehiculo: kmSchema.optional(),
  visible_cliente: z.boolean().optional(),
})

/**
 * Input para editar un evento NO terminal. No permite estado 'cerrado'/'cancelado'
 * (esos van por cerrarEvento/cancelarEvento, que setean cerrado_en/cancelado_en).
 */
export const eventoUpdateSchema = z.object({
  estado: z.enum(ESTADOS_EVENTO_ACTIVOS).optional(),
  titulo: tituloSchema.nullish(),
  descripcion: descripcionSchema.nullish(),
  sucursal_id: uuid.nullish(),
  conductor_id: uuid.nullish(),
  asignado_a: uuid.nullish(),
  km_vehiculo: kmSchema.nullish(),
  visible_cliente: z.boolean().optional(),
})

/** Razón obligatoria al cancelar (CHECK chk_eventos_cancelacion exige razón no nula). */
export const cancelarEventoSchema = z.object({
  razon: z.string().trim().min(1, 'Debes indicar la razón de la cancelación').max(2000),
})

export type EventoCreateInput = z.infer<typeof eventoCreateSchema>
export type EventoUpdateInput = z.infer<typeof eventoUpdateSchema>
export type CancelarEventoInput = z.infer<typeof cancelarEventoSchema>

/** Parámetros de listado de eventos. */
export interface ListEventosParams {
  limit?: number
  offset?: number
}
