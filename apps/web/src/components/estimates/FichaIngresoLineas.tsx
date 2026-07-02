'use client'

// Ficha de ingreso por lote: dos grillas (mano de obra y materiales) con varias
// líneas en blanco editables a la vez. Se llenan las que hagan falta y se guardan
// todas de un viaje (las vacías se ignoran). Totales en vivo mientras se escribe.

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addItemsPresupuesto } from '@/modules/estimates/mutations'
import type { AddItemsPresupuestoInput } from '@/modules/estimates/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { btnPrimary, btnGhost } from '@/components/ui/styles'

const FILAS_INICIALES = 5

type Grupo = 'mano_obra' | 'repuesto'

interface Linea {
  descripcion: string
  cantidad: string
  precio: string
  descuento: string
}

function filaVacia(): Linea {
  return { descripcion: '', cantidad: '1', precio: '', descuento: '0' }
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
  lineas,
  setLineas,
}: {
  titulo: string
  labelCantidad: string
  lineas: Linea[]
  setLineas: (fn: (prev: Linea[]) => Linea[]) => void
}) {
  function set(i: number, campo: keyof Linea, valor: string) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)))
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
                  <input
                    className={inputCell}
                    placeholder={i === 0 ? 'ej: Cambio de pastillas de freno' : ''}
                    value={l.descripcion}
                    onChange={(e) => set(i, 'descripcion', e.target.value)}
                  />
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
        onClick={() => setLineas((prev) => [...prev, filaVacia()])}
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
}: {
  presupuestoId: string
  onGuardado: () => void
}) {
  const [manoObra, setManoObra] = useState<Linea[]>(() => Array.from({ length: FILAS_INICIALES }, filaVacia))
  const [materiales, setMateriales] = useState<Linea[]>(() => Array.from({ length: FILAS_INICIALES }, filaVacia))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const items: AddItemsPresupuestoInput['items'] = [
    ...manoObra.filter(tieneContenido).map((l) => ({ tipo: 'mano_obra' as Grupo, ...aItem(l) })),
    ...materiales.filter(tieneContenido).map((l) => ({ tipo: 'repuesto' as Grupo, ...aItem(l) })),
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
      <Grilla titulo="Mano de obra" labelCantidad="Horas" lineas={manoObra} setLineas={setManoObra} />
      <Grilla titulo="Materiales / Repuestos" labelCantidad="Cantidad" lineas={materiales} setLineas={setMateriales} />

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
