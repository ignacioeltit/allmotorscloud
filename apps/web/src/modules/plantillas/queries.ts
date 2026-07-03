// Lecturas de paquetes de trabajo (plantillas_trabajo + items_plantilla).
// Un paquete se "expande" en líneas listas para cargar en un presupuesto.

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapList } from '@/lib/supabase/result'

export interface PlantillaResumen {
  id: string
  codigo: string | null
  nombre: string
  tipo_precio: string
  precio_cabecera: number | null
}

export interface LineaExpandida {
  grupo: 'mano_obra' | 'repuesto' | 'otros'
  descripcion: string
  cantidad: number
  precio: number
}

/** Fila de items_plantilla para la pantalla de administración. */
export interface ItemPlantilla {
  id: string
  tipo: 'labor' | 'material' | 'other'
  nombre: string
  cantidad: number
  precio_unitario: number | null
  es_cabecera: boolean
  es_checklist: boolean
  orden: number
}

/** Paquete con metadatos para administración (incluye inactivos). */
export interface PlantillaAdmin extends PlantillaResumen {
  descripcion: string | null
  categoria: string | null
  activo: boolean
  n_items: number
}

const PLANTILLA_COLUMNS = 'id, codigo, nombre, tipo_precio, precio_cabecera'

/**
 * Lista los paquetes activos del tenant, opcionalmente filtrando por texto.
 * Excluye paquetes 'suma_items' sin ítems cargados: agregarlos no cargaría
 * nada (silencio confuso), así que no se ofrecen hasta que tengan su surtido.
 */
export async function buscarPlantillas(
  supabase: DbClient,
  query?: string,
): Promise<PlantillaResumen[]> {
  const { orgId } = await getAuthContext(supabase)

  let req = supabase
    .from('plantillas_trabajo')
    .select(PLANTILLA_COLUMNS + ', items_plantilla(count)')
    .eq('org_id', orgId)
    .eq('activo', true)
    .is('eliminado_en', null)
    .order('frecuencia_uso', { ascending: false, nullsFirst: false })
    .limit(20)

  const q = query?.trim()
  if (q) req = req.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%`)

  const { data, error } = await req
  type Row = PlantillaResumen & { items_plantilla: { count: number }[] }
  const rows = unwrapList<Row>(data as Row[] | null, error)
  return rows
    .filter((r) => r.tipo_precio === 'cabecera' || (r.items_plantilla?.[0]?.count ?? 0) > 0)
    .map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      tipo_precio: r.tipo_precio,
      precio_cabecera: r.precio_cabecera,
    }))
}

/** Lista TODOS los paquetes (incluye inactivos y vacíos) para la administración. */
export async function listPlantillasAdmin(supabase: DbClient): Promise<PlantillaAdmin[]> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('plantillas_trabajo')
    .select(PLANTILLA_COLUMNS + ', descripcion, categoria, activo, items_plantilla(count)')
    .eq('org_id', orgId)
    .is('eliminado_en', null)
    .order('nombre')

  type Row = Omit<PlantillaAdmin, 'n_items'> & { items_plantilla: { count: number }[] }
  const rows = unwrapList<Row>(data as Row[] | null, error)
  return rows.map(({ items_plantilla, ...rest }) => ({
    ...rest,
    n_items: items_plantilla?.[0]?.count ?? 0,
  }))
}

/** Un paquete con todos sus ítems, para el detalle de administración. */
export async function getPlantillaConItems(
  supabase: DbClient,
  id: string,
): Promise<{ plantilla: PlantillaAdmin; items: ItemPlantilla[] } | null> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('plantillas_trabajo')
    .select(PLANTILLA_COLUMNS + ', descripcion, categoria, activo')
    .eq('org_id', orgId)
    .eq('id', id)
    .is('eliminado_en', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const { data: itemsData, error: itemsError } = await supabase
    .from('items_plantilla')
    .select('id, tipo, nombre, cantidad, precio_unitario, es_cabecera, es_checklist, orden')
    .eq('plantilla_id', id)
    .order('orden', { ascending: true })
  const items = unwrapList<ItemPlantilla>(itemsData as ItemPlantilla[] | null, itemsError)

  const p = data as unknown as Omit<PlantillaAdmin, 'n_items'>
  return { plantilla: { ...p, n_items: items.length }, items }
}

/**
 * Expande un paquete en líneas listas para el presupuesto: cada ítem del
 * paquete como línea (labor → mano de obra, otro → repuesto/insumo), para que
 * el presupuesto muestre el surtido real (servicios, repuestos, insumos), no
 * solo el nombre del paquete.
 *
 * tipo_precio 'cabecera' (ej: 12PUNTOS): además de los ítems del paquete
 * (el checklist, casi siempre a $0 — son inspecciones incluidas), se antepone
 * una línea de mano de obra cobrable con el precio de cabecera. Así el cliente
 * ve el detalle completo Y se cobra correctamente.
 */
export async function expandirPlantilla(
  supabase: DbClient,
  plantilla: PlantillaResumen,
): Promise<LineaExpandida[]> {
  const { data, error } = await supabase
    .from('items_plantilla')
    .select('tipo, nombre, cantidad, precio_unitario, es_cabecera')
    .eq('plantilla_id', plantilla.id)
    .order('orden', { ascending: true })

  const items = unwrapList<{
    tipo: string
    nombre: string
    cantidad: number | null
    precio_unitario: number | null
    es_cabecera: boolean
  }>(data, error)

  const detalle: LineaExpandida[] = items
    .filter((it) => !it.es_cabecera)
    .map((it) => ({
      grupo:
        it.tipo === 'labor' || it.tipo === 'mano_obra'
          ? ('mano_obra' as const)
          : it.tipo === 'other' || it.tipo === 'otros'
            ? ('otros' as const)
            : ('repuesto' as const),
      descripcion: it.nombre,
      cantidad: it.cantidad ?? 1,
      precio: it.precio_unitario ?? 0,
    }))

  if (plantilla.tipo_precio === 'cabecera') {
    const cabecera: LineaExpandida = {
      grupo: 'mano_obra',
      descripcion: plantilla.nombre,
      cantidad: 1,
      precio: plantilla.precio_cabecera ?? 0,
    }
    return [cabecera, ...detalle]
  }

  return detalle
}
