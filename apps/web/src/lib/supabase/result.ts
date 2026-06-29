// Helpers para desempaquetar respuestas de Supabase/PostgREST con manejo de error uniforme.
//
// Centraliza la regla crítica de BACKEND_ARCHITECTURE §6: toda escritura encadena
// `.select()` y debe afectar al menos 1 fila; si afecta 0 → RLS bloqueó o la sesión
// expiró → se lanza RlsError.

import type { PostgrestError } from '@supabase/supabase-js'
import { mapPostgrestError, NotFoundError, RlsError } from '@/lib/errors'

/** Desempaqueta una lista de lectura. Devuelve [] si no hay filas. */
export function unwrapList<T>(data: T[] | null, error: PostgrestError | null): T[] {
  if (error) throw mapPostgrestError(error)
  return data ?? []
}

/** Desempaqueta una lectura opcional (0 o 1 fila). Devuelve null si no existe. */
export function unwrapMaybe<T>(data: T | null, error: PostgrestError | null): T | null {
  if (error) throw mapPostgrestError(error)
  return data ?? null
}

/** Desempaqueta una lectura obligatoria. Lanza NotFoundError si no existe. */
export function unwrapRequired<T>(data: T | null, error: PostgrestError | null): T {
  if (error) throw mapPostgrestError(error)
  if (data == null) throw new NotFoundError()
  return data
}

/**
 * Desempaqueta una escritura (INSERT/UPDATE) que encadenó `.select()`.
 * Exige al menos 1 fila afectada; 0 filas ⇒ RLS bloqueó la operación.
 */
export function unwrapWritten<T>(data: T[] | null, error: PostgrestError | null): T {
  if (error) throw mapPostgrestError(error)
  if (!data || data.length === 0) throw new RlsError()
  const row = data[0]
  if (row === undefined) throw new RlsError()
  return row
}
