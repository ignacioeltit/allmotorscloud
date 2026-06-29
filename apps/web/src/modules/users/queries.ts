import type { DbClient } from '@/lib/supabase/types'
import type { MecanicoSimple } from './types'

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
