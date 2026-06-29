// Lecturas del módulo technical-history (SELECT sobre `historias_tecnicas`).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapRequired } from '@/lib/supabase/result'
import type { HistoriaTecnica } from './types'

const COLUMNS = 'id, vehiculo_id, org_id, notas, creado_en, actualizado_en'

/**
 * Obtiene la historia técnica de un vehículo (relación 1:1).
 * Lanza NotFoundError si el vehículo no existe o aún no tiene historia.
 */
export async function getHistoriaByVehiculoId(
  supabase: DbClient,
  vehiculoId: string,
): Promise<HistoriaTecnica> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('historias_tecnicas')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('vehiculo_id', vehiculoId)
    .maybeSingle()

  return unwrapRequired<HistoriaTecnica>(data as HistoriaTecnica | null, error)
}

/** Obtiene una historia técnica por su id. Lanza NotFoundError si no existe. */
export async function getHistoriaById(
  supabase: DbClient,
  id: string,
): Promise<HistoriaTecnica> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('historias_tecnicas')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()

  return unwrapRequired<HistoriaTecnica>(data as HistoriaTecnica | null, error)
}
