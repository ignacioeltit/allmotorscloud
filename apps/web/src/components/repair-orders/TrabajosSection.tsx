'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { crearReparacion, addItemReparacion, softDeleteItemReparacion, asignarMecanicoReparacion, actualizarCompraItem } from '@/modules/reparaciones/mutations'
import {
  TIPOS_ITEM_REPARACION, TIPOS_ITEM_LABEL,
  ESTADOS_COMPRA, ESTADO_COMPRA_LABEL, ESTADO_COMPRA_BADGE, ESTADOS_COMPRA_PENDIENTES,
  type EstadoCompra,
} from '@/modules/reparaciones/constants'
import type { ReparacionConItems, ItemReparacion } from '@/modules/reparaciones/types'
import type { MecanicoSimple } from '@/modules/users/types'
import { searchRepuestos } from '@/modules/inventory/queries'
import { consumirStockParaOT } from '@/modules/inventory/mutations'
import type { RepuestoResumen } from '@/modules/inventory/types'
import { ESTADO_STOCK_LABEL, ESTADO_STOCK_CLASS } from '@/modules/inventory/constants'
import { buscarServiciosCatalogo, contarServiciosPendientes } from '@/modules/catalogo/queries'
import { crearServicioDesdeOT } from '@/modules/catalogo/mutations'
import type { CatalogoServicio } from '@/modules/catalogo/types'
import { CATEGORIAS_CATALOGO, CATEGORIA_LABEL, CATEGORIA_COLOR } from '@/modules/catalogo/constants'
import type { ConfiguracionManoObra } from '@/modules/taller/types'
import { getValorHoraForServicio } from '@/modules/taller/helpers'
import { FichaIngresoTrabajos } from './FichaIngresoTrabajos'
import { ordenarItemsPorTipo } from '@/lib/ui/ordenar-items'
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

// ── Badge de categoría del catálogo ─────────────────────────────────────

function CategoriaBadge({ categoria }: { categoria: string | null }) {
  if (!categoria) return null
  const key = categoria as keyof typeof CATEGORIA_COLOR
  const colorClass = CATEGORIA_COLOR[key] ?? 'border-black/10 bg-black/[0.04] text-neutral-500'
  const label = CATEGORIA_LABEL[key] ?? categoria
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
      {label}
    </span>
  )
}

// ── Mini-formulario para crear servicio desde OT ─────────────────────────

interface CrearServicioFormProps {
  nombreInicial: string
  onCreado: (servicio: CatalogoServicio) => void
  onCancel: () => void
}

function CrearServicioForm({ nombreInicial, onCreado, onCancel }: CrearServicioFormProps) {
  const [nombre, setNombre] = useState(nombreInicial)
  const [categoria, setCategoria] = useState('')
  const [precio, setPrecio] = useState('')
  const [horas, setHoras] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    const precioNum = parseInt(precio, 10)
    if (nombre.trim().length < 5) { setError('El nombre debe tener al menos 5 caracteres.'); return }
    if (!categoria) { setError('Selecciona una categoría.'); return }
    if (isNaN(precioNum) || precioNum < 0) { setError('Precio inválido.'); return }
    if (precioNum > 2_000_000) { setError('Precio inusualmente alto (máx $2.000.000). Verifica.'); return }
    setError(null)
    startTransition(async () => {
      try {
        const supabase = createClient()
        const horasNum = horas.trim() ? parseFloat(horas) : null
        const servicio = await crearServicioDesdeOT(supabase, {
          nombre: nombre.trim(),
          categoria,
          precioUnitario: precioNum,
          horasEstandar: horasNum && horasNum > 0 ? horasNum : null,
        })
        onCreado(servicio)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al crear el servicio.')
      }
    })
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
        Nuevo servicio — quedará pendiente de revisión
      </p>
      <p className="mb-3 text-[11px] text-neutral-500">
        Admin o jefe_taller deberán aprobarlo como catálogo oficial.
      </p>
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Nombre *</label>
          <input
            className={inputClass}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="ej: REPARACIÓN BOMBA AGUA"
            disabled={pending}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Categoría *</label>
            <select
              className={inputClass}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              disabled={pending}
            >
              <option value="">Seleccionar…</option>
              {CATEGORIAS_CATALOGO.map((c) => (
                <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Precio neto CLP *</label>
            <input
              className={inputClass}
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>
        <div className="w-1/2 pr-1.5">
          <label className={labelClass}>Horas estándar (opcional)</label>
          <input
            className={inputClass}
            type="number"
            min="0.1"
            step="0.1"
            placeholder="ej: 1.5"
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            disabled={pending}
          />
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className={btnPrimary} disabled={pending} onClick={submit}>
            {pending ? 'Creando…' : 'Crear y usar en OT'}
          </button>
          <button type="button" className={btnSecondary} onClick={onCancel} disabled={pending}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Formulario de agregar ítem ───────────────────────────────────────────

interface AgregarItemFormProps {
  reparacionId: string
  configuracion: ConfiguracionManoObra
  onDone: (hasPendiente?: boolean) => void
  onCancel: () => void
}

function AgregarItemForm({ reparacionId, configuracion, onDone, onCancel }: AgregarItemFormProps) {
  const [tipo, setTipo] = useState<'mano_obra' | 'repuesto'>('mano_obra')
  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [cantidad, setCantidad] = useState('1')
  // Mano de obra: el precio unitario es el valor hora (arranca con la tarifa
  // por defecto de la plantilla; se ajusta según la categoría del servicio).
  const [costoUnitario, setCostoUnitario] = useState(String(configuracion.valor_hora_mecanica))
  const [costoCompra, setCostoCompra] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // ── Estado: buscador de catálogo (mano_obra) ──────────────────────────
  const [catalogoQuery, setCatalogoQuery] = useState('')
  const [catalogoResults, setCatalogoResults] = useState<CatalogoServicio[]>([])
  const [catalogoSearching, setCatalogoSearching] = useState(false)
  const [showCatalogoDropdown, setShowCatalogoDropdown] = useState(false)
  const [selectedServicio, setSelectedServicio] = useState<CatalogoServicio | null>(null)
  const [showCrearForm, setShowCrearForm] = useState(false)
  const catalogoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Estado: buscador de inventario (repuesto) ─────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<RepuestoResumen[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedRepuesto, setSelectedRepuesto] = useState<RepuestoResumen | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced: búsqueda en catálogo cuando tipo='mano_obra'
  useEffect(() => {
    if (tipo !== 'mano_obra') { setCatalogoResults([]); return }
    if (!catalogoQuery.trim()) { setCatalogoResults([]); setShowCatalogoDropdown(false); return }

    if (catalogoTimerRef.current) clearTimeout(catalogoTimerRef.current)
    setCatalogoSearching(true)
    catalogoTimerRef.current = setTimeout(async () => {
      try {
        const supabase = createClient()
        const results = await buscarServiciosCatalogo(supabase, catalogoQuery.trim())
        setCatalogoResults(results)
        setShowCatalogoDropdown(true)
      } catch {
        setCatalogoResults([])
      } finally {
        setCatalogoSearching(false)
      }
    }, 300)

    return () => { if (catalogoTimerRef.current) clearTimeout(catalogoTimerRef.current) }
  }, [catalogoQuery, tipo])

  // Debounced: búsqueda en inventario cuando tipo='repuesto'
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

  function selectServicio(s: CatalogoServicio) {
    setSelectedServicio(s)
    if (s.codigo) setCodigo(s.codigo)
    setDescripcion(s.nombre)
    if (s.unidad_precio === 'hora' && s.horas_estandar != null) {
      // Mano de obra por hora: la cantidad son las horas (editable — el usuario
      // ajusta las horas reales), y el precio unitario es el valor hora de la
      // plantilla según la categoría. total = horas × valor hora.
      setCantidad(String(s.horas_estandar))
      setCostoUnitario(String(getValorHoraForServicio(configuracion, s.categoria)))
    } else {
      // Servicio de precio fijo: cantidad = 1, precio = precio del catálogo.
      setCantidad('1')
      setCostoUnitario(String(s.precio_unitario))
    }
    setShowCatalogoDropdown(false)
    setCatalogoQuery('')
    setShowCrearForm(false)
  }

  function clearServicio() {
    setSelectedServicio(null)
    setCodigo('')
    setDescripcion('')
    setCantidad('1')
    setCostoUnitario(String(configuracion.valor_hora_mecanica))
  }

  function selectRepuesto(r: RepuestoResumen) {
    setSelectedRepuesto(r)
    if (r.codigo) setCodigo(r.codigo)
    setDescripcion(r.nombre + (r.marca ? ` — ${r.marca}` : ''))
    setCostoUnitario(String(r.precio_venta ?? ''))
    setCostoCompra(r.precio_costo != null ? String(r.precio_costo) : '')
    setShowDropdown(false)
    setSearchQuery('')
  }

  function clearRepuesto() {
    setSelectedRepuesto(null)
    setCodigo('')
    setDescripcion('')
    setCostoUnitario('')
    setCostoCompra('')
  }

  function changeTipo(t: 'mano_obra' | 'repuesto') {
    setTipo(t)
    clearServicio()
    clearRepuesto()
    setCantidad('1')
    setCostoCompra('')
    setCatalogoQuery('')
    setSearchQuery('')
    setShowCrearForm(false)
    // Mano de obra arranca con la tarifa por defecto de la plantilla;
    // repuesto arranca vacío (se llena al elegir del inventario).
    setCostoUnitario(t === 'mano_obra' ? String(configuracion.valor_hora_mecanica) : '')
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
        const costoCompraNum = costoCompra.trim() !== '' ? parseFloat(costoCompra) : null
        const supabase = createClient()
        const newItem = await addItemReparacion(supabase, {
          reparacionId,
          tipo,
          ...(codigo.trim() ? { codigo: codigo.trim() } : {}),
          descripcion: descripcion.trim(),
          cantidad: cantNum,
          costoUnitario: costoNum,
          ...(selectedRepuesto ? { repuestoId: selectedRepuesto.id } : {}),
          ...(costoCompraNum != null && !isNaN(costoCompraNum) ? { costoCompraUnitario: costoCompraNum } : {}),
          // Snapshots de catálogo — solo cuando hay servicio seleccionado
          ...(selectedServicio ? (() => {
            const isHora = selectedServicio.unidad_precio === 'hora' && selectedServicio.horas_estandar != null
            const valorHora = isHora
              ? getValorHoraForServicio(configuracion, selectedServicio.categoria)
              : selectedServicio.precio_unitario
            const precioCalc = isHora
              ? Math.round(selectedServicio.horas_estandar! * valorHora)
              : selectedServicio.precio_unitario
            return {
              servicioCatalogoId:     selectedServicio.id,
              nombreServicioSnapshot: selectedServicio.nombre,
              horasEstandarSnapshot:  selectedServicio.horas_estandar ?? null,
              valorHoraSnapshot:      valorHora,
              precioCatalogoSnapshot: precioCalc,
            }
          })() : {}),
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
        onDone(selectedServicio?.requiere_revision === true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al agregar ítem.')
      }
    })
  }

  const sinResultadosCatalogo =
    showCatalogoDropdown && catalogoResults.length === 0 && !catalogoSearching && catalogoQuery.trim()

  return (
    <form
      onSubmit={submit}
      className="mt-3 rounded-lg border border-black/[0.06] bg-neutral-950/40 p-4"
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
            onChange={(e) => changeTipo(e.target.value as typeof tipo)}
            disabled={pending}
          >
            {TIPOS_ITEM_REPARACION.map((t) => (
              <option key={t} value={t}>{TIPOS_ITEM_LABEL[t]}</option>
            ))}
          </select>
        </div>

        {/* ── Mano de obra: buscador de catálogo ── */}
        {tipo === 'mano_obra' && !selectedServicio && !showCrearForm && (
          <div className="relative sm:col-span-1">
            <label className={labelClass}>Buscar en catálogo</label>
            <input
              className={inputClass}
              placeholder="Nombre o código del servicio…"
              value={catalogoQuery}
              onChange={(e) => setCatalogoQuery(e.target.value)}
              disabled={pending}
              autoComplete="off"
            />
            {catalogoSearching && (
              <p className="mt-1 text-[11px] text-neutral-500">Buscando…</p>
            )}
            {showCatalogoDropdown && catalogoResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-black/[0.08] bg-neutral-900 shadow-xl">
                {catalogoResults.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectServicio(s)}
                    className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-black/[0.04] first:rounded-t-lg last:rounded-b-lg"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-100">{s.nombre}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {s.codigo && <span className="text-[11px] text-neutral-500">{s.codigo}</span>}
                        <CategoriaBadge categoria={s.categoria} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-neutral-200">{fmtCLPShort(s.precio_unitario)}</p>
                      {s.horas_estandar != null && (
                        <p className="text-[11px] text-neutral-500">{s.horas_estandar}h</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {sinResultadosCatalogo && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-black/[0.08] bg-neutral-900 shadow-xl">
                <p className="px-3 py-2 text-sm text-neutral-500">
                  Sin resultados para &ldquo;{catalogoQuery}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCrearForm(true)
                    setShowCatalogoDropdown(false)
                  }}
                  className="flex w-full items-center gap-2 border-t border-black/[0.06] px-3 py-2.5 text-left text-sm font-medium text-accent-400 hover:bg-black/[0.04]"
                >
                  + Crear &ldquo;{catalogoQuery.slice(0, 60)}&rdquo; como nuevo servicio
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Servicio seleccionado (chip) ── */}
        {tipo === 'mano_obra' && selectedServicio && !showCrearForm && (
          <div className="sm:col-span-1">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-accent-500/20 bg-accent-500/[0.06] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-100">{selectedServicio.nombre}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <CategoriaBadge categoria={selectedServicio.categoria} />
                  {selectedServicio.horas_estandar != null && (
                    <span className="text-[11px] text-neutral-500">{selectedServicio.horas_estandar}h</span>
                  )}
                  {selectedServicio.requiere_revision && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                      Pendiente revisión
                    </span>
                  )}
                </div>
                {selectedServicio.unidad_precio === 'hora' && selectedServicio.horas_estandar != null && (() => {
                  const vh = getValorHoraForServicio(configuracion, selectedServicio.categoria)
                  return (
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Plantilla: {selectedServicio.horas_estandar} h × {fmtCLPShort(vh)} /h
                    </p>
                  )
                })()}
              </div>
              <button
                type="button"
                onClick={clearServicio}
                className={`${btnGhost} shrink-0 px-2 py-1 text-xs text-neutral-500`}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* ── Repuesto: búsqueda en inventario ── */}
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
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-black/[0.08] bg-neutral-900 shadow-xl">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectRepuesto(r)}
                    className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-black/[0.04] first:rounded-t-lg last:rounded-b-lg"
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
                          <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
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
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-black/[0.08] bg-neutral-900 px-3 py-2.5 text-sm text-neutral-500">
                Sin resultados. Puedes completar los datos manualmente.
              </div>
            )}
          </div>
        )}

        {/* ── Repuesto seleccionado ── */}
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
              <p className="mt-1.5 rounded-md border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-1.5 text-[11px] leading-snug text-amber-700">
                ⚠ Precio estimado automáticamente con 40% sobre costo. Revisar antes de aprobar presupuesto.
              </p>
            )}
          </div>
        )}

        <div className={
          (tipo === 'repuesto' && !selectedRepuesto) ||
          (tipo === 'mano_obra' && !selectedServicio && !showCrearForm)
            ? 'sm:col-span-2'
            : ''
        }>
          <label className={labelClass}>Descripción</label>
          <input
            className={inputClass}
            placeholder={tipo === 'mano_obra' ? 'ej: Revisión de frenos delanteros…' : 'ej: Pastillas de freno Bosch…'}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>Código</label>
          <input
            className={inputClass}
            placeholder="Código / SKU (opcional)"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>{tipo === 'mano_obra' ? 'Cantidad de horas' : 'Cantidad'}</label>
          <input
            className={inputClass}
            type="number"
            min="0.001"
            step={tipo === 'mano_obra' ? 'any' : '0.001'}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>{tipo === 'mano_obra' ? 'Valor hora (CLP)' : 'Precio venta unitario (CLP)'}</label>
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
          {tipo === 'mano_obra' && (() => {
            const h = parseFloat(cantidad)
            const vh = parseFloat(costoUnitario)
            if (!isNaN(h) && !isNaN(vh) && h > 0 && vh >= 0) {
              return (
                <p className="mt-1 text-[11px] font-medium text-accent-400">
                  Total: {fmtCLPShort(Math.round(h * vh))} ({h} h × {fmtCLPShort(vh)})
                </p>
              )
            }
            return null
          })()}
        </div>

        {/* ── Costo de compra: solo repuestos ── */}
        {tipo === 'repuesto' && (
          <div>
            <label className={labelClass}>Costo de compra unitario (CLP)</label>
            <input
              className={inputClass}
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={costoCompra}
              onChange={(e) => setCostoCompra(e.target.value)}
              disabled={pending}
            />
            {costoCompra && costoUnitario && (() => {
              const compra = parseFloat(costoCompra)
              const venta = parseFloat(costoUnitario)
              const cant = parseFloat(cantidad) || 1
              if (!isNaN(compra) && !isNaN(venta) && venta > 0) {
                const utilidad = Math.round((venta - compra) * cant)
                const margen = Math.round(((venta - compra) / venta) * 100)
                return (
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Utilidad: {fmtCLPShort(utilidad)} ({margen}%)
                  </p>
                )
              }
              return null
            })()}
          </div>
        )}
      </div>

      {/* Mini-formulario de creación de servicio nuevo */}
      {tipo === 'mano_obra' && showCrearForm && (
        <CrearServicioForm
          nombreInicial={catalogoQuery}
          onCreado={(s) => {
            selectServicio(s)
            setShowCrearForm(false)
          }}
          onCancel={() => setShowCrearForm(false)}
        />
      )}

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" className={btnPrimary} disabled={pending || showCrearForm}>
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
      className="rounded-xl border border-black/[0.06] bg-neutral-900/50 p-5"
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
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
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

// ── Inline: estado de compra del repuesto (En taller / Por comprar / … ) ──
// Visible para todos (el mecánico necesita saber si el repuesto está en taller).
// La nota indica dónde/cómo conseguirlo (Mercado Libre, importación, proveedor…).

function EstadoCompraInline({ item, onSaved }: { item: ItemReparacion; onSaved: () => void }) {
  const [estado, setEstado] = useState<EstadoCompra>(item.estado_compra)
  const [nota, setNota] = useState(item.nota_compra ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const sucio = estado !== item.estado_compra || nota !== (item.nota_compra ?? '')

  async function guardar() {
    setSaving(true)
    setError(null)
    try {
      await actualizarCompraItem(createClient(), {
        itemId: item.id,
        estadoCompra: estado,
        notaCompra: nota.trim() || null,
      })
      setOk(true)
      setTimeout(() => setOk(false), 1500)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${ESTADO_COMPRA_BADGE[item.estado_compra]}`}>
        {ESTADO_COMPRA_LABEL[item.estado_compra]}
      </span>
      <select
        value={estado}
        onChange={(e) => setEstado(e.target.value as EstadoCompra)}
        disabled={saving}
        className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-neutral-700 outline-none focus:border-accent-500 disabled:opacity-50"
        aria-label="Estado de compra"
      >
        {ESTADOS_COMPRA.map((s) => <option key={s} value={s}>{ESTADO_COMPRA_LABEL[s]}</option>)}
      </select>
      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota: Mercado Libre, importación, proveedor…"
        disabled={saving}
        className="min-w-[9rem] flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-neutral-700 outline-none focus:border-accent-500 disabled:opacity-50"
      />
      {sucio && (
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={saving}
          className="rounded-md bg-accent-600 px-3 py-1 text-xs font-semibold text-white hover:bg-accent-500 disabled:opacity-50"
        >
          {saving ? '…' : 'Guardar'}
        </button>
      )}
      {ok && <span className="text-xs text-emerald-700">✓</span>}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  )
}

// ── Inline edit: costo de compra en ítems de repuesto ya guardados ──────

interface CostoCompraInlineProps {
  item: ItemReparacion
  onSaved: () => void
}

function CostoCompraInline({ item, onSaved }: CostoCompraInlineProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(
    item.costo_compra_unitario != null ? String(item.costo_compra_unitario) : '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const num = value.trim() !== '' ? parseFloat(value) : null
    if (num !== null && (isNaN(num) || num < 0)) {
      setError('Valor inválido.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('items_reparacion')
        .update({ costo_compra_unitario: num })
        .eq('id', item.id)
        .select('id')
      if (!data || data.length === 0) {
        throw new Error('Sin permiso o sesión expirada.')
      }
      setEditing(false)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    const costo = item.costo_compra_unitario
    const utilidad = costo != null ? Math.round((item.costo_unitario - costo) * item.cantidad) : null
    const margen =
      costo != null && item.costo_unitario > 0
        ? Math.round(((item.costo_unitario - costo) / item.costo_unitario) * 100)
        : null

    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1 text-left text-[11px] text-neutral-600 hover:text-neutral-400"
      >
        {costo != null
          ? `Costo compra: ${fmtCLPShort(costo)} · Utilidad: ${fmtCLPShort(utilidad)} (${margen}%)`
          : '+ Agregar costo de compra'}
      </button>
    )
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <input
        type="number"
        min="0"
        step="1"
        className="w-36 rounded border border-black/[0.08] bg-neutral-900 px-2 py-1 text-xs text-neutral-200 focus:border-accent-500/50 focus:outline-none"
        placeholder="Costo de compra…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={saving}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save()
          if (e.key === 'Escape') setEditing(false)
        }}
      />
      <button
        type="button"
        className={`${btnPrimary} py-0.5 text-[11px]`}
        onClick={() => void save()}
        disabled={saving}
      >
        {saving ? '…' : 'Guardar'}
      </button>
      <button
        type="button"
        className={`${btnSecondary} py-0.5 text-[11px]`}
        onClick={() => setEditing(false)}
        disabled={saving}
      >
        Cancelar
      </button>
      {error && <p className="text-[11px] text-red-700">{error}</p>}
    </div>
  )
}

// ── Inline: precio de venta del repuesto ────────────────────────────────
// Para materiales cargados sin precio (aún no comprados): se define el precio
// después. Actualiza costo_unitario y recalcula costo_total = precio × cantidad.

function PrecioVentaInline({ item, onSaved }: { item: ItemReparacion; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.costo_unitario > 0 ? String(item.costo_unitario) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sinPrecio = !(item.costo_unitario > 0)

  async function save() {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) { setError('Precio inválido.'); return }
    setSaving(true)
    setError(null)
    try {
      const total = Math.round(num * item.cantidad * 100) / 100
      const { data } = await createClient()
        .from('items_reparacion')
        .update({ costo_unitario: num, costo_total: total })
        .eq('id', item.id)
        .select('id')
      if (!data || data.length === 0) throw new Error('Sin permiso o sesión expirada.')
      setEditing(false)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`mt-1 block text-left text-[11px] ${sinPrecio ? 'font-medium text-amber-700 hover:text-amber-600' : 'text-neutral-600 hover:text-neutral-400'}`}
      >
        {sinPrecio ? '⚠ Definir precio de venta' : `Precio venta: ${fmtCLPShort(item.costo_unitario)} · editar`}
      </button>
    )
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <input
        type="number" min="0" step="1" autoFocus
        className="w-36 rounded border border-black/[0.08] bg-neutral-900 px-2 py-1 text-xs text-neutral-200 focus:border-accent-500/50 focus:outline-none"
        placeholder="Precio de venta…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={saving}
        onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false) }}
      />
      <button type="button" className={`${btnPrimary} py-0.5 text-[11px]`} onClick={() => void save()} disabled={saving}>
        {saving ? '…' : 'Guardar'}
      </button>
      <button type="button" className={`${btnSecondary} py-0.5 text-[11px]`} onClick={() => setEditing(false)} disabled={saving}>
        Cancelar
      </button>
      {error && <p className="text-[11px] text-red-700">{error}</p>}
    </div>
  )
}

interface TrabajoCardProps {
  reparacion: ReparacionConItems
  mecanicos: MecanicoSimple[]
  configuracion: ConfiguracionManoObra
  onChanged: (hasPendiente?: boolean) => void
  /** true cuando el trabajo recién se creó por el camino directo: la ficha abre sola. */
  initialShowFicha?: boolean
  /** Muestra costos de compra / utilidad por ítem (solo roles de gestión). */
  puedeVerCostos: boolean
}

function TrabajoCard({ reparacion, mecanicos, configuracion, onChanged, initialShowFicha = false, puedeVerCostos }: TrabajoCardProps) {
  const [showAddItem, setShowAddItem] = useState(false)
  const [showFicha, setShowFicha] = useState(initialShowFicha)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [asignando, setAsignando] = useState(false)
  const [asignarError, setAsignarError] = useState<string | null>(null)

  async function asignarMecanico(mecanicoId: string | null) {
    setAsignando(true)
    setAsignarError(null)
    try {
      await asignarMecanicoReparacion(createClient(), reparacion.id, mecanicoId)
      onChanged()
    } catch (e) {
      setAsignarError(e instanceof Error ? e.message : 'No se pudo asignar.')
    } finally {
      setAsignando(false)
    }
  }

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
          {mecanicos.length > 0 && (
            <label className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              Mecánico:
              <select
                value={reparacion.mecanico_id ?? ''}
                disabled={asignando}
                onChange={(e) => void asignarMecanico(e.target.value || null)}
                className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-neutral-700 outline-none focus:border-accent-500 disabled:opacity-50"
                aria-label="Mecánico asignado"
              >
                <option value="">Sin asignar</option>
                {mecanicos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
              {asignando && <span>guardando…</span>}
            </label>
          )}
          {asignarError && <span className="text-[11px] text-red-700">{asignarError}</span>}
        </div>
      </div>

      {reparacion.items.length > 0 && (
        <div className="space-y-1.5">
          <p className={`${sectionLabel} mb-1`}>Ítems</p>
          {ordenarItemsPorTipo(reparacion.items).map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-black/[0.04] bg-black/[0.02] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="mr-2 rounded-full border border-black/[0.06] bg-black/[0.04] px-2 py-0.5 text-[10px] text-neutral-500">
                    {TIPOS_ITEM_LABEL[item.tipo]}
                  </span>
                  {item.codigo && (
                    <span className="mr-1.5 rounded border border-black/[0.08] bg-black/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
                      {item.codigo}
                    </span>
                  )}
                  <span className="text-sm text-neutral-200">{item.descripcion}</span>
                  {item.tipo === 'repuesto' && item.cantidad !== 1 && (
                    <span className="ml-2 text-xs text-neutral-600">× {item.cantidad}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {item.tipo === 'repuesto' && !(item.costo_unitario > 0) ? (
                    <span className="text-xs font-medium text-amber-700">precio por definir</span>
                  ) : (
                    <span className="text-sm font-medium text-neutral-300">{fmtCLP(item.costo_total)}</span>
                  )}
                  <button
                    onClick={() => void eliminarItem(item.id)}
                    disabled={deletingId === item.id}
                    className={`${btnGhost} px-2 py-1 text-red-700 hover:text-red-800`}
                    title="Eliminar ítem"
                  >
                    {deletingId === item.id ? '…' : '×'}
                  </button>
                </div>
              </div>
              {item.tipo === 'mano_obra' && (
                <p className="mt-1 text-[11px] text-neutral-600">
                  {item.cantidad} h × {fmtCLP(item.costo_unitario)} /h
                </p>
              )}
              {item.tipo === 'repuesto' && (
                <>
                  <EstadoCompraInline item={item} onSaved={onChanged} />
                  {puedeVerCostos && <PrecioVentaInline item={item} onSaved={onChanged} />}
                  {puedeVerCostos && <CostoCompraInline item={item} onSaved={onChanged} />}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteError && <p className="text-xs text-red-700">{deleteError}</p>}

      {showFicha ? (
        <div className="rounded-lg border border-black/[0.08] bg-black/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Cargar líneas</p>
            <button onClick={() => setShowFicha(false)} className={`${btnGhost} text-xs`}>Cerrar</button>
          </div>
          <FichaIngresoTrabajos
            reparacionId={reparacion.id}
            configuracion={configuracion}
            onGuardado={(hasPendiente) => { setShowFicha(false); onChanged(hasPendiente) }}
          />
        </div>
      ) : showAddItem ? (
        <AgregarItemForm
          reparacionId={reparacion.id}
          configuracion={configuracion}
          onDone={(hasPendiente) => { setShowAddItem(false); onChanged(hasPendiente) }}
          onCancel={() => setShowAddItem(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowFicha(true)}
            className={`${btnGhost} text-xs`}
          >
            + Cargar líneas
          </button>
          <button
            onClick={() => setShowAddItem(true)}
            className={`${btnGhost} text-xs`}
          >
            + Ítem detallado
          </button>
        </div>
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
  configuracion: ConfiguracionManoObra
  /** Motivo de ingreso de la OT — semilla del "Trabajo directo". */
  motivoOT?: string | null
  /** Muestra costos de compra / utilidad por ítem (solo roles de gestión). */
  puedeVerCostos: boolean
  /** Para la orden de compra imprimible / WhatsApp del pie. */
  numeroOt: string
  vehiculoLabel: string | null
}

/** Texto de WhatsApp para el encargado de compras (repuestos por conseguir). */
function mensajeCompra(
  vehiculoLabel: string | null,
  numeroOt: string,
  items: ItemReparacion[],
): string {
  return [
    `Comprar repuestos${vehiculoLabel ? ` para ${vehiculoLabel}` : ''} (${numeroOt}):`,
    '',
    ...items.map((it) => {
      const cant = it.cantidad !== 1 ? ` x${it.cantidad}` : ''
      const nota = it.nota_compra ? ` — ${it.nota_compra}` : ''
      return `• ${it.descripcion}${cant}${nota}`
    }),
  ].join('\n')
}

export function TrabajosSection({
  ordenTrabajoId,
  historiaId,
  tipoEventoReparacionId,
  initialReparaciones,
  mecanicos,
  configuracion,
  motivoOT = null,
  puedeVerCostos,
  numeroOt,
  vehiculoLabel,
}: TrabajosSectionProps) {
  const router = useRouter()
  const [showAddTrabajo, setShowAddTrabajo] = useState(false)
  const [pendientesCount, setPendientesCount] = useState(0)
  const [creandoDirecto, setCreandoDirecto] = useState(false)
  const [errorDirecto, setErrorDirecto] = useState<string | null>(null)
  // Tras crear un trabajo directo, su ficha de líneas se abre sola.
  const [fichaAbiertaId, setFichaAbiertaId] = useState<string | null>(null)

  /** Camino rápido: cliente dicta el trabajo (sin diagnóstico ni presupuesto).
   *  Crea la reparación con el motivo de ingreso y deja la ficha lista. */
  async function crearTrabajoDirecto() {
    if (!tipoEventoReparacionId) return
    setCreandoDirecto(true)
    setErrorDirecto(null)
    try {
      const rep = await crearReparacion(createClient(), {
        ordenTrabajoId,
        historiaId,
        tipoEventoId: tipoEventoReparacionId,
        descripcion: (motivoOT?.trim() || 'Trabajo solicitado por el cliente').slice(0, 200),
      })
      setFichaAbiertaId(rep.id)
      router.refresh()
    } catch (e) {
      setErrorDirecto(e instanceof Error ? e.message : 'No se pudo crear el trabajo.')
    } finally {
      setCreandoDirecto(false)
    }
  }

  // Carga inicial del conteo de pendientes
  useEffect(() => {
    void (async () => {
      try {
        const supabase = createClient()
        const count = await contarServiciosPendientes(supabase)
        setPendientesCount(count)
      } catch {
        // silencioso — el badge no es crítico
      }
    })()
  }, [])

  function refresh(hasPendiente?: boolean) {
    if (hasPendiente) setPendientesCount((n) => n + 1)
    router.refresh()
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className={sectionLabel}>Trabajos realizados</p>
          {pendientesCount > 0 && (
            <span
              className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
              title={`${pendientesCount} servicio${pendientesCount > 1 ? 's' : ''} del catálogo pendiente${pendientesCount > 1 ? 's' : ''} de revisión`}
            >
              {pendientesCount} pendiente{pendientesCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
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

      {initialReparaciones.length === 0 && !showAddTrabajo && tipoEventoReparacionId && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent-500/25 bg-accent-500/[0.06] px-4 py-3">
          <p className="text-sm text-neutral-400">
            ¿El cliente ya sabe lo que quiere (sin diagnóstico ni presupuesto)?
          </p>
          <button
            onClick={() => void crearTrabajoDirecto()}
            disabled={creandoDirecto}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-500 disabled:opacity-50"
          >
            {creandoDirecto ? 'Creando…' : '⚡ Trabajo directo: cargar líneas'}
          </button>
          {errorDirecto && <p className="text-xs text-red-800">{errorDirecto}</p>}
        </div>
      )}

      {initialReparaciones.map((rep) => (
        <TrabajoCard
          key={rep.id}
          reparacion={rep}
          mecanicos={mecanicos}
          configuracion={configuracion}
          onChanged={refresh}
          initialShowFicha={rep.id === fichaAbiertaId}
          puedeVerCostos={puedeVerCostos}
        />
      ))}

      <ComprasAcciones
        ordenTrabajoId={ordenTrabajoId}
        numeroOt={numeroOt}
        vehiculoLabel={vehiculoLabel}
        reparaciones={initialReparaciones}
      />
    </section>
  )
}

// ── Pie de acciones de compra: emite la orden imprimible / WhatsApp con los
//    repuestos que faltan por conseguir. El estado de cada repuesto se marca
//    inline en su ítem (arriba); esto es solo el "enviar al comprador". ──────

function ComprasAcciones({
  ordenTrabajoId,
  numeroOt,
  vehiculoLabel,
  reparaciones,
}: {
  ordenTrabajoId: string
  numeroOt: string
  vehiculoLabel: string | null
  reparaciones: ReparacionConItems[]
}) {
  const repuestos = reparaciones.flatMap((r) => r.items).filter((i) => i.tipo === 'repuesto')
  const porComprar = repuestos.filter((i) => ESTADOS_COMPRA_PENDIENTES.includes(i.estado_compra))
  if (porComprar.length === 0) return null

  const waUrl = `https://wa.me/?text=${encodeURIComponent(mensajeCompra(vehiculoLabel, numeroOt, porComprar))}`

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3">
      <span className="text-sm font-medium text-amber-800">
        {porComprar.length} repuesto{porComprar.length > 1 ? 's' : ''} por conseguir
      </span>
      <Link
        href={`/repair-orders/${ordenTrabajoId}/orden-compra`}
        className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-500"
      >
        🛒 Orden de compra
      </Link>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-500/20"
      >
        Enviar lista por WhatsApp
      </a>
    </div>
  )
}
