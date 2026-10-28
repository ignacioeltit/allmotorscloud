// Lecturas del POS mostrador.

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import {
  VENTA_COLUMNS,
  ITEM_VENTA_COLUMNS,
  type VentaMostrador,
  type ItemVentaMostrador,
  type VentaMostradorConDetalle,
} from './types'

/** Últimas ventas de mostrador del tenant. */
export async function listVentasMostrador(
  supabase: DbClient,
  limit = 30,
): Promise<(VentaMostrador & { cliente_nombre: string | null })[]> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('ventas_mostrador')
    .select(`${VENTA_COLUMNS}, clientes(nombre)`)
    .eq('org_id', orgId)
    .order('creado_en', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  type Row = VentaMostrador & { clientes: { nombre: string } | null }
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const { clientes, ...venta } = r
    return { ...venta, cliente_nombre: clientes?.nombre ?? null }
  })
}

/** Una venta con sus ítems y el nombre del cliente. */
export async function getVentaMostradorById(
  supabase: DbClient,
  id: string,
): Promise<VentaMostradorConDetalle | null> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('ventas_mostrador')
    .select(`${VENTA_COLUMNS}, clientes(nombre)`)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const { clientes, ...venta } = data as unknown as VentaMostrador & { clientes: { nombre: string } | null }

  const { data: itemsData, error: itemsError } = await supabase
    .from('items_venta_mostrador')
    .select(ITEM_VENTA_COLUMNS)
    .eq('org_id', orgId)
    .eq('venta_id', id)
    .order('id', { ascending: true })

  if (itemsError) throw new Error(itemsError.message)

  return {
    ...venta,
    cliente_nombre: clientes?.nombre ?? null,
    items: (itemsData ?? []) as ItemVentaMostrador[],
  }
}
