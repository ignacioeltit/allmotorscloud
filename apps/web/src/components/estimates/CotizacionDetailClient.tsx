'use client'

// Detalle de una cotización: cliente + vehículo, ítems (mano de obra / repuesto),
// agregar ítems y marcar como enviada. La conversión a OT (Fase C) se engancha
// con el botón "Convertir a OT" cuando esté disponible.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { enviarPresupuesto } from '@/modules/estimates/mutations'
import { ESTADO_PRESUPUESTO_LABEL } from '@/modules/estimates/constants'
import type { CotizacionDetalle } from '@/modules/estimates/queries'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, btnSecondary, btnGhost } from '@/components/ui/styles'
import { FichaIngresoLineas } from './FichaIngresoLineas'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

export function CotizacionDetailClient({ cotizacion }: { cotizacion: CotizacionDetalle }) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const p = cotizacion
  const esBorrador = p.estado === 'borrador'

  async function enviar() {
    setEnviando(true)
    setError(null)
    try {
      await enviarPresupuesto(createClient(), p.id)
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Cliente + vehículo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className={card}>
          <p className={sectionLabel}>Cliente</p>
          <p className="mt-2 font-medium text-neutral-100">{p.cliente?.nombre ?? '—'}</p>
          <p className="text-sm text-neutral-500">
            {[p.cliente?.rut, p.cliente?.telefono].filter(Boolean).join(' · ') || '—'}
          </p>
        </section>
        <section className={card}>
          <p className={sectionLabel}>Vehículo</p>
          <p className="mt-2 font-medium tracking-wide text-neutral-100">{p.vehiculo?.patente ?? '—'}</p>
          <p className="text-sm text-neutral-500">
            {[p.vehiculo?.marca, p.vehiculo?.modelo, p.vehiculo?.anio].filter(Boolean).join(' · ') || '—'}
          </p>
        </section>
      </div>

      {/* Ítems + totales */}
      <section className={`${card} space-y-4`}>
        <div className="flex items-center justify-between gap-3">
          <p className={sectionLabel}>Ítems de la cotización</p>
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-800">
            {ESTADO_PRESUPUESTO_LABEL[p.estado]}
          </span>
        </div>

        {p.items.length > 0 ? (
          <div className="space-y-1.5">
            {p.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-black/[0.05] bg-black/[0.02] px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="mr-2 rounded-full border border-black/[0.08] bg-black/[0.04] px-2 py-0.5 text-[10px] text-neutral-500">
                    {item.tipo === 'mano_obra' ? 'Mano de obra' : 'Repuesto'}
                  </span>
                  <span className="text-neutral-300">{item.descripcion}</span>
                  {item.cantidad !== 1 && <span className="ml-2 text-xs text-neutral-500">× {item.cantidad}</span>}
                </div>
                <span className="shrink-0 font-medium text-neutral-200">{fmtCLP(item.precio_total)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-black/[0.06] pt-3 text-sm">
              <span className="text-neutral-500">Mano de obra</span>
              <span className="text-neutral-300">{fmtCLP(p.total_mano_obra)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Repuestos</span>
              <span className="text-neutral-300">{fmtCLP(p.total_repuestos)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-neutral-400">Total neto</span>
              <span className="text-neutral-100">{fmtCLP(p.total_neto)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Aún no hay ítems. Agrega mano de obra y repuestos.</p>
        )}

        {p.notas && <p className="text-xs text-neutral-500">{p.notas}</p>}
        {error && <p className="text-xs text-red-800">{error}</p>}

        {esBorrador &&
          (showAdd ? (
            <div className="rounded-lg border border-black/[0.08] bg-black/[0.02] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Cargar líneas</p>
                <button onClick={() => setShowAdd(false)} className={`${btnGhost} text-xs`}>Cerrar</button>
              </div>
              <FichaIngresoLineas presupuestoId={p.id} onGuardado={() => { setShowAdd(false); router.refresh() }} />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowAdd(true)} className={`${btnGhost} text-xs`}>+ Cargar líneas</button>
              {p.items.length > 0 && (
                <button onClick={() => void enviar()} disabled={enviando} className={`${btnSecondary} text-xs`}>
                  {enviando ? 'Enviando…' : 'Marcar como enviada'}
                </button>
              )}
            </div>
          ))}
      </section>
    </div>
  )
}
