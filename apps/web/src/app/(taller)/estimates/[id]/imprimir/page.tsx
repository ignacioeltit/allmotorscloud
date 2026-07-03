// Vista imprimible / PDF de una cotización (suelta o dentro de una OT — ambas
// se pueden imprimir/compartir desde aquí; "Volver" apunta a donde se gestiona
// cada una).
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCotizacionById } from '@/modules/estimates/queries'
import { getOrganizacion } from '@/modules/org/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { CotizacionDocumento } from '@/components/estimates/CotizacionDocumento'

export default async function ImprimirCotizacionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const result = await load(async () => {
    const supabase = await createClient()
    const [cotizacion, taller] = await Promise.all([
      getCotizacionById(supabase, id),
      getOrganizacion(supabase),
    ])
    return { cotizacion, taller }
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth ? 'Inicia sesión para ver la cotización.' : 'No se pudo cargar la cotización.'}
      </Notice>
    )
  }

  if (!result.data.cotizacion) {
    return <Notice tone="warning" title="Cotización no encontrada" />
  }

  const volverHref = result.data.cotizacion.orden_trabajo_id
    ? `/repair-orders/${result.data.cotizacion.orden_trabajo_id}`
    : `/estimates/${id}`

  return (
    <div>
      <Link href={volverHref} className="no-print mb-4 inline-block text-sm text-accent-400 hover:text-accent-300">
        ← Volver {result.data.cotizacion.orden_trabajo_id ? 'a la OT' : 'a la cotización'}
      </Link>
      <CotizacionDocumento cotizacion={result.data.cotizacion} taller={result.data.taller} />
    </div>
  )
}
