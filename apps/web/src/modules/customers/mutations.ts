// Escrituras del módulo customers (INSERT/UPDATE sobre `clientes`).
// Patrón BACKEND_ARCHITECTURE §6: ejecutar desde Client Components con el browser client.
// org_id y creado_por se derivan SIEMPRE de la sesión, nunca del cliente.

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { validationErrorFromZod } from '@/lib/errors'
import {
  clienteCreateSchema,
  clienteUpdateSchema,
  type Cliente,
  type ClienteCreateInput,
  type ClienteUpdateInput,
} from './types'

const COLUMNS =
  'id, org_id, tipo, nombre, rut, telefono, email, direccion, notas, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

/** Crea un cliente en el tenant del usuario autenticado. */
export async function createCliente(
  supabase: DbClient,
  input: ClienteCreateInput,
): Promise<Cliente> {
  const parsed = clienteCreateSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('clientes')
    .insert({ ...parsed.data, org_id: orgId, creado_por: userId })
    .select(COLUMNS)

  return unwrapWritten<Cliente>(data, error)
}

/** Actualiza un cliente existente del tenant. */
export async function updateCliente(
  supabase: DbClient,
  id: string,
  input: ClienteUpdateInput,
): Promise<Cliente> {
  const parsed = clienteUpdateSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('clientes')
    .update(parsed.data)
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .select(COLUMNS)

  return unwrapWritten<Cliente>(data, error)
}

/** Soft-delete: marca el cliente como eliminado. No borra físicamente. */
export async function softDeleteCliente(supabase: DbClient, id: string): Promise<Cliente> {
  const { userId, orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('clientes')
    .update({ eliminado_en: new Date().toISOString(), eliminado_por: userId })
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .select(COLUMNS)

  return unwrapWritten<Cliente>(data, error)
}
