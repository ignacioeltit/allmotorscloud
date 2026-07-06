// Tipos y schemas Zod del módulo vehicles (tabla `vehiculos`, migration 002).

import { z } from 'zod'
import { TIPOS_VEHICULO, TIPO_VEHICULO_DEFAULT, ANIO_VEHICULO_MIN } from './constants'

/** Fila de la tabla `vehiculos`. */
export interface Vehiculo {
  id: string
  org_id: string
  patente: string
  vin: string | null
  marca: string
  modelo: string
  anio: number | null
  /** true cuando el año fue estimado del VIN al migrar y falta confirmarlo. */
  anio_por_confirmar: boolean
  color: string | null
  /** Cilindrada / motor (texto libre: "2.0", "1600cc", "V8 5.3L"…). Decisivo para repuestos. */
  cilindrada: string | null
  tipo: (typeof TIPOS_VEHICULO)[number]
  km_actual: number | null
  notas: string | null
  creado_en: string
  actualizado_en: string
  creado_por: string | null
  eliminado_en: string | null
  eliminado_por: string | null
}

// ── Schemas Zod ────────────────────────────────────────────────────────────

const anioMax = new Date().getFullYear() + 1

const patenteSchema = z
  .string()
  .trim()
  .min(1, 'La patente es obligatoria')
  .max(10)
  // Normalización: mayúsculas sin espacios ni guiones (consistencia del UNIQUE org+patente).
  .transform((v) => v.toUpperCase().replace(/[\s-]/g, ''))

const anioSchema = z
  .number()
  .int()
  .min(ANIO_VEHICULO_MIN, `El año debe ser ≥ ${ANIO_VEHICULO_MIN}`)
  .max(anioMax, `El año no puede ser mayor a ${anioMax}`)

const kmSchema = z.number().int().min(0, 'El kilometraje no puede ser negativo')

const textoOpcional = z.string().trim().min(1).max(255)

/** Input para crear un vehículo. org_id/creado_por los inyecta el servidor.
 *  Al insertar, un trigger de DB crea automáticamente su historia_tecnica (1:1). */
export const vehiculoCreateSchema = z.object({
  patente: patenteSchema,
  marca: z.string().trim().min(1, 'La marca es obligatoria').max(100),
  modelo: z.string().trim().min(1, 'El modelo es obligatorio').max(100),
  tipo: z.enum(TIPOS_VEHICULO).default(TIPO_VEHICULO_DEFAULT),
  vin: textoOpcional.max(20).optional(),
  anio: anioSchema.optional(),
  color: textoOpcional.max(50).optional(),
  cilindrada: textoOpcional.max(30).optional(),
  km_actual: kmSchema.optional(),
  notas: z.string().trim().min(1).max(2000).optional(),
})

/** Input para actualizar un vehículo. */
export const vehiculoUpdateSchema = z.object({
  patente: patenteSchema.optional(),
  marca: z.string().trim().min(1).max(100).optional(),
  modelo: z.string().trim().min(1).max(100).optional(),
  tipo: z.enum(TIPOS_VEHICULO).optional(),
  vin: textoOpcional.max(20).nullish(),
  anio: anioSchema.nullish(),
  color: textoOpcional.max(50).nullish(),
  cilindrada: textoOpcional.max(30).nullish(),
  km_actual: kmSchema.nullish(),
  notas: z.string().trim().min(1).max(2000).nullish(),
})

export type VehiculoCreateInput = z.infer<typeof vehiculoCreateSchema>
export type VehiculoUpdateInput = z.infer<typeof vehiculoUpdateSchema>

/** Parámetros de listado de vehículos. */
export interface ListVehiculosParams {
  /** Búsqueda parcial por patente, marca o modelo. */
  search?: string
  limit?: number
  offset?: number
}
