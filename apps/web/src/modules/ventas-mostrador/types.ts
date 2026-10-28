// Tipos y schemas del POS mostrador (tablas ventas_mostrador / items_venta_mostrador,
// migration 045).

import { z } from 'zod'
import { METODOS_PAGO } from './constants'

export interface VentaMostrador {
  id: string
  org_id: string
  folio: number
  cliente_id: string | null
  metodo_pago: string
  subtotal_neto: number
  iva: number
  total: number
  notas: string | null
  creado_por: string | null
  creado_en: string
  anulada_en: string | null
  anulada_por: string | null
}

export interface ItemVentaMostrador {
  id: string
  org_id: string
  venta_id: string
  repuesto_id: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  total: number
}

export interface VentaMostradorConDetalle extends VentaMostrador {
  items: ItemVentaMostrador[]
  cliente_nombre: string | null
}

export const VENTA_COLUMNS =
  'id, org_id, folio, cliente_id, metodo_pago, subtotal_neto, iva, total, notas, creado_por, creado_en, anulada_en, anulada_por'
export const ITEM_VENTA_COLUMNS =
  'id, org_id, venta_id, repuesto_id, descripcion, cantidad, precio_unitario, total'

/** Un ítem del carrito que se envía al RPC. */
export const itemVentaInputSchema = z.object({
  repuesto_id: z.string().uuid().nullish(),
  descripcion: z.string().trim().min(1, 'Falta la descripción').max(300),
  cantidad: z.number().positive('Cantidad inválida'),
  precio_unitario: z.number().min(0, 'Precio inválido'),
})
export type ItemVentaInput = z.infer<typeof itemVentaInputSchema>

export const registrarVentaSchema = z.object({
  items: z.array(itemVentaInputSchema).min(1, 'La venta no tiene ítems'),
  clienteId: z.string().uuid().nullish(),
  metodoPago: z.enum(METODOS_PAGO).default('efectivo'),
  notas: z.string().trim().max(500).nullish(),
})
export type RegistrarVentaInput = z.infer<typeof registrarVentaSchema>
