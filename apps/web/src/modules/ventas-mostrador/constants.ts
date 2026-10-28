// Constantes del POS mostrador.

export const METODOS_PAGO = ['efectivo', 'debito', 'credito', 'transferencia'] as const
export type MetodoPago = (typeof METODOS_PAGO)[number]

export const METODO_PAGO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
}

/** IVA Chile. El precio de mostrador se ingresa con IVA incluido. */
export const IVA_FACTOR = 1.19
