// Comprobante de una venta de mostrador.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getVentaMostradorById } from '@/modules/ventas-mostrador/queries'
import { getOrganizacion } from '@/modules/org/queries'
import { METODO_PAGO_LABEL } from '@/modules/ventas-mostrador/constants'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { ImprimirVentaBtn } from '@/components/pos/ImprimirVentaBtn'
import { linkClass } from '@/components/ui/styles'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

export default async function VentaMostradorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const result = await load(async () => {
    const supabase = await createClient()
    const [venta, taller] = await Promise.all([
      getVentaMostradorById(supabase, id),
      getOrganizacion(supabase),
    ])
    if (!venta) throw new Error('Venta no encontrada.')
    return { venta, taller }
  })

  if (!result.ok) {
    return (
      <div>
        <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
          No se pudo cargar la venta.
        </Notice>
        <p className="mt-4"><Link href="/pos" className={linkClass}>← Volver al mostrador</Link></p>
      </div>
    )
  }

  const { venta, taller } = result.data

  return (
    <div className="space-y-5">
      <div className="no-print flex items-center justify-between">
        <Link href="/pos" className={`${linkClass} text-sm`}>← Mostrador</Link>
        <ImprimirVentaBtn />
      </div>

      <div className="mx-auto max-w-xl rounded-xl border border-black/[0.08] bg-neutral-900 p-6">
        <div className="flex items-start justify-between gap-4 border-b border-black/[0.08] pb-4">
          <div>
            <p className="text-lg font-semibold text-neutral-50">{taller?.nombre ?? 'Taller'}</p>
            <p className="text-xs text-neutral-500">Comprobante de venta — mostrador</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-neutral-50">#{venta.folio}</p>
            <p className="text-xs text-neutral-500">{new Date(venta.creado_en).toLocaleString('es-CL')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 py-4 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-500">Cliente</p>
            <p className="mt-0.5 text-neutral-200">{venta.cliente_nombre ?? 'Venta de paso'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-500">Método de pago</p>
            <p className="mt-0.5 text-neutral-200">{METODO_PAGO_LABEL[venta.metodo_pago] ?? venta.metodo_pago}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="border-y border-black/[0.08] text-left text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="py-2">Detalle</th>
              <th className="py-2 text-center">Cant.</th>
              <th className="py-2 text-right">P. unit.</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {venta.items.map((it) => (
              <tr key={it.id}>
                <td className="py-2 text-neutral-200">{it.descripcion}</td>
                <td className="py-2 text-center text-neutral-400">{it.cantidad}</td>
                <td className="py-2 text-right text-neutral-400">{fmtCLP(it.precio_unitario)}</td>
                <td className="py-2 text-right font-medium text-neutral-100">{fmtCLP(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-56 space-y-1 text-sm">
          <div className="flex justify-between text-neutral-500"><span>Neto</span><span>{fmtCLP(venta.subtotal_neto)}</span></div>
          <div className="flex justify-between text-neutral-500"><span>IVA (19%)</span><span>{fmtCLP(venta.iva)}</span></div>
          <div className="flex justify-between border-t border-black/[0.08] pt-1 text-base font-bold text-neutral-50"><span>Total</span><span>{fmtCLP(venta.total)}</span></div>
        </div>

        {venta.notas && (
          <p className="mt-4 border-t border-black/[0.06] pt-3 text-xs text-neutral-500">Nota: {venta.notas}</p>
        )}
      </div>
    </div>
  )
}
