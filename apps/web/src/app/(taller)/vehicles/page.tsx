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
            ? 'Inicia sesión para ver los vehículos (Auth — Sprint 2 pendiente).'
            : 'No se pudieron cargar los vehículos.'}
        </Notice>
      ) : result.data.length === 0 ? (
        <Notice tone="empty">Aún no hay vehículos registrados.</Notice>
      ) : (
        <div className={`${card} overflow-x-auto p-0`}>
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Patente</th>
                <th className="px-4 py-2 font-medium">Marca</th>
                <th className="px-4 py-2 font-medium">Modelo</th>
                <th className="px-4 py-2 font-medium">Año</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((v) => (
                <tr key={v.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-neutral-900">{v.patente}</td>
                  <td className="px-4 py-2 text-neutral-600">{v.marca}</td>
                  <td className="px-4 py-2 text-neutral-600">{v.modelo}</td>
                  <td className="px-4 py-2 text-neutral-600">{v.anio ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
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
