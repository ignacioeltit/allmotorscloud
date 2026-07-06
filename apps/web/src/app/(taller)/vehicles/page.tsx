// Listado de vehículos con búsqueda server-side y paginación (?search=&page=).
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listVehiculosPaged } from '@/modules/vehicles/queries'
import { load } from '@/lib/ui/load'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
import { BusquedaPaginada } from '@/components/ui/BusquedaPaginada'
import { card, linkClass } from '@/components/ui/styles'

const PAGE_SIZE = 50

interface Props {
  searchParams: Promise<{ search?: string; page?: string }>
}

export default async function VehiclesPage({ searchParams }: Props) {
  const { search = '', page = '1' } = await searchParams
  const currentPage = Math.max(1, parseInt(page, 10) || 1)

  const result = await load(async () => {
    const supabase = await createClient()
    return listVehiculosPaged(supabase, { query: search, page: currentPage, pageSize: PAGE_SIZE })
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth
          ? 'Inicia sesión para ver los vehículos.'
          : 'No se pudieron cargar los vehículos.'}
      </Notice>
    )
  }

  const { data: vehiculos, total } = result.data
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader title="Vehículos" action={{ href: '/vehicles/new', label: 'Nuevo vehículo' }} />

      <BusquedaPaginada
        total={total}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        initialSearch={search}
        placeholder="Buscar por patente, VIN, marca o modelo…"
      >
        {/* Escritorio: tabla */}
        <div className={`${card} hidden overflow-x-auto p-0 md:block`}>
          <table className="w-full text-sm">
            <thead className="border-b border-black/[0.06] bg-black/[0.02] text-left text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Patente</th>
                <th className="px-4 py-3 font-medium">Marca</th>
                <th className="px-4 py-3 font-medium">Modelo</th>
                <th className="px-4 py-3 font-medium">Año</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {vehiculos.map((v) => (
                <tr key={v.id} className="border-b border-black/[0.04] last:border-0">
                  <td className="px-4 py-3 font-medium tracking-wide text-neutral-50">{v.patente}</td>
                  <td className="px-4 py-3 text-neutral-400">{v.marca}</td>
                  <td className="px-4 py-3 text-neutral-400">{v.modelo}</td>
                  <td className="px-4 py-3 text-neutral-400">{v.anio ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/vehicles/${v.id}`} className={linkClass}>
                      Ver ficha →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Móvil: cards */}
        <div className="space-y-2 md:hidden">
          {vehiculos.map((v) => (
            <Link key={v.id} href={`/vehicles/${v.id}`} className={`${card} block active:bg-black/[0.04]`}>
              <p className="font-semibold tracking-wide text-neutral-50">{v.patente}</p>
              <p className="mt-0.5 text-sm text-neutral-400">
                {[v.marca, v.modelo, v.anio].filter(Boolean).join(' · ')}
              </p>
            </Link>
          ))}
        </div>
      </BusquedaPaginada>
    </div>
  )
}
