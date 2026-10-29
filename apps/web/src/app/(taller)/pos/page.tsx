// POS mostrador: venta directa de repuestos/productos sin OT.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { listVentasMostrador } from '@/modules/ventas-mostrador/queries'
import { METODO_PAGO_LABEL } from '@/modules/ventas-mostrador/constants'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { PosClient } from '@/components/pos/PosClient'
import { card, sectionLabel } from '@/components/ui/styles'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

export default async function PosPage() {
  const result = await load(async () => {
    const supabase = await createClient()
    const { rol } = await getAuthContext(supabase)
    if (!(rol === 'admin' || rol === 'jefe_taller' || rol === 'recepcionista')) {
      throw Object.assign(new Error('Sin permiso para el mostrador.'), { isAuth: true })
    }
    const ventas = await listVentasMostrador(supabase, 15)
    return { ventas }
  })

  if (!result.ok) {
    return (
      <div>
        <PageHeader title="Mostrador" />
        <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
          {result.isAuth ? 'El mostrador está disponible para admin, jefe de taller o recepción.' : 'No se pudo cargar el mostrador.'}
        </Notice>
      </div>
    )
  }

  const { ventas } = result.data

  return (
    <div className="space-y-8">
      <header>
        <p className={sectionLabel}>Punto de venta</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-50">Mostrador</h1>
        <p className="mt-1 text-sm text-neutral-500">Venta directa de repuestos y productos. Descuenta stock y registra el ingreso.</p>
      </header>

      <PosClient />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-200">Ventas recientes</h2>
        </div>
        {ventas.length === 0 ? (
          <p className="text-sm text-neutral-500">Aún no hay ventas de mostrador.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/[0.06]">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="bg-black/[0.03] text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5">Folio</th>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-4 py-2.5">Pago</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {ventas.map((v) => (
                  <tr key={v.id} className="hover:bg-black/[0.02]">
                    <td className="px-4 py-2.5">
                      <Link href={`/pos/${v.id}`} className="font-medium text-accent-400 hover:text-accent-300">#{v.folio}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-400">{new Date(v.creado_en).toLocaleDateString('es-CL')}</td>
                    <td className="px-4 py-2.5 text-neutral-300">{v.cliente_nombre ?? 'Venta de paso'}</td>
                    <td className="px-4 py-2.5 text-neutral-400">{METODO_PAGO_LABEL[v.metodo_pago] ?? v.metodo_pago}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-neutral-100">{fmtCLP(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={card}>
        <p className="text-xs text-neutral-500">
          ¿Vas a cobrar trabajos de un vehículo? Eso se hace desde la OT (pestaña «Entrega y cobro»), no desde el mostrador.
        </p>
      </section>
    </div>
  )
}
