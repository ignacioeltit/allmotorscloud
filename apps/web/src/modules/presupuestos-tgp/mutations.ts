// Cargar un presupuesto histórico de TallerGP como líneas de una OT: crea una
// reparación y copia sus líneas con valor (omite las de inspección en $0).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { ValidationError } from '@/lib/errors'
import { crearReparacion, addItemReparacion } from '@/modules/reparaciones/mutations'
import type { LineaTgp } from './types'

export async function cargarPresupuestoTallerGpEnOT(
  supabase: DbClient,
  input: {
    presupuestoId: string
    ordenTrabajoId: string
    historiaId: string
    tipoEventoReparacionId: string
    mecanicoId?: string | null
  },
): Promise<{ lineasCargadas: number; numero: string | null }> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('presupuestos_tallergp')
    .select('numero, lineas')
    .eq('org_id', orgId)
    .eq('id', input.presupuestoId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new ValidationError('No se encontró el presupuesto.')

  const numero = (data as { numero: string | null }).numero
  const todas = ((data as { lineas: LineaTgp[] }).lineas ?? [])
  // Solo líneas con cantidad y valor (se omiten las de inspección en $0).
  const lineas = todas.filter((l) => l.cantidad > 0 && l.total > 0)
  if (lineas.length === 0) {
    throw new ValidationError('El presupuesto no tiene líneas con valor para cargar.')
  }

  const reparacion = await crearReparacion(supabase, {
    ordenTrabajoId: input.ordenTrabajoId,
    historiaId: input.historiaId,
    tipoEventoId: input.tipoEventoReparacionId,
    descripcion: `Cargado del presupuesto ${numero ?? ''} (TallerGP)`.trim(),
    ...(input.mecanicoId ? { mecanicoId: input.mecanicoId } : {}),
  })

  for (const l of lineas) {
    await addItemReparacion(supabase, {
      reparacionId: reparacion.id,
      tipo: l.tipo,
      ...(l.codigo ? { codigo: l.codigo } : {}),
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      costoUnitario: l.precio_unitario,
    })
  }

  return { lineasCargadas: lineas.length, numero }
}
