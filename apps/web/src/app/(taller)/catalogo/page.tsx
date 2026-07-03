export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { listarServiciosCatalogo, contarServiciosPendientes } from '@/modules/catalogo/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'
import { sectionLabel } from '@/components/ui/styles'
import {
  CATEGORIA_LABEL,
  CATEGORIA_COLOR,
  CATEGORIAS_CATALOGO,
} from '@/modules/catalogo/constants'
import type { CategoriaCatalogo } from '@/modules/catalogo/constants'
import type { CatalogoServicio } from '@/modules/catalogo/types'

const PAGE_SIZE = 50

interface Props {
  searchParams: Promise<{ search?: string; categoria?: string; page?: string }>
}

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function CategoriaBadge({ categoria }: { categoria: string | null }) {
  const cat = categoria as CategoriaCatalogo | null
  const label = cat && CATEGORIA_LABEL[cat] ? CATEGORIA_LABEL[cat] : (categoria ?? '—')
  const color = cat && CATEGORIA_COLOR[cat] ? CATEGORIA_COLOR[cat] : 'border-black/10 bg-black/[0.04] text-neutral-500'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${color}`}>
      {label}
    </span>
  )
}

function ServicioRow({ s }: { s: CatalogoServicio }) {
  return (
    <tr className="border-t border-black/[0.05] transition-colors hover:bg-black/[0.02]">
      <td className="px-4 py-3 font-mono text-xs text-neutral-500">{s.codigo ?? '—'}</td>
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-neutral-100">{s.nombre}</span>
        {s.es_checklist && (
          <span className="ml-2 text-[10px] text-neutral-600">checklist</span>
        )}
      </td>
      <td className="px-4 py-3"><CategoriaBadge categoria={s.categoria} /></td>
      <td className="px-4 py-3 text-right text-sm tabular-nums text-neutral-400">
        {s.horas_estandar != null ? `${s.horas_estandar}h` : '—'}
      </td>
      <td className="px-4 py-3 text-right text-sm tabular-nums text-neutral-200">
        {fmtCLP(s.precio_unitario)}
      </td>
    </tr>
  )
}

export default async function CatalogoPage({ searchParams }: Props) {
  const { search = '', categoria = '', page = '1' } = await searchParams
  const currentPage = Math.max(1, parseInt(page, 10) || 1)

  const result = await load(async () => {
    const supabase = await createClient()
    const ctx = await getAuthContext(supabase)
    const canSeePendientes = ctx.rol === 'admin' || ctx.rol === 'jefe_taller'

    const [{ data: servicios, total }, pendientesCount] = await Promise.all([
      listarServiciosCatalogo(supabase, {
        query: search,
        categoria: categoria || undefined,
        page: currentPage,
        pageSize: PAGE_SIZE,
      }),
      canSeePendientes ? contarServiciosPendientes(supabase) : Promise.resolve(0),
    ])

    return { servicios, total, pendientesCount, canSeePendientes }
  })

  if (!result.ok) {
    if (result.isAuth) redirect('/login')
    return (
      <Notice tone="error" title={result.error}>
        No se pudo cargar el catálogo de servicios.
      </Notice>
    )
  }

  const { servicios, total, pendientesCount, canSeePendientes } = result.data
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-50">Catálogo de Servicios</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {total} {total === 1 ? 'servicio activo' : 'servicios activos'}
            {' · '}
            <Link href="/catalogo/paquetes" className="text-accent-400 hover:text-accent-300">
              Administrar paquetes →
            </Link>
          </p>
        </div>
        {canSeePendientes && pendientesCount > 0 && (
          <Link
            href="/catalogo/pendientes"
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-500/20"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-800">
              {pendientesCount}
            </span>
            Pendientes de revisión
          </Link>
        )}
        {canSeePendientes && pendientesCount === 0 && (
          <Link
            href="/catalogo/pendientes"
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-300"
          >
            Ver pendientes →
          </Link>
        )}
      </div>

      {/* Filtros */}
      <form method="get" className="mb-5 flex flex-wrap gap-3">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Buscar por nombre o código..."
          className="min-w-[200px] flex-1 rounded-lg border border-black/10 bg-neutral-950/60 px-3.5 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-accent-500/60 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
        />
        <select
          name="categoria"
          defaultValue={categoria}
          className="rounded-lg border border-black/10 bg-neutral-950/60 px-3.5 py-2 text-sm text-neutral-300 focus:border-accent-500/60 focus:outline-none"
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
          className="rounded-lg border border-black/10 bg-black/[0.03] px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-black/[0.07]"
        >
          Filtrar
        </button>
        {(search || categoria) && (
          <Link
            href="/catalogo"
            className="rounded-lg px-3 py-2 text-sm text-neutral-500 transition-colors hover:text-neutral-300"
          >
            Limpiar
          </Link>
        )}
      </form>

      {/* Tabla */}
      {servicios.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description={search || categoria ? 'Ningún servicio coincide con los filtros aplicados.' : 'El catálogo está vacío.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/[0.06]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-black/[0.06] bg-black/[0.02]">
                <th className="px-4 py-3"><span className={sectionLabel}>Código</span></th>
                <th className="px-4 py-3"><span className={sectionLabel}>Nombre</span></th>
                <th className="px-4 py-3"><span className={sectionLabel}>Categoría</span></th>
                <th className="px-4 py-3 text-right"><span className={sectionLabel}>Horas</span></th>
                <th className="px-4 py-3 text-right"><span className={sectionLabel}>Precio</span></th>
              </tr>
            </thead>
            <tbody>
              {servicios.map((s) => (
                <ServicioRow key={s.id} s={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between text-sm text-neutral-500">
          <span>
            Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, total)} de {total}
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={`/catalogo?search=${search}&categoria=${categoria}&page=${currentPage - 1}`}
                className="rounded-lg border border-black/10 px-3 py-1.5 transition-colors hover:bg-black/[0.04]"
              >
                ← Anterior
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`/catalogo?search=${search}&categoria=${categoria}&page=${currentPage + 1}`}
                className="rounded-lg border border-black/10 px-3 py-1.5 transition-colors hover:bg-black/[0.04]"
              >
                Siguiente →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
