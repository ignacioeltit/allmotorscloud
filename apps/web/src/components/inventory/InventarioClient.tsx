'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createRepuesto, updateRepuesto, softDeleteRepuesto } from '@/modules/inventory/mutations'
import { calcularEstadoStock } from '@/modules/inventory/queries'
import type { Repuesto, RepuestoCreateInput } from '@/modules/inventory/types'
import {
  CATEGORIAS_REPUESTO,
  CATEGORIA_LABEL,
  UNIDADES_MEDIDA,
  UNIDADES_MEDIDA_LABEL,
  ESTADO_STOCK_LABEL,
  ESTADO_STOCK_CLASS,
} from '@/modules/inventory/constants'
import {
  card,
  sectionLabel,
  inputClass,
  labelClass,
  btnPrimary,
  btnSecondary,
  btnGhost,
} from '@/components/ui/styles'

function fmtCLP(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function StockBadge({ stock, minimo }: { stock: number; minimo: number }) {
  const estado = calcularEstadoStock(stock, minimo)
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${ESTADO_STOCK_CLASS[estado]}`}>
      {stock} — {ESTADO_STOCK_LABEL[estado]}
    </span>
  )
}

// ── Form de creación ───────────────────────────────────────────────────────

interface FormCreateProps {
  onCreated: () => void
  onCancel: () => void
}

function FormCreate({ onCreated, onCancel }: FormCreateProps) {
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [fields, setFields] = useState<Partial<RepuestoCreateInput>>({
    unidad: 'unidad',
    stock_actual: 0,
    stock_minimo: 0,
  })

  function set<K extends keyof RepuestoCreateInput>(k: K, v: RepuestoCreateInput[K]) {
    setFields((prev) => ({ ...prev, [k]: v }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!fields.codigo?.trim() || !fields.nombre?.trim()) {
      setErr('Código y nombre son obligatorios.')
      return
    }
    setErr(null)
    startTransition(async () => {
      try {
        const supabase = createClient()
        await createRepuesto(supabase, {
          codigo: fields.codigo!.trim(),
          nombre: fields.nombre!.trim(),
          marca: fields.marca?.trim() || undefined,
          modelo_aplicacion: fields.modelo_aplicacion?.trim() || undefined,
          categoria: fields.categoria || undefined,
          unidad: fields.unidad ?? 'unidad',
          precio_costo: fields.precio_costo,
          precio_venta: fields.precio_venta,
          stock_actual: fields.stock_actual ?? 0,
          stock_minimo: fields.stock_minimo ?? 0,
          descripcion: fields.descripcion?.trim() || undefined,
          proveedor: fields.proveedor?.trim() || undefined,
        })
        onCreated()
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Error al crear repuesto.')
      }
    })
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/[0.08] bg-neutral-900/70 p-5">
      <p className={`${sectionLabel} mb-4`}>Nuevo repuesto</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelClass}>Código *</label>
          <input className={inputClass} placeholder="ej: PAST-FRENO-DEL" value={fields.codigo ?? ''}
            onChange={(e) => set('codigo', e.target.value)} disabled={pending} />
        </div>
        <div className="lg:col-span-2">
          <label className={labelClass}>Nombre *</label>
          <input className={inputClass} placeholder="ej: Pastillas de freno delanteras" value={fields.nombre ?? ''}
            onChange={(e) => set('nombre', e.target.value)} disabled={pending} />
        </div>
        <div>
          <label className={labelClass}>Marca</label>
          <input className={inputClass} placeholder="ej: Bosch" value={fields.marca ?? ''}
            onChange={(e) => set('marca', e.target.value)} disabled={pending} />
        </div>
        <div>
          <label className={labelClass}>Aplicación</label>
          <input className={inputClass} placeholder="ej: Toyota Corolla" value={fields.modelo_aplicacion ?? ''}
            onChange={(e) => set('modelo_aplicacion', e.target.value)} disabled={pending} />
        </div>
        <div>
          <label className={labelClass}>Categoría</label>
          <select className={inputClass} value={fields.categoria ?? ''} onChange={(e) => set('categoria', e.target.value || undefined)} disabled={pending}>
            <option value="">Sin categoría</option>
            {CATEGORIAS_REPUESTO.map((c) => (
              <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Unidad</label>
          <select className={inputClass} value={fields.unidad ?? 'unidad'} onChange={(e) => set('unidad', e.target.value as RepuestoCreateInput['unidad'])} disabled={pending}>
            {UNIDADES_MEDIDA.map((u) => (
              <option key={u} value={u}>{UNIDADES_MEDIDA_LABEL[u]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Precio costo (CLP)</label>
          <input className={inputClass} type="number" min="0" step="1" placeholder="0"
            value={fields.precio_costo ?? ''} onChange={(e) => set('precio_costo', e.target.value ? Number(e.target.value) : undefined)} disabled={pending} />
        </div>
        <div>
          <label className={labelClass}>Precio venta (CLP)</label>
          <input className={inputClass} type="number" min="0" step="1" placeholder="0"
            value={fields.precio_venta ?? ''} onChange={(e) => set('precio_venta', e.target.value ? Number(e.target.value) : undefined)} disabled={pending} />
        </div>
        <div>
          <label className={labelClass}>Stock inicial</label>
          <input className={inputClass} type="number" min="0" step="0.001"
            value={fields.stock_actual ?? 0} onChange={(e) => set('stock_actual', Number(e.target.value))} disabled={pending} />
        </div>
        <div>
          <label className={labelClass}>Stock mínimo (alerta)</label>
          <input className={inputClass} type="number" min="0" step="0.001"
            value={fields.stock_minimo ?? 0} onChange={(e) => set('stock_minimo', Number(e.target.value))} disabled={pending} />
        </div>
        <div>
          <label className={labelClass}>Proveedor</label>
          <input className={inputClass} placeholder="ej: Distribuidora AMS" value={fields.proveedor ?? ''}
            onChange={(e) => set('proveedor', e.target.value)} disabled={pending} />
        </div>
      </div>
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? 'Creando…' : 'Crear repuesto'}
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={pending}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ── Vista principal ────────────────────────────────────────────────────────

export function InventarioClient({ initialRepuestos }: { initialRepuestos: Repuesto[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return initialRepuestos
    const q = query.toLowerCase()
    return initialRepuestos.filter(
      (r) =>
        r.codigo.toLowerCase().includes(q) ||
        r.nombre.toLowerCase().includes(q) ||
        (r.marca?.toLowerCase().includes(q) ?? false),
    )
  }, [initialRepuestos, query])

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este repuesto del catálogo?')) return
    setDeletingId(id)
    setDeleteError(null)
    try {
      const supabase = createClient()
      await softDeleteRepuesto(supabase, id)
      router.refresh()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Error al eliminar.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">Inventario</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {initialRepuestos.length} repuesto{initialRepuestos.length !== 1 ? 's' : ''} en catálogo
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className={btnPrimary}>
            + Nuevo repuesto
          </button>
        )}
      </div>

      {/* Form creación */}
      {showForm && (
        <FormCreate
          onCreated={() => { setShowForm(false); router.refresh() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Búsqueda */}
      <input
        className={inputClass}
        placeholder="Filtrar por código, nombre o marca…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {deleteError && (
        <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {deleteError}
        </p>
      )}

      {/* Alertas bajo stock */}
      {initialRepuestos.some((r) => calcularEstadoStock(r.stock_actual, r.stock_minimo) !== 'en_stock') && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] px-4 py-2.5">
          <p className="text-xs font-semibold text-yellow-400">
            {initialRepuestos.filter((r) => calcularEstadoStock(r.stock_actual, r.stock_minimo) === 'sin_stock').length} sin stock
            {' · '}
            {initialRepuestos.filter((r) => calcularEstadoStock(r.stock_actual, r.stock_minimo) === 'bajo_stock').length} bajo mínimo
          </p>
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-600">
          {query ? 'Sin resultados para esa búsqueda.' : 'Sin repuestos en el catálogo.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Código', 'Nombre', 'Marca', 'Categoría', 'Stock', 'Precio venta', ''].map((h) => (
                  <th key={h} className="pb-2.5 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500 first:pl-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="py-3 pr-4">
                    <span className="font-mono text-xs text-neutral-300">{r.codigo}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-neutral-100">{r.nombre}</p>
                    {r.modelo_aplicacion && (
                      <p className="text-[11px] text-neutral-600">{r.modelo_aplicacion}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-neutral-400">{r.marca ?? '—'}</td>
                  <td className="py-3 pr-4 text-neutral-500">
                    {r.categoria ? CATEGORIA_LABEL[r.categoria] ?? r.categoria : '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <StockBadge stock={r.stock_actual} minimo={r.stock_minimo} />
                  </td>
                  <td className="py-3 pr-4 font-medium text-neutral-200">{fmtCLP(r.precio_venta)}</td>
                  <td className="py-3">
                    <button
                      onClick={() => void eliminar(r.id)}
                      disabled={deletingId === r.id}
                      className={`${btnGhost} px-2 py-1 text-xs text-red-400 hover:text-red-300`}
                      title="Eliminar repuesto"
                    >
                      {deletingId === r.id ? '…' : 'Eliminar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
