export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { getConfiguracionManoObra } from '@/modules/taller/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { WorkshopSettingsClient } from '@/components/settings/WorkshopSettingsClient'

export default async function WorkshopSettingsPage() {
  const result = await load(async () => {
    const supabase = await createClient()
    const ctx = await getAuthContext(supabase)

    if (ctx.rol !== 'admin' && ctx.rol !== 'jefe_taller') {
      return { unauthorized: true, config: null }
    }

    const config = await getConfiguracionManoObra(supabase)
    return { unauthorized: false, config }
  })

  if (!result.ok) {
    if (result.isAuth) redirect('/login')
    return (
      <Notice tone="error" title={result.error}>
        No se pudo cargar la configuración del taller.
      </Notice>
    )
  }

  const { unauthorized, config } = result.data

  if (unauthorized || !config) {
    return (
      <Notice tone="warning" title="Acceso restringido">
        Solo administradores y jefes de taller pueden editar esta configuración.
      </Notice>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-50">Configuración del taller</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Tarifas hora y precios base usados para calcular el costo de mano de obra en las OT.
        </p>
      </div>

      <WorkshopSettingsClient initialConfig={config} />
    </div>
  )
}
