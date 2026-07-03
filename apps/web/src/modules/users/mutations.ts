// Escrituras del módulo users (tabla `usuarios`).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { mapPostgrestError, ValidationError } from '@/lib/errors'

/**
 * Agrega un mecánico al equipo. Crea SOLO la fila en `usuarios` (sin cuenta de
 * acceso): el mecánico no entra a la app, existe para asignarle trabajos de OT.
 * Si algún día necesita login, se le crea la cuenta en Supabase Auth con este
 * mismo id. RLS: solo admin puede insertar usuarios.
 */
export async function agregarMecanico(
  supabase: DbClient,
  input: { nombre: string; email?: string; telefono?: string },
): Promise<{ id: string }> {
  const nombre = input.nombre.trim()
  if (!nombre) throw new ValidationError('El nombre es obligatorio.')

  const { userId, orgId } = await getAuthContext(supabase)

  const { data: rol, error: rolError } = await supabase
    .from('roles')
    .select('id')
    .eq('nombre', 'mecanico')
    .single()
  if (rolError || !rol) throw mapPostgrestError(rolError!)

  // usuarios.email es NOT NULL: si no se entrega, va un placeholder interno único.
  const id = crypto.randomUUID()
  const email = input.email?.trim() || `mecanico-${id.slice(0, 8)}@equipo.allmotors.local`

  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      id,
      org_id: orgId,
      rol_id: (rol as { id: string }).id,
      nombre,
      email,
      ...(input.telefono?.trim() ? { telefono: input.telefono.trim() } : {}),
      creado_por: userId,
    })
    .select('id')

  return unwrapWritten<{ id: string }>(data, error)
}
