// Formas de pago de una entrega (tabla entregas, migration 003 — chk_entregas_forma_pago).

export const FORMAS_PAGO = [
  'efectivo',
  'transferencia',
  'tarjeta_debito',
  'tarjeta_credito',
  'cheque',
  'otro',
] as const

export type FormaPago = (typeof FORMAS_PAGO)[number]

export const FORMA_PAGO_LABEL: Record<FormaPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta_debito: 'Tarjeta de débito',
  tarjeta_credito: 'Tarjeta de crédito',
  cheque: 'Cheque',
  otro: 'Otro',
}
