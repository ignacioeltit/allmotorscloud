// Escrituras del módulo agenda (INSERT/UPDATE sobre `citas`).
//
// RLS (migration 003): insert/update requieren rol admin, jefe_taller o
// recepcionista y org_id = mi_org_id(). No hay policy DELETE → se borra en
// blando (eliminado_en / eliminado_por), consistente con el resto del dominio.

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { validationErrorFromZod, mapPostgrestError } from '@/lib/errors'
import {
  crearCitaSchema,
  actualizarEstadoCitaSchema,
  type CrearCitaInput,
  type ActualizarEstadoCitaInput,
} from './types'

/** Crea una cita (estado inicial 'programada'). */
export async function crearCita(supabase: DbClient, input: CrearCitaInput): Promise<{ id: string }> {
  const parsed = crearCitaSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)
  const { vehiculoId, clienteId, fechaCita, tipoServicio, duracionMin, notas } = parsed.data

  const { data, error } = await supabase
    .from('citas')
    .insert({
      org_id: orgId,
      vehiculo_id: vehiculoId,
      ...(clienteId ? { cliente_id: clienteId } : {}),
      fecha_cita: fechaCita,
      ...(tipoServicio ? { tipo_servicio: tipoServicio } : {}),
      ...(duracionMin != null ? { duracion_estimada_min: duracionMin } : {}),
      ...(notas ? { notas } : {}),
      creado_por: userId,
    })
    .select('id')

  return unwrapWritten<{ id: string }>(data, error)
}

/** Cambia el estado de una cita (confirmar, marcar realizada, cancelar, no presentada). */
export async function actualizarEstadoCita(
  supabase: DbClient,
  input: ActualizarEstadoCitaInput,
): Promise<{ id: string }> {
  const parsed = actualizarEstadoCitaSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { orgId } = await getAuthContext(supabase)
  const { citaId, estado } = parsed.data

  const { data, error } = await supabase
    .from('citas')
    .update({ estado })
    .eq('id', citaId)
    .eq('org_id', orgId)
    .select('id')

  return unwrapWritten<{ id: string }>(data, error)
}

/** Borrado en blando de una cita. */
export async function eliminarCita(supabase: DbClient, citaId: string): Promise<void> {
  const { userId, orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('citas')
    .update({ eliminado_en: new Date().toISOString(), eliminado_por: userId })
    .eq('id', citaId)
    .eq('org_id', orgId)
    .is('eliminado_en', null)
    .select('id')

  if (error) throw mapPostgrestError(error)
  unwrapWritten<{ id: string }>(data, error)
}
