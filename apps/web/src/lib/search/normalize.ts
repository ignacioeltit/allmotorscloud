/**
 * Normaliza un texto para búsqueda: sin tildes/diacríticos, minúsculas y sin
 * caracteres que rompen los filtros de PostgREST (%, comas, paréntesis).
 * Debe coincidir con la columna generada `busqueda` de la DB (f_unaccent + lower).
 */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos
    .replace(/[%,()]/g, ' ') // caracteres que rompen .or()/.ilike de PostgREST
    .toLowerCase()
    .trim()
}
