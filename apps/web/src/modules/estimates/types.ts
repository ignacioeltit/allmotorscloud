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
  total_otros: number
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
  // Enlace público al cliente (migration 019) y folio legible (migration 020) —
  // existen en TODA fila de presupuestos, tenga o no orden_trabajo_id directo.
  token_publico: string | null
  nota_cliente: string | null
  agendar_solicitado: boolean
  folio: string | null
}

export interface ItemPresupuesto {
  id: string
  org_id: string
  presupuesto_id: string
  tipo: TipoItemPresupuesto
  codigo: string | null
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

/** Carga por lote: varias líneas de una vez (ficha de ingreso). */
export const addItemsPresupuestoSchema = z.object({
  presupuestoId: uuid,
  items: z
    .array(
      z.object({
        tipo: z.enum(TIPOS_ITEM_PRESUPUESTO),
        codigo: z.string().trim().max(60).nullish(),
        descripcion: textoCorto,
        cantidad: z.number().positive().multipleOf(0.001),
        precioUnitario: z.number().min(0),
        descuentoPorcentaje: z.number().min(0).max(100).optional(),
      }),
    )
    .min(1, 'Agrega al menos una línea con datos.'),
})

export type CrearPresupuestoInput = z.infer<typeof crearPresupuestoSchema>
export type AddItemPresupuestoInput = z.infer<typeof addItemPresupuestoSchema>
export type AddItemsPresupuestoInput = z.infer<typeof addItemsPresupuestoSchema>
