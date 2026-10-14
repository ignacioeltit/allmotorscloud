// Escrituras de recomendaciones del vehículo.
//   - crear: mecánico o gestión deja la nota.
//   - editar: solo gestión (asesor de servicio) la afina — lo impone RLS.
//   - resolver: gestión la marca resuelta (queda quién/cuándo y en qué OT).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { validationErrorFromZod } from '@/lib/errors'
import {
  crearRecomendacionSchema,
  editarRecomendacionSchema,
  RECOMENDACION_COLUMNS,
  type CrearRecomendacionInput,
  type EditarRecomendacionInput,
  type Recomendacion,
} from './types'

export async function crearRecomendacion(
  supabase: DbClient,
  input: CrearRecomendacionInput,
): Promise<Recomendacion> {
  const parsed = crearRecomendacionSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)
  const { vehiculoId, ordenTrabajoId, descripcion, prioridad } = parsed.data

  const { data, error } = await supabase
    .from('recomendaciones_vehiculo')
    .insert({
      org_id: orgId,
      vehiculo_id: vehiculoId,
      ...(ordenTrabajoId ? { orden_trabajo_id: ordenTrabajoId } : {}),
      descripcion,
      prioridad,
      creado_por: userId,
    })
    .select(RECOMENDACION_COLUMNS)

  return unwrapWritten<Recomendacion>(data, error)
}

export async function editarRecomendacion(
  supabase: DbClient,
  id: string,
  input: EditarRecomendacionInput,
): Promise<Recomendacion> {
  const parsed = editarRecomendacionSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('recomendaciones_vehiculo')
    .update(parsed.data)
    .eq('org_id', orgId)
    .eq('id', id)
    .eq('estado', 'pendiente')
    .select(RECOMENDACION_COLUMNS)

  return unwrapWritten<Recomendacion>(data, error)
}

/** Marca una recomendación como resuelta (opcionalmente ligada a la OT actual). */
export async function resolverRecomendacion(
  supabase: DbClient,
  id: string,
  ordenTrabajoId?: string | null,
): Promise<Recomendacion> {
  const { userId, orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('recomendaciones_vehiculo')
    .update({
      estado: 'resuelta',
      resuelta_por: userId,
      resuelta_en: new Date().toISOString(),
      ...(ordenTrabajoId ? { resuelta_ot_id: ordenTrabajoId } : {}),
    })
    .eq('org_id', orgId)
    .eq('id', id)
    .eq('estado', 'pendiente')
    .select(RECOMENDACION_COLUMNS)

  return unwrapWritten<Recomendacion>(data, error)
}
