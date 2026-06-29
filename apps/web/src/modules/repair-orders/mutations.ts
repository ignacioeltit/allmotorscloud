// Escrituras del módulo repair-orders (INSERT/UPDATE sobre `ordenes_trabajo`).
//
// Reglas de dominio (migration 003):
//   - RLS INSERT: admin, jefe_taller, recepcionista. UPDATE: + mecanico (si no está cerrada).
//   - Trigger fn_ot_unica_activa_por_vehiculo: bloquea una segunda OT activa por vehículo.
//   - Trigger fn_set_cerrado_en: al pasar a 'cerrada'/'cancelada' setea cerrado_en
//     automáticamente; e impide reabrir una OT cerrada. Por eso NO seteamos cerrado_en aquí.
//   - UNIQUE(org_id, numero_ot): número repetido ⇒ ConflictError.

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { validationErrorFromZod } from '@/lib/errors'
import {
  ordenTrabajoCreateSchema,
  ordenTrabajoUpdateSchema,
  cambiarEstadoOTSchema,
  type OrdenTrabajo,
  type OrdenTrabajoCreateInput,
  type OrdenTrabajoUpdateInput,
  type CambiarEstadoOTInput,
} from './types'

const COLUMNS =
  'id, org_id, vehiculo_id, numero_ot, estado, sucursal_id, recepcionista_id, km_ingreso, fecha_prometida_entrega, notas, cerrado_en, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

/** Abre una OT para un vehículo (estado inicial = DEFAULT 'pendiente_diagnostico'). */
export async function createOrdenTrabajo(
  supabase: DbClient,
  input: OrdenTrabajoCreateInput,
): Promise<OrdenTrabajo> {
  const parsed = ordenTrabajoCreateSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .insert({ ...parsed.data, org_id: orgId, creado_por: userId })
    .select(COLUMNS)

  return unwrapWritten<OrdenTrabajo>(data, error)
}

/** Edita datos no-estado de una OT. */
export async function updateOrdenTrabajo(
  supabase: DbClient,
  id: string,
  input: OrdenTrabajoUpdateInput,
): Promise<OrdenTrabajo> {
  const parsed = ordenTrabajoUpdateSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update(parsed.data)
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .select(COLUMNS)

  return unwrapWritten<OrdenTrabajo>(data, error)
}

/**
 * Cambia el estado de la OT. Para 'cerrada'/'cancelada' el trigger setea cerrado_en;
 * intentar reabrir una OT cerrada será rechazado por el trigger (DatabaseError).
 */
export async function cambiarEstadoOrdenTrabajo(
  supabase: DbClient,
  id: string,
  input: CambiarEstadoOTInput,
): Promise<OrdenTrabajo> {
  const parsed = cambiarEstadoOTSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update({ estado: parsed.data.estado })
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .select(COLUMNS)

  return unwrapWritten<OrdenTrabajo>(data, error)
}

/** Soft-delete de la OT. */
export async function softDeleteOrdenTrabajo(
  supabase: DbClient,
  id: string,
): Promise<OrdenTrabajo> {
  const { userId, orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update({ eliminado_en: new Date().toISOString(), eliminado_por: userId })
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .select(COLUMNS)

  return unwrapWritten<OrdenTrabajo>(data, error)
}
