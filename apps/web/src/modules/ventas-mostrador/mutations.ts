// Escritura del POS mostrador: registra la venta completa vía RPC transaccional
// fn_registrar_venta_mostrador (inserta venta + ítems, descuenta stock y registra
// el ingreso en finanzas en una sola transacción).

import type { DbClient } from '@/lib/supabase/types'
import { validationErrorFromZod, mapPostgrestError } from '@/lib/errors'
import { registrarVentaSchema, type RegistrarVentaInput } from './types'

/** Registra una venta de mostrador. Devuelve el id de la venta creada. */
export async function registrarVentaMostrador(
  supabase: DbClient,
  input: RegistrarVentaInput,
): Promise<string> {
  const parsed = registrarVentaSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { items, clienteId, metodoPago, notas } = parsed.data

  const { data, error } = await supabase.rpc('fn_registrar_venta_mostrador', {
    p_items: items.map((i) => ({
      repuesto_id: i.repuesto_id ?? null,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
    })),
    p_cliente_id: clienteId ?? null,
    p_metodo_pago: metodoPago,
    p_notas: notas ?? null,
  })

  if (error) throw mapPostgrestError(error)
  return data as string
}
