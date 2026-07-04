// Constantes del módulo reparaciones (tablas `reparaciones` e `items_reparacion`, migration 003).
// 'otros' (insumos, traslados, gestión) se agregó en migration 022.

export const TIPOS_ITEM_REPARACION = ['mano_obra', 'repuesto', 'otros'] as const
export type TipoItemReparacion = (typeof TIPOS_ITEM_REPARACION)[number]

export const TIPOS_ITEM_LABEL: Record<TipoItemReparacion, string> = {
  mano_obra: 'Mano de obra',
  repuesto: 'Repuesto / material',
  otros: 'Otros',
}

// Estado de compra de un repuesto (migration 029).
export const ESTADOS_COMPRA = ['disponible', 'por_comprar', 'comprado', 'recibido'] as const
export type EstadoCompra = (typeof ESTADOS_COMPRA)[number]

export const ESTADO_COMPRA_LABEL: Record<EstadoCompra, string> = {
  disponible: 'En taller',
  por_comprar: 'Por comprar',
  comprado: 'Comprado (en camino)',
  recibido: 'Recibido',
}

export const ESTADO_COMPRA_BADGE: Record<EstadoCompra, string> = {
  disponible: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800',
  por_comprar: 'border-red-500/30 bg-red-500/10 text-red-800',
  comprado: 'border-amber-500/30 bg-amber-500/10 text-amber-800',
  recibido: 'border-sky-500/30 bg-sky-500/10 text-sky-800',
}

/** Estados que representan un repuesto pendiente de llegar al taller. */
export const ESTADOS_COMPRA_PENDIENTES: EstadoCompra[] = ['por_comprar', 'comprado']
