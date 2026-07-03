import type { DbClient } from '@/lib/supabase/types'
import type { MecanicoSimple } from './types'

/** Miembro del equipo con su rol, para la página de Equipo. */
export interface MiembroEquipo {
  id: string
  nombre: string
  email: string
  telefono: string | null
  rol: string
}

/** Lista el equipo completo del taller (usuarios activos con su rol). */
export async function listEquipo(supabase: DbClient): Promise<MiembroEquipo[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, telefono, roles:rol_id(nombre)')
    .order('nombre')

  if (error) throw new Error(error.message)

  type Row = { id: string; nombre: string; email: string; telefono: string | null; roles: { nombre: string } | null }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    email: r.email,
    telefono: r.telefono,
    rol: r.roles?.nombre ?? '—',
  }))
}

/**
 * Lista usuarios con rol 'mecanico' dentro del org del llamante.
 * El RLS de usuarios filtra por org_id = mi_org_id() automáticamente.
 * Los roles son un catálogo global (sin org_id), accesible por cualquier authenticated.
 */
export async function listMecanicosByOrg(supabase: DbClient): Promise<MecanicoSimple[]> {
  const { data: rolRow } = await supabase
    .from('roles')
    .select('id')
    .eq('nombre', 'mecanico')
    .single()

  if (!rolRow) return []

  const { data } = await supabase
    .from('usuarios')
    .select('id, nombre')
    .eq('rol_id', rolRow.id)
    .order('nombre')

  return (data ?? []) as MecanicoSimple[]
}
