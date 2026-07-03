// Lecturas del módulo agenda (SELECT sobre `citas`).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import type { CitaConDetalle } from './types'

const CITA_COLUMNS =
  'id, fecha_cita, duracion_estimada_min, tipo_servicio, estado, notas, cliente_id, vehiculo_id,' +
  ' cliente:clientes(nombre, telefono), vehiculo:vehiculos(patente, marca, modelo)'

/**
 * Lista las citas del tenant cuya fecha cae en [desdeISO, hastaISO), ordenadas por
 * hora. Sirve tanto para la vista de día como la de semana (el cliente filtra por
 * día dentro del rango). Excluye las canceladas por defecto para no ensuciar la
 * agenda, salvo que se pida incluirlas.
 */
export async function listCitasRango(
  supabase: DbClient,
  desdeISO: string,
  hastaISO: string,
  opts: { incluirCanceladas?: boolean } = {},
): Promise<CitaConDetalle[]> {
  const { orgId } = await getAuthContext(supabase)

  let q = supabase
    .from('citas')
    .select(CITA_COLUMNS)
    .eq('org_id', orgId)
    .is('eliminado_en', null)
    .gte('fecha_cita', desdeISO)
    .lt('fecha_cita', hastaISO)

  if (!opts.incluirCanceladas) {
    q = q.neq('estado', 'cancelada')
  }

  const { data, error } = await q.order('fecha_cita', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as CitaConDetalle[]
}

/**
 * Para un conjunto de vehículos, devuelve la próxima cita ACTIVA (programada o
 * confirmada) de cada uno: mapa vehiculo_id → fecha_cita. Se usa para apagar la
 * alerta "quiere agendar" del dashboard cuando la cita ya existe.
 */
export async function getCitasActivasPorVehiculo(
  supabase: DbClient,
  vehiculoIds: string[],
): Promise<Record<string, string>> {
  if (vehiculoIds.length === 0) return {}
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('citas')
    .select('vehiculo_id, fecha_cita')
    .eq('org_id', orgId)
    .is('eliminado_en', null)
    .in('estado', ['programada', 'confirmada'])
    .in('vehiculo_id', vehiculoIds)
    .order('fecha_cita', { ascending: true })

  if (error) throw new Error(error.message)

  const mapa: Record<string, string> = {}
  for (const c of (data ?? []) as { vehiculo_id: string; fecha_cita: string }[]) {
    if (!mapa[c.vehiculo_id]) mapa[c.vehiculo_id] = c.fecha_cita
  }
  return mapa
}
