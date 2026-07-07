// Normalización de identificadores para búsqueda tolerante al formato:
// una patente con o sin guion, y un RUT con o sin puntos/guion, se tratan igual.

/** Patente en mayúsculas y sin separadores: "hdcx-10" → "HDCX10". */
export function normalizarPatente(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** RUT reducido a dígitos + K, sin puntos ni guion: "16.218.807-0" → "162188070". */
export function normalizarRut(valor: string): string {
  return valor.toUpperCase().replace(/[^0-9K]/g, '')
}
