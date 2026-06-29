// Inventario — catálogo de repuestos del taller.
// Vista: listado + búsqueda + crear/editar.
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { listRepuestos } from '@/modules/inventory/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { InventarioClient } from '@/components/inventory/InventarioClient'

export default async function InventarioPage() {
  const result = await load(async () => {
    const supabase = await createClient()
    const repuestos = await listRepuestos(supabase, { limit: 100 })
    return { repuestos }
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth ? 'Inicia sesión para ver el inventario.' : 'No se pudo cargar el inventario.'}
      </Notice>
    )
  }

  return <InventarioClient initialRepuestos={result.data.repuestos} />
}
