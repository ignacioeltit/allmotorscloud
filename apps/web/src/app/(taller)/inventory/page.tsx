// Inventario — catálogo de repuestos del taller.
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { listRepuestos, getResumenInventario } from '@/modules/inventory/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { InventarioClient } from '@/components/inventory/InventarioClient'

const PAGE_SIZE = 50

interface Props {
  searchParams: Promise<{ search?: string; page?: string }>
}

export default async function InventarioPage({ searchParams }: Props) {
  const { search = '', page = '1' } = await searchParams
  const currentPage = Math.max(1, parseInt(page, 10) || 1)

  const result = await load(async () => {
    const supabase = await createClient()
    const [{ data: repuestos, total }, resumen] = await Promise.all([
      listRepuestos(supabase, { query: search, page: currentPage, pageSize: PAGE_SIZE }),
      getResumenInventario(supabase),
    ])
    return { repuestos, total, resumen }
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth ? 'Inicia sesión para ver el inventario.' : 'No se pudo cargar el inventario.'}
      </Notice>
    )
  }

  const { repuestos, total, resumen } = result.data
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <InventarioClient
      repuestos={repuestos}
      total={total}
      resumen={resumen}
      currentPage={currentPage}
      pageSize={PAGE_SIZE}
      totalPages={totalPages}
      initialSearch={search}
    />
  )
}
