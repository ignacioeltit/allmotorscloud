// Constantes del módulo estimates (tablas `presupuestos` e `items_presupuesto`, migration 003).

export const ESTADOS_PRESUPUESTO = ['borrador', 'enviado', 'autorizado', 'rechazado'] as const
export type EstadoPresupuesto = (typeof ESTADOS_PRESUPUESTO)[number]

export const ESTADO_PRESUPUESTO_LABEL: Record<EstadoPresupuesto, string> = {
  borrador: 'Borrador',
  enviado: 'Enviado al cliente',
  autorizado: 'Autorizado',
  rechazado: 'Rechazado',
}

export const TIPOS_ITEM_PRESUPUESTO = ['mano_obra', 'repuesto', 'otros'] as const
export type TipoItemPresupuesto = (typeof TIPOS_ITEM_PRESUPUESTO)[number]

export const TIPO_ITEM_LABEL: Record<TipoItemPresupuesto, string> = {
  mano_obra: 'Mano de obra',
  repuesto: 'Repuesto',
  otros: 'Otros',
}
