// Listado global de presupuestos con búsqueda por N° de OT y paginación.
// Cada presupuesto vive dentro de una OT; esta vista es solo para consultarlos
// transversalmente. El enlace lleva a la OT, donde se editan.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listPresupuestosPaged } from '@/modules/estimates/queries'
import { ESTADO_PRESUPUESTO_LABEL } from '@/modules/estimates/constants'
import type { EstadoPresupuesto } from '@/modules/estimates/constants'
import { load } from '@/lib/ui/load'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
import { BusquedaPaginada } from '@/components/ui/BusquedaPaginada'
import { card } from '@/components/ui/styles'

const PAGE_SIZE = 50

const ESTADO_BADGE: Record<EstadoPresupuesto, string> = {
  borrador: 'border-black/10 bg-black/[0.04] text-neutral-500',
  enviado: 'border-sky-500/30 bg-sky-500/10 text-sky-800',
  autorizado: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800',
  rechazado: 'border-red-500/30 bg-red-500/10 text-red-800',
}

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

interface Props {
  searchParams: Promise<{ search?: string; page?: string }>
}

export default async function EstimatesPage({ searchParams }: Props) {
  const { search = '', page = '1' } = await searchParams
  const currentPage = Math.max(1, parseInt(page, 10) || 1)

  const result = await load(async () => {
    const supabase = await createClient()
    return listPresupuestosPaged(supabase, { query: search, page: currentPage, pageSize: PAGE_SIZE })
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth
          ? 'Inicia sesión para ver los presupuestos.'
          : 'No se pudieron cargar los presupuestos.'}
      </Notice>
    )
  }

  const { data: presupuestos, total } = result.data
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader title="Presupuestos" action={{ href: '/estimates/new', label: 'Nueva cotización' }} />
      <p className="-mt-3 mb-4 text-sm text-neutral-500">
        Cotizaciones (sin OT) y presupuestos de órdenes de trabajo. Crea una cotización para un
        cliente que llama o llega; luego podrás convertirla en OT.
      </p>

      <BusquedaPaginada
        total={total}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        initialSearch={search}
        placeholder="Buscar por folio (PPT3500), N° de OT, patente o cliente…"
      >
        <div className={`${card} overflow-x-auto p-0`}>
          <table className="w-full text-sm">
            <thead className="border-b border-black/[0.06] bg-black/[0.02] text-left text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Origen</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Vehículo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Total neto</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {presupuestos.map((p) => (
                <tr key={p.id} className="border-b border-black/[0.04] transition-colors last:border-0 hover:bg-black/[0.03]">
                  <td className="px-4 py-3 font-medium text-neutral-100">
                    {p.numero_ot ?? p.folio ?? (
                      <span className="inline-flex items-center rounded-full border border-accent-500/30 bg-accent-500/10 px-2.5 py-1 text-xs font-medium text-accent-400">
                        Cotización
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{p.cliente_nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-neutral-400">
                    {p.patente ? (
                      <>
                        <span className="font-medium tracking-wide text-neutral-300">{p.patente}</span>
                        <span className="text-neutral-500"> · {p.marca} {p.modelo}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${ESTADO_BADGE[p.estado]}`}>
                      {ESTADO_PRESUPUESTO_LABEL[p.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-neutral-200">{fmtCLP(p.total_neto)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={p.orden_trabajo_id ? `/repair-orders/${p.orden_trabajo_id}` : `/estimates/${p.id}`}
                      className="text-accent-400 hover:text-accent-300"
                    >
                      {p.orden_trabajo_id ? 'Ver OT →' : 'Ver →'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BusquedaPaginada>
    </div>
  )
}
