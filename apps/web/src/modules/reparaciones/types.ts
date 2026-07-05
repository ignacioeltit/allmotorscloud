// Tipos y schemas Zod del módulo reparaciones (tablas `reparaciones` e `items_reparacion`, migration 003).
//
// reparaciones: sin eliminado_en (inmutable por diseño de dominio).
// items_reparacion: sí tienen eliminado_en (soft-delete).
//
// repuesto_id es UUID nullable SIN FK activa (FK diferida a Migration 004).

import { z } from 'zod'
import { TIPOS_ITEM_REPARACION, ESTADOS_COMPRA, type TipoItemReparacion, type EstadoCompra } from './constants'

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
  codigo: string | null
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
  // Snapshot fields (M005) — nullable: null en ítems pre-M005 o sin vínculo a catálogo
  servicio_catalogo_id: string | null
  plantilla_id: string | null
  nombre_servicio_snapshot: string | null
  horas_estandar_snapshot: number | null
  valor_hora_snapshot: number | null
  precio_catalogo_snapshot: number | null
  // Costo de compra (M009) — solo repuestos; null en ítems pre-M009 o sin dato
  costo_compra_unitario: number | null
  // Estado de compra del repuesto (migration 029)
  estado_compra: EstadoCompra
  nota_compra: string | null
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
  codigo: z.string().trim().max(60).nullish(),
  descripcion: textoCorto,
  cantidad: z.number().positive().multipleOf(0.001),
  costoUnitario: z.number().min(0),
  repuestoId: uuid.optional(),           // FK → repuestos.id, activada en migration 004
  itemPresupuestoId: uuid.optional(),    // trazabilidad → ítem del presupuesto autorizado
  // Snapshot fields (M005/M007): solo para tipo='mano_obra' vinculado a catálogo
  servicioCatalogoId: uuid.optional(),
  nombreServicioSnapshot: z.string().optional(),
  horasEstandarSnapshot: z.number().nullable().optional(),
  valorHoraSnapshot: z.number().nullable().optional(),
  precioCatalogoSnapshot: z.number().nullable().optional(),
  // Costo de compra (M009): solo para tipo='repuesto'
  costoCompraUnitario: z.number().min(0).nullable().optional(),
})

/** Actualiza el estado de compra / nota / costo de un repuesto. */
export const actualizarCompraItemSchema = z.object({
  itemId: uuid,
  estadoCompra: z.enum(ESTADOS_COMPRA).optional(),
  notaCompra: z.string().trim().max(500).nullable().optional(),
  costoCompraUnitario: z.number().min(0).nullable().optional(),
})

export type CrearReparacionInput = z.infer<typeof crearReparacionSchema>
export type AddItemReparacionInput = z.infer<typeof addItemReparacionSchema>
export type ActualizarCompraItemInput = z.infer<typeof actualizarCompraItemSchema>
