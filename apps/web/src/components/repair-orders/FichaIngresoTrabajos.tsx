'use client'

// Ficha de ingreso por lote para los TRABAJOS de una OT (items_reparacion):
// dos grillas (materiales y mano de obra) con varias líneas en blanco a la vez,
// igual que la ficha de las cotizaciones, pero conservando la lógica propia de
// los trabajos: materiales se buscan en el INVENTARIO (enlaza repuesto_id, costo
// de compra y consume stock) y la mano de obra en el CATÁLOGO de servicios
// (snapshots de precio/hora según la categoría). Las líneas también pueden ser
// texto libre.

import { useEffect, useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addItemReparacion } from '@/modules/reparaciones/mutations'
import { searchRepuestos } from '@/modules/inventory/queries'
import { consumirStockParaOT } from '@/modules/inventory/mutations'
import type { RepuestoResumen } from '@/modules/inventory/types'
import { buscarServiciosCatalogo } from '@/modules/catalogo/queries'
import type { CatalogoServicio } from '@/modules/catalogo/types'
import type { ConfiguracionManoObra } from '@/modules/taller/types'
import { getValorHoraForServicio } from '@/modules/taller/helpers'
import { toErrorMessage } from '@/lib/ui/error-message'
import { btnPrimary, btnGhost } from '@/components/ui/styles'

const FILAS_INICIALES = 5

type Grupo = 'repuesto' | 'mano_obra' | 'otros'
/** Grupos con autocompletado (otros es texto libre). */
type GrupoBuscable = 'repuesto' | 'mano_obra'

/** Metadatos de un pick del inventario (se pierden si se edita la descripción a mano). */
interface MetaRepuesto {
  id: string
  stock: number
  costoCompra: number | null
}

/** Snapshot de un pick del catálogo de servicios. */
interface MetaServicio {
  id: string
  nombre: string
  horas: number | null
  valorHora: number
  precioCatalogo: number
  requiereRevision: boolean
}

interface LineaT {
  descripcion: string
  cantidad: string
  precio: string
  repuesto: MetaRepuesto | null
  servicio: MetaServicio | null
}

function filaVacia(): LineaT {
  return { descripcion: '', cantidad: '1', precio: '', repuesto: null, servicio: null }
}

function totalLinea(l: LineaT): number {
  const c = parseFloat(l.cantidad)
  const p = parseFloat(l.precio)
  if (isNaN(c) || isNaN(p) || c <= 0 || p < 0) return 0
  return Math.round(c * p * 100) / 100
}

function tieneContenido(l: LineaT): boolean {
  return l.descripcion.trim().length > 0 && !isNaN(parseFloat(l.precio)) && parseFloat(l.precio) >= 0
}

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

const inputCell =
  'w-full rounded-md border border-black/10 bg-neutral-950/60 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-accent-500/60 focus:outline-none focus:ring-1 focus:ring-accent-500/25'

/** Celda de descripción con autocompletado: inventario (materiales) o catálogo (mano de obra). */
function CeldaBuscador({
  grupo,
  value,
  placeholder,
  onChangeText,
  onPickRepuesto,
  onPickServicio,
}: {
  grupo: GrupoBuscable
  value: string
  placeholder?: string
  onChangeText: (text: string) => void
  onPickRepuesto: (r: RepuestoResumen) => void
  onPickServicio: (s: CatalogoServicio) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [repuestos, setRepuestos] = useState<RepuestoResumen[]>([])
  const [servicios, setServicios] = useState<CatalogoServicio[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  function onChange(text: string) {
    onChangeText(text)
    if (timer.current) clearTimeout(timer.current)
    const q = text.trim()
    if (q.length < 2) {
      setAbierto(false)
      return
    }
    timer.current = setTimeout(async () => {
      try {
        const supabase = createClient()
        if (grupo === 'repuesto') {
          const rs = await searchRepuestos(supabase, q)
          setRepuestos(rs.slice(0, 6))
          setAbierto(rs.length > 0)
        } else {
          const ss = await buscarServiciosCatalogo(supabase, q)
          setServicios(ss.slice(0, 6))
          setAbierto(ss.length > 0)
        }
      } catch {
        setAbierto(false)
      }
    }, 300)
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        className={inputCell}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {abierto && (
        <div className="absolute left-0 top-full z-20 mt-1 w-full min-w-72 overflow-hidden rounded-lg border border-black/10 bg-neutral-900 shadow-xl shadow-black/20">
          <ul className="max-h-60 overflow-auto">
            {grupo === 'repuesto'
              ? repuestos.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => { onPickRepuesto(r); setAbierto(false) }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-black/[0.04]"
                    >
                      <span className="min-w-0 truncate text-neutral-200">
                        {r.nombre}
                        {r.marca && <span className="text-neutral-500"> — {r.marca}</span>}
                      </span>
                      <span className="shrink-0 text-xs text-neutral-500">
                        {r.precio_venta != null ? fmtCLP(r.precio_venta) : '—'} · stock {r.stock_actual}
                      </span>
                    </button>
                  </li>
                ))
              : servicios.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => { onPickServicio(s); setAbierto(false) }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-black/[0.04]"
                    >
                      <span className="min-w-0 truncate text-neutral-200">{s.nombre}</span>
                      <span className="shrink-0 text-xs text-neutral-500">
                        {s.unidad_precio === 'hora' && s.horas_estandar != null
                          ? `${s.horas_estandar} h`
                          : fmtCLP(s.precio_unitario)}
                      </span>
                    </button>
                  </li>
                ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function GrillaTrabajos({
  titulo,
  labelCantidad,
  grupo,
  lineas,
  setLineas,
  configuracion,
}: {
  titulo: string
  labelCantidad: string
  grupo: Grupo
  lineas: LineaT[]
  setLineas: (fn: (prev: LineaT[]) => LineaT[]) => void
  configuracion: ConfiguracionManoObra
}) {
  function set(i: number, cambios: Partial<LineaT>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)))
  }

  function pickRepuesto(i: number, r: RepuestoResumen) {
    set(i, {
      descripcion: r.nombre + (r.marca ? ` — ${r.marca}` : ''),
      precio: r.precio_venta != null ? String(r.precio_venta) : '',
      repuesto: { id: r.id, stock: r.stock_actual, costoCompra: r.precio_costo },
      servicio: null,
    })
  }

  function pickServicio(i: number, s: CatalogoServicio) {
    const esHora = s.unidad_precio === 'hora' && s.horas_estandar != null
    const valorHora = esHora
      ? getValorHoraForServicio(configuracion, s.categoria)
      : s.precio_unitario
    set(i, {
      descripcion: s.nombre,
      cantidad: esHora ? String(s.horas_estandar) : '1',
      precio: String(valorHora),
      servicio: {
        id: s.id,
        nombre: s.nombre,
        horas: s.horas_estandar ?? null,
        valorHora,
        precioCatalogo: esHora ? Math.round(s.horas_estandar! * valorHora) : s.precio_unitario,
        requiereRevision: s.requiere_revision === true,
      },
      repuesto: null,
    })
  }

  const subtotal = lineas.reduce((acc, l) => acc + totalLinea(l), 0)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{titulo}</p>
        <p className="text-sm font-medium text-neutral-300">{fmtCLP(subtotal)}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-black/[0.06]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] bg-black/[0.02] text-left text-[10px] uppercase tracking-wider text-neutral-500">
              <th className="px-2 py-2 font-medium">Descripción</th>
              <th className="w-20 px-2 py-2 font-medium">{labelCantidad}</th>
              <th className="w-28 px-2 py-2 font-medium">Precio</th>
              <th className="w-28 px-2 py-2 text-right font-medium">Total</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={i} className="border-b border-black/[0.03] last:border-0">
                <td className="px-2 py-1.5">
                  {grupo === 'otros' ? (
                    <input
                      className={inputCell}
                      placeholder={i === 0 ? 'Ej: Insumos, gestión, traslado…' : ''}
                      value={l.descripcion}
                      onChange={(e) => set(i, { descripcion: e.target.value })}
                    />
                  ) : (
                    <CeldaBuscador
                      grupo={grupo}
                      value={l.descripcion}
                      placeholder={i === 0 ? (grupo === 'repuesto' ? 'Buscar en inventario o escribir…' : 'Buscar en catálogo o escribir…') : ''}
                      onChangeText={(text) => set(i, { descripcion: text, repuesto: null, servicio: null })}
                      onPickRepuesto={(r) => pickRepuesto(i, r)}
                      onPickServicio={(s) => pickServicio(i, s)}
                    />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0" step="any" className={inputCell} value={l.cantidad} onChange={(e) => set(i, { cantidad: e.target.value })} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0" step="1" placeholder="0" className={inputCell} value={l.precio} onChange={(e) => set(i, { precio: e.target.value })} />
                </td>
                <td className="px-2 py-1.5 text-right font-medium text-neutral-200">
                  {totalLinea(l) > 0 ? fmtCLP(totalLinea(l)) : <span className="text-neutral-600">—</span>}
                </td>
                <td className="px-2 py-1.5 text-center">
                  {lineas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-neutral-500 hover:text-red-700"
                      aria-label="Quitar línea"
                      title="Quitar línea"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => setLineas((prev) => [...prev, filaVacia()])} className={`${btnGhost} mt-2 text-xs`}>
        + Agregar línea
      </button>
    </div>
  )
}

export function FichaIngresoTrabajos({
  reparacionId,
  configuracion,
  onGuardado,
}: {
  reparacionId: string
  configuracion: ConfiguracionManoObra
  /** hasPendiente: true si alguna línea vino de un servicio marcado "requiere revisión". */
  onGuardado: (hasPendiente?: boolean) => void
}) {
  const [materiales, setMateriales] = useState<LineaT[]>(() => Array.from({ length: FILAS_INICIALES }, filaVacia))
  const [manoObra, setManoObra] = useState<LineaT[]>(() => Array.from({ length: FILAS_INICIALES }, filaVacia))
  const [otros, setOtros] = useState<LineaT[]>(() => Array.from({ length: FILAS_INICIALES }, filaVacia))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const conDatos = [
    ...materiales.filter(tieneContenido).map((l) => ({ tipo: 'repuesto' as const, linea: l })),
    ...manoObra.filter(tieneContenido).map((l) => ({ tipo: 'mano_obra' as const, linea: l })),
    ...otros.filter(tieneContenido).map((l) => ({ tipo: 'otros' as const, linea: l })),
  ]
  const totalGeneral = conDatos.reduce((acc, { linea }) => acc + totalLinea(linea), 0)

  function guardar() {
    if (conDatos.length === 0) {
      setError('Completa al menos una línea (descripción y precio).')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const supabase = createClient()
        let hasPendiente = false

        for (const { tipo, linea } of conDatos) {
          const cantidad = parseFloat(linea.cantidad)
          const costoUnitario = parseFloat(linea.precio)
          const s = tipo === 'mano_obra' ? linea.servicio : null
          const r = tipo === 'repuesto' ? linea.repuesto : null

          const nuevo = await addItemReparacion(supabase, {
            reparacionId,
            tipo,
            descripcion: linea.descripcion.trim(),
            cantidad,
            costoUnitario,
            ...(r ? { repuestoId: r.id } : {}),
            ...(r && r.costoCompra != null ? { costoCompraUnitario: r.costoCompra } : {}),
            ...(s
              ? {
                  servicioCatalogoId: s.id,
                  nombreServicioSnapshot: s.nombre,
                  horasEstandarSnapshot: s.horas,
                  valorHoraSnapshot: s.valorHora,
                  precioCatalogoSnapshot: s.precioCatalogo,
                }
              : {}),
          })

          if (s?.requiereRevision) hasPendiente = true

          // Repuesto del inventario con stock: registrar el consumo (no bloquea la OT si falla)
          if (r && r.stock > 0) {
            try {
              await consumirStockParaOT(supabase, {
                repuestoId: r.id,
                itemReparacionId: nuevo.id,
                cantidad,
                stockActual: r.stock,
                descripcion: linea.descripcion.trim(),
              })
            } catch {
              /* silencioso */
            }
          }
        }

        onGuardado(hasPendiente)
      } catch (e) {
        setError(toErrorMessage(e))
      }
    })
  }

  return (
    <div className="space-y-6">
      <GrillaTrabajos titulo="Materiales / Repuestos" labelCantidad="Cantidad" grupo="repuesto" lineas={materiales} setLineas={setMateriales} configuracion={configuracion} />
      <GrillaTrabajos titulo="Mano de obra" labelCantidad="Horas" grupo="mano_obra" lineas={manoObra} setLineas={setManoObra} configuracion={configuracion} />
      <GrillaTrabajos titulo="Otros" labelCantidad="Cantidad" grupo="otros" lineas={otros} setLineas={setOtros} configuracion={configuracion} />

      {error && <p className="text-xs text-red-800">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4">
        <p className="text-sm text-neutral-500">
          {conDatos.length} línea{conDatos.length === 1 ? '' : 's'} con datos ·{' '}
          <span className="font-semibold text-neutral-200">{fmtCLP(totalGeneral)}</span>
        </p>
        <button type="button" onClick={guardar} disabled={pending || conDatos.length === 0} className={btnPrimary}>
          {pending ? 'Guardando…' : `Guardar ${conDatos.length || ''} línea${conDatos.length === 1 ? '' : 's'}`.trim()}
        </button>
      </div>
    </div>
  )
}
