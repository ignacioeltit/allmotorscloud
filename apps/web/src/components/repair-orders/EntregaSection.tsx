'use client'

// Cierre de la OT frente al cliente: registrar la entrega (forma de pago, monto,
// km de salida) y emitir el comprobante de entrega. El comprobante fiscal
// (boleta/factura SII) queda señalado como paso siguiente — requiere conectar un
// proveedor de facturación electrónica certificado.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registrarEntrega } from '@/modules/entregas/mutations'
import { FORMAS_PAGO, FORMA_PAGO_LABEL, type FormaPago } from '@/modules/entregas/constants'
import type { Entrega, TotalesOT } from '@/modules/entregas/queries'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, labelClass, btnPrimary } from '@/components/ui/styles'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

export function EntregaSection({
  ordenTrabajoId,
  estadoOT,
  entrega,
  totales,
}: {
  ordenTrabajoId: string
  estadoOT: string
  entrega: Entrega | null
  totales: TotalesOT
}) {
  const router = useRouter()
  const [formaPago, setFormaPago] = useState<FormaPago>('efectivo')
  const [monto, setMonto] = useState(String(Math.round(totales.total_con_iva)))
  const [kmSalida, setKmSalida] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancelada = estadoOT === 'cancelada'

  async function registrar() {
    setGuardando(true)
    setError(null)
    try {
      await registrarEntrega(createClient(), {
        ordenTrabajoId,
        formaPago,
        montoPagado: parseFloat(monto) || 0,
        ...(kmSalida.trim() ? { kmSalida: parseInt(kmSalida, 10) } : {}),
        ...(notas.trim() ? { notas } : {}),
      })
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setGuardando(false)
    }
  }

  // Ya entregada: mostrar el resumen + comprobante.
  if (entrega) {
    return (
      <section className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={sectionLabel}>Entrega</p>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            ✓ Entregada · {new Date(entrega.creado_en).toLocaleDateString('es-CL')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-600">Forma de pago</p>
            <p className="mt-0.5 text-neutral-200">{entrega.forma_pago ? FORMA_PAGO_LABEL[entrega.forma_pago] : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-600">Monto pagado</p>
            <p className="mt-0.5 font-medium text-neutral-100">{entrega.monto_pagado != null ? fmtCLP(entrega.monto_pagado) : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-600">Km salida</p>
            <p className="mt-0.5 text-neutral-200">{entrega.km_salida != null ? entrega.km_salida.toLocaleString('es-CL') : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-600">Total OT (con IVA)</p>
            <p className="mt-0.5 font-medium text-neutral-100">{fmtCLP(totales.total_con_iva)}</p>
          </div>
        </div>
        {entrega.notas && <p className="text-sm text-neutral-500">{entrega.notas}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href={`/repair-orders/${ordenTrabajoId}/comprobante`}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-500"
          >
            🧾 Comprobante de entrega
          </Link>
        </div>

        <p className="rounded-lg border border-black/[0.06] bg-black/[0.02] px-3 py-2 text-xs text-neutral-500">
          <span className="font-medium text-neutral-400">Boleta / factura electrónica (SII):</span> pendiente —
          requiere conectar un proveedor de facturación certificado con los datos del taller. El
          comprobante de arriba es el documento de entrega (no es documento tributario).
        </p>
      </section>
    )
  }

  if (cancelada) return null

  // Aún no entregada: formulario de entrega.
  return (
    <section className={`${card} space-y-4`}>
      <p className={sectionLabel}>Entregar vehículo</p>
      <p className="text-sm text-neutral-500">
        Registra el pago y emite el comprobante de entrega. Total de la OT:{' '}
        <span className="font-semibold text-neutral-200">{fmtCLP(totales.total_con_iva)}</span> (con IVA).
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Forma de pago</label>
          <select className={inputClass} value={formaPago} onChange={(e) => setFormaPago(e.target.value as FormaPago)}>
            {FORMAS_PAGO.map((f) => (
              <option key={f} value={f}>{FORMA_PAGO_LABEL[f]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Monto pagado (CLP)</label>
          <input type="number" min="0" step="1" className={inputClass} value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Km de salida (opcional)</label>
          <input type="number" min="0" className={inputClass} value={kmSalida} onChange={(e) => setKmSalida(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Notas (opcional)</label>
          <input className={inputClass} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: garantía 3 meses en la reparación" />
        </div>
      </div>

      {error && <p className="text-sm text-red-800">{error}</p>}

      <div className="flex items-center gap-3">
        <button onClick={() => void registrar()} disabled={guardando} className={btnPrimary}>
          {guardando ? 'Registrando…' : 'Registrar entrega'}
        </button>
        <p className="text-xs text-neutral-500">La OT pasará a «Entregada» y podrás imprimir el comprobante.</p>
      </div>
    </section>
  )
}
