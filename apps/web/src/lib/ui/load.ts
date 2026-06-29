// Helper para Server Components: ejecuta una lectura y captura AppError de forma
// uniforme (especialmente AuthError cuando aún no hay sesión — auth es Sprint 2,
// pendiente). Errores no-AppError se propagan (fallo real).

import { AppError } from '@/lib/errors'

export type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; isAuth: boolean }

export async function load<T>(fn: () => Promise<T>): Promise<LoadResult<T>> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (e) {
    if (e instanceof AppError) {
      return { ok: false, error: e.message, isAuth: e.code === 'auth_error' }
    }
    throw e
  }
}
