// Comprobante de entrega imprimible de una OT.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrdenTrabajoById } from '@/modules/repair-orders/queries'
import { getVehiculoById } from '@/modules/vehicles/queries'
import { getPropietarioActivoByVehiculo } from '@/modules/customers/queries'
import { listReparacionesByOT } from '@/modules/reparaciones/queries'
import { getOrganizacion } from '@/modules/org/queries'
import { getEntregaByOT, getTotalesOT } from '@/modules/entregas/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { ComprobanteEntrega } from '@/components/repair-orders/ComprobanteEntrega'

export default async function ComprobantePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const result = await load(async () => {
    const supabase = await createClient()
    const orden = await getOrdenTrabajoById(supabase, id)
    const [vehiculo, cliente, reparaciones, taller, entrega, totales] = await Promise.all([
      getVehiculoById(supabase, orden.vehiculo_id),
      getPropietarioActivoByVehiculo(supabase, orden.vehiculo_id),
      listReparacionesByOT(supabase, orden.id),
      getOrganizacion(supabase),
      getEntregaByOT(supabase, orden.id),
      getTotalesOT(supabase, orden.id),
    ])
    return { orden, vehiculo, cliente, reparaciones, taller, entrega, totales }
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth ? 'Inicia sesión para ver el comprobante.' : 'No se pudo cargar el comprobante.'}
      </Notice>
    )
  }

  const d = result.data
  return (
    <div>
      <Link href={`/repair-orders/${id}`} className="no-print mb-4 inline-block text-sm text-accent-400 hover:text-accent-300">
        ← Volver a la OT
      </Link>
      <ComprobanteEntrega
        orden={d.orden}
        vehiculo={d.vehiculo}
        cliente={d.cliente}
        reparaciones={d.reparaciones}
        taller={d.taller}
        entrega={d.entrega}
        totales={d.totales}
      />
    </div>
  )
}
