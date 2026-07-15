// Ficha del cliente: datos de contacto + vehículos asociados (propiedad activa).
// Server Component (lectura con server client + RLS).
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getClienteById, listVehiculosByCliente } from '@/modules/customers/queries'
import { TIPO_CLIENTE_LABEL } from '@/modules/customers/constants'
import { load } from '@/lib/ui/load'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
import { card, badge, linkClass } from '@/components/ui/styles'

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-neutral-600">{label}</p>
      <p className="mt-0.5 text-neutral-200">{value}</p>
    </div>
  )
}

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const result = await load(async () => {
    const supabase = await createClient()
    const cliente = await getClienteById(supabase, id)
    const vehiculos = await listVehiculosByCliente(supabase, id)
    return { cliente, vehiculos }
  })

  if (!result.ok) {
    return (
      <div>
        <PageHeader title="Ficha del cliente" />
        <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
          {result.isAuth
            ? 'Inicia sesión para ver la ficha del cliente.'
            : 'No se pudo cargar el cliente.'}
        </Notice>
        <p className="mt-4">
          <Link href="/customers" className={linkClass}>
            ← Volver a clientes
          </Link>
        </p>
      </div>
    )
  }

  const { cliente, vehiculos } = result.data

  return (
    <div className="space-y-8">
      <div>
        <Link href="/customers" className={`${linkClass} text-sm`}>
          ← Clientes
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-neutral-50">{cliente.nombre}</h1>
          <span className={badge}>{TIPO_CLIENTE_LABEL[cliente.tipo]}</span>
        </div>
      </div>

      {/* Datos de contacto */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">Datos de contacto</h2>
        <div className={`${card} grid grid-cols-2 gap-4 text-sm sm:grid-cols-3`}>
          <Info label="RUT" value={cliente.rut ?? '—'} />
          <Info label="Teléfono" value={cliente.telefono ?? '—'} />
          <Info label="Email" value={cliente.email ?? '—'} />
          <Info label="Dirección" value={cliente.direccion ?? '—'} />
        </div>
        {cliente.notas ? (
          <div className={`${card} mt-3`}>
            <p className="text-[11px] uppercase tracking-wider text-neutral-600">Notas</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-300">{cliente.notas}</p>
          </div>
        ) : null}
      </section>

      {/* Vehículos asociados */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-100">
            Vehículos {vehiculos.length > 0 ? `(${vehiculos.length})` : ''}
          </h2>
          <Link
            href={`/vehicles/new?cliente=${cliente.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-500"
          >
            ➕ Agregar vehículo
          </Link>
        </div>

        {vehiculos.length === 0 ? (
          <Notice tone="empty">Este cliente no tiene vehículos asociados.</Notice>
        ) : (
          <ul className="space-y-2">
            {vehiculos.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/vehicles/${v.id}`}
                  className={`${card} block transition-colors hover:border-black/[0.14]`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-neutral-100">
                      {v.patente} — {v.marca} {v.modelo}
                    </p>
                    <span className={badge}>{v.tipo}</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-600">
                    {v.anio ?? '—'}
                    {v.color ? ` · ${v.color}` : ''}
                    {v.km_actual != null ? ` · ${v.km_actual.toLocaleString('es-CL')} km` : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
