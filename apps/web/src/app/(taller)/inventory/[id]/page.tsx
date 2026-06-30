export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getRepuestoById,
  listMovimientosByRepuesto,
  getUsoEnOts,
} from '@/modules/inventory/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { RepuestoDetailClient } from '@/components/inventory/RepuestoDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function RepuestoDetailPage({ params }: Props) {
  const { id } = await params

  const result = await load(async () => {
    const supabase = await createClient()
    const [repuesto, movimientos, usosEnOts] = await Promise.all([
      getRepuestoById(supabase, id),
      listMovimientosByRepuesto(supabase, id, 20),
      getUsoEnOts(supabase, id, 10),
    ])
    return { repuesto, movimientos, usosEnOts }
  })

  if (!result.ok) {
    if (result.error?.includes('no encontrado') || result.error?.includes('not found')) {
      notFound()
    }
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth ? 'Inicia sesión para ver este repuesto.' : 'No se pudo cargar el repuesto.'}
      </Notice>
    )
  }

  const { repuesto, movimientos, usosEnOts } = result.data

  return (
    <RepuestoDetailClient
      repuesto={repuesto}
      movimientos={movimientos}
      usosEnOts={usosEnOts}
    />
  )
}
