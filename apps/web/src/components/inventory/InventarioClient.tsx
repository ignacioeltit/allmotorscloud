'use client'

import { useState, useEffect, useTransition, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createRepuesto, softDeleteRepuesto } from '@/modules/inventory/mutations'
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
    <form onSubmit={submit} className="rounded-xl border border-black/[0.08] bg-neutral-900/70 p-5">
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
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
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

// ── Paginación ─────────────────────────────────────────────────────────────

interface PaginacionProps {
  currentPage: number
  totalPages: number
  total: number
  pageSize: number
  onPage: (p: number) => void
  loading: boolean
}

function Paginacion({ currentPage, totalPages, total, pageSize, onPage, loading }: PaginacionProps) {
  const from = Math.min((currentPage - 1) * pageSize + 1, total)
  const to   = Math.min(currentPage * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.05] pt-4">
      <p className="text-xs text-neutral-500">
        {total === 0 ? 'Sin resultados' : `Mostrando ${from}–${to} de ${total.toLocaleString('es-CL')}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
          className={`${btnSecondary} px-3 py-1.5 text-xs disabled:opacity-30`}
        >
          ← Anterior
        </button>
        <span className="min-w-[4rem] text-center text-xs text-neutral-400">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPage(currentPage + 1)}
          disabled={currentPage >= totalPages || loading}
          className={`${btnSecondary} px-3 py-1.5 text-xs disabled:opacity-30`}
        >
          Siguiente →
        </button>
      </div>
    </div>
  )
}

// ── Vista principal ────────────────────────────────────────────────────────

interface InventarioClientProps {
  repuestos: Repuesto[]
  total: number
  currentPage: number
  pageSize: number
  totalPages: number
  initialSearch: string
}

export function InventarioClient({
  repuestos,
  total,
  currentPage,
  pageSize,
  totalPages,
  initialSearch,
}: InventarioClientProps) {
  const router   = useRouter()
  const pathname = usePathname()

  const [inputValue, setInputValue]   = useState(initialSearch)
  const [showForm, setShowForm]       = useState(false)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [navigating, setNavigating]   = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync inputValue cuando el servidor devuelve nueva búsqueda (ej: volver al listado)
  useEffect(() => {
    setInputValue(initialSearch)
  }, [initialSearch])

  const navigate = useCallback(
    (search: string, page: number) => {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (page > 1)      params.set('page', String(page))
      const qs = params.toString()
      setNavigating(true)
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`)
    },
    [router, pathname],
  )

  function handleSearchChange(value: string) {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      navigate(value, 1)
    }, 300)
  }

  function handlePage(p: number) {
    navigate(inputValue, p)
  }

  // Quitar spinner de navegación cuando cambia la data del servidor
  useEffect(() => {
    setNavigating(false)
  }, [repuestos])

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

  const countBajoStock = repuestos.filter(
    (r) => calcularEstadoStock(r.stock_actual, r.stock_minimo) !== 'en_stock',
  ).length

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">Inventario</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {total.toLocaleString('es-CL')} repuesto{total !== 1 ? 's' : ''} en catálogo
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

      {/* Búsqueda server-side */}
      <div className="relative">
        <input
          className={inputClass}
          placeholder="Buscar por código, nombre, marca o proveedor…"
          value={inputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        {navigating && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500 animate-pulse">
            Buscando…
          </span>
        )}
      </div>

      {/* Alertas bajo stock — solo en sin filtro */}
      {!initialSearch && countBajoStock > 0 && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] px-4 py-2.5">
          <p className="text-xs font-semibold text-yellow-700">
            {repuestos.filter((r) => calcularEstadoStock(r.stock_actual, r.stock_minimo) === 'sin_stock').length} sin stock
            {' · '}
            {repuestos.filter((r) => calcularEstadoStock(r.stock_actual, r.stock_minimo) === 'bajo_stock').length} bajo mínimo
            {' · '}
            <span className="font-normal text-yellow-500/70">solo en esta página</span>
          </p>
        </div>
      )}

      {deleteError && (
        <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm text-red-700">
          {deleteError}
        </p>
      )}

      {/* Lista */}
      <div className={`transition-opacity duration-150 ${navigating ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
        {repuestos.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-neutral-500">
              {initialSearch ? (
                <>Sin resultados para <span className="font-mono text-neutral-300">{initialSearch}</span>.</>
              ) : (
                'Sin repuestos en el catálogo.'
              )}
            </p>
            {initialSearch && (
              <p className="mt-1 text-xs text-neutral-700">
                Verifica el código o nombre. Puedes crear el repuesto con el botón + Nuevo repuesto.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    {['Código', 'Nombre', 'Marca', 'Categoría', 'Stock', 'Precio venta', ''].map((h) => (
                      <th key={h} className="pb-2.5 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500 first:pl-0">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {repuestos.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-b border-black/[0.03] hover:bg-black/[0.02]"
                      onClick={() => router.push(`/inventory/${r.id}`)}
                    >
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
                          onClick={(e) => { e.stopPropagation(); void eliminar(r.id) }}
                          disabled={deletingId === r.id}
                          className={`${btnGhost} px-2 py-1 text-xs text-red-700 hover:text-red-800`}
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

            <Paginacion
              currentPage={currentPage}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPage={handlePage}
              loading={navigating}
            />
          </>
        )}
      </div>
    </div>
  )
}
