// Escrituras de la organización (taller). RLS: solo admin del tenant
// (organizaciones_update, migration 001).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { z } from 'zod'

const actualizarOrganizacionSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  rut: z.string().trim().max(20).nullish(),
  telefono: z.string().trim().max(40).nullish(),
  email: z.string().trim().email('Email inválido').max(120).nullish().or(z.literal('')),
  direccion: z.string().trim().max(300).nullish(),
  ciudad: z.string().trim().max(120).nullish(),
  logo_url: z.string().trim().url().max(1000).nullish().or(z.literal('')),
})

export type ActualizarOrganizacionInput = z.infer<typeof actualizarOrganizacionSchema>

/** Actualiza los datos de la empresa (solo admin, por RLS). */
export async function actualizarOrganizacion(
  supabase: DbClient,
  input: ActualizarOrganizacionInput,
): Promise<void> {
  const parsed = actualizarOrganizacionSchema.parse(input)
  const { orgId } = await getAuthContext(supabase)

  const norm = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)

  const { data, error } = await supabase
    .from('organizaciones')
    .update({
      nombre: parsed.nombre.trim(),
      rut: norm(parsed.rut),
      telefono: norm(parsed.telefono),
      email: norm(parsed.email),
      direccion: norm(parsed.direccion),
      ciudad: norm(parsed.ciudad),
      logo_url: norm(parsed.logo_url),
    })
    .eq('id', orgId)
    .select('id')

  unwrapWritten<{ id: string }>(data, error)
}

/**
 * Sube el logo al bucket público `branding` y devuelve su URL pública.
 * Ruta: branding/<org_id>/logo-<ts>.<ext>. Requiere sesión (admin en la práctica).
 */
export async function subirLogo(supabase: DbClient, file: File): Promise<string> {
  const { orgId } = await getAuthContext(supabase)
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const path = `${orgId}/logo-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('branding')
    .upload(path, file, { upsert: true, contentType: file.type || undefined })
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from('branding').getPublicUrl(path)
  return data.publicUrl
}
