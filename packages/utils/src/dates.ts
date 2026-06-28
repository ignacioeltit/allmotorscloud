// Utilidades de fechas. Sin dependencias externas (no dayjs, no date-fns en este paquete).
// Si se necesita una librería de fechas, agregarla aquí y re-exportar.

export function toISOString(date: Date): string {
  return date.toISOString()
}

export function formatDateCL(dateStr: string): string {
  // DD/MM/YYYY — formato estándar chileno
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-CL')
}
