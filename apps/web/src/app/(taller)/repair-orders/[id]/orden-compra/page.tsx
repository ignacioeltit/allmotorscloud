// Orden de compra imprimible de una OT (para el encargado de compras).
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrdenTrabajoById } from '@/modules/repair-orders/queries'
import { getVehiculoById } from '@/modules/vehicles/queries'
import { listReparacionesByOT } from '@/modules/reparaciones/queries'
import { getOrganizacion } from '@/modules/org/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { OrdenCompraDocumento } from '@/components/repair-orders/OrdenCompraDocumento'

export default async function OrdenCompraPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const result = await load(async () => {
    const supabase = await createClient()
    const orden = await getOrdenTrabajoById(supabase, id)
    const [vehiculo, reparaciones, taller] = await Promise.all([
      getVehiculoById(supabase, orden.vehiculo_id),
      listReparacionesByOT(supabase, orden.id),
      getOrganizacion(supabase),
    ])
    return { orden, vehiculo, reparaciones, taller }
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth ? 'Inicia sesión para ver la orden de compra.' : 'No se pudo cargar.'}
      </Notice>
    )
  }

  const d = result.data
  return (
    <div>
      <Link href={`/repair-orders/${id}`} className="no-print mb-4 inline-block text-sm text-accent-400 hover:text-accent-300">
        ← Volver a la OT
      </Link>
      <OrdenCompraDocumento orden={d.orden} vehiculo={d.vehiculo} reparaciones={d.reparaciones} taller={d.taller} />
    </div>
  )
}
