// Listado de clientes. Server Component (lectura con server client + RLS).
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { listClientes } from '@/modules/customers/queries'
import { load } from '@/lib/ui/load'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
import { card } from '@/components/ui/styles'

export default async function CustomersPage() {
  const result = await load(async () => {
    const supabase = await createClient()
    return listClientes(supabase)
  })

  return (
    <div>
      <PageHeader title="Clientes" action={{ href: '/customers/new', label: 'Nuevo cliente' }} />

      {!result.ok ? (
        <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
          {result.isAuth
            ? 'Inicia sesión para ver los clientes.'
            : 'No se pudieron cargar los clientes.'}
        </Notice>
      ) : result.data.length === 0 ? (
        <Notice tone="empty">Aún no hay clientes registrados.</Notice>
      ) : (
        <div className={`${card} overflow-x-auto p-0`}>
          <table className="w-full text-sm">
            <thead className="border-b border-white/[0.06] bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">RUT</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((c) => (
                <tr key={c.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3 text-neutral-100">{c.nombre}</td>
                  <td className="px-4 py-3 text-neutral-400">{c.tipo}</td>
                  <td className="px-4 py-3 text-neutral-400">{c.rut ?? '—'}</td>
                  <td className="px-4 py-3 text-neutral-400">{c.telefono ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
