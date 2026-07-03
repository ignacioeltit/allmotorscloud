// Constantes del módulo reparaciones (tablas `reparaciones` e `items_reparacion`, migration 003).
// 'otros' (insumos, traslados, gestión) se agregó en migration 022.

export const TIPOS_ITEM_REPARACION = ['mano_obra', 'repuesto', 'otros'] as const
export type TipoItemReparacion = (typeof TIPOS_ITEM_REPARACION)[number]

export const TIPOS_ITEM_LABEL: Record<TipoItemReparacion, string> = {
  mano_obra: 'Mano de obra',
  repuesto: 'Repuesto / material',
  otros: 'Otros',
}
