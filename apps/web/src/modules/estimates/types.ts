// Tipos del módulo estimates (tablas `presupuestos` e `items_presupuesto`, migration 003).
//
// presupuestos: versioning automático via trigger fn_versionar_presupuesto.
//   UNIQUE(presupuesto_anterior_id): solo una versión siguiente por versión anterior.
// items_presupuesto: repuesto_id es FK diferida (activada en Migration 004).

import { z } from 'zod'
import { TIPOS_ITEM_PRESUPUESTO, type EstadoPresupuesto, type TipoItemPresupuesto } from './constants'

export interface Presupuesto {
  id: string
  org_id: string
  orden_trabajo_id: string
  presupuesto_anterior_id: string | null
  version: number
  estado: EstadoPresupuesto
  total_mano_obra: number
  total_repuestos: number
  total_descuentos: number
  total_neto: number
  notas: string | null
  enviado_en: string | null
  autorizado_en: string | null
  autorizado_por_nombre: string | null
  rechazado_en: string | null
  razon_rechazo: string | null
  creado_en: string
  actualizado_en: string
  creado_por: string
  eliminado_en: string | null
  eliminado_por: string | null
}

export interface ItemPresupuesto {
  id: string
  org_id: string
  presupuesto_id: string
  tipo: TipoItemPresupuesto
  descripcion: string
  repuesto_id: string | null
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  precio_total: number
  autorizador_id: string | null
  creado_en: string
  actualizado_en: string
  creado_por: string
  eliminado_en: string | null
  eliminado_por: string | null
}

export interface PresupuestoConItems extends Presupuesto {
  items: ItemPresupuesto[]
}

// ── Schemas Zod ─────────────────────────────────────────────────────────────

const uuid = z.string().uuid('Identificador inválido')
const textoCorto = z.string().trim().min(1).max(500)

export const crearPresupuestoSchema = z.object({
  ordenTrabajoId: uuid,
  notas: z.string().trim().max(5000).optional(),
})

export const addItemPresupuestoSchema = z.object({
  presupuestoId: uuid,
  tipo: z.enum(TIPOS_ITEM_PRESUPUESTO),
  descripcion: textoCorto,
  cantidad: z.number().positive().multipleOf(0.001),
  precioUnitario: z.number().min(0),
  descuentoPorcentaje: z.number().min(0).max(100).optional(),
  repuestoId: uuid.optional(),
})

export type CrearPresupuestoInput = z.infer<typeof crearPresupuestoSchema>
export type AddItemPresupuestoInput = z.infer<typeof addItemPresupuestoSchema>
