// Tipos y schemas Zod del módulo customers (tabla `clientes`, migration 002).
// La row type se escribe a mano (los tipos generados aún no existen).

import { z } from 'zod'
import { TIPOS_CLIENTE, TIPO_CLIENTE_DEFAULT } from './constants'

/** Fila de la tabla `clientes` tal como la devuelve Supabase. */
export interface Cliente {
  id: string
  org_id: string
  tipo: (typeof TIPOS_CLIENTE)[number]
  nombre: string
  rut: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  notas: string | null
  creado_en: string
  actualizado_en: string
  creado_por: string | null
  eliminado_en: string | null
  eliminado_por: string | null
}

// ── Schemas Zod ────────────────────────────────────────────────────────────

const textoOpcional = z.string().trim().min(1).max(500)
const emailOpcional = z.string().trim().email('Email inválido').max(255)

/** Input para crear un cliente. `org_id` y `creado_por` los inyecta el servidor. */
export const clienteCreateSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(255),
  tipo: z.enum(TIPOS_CLIENTE).default(TIPO_CLIENTE_DEFAULT),
  rut: textoOpcional.max(20).optional(),
  telefono: textoOpcional.max(50).optional(),
  email: emailOpcional.optional(),
  direccion: textoOpcional.optional(),
  notas: textoOpcional.max(2000).optional(),
})

/** Input para actualizar un cliente. Campos limpiables admiten null. */
export const clienteUpdateSchema = z.object({
  nombre: z.string().trim().min(1).max(255).optional(),
  tipo: z.enum(TIPOS_CLIENTE).optional(),
  rut: textoOpcional.max(20).nullish(),
  telefono: textoOpcional.max(50).nullish(),
  email: emailOpcional.nullish(),
  direccion: textoOpcional.nullish(),
  notas: textoOpcional.max(2000).nullish(),
})

export type ClienteCreateInput = z.infer<typeof clienteCreateSchema>
export type ClienteUpdateInput = z.infer<typeof clienteUpdateSchema>

/** Parámetros de listado de clientes. */
export interface ListClientesParams {
  /** Búsqueda por nombre (ILIKE parcial). */
  search?: string
  limit?: number
  offset?: number
}

/** Fila de `propietarios_vehiculo` — relación cliente↔vehículo (activa si fecha_fin = null). */
export interface PropietarioVehiculo {
  id: string
  vehiculo_id: string
  cliente_id: string
  org_id: string
  fecha_inicio: string
  fecha_fin: string | null
  notas: string | null
  creado_en: string
  actualizado_en: string
  creado_por: string | null
}
