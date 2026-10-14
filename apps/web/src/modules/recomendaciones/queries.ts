// Lecturas de recomendaciones del vehículo.

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { RECOMENDACION_COLUMNS, type Recomendacion } from './types'

/** Recomendaciones PENDIENTES de un vehículo (alta primero, luego más recientes). */
export async function listRecomendacionesPendientesByVehiculo(
  supabase: DbClient,
  vehiculoId: string,
): Promise<Recomendacion[]> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('recomendaciones_vehiculo')
    .select(RECOMENDACION_COLUMNS)
    .eq('org_id', orgId)
    .eq('vehiculo_id', vehiculoId)
    .eq('estado', 'pendiente')
    .order('prioridad', { ascending: true }) // 'alta' < 'normal'
    .order('creado_en', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Recomendacion[]
}

/** Conteo de recomendaciones pendientes por vehículo (para alertas en lote). */
export async function contarRecomendacionesPendientes(
  supabase: DbClient,
  vehiculoIds: string[],
): Promise<Record<string, number>> {
  if (vehiculoIds.length === 0) return {}
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('recomendaciones_vehiculo')
    .select('vehiculo_id')
    .eq('org_id', orgId)
    .eq('estado', 'pendiente')
    .in('vehiculo_id', vehiculoIds)

  if (error) throw new Error(error.message)
  const conteo: Record<string, number> = {}
  for (const row of (data ?? []) as { vehiculo_id: string }[]) {
    conteo[row.vehiculo_id] = (conteo[row.vehiculo_id] ?? 0) + 1
  }
  return conteo
}
