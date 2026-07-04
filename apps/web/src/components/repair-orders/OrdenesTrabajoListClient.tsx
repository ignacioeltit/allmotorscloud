'use client'

// Listado de OTs con buscador (N° OT, patente, marca/modelo, cliente) y filtro
// por estado. Filtrado en cliente: el universo de OTs por taller es chico.

import { useMemo, useState } from 'react'
import Link from 'next/link'
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

const FUERA_TALLER = ['entregada', 'cerrada', 'cancelada']

// Filtros agrupados, como piensa el taller.
const FILTROS: { valor: string; label: string; match: (estado: string) => boolean }[] = [
  { valor: 'todas', label: 'Todas', match: () => true },
  { valor: 'en_taller', label: 'En taller', match: (e) => !FUERA_TALLER.includes(e) },
  { valor: 'entregada', label: 'Entregadas', match: (e) => e === 'entregada' },
  { valor: 'cerrada', label: 'Cerradas', match: (e) => e === 'cerrada' },
  { valor: 'cancelada', label: 'Canceladas', match: (e) => e === 'cancelada' },
]

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function normaliza(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function OrdenesTrabajoListClient({ rows }: { rows: OtListadoRow[] }) {
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('todas')

  const filtradas = useMemo(() => {
    const activo = FILTROS.find((f) => f.valor === filtro) ?? FILTROS[0]!
    const term = normaliza(q.trim())
    return rows.filter((r) => {
      if (!activo.match(r.estado)) return false
      if (!term) return true
      const heno = normaliza(
        [r.numero_ot, r.patente, r.marca, r.modelo, r.cliente_nombre].filter(Boolean).join(' '),
      )
      return heno.includes(term)
    })
  }, [rows, q, filtro])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} max-w-sm flex-1`}
          placeholder="Buscar por N° OT, patente, vehículo o cliente…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
        <select
          className={`${inputClass} max-w-[12rem]`}
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          aria-label="Filtrar por estado"
        >
          {FILTROS.map((f) => (
            <option key={f.valor} value={f.valor}>{f.label}</option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">
          {filtradas.length} de {rows.length}
        </span>
      </div>

      {filtradas.length === 0 ? (
        <p className={`${card} text-sm text-neutral-500`}>Sin órdenes que coincidan.</p>
      ) : (
        <div className="space-y-2">
          {filtradas.map((r) => (
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
    </div>
  )
}
