'use client'

// Listado de OTs con búsqueda server-side (N° OT, patente, vehículo, cliente),
// filtro por estado y paginación. El estado de la búsqueda vive en la URL
// (?q=&estado=&page=), así es enlazable y sobrevive a los refresh.

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { card, inputClass } from '@/components/ui/styles'

export interface OtListadoRow {
  id: string
  numero_ot: string
  estado: string
  creado_en: string
  patente: string | null
  marca: string | null
  modelo: string | null
  cliente_nombre: string | null
}

const FILTROS = [
  { valor: 'todas', label: 'Todas' },
  { valor: 'en_taller', label: 'En taller' },
  { valor: 'entregada', label: 'Entregadas' },
  { valor: 'cerrada', label: 'Cerradas' },
  { valor: 'cancelada', label: 'Canceladas' },
]

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function OrdenesTrabajoListClient({
  rows,
  total,
  q,
  estado,
  page,
  pageSize,
}: {
  rows: OtListadoRow[]
  total: number
  q: string
  estado: string
  page: number
  pageSize: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [texto, setTexto] = useState(q)
  const primerRender = useRef(true)

  // Navega actualizando la URL (server re-consulta). Resetea a page 1 salvo que
  // solo cambie la página.
  function navegar(next: { q?: string; estado?: string; page?: number }) {
    const params = new URLSearchParams()
    const nq = next.q ?? texto
    const nEstado = next.estado ?? estado
    const nPage = next.page ?? 1
    if (nq.trim()) params.set('q', nq.trim())
    if (nEstado && nEstado !== 'todas') params.set('estado', nEstado)
    if (nPage > 1) params.set('page', String(nPage))
    const qs = params.toString()
    startTransition(() => router.replace(qs ? `/repair-orders?${qs}` : '/repair-orders', { scroll: false }))
  }

  // Debounce del texto: cuando el usuario deja de escribir, navega.
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return }
    const t = setTimeout(() => {
      if (texto.trim() !== q) navegar({ q: texto, page: 1 })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto])

  const desde = total === 0 ? 0 : (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, total)
  const hayMas = page * pageSize < total

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} max-w-sm flex-1`}
          placeholder="Buscar por N° OT, patente, vehículo o cliente…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
        />
        <select
          className={`${inputClass} max-w-[12rem]`}
          value={estado}
          onChange={(e) => navegar({ estado: e.target.value, page: 1 })}
          aria-label="Filtrar por estado"
        >
          {FILTROS.map((f) => (
            <option key={f.valor} value={f.valor}>{f.label}</option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">
          {pending ? 'Buscando…' : total === 0 ? '0 resultados' : `${desde}–${hasta} de ${total}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className={`${card} text-sm text-neutral-500`}>Sin órdenes que coincidan.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/repair-orders/${r.id}`}
              className={`${card} flex items-center justify-between gap-3 transition-colors hover:border-black/[0.14]`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-100">{r.numero_ot}</span>
                  <StatusBadge estado={r.estado} />
                </div>
                <p className="mt-0.5 truncate text-sm text-neutral-400">
                  {[r.patente, r.marca, r.modelo].filter(Boolean).join(' · ') || 'Sin vehículo'}
                  {r.cliente_nombre ? ` — ${r.cliente_nombre}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-xs text-neutral-600">{fmtFecha(r.creado_en)}</span>
            </Link>
          ))}
        </div>
      )}

      {(page > 1 || hayMas) && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            disabled={page <= 1 || pending}
            onClick={() => navegar({ page: page - 1 })}
            className="rounded-lg border border-black/10 bg-black/[0.03] px-3.5 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-black/[0.06] disabled:opacity-40"
          >
            ← Anteriores
          </button>
          <span className="text-xs text-neutral-500">Página {page}</span>
          <button
            type="button"
            disabled={!hayMas || pending}
            onClick={() => navegar({ page: page + 1 })}
            className="rounded-lg border border-black/10 bg-black/[0.03] px-3.5 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-black/[0.06] disabled:opacity-40"
          >
            Siguientes →
          </button>
        </div>
      )}
    </div>
  )
}
