// Dashboard inicial del taller. Server Component: lee con el server client (RLS).
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listClientes } from '@/modules/customers/queries'
import { listVehiculos } from '@/modules/vehicles/queries'
import { listOrdenesTrabajo } from '@/modules/repair-orders/queries'
import { load } from '@/lib/ui/load'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
import { card, linkClass } from '@/components/ui/styles'

export default async function DashboardPage() {
  const result = await load(async () => {
    const supabase = await createClient()
    const [clientes, vehiculos, ots] = await Promise.all([
      listClientes(supabase, { limit: 100 }),
      listVehiculos(supabase, { limit: 100 }),
      listOrdenesTrabajo(supabase, { limit: 100 }),
    ])
    return {
      clientes: clientes.length,
      vehiculos: vehiculos.length,
      otsActivas: ots.filter((o) => o.cerrado_en === null).length,
    }
  })

  return (
    <div>
      <PageHeader title="Dashboard" />

      {!result.ok ? (
        <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
          {result.isAuth
            ? 'El inicio de sesión aún no está implementado (Auth — Sprint 2 pendiente). Las pantallas son navegables, pero los datos requieren una sesión activa para respetar RLS.'
            : 'No se pudieron cargar los datos.'}
        </Notice>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link href="/customers" className={`${card} block hover:border-brand-300`}>
            <p className="text-sm text-neutral-500">Clientes</p>
            <p className="mt-1 text-3xl font-semibold text-neutral-900">{result.data.clientes}</p>
            <p className={`mt-2 text-sm ${linkClass}`}>Ver clientes →</p>
          </Link>
          <Link href="/vehicles" className={`${card} block hover:border-brand-300`}>
            <p className="text-sm text-neutral-500">Vehículos</p>
            <p className="mt-1 text-3xl font-semibold text-neutral-900">{result.data.vehiculos}</p>
            <p className={`mt-2 text-sm ${linkClass}`}>Ver vehículos →</p>
          </Link>
          <div className={card}>
            <p className="text-sm text-neutral-500">OT activas</p>
            <p className="mt-1 text-3xl font-semibold text-neutral-900">{result.data.otsActivas}</p>
            <p className="mt-2 text-sm text-neutral-400">Órdenes de trabajo sin cerrar</p>
          </div>
        </div>
      )}
    </div>
  )
}
