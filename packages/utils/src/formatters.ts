// Formatters para moneda, unidades y strings del dominio.

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatPatente(patente: string): string {
  return patente.toUpperCase().trim()
}
