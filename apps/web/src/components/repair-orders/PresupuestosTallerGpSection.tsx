'use client'

// Presupuestos históricos de TallerGP del vehículo de la OT. Un clic en
// "Cargar a la OT" copia sus líneas con valor a la orden (como líneas de la OT).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cargarPresupuestoTallerGpEnOT } from '@/modules/presupuestos-tgp/mutations'
import type { PresupuestoTallerGp } from '@/modules/presupuestos-tgp/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, btnSecondary } from '@/components/ui/styles'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function PresupuestosTallerGpSection({
  presupuestos,
  ordenTrabajoId,
  historiaId,
  tipoEventoReparacionId,
}: {
  presupuestos: PresupuestoTallerGp[]
  ordenTrabajoId: string
  historiaId: string
  tipoEventoReparacionId: string | null
}) {
  const router = useRouter()
  const [cargando, setCargando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  if (presupuestos.length === 0) return null

  async function cargar(p: PresupuestoTallerGp) {
    if (!tipoEventoReparacionId) return
    setCargando(p.id)
    setError(null)
    setOk(null)
    try {
      const res = await cargarPresupuestoTallerGpEnOT(createClient(), {
        presupuestoId: p.id,
        ordenTrabajoId,
        historiaId,
        tipoEventoReparacionId,
      })
      setOk(`Se cargaron ${res.lineasCargadas} línea${res.lineasCargadas === 1 ? '' : 's'} del ${res.numero ?? 'presupuesto'} a la OT.`)
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setCargando(null)
    }
  }

  return (
    <section className={`${card} space-y-3`}>
      <p className={sectionLabel}>Presupuestos anteriores (TallerGP)</p>
      <p className="text-xs text-neutral-500">
        Presupuestos históricos de este vehículo. «Cargar a la OT» copia sus líneas con valor a la orden.
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {ok && <p className="text-sm text-emerald-700">{ok}</p>}
      <div className="space-y-2">
        {presupuestos.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/[0.06] bg-black/[0.02] px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-200">
                {p.numero ?? 'Presupuesto'} <span className="text-neutral-500">· {fmtFecha(p.fecha)}</span>
              </p>
              <p className="text-xs text-neutral-500">
                {[p.estado, `${p.lineas.length} líneas`, `${fmtCLP(p.total_con_iva)} con IVA`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void cargar(p)}
              disabled={cargando === p.id || !tipoEventoReparacionId}
              className={btnSecondary}
            >
              {cargando === p.id ? 'Cargando…' : '➕ Cargar a la OT'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
