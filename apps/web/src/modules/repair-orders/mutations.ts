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
import { validationErrorFromZod, mapPostgrestError, ValidationError } from '@/lib/errors'
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
 *
 * Regla del taller: una OT no se entrega ni se cierra sin kilometraje registrado
 * (el historial técnico del vehículo depende de ese dato).
 */
export async function cambiarEstadoOrdenTrabajo(
  supabase: DbClient,
  id: string,
  input: CambiarEstadoOTInput,
): Promise<OrdenTrabajo> {
  const parsed = cambiarEstadoOTSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { orgId } = await getAuthContext(supabase)

  if (parsed.data.estado === 'cerrada' || parsed.data.estado === 'entregada') {
    const { data: ot } = await supabase
      .from('ordenes_trabajo')
      .select('km_ingreso')
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle()
    if ((ot as { km_ingreso: number | null } | null)?.km_ingreso == null) {
      throw new ValidationError(
        'La OT no tiene kilometraje registrado. Ingrésalo (campo "Km ingreso" en la cabecera) antes de entregarla o cerrarla.',
      )
    }

    // No se puede entregar/cerrar sin registrar la entrega: eso captura el cobro
    // (al contado ahora, o marcado para más tarde como crédito / por facturar).
    // Evita cerrar una OT y perder el ingreso de vista, como pasó con OT-000034.
    const { data: ent } = await supabase
      .from('entregas')
      .select('id')
      .eq('org_id', orgId)
      .eq('orden_trabajo_id', id)
      .limit(1)
    if (!ent || ent.length === 0) {
      throw new ValidationError(
        'No puedes cerrar la OT sin registrar la entrega. Usa "Entregar y facturar" en la OT — si el cobro es para otro momento, márcala como crédito o "por facturar". Para cierres sin cobro (garantía/cortesía), registra la entrega con documento "Sin documento".',
      )
    }
  }

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update({ estado: parsed.data.estado })
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .select(COLUMNS)

  return unwrapWritten<OrdenTrabajo>(data, error)
}

/** Registra (o corrige) el kilometraje de ingreso de la OT. */
export async function actualizarKmIngreso(
  supabase: DbClient,
  id: string,
  km: number,
): Promise<void> {
  if (!Number.isFinite(km) || km < 0) throw new ValidationError('Kilometraje inválido.')
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update({ km_ingreso: Math.round(km) })
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .select('id')

  unwrapWritten<{ id: string }>(data, error)
}

/** Soft-delete de la OT. */
export async function softDeleteOrdenTrabajo(supabase: DbClient, id: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete', { p_table: 'ordenes_trabajo', p_id: id })
  if (error) throw mapPostgrestError(error)
}

/** Restaura una OT eliminada (requiere admin o jefe_taller). */
export async function restoreOrdenTrabajo(supabase: DbClient, id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_deleted', { p_table: 'ordenes_trabajo', p_id: id })
  if (error) throw mapPostgrestError(error)
}
