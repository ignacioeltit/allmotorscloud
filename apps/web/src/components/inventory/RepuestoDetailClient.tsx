'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateRepuesto, registrarMovimientoStock } from '@/modules/inventory/mutations'
import { calcularEstadoStock } from '@/modules/inventory/queries'
import type { Repuesto, MovimientoStock, RepuestoUpdateInput } from '@/modules/inventory/types'
import type { UsoEnOt } from '@/modules/inventory/queries'
import {
  CATEGORIAS_REPUESTO,
  CATEGORIA_LABEL,
  UNIDADES_MEDIDA,
  UNIDADES_MEDIDA_LABEL,
  ESTADO_STOCK_LABEL,
  ESTADO_STOCK_CLASS,
  TIPO_MOVIMIENTO_LABEL,
} from '@/modules/inventory/constants'
import {
  card,
  sectionLabel,
  inputClass,
  labelClass,
  btnPrimary,
  btnSecondary,
} from '@/components/ui/styles'

// ─── Constante del marcador ───────────────────────────────────────────────────

const PRECIO_ESTIMADO_MARKER = '[PRECIO ESTIMADO]'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCLP(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function esEstimado(rep: Repuesto): boolean {
  return !!rep.descripcion?.includes(PRECIO_ESTIMADO_MARKER)
}

// ─── Stock Badge ──────────────────────────────────────────────────────────────

function StockBadge({ stock, minimo }: { stock: number; minimo: number }) {
  const estado = calcularEstadoStock(stock, minimo)
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${ESTADO_STOCK_CLASS[estado]}`}>
      {ESTADO_STOCK_LABEL[estado]}
    </span>
  )
}

// ─── Sección de información ────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-[2rem] items-start gap-3 border-b border-white/[0.04] py-2.5 last:border-0">
      <span className="w-36 shrink-0 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="text-sm text-neutral-200">{value || <span className="text-neutral-600">—</span>}</span>
    </div>
  )
}

// ─── Form ajuste de stock ──────────────────────────────────────────────────────

interface AjusteStockFormProps {
  repuestoId: string
  stockActual: number
  onDone: () => void
  onCancel: () => void
}

function AjusteStockForm({ repuestoId, stockActual, onDone, onCancel }: AjusteStockFormProps) {
  const [tipo, setTipo] = useState<'entrada' | 'salida' | 'ajuste'>('entrada')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const cant = parseFloat(cantidad)
    if (isNaN(cant) || cant <= 0) {
      setErr('La cantidad debe ser mayor a 0.')
      return
    }
    setErr(null)
    startTransition(async () => {
      try {
        const supabase = createClient()
        await registrarMovimientoStock(supabase, {
          repuesto_id: repuestoId,
          tipo,
          cantidad: cant,
          stock_antes: stockActual,
          motivo: motivo.trim() || undefined,
        })
        onDone()
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Error al registrar movimiento.')
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-white/[0.08] bg-neutral-900/70 p-4">
      <p className={`${sectionLabel} mb-1`}>Ajustar stock</p>
      <p className="text-xs text-neutral-500">Stock actual: <span className="font-semibold text-neutral-300">{stockActual}</span></p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Tipo de movimiento</label>
          <select className={inputClass} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} disabled={pending}>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Cantidad</label>
          <input className={inputClass} type="number" min="0.001" step="0.001" placeholder="0"
            value={cantidad} onChange={(e) => setCantidad(e.target.value)} disabled={pending} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Motivo (opcional)</label>
        <input className={inputClass} placeholder="ej: Compra a proveedor, Inventario físico…"
          value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={pending} />
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? 'Guardando…' : 'Registrar'}
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={pending}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Form de edición ──────────────────────────────────────────────────────────

interface EditFormProps {
  repuesto: Repuesto
  onSaved: (updated: Repuesto) => void
  onCancel: () => void
}

function EditForm({ repuesto, onSaved, onCancel }: EditFormProps) {
  const [fields, setFields] = useState<RepuestoUpdateInput>({
    nombre:       repuesto.nombre,
    descripcion:  repuesto.descripcion ?? undefined,
    proveedor:    repuesto.proveedor   ?? undefined,
    categoria:    repuesto.categoria   ?? undefined,
    marca:        repuesto.marca       ?? undefined,
    precio_costo: repuesto.precio_costo ?? undefined,
    precio_venta: repuesto.precio_venta ?? undefined,
    stock_minimo: repuesto.stock_minimo,
    activo:       repuesto.activo,
  })
  const [priceEdited, setPriceEdited] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function set<K extends keyof RepuestoUpdateInput>(k: K, v: RepuestoUpdateInput[K]) {
    setFields((prev) => ({ ...prev, [k]: v }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!fields.nombre?.trim()) { setErr('El nombre es obligatorio.'); return }
    setErr(null)

    const updates = { ...fields }

    // Si el usuario cambió precio_venta manualmente: eliminar marcador estimado
    if (priceEdited && repuesto.descripcion?.includes(PRECIO_ESTIMADO_MARKER)) {
      const cleaned = (fields.descripcion ?? '')
        .replace(/\[PRECIO ESTIMADO\][^\n]*/g, '')
        .trim()
      updates.descripcion = cleaned || undefined
    }

    startTransition(async () => {
      try {
        const supabase = createClient()
        const updated = await updateRepuesto(supabase, repuesto.id, updates)
        onSaved(updated)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Error al guardar.')
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>Nombre *</label>
          <input className={inputClass} value={fields.nombre ?? ''}
            onChange={(e) => set('nombre', e.target.value)} disabled={pending} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Descripción</label>
          <textarea className={`${inputClass} min-h-[72px] resize-y`}
            value={fields.descripcion ?? ''}
            onChange={(e) => set('descripcion', e.target.value || undefined)}
            disabled={pending} />
          {repuesto.descripcion?.includes(PRECIO_ESTIMADO_MARKER) && (
            <p className="mt-1 text-[11px] text-amber-500/70">
              Contiene marcador [PRECIO ESTIMADO]. Si cambias el precio de venta, se eliminará automáticamente.
            </p>
          )}
        </div>
        <div>
          <label className={labelClass}>Marca</label>
          <input className={inputClass} value={fields.marca ?? ''}
            onChange={(e) => set('marca', e.target.value || undefined)} disabled={pending} />
        </div>
        <div>
          <label className={labelClass}>Proveedor</label>
          <input className={inputClass} value={fields.proveedor ?? ''}
            onChange={(e) => set('proveedor', e.target.value || undefined)} disabled={pending} />
        </div>
        <div>
          <label className={labelClass}>Categoría</label>
          <select className={inputClass} value={fields.categoria ?? ''}
            onChange={(e) => set('categoria', e.target.value || undefined)} disabled={pending}>
            <option value="">Sin categoría</option>
            {CATEGORIAS_REPUESTO.map((c) => (
              <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Unidad</label>
          <select className={inputClass} value={fields.unidad ?? repuesto.unidad}
            onChange={(e) => set('unidad', e.target.value as typeof UNIDADES_MEDIDA[number])} disabled={pending}>
            {UNIDADES_MEDIDA.map((u) => (
              <option key={u} value={u}>{UNIDADES_MEDIDA_LABEL[u]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Precio costo (CLP)</label>
          <input className={inputClass} type="number" min="0" step="1"
            value={fields.precio_costo ?? ''}
            onChange={(e) => set('precio_costo', e.target.value ? Number(e.target.value) : undefined)}
            disabled={pending} />
        </div>
        <div>
          <label className={labelClass}>Precio venta (CLP)</label>
          <input className={inputClass} type="number" min="0" step="1"
            value={fields.precio_venta ?? ''}
            onChange={(e) => {
              set('precio_venta', e.target.value ? Number(e.target.value) : undefined)
              if (Number(e.target.value) !== repuesto.precio_venta) setPriceEdited(true)
            }}
            disabled={pending} />
          {priceEdited && repuesto.descripcion?.includes(PRECIO_ESTIMADO_MARKER) && (
            <p className="mt-1 text-[11px] text-green-500/80">
              El precio pasa a ser oficial. Marcador estimado se eliminará al guardar.
            </p>
          )}
        </div>
        <div>
          <label className={labelClass}>Stock mínimo (alerta)</label>
          <input className={inputClass} type="number" min="0" step="0.001"
            value={fields.stock_minimo ?? 0}
            onChange={(e) => set('stock_minimo', Number(e.target.value))}
            disabled={pending} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input id="activo" type="checkbox" className="h-4 w-4 rounded border-white/20 accent-accent-500"
            checked={fields.activo ?? true}
            onChange={(e) => set('activo', e.target.checked)}
            disabled={pending} />
          <label htmlFor="activo" className={labelClass + ' mb-0'}>Activo en catálogo</label>
        </div>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={pending}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────

interface Props {
  repuesto: Repuesto
  movimientos: MovimientoStock[]
  usosEnOts: UsoEnOt[]
}

export function RepuestoDetailClient({ repuesto: initialRepuesto, movimientos, usosEnOts }: Props) {
  const router = useRouter()
  const [repuesto, setRepuesto] = useState<Repuesto>(initialRepuesto)
  const [mode, setMode] = useState<'view' | 'edit' | 'ajuste'>('view')

  const margenAbs = repuesto.precio_venta != null && repuesto.precio_costo != null
    ? repuesto.precio_venta - repuesto.precio_costo : null
  const margenPct = margenAbs != null && repuesto.precio_costo != null && repuesto.precio_costo > 0
    ? Math.round((margenAbs / repuesto.precio_costo) * 100) : null
  const precioEst = esEstimado(repuesto)

  function handleSaved(updated: Repuesto) {
    setRepuesto(updated)
    setMode('view')
    router.refresh()
  }

  function handleAjusteDone() {
    setMode('view')
    router.refresh()
  }

  return (
    <div className="space-y-6">

      {/* Navegación */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/inventory" className="text-neutral-500 hover:text-neutral-300 transition-colors">
          ← Inventario
        </Link>
        <span className="text-neutral-700">/</span>
        <span className="text-neutral-400">{repuesto.codigo}</span>
      </div>

      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">{repuesto.nombre}</h1>
          <p className="mt-0.5 font-mono text-sm text-neutral-500">{repuesto.codigo}</p>
          {!repuesto.activo && (
            <span className="mt-1.5 inline-block rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400">
              Inactivo
            </span>
          )}
        </div>
        {mode === 'view' && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setMode('edit')} className={btnPrimary}>
              Editar
            </button>
            <button onClick={() => setMode('ajuste')} className={btnSecondary}>
              Ajustar stock
            </button>
          </div>
        )}
      </div>

      {/* Banner precio estimado */}
      {precioEst && mode === 'view' && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3">
          <p className="text-sm font-medium text-amber-400">
            ⚠ Precio de venta estimado automáticamente
          </p>
          <p className="mt-0.5 text-xs text-amber-500/80">
            Calculado con margen 40% sobre costo al importar desde TallerGP.
            Edita el repuesto y cambia el precio de venta para marcarlo como oficial.
          </p>
        </div>
      )}

      {/* Form edición */}
      {mode === 'edit' && (
        <div className={card}>
          <p className={`${sectionLabel} mb-4`}>Editar repuesto</p>
          <EditForm
            repuesto={repuesto}
            onSaved={handleSaved}
            onCancel={() => setMode('view')}
          />
        </div>
      )}

      {/* Form ajuste stock */}
      {mode === 'ajuste' && (
        <AjusteStockForm
          repuestoId={repuesto.id}
          stockActual={repuesto.stock_actual}
          onDone={handleAjusteDone}
          onCancel={() => setMode('view')}
        />
      )}

      {mode === 'view' && (
        <>
          {/* Grid: Información + Precios + Stock */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

            {/* Información */}
            <div className={`${card} lg:col-span-2`}>
              <p className={`${sectionLabel} mb-2`}>Información</p>
              <InfoRow label="Código" value={<span className="font-mono">{repuesto.codigo}</span>} />
              <InfoRow label="Nombre" value={repuesto.nombre} />
              <InfoRow label="Descripción" value={
                repuesto.descripcion
                  ? repuesto.descripcion.replace(/\[PRECIO ESTIMADO\][^\n]*/g, '').trim() || null
                  : null
              } />
              <InfoRow label="Categoría" value={repuesto.categoria ? (CATEGORIA_LABEL[repuesto.categoria] ?? repuesto.categoria) : null} />
              <InfoRow label="Marca" value={repuesto.marca} />
              <InfoRow label="Proveedor" value={repuesto.proveedor} />
              <InfoRow label="Unidad" value={UNIDADES_MEDIDA_LABEL[repuesto.unidad] ?? repuesto.unidad} />
              <InfoRow label="Origen precio" value={
                precioEst
                  ? <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-medium text-amber-400">Estimado TallerGP ×1.40</span>
                  : <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-medium text-sky-400">Importado / manual</span>
              } />
            </div>

            {/* Precios + Stock stacked */}
            <div className="flex flex-col gap-4">
              {/* Precios */}
              <div className={card}>
                <p className={`${sectionLabel} mb-2`}>Precios</p>
                <InfoRow label="Costo" value={fmtCLP(repuesto.precio_costo)} />
                <InfoRow label="Venta" value={
                  <span className="font-semibold text-neutral-100">{fmtCLP(repuesto.precio_venta)}</span>
                } />
                <InfoRow label="Margen $" value={margenAbs != null ? fmtCLP(margenAbs) : null} />
                <InfoRow label="Margen %" value={margenPct != null ? `${margenPct}%` : null} />
              </div>

              {/* Stock */}
              <div className={card}>
                <p className={`${sectionLabel} mb-2`}>Stock</p>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-3xl font-bold tabular-nums text-neutral-100">
                    {repuesto.stock_actual}
                  </span>
                  <StockBadge stock={repuesto.stock_actual} minimo={repuesto.stock_minimo} />
                </div>
                <InfoRow label="Stock mínimo" value={String(repuesto.stock_minimo)} />
                <InfoRow label="Diferencia" value={
                  <span className={repuesto.stock_actual - repuesto.stock_minimo >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {repuesto.stock_actual - repuesto.stock_minimo >= 0 ? '+' : ''}
                    {(repuesto.stock_actual - repuesto.stock_minimo).toFixed(repuesto.stock_minimo % 1 !== 0 ? 3 : 0)}
                  </span>
                } />
                <InfoRow label="Estado" value={<StockBadge stock={repuesto.stock_actual} minimo={repuesto.stock_minimo} />} />
              </div>
            </div>
          </div>

          {/* Movimientos de stock */}
          <div className={card}>
            <p className={`${sectionLabel} mb-3`}>Movimientos de stock</p>
            {movimientos.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-neutral-600">Sin movimientos registrados.</p>
                <p className="mt-1 text-xs text-neutral-700">
                  Los movimientos se generan al usar este repuesto en una OT o al ajustar stock.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['Fecha', 'Tipo', 'Cantidad', 'Stock antes', 'Stock después', 'Motivo'].map((h) => (
                        <th key={h} className="pb-2.5 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m) => (
                      <tr key={m.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-4 text-xs text-neutral-500 whitespace-nowrap">
                          {fmtDatetime(m.creado_en)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            m.tipo === 'entrada' || m.tipo === 'devolucion'
                              ? 'border-green-500/25 bg-green-500/10 text-green-400'
                              : m.tipo === 'consumo_ot' || m.tipo === 'salida'
                              ? 'border-red-500/25 bg-red-500/10 text-red-400'
                              : 'border-neutral-500/25 bg-neutral-500/10 text-neutral-400'
                          }`}>
                            {TIPO_MOVIMIENTO_LABEL[m.tipo] ?? m.tipo}
                          </span>
                        </td>
                        <td className={`py-2.5 pr-4 font-mono text-sm font-medium tabular-nums ${
                          m.tipo === 'entrada' || m.tipo === 'devolucion' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {m.tipo === 'entrada' || m.tipo === 'devolucion' ? '+' : '-'}{m.cantidad}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-neutral-500 tabular-nums">
                          {m.stock_antes}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-neutral-300 tabular-nums">
                          {m.stock_despues}
                        </td>
                        <td className="py-2.5 text-xs text-neutral-500">
                          {m.motivo ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* OTs donde se usó */}
          <div className={card}>
            <p className={`${sectionLabel} mb-3`}>Órdenes de trabajo donde se utilizó</p>
            {usosEnOts.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-neutral-600">No se ha utilizado en ninguna OT aún.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['OT', 'Descripción', 'Cantidad', 'Total', 'Fecha'].map((h) => (
                        <th key={h} className="pb-2.5 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usosEnOts.map((uso) => (
                      <tr key={uso.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-4">
                          {uso.ot_id ? (
                            <Link
                              href={`/repair-orders/${uso.ot_id}`}
                              className="font-mono text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
                            >
                              {uso.ot_numero ?? uso.ot_id.slice(0, 8)}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-neutral-600">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-neutral-300">{uso.descripcion}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs tabular-nums text-neutral-400">
                          {uso.cantidad}
                        </td>
                        <td className="py-2.5 pr-4 text-sm font-medium text-neutral-200">
                          {fmtCLP(uso.costo_total)}
                        </td>
                        <td className="py-2.5 text-xs text-neutral-500 whitespace-nowrap">
                          {fmtDate(uso.creado_en)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Metadatos */}
          <div className="text-xs text-neutral-700 space-y-0.5">
            <p>Creado: {fmtDatetime(repuesto.creado_en)}</p>
            <p>Actualizado: {fmtDatetime(repuesto.actualizado_en)}</p>
          </div>
        </>
      )}
    </div>
  )
}
