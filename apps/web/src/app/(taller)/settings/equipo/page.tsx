// Equipo del taller: listado de usuarios y alta de mecánicos (solo asignación,
// sin cuenta de acceso). Los mecánicos creados aquí aparecen en el selector
// "Mecánico asignado" de los trabajos de la OT.
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { listEquipo } from '@/modules/users/queries'
import { load } from '@/lib/ui/load'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
import { EquipoClient } from '@/components/settings/EquipoClient'

export default async function EquipoPage() {
  const result = await load(async () => {
    const supabase = await createClient()
    return listEquipo(supabase)
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth ? 'Inicia sesión para ver el equipo.' : 'No se pudo cargar el equipo.'}
      </Notice>
    )
  }

  return (
    <div>
      <PageHeader title="Equipo" />
      <p className="-mt-3 mb-4 text-sm text-neutral-500">
        Mecánicos y usuarios del taller. Los mecánicos que agregues aquí aparecen en el selector
        «Mecánico asignado» al crear un trabajo en la OT (no tienen acceso a la app).
      </p>
      <EquipoClient equipo={result.data} />
    </div>
  )
}
