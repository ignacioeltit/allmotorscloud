// Tipos y schemas Zod del módulo repair-orders (tabla `ordenes_trabajo`, migration 003).

import { z } from 'zod'
import { ESTADOS_OT, type EstadoOT } from './constants'

/** Fila de la tabla `ordenes_trabajo`. */
export interface OrdenTrabajo {
  id: string
  org_id: string
  vehiculo_id: string
  numero_ot: string
  estado: EstadoOT
  sucursal_id: string | null
  recepcionista_id: string | null
  km_ingreso: number | null
  fecha_prometida_entrega: string | null
  notas: string | null
  cerrado_en: string | null
  creado_en: string
  actualizado_en: string
  creado_por: string
  eliminado_en: string | null
  eliminado_por: string | null
}

// ── Schemas Zod ────────────────────────────────────────────────────────────

const uuid = z.string().uuid('Identificador inválido')
const kmSchema = z.number().int().min(0, 'El kilometraje no puede ser negativo')
const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (formato esperado YYYY-MM-DD)')
const notasSchema = z.string().trim().min(1).max(5000)

/**
 * Input para abrir una OT. org_id/creado_por los inyecta el servidor.
 * El estado inicial es 'pendiente_diagnostico' (DEFAULT de la DB); no se acepta aquí.
 * Regla de dominio (trigger fn_ot_unica_activa_por_vehiculo): no puede haber dos OT
 * activas para el mismo vehículo — un segundo INSERT activo lanzará error de la DB.
 */
export const ordenTrabajoCreateSchema = z.object({
  vehiculo_id: uuid,
  numero_ot: z.string().trim().min(1, 'El número de OT es obligatorio').max(50),
  sucursal_id: uuid.optional(),
  recepcionista_id: uuid.optional(),
  km_ingreso: kmSchema.optional(),
  fecha_prometida_entrega: fechaSchema.optional(),
  notas: notasSchema.optional(),
})

/** Input para editar datos no-estado de una OT. */
export const ordenTrabajoUpdateSchema = z.object({
  numero_ot: z.string().trim().min(1).max(50).optional(),
  sucursal_id: uuid.nullish(),
  recepcionista_id: uuid.nullish(),
  km_ingreso: kmSchema.nullish(),
  fecha_prometida_entrega: fechaSchema.nullish(),
  notas: notasSchema.nullish(),
})

/** Input para cambiar el estado de la OT. El trigger gestiona cerrado_en. */
export const cambiarEstadoOTSchema = z.object({
  estado: z.enum(ESTADOS_OT),
})

export type OrdenTrabajoCreateInput = z.infer<typeof ordenTrabajoCreateSchema>
export type OrdenTrabajoUpdateInput = z.infer<typeof ordenTrabajoUpdateSchema>
export type CambiarEstadoOTInput = z.infer<typeof cambiarEstadoOTSchema>

/** Parámetros de listado de órdenes de trabajo. */
export interface ListOrdenesTrabajoParams {
  /** Filtra por un estado específico. */
  estado?: EstadoOT
  limit?: number
  offset?: number
}
