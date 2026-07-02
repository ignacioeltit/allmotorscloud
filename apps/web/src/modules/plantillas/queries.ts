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
  grupo: 'mano_obra' | 'repuesto'
  descripcion: string
  cantidad: number
  precio: number
}

const PLANTILLA_COLUMNS = 'id, codigo, nombre, tipo_precio, precio_cabecera'

/** Lista los paquetes activos del tenant, opcionalmente filtrando por texto. */
export async function buscarPlantillas(
  supabase: DbClient,
  query?: string,
): Promise<PlantillaResumen[]> {
  const { orgId } = await getAuthContext(supabase)

  let req = supabase
    .from('plantillas_trabajo')
    .select(PLANTILLA_COLUMNS)
    .eq('org_id', orgId)
    .eq('activo', true)
    .is('eliminado_en', null)
    .order('frecuencia_uso', { ascending: false, nullsFirst: false })
    .limit(20)

  const q = query?.trim()
  if (q) req = req.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%`)

  const { data, error } = await req
  return unwrapList<PlantillaResumen>(data, error)
}

/**
 * Expande un paquete en líneas listas para el presupuesto.
 *  - tipo_precio 'cabecera': una sola línea de mano de obra al precio de cabecera.
 *  - resto: cada ítem del paquete como línea (labor → mano de obra, otro → repuesto).
 */
export async function expandirPlantilla(
  supabase: DbClient,
  plantilla: PlantillaResumen,
): Promise<LineaExpandida[]> {
  const { orgId } = await getAuthContext(supabase)

  if (plantilla.tipo_precio === 'cabecera') {
    return [
      {
        grupo: 'mano_obra',
        descripcion: plantilla.nombre,
        cantidad: 1,
        precio: plantilla.precio_cabecera ?? 0,
      },
    ]
  }

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

  return items
    .filter((it) => !it.es_cabecera)
    .map((it) => ({
      grupo: it.tipo === 'labor' || it.tipo === 'mano_obra' ? 'mano_obra' : 'repuesto',
      descripcion: it.nombre,
      cantidad: it.cantidad ?? 1,
      precio: it.precio_unitario ?? 0,
    }))
}
