'use client'

// Detalle de una cotización: cliente + vehículo, ítems (mano de obra / repuesto),
// agregar ítems y marcar como enviada. La conversión a OT (Fase C) se engancha
// con el botón "Convertir a OT" cuando esté disponible.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addItemPresupuesto, enviarPresupuesto } from '@/modules/estimates/mutations'
import { TIPOS_ITEM_PRESUPUESTO, ESTADO_PRESUPUESTO_LABEL } from '@/modules/estimates/constants'
import type { CotizacionDetalle } from '@/modules/estimates/queries'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, labelClass, btnPrimary, btnSecondary, btnGhost } from '@/components/ui/styles'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function AgregarItemForm({ presupuestoId, onDone, onCancel }: { presupuestoId: string; onDone: () => void; onCancel: () => void }) {
  const [tipo, setTipo] = useState<'mano_obra' | 'repuesto'>('mano_obra')
  const [descripcion, setDescripcion] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [precio, setPrecio] = useState('')
  const [descuento, setDescuento] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const cant = parseFloat(cantidad)
    const prec = parseFloat(precio)
    const desc = parseFloat(descuento) || 0
    if (!descripcion.trim() || isNaN(cant) || cant <= 0 || isNaN(prec) || prec < 0) {
      setError('Completa los campos correctamente.')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await addItemPresupuesto(createClient(), {
          presupuestoId,
          tipo,
          descripcion: descripcion.trim(),
          cantidad: cant,
          precioUnitario: prec,
          descuentoPorcentaje: desc,
        })
        onDone()
      } catch (e) {
        setError(toErrorMessage(e))
      }
    })
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-lg border border-black/[0.08] bg-black/[0.02] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Nuevo ítem</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Tipo</label>
          <select className={inputClass} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} disabled={pending}>
            {TIPOS_ITEM_PRESUPUESTO.map((t) => (
              <option key={t} value={t}>{t === 'mano_obra' ? 'Mano de obra' : 'Repuesto / material'}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Descripción</label>
          <input className={inputClass} placeholder="ej: Cambio de batería 90AMP" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} disabled={pending} />
        </div>
        <div>
          <label className={labelClass}>Cantidad</label>
          <input className={inputClass} type="number" min="0.001" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} disabled={pending} />
        </div>
        <div>
          <label className={labelClass}>Precio unitario (CLP)</label>
          <input className={inputClass} type="number" min="0" step="1" placeholder="0" value={precio} onChange={(e) => setPrecio(e.target.value)} disabled={pending} />
        </div>
        <div>
          <label className={labelClass}>Descuento (%)</label>
          <input className={inputClass} type="number" min="0" max="100" step="1" value={descuento} onChange={(e) => setDescuento(e.target.value)} disabled={pending} />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-800">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" className={btnPrimary} disabled={pending}>{pending ? 'Guardando…' : 'Agregar ítem'}</button>
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={pending}>Cancelar</button>
      </div>
    </form>
  )
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
            <AgregarItemForm presupuestoId={p.id} onDone={() => { setShowAdd(false); router.refresh() }} onCancel={() => setShowAdd(false)} />
          ) : (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowAdd(true)} className={`${btnGhost} text-xs`}>+ Agregar ítem</button>
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
