// Validación y formateo de RUT chileno.
// Sin dependencias externas.

export function formatRut(rut: string): string {
  // Implementar en Sprint 2
  return rut
}

export function validateRut(rut: string): boolean {
  // Implementar en Sprint 2
  return rut.length > 0
}

export function normalizeRut(rut: string): string {
  return rut.replace(/\./g, '').replace(/-/g, '').toUpperCase()
}
