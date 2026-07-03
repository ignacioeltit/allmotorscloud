// Detalle de un paquete de trabajo: editar datos y administrar su surtido de
// servicios/repuestos/insumos.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getPlantillaConItems } from '@/modules/plantillas/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { PaqueteDetalleClient } from '@/components/catalogo/PaqueteDetalleClient'

export default async function PaqueteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const result = await load(async () => {
    const supabase = await createClient()
    return getPlantillaConItems(supabase, id)
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth ? 'Inicia sesión para ver el paquete.' : 'No se pudo cargar el paquete.'}
      </Notice>
    )
  }

  if (!result.data) {
    return <Notice tone="warning" title="Paquete no encontrado" />
  }

  return (
    <div>
      <Link href="/catalogo/paquetes" className="mb-4 inline-block text-sm text-accent-400 hover:text-accent-300">
        ← Paquetes
      </Link>
      <PaqueteDetalleClient plantilla={result.data.plantilla} items={result.data.items} />
    </div>
  )
}
