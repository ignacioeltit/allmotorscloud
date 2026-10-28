// Lecturas de inspecciones de OT.

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { INSPECCION_COLUMNS, type Inspeccion } from './types'

/** Obtiene la inspección de una OT (o null si aún no se creó). */
export async function getInspeccionByOT(
  supabase: DbClient,
  ordenTrabajoId: string,
): Promise<Inspeccion | null> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('inspecciones_ot')
    .select(INSPECCION_COLUMNS)
    .eq('org_id', orgId)
    .eq('orden_trabajo_id', ordenTrabajoId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as Inspeccion | null) ?? null
}
