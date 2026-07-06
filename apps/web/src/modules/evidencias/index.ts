// Fotos de avance de la OT (tabla `evidencias`, bucket público `evidencias`).
// Reglas: insert admin/jefe/recepcionista/mecanico; toggle visible_cliente y
// delete admin/jefe/recepcionista (RLS migration 003/034).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'

export interface FotoOT {
  id: string
  orden_trabajo_id: string
  bucket_path: string
  descripcion: string | null
  visible_cliente: boolean
  mime_type: string
  creado_en: string
}

/** URL pública de una foto del bucket `evidencias`. */
export function urlFoto(bucketPath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return `${base}/storage/v1/object/public/evidencias/${bucketPath}`
}

const COLS = 'id, orden_trabajo_id, bucket_path, descripcion, visible_cliente, mime_type, creado_en'

/** Fotos de una OT, más recientes primero. */
export async function listFotosByOT(supabase: DbClient, ordenTrabajoId: string): Promise<FotoOT[]> {
  const { orgId } = await getAuthContext(supabase)
  const { data, error } = await supabase
    .from('evidencias')
    .select(COLS)
    .eq('org_id', orgId)
    .eq('orden_trabajo_id', ordenTrabajoId)
    .eq('tipo', 'foto')
    .order('creado_en', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as FotoOT[]
}

/** Sube una foto al bucket y registra la evidencia ligada a la OT. */
export async function subirFotoOT(
  supabase: DbClient,
  ordenTrabajoId: string,
  file: File,
  descripcion?: string | null,
): Promise<FotoOT> {
  const { orgId, userId } = await getAuthContext(supabase)
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${orgId}/${ordenTrabajoId}/${crypto.randomUUID()}.${ext}`

  const up = await supabase.storage.from('evidencias').upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (up.error) throw new Error(up.error.message)

  const { data, error } = await supabase
    .from('evidencias')
    .insert({
      org_id: orgId,
      orden_trabajo_id: ordenTrabajoId,
      tipo: 'foto',
      bucket_path: path,
      mime_type: file.type || 'image/jpeg',
      tamano_bytes: file.size,
      visible_cliente: true, // por defecto el cliente la ve (ese es el fin)
      ...(descripcion?.trim() ? { descripcion: descripcion.trim() } : {}),
      creado_por: userId,
    })
    .select(COLS)
  return unwrapWritten<FotoOT>(data, error)
}

/**
 * Edita el detalle/descripción de una foto. Vía fn_editar_detalle_foto
 * (SECURITY DEFINER) para que el mecánico también pueda, sin tocar la
 * visibilidad al cliente (que sigue siendo de gestión).
 */
export async function actualizarDescripcionFoto(
  supabase: DbClient,
  fotoId: string,
  descripcion: string,
): Promise<void> {
  const { error } = await supabase.rpc('fn_editar_detalle_foto', {
    p_foto_id: fotoId,
    p_descripcion: descripcion,
  })
  if (error) throw error
}

/** Marca/desmarca una foto como visible para el cliente. */
export async function toggleVisibleCliente(
  supabase: DbClient,
  fotoId: string,
  visible: boolean,
): Promise<void> {
  const { orgId } = await getAuthContext(supabase)
  const { data, error } = await supabase
    .from('evidencias')
    .update({ visible_cliente: visible })
    .eq('org_id', orgId)
    .eq('id', fotoId)
    .select('id')
  unwrapWritten<{ id: string }>(data, error)
}

/** Elimina una foto (registro + archivo del bucket). */
export async function eliminarFotoOT(supabase: DbClient, foto: FotoOT): Promise<void> {
  const { orgId } = await getAuthContext(supabase)
  const { data, error } = await supabase
    .from('evidencias')
    .delete()
    .eq('org_id', orgId)
    .eq('id', foto.id)
    .select('id')
  unwrapWritten<{ id: string }>(data, error)
  await supabase.storage.from('evidencias').remove([foto.bucket_path])
}

/** Genera (o devuelve) el token del link público de avance de la OT. */
export async function generarTokenAvance(supabase: DbClient, ordenTrabajoId: string): Promise<string> {
  const { orgId } = await getAuthContext(supabase)
  const { data: existing } = await supabase
    .from('ordenes_trabajo')
    .select('token_avance')
    .eq('org_id', orgId)
    .eq('id', ordenTrabajoId)
    .maybeSingle()
  const actual = (existing as { token_avance: string | null } | null)?.token_avance
  if (actual) return actual

  const token = crypto.randomUUID()
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update({ token_avance: token })
    .eq('org_id', orgId)
    .eq('id', ordenTrabajoId)
    .select('id')
  unwrapWritten<{ id: string }>(data, error)
  return token
}
