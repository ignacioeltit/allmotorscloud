// Vista imprimible de la Orden de Trabajo (para entregar al mecánico).
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrdenTrabajoById } from '@/modules/repair-orders/queries'
import { getVehiculoById } from '@/modules/vehicles/queries'
import { getPropietarioActivoByVehiculo } from '@/modules/customers/queries'
import { listReparacionesByOT } from '@/modules/reparaciones/queries'
import { getPresupuestoActivoByOT } from '@/modules/estimates/queries'
import { listMecanicosByOrg } from '@/modules/users/queries'
import { getOrganizacion } from '@/modules/org/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { OtDocumento } from '@/components/repair-orders/OtDocumento'

export default async function ImprimirOtPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const result = await load(async () => {
    const supabase = await createClient()
    const orden = await getOrdenTrabajoById(supabase, id)
    const [vehiculo, cliente, reparaciones, presupuesto, taller, mecanicos] = await Promise.all([
      getVehiculoById(supabase, orden.vehiculo_id),
      getPropietarioActivoByVehiculo(supabase, orden.vehiculo_id),
      listReparacionesByOT(supabase, orden.id),
      getPresupuestoActivoByOT(supabase, orden.id),
      getOrganizacion(supabase),
      listMecanicosByOrg(supabase),
    ])
    return { orden, vehiculo, cliente, reparaciones, presupuesto, taller, mecanicos }
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth ? 'Inicia sesión para ver la OT.' : 'No se pudo cargar la OT.'}
      </Notice>
    )
  }

  const d = result.data
  return (
    <div>
      <Link href={`/repair-orders/${id}`} className="no-print mb-4 inline-block text-sm text-accent-400 hover:text-accent-300">
        ← Volver a la OT
      </Link>
      <OtDocumento
        orden={d.orden}
        vehiculo={d.vehiculo}
        cliente={d.cliente}
        reparaciones={d.reparaciones}
        presupuesto={d.presupuesto}
        taller={d.taller}
        mecanicos={d.mecanicos}
      />
    </div>
  )
}
