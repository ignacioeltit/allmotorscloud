// Listado de órdenes de trabajo con búsqueda server-side y paginación.
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { buscarOrdenesTrabajo } from '@/modules/repair-orders/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { OrdenesTrabajoListClient } from '@/components/repair-orders/OrdenesTrabajoListClient'
import { sectionLabel } from '@/components/ui/styles'

const PAGE_SIZE = 50

export default async function OrdenesTrabajoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = sp.q ?? ''
  const estado = sp.estado ?? 'todas'
  const page = Math.max(1, Number(sp.page) || 1)

  const result = await load(async () => {
    const supabase = await createClient()
    const { rows, total } = await buscarOrdenesTrabajo(supabase, {
      q,
      estado,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
    return { rows, total }
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth ? 'Inicia sesión para ver las órdenes.' : 'No se pudieron cargar las órdenes.'}
      </Notice>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <p className={sectionLabel}>Órdenes de trabajo</p>
        <p className="mt-1 text-sm text-neutral-500">
          Todas las OT del taller — abiertas, entregadas y cerradas.
        </p>
      </div>
      <OrdenesTrabajoListClient
        rows={result.data.rows}
        total={result.data.total}
        q={q}
        estado={estado}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </div>
  )
}
