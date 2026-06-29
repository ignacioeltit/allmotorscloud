// Tipos y schemas Zod del módulo inventory (tablas `repuestos` y `movimientos_stock`, migration 004).
//
// repuestos: per-tenant, soft-delete, audit.
// movimientos_stock: append-only, sin eliminado_en.
// stock_actual: NUNCA actualizar directamente — solo vía movimientos_stock.

import { z } from 'zod'
import { TIPOS_MOVIMIENTO, UNIDADES_MEDIDA } from './constants'

// ── Tipos de fila ──────────────────────────────────────────────────────────

export interface Repuesto {
  id: string
  org_id: string
  sucursal_id: string | null
  codigo: string
  codigo_barra: string | null
  nombre: string
  descripcion: string | null
  marca: string | null
  modelo_aplicacion: string | null
  categoria: string | null
  unidad: string
  precio_costo: number | null
  precio_venta: number | null
  stock_actual: number
  stock_minimo: number
  ubicacion: string | null
  proveedor: string | null
  activo: boolean
  creado_en: string
  actualizado_en: string
  creado_por: string
  eliminado_en: string | null
  eliminado_por: string | null
}

export interface MovimientoStock {
  id: string
  org_id: string
  repuesto_id: string
  tipo: TipoMovimiento
  cantidad: number
  stock_antes: number
  stock_despues: number
  costo_unitario: number | null
  precio_venta_unitario: number | null
  referencia_tipo: string | null
  referencia_id: string | null
  motivo: string | null
  actor_id: string
  creado_en: string
}

export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number]

/** Repuesto con estado de stock calculado en app. */
export interface RepuestoConEstado extends Repuesto {
  estado_stock: EstadoStock
}

export type EstadoStock = 'en_stock' | 'bajo_stock' | 'sin_stock'

/** Resultado mínimo para búsqueda/autocomplete en OT. */
export interface RepuestoResumen {
  id: string
  codigo: string
  nombre: string
  marca: string | null
  unidad: string
  precio_venta: number | null
  precio_costo: number | null
  stock_actual: number
  estado_stock: EstadoStock
}

// ── Schemas Zod ─────────────────────────────────────────────────────────────

const uuid = z.string().uuid('Identificador inválido')
const textoCorto = z.string().trim().min(1).max(500)
const textoLargo = z.string().trim().min(1).max(2000)
const precio = z.number().min(0, 'El precio no puede ser negativo').multipleOf(0.01)
const stockQty = z.number().min(0, 'La cantidad no puede ser negativa')

export const repuestoCreateSchema = z.object({
  codigo: textoCorto,
  codigo_barra: z.string().trim().max(100).optional(),
  nombre: textoCorto,
  descripcion: textoLargo.optional(),
  marca: z.string().trim().max(200).optional(),
  modelo_aplicacion: z.string().trim().max(500).optional(),
  categoria: z.string().trim().max(100).optional(),
  unidad: z.enum(UNIDADES_MEDIDA).default('unidad'),
  precio_costo: precio.optional(),
  precio_venta: precio.optional(),
  stock_actual: stockQty.default(0),
  stock_minimo: stockQty.default(0),
  ubicacion: z.string().trim().max(200).optional(),
  proveedor: z.string().trim().max(300).optional(),
  sucursal_id: uuid.optional(),
})

export const repuestoUpdateSchema = repuestoCreateSchema.partial()

export const registrarMovimientoSchema = z.object({
  repuesto_id: uuid,
  tipo: z.enum(TIPOS_MOVIMIENTO),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0').multipleOf(0.001),
  stock_antes: z.number().min(0),
  referencia_tipo: z.string().trim().max(100).optional(),
  referencia_id: uuid.optional(),
  motivo: textoLargo.optional(),
})

export type RepuestoCreateInput = z.infer<typeof repuestoCreateSchema>
export type RepuestoUpdateInput = z.infer<typeof repuestoUpdateSchema>
export type RegistrarMovimientoInput = z.infer<typeof registrarMovimientoSchema>

/** Params para listar repuestos. */
export interface ListRepuestosParams {
  query?: string
  categoria?: string
  solo_bajo_stock?: boolean
  limit?: number
  offset?: number
}
