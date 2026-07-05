'use client'

// Finanzas: resumen del período, cuentas por cobrar, libro de movimientos y
// alta de ingreso/gasto manual.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registrarMovimiento, eliminarMovimiento, facturarEntrega, marcarEntregaPagada } from '@/modules/finanzas/mutations'
import { FORMAS_PAGO, FORMA_PAGO_LABEL } from '@/modules/entregas/constants'
import {
  CATEGORIAS_GASTO, CATEGORIA_GASTO_LABEL, type TipoMovimiento,
} from '@/modules/finanzas/constants'
import type { Movimiento, ResumenFinanzas, CuentaPorCobrar, PorFacturar } from '@/modules/finanzas/queries'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, labelClass, btnPrimary, btnGhost } from '@/components/ui/styles'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}
function fmtFecha(ymd: string): string {
  return new Date(ymd + 'T00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}
function hoyYMD(): string {
  return new Date().toISOString().slice(0, 10)
}

export function FinanzasClient({
  desde,
  hasta,
  resumen,
  movimientos,
  cuentasPorCobrar,
  porFacturar,
}: {
  desde: string
  hasta: string
  resumen: ResumenFinanzas
  movimientos: Movimiento[]
  cuentasPorCobrar: CuentaPorCobrar[]
  porFacturar: PorFacturar[]
}) {
  const router = useRouter()

  const [tipo, setTipo] = useState<TipoMovimiento>('gasto')
  const [monto, setMonto] = useState('')
  const [categoria, setCategoria] = useState('repuestos')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(hoyYMD())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [borrando, setBorrando] = useState<string | null>(null)

  const totalPorCobrar = cuentasPorCobrar.reduce((a, c) => a + c.monto, 0)
  const totalPorFacturar = porFacturar.reduce((a, c) => a + c.monto, 0)

  // Facturación de entregas mensuales
  const [facturandoId, setFacturandoId] = useState<string | null>(null)
  const [nroFactura, setNroFactura] = useState('')

  // Registrar pago de una cuenta por cobrar (inline)
  const [pagandoId, setPagandoId] = useState<string | null>(null)
  const [formaPago, setFormaPago] = useState<string>('efectivo')
  const [pagandoBusy, setPagandoBusy] = useState(false)

  async function registrarPago(entregaId: string) {
    setPagandoBusy(true)
    setError(null)
    try {
      await marcarEntregaPagada(createClient(), { entregaId, formaPago })
      setPagandoId(null)
      setFormaPago('efectivo')
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setPagandoBusy(false)
    }
  }

  function setPeriodo(d: string, h: string) {
    router.push(`/finanzas?desde=${d}&hasta=${h}`)
  }

  async function facturar(entregaId: string) {
    if (!nroFactura.trim()) return
    setError(null)
    try {
      await facturarEntrega(createClient(), { entregaId, numeroFactura: nroFactura })
      setFacturandoId(null)
      setNroFactura('')
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    }
  }

  async function registrar() {
    const m = parseFloat(monto)
    if (!Number.isFinite(m) || m <= 0) {
      setError('Ingresa un monto válido.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await registrarMovimiento(createClient(), {
        tipo,
        monto: m,
        fecha,
        categoria: tipo === 'gasto' ? categoria : 'ingreso_otro',
        ...(descripcion.trim() ? { descripcion } : {}),
      })
      setMonto('')
      setDescripcion('')
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(id: string) {
    if (!window.confirm('¿Eliminar este movimiento?')) return
    setBorrando(id)
    try {
      await eliminarMovimiento(createClient(), id)
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBorrando(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Resumen del período */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={card}>
          <p className="text-[11px] uppercase tracking-wider text-neutral-600">Ingresos</p>
          <p className="mt-1 text-xl font-bold text-emerald-700">{fmtCLP(resumen.ingresos)}</p>
        </div>
        <div className={card}>
          <p className="text-[11px] uppercase tracking-wider text-neutral-600">Gastos</p>
          <p className="mt-1 text-xl font-bold text-red-700">{fmtCLP(resumen.gastos)}</p>
        </div>
        <div className={card}>
          <p className="text-[11px] uppercase tracking-wider text-neutral-600">Balance</p>
          <p className={`mt-1 text-xl font-bold ${resumen.balance >= 0 ? 'text-neutral-100' : 'text-red-700'}`}>
            {fmtCLP(resumen.balance)}
          </p>
        </div>
      </div>

      {/* Período */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelClass}>Desde</label>
          <input type="date" className={inputClass} defaultValue={desde} onChange={(e) => setPeriodo(e.target.value, hasta)} />
        </div>
        <div>
          <label className={labelClass}>Hasta</label>
          <input type="date" className={inputClass} defaultValue={hasta} onChange={(e) => setPeriodo(desde, e.target.value)} />
        </div>
      </div>

      {/* Cuentas por cobrar */}
      {cuentasPorCobrar.length > 0 && (
        <section className={`${card} space-y-3`}>
          <div className="flex items-center justify-between">
            <p className={sectionLabel}>Cuentas por cobrar</p>
            <p className="text-sm font-medium text-amber-800">{fmtCLP(totalPorCobrar)} pendiente</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="py-2 font-medium">OT</th>
                  <th className="py-2 font-medium">Cliente</th>
                  <th className="py-2 font-medium">Factura</th>
                  <th className="py-2 font-medium">Vence</th>
                  <th className="py-2 text-right font-medium">Monto</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {cuentasPorCobrar.map((c) => (
                  <tr key={c.entrega_id} className="border-t border-black/[0.05]">
                    <td className="py-2 font-medium text-neutral-200">{c.numero_ot ?? '—'}</td>
                    <td className="py-2 text-neutral-400">{c.cliente_nombre ?? '—'}</td>
                    <td className="py-2 text-neutral-500">{c.numero_factura ?? '—'}</td>
                    <td className={`py-2 ${c.vencida ? 'font-medium text-red-700' : 'text-neutral-400'}`}>
                      {c.vence_en ? fmtFecha(c.vence_en) : '—'}{c.vencida ? ' · vencida' : ''}
                    </td>
                    <td className="py-2 text-right font-medium text-neutral-200">{fmtCLP(c.monto)}</td>
                    <td className="py-2 text-right">
                      {pagandoId === c.entrega_id ? (
                        <div className="flex items-center justify-end gap-2">
                          <select
                            className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-neutral-700 outline-none focus:border-accent-500"
                            value={formaPago}
                            onChange={(e) => setFormaPago(e.target.value)}
                            disabled={pagandoBusy}
                            aria-label="Forma de pago"
                          >
                            {FORMAS_PAGO.map((f) => <option key={f} value={f}>{FORMA_PAGO_LABEL[f]}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => void registrarPago(c.entrega_id)}
                            disabled={pagandoBusy}
                            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {pagandoBusy ? '…' : 'Confirmar pago'}
                          </button>
                          <button type="button" onClick={() => setPagandoId(null)} disabled={pagandoBusy} className="text-xs text-neutral-500 hover:text-neutral-300">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => { setPagandoId(c.entrega_id); setFormaPago('efectivo') }}
                            className="font-medium text-emerald-700 hover:text-emerald-600"
                          >
                            Registrar pago
                          </button>
                          <Link href={`/repair-orders/${c.orden_trabajo_id}`} className="text-xs text-neutral-500 hover:text-neutral-300">
                            Ver OT
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Por facturar (clientes mensuales) */}
      {porFacturar.length > 0 && (
        <section className={`${card} space-y-3`}>
          <div className="flex items-center justify-between">
            <p className={sectionLabel}>Por facturar (facturación mensual)</p>
            <p className="text-sm font-medium text-sky-800">{fmtCLP(totalPorFacturar)} · {porFacturar.length} OT</p>
          </div>
          <p className="text-xs text-neutral-500">
            OT entregadas cuya factura se emite a fin de mes. Ingresa el N° de factura (usa el mismo para
            consolidar las OT de un cliente).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="py-2 font-medium">OT</th>
                  <th className="py-2 font-medium">Cliente</th>
                  <th className="py-2 font-medium">Entregada</th>
                  <th className="py-2 text-right font-medium">Monto</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {porFacturar.map((c) => (
                  <tr key={c.entrega_id} className="border-t border-black/[0.05]">
                    <td className="py-2 font-medium text-neutral-200">{c.numero_ot ?? '—'}</td>
                    <td className="py-2 text-neutral-400">{c.cliente_nombre ?? '—'}</td>
                    <td className="py-2 text-neutral-500">{fmtFecha(c.creado_en.slice(0, 10))}</td>
                    <td className="py-2 text-right font-medium text-neutral-200">{fmtCLP(c.monto)}</td>
                    <td className="py-2 text-right">
                      {facturandoId === c.entrega_id ? (
                        <span className="inline-flex items-center gap-1.5">
                          <input
                            autoFocus
                            className="w-28 rounded border border-black/10 bg-white px-2 py-0.5 text-xs text-neutral-800"
                            placeholder="N° factura"
                            value={nroFactura}
                            onChange={(e) => setNroFactura(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') void facturar(c.entrega_id) }}
                          />
                          <button onClick={() => void facturar(c.entrega_id)} className={`${btnPrimary} px-2 py-0.5 text-xs`}>Guardar</button>
                          <button onClick={() => { setFacturandoId(null); setNroFactura('') }} className={`${btnGhost} px-1 text-xs`}>×</button>
                        </span>
                      ) : (
                        <button onClick={() => { setFacturandoId(c.entrega_id); setNroFactura('') }} className="text-accent-400 hover:text-accent-300">
                          Facturar →
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Registrar movimiento */}
      <section className={`${card} space-y-4`}>
        <p className={sectionLabel}>Registrar movimiento</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className={labelClass}>Tipo</label>
            <select className={inputClass} value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento)}>
              <option value="gasto">Gasto</option>
              <option value="ingreso">Ingreso</option>
            </select>
          </div>
          {tipo === 'gasto' && (
            <div>
              <label className={labelClass}>Categoría</label>
              <select className={inputClass} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{CATEGORIA_GASTO_LABEL[c]}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={labelClass}>Monto (CLP)</label>
            <input type="number" min="0" step="1" className={inputClass} value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Fecha</label>
            <input type="date" className={inputClass} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className={tipo === 'gasto' ? 'sm:col-span-4' : 'sm:col-span-3'}>
            <label className={labelClass}>Descripción (opcional)</label>
            <input className={inputClass} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder={tipo === 'gasto' ? 'Ej: compra filtros a proveedor X' : 'Ej: venta de repuesto en mesón'} />
          </div>
        </div>
        {error && <p className="text-sm text-red-800">{error}</p>}
        <button onClick={() => void registrar()} disabled={guardando} className={btnPrimary}>
          {guardando ? 'Guardando…' : `Registrar ${tipo}`}
        </button>
      </section>

      {/* Libro de movimientos */}
      <section className={`${card} space-y-3`}>
        <p className={sectionLabel}>Movimientos del período</p>
        {movimientos.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin movimientos en este período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="py-2 font-medium">Fecha</th>
                  <th className="py-2 font-medium">Detalle</th>
                  <th className="py-2 text-right font-medium">Monto</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id} className="border-t border-black/[0.05]">
                    <td className="py-2 text-neutral-500">{fmtFecha(m.fecha)}</td>
                    <td className="py-2">
                      <span className="text-neutral-200">
                        {m.categoria ? CATEGORIA_GASTO_LABEL[m.categoria] ?? m.categoria : (m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto')}
                      </span>
                      {m.numero_ot && <span className="ml-2 text-xs text-neutral-500">{m.numero_ot}</span>}
                      {m.descripcion && <span className="ml-2 text-xs text-neutral-500">· {m.descripcion}</span>}
                    </td>
                    <td className={`py-2 text-right font-medium ${m.tipo === 'ingreso' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {m.tipo === 'ingreso' ? '+' : '−'}{fmtCLP(m.monto)}
                    </td>
                    <td className="py-2 text-right">
                      {m.origen === 'manual' ? (
                        <button onClick={() => void borrar(m.id)} disabled={borrando === m.id} className={`${btnGhost} px-2 py-0.5 text-xs text-red-700`}>
                          {borrando === m.id ? '…' : '×'}
                        </button>
                      ) : (
                        m.orden_trabajo_id === null && m.numero_ot ? (
                          <span className="text-[10px] text-neutral-600">OT</span>
                        ) : null
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
