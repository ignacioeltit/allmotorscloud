// Escrituras del módulo events (INSERT/UPDATE sobre `eventos`).
//
// Reglas de dominio relevantes (migrations 002/003):
//   - RLS INSERT/UPDATE: admin, jefe_taller, recepcionista, mecanico.
//     El mecánico NO puede modificar un evento ya cerrado (cerrado_en IS NULL en WITH CHECK).
//   - Trigger fn_inmutabilidad_evento_cerrado: una vez seteado cerrado_en, los campos
//     técnicos quedan inmutables. Por eso cerrar es una operación terminal dedicada.
//   - CHECK chk_eventos_cancelacion: cancelado_en y razon_cancelacion van juntos (ambos o ninguno).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { validationErrorFromZod, mapPostgrestError } from '@/lib/errors'
import {
  eventoCreateSchema,
  eventoUpdateSchema,
  cancelarEventoSchema,
  type Evento,
  type EventoCreateInput,
  type EventoUpdateInput,
  type CancelarEventoInput,
} from './types'

const COLUMNS =
  'id, historia_tecnica_id, org_id, tipo_evento_id, sucursal_id, conductor_id, orden_trabajo_id, estado, titulo, descripcion, asignado_a, km_vehiculo, visible_cliente, cerrado_en, cancelado_en, cancelado_por, razon_cancelacion, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

/** Crea un evento en la historia técnica indicada. */
export async function createEvento(
  supabase: DbClient,
  input: EventoCreateInput,
): Promise<Evento> {
  const parsed = eventoCreateSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('eventos')
    .insert({ ...parsed.data, org_id: orgId, creado_por: userId })
    .select(COLUMNS)

  return unwrapWritten<Evento>(data, error)
}

/** Edita campos no terminales de un evento (no cierra ni cancela). */
export async function updateEvento(
  supabase: DbClient,
  id: string,
  input: EventoUpdateInput,
): Promise<Evento> {
  const parsed = eventoUpdateSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('eventos')
    .update(parsed.data)
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .select(COLUMNS)

  return unwrapWritten<Evento>(data, error)
}

/** Cierra un evento: estado 'cerrado' + cerrado_en. Operación terminal (luego es inmutable). */
export async function cerrarEvento(supabase: DbClient, id: string): Promise<Evento> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('eventos')
    .update({ estado: 'cerrado', cerrado_en: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .is('cerrado_en', null)
    .select(COLUMNS)

  return unwrapWritten<Evento>(data, error)
}

/** Cancela un evento: estado 'cancelado' + cancelado_en + razón (CHECK exige ambos). */
export async function cancelarEvento(
  supabase: DbClient,
  id: string,
  input: CancelarEventoInput,
): Promise<Evento> {
  const parsed = cancelarEventoSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('eventos')
    .update({
      estado: 'cancelado',
      cancelado_en: new Date().toISOString(),
      cancelado_por: userId,
      razon_cancelacion: parsed.data.razon,
    })
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .is('cancelado_en', null)
    .select(COLUMNS)

  return unwrapWritten<Evento>(data, error)
}

/**
 * Vincula un evento a una orden de trabajo (paso Evento → OT del slice).
 * Falla si el evento ya está cerrado (trigger de inmutabilidad protege orden_trabajo_id).
 */
export async function vincularEventoAOrdenTrabajo(
  supabase: DbClient,
  id: string,
  ordenTrabajoId: string,
): Promise<Evento> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('eventos')
    .update({ orden_trabajo_id: ordenTrabajoId })
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .select(COLUMNS)

  return unwrapWritten<Evento>(data, error)
}

/** Soft-delete del evento. */
export async function softDeleteEvento(supabase: DbClient, id: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete', { p_table: 'eventos', p_id: id })
  if (error) throw mapPostgrestError(error)
}

/** Restaura un evento eliminado (requiere admin o jefe_taller). */
export async function restoreEvento(supabase: DbClient, id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_deleted', { p_table: 'eventos', p_id: id })
  if (error) throw mapPostgrestError(error)
}
