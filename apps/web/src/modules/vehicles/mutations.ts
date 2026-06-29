// Escrituras del módulo vehicles (INSERT/UPDATE sobre `vehiculos`).
//
// Nota de dominio: al insertar un vehículo, el trigger trg_80_vehiculos_crear_historia_tecnica
// (migration 002) crea automáticamente su `historias_tecnicas` (relación 1:1). La app NO
// debe crear la historia técnica manualmente.

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { validationErrorFromZod } from '@/lib/errors'
import {
  vehiculoCreateSchema,
  vehiculoUpdateSchema,
  type Vehiculo,
  type VehiculoCreateInput,
  type VehiculoUpdateInput,
} from './types'

const COLUMNS =
  'id, org_id, patente, vin, marca, modelo, anio, color, tipo, km_actual, notas, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

/** Crea un vehículo (y dispara la creación automática de su historia técnica). */
export async function createVehiculo(
  supabase: DbClient,
  input: VehiculoCreateInput,
): Promise<Vehiculo> {
  const parsed = vehiculoCreateSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('vehiculos')
    .insert({ ...parsed.data, org_id: orgId, creado_por: userId })
    .select(COLUMNS)

  return unwrapWritten<Vehiculo>(data, error)
}

/** Actualiza un vehículo existente del tenant. */
export async function updateVehiculo(
  supabase: DbClient,
  id: string,
  input: VehiculoUpdateInput,
): Promise<Vehiculo> {
  const parsed = vehiculoUpdateSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('vehiculos')
    .update(parsed.data)
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .select(COLUMNS)

  return unwrapWritten<Vehiculo>(data, error)
}

/** Soft-delete del vehículo. No borra físicamente. */
export async function softDeleteVehiculo(
  supabase: DbClient,
  id: string,
): Promise<Vehiculo> {
  const { userId, orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('vehiculos')
    .update({ eliminado_en: new Date().toISOString(), eliminado_por: userId })
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .select(COLUMNS)

  return unwrapWritten<Vehiculo>(data, error)
}
