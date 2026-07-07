// Lecturas de presupuestos históricos de TallerGP (tabla `presupuestos_tallergp`).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import type { PresupuestoTallerGp } from './types'

const COLUMNS = 'id, numero, estado, fecha, cliente_nombre, total_neto, total_con_iva, lineas'

/** Presupuestos históricos de TallerGP de un vehículo, del más reciente al más antiguo. */
export async function listPresupuestosTallerGpByVehiculo(
  supabase: DbClient,
  vehiculoId: string,
): Promise<PresupuestoTallerGp[]> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('presupuestos_tallergp')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('vehiculo_id', vehiculoId)
    .order('fecha', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as PresupuestoTallerGp[]
}
