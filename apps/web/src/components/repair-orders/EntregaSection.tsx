'use client'

// Cierre + facturación de la OT: registrar la entrega (documento, condición de
// pago, forma de pago), y si es a crédito, cobrarla después. El ingreso entra al
// libro de finanzas. La emisión electrónica SII (DTE) es un pendiente aparte —
// acá se registra el N° de factura que el taller genera en su sistema fiscal.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registrarEntrega } from '@/modules/entregas/mutations'
import { marcarEntregaPagada } from '@/modules/finanzas/mutations'
import { FORMAS_PAGO, FORMA_PAGO_LABEL, type FormaPago } from '@/modules/entregas/constants'
import {
  TIPO_DOCUMENTO_LABEL, CONDICIONES_PAGO, CONDICION_PAGO_LABEL, DIAS_CREDITO_DEFAULT,
  OPCIONES_DOCUMENTO, ESTADO_FACTURA_LABEL, type CondicionPago, type OpcionDocumento,
} from '@/modules/finanzas/constants'
import type { Entrega, TotalesOT } from '@/modules/entregas/queries'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, labelClass, btnPrimary, btnSecondary } from '@/components/ui/styles'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}
function hoyYMD(): string {
  return new Date().toISOString().slice(0, 10)
}
function masDias(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
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

  // Formulario de entrega (aún no entregada)
  const [opcionDoc, setOpcionDoc] = useState<OpcionDocumento>('boleta_ahora')
  const [numeroFactura, setNumeroFactura] = useState('')
  const docSel = OPCIONES_DOCUMENTO.find((o) => o.valor === opcionDoc)!
  // Solo boleta/factura emitidas ahora piden el N° al momento.
  const pideNumeroAhora = docSel.estado === 'facturada'
  const [condicion, setCondicion] = useState<CondicionPago>('contado')
  const [venceEn, setVenceEn] = useState(masDias(DIAS_CREDITO_DEFAULT))
  const [formaPago, setFormaPago] = useState<FormaPago>('efectivo')
  const [monto, setMonto] = useState(String(Math.round(totales.total_con_iva)))
  const [kmSalida, setKmSalida] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cobro (entrega a crédito pendiente)
  const [formaPagoCobro, setFormaPagoCobro] = useState<FormaPago>('transferencia')
  const [cobrando, setCobrando] = useState(false)

  async function registrar() {
    setGuardando(true)
    setError(null)
    try {
      await registrarEntrega(createClient(), {
        ordenTrabajoId,
        formaPago,
        montoPagado: parseFloat(monto) || 0,
        tipoDocumento: docSel.tipo,
        estadoFactura: docSel.estado,
        condicionPago: condicion,
        ...(pideNumeroAhora && numeroFactura.trim() ? { numeroFactura } : {}),
        ...(condicion === 'credito' ? { venceEn } : {}),
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

  async function cobrar() {
    if (!entrega) return
    setCobrando(true)
    setError(null)
    try {
      await marcarEntregaPagada(createClient(), {
        entregaId: entrega.id,
        formaPago: formaPagoCobro,
      })
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setCobrando(false)
    }
  }

  // ── Ya entregada ────────────────────────────────────────────────────────────
  if (entrega) {
    const pendiente = entrega.estado_pago === 'pendiente'
    return (
      <section className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={sectionLabel}>Entrega y facturación</p>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
              ✓ Entregada · {new Date(entrega.creado_en).toLocaleDateString('es-CL')}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                pendiente
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-800'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800'
              }`}
            >
              {pendiente ? '● Pendiente de pago' : '✓ Pagada'}
            </span>
            {entrega.estado_factura === 'por_facturar' && (
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                ● Por facturar
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-600">Documento</p>
            <p className="mt-0.5 text-neutral-200">
              {entrega.estado_factura === 'por_facturar'
                ? `${TIPO_DOCUMENTO_LABEL[entrega.tipo_documento]} · ${ESTADO_FACTURA_LABEL.por_facturar}`
                : `${TIPO_DOCUMENTO_LABEL[entrega.tipo_documento]}${entrega.numero_factura ? ` N° ${entrega.numero_factura}` : ''}`}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-600">Monto</p>
            <p className="mt-0.5 font-medium text-neutral-100">{entrega.monto_pagado != null ? fmtCLP(entrega.monto_pagado) : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-600">Condición</p>
            <p className="mt-0.5 text-neutral-200">{CONDICION_PAGO_LABEL[entrega.condicion_pago].split(' (')[0]}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-600">
              {pendiente ? 'Vence' : 'Pagado el'}
            </p>
            <p className={`mt-0.5 ${entrega.vence_en && entrega.vence_en < hoyYMD() && pendiente ? 'font-medium text-red-700' : 'text-neutral-200'}`}>
              {pendiente
                ? entrega.vence_en
                  ? new Date(entrega.vence_en + 'T00:00').toLocaleDateString('es-CL')
                  : '—'
                : entrega.pagado_en
                  ? new Date(entrega.pagado_en + 'T00:00').toLocaleDateString('es-CL')
                  : '—'}
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-red-800">{error}</p>}

        {/* Cobro de una entrega a crédito pendiente */}
        {pendiente && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3">
            <p className="text-sm text-amber-800">Registrar el pago de {fmtCLP(entrega.monto_pagado ?? totales.total_con_iva)}:</p>
            <select
              className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm text-neutral-700"
              value={formaPagoCobro}
              onChange={(e) => setFormaPagoCobro(e.target.value as FormaPago)}
            >
              {FORMAS_PAGO.map((f) => <option key={f} value={f}>{FORMA_PAGO_LABEL[f]}</option>)}
            </select>
            <button onClick={() => void cobrar()} disabled={cobrando} className={btnPrimary}>
              {cobrando ? 'Registrando…' : 'Marcar como pagada'}
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href={`/repair-orders/${ordenTrabajoId}/comprobante`}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-500"
          >
            🧾 Comprobante de entrega
          </Link>
          <Link href="/finanzas" className={btnSecondary}>Ver finanzas</Link>
        </div>

        <p className="rounded-lg border border-black/[0.06] bg-black/[0.02] px-3 py-2 text-xs text-neutral-500">
          El N° de documento se registra manualmente (el que emites en tu sistema fiscal). La
          emisión electrónica al SII es un paso aparte, aún no integrado.
        </p>
      </section>
    )
  }

  if (estadoOT === 'cancelada') return null

  // ── Aún no entregada: formulario ────────────────────────────────────────────
  return (
    <section className={`${card} space-y-4`}>
      <p className={sectionLabel}>Entregar y facturar</p>
      <p className="text-sm text-neutral-500">
        Total de la OT: <span className="font-semibold text-neutral-200">{fmtCLP(totales.total_con_iva)}</span> (con IVA).
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Documento</label>
          <select className={inputClass} value={opcionDoc} onChange={(e) => setOpcionDoc(e.target.value as OpcionDocumento)}>
            {OPCIONES_DOCUMENTO.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>N° de factura / boleta</label>
          <input
            className={inputClass}
            value={numeroFactura}
            onChange={(e) => setNumeroFactura(e.target.value)}
            placeholder={pideNumeroAhora ? 'Folio del documento' : docSel.estado === 'por_facturar' ? 'Se ingresa a fin de mes' : '—'}
            disabled={!pideNumeroAhora}
          />
        </div>
        <div>
          <label className={labelClass}>Condición de pago</label>
          <select className={inputClass} value={condicion} onChange={(e) => setCondicion(e.target.value as CondicionPago)}>
            {CONDICIONES_PAGO.map((c) => <option key={c} value={c}>{CONDICION_PAGO_LABEL[c]}</option>)}
          </select>
        </div>
        {condicion === 'credito' ? (
          <div>
            <label className={labelClass}>Vence el</label>
            <input type="date" className={inputClass} value={venceEn} onChange={(e) => setVenceEn(e.target.value)} />
          </div>
        ) : (
          <div>
            <label className={labelClass}>Forma de pago</label>
            <select className={inputClass} value={formaPago} onChange={(e) => setFormaPago(e.target.value as FormaPago)}>
              {FORMAS_PAGO.map((f) => <option key={f} value={f}>{FORMA_PAGO_LABEL[f]}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className={labelClass}>Monto (CLP)</label>
          <input type="number" min="0" step="1" className={inputClass} value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Km de salida (opcional)</label>
          <input type="number" min="0" className={inputClass} value={kmSalida} onChange={(e) => setKmSalida(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Notas (opcional)</label>
          <input className={inputClass} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: garantía 3 meses en la reparación" />
        </div>
      </div>

      {docSel.estado === 'por_facturar' && (
        <p className="rounded-lg border border-sky-500/25 bg-sky-500/[0.06] px-3 py-2 text-xs text-sky-800">
          Facturación mensual: entregas ahora y la OT queda <strong>Por facturar</strong> (aparece en Finanzas).
          A fin de mes ingresas el N° de factura del cliente.
        </p>
      )}
      {condicion === 'credito' && (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-800">
          A crédito: queda <strong>pendiente de pago</strong> (aparece en Cuentas por cobrar).
          El ingreso se cuenta cuando marques la entrega como pagada.
        </p>
      )}

      {error && <p className="text-sm text-red-800">{error}</p>}

      <div className="flex items-center gap-3">
        <button onClick={() => void registrar()} disabled={guardando} className={btnPrimary}>
          {guardando ? 'Registrando…' : 'Registrar entrega'}
        </button>
        <p className="text-xs text-neutral-500">La OT pasará a «Entregada».</p>
      </div>
    </section>
  )
}
