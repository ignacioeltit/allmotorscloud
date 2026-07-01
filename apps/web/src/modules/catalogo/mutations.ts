// Escrituras del módulo catálogo (tabla `catalogo_servicios`).

import { z } from 'zod'
import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { validationErrorFromZod, mapPostgrestError, RlsError } from '@/lib/errors'
import type { CatalogoServicio, CrearServicioDesdeOTInput } from './types'
import { CATEGORIAS_CATALOGO } from './constants'

const SERVICIO_COLUMNS =
  'id, org_id, codigo, nombre, descripcion, categoria, precio_unitario, unidad_precio, horas_estandar, activo, es_checklist, fuente, requiere_revision, frecuencia_uso, creado_en, actualizado_en, eliminado_en'

const crearServicioSchema = z.object({
  nombre: z.string().trim().min(5, 'El nombre debe tener al menos 5 caracteres').max(300),
  categoria: z.enum(CATEGORIAS_CATALOGO, { message: 'Categoría inválida' }),
  precioUnitario: z.number().min(0).max(2_000_000, 'Precio fuera de rango razonable'),
  horasEstandar: z.number().positive().max(24).nullable().optional(),
})

/**
 * Crea un servicio nuevo desde una OT.
 * Siempre queda con requiere_revision = TRUE y fuente = 'manual'.
 * La policy RLS de recepcionista lo fuerza igualmente a nivel de DB.
 */
export async function crearServicioDesdeOT(
  supabase: DbClient,
  input: CrearServicioDesdeOTInput,
): Promise<CatalogoServicio> {
  const parsed = crearServicioSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { orgId } = await getAuthContext(supabase)
  const { nombre, categoria, precioUnitario, horasEstandar } = parsed.data

  const { data, error } = await supabase
    .from('catalogo_servicios')
    .insert({
      org_id: orgId,
      nombre,
      categoria,
      precio_unitario: precioUnitario,
      ...(horasEstandar != null ? { horas_estandar: horasEstandar } : {}),
      activo: true,
      fuente: 'manual',
      requiere_revision: true,
    })
    .select(SERVICIO_COLUMNS)

  if (error) throw mapPostgrestError(error)
  return unwrapWritten<CatalogoServicio>(data, error)
}

// ── Schema compartido para edición y aprobación ──────────────────────────────

const camposEditableSchema = z.object({
  nombre: z.string().trim().min(5, 'El nombre debe tener al menos 5 caracteres').max(300).optional(),
  codigo: z.string().trim().max(50).nullable().optional(),
  descripcion: z.string().trim().max(1000).nullable().optional(),
  categoria: z.enum(CATEGORIAS_CATALOGO, { message: 'Categoría inválida' }).optional(),
  horasEstandar: z.number().min(0, 'Las horas no pueden ser negativas').max(24).nullable().optional(),
  precioUnitario: z.number().min(0, 'El precio no puede ser negativo').max(2_000_000).optional(),
})

export type CamposEditables = z.infer<typeof camposEditableSchema>

/**
 * Edita campos de un servicio pendiente sin aprobarlo.
 * Solo admin y jefe_taller — validado por RLS catalogo_servicios_update.
 */
export async function editarServicioPendiente(
  supabase: DbClient,
  id: string,
  campos: CamposEditables,
): Promise<CatalogoServicio> {
  const parsed = camposEditableSchema.safeParse(campos)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { orgId } = await getAuthContext(supabase)
  const { nombre, codigo, descripcion, categoria, horasEstandar, precioUnitario } = parsed.data

  const updates: Record<string, unknown> = {}
  if (nombre !== undefined)          updates.nombre          = nombre
  if (codigo !== undefined)          updates.codigo          = codigo ?? null
  if (descripcion !== undefined)     updates.descripcion     = descripcion ?? null
  if (categoria !== undefined)       updates.categoria       = categoria
  if (horasEstandar !== undefined)   updates.horas_estandar  = horasEstandar ?? null
  if (precioUnitario !== undefined)  updates.precio_unitario = precioUnitario

  if (Object.keys(updates).length === 0) {
    const { data, error } = await supabase
      .from('catalogo_servicios')
      .select(SERVICIO_COLUMNS)
      .eq('id', id)
      .eq('org_id', orgId)
      .eq('requiere_revision', true)
      .single()
    if (error || !data) throw new RlsError('Servicio pendiente no encontrado.')
    return data as CatalogoServicio
  }

  const { data, error } = await supabase
    .from('catalogo_servicios')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('requiere_revision', true)
    .select(SERVICIO_COLUMNS)

  if (error) throw mapPostgrestError(error)
  return unwrapWritten<CatalogoServicio>(data, error)
}

/**
 * Aprueba un servicio pendiente: lo publica en el catálogo oficial.
 * Opcionalmente actualiza campos antes de publicar.
 * Solo admin y jefe_taller — validado por RLS.
 */
export async function aprobarServicio(
  supabase: DbClient,
  id: string,
  campos: CamposEditables = {},
): Promise<CatalogoServicio> {
  const parsed = camposEditableSchema.safeParse(campos)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { orgId } = await getAuthContext(supabase)
  const { nombre, codigo, descripcion, categoria, horasEstandar, precioUnitario } = parsed.data

  const updates: Record<string, unknown> = {
    requiere_revision: false,
    activo: true,
  }
  if (nombre !== undefined)          updates.nombre          = nombre
  if (codigo !== undefined)          updates.codigo          = codigo ?? null
  if (descripcion !== undefined)     updates.descripcion     = descripcion ?? null
  if (categoria !== undefined)       updates.categoria       = categoria
  if (horasEstandar !== undefined)   updates.horas_estandar  = horasEstandar ?? null
  if (precioUnitario !== undefined)  updates.precio_unitario = precioUnitario

  const { data, error } = await supabase
    .from('catalogo_servicios')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('requiere_revision', true)
    .select(SERVICIO_COLUMNS)

  if (error) throw mapPostgrestError(error)
  return unwrapWritten<CatalogoServicio>(data, error)
}

/**
 * Rechaza un servicio pendiente: lo elimina lógicamente.
 * Los items_reparacion que lo referenciaban conservan sus snapshots históricos.
 * Solo admin y jefe_taller — validado por RLS.
 */
export async function rechazarServicio(
  supabase: DbClient,
  id: string,
): Promise<void> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('catalogo_servicios')
    .update({ eliminado_en: new Date().toISOString(), activo: false })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('requiere_revision', true)
    .select('id')

  if (error) throw mapPostgrestError(error)
  if (!data || data.length === 0) {
    throw new RlsError('No se pudo rechazar el servicio. Verifique permisos y que siga pendiente.')
  }
}
