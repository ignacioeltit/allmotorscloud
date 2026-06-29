// GET /api/vehiculos/enriquecer?patente=XXXXXX
//
// Consulta datos vehiculares en el proveedor externo configurado (server-only).
// - Requiere sesión válida (Supabase Auth). 401 si no hay sesión.
// - NO usa service_role. NO expone tokens del proveedor al cliente.
// - Devuelve EnrichmentResult: { found:true, source, data } | { found:false, reason }.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichVehicleByPlate } from '@/lib/enrichment'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Sesión obligatoria: getUser valida el JWT contra Supabase Auth.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ found: false, reason: 'unauthorized' }, { status: 401 })
  }

  const patente = new URL(request.url).searchParams.get('patente') ?? ''
  const result = await enrichVehicleByPlate(patente)

  return NextResponse.json(result, { status: 200 })
}
