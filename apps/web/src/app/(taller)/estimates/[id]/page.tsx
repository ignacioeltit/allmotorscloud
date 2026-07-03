// Detalle de una cotización (presupuesto). Si el presupuesto pertenece a una OT,
// redirige a la OT (allí se gestiona). Solo las cotizaciones sueltas se ven aquí.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCotizacionById } from '@/modules/estimates/queries'
import { getOrganizacion } from '@/modules/org/queries'
import { load } from '@/lib/ui/load'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
import { CotizacionDetailClient } from '@/components/estimates/CotizacionDetailClient'

export default async function CotizacionDetailPage({
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

  // Si ya está ligada a una OT, se gestiona desde la OT.
  if (result.data.cotizacion.orden_trabajo_id) {
    redirect(`/repair-orders/${result.data.cotizacion.orden_trabajo_id}`)
  }

  return (
    <div>
      <Link href="/estimates" className="text-sm text-accent-400 hover:text-accent-300">
        ← Presupuestos
      </Link>
      <PageHeader title={`Cotización ${result.data.cotizacion.folio ?? ''}`.trim()} />
      <CotizacionDetailClient
        cotizacion={result.data.cotizacion}
        tallerNombre={result.data.taller?.nombre ?? 'el taller'}
      />
    </div>
  )
}
