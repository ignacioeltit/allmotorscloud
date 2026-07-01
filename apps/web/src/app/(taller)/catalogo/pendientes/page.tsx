export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { listarServiciosPendientes } from '@/modules/catalogo/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { PendientesClient } from '@/components/catalogo/PendientesClient'
import {
  CATEGORIAS_CATALOGO,
  CATEGORIA_LABEL,
} from '@/modules/catalogo/constants'
import type { CatalogoServicio } from '@/modules/catalogo/types'

interface Props {
  searchParams: Promise<{ search?: string; categoria?: string }>
}

export default async function PendientesPage({ searchParams }: Props) {
  const { search = '', categoria = '' } = await searchParams

  const result = await load(async () => {
    const supabase = await createClient()
    const ctx = await getAuthContext(supabase)

    if (ctx.rol !== 'admin' && ctx.rol !== 'jefe_taller') {
      return { unauthorized: true, pendientes: [] as CatalogoServicio[] }
    }

    const pendientes = await listarServiciosPendientes(supabase, {
      query: search || undefined,
      categoria: categoria || undefined,
    })

    return { unauthorized: false, pendientes }
  })

  if (!result.ok) {
    if (result.isAuth) redirect('/login')
    return (
      <Notice tone="error" title={result.error}>
        No se pudo cargar la cola de revisión.
      </Notice>
    )
  }

  const { unauthorized, pendientes } = result.data

  if (unauthorized) {
    return (
      <div>
        <div className="mb-6">
          <Link href="/catalogo" className="text-sm text-neutral-500 transition-colors hover:text-neutral-300">
            ← Catálogo
          </Link>
        </div>
        <Notice tone="warning" title="Acceso restringido">
          Solo administradores y jefes de taller pueden revisar servicios pendientes.
        </Notice>
      </div>
    )
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="mb-6">
        <div className="mb-1">
          <Link
            href="/catalogo"
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-300"
          >
            ← Catálogo
          </Link>
        </div>
        <h1 className="text-xl font-semibold text-neutral-50">Pendientes de revisión</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          {pendientes.length === 0
            ? 'No hay servicios pendientes'
            : `${pendientes.length} ${pendientes.length === 1 ? 'servicio requiere revisión' : 'servicios requieren revisión'}`}
        </p>
      </div>

      {/* Filtros — form GET, no necesita JS */}
      <form method="get" className="mb-5 flex flex-wrap gap-3">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Buscar por nombre..."
          className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-neutral-950/60 px-3.5 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-accent-500/60 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
        />
        <select
          name="categoria"
          defaultValue={categoria}
          className="rounded-lg border border-white/10 bg-neutral-950/60 px-3.5 py-2 text-sm text-neutral-300 focus:border-accent-500/60 focus:outline-none"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS_CATALOGO.map((c) => (
            <option key={c} value={c}>
              {CATEGORIA_LABEL[c]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/[0.07]"
        >
          Filtrar
        </button>
        {(search || categoria) && (
          <Link
            href="/catalogo/pendientes"
            className="rounded-lg px-3 py-2 text-sm text-neutral-500 transition-colors hover:text-neutral-300"
          >
            Limpiar
          </Link>
        )}
      </form>

      {/* Lista interactiva delegada al client component */}
      <PendientesClient initialPendientes={pendientes} />
    </div>
  )
}
