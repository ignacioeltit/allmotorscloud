'use client'

// Ficha de ingreso por lote: dos grillas (mano de obra y materiales) con varias
// líneas en blanco editables a la vez. Se llenan las que hagan falta y se guardan
// todas de un viaje (las vacías se ignoran). Totales en vivo mientras se escribe.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { addItemsPresupuesto } from '@/modules/estimates/mutations'
import type { AddItemsPresupuestoInput } from '@/modules/estimates/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { btnPrimary, btnGhost, btnSecondary } from '@/components/ui/styles'
import { BuscadorLineaCatalogo } from './BuscadorLineaCatalogo'
import { buscarPlantillas, expandirPlantilla, type PlantillaResumen } from '@/modules/plantillas/queries'

const FILAS_INICIALES = 5

type Grupo = 'mano_obra' | 'repuesto' | 'otros'

interface Linea {
  descripcion: string
  cantidad: string
  precio: string
  descuento: string
}

function filaVacia(): Linea {
  return { descripcion: '', cantidad: '1', precio: '', descuento: '0' }
}

// Mano de obra: la línea arranca con el valor hora configurado como "precio",
// de modo que total = horas × valor hora. El usuario puede sobrescribirlo.
function filaManoObra(valorHora?: number): Linea {
  return { descripcion: '', cantidad: '1', precio: valorHora ? String(valorHora) : '', descuento: '0' }
}

function totalLinea(l: Linea): number {
  const c = parseFloat(l.cantidad)
  const p = parseFloat(l.precio)
  const d = parseFloat(l.descuento) || 0
  if (isNaN(c) || isNaN(p) || c <= 0 || p < 0) return 0
  return Math.round(c * p * (1 - d / 100) * 100) / 100
}

function tieneContenido(l: Linea): boolean {
  return l.descripcion.trim().length > 0 && parseFloat(l.precio) >= 0 && !isNaN(parseFloat(l.precio))
}

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

const inputCell =
  'w-full rounded-md border border-black/10 bg-neutral-950/60 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-accent-500/60 focus:outline-none focus:ring-1 focus:ring-accent-500/25'

function Grilla({
  titulo,
  labelCantidad,
  grupo,
  lineas,
  setLineas,
  nuevaFila = filaVacia,
}: {
  titulo: string
  labelCantidad: string
  grupo: Grupo
  lineas: Linea[]
  setLineas: (fn: (prev: Linea[]) => Linea[]) => void
  nuevaFila?: () => Linea
}) {
  function set(i: number, campo: keyof Linea, valor: string) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)))
  }

  function elegirDelCatalogo(i: number, descripcion: string, precio: number | null, cantidad: number) {
    setLineas((prev) =>
      prev.map((l, idx) =>
        idx === i
          ? {
              ...l,
              descripcion,
              cantidad: String(cantidad),
              ...(precio != null ? { precio: String(precio) } : {}),
            }
          : l,
      ),
    )
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
              <th className="w-16 px-2 py-2 font-medium">Dto %</th>
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
                      onChange={(e) => set(i, 'descripcion', e.target.value)}
                    />
                  ) : (
                    <BuscadorLineaCatalogo
                      grupo={grupo}
                      className={inputCell}
                      placeholder={i === 0 ? 'Buscar en catálogo o escribir…' : ''}
                      value={l.descripcion}
                      onChangeText={(text) => set(i, 'descripcion', text)}
                      onPick={(s) => elegirDelCatalogo(i, s.descripcion, s.precio, s.cantidad)}
                    />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0" step="any" className={inputCell} value={l.cantidad} onChange={(e) => set(i, 'cantidad', e.target.value)} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0" step="1" placeholder="0" className={inputCell} value={l.precio} onChange={(e) => set(i, 'precio', e.target.value)} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0" max="100" step="1" className={inputCell} value={l.descuento} onChange={(e) => set(i, 'descuento', e.target.value)} />
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
      <button
        type="button"
        onClick={() => setLineas((prev) => [...prev, nuevaFila()])}
        className={`${btnGhost} mt-2 text-xs`}
      >
        + Agregar línea
      </button>
    </div>
  )
}

export function FichaIngresoLineas({
  presupuestoId,
  onGuardado,
  valorHora,
}: {
  presupuestoId: string
  onGuardado: () => void
  /** Valor hora configurado (Configuración). Semilla del precio de mano de obra. */
  valorHora?: number
}) {
  const nuevaFilaMO = () => filaManoObra(valorHora)
  const [materiales, setMateriales] = useState<Linea[]>(() => Array.from({ length: FILAS_INICIALES }, filaVacia))
  const [manoObra, setManoObra] = useState<Linea[]>(() => Array.from({ length: FILAS_INICIALES }, nuevaFilaMO))
  const [otros, setOtros] = useState<Linea[]>(() => Array.from({ length: FILAS_INICIALES }, filaVacia))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Paquetes: cargar sus líneas expandidas en las grillas
  async function agregarPaquete(pl: PlantillaResumen) {
    try {
      const lineas = await expandirPlantilla(createClient(), pl)
      const mo = lineas.filter((l) => l.grupo === 'mano_obra').map(expandidaALinea)
      const mat = lineas.filter((l) => l.grupo === 'repuesto').map(expandidaALinea)
      const otr = lineas.filter((l) => l.grupo === 'otros').map(expandidaALinea)
      if (mo.length) setManoObra((prev) => [...prev.filter(tieneContenido), ...mo])
      if (mat.length) setMateriales((prev) => [...prev.filter(tieneContenido), ...mat])
      if (otr.length) setOtros((prev) => [...prev.filter(tieneContenido), ...otr])
    } catch (e) {
      setError(toErrorMessage(e))
    }
  }

  const items: AddItemsPresupuestoInput['items'] = [
    ...materiales.filter(tieneContenido).map((l) => ({ tipo: 'repuesto' as Grupo, ...aItem(l) })),
    ...manoObra.filter(tieneContenido).map((l) => ({ tipo: 'mano_obra' as Grupo, ...aItem(l) })),
    ...otros.filter(tieneContenido).map((l) => ({ tipo: 'otros' as Grupo, ...aItem(l) })),
  ]
  const totalGeneral = items.reduce(
    (acc, it) => acc + Math.round(it.cantidad * it.precioUnitario * (1 - (it.descuentoPorcentaje ?? 0) / 100) * 100) / 100,
    0,
  )

  function guardar() {
    if (items.length === 0) {
      setError('Completa al menos una línea (descripción y precio).')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await addItemsPresupuesto(createClient(), { presupuestoId, items })
        onGuardado()
      } catch (e) {
        setError(toErrorMessage(e))
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <PaquetePicker onElegir={agregarPaquete} />
      </div>

      <Grilla titulo="Materiales / Repuestos" labelCantidad="Cantidad" grupo="repuesto" lineas={materiales} setLineas={setMateriales} />
      <div>
        {valorHora != null && (
          <p className="mb-1 text-[11px] text-neutral-500">
            Valor hora: <span className="font-semibold text-neutral-300">{fmtCLP(valorHora)}</span> (Configuración) · total = horas × valor hora
          </p>
        )}
        <Grilla titulo="Mano de obra" labelCantidad="Horas" grupo="mano_obra" lineas={manoObra} setLineas={setManoObra} nuevaFila={nuevaFilaMO} />
      </div>
      <Grilla titulo="Otros" labelCantidad="Cantidad" grupo="otros" lineas={otros} setLineas={setOtros} />

      {error && <p className="text-xs text-red-800">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4">
        <p className="text-sm text-neutral-500">
          {items.length} línea{items.length === 1 ? '' : 's'} con datos ·{' '}
          <span className="font-semibold text-neutral-200">{fmtCLP(totalGeneral)}</span>
        </p>
        <button type="button" onClick={guardar} disabled={pending || items.length === 0} className={btnPrimary}>
          {pending ? 'Guardando…' : `Guardar ${items.length || ''} línea${items.length === 1 ? '' : 's'}`.trim()}
        </button>
      </div>
    </div>
  )
}

function aItem(l: Linea) {
  return {
    descripcion: l.descripcion.trim(),
    cantidad: parseFloat(l.cantidad),
    precioUnitario: parseFloat(l.precio),
    descuentoPorcentaje: parseFloat(l.descuento) || 0,
  }
}

function expandidaALinea(l: { descripcion: string; cantidad: number; precio: number }): Linea {
  return {
    descripcion: l.descripcion,
    cantidad: String(l.cantidad),
    precio: String(l.precio),
    descuento: '0',
  }
}

// Selector de paquete: abre un dropdown con los paquetes activos.
export function PaquetePicker({ onElegir }: { onElegir: (p: PlantillaResumen) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [plantillas, setPlantillas] = useState<PlantillaResumen[]>([])
  const [cargado, setCargado] = useState(false)

  async function toggle() {
    const next = !abierto
    setAbierto(next)
    if (next && !cargado) {
      try {
        setPlantillas(await buscarPlantillas(createClient()))
      } catch {
        /* silencioso */
      } finally {
        setCargado(true)
      }
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => void toggle()} className={`${btnSecondary} text-xs`}>
        + Agregar paquete
      </button>
      {abierto && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-lg border border-black/10 bg-neutral-900 shadow-xl shadow-black/20">
          {!cargado ? (
            <p className="px-3 py-2 text-xs text-neutral-500">Cargando…</p>
          ) : plantillas.length === 0 ? (
            <p className="px-3 py-2 text-xs text-neutral-500">No hay paquetes configurados.</p>
          ) : (
            <ul className="max-h-72 overflow-auto">
              {plantillas.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { onElegir(p); setAbierto(false) }}
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-black/[0.04]"
                  >
                    <span className="text-sm text-neutral-200">{p.nombre}</span>
                    {p.codigo && <span className="text-[11px] text-neutral-500">{p.codigo}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/catalogo/paquetes"
            className="block border-t border-black/[0.06] px-3 py-2 text-xs font-medium text-accent-400 transition-colors hover:bg-black/[0.04]"
          >
            ⚙ Administrar paquetes →
          </Link>
        </div>
      )}
    </div>
  )
}
