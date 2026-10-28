'use client'

// POS mostrador: venta directa de repuestos/productos sin OT. Busca ítems del
// inventario (o agrega ítems libres), arma el carrito, elige método de pago y
// cliente opcional, y registra la venta (descuenta stock + ingreso en finanzas).

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { searchRepuestos } from '@/modules/inventory/queries'
import { listClientes } from '@/modules/customers/queries'
import { registrarVentaMostrador } from '@/modules/ventas-mostrador/mutations'
import { METODOS_PAGO, METODO_PAGO_LABEL, IVA_FACTOR, type MetodoPago } from '@/modules/ventas-mostrador/constants'
import type { RepuestoResumen } from '@/modules/inventory/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, labelClass, btnPrimary, btnSecondary } from '@/components/ui/styles'

type Linea = {
  key: string
  repuestoId: string | null
  descripcion: string
  cantidad: number
  precio: number
  stock: number | null
}

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

let seq = 0
const nextKey = () => `l${++seq}`

export function PosClient() {
  const router = useRouter()

  const [lineas, setLineas] = useState<Linea[]>([])
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Buscador de repuestos
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<RepuestoResumen[]>([])
  const [buscando, setBuscando] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ítem libre
  const [libreDesc, setLibreDesc] = useState('')
  const [librePrecio, setLibrePrecio] = useState('')

  // Cliente opcional
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clienteNombre, setClienteNombre] = useState('')
  const [cq, setCq] = useState('')
  const [cResultados, setCResultados] = useState<{ id: string; nombre: string; rut: string | null }[]>([])
  const ctimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const total = lineas.reduce((s, l) => s + Math.round(l.cantidad * l.precio), 0)
  const neto = Math.round(total / IVA_FACTOR)
  const iva = total - neto

  function buscar(valor: string) {
    setQ(valor)
    if (timer.current) clearTimeout(timer.current)
    if (valor.trim().length < 2) {
      setResultados([])
      return
    }
    timer.current = setTimeout(async () => {
      setBuscando(true)
      try {
        setResultados(await searchRepuestos(createClient(), valor))
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 250)
  }

  function agregarRepuesto(r: RepuestoResumen) {
    setLineas((prev) => {
      const existe = prev.find((l) => l.repuestoId === r.id)
      if (existe) {
        return prev.map((l) => (l.repuestoId === r.id ? { ...l, cantidad: l.cantidad + 1 } : l))
      }
      return [
        ...prev,
        { key: nextKey(), repuestoId: r.id, descripcion: `${r.codigo} · ${r.nombre}`, cantidad: 1, precio: r.precio_venta ?? 0, stock: r.stock_actual },
      ]
    })
    setQ('')
    setResultados([])
  }

  function agregarLibre() {
    const precio = parseInt(librePrecio, 10)
    if (!libreDesc.trim() || !Number.isFinite(precio) || precio < 0) return
    setLineas((prev) => [...prev, { key: nextKey(), repuestoId: null, descripcion: libreDesc.trim(), cantidad: 1, precio, stock: null }])
    setLibreDesc('')
    setLibrePrecio('')
  }

  function actualizar(key: string, campos: Partial<Linea>) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...campos } : l)))
  }
  function quitar(key: string) {
    setLineas((prev) => prev.filter((l) => l.key !== key))
  }

  function buscarCliente(valor: string) {
    setCq(valor)
    if (ctimer.current) clearTimeout(ctimer.current)
    if (valor.trim().length < 2) {
      setCResultados([])
      return
    }
    ctimer.current = setTimeout(async () => {
      try {
        const cs = await listClientes(createClient(), { search: valor, limit: 6 })
        setCResultados(cs.map((c) => ({ id: c.id, nombre: c.nombre, rut: c.rut })))
      } catch {
        setCResultados([])
      }
    }, 250)
  }

  async function registrar() {
    if (lineas.length === 0) return
    setGuardando(true)
    setError(null)
    try {
      const id = await registrarVentaMostrador(createClient(), {
        items: lineas.map((l) => ({
          repuesto_id: l.repuestoId,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio_unitario: l.precio,
        })),
        clienteId,
        metodoPago,
        notas: notas.trim() || null,
      })
      router.push(`/pos/${id}`)
    } catch (e) {
      setError(toErrorMessage(e))
      setGuardando(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* ── Columna izquierda: buscar + carrito ── */}
      <div className="space-y-5">
        <section className={card}>
          <p className={sectionLabel}>Agregar producto</p>
          <div className="relative mt-2">
            <input
              className={inputClass}
              placeholder="Buscar por código o nombre…"
              value={q}
              onChange={(e) => buscar(e.target.value)}
            />
            {q.trim().length >= 2 && (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-black/10 bg-neutral-900 shadow-xl shadow-black/20">
                {buscando ? (
                  <p className="px-3 py-3 text-xs text-neutral-500">Buscando…</p>
                ) : resultados.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-neutral-500">Sin resultados.</p>
                ) : (
                  resultados.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => agregarRepuesto(r)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-black/[0.05]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-neutral-100">{r.nombre}</span>
                        <span className="block truncate text-xs text-neutral-500">{r.codigo} · stock {r.stock_actual}</span>
                      </span>
                      <span className="shrink-0 text-sm font-medium text-neutral-200">{fmtCLP(r.precio_venta ?? 0)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Ítem libre */}
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-black/[0.06] pt-3">
            <div className="flex-1 min-w-[160px]">
              <label className={labelClass}>Ítem libre (sin inventario)</label>
              <input className={inputClass} placeholder="Descripción" value={libreDesc} onChange={(e) => setLibreDesc(e.target.value)} />
            </div>
            <div className="w-28">
              <label className={labelClass}>Precio</label>
              <input type="number" className={inputClass} placeholder="0" value={librePrecio} onChange={(e) => setLibrePrecio(e.target.value)} />
            </div>
            <button type="button" className={btnSecondary} onClick={agregarLibre} disabled={!libreDesc.trim() || !librePrecio.trim()}>
              + Agregar
            </button>
          </div>
        </section>

        <section className={card}>
          <p className={sectionLabel}>Carrito</p>
          {lineas.length === 0 ? (
            <p className="mt-3 py-6 text-center text-sm text-neutral-500">Agrega productos para iniciar la venta.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {lineas.map((l) => (
                <div key={l.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-black/[0.06] bg-black/[0.02] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-neutral-200">{l.descripcion}</p>
                    {l.stock != null && l.cantidad > l.stock && (
                      <p className="text-[11px] text-amber-700">⚠ vende más que el stock ({l.stock})</p>
                    )}
                  </div>
                  <input
                    type="number"
                    min={1}
                    aria-label="Cantidad"
                    className="w-16 rounded-md border border-black/10 bg-white px-2 py-1 text-sm text-neutral-800"
                    value={l.cantidad}
                    onChange={(e) => actualizar(l.key, { cantidad: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  />
                  <span className="text-neutral-500">×</span>
                  <input
                    type="number"
                    min={0}
                    aria-label="Precio unitario"
                    className="w-24 rounded-md border border-black/10 bg-white px-2 py-1 text-sm text-neutral-800"
                    value={l.precio}
                    onChange={(e) => actualizar(l.key, { precio: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  />
                  <span className="w-24 text-right text-sm font-semibold text-neutral-100">{fmtCLP(Math.round(l.cantidad * l.precio))}</span>
                  <button type="button" onClick={() => quitar(l.key)} aria-label="Quitar" className="text-neutral-500 hover:text-red-600">✕</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Columna derecha: cobro ── */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <section className={`${card} space-y-4`}>
          <p className={sectionLabel}>Cobro</p>

          {/* Cliente opcional */}
          <div className="relative">
            <label className={labelClass}>Cliente (opcional)</label>
            {clienteId ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm">
                <span className="truncate text-neutral-200">{clienteNombre}</span>
                <button type="button" onClick={() => { setClienteId(null); setClienteNombre(''); setCq('') }} className="text-neutral-500 hover:text-red-600">✕</button>
              </div>
            ) : (
              <>
                <input className={inputClass} placeholder="Buscar cliente o dejar como venta de paso…" value={cq} onChange={(e) => buscarCliente(e.target.value)} />
                {cq.trim().length >= 2 && cResultados.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-black/10 bg-neutral-900 shadow-xl shadow-black/20">
                    {cResultados.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setClienteId(c.id); setClienteNombre(c.nombre); setCResultados([]) }}
                        className="block w-full px-3 py-2 text-left text-sm text-neutral-100 hover:bg-black/[0.05]"
                      >
                        {c.nombre}
                        {c.rut && <span className="ml-1 text-xs text-neutral-500">{c.rut}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className={labelClass}>Método de pago</label>
            <select className={inputClass} value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}>
              {METODOS_PAGO.map((m) => <option key={m} value={m}>{METODO_PAGO_LABEL[m]}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Notas (opcional)</label>
            <input className={inputClass} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          <div className="space-y-1 border-t border-black/[0.06] pt-3 text-sm">
            <div className="flex justify-between text-neutral-500"><span>Neto</span><span>{fmtCLP(neto)}</span></div>
            <div className="flex justify-between text-neutral-500"><span>IVA (19%)</span><span>{fmtCLP(iva)}</span></div>
            <div className="flex justify-between text-lg font-bold text-neutral-50"><span>Total</span><span>{fmtCLP(total)}</span></div>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button type="button" className={`${btnPrimary} w-full justify-center`} onClick={() => void registrar()} disabled={guardando || lineas.length === 0}>
            {guardando ? 'Registrando…' : `Registrar venta · ${fmtCLP(total)}`}
          </button>
        </section>
      </aside>
    </div>
  )
}
