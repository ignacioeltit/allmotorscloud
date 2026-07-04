// Finanzas: libro de ingresos y gastos + cuentas por cobrar.
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getResumenFinanzas, listMovimientos, listCuentasPorCobrar, listPorFacturar } from '@/modules/finanzas/queries'
import { load } from '@/lib/ui/load'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
import { FinanzasClient } from '@/components/finanzas/FinanzasClient'

function inicioMes(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}

export default async function FinanzasPage({ searchParams }: Props) {
  const sp = await searchParams
  const desde = sp.desde || inicioMes()
  const hasta = sp.hasta || hoy()

  const result = await load(async () => {
    const supabase = await createClient()
    const [resumen, movimientos, cuentasPorCobrar, porFacturar] = await Promise.all([
      getResumenFinanzas(supabase, desde, hasta),
      listMovimientos(supabase, { desde, hasta }),
      listCuentasPorCobrar(supabase),
      listPorFacturar(supabase),
    ])
    return { resumen, movimientos, cuentasPorCobrar, porFacturar }
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth
          ? 'Inicia sesión para ver finanzas (requiere permisos de admin, jefe de taller o recepción).'
          : 'No se pudieron cargar las finanzas.'}
      </Notice>
    )
  }

  return (
    <div>
      <PageHeader title="Finanzas" />
      <p className="-mt-3 mb-4 text-sm text-neutral-500">
        Ingresos y gastos del taller y cuentas por cobrar. El pago de una OT entrega registra el
        ingreso automáticamente.
      </p>
      <FinanzasClient
        desde={desde}
        hasta={hasta}
        resumen={result.data.resumen}
        movimientos={result.data.movimientos}
        cuentasPorCobrar={result.data.cuentasPorCobrar}
        porFacturar={result.data.porFacturar}
      />
    </div>
  )
}
