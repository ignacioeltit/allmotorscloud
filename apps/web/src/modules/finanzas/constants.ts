// Constantes de finanzas (movimientos_financieros + facturación de entregas).

export const TIPOS_MOVIMIENTO = ['ingreso', 'gasto'] as const
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number]

/** Categorías de gasto del taller (referenciales; el campo es texto libre). */
export const CATEGORIAS_GASTO = [
  'repuestos',
  'sueldos',
  'arriendo',
  'servicios_basicos',
  'herramientas',
  'insumos',
  'marketing',
  'impuestos',
  'otro',
] as const

export const CATEGORIA_GASTO_LABEL: Record<string, string> = {
  repuestos: 'Compra de repuestos',
  sueldos: 'Sueldos',
  arriendo: 'Arriendo',
  servicios_basicos: 'Servicios básicos (luz, agua, internet)',
  herramientas: 'Herramientas',
  insumos: 'Insumos',
  marketing: 'Marketing',
  impuestos: 'Impuestos',
  otro: 'Otro',
  // categorías de ingreso
  pago_ot: 'Pago de OT',
  ingreso_otro: 'Otro ingreso',
}

// ── Facturación de la entrega ────────────────────────────────────────────────

export const TIPOS_DOCUMENTO = ['ninguno', 'boleta', 'factura'] as const
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumento, string> = {
  ninguno: 'Sin documento',
  boleta: 'Boleta',
  factura: 'Factura',
}

export const CONDICIONES_PAGO = ['contado', 'credito'] as const
export type CondicionPago = (typeof CONDICIONES_PAGO)[number]

export const CONDICION_PAGO_LABEL: Record<CondicionPago, string> = {
  contado: 'Contado (pagado ahora)',
  credito: 'Crédito (paga después)',
}

export type EstadoPago = 'pagada' | 'pendiente'

// Estado de FACTURACIÓN (separado del pago). 'por_facturar' = cliente mensual:
// entregado pero la factura se emite a fin de mes.
export type EstadoFactura = 'facturada' | 'por_facturar' | 'no_aplica'

export const ESTADO_FACTURA_LABEL: Record<EstadoFactura, string> = {
  facturada: 'Facturada',
  por_facturar: 'Por facturar',
  no_aplica: 'Sin documento',
}

/**
 * Opción de documento que elige el usuario al entregar. Combina el tipo de
 * documento con el estado de facturación (emitir ahora vs a fin de mes).
 */
export const OPCIONES_DOCUMENTO = [
  { valor: 'boleta_ahora',   label: 'Boleta (emitida ahora)',            tipo: 'boleta',  estado: 'facturada' },
  { valor: 'factura_ahora',  label: 'Factura (emitida ahora)',           tipo: 'factura', estado: 'facturada' },
  { valor: 'factura_mensual', label: 'Factura mensual (a fin de mes)',   tipo: 'factura', estado: 'por_facturar' },
  { valor: 'sin_documento',  label: 'Sin documento',                     tipo: 'ninguno', estado: 'no_aplica' },
] as const

export type OpcionDocumento = (typeof OPCIONES_DOCUMENTO)[number]['valor']

/** Días de crédito por defecto para clientes a plazo. */
export const DIAS_CREDITO_DEFAULT = 30
