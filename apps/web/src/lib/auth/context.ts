// Contexto de autenticación derivado de la sesión Supabase.
//
// Las funciones RLS de la base (mi_org_id(), mi_rol(), mi_sucursal_id() — migration 001)
// leen los claims desde `auth.jwt() -> app_metadata`. Aquí replicamos esa lectura del
// lado de la app para:
//   - rellenar `org_id` y `creado_por` en los INSERT (RLS WITH CHECK exige org_id correcto),
//   - filtrar explícitamente por `org_id` en las queries (BACKEND_ARCHITECTURE regla 3).
//
// NUNCA confiar en un org_id provisto por el cliente: siempre derivarlo de la sesión.

import type { DbClient } from '@/lib/supabase/types'
import { AuthError } from '@/lib/errors'

export interface AuthContext {
  /** auth.uid() del usuario autenticado. Usado como `creado_por`. */
  userId: string
  /** org_id del tenant (claim app_metadata.org_id). Coincide con mi_org_id(). */
  orgId: string
  /** Rol del usuario (claim app_metadata.role). Coincide con mi_rol(). Puede faltar. */
  rol: string | null
  /** Sucursal asignada (claim app_metadata.sucursal_id). Puede ser null. */
  sucursalId: string | null
}

/**
 * Obtiene el contexto del usuario autenticado validando el JWT contra Supabase Auth.
 *
 * Usa `getUser()` (no `getSession()`) porque verifica el token con el servidor de Auth,
 * evitando confiar en una cookie potencialmente manipulada.
 *
 * @throws {AuthError} si no hay sesión válida o el JWT no trae `org_id`.
 */
export async function getAuthContext(supabase: DbClient): Promise<AuthContext> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new AuthError()
  }

  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>
  const orgId = typeof appMetadata.org_id === 'string' ? appMetadata.org_id : null

  if (!orgId) {
    throw new AuthError(
      'Tu usuario no tiene una organización asignada. Contacta al administrador.',
    )
  }

  const rol = typeof appMetadata.role === 'string' ? appMetadata.role : null
  const sucursalId =
    typeof appMetadata.sucursal_id === 'string' ? appMetadata.sucursal_id : null

  return { userId: user.id, orgId, rol, sucursalId }
}
