// Lectura de los datos de la organización (taller) del tenant, para encabezados
// de documentos (cotizaciones, presupuestos, OTs).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'

export interface OrganizacionInfo {
  nombre: string
  rut: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  ciudad: string | null
  logo_url: string | null
}

export async function getOrganizacion(supabase: DbClient): Promise<OrganizacionInfo | null> {
  const { orgId } = await getAuthContext(supabase)
  const { data } = await supabase
    .from('organizaciones')
    .select('nombre, rut, telefono, email, direccion, ciudad, logo_url')
    .eq('id', orgId)
    .maybeSingle()
  return (data as OrganizacionInfo) ?? null
}
