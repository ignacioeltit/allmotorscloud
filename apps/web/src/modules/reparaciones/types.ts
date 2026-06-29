// Tipos y schemas Zod del módulo reparaciones (tablas `reparaciones` e `items_reparacion`, migration 003).
//
// reparaciones: sin eliminado_en (inmutable por diseño de dominio).
// items_reparacion: sí tienen eliminado_en (soft-delete).
//
// repuesto_id es UUID nullable SIN FK activa (FK diferida a Migration 004).

import { z } from 'zod'
import { TIPOS_ITEM_REPARACION, type TipoItemReparacion } from './constants'

// ── Tipos de fila ──────────────────────────────────────────────────────────

export interface Reparacion {
  id: string
  org_id: string
  orden_trabajo_id: string
  evento_trabajo_id: string
  mecanico_id: string | null
  descripcion: string | null
  observaciones: string | null
  inicio_en: string | null
  fin_en: string | null
  creado_en: string
  actualizado_en: string
  creado_por: string
}

export interface ItemReparacion {
  id: string
  org_id: string
  reparacion_id: string
  item_presupuesto_id: string | null
  tipo: TipoItemReparacion
  descripcion: string
  repuesto_id: string | null
  cantidad: number
  costo_unitario: number
  costo_total: number
  inicio_en: string | null
  fin_en: string | null
  creado_en: string
  actualizado_en: string
  creado_por: string
  eliminado_en: string | null
  eliminado_por: string | null
}

export interface ReparacionConItems extends Reparacion {
  items: ItemReparacion[]
}

export interface TotalesOT {
  total_mano_obra: number
  total_repuestos: number
  total: number
}

// ── Schemas Zod ─────────────────────────────────────────────────────────────

const uuid = z.string().uuid('Identificador inválido')
const textoCorto = z.string().trim().min(1).max(500)
const textoLargo = z.string().trim().min(1).max(5000)

export const crearReparacionSchema = z.object({
  ordenTrabajoId: uuid,
  historiaId: uuid,
  tipoEventoId: uuid,
  descripcion: textoCorto.optional(),
  observaciones: textoLargo.optional(),
  mecanicoId: uuid.optional(),
})

export const addItemReparacionSchema = z.object({
  reparacionId: uuid,
  tipo: z.enum(TIPOS_ITEM_REPARACION),
  descripcion: textoCorto,
  cantidad: z.number().positive().multipleOf(0.001),
  costoUnitario: z.number().min(0),
})

export type CrearReparacionInput = z.infer<typeof crearReparacionSchema>
export type AddItemReparacionInput = z.infer<typeof addItemReparacionSchema>
