// Listado de vehículos. Server Component (lectura con server client + RLS).
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listVehiculos } from '@/modules/vehicles/queries'
import { load } from '@/lib/ui/load'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
import { card, linkClass } from '@/components/ui/styles'

export default async function VehiclesPage() {
  const result = await load(async () => {
    const supabase = await createClient()
    return listVehiculos(supabase)
  })

  return (
    <div>
      <PageHeader title="Vehículos" action={{ href: '/vehicles/new', label: 'Nuevo vehículo' }} />

      {!result.ok ? (
        <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
          {result.isAuth
            ? 'Inicia sesión para ver los vehículos.'
            : 'No se pudieron cargar los vehículos.'}
        </Notice>
      ) : result.data.length === 0 ? (
        <Notice tone="empty">Aún no hay vehículos registrados.</Notice>
      ) : (
        <div className={`${card} overflow-x-auto p-0`}>
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
              {result.data.map((v) => (
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
      )}
    </div>
  )
}
