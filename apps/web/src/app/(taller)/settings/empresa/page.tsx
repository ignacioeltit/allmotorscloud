export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { getOrganizacion } from '@/modules/org/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { EmpresaSettingsClient } from '@/components/settings/EmpresaSettingsClient'

export default async function EmpresaSettingsPage() {
  const result = await load(async () => {
    const supabase = await createClient()
    const ctx = await getAuthContext(supabase)
    if (ctx.rol !== 'admin') return { unauthorized: true, org: null }
    const org = await getOrganizacion(supabase)
    return { unauthorized: false, org }
  })

  if (!result.ok) {
    if (result.isAuth) redirect('/login')
    return (
      <Notice tone="error" title={result.error}>
        No se pudieron cargar los datos de la empresa.
      </Notice>
    )
  }

  const { unauthorized, org } = result.data

  if (unauthorized || !org) {
    return (
      <Notice tone="warning" title="Acceso restringido">
        Solo el administrador puede editar los datos de la empresa.
      </Notice>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-50">Datos de la empresa</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Nombre, RUT, contacto y logo. Aparecen en la cabecera de cotizaciones, OT y comprobantes.
        </p>
      </div>
      <EmpresaSettingsClient initial={org} />
    </div>
  )
}
