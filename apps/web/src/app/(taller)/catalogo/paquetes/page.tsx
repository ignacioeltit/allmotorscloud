// Administración de paquetes de trabajo (plantillas): surtidos pre-armados de
// servicios/repuestos/insumos que se cargan de una vez a presupuestos y OTs.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listPlantillasAdmin } from '@/modules/plantillas/queries'
import { load } from '@/lib/ui/load'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
import { PaquetesClient } from '@/components/catalogo/PaquetesClient'

export default async function PaquetesPage() {
  const result = await load(async () => {
    const supabase = await createClient()
    return listPlantillasAdmin(supabase)
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth ? 'Inicia sesión para ver los paquetes.' : 'No se pudieron cargar los paquetes.'}
      </Notice>
    )
  }

  return (
    <div>
      <Link href="/catalogo" className="mb-4 inline-block text-sm text-accent-400 hover:text-accent-300">
        ← Catálogo
      </Link>
      <PageHeader title="Paquetes de trabajo" />
      <p className="-mt-3 mb-4 text-sm text-neutral-500">
        Un paquete es un presupuesto pre-armado: un surtido de servicios, repuestos e insumos que
        se carga completo a cualquier presupuesto u OT con «+ Agregar paquete». Los paquetes sin
        ítems no aparecen en ese selector hasta que les cargues su surtido.
      </p>
      <PaquetesClient paquetes={result.data} />
    </div>
  )
}
