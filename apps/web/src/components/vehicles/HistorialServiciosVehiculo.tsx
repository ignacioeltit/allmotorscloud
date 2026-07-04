'use client'

// Historial de servicios del vehículo: lista plana y buscable de todo lo que se
// le ha hecho (todas las líneas de todas sus OTs). Pensado para responder
// "¿cuándo se le cambió el filtro?" sin abrir OT por OT.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { card, inputClass } from '@/components/ui/styles'
import type { ServicioHistorialRow } from '@/modules/repair-orders/queries'

const TIPO_LABEL: Record<string, string> = {
  mano_obra: 'Mano de obra',
  repuesto: 'Repuesto',
  otros: 'Otros',
}
const TIPO_COLOR: Record<string, string> = {
  mano_obra: 'border-sky-500/20 bg-sky-500/[0.06] text-sky-700',
  repuesto: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-700',
  otros: 'border-black/10 bg-black/[0.04] text-neutral-500',
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Valores 0 y 1 son placeholders de TallerGP (km no registrado), no km reales.
function fmtKm(km: number | null): string {
  if (km == null || km <= 1) return 's/km'
  return `${km.toLocaleString('es-CL')} km`
}

function normaliza(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function HistorialServiciosVehiculo({ rows }: { rows: ServicioHistorialRow[] }) {
  const [q, setQ] = useState('')

  const filtradas = useMemo(() => {
    const term = normaliza(q.trim())
    if (!term) return rows
    return rows.filter((r) => normaliza(r.descripcion).includes(term))
  }, [rows, q])

  if (rows.length === 0) {
    return <p className={`${card} text-sm text-neutral-500`}>Sin servicios registrados todavía.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} max-w-sm flex-1`}
          placeholder="Buscar servicio o repuesto… (ej: filtro, aceite, frenos)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
        <span className="text-xs text-neutral-500">
          {q.trim() ? `${filtradas.length} de ${rows.length}` : `${rows.length} servicios`}
        </span>
      </div>

      {filtradas.length === 0 ? (
        <p className={`${card} text-sm text-neutral-500`}>
          Nada coincide con «{q}». Este vehículo no registra ese servicio.
        </p>
      ) : (
        <ul className="divide-y divide-black/[0.05] overflow-hidden rounded-xl border border-black/[0.06]">
          {filtradas.map((r) => (
            <li key={r.itemId} className="flex items-center justify-between gap-3 bg-black/[0.02] px-4 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${TIPO_COLOR[r.tipo] ?? ''}`}>
                    {TIPO_LABEL[r.tipo] ?? r.tipo}
                  </span>
                  <span className="truncate text-sm text-neutral-200">
                    {r.descripcion}
                    {r.cantidad !== 1 && <span className="ml-1.5 text-xs text-neutral-500">× {r.cantidad}</span>}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`min-w-[5.5rem] rounded-md px-2 py-1 text-right text-xs font-bold tabular-nums ${
                    r.km != null && r.km > 1
                      ? 'bg-accent-500/10 text-accent-300'
                      : 'text-neutral-600'
                  }`}
                  title="Kilometraje al ingresar"
                >
                  {fmtKm(r.km)}
                </span>
                <span className="w-20 text-right text-xs text-neutral-500">{fmtFecha(r.fecha)}</span>
                <Link href={`/repair-orders/${r.otId}`} className="text-xs font-medium text-accent-400 hover:text-accent-300">
                  {r.numeroOt}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
