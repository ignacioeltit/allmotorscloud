// Lecturas del módulo events (SELECT sobre `eventos` y `tipos_evento`).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapList, unwrapMaybe, unwrapRequired } from '@/lib/supabase/result'
import { EVENTOS_PAGE_SIZE } from './constants'
import type { Evento, TipoEvento, ListEventosParams } from './types'

const EVENTO_COLUMNS =
  'id, historia_tecnica_id, org_id, tipo_evento_id, sucursal_id, conductor_id, orden_trabajo_id, estado, titulo, descripcion, asignado_a, km_vehiculo, visible_cliente, cerrado_en, cancelado_en, cancelado_por, razon_cancelacion, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

/** Lista los eventos de una historia técnica, cronológico descendente (hot path). */
export async function listEventosByHistoria(
  supabase: DbClient,
  historiaTecnicaId: string,
  params: ListEventosParams = {},
): Promise<Evento[]> {
  const { orgId } = await getAuthContext(supabase)
  const limit = params.limit ?? EVENTOS_PAGE_SIZE
  const offset = params.offset ?? 0

  const { data, error } = await supabase
    .from('eventos')
    .select(EVENTO_COLUMNS)
    .eq('org_id', orgId)
    .eq('historia_tecnica_id', historiaTecnicaId)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false })
    .range(offset, offset + limit - 1)

  return unwrapList<Evento>(data, error)
}

/** Lista los eventos asociados a una orden de trabajo. */
export async function listEventosByOrdenTrabajo(
  supabase: DbClient,
  ordenTrabajoId: string,
): Promise<Evento[]> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('eventos')
    .select(EVENTO_COLUMNS)
    .eq('org_id', orgId)
    .eq('orden_trabajo_id', ordenTrabajoId)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false })

  return unwrapList<Evento>(data, error)
}

/** Obtiene un evento por id. Lanza NotFoundError si no existe en el tenant. */
export async function getEventoById(supabase: DbClient, id: string): Promise<Evento> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('eventos')
    .select(EVENTO_COLUMNS)
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .maybeSingle()

  return unwrapRequired<Evento>(data as Evento | null, error)
}

/** Lista los tipos de evento activos del tenant (para poblar selects al crear eventos). */
export async function listTiposEvento(supabase: DbClient): Promise<TipoEvento[]> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('tipos_evento')
    .select('id, org_id, nombre, slug, descripcion, categoria, activo')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('nombre', { ascending: true })

  return unwrapList<TipoEvento>(data, error)
}

/** Devuelve el tipo de evento del tenant por slug, o null si no está configurado. */
export async function getTipoEventoBySlug(
  supabase: DbClient,
  slug: string,
): Promise<TipoEvento | null> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('tipos_evento')
    .select('id, org_id, nombre, slug, descripcion, categoria, activo')
    .eq('org_id', orgId)
    .eq('slug', slug)
    .eq('activo', true)
    .maybeSingle()

  return unwrapMaybe<TipoEvento>(data as TipoEvento | null, error)
}
