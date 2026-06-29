// Lecturas del flujo de Recepción (composición de queries de otros módulos).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapMaybe } from '@/lib/supabase/result'
import { NotFoundError } from '@/lib/errors'
import { getVehiculoById } from '@/modules/vehicles/queries'
import { getPropietarioActivoByVehiculo } from '@/modules/customers/queries'
import { getHistoriaByVehiculoId } from '@/modules/technical-history/queries'
import { listEventosByHistoria } from '@/modules/events/queries'
import { listOrdenesTrabajoByVehiculo } from '@/modules/repair-orders/queries'
import type { FichaVehiculo } from './types'

/** Resuelve el id del tipo de evento 'recepcion' del tenant, o null si no existe. */
export async function getTipoEventoRecepcionId(
  supabase: DbClient,
): Promise<string | null> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('tipos_evento')
    .select('id')
    .eq('org_id', orgId)
    .eq('slug', 'recepcion')
    .eq('activo', true)
    .maybeSingle()

  const row = unwrapMaybe<{ id: string }>(data as { id: string } | null, error)
  return row?.id ?? null
}

/**
 * Carga la ficha consolidada de un vehículo existente: datos, propietario actual,
 * historia técnica, últimos eventos y órdenes de trabajo.
 */
export async function cargarFichaVehiculo(
  supabase: DbClient,
  vehiculoId: string,
): Promise<FichaVehiculo> {
  const vehiculo = await getVehiculoById(supabase, vehiculoId)
  const cliente = await getPropietarioActivoByVehiculo(supabase, vehiculoId)

  let historia = null
  try {
    historia = await getHistoriaByVehiculoId(supabase, vehiculoId)
  } catch (e) {
    if (!(e instanceof NotFoundError)) throw e
  }

  const eventos = historia
    ? await listEventosByHistoria(supabase, historia.id, { limit: 5 })
    : []
  const ordenes = await listOrdenesTrabajoByVehiculo(supabase, vehiculoId)

  return { vehiculo, cliente, historia, eventos, ordenes }
}
