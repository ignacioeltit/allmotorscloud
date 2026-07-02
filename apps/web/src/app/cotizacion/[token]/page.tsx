// Página pública de una cotización (sin login). Accedida por token vía enlace
// compartido. Toda lectura/escritura pasa por RPCs SECURITY DEFINER gatilladas
// por el token; no hay acceso directo a las tablas.
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import {
  CotizacionPublicaClient,
  type CotizacionPublica,
} from '@/components/estimates/CotizacionPublicaClient'

export default async function CotizacionPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  let coti: CotizacionPublica | null = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.rpc('fn_cotizacion_publica', { p_token: token })
    const res = data as (CotizacionPublica & { error?: string }) | null
    if (res && !res.error) coti = res
  } catch {
    coti = null
  }

  if (!coti) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-neutral-800">Cotización no disponible</h1>
        <p className="mt-2 text-sm text-neutral-500">
          El enlace no es válido o la cotización ya no está disponible. Contacta al taller.
        </p>
      </div>
    )
  }

  return <CotizacionPublicaClient token={token} inicial={coti} />
}
