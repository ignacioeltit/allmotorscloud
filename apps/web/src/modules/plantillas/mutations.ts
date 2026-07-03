// Escrituras de paquetes de trabajo (plantillas_trabajo + items_plantilla).
// RLS: solo admin/jefe_taller crean/editan paquetes y sus ítems (migrations 005 y 026).
// Los paquetes no se borran: se desactivan (activo=false). Los ítems sí se borran
// físico — son configuración, no historial operativo.

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { mapPostgrestError, ValidationError } from '@/lib/errors'

export interface CrearPlantillaInput {
  nombre: string
  codigo?: string
  descripcion?: string
  tipoPrecio: 'suma_items' | 'cabecera'
  precioCabecera?: number | null
}

export async function crearPlantilla(
  supabase: DbClient,
  input: CrearPlantillaInput,
): Promise<{ id: string }> {
  const nombre = input.nombre.trim()
  if (!nombre) throw new ValidationError('El nombre del paquete es obligatorio.')
  if (input.tipoPrecio === 'cabecera' && (input.precioCabecera == null || input.precioCabecera < 0)) {
    throw new ValidationError('Un paquete con precio único necesita ese precio.')
  }

  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('plantillas_trabajo')
    .insert({
      org_id: orgId,
      nombre,
      ...(input.codigo?.trim() ? { codigo: input.codigo.trim().toUpperCase() } : {}),
      ...(input.descripcion?.trim() ? { descripcion: input.descripcion.trim() } : {}),
      tipo_precio: input.tipoPrecio,
      precio_cabecera: input.tipoPrecio === 'cabecera' ? Math.round(input.precioCabecera!) : null,
      fuente: 'manual',
    })
    .select('id')

  return unwrapWritten<{ id: string }>(data, error)
}

export interface ActualizarPlantillaInput {
  nombre?: string
  codigo?: string | null
  descripcion?: string | null
  tipoPrecio?: 'suma_items' | 'cabecera'
  precioCabecera?: number | null
  activo?: boolean
}

export async function actualizarPlantilla(
  supabase: DbClient,
  id: string,
  input: ActualizarPlantillaInput,
): Promise<void> {
  const { orgId } = await getAuthContext(supabase)

  const cambios: Record<string, unknown> = {}
  if (input.nombre !== undefined) {
    const n = input.nombre.trim()
    if (!n) throw new ValidationError('El nombre no puede quedar vacío.')
    cambios.nombre = n
  }
  if (input.codigo !== undefined) cambios.codigo = input.codigo?.trim()?.toUpperCase() || null
  if (input.descripcion !== undefined) cambios.descripcion = input.descripcion?.trim() || null
  if (input.tipoPrecio !== undefined) {
    cambios.tipo_precio = input.tipoPrecio
    // La base exige precio_cabecera cuando tipo='cabecera' (y lo anulamos al volver a suma).
    cambios.precio_cabecera =
      input.tipoPrecio === 'cabecera' ? Math.round(input.precioCabecera ?? 0) : null
  } else if (input.precioCabecera !== undefined) {
    cambios.precio_cabecera = input.precioCabecera == null ? null : Math.round(input.precioCabecera)
  }
  if (input.activo !== undefined) cambios.activo = input.activo
  if (Object.keys(cambios).length === 0) return

  const { data, error } = await supabase
    .from('plantillas_trabajo')
    .update(cambios)
    .eq('org_id', orgId)
    .eq('id', id)
    .select('id')

  unwrapWritten<{ id: string }>(data, error)
}

export interface NuevoItemPlantilla {
  tipo: 'labor' | 'material' | 'other'
  nombre: string
  cantidad: number
  precioUnitario: number
}

/** Agrega varias líneas al paquete de una vez, continuando el orden existente. */
export async function addItemsPlantilla(
  supabase: DbClient,
  plantillaId: string,
  items: NuevoItemPlantilla[],
): Promise<void> {
  if (items.length === 0) return

  const { data: maxData } = await supabase
    .from('items_plantilla')
    .select('orden')
    .eq('plantilla_id', plantillaId)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()
  const base = ((maxData as { orden: number } | null)?.orden ?? 0) + 1

  const rows = items.map((it, i) => ({
    plantilla_id: plantillaId,
    tipo: it.tipo,
    nombre: it.nombre.trim(),
    cantidad: it.cantidad,
    precio_unitario: Math.round(it.precioUnitario),
    orden: base + i,
  }))

  const { error } = await supabase.from('items_plantilla').insert(rows)
  if (error) throw mapPostgrestError(error)
}

/** Borra físico un ítem del paquete (configuración, sin soft-delete). */
export async function eliminarItemPlantilla(supabase: DbClient, itemId: string): Promise<void> {
  const { error } = await supabase.from('items_plantilla').delete().eq('id', itemId)
  if (error) throw mapPostgrestError(error)
}
