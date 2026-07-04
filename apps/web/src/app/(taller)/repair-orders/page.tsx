// Listado de órdenes de trabajo con buscador y filtro por estado.
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { listOrdenesTrabajoParaListado } from '@/modules/repair-orders/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { OrdenesTrabajoListClient } from '@/components/repair-orders/OrdenesTrabajoListClient'
import { sectionLabel } from '@/components/ui/styles'

export default async function OrdenesTrabajoPage() {
  const result = await load(async () => {
    const supabase = await createClient()
    const rows = await listOrdenesTrabajoParaListado(supabase)
    return { rows }
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
      <OrdenesTrabajoListClient rows={result.data.rows} />
    </div>
  )
}
