// Layout del ERP del taller. El middleware protege estas rutas; RLS protege los datos.
// Lee el conteo de pendientes de catálogo en server para pasarlo al sidebar.
export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/shell/AppShell'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { contarServiciosPendientes } from '@/modules/catalogo/queries'

export default async function TallerLayout({ children }: { children: React.ReactNode }) {
  let pendientesCatalogo = 0
  let rolUsuario: string | undefined
  try {
    const supabase = await createClient()
    const ctx = await getAuthContext(supabase)
    rolUsuario = ctx.rol ?? undefined
    if (ctx.rol === 'admin' || ctx.rol === 'jefe_taller') {
      pendientesCatalogo = await contarServiciosPendientes(supabase)
    }
  } catch {
    // Sesión inválida — el middleware redirigirá. No bloquear el render del layout.
  }

  return <AppShell pendientesCatalogo={pendientesCatalogo} rolUsuario={rolUsuario}>{children}</AppShell>
}
