// Tipos del módulo estimates (tablas `presupuestos` e `items_presupuesto`, migration 003).
//
// presupuestos: versioning automático via trigger fn_versionar_presupuesto.
//   UNIQUE(presupuesto_anterior_id): solo una versión siguiente por versión anterior.
// items_presupuesto: repuesto_id es FK diferida (activada en Migration 004).

import type { EstadoPresupuesto, TipoItemPresupuesto } from './constants'

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
