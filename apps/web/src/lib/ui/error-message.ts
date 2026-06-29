// Extrae un mensaje seguro de mostrar al usuario desde un error capturado.
// Los AppError del backend ya traen `message` en español apto para UI.

export function toErrorMessage(
  e: unknown,
  fallback = 'Ocurrió un error inesperado. Inténtalo de nuevo.',
): string {
  if (e instanceof Error && e.message) return e.message
  return fallback
}
