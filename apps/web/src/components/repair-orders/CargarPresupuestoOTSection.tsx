'use client'

// Cargar un presupuesto pendiente del vehículo en esta OT ya abierta. Útil
// cuando se recibió el auto sin presupuesto y el cliente aprueba uno después.
// Enlaza la cotización a la OT y pasa sus líneas a los trabajos en un clic.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCotizacionById, type PresupuestoPendiente } from '@/modules/estimates/queries'
import { vincularCotizacionAOT } from '@/modules/estimates/mutations'
import { pasarPresupuestoATrabajos } from '@/modules/reparaciones/mutations'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel } from '@/components/ui/styles'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

export function CargarPresupuestoOTSection({
  ordenTrabajoId,
  historiaId,
  tipoEventoReparacionId,
  pendientes,
}: {
  ordenTrabajoId: string
  historiaId: string
  tipoEventoReparacionId: string | null
  pendientes: PresupuestoPendiente[]
}) {
  const router = useRouter()
  const [cargando, setCargando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (pendientes.length === 0) return null

  async function cargar(id: string) {
    setCargando(id)
    setError(null)
    try {
      const sb = createClient()
      await vincularCotizacionAOT(sb, id, ordenTrabajoId)
      const cot = await getCotizacionById(sb, id)
      const items = (cot?.items ?? []).filter((i) => i.cantidad > 0)
      if (items.length > 0 && tipoEventoReparacionId) {
        await pasarPresupuestoATrabajos(sb, {
          ordenTrabajoId,
          historiaId,
          tipoEventoReparacionId,
          folio: cot?.folio ?? null,
          items: items.map((i) => ({
            id: i.id,
            tipo: i.tipo,
            codigo: i.codigo,
            descripcion: i.descripcion,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario,
            descuento_porcentaje: i.descuento_porcentaje,
            repuesto_id: i.repuesto_id,
          })),
        })
      }
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setCargando(null)
    }
  }

  return (
    <section className={card}>
      <p className={sectionLabel}>Presupuestos pendientes de este vehículo</p>
      <p className="mt-0.5 text-xs text-neutral-500">
        Cotizaciones sin OT. «Cargar a la OT» enlaza el presupuesto y pasa sus líneas a los trabajos.
      </p>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 space-y-2">
        {pendientes.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/[0.06] bg-black/[0.02] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-100">{p.folio ?? 'Presupuesto'}</p>
              <p className="text-xs text-neutral-500">
                {p.items} línea{p.items === 1 ? '' : 's'} · {new Date(p.creado_en).toLocaleDateString('es-CL')} · {fmtCLP(Math.round(p.total_neto * 1.19))} c/IVA
              </p>
            </div>
            <button
              type="button"
              onClick={() => void cargar(p.id)}
              disabled={cargando !== null}
              className="shrink-0 rounded-lg border border-accent-500/40 bg-accent-500/10 px-3 py-1.5 text-sm font-medium text-accent-500 hover:bg-accent-500/20 disabled:opacity-50"
            >
              {cargando === p.id ? 'Cargando…' : '+ Cargar a la OT'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
