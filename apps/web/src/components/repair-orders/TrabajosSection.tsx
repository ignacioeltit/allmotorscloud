'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { crearReparacion, addItemReparacion, softDeleteItemReparacion } from '@/modules/reparaciones/mutations'
import { TIPOS_ITEM_REPARACION, TIPOS_ITEM_LABEL } from '@/modules/reparaciones/constants'
import type { ReparacionConItems } from '@/modules/reparaciones/types'
import type { MecanicoSimple } from '@/modules/users/types'
import { searchRepuestos } from '@/modules/inventory/queries'
import { consumirStockParaOT } from '@/modules/inventory/mutations'
import type { RepuestoResumen } from '@/modules/inventory/types'
import { ESTADO_STOCK_LABEL, ESTADO_STOCK_CLASS } from '@/modules/inventory/constants'
import {
  card,
  sectionLabel,
  inputClass,
  labelClass,
  btnPrimary,
  btnSecondary,
  btnGhost,
} from '@/components/ui/styles'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function fmtCLPShort(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function StockBadge({ estado }: { estado: string }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${ESTADO_STOCK_CLASS[estado] ?? ''}`}>
      {ESTADO_STOCK_LABEL[estado] ?? estado}
    </span>
  )
}

interface AgregarItemFormProps {
  reparacionId: string
  onDone: () => void
  onCancel: () => void
}

function AgregarItemForm({ reparacionId, onDone, onCancel }: AgregarItemFormProps) {
  const [tipo, setTipo] = useState<'mano_obra' | 'repuesto'>('mano_obra')
  const [descripcion, setDescripcion] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [costoUnitario, setCostoUnitario] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Inventario: estado de búsqueda
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<RepuestoResumen[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedRepuesto, setSelectedRepuesto] = useState<RepuestoResumen | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search cuando tipo='repuesto'
  useEffect(() => {
    if (tipo !== 'repuesto') { setSearchResults([]); return }
    if (!searchQuery.trim()) { setSearchResults([]); setShowDropdown(false); return }

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    setSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const supabase = createClient()
        const results = await searchRepuestos(supabase, searchQuery)
        setSearchResults(results)
        setShowDropdown(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchQuery, tipo])

  function selectRepuesto(r: RepuestoResumen) {
    setSelectedRepuesto(r)
    setDescripcion(r.nombre + (r.marca ? ` — ${r.marca}` : ''))
    setCostoUnitario(String(r.precio_venta ?? ''))
    setShowDropdown(false)
    setSearchQuery('')
  }

  function clearRepuesto() {
    setSelectedRepuesto(null)
    setDescripcion('')
    setCostoUnitario('')
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const cantNum = parseFloat(cantidad)
    const costoNum = parseFloat(costoUnitario)
    if (!descripcion.trim() || isNaN(cantNum) || cantNum <= 0 || isNaN(costoNum) || costoNum < 0) {
      setError('Completa todos los campos correctamente.')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const supabase = createClient()
        const newItem = await addItemReparacion(supabase, {
          reparacionId,
          tipo,
          descripcion: descripcion.trim(),
          cantidad: cantNum,
          costoUnitario: costoNum,
          ...(selectedRepuesto ? { repuestoId: selectedRepuesto.id } : {}),
        })
        // Si hay repuesto con stock, registrar consumo
        if (selectedRepuesto && selectedRepuesto.stock_actual > 0) {
          try {
            await consumirStockParaOT(supabase, {
              repuestoId: selectedRepuesto.id,
              itemReparacionId: newItem.id,
              cantidad: cantNum,
              stockActual: selectedRepuesto.stock_actual,
              descripcion: descripcion.trim(),
            })
          } catch {
            // El consumo de stock falla silenciosamente — no bloquea la OT
          }
        }
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al agregar ítem.')
      }
    })
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 rounded-lg border border-white/[0.06] bg-neutral-950/40 p-4"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Nuevo ítem
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Tipo</label>
          <select
            className={inputClass}
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as typeof tipo)
              clearRepuesto()
              setSearchQuery('')
            }}
            disabled={pending}
          >
            {TIPOS_ITEM_REPARACION.map((t) => (
              <option key={t} value={t}>
                {TIPOS_ITEM_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Repuesto: búsqueda en inventario */}
        {tipo === 'repuesto' && !selectedRepuesto && (
          <div className="relative sm:col-span-1">
            <label className={labelClass}>Buscar en inventario</label>
            <input
              className={inputClass}
              placeholder="Código o nombre del repuesto…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={pending}
              autoComplete="off"
            />
            {searching && (
              <p className="mt-1 text-[11px] text-neutral-500">Buscando…</p>
            )}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/[0.08] bg-neutral-900 shadow-xl">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectRepuesto(r)}
                    className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-white/[0.04] first:rounded-t-lg last:rounded-b-lg"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-100">{r.nombre}</p>
                      <p className="text-[11px] text-neutral-500">
                        {r.codigo}{r.marca ? ` · ${r.marca}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <p className="text-xs font-medium text-neutral-200">{fmtCLPShort(r.precio_venta)}</p>
                        {r.descripcion?.includes('[PRECIO ESTIMADO]') && (
                          <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-400">
                            EST
                          </span>
                        )}
                      </div>
                      <StockBadge estado={r.estado_stock} />
                    </div>
                  </button>
                ))}
                {searchResults.length === 8 && (
                  <p className="px-3 py-1.5 text-[10px] text-neutral-600">Mostrando los primeros 8 resultados</p>
                )}
              </div>
            )}
            {showDropdown && searchResults.length === 0 && !searching && searchQuery.trim() && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/[0.08] bg-neutral-900 px-3 py-2.5 text-sm text-neutral-500">
                Sin resultados. Puedes completar los datos manualmente.
              </div>
            )}
          </div>
        )}

        {/* Repuesto seleccionado */}
        {tipo === 'repuesto' && selectedRepuesto && (
          <div className="sm:col-span-1">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-100">{selectedRepuesto.nombre}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="text-[11px] text-neutral-500">{selectedRepuesto.codigo}</p>
                  <StockBadge estado={selectedRepuesto.estado_stock} />
                </div>
              </div>
              <button
                type="button"
                onClick={clearRepuesto}
                className={`${btnGhost} shrink-0 px-2 py-1 text-xs text-neutral-500`}
              >
                ×
              </button>
            </div>
            {selectedRepuesto.descripcion?.includes('[PRECIO ESTIMADO]') && (
              <p className="mt-1.5 rounded-md border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-1.5 text-[11px] leading-snug text-amber-400">
                ⚠ Precio estimado automáticamente con 40% sobre costo. Revisar antes de aprobar presupuesto.
              </p>
            )}
          </div>
        )}

        <div className={tipo === 'repuesto' && !selectedRepuesto ? 'sm:col-span-2' : ''}>
          <label className={labelClass}>Descripción</label>
          <input
            className={inputClass}
            placeholder="ej: Pastillas de freno delanteras Bosch…"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>Cantidad</label>
          <input
            className={inputClass}
            type="number"
            min="0.001"
            step="0.001"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>Precio venta unitario (CLP)</label>
          <input
            className={inputClass}
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={costoUnitario}
            onChange={(e) => setCostoUnitario(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? 'Guardando…' : 'Agregar ítem'}
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={pending}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

interface AgregarTrabajoFormProps {
  ordenTrabajoId: string
  historiaId: string
  tipoEventoId: string
  mecanicos: MecanicoSimple[]
  onDone: () => void
  onCancel: () => void
}

function AgregarTrabajoForm({
  ordenTrabajoId,
  historiaId,
  tipoEventoId,
  mecanicos,
  onDone,
  onCancel,
}: AgregarTrabajoFormProps) {
  const [descripcion, setDescripcion] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [mecanicoId, setMecanicoId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const supabase = createClient()
        await crearReparacion(supabase, {
          ordenTrabajoId,
          historiaId,
          tipoEventoId,
          descripcion: descripcion.trim() || undefined,
          observaciones: observaciones.trim() || undefined,
          mecanicoId: mecanicoId || undefined,
        })
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al crear el trabajo.')
      }
    })
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-white/[0.06] bg-neutral-900/50 p-5"
    >
      <p className={`${sectionLabel} mb-4`}>Nuevo trabajo técnico</p>
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Descripción del trabajo</label>
          <input
            className={inputClass}
            placeholder="ej: Revisión de frenos, Cambio de aceite…"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>Diagnóstico / observaciones internas</label>
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            placeholder="Notas del mecánico, diagnóstico encontrado…"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            disabled={pending}
          />
        </div>
        {mecanicos.length > 0 && (
          <div>
            <label className={labelClass}>Mecánico asignado</label>
            <select
              className={inputClass}
              value={mecanicoId}
              onChange={(e) => setMecanicoId(e.target.value)}
              disabled={pending}
            >
              <option value="">Sin asignar</option>
              {mecanicos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? 'Creando…' : 'Crear trabajo'}
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={pending}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

interface TrabajoCardProps {
  reparacion: ReparacionConItems
  mecanicos: MecanicoSimple[]
  onChanged: () => void
}

function TrabajoCard({ reparacion, mecanicos, onChanged }: TrabajoCardProps) {
  const [showAddItem, setShowAddItem] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function eliminarItem(itemId: string) {
    setDeletingId(itemId)
    setDeleteError(null)
    try {
      const supabase = createClient()
      await softDeleteItemReparacion(supabase, itemId)
      onChanged()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Error al eliminar el ítem.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className={`${card} space-y-4`}>
      <div>
        <p className="font-semibold text-neutral-100">
          {reparacion.descripcion || 'Trabajo técnico'}
        </p>
        {reparacion.observaciones && (
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-neutral-400">
            {reparacion.observaciones}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <p className="text-[11px] text-neutral-600">
            {new Date(reparacion.creado_en).toLocaleString('es-CL', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
          {reparacion.mecanico_id && (() => {
            const m = mecanicos.find((x) => x.id === reparacion.mecanico_id)
            return m ? (
              <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400">
                {m.nombre}
              </span>
            ) : null
          })()}
        </div>
      </div>

      {reparacion.items.length > 0 && (
        <div className="space-y-1.5">
          <p className={`${sectionLabel} mb-1`}>Ítems</p>
          {reparacion.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2"
            >
              <div className="min-w-0">
                <span className="mr-2 rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[10px] text-neutral-500">
                  {TIPOS_ITEM_LABEL[item.tipo]}
                </span>
                <span className="text-sm text-neutral-200">{item.descripcion}</span>
                {item.cantidad !== 1 && (
                  <span className="ml-2 text-xs text-neutral-600">× {item.cantidad}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-medium text-neutral-300">{fmtCLP(item.costo_total)}</span>
                <button
                  onClick={() => void eliminarItem(item.id)}
                  disabled={deletingId === item.id}
                  className={`${btnGhost} px-2 py-1 text-red-400 hover:text-red-300`}
                  title="Eliminar ítem"
                >
                  {deletingId === item.id ? '…' : '×'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}

      {showAddItem ? (
        <AgregarItemForm
          reparacionId={reparacion.id}
          onDone={() => { setShowAddItem(false); onChanged() }}
          onCancel={() => setShowAddItem(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddItem(true)}
          className={`${btnGhost} text-xs`}
        >
          + Agregar ítem
        </button>
      )}
    </div>
  )
}

interface TrabajosSectionProps {
  ordenTrabajoId: string
  historiaId: string
  tipoEventoReparacionId: string | null
  initialReparaciones: ReparacionConItems[]
  mecanicos: MecanicoSimple[]
}

export function TrabajosSection({
  ordenTrabajoId,
  historiaId,
  tipoEventoReparacionId,
  initialReparaciones,
  mecanicos,
}: TrabajosSectionProps) {
  const router = useRouter()
  const [showAddTrabajo, setShowAddTrabajo] = useState(false)

  function refresh() {
    router.refresh()
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={sectionLabel}>Trabajos realizados</p>
        {tipoEventoReparacionId && !showAddTrabajo && (
          <button
            onClick={() => setShowAddTrabajo(true)}
            className={`${btnPrimary} py-1.5 text-xs`}
          >
            + Agregar trabajo
          </button>
        )}
      </div>

      {!tipoEventoReparacionId && (
        <p className="text-sm text-neutral-500">
          Configura los tipos de evento del taller para registrar trabajos.
        </p>
      )}

      {showAddTrabajo && tipoEventoReparacionId && (
        <AgregarTrabajoForm
          ordenTrabajoId={ordenTrabajoId}
          historiaId={historiaId}
          tipoEventoId={tipoEventoReparacionId}
          mecanicos={mecanicos}
          onDone={() => { setShowAddTrabajo(false); refresh() }}
          onCancel={() => setShowAddTrabajo(false)}
        />
      )}

      {initialReparaciones.length === 0 && !showAddTrabajo && (
        <p className="text-sm text-neutral-600">Sin trabajos registrados aún.</p>
      )}

      {initialReparaciones.map((rep) => (
        <TrabajoCard key={rep.id} reparacion={rep} mecanicos={mecanicos} onChanged={refresh} />
      ))}
    </section>
  )
}
