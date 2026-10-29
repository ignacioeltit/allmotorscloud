'use client'

// Carga rápida de costos de compra desde una factura de proveedor, inline en la
// OT (sin módulo aparte). Lista todos los repuestos de la OT con su campo de
// costo a la vista; se llenan los montos de la factura y se guardan de una vez.
// Opcionalmente registra el total como gasto en Finanzas (categoría Repuestos).

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registrarMovimiento } from '@/modules/finanzas/mutations'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, labelClass, btnPrimary, btnSecondary } from '@/components/ui/styles'

export type RepuestoCosto = {
  id: string
  descripcion: string
  cantidad: number
  venta: number // costo_unitario (precio de venta por unidad)
  costo: number | null // costo_compra_unitario actual
}

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

export function CargarCostosFactura({
  ordenTrabajoId,
  repuestos,
}: {
  ordenTrabajoId: string
  repuestos: RepuestoCosto[]
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [costos, setCostos] = useState<Record<string, string>>(() =>
    Object.fromEntries(repuestos.map((r) => [r.id, r.costo != null ? String(r.costo) : ''])),
  )
  const [factura, setFactura] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [comoGasto, setComoGasto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const totalCosto = useMemo(() => {
    let s = 0
    for (const r of repuestos) {
      const c = parseFloat(costos[r.id] ?? '')
      if (!isNaN(c)) s += Math.round(c * r.cantidad)
    }
    return s
  }, [costos, repuestos])

  const totalVenta = useMemo(
    () => repuestos.reduce((s, r) => s + Math.round(r.venta * r.cantidad), 0),
    [repuestos],
  )
  const utilidad = totalVenta - totalCosto
  const margen = totalVenta > 0 ? Math.round((utilidad / totalVenta) * 100) : 0

  if (repuestos.length === 0) return null

  function set(id: string, v: string) {
    setOk(false)
    setCostos((p) => ({ ...p, [id]: v }))
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    setOk(false)
    try {
      const sb = createClient()
      // Actualiza el costo de compra de cada repuesto con un valor ingresado.
      for (const r of repuestos) {
        const raw = (costos[r.id] ?? '').trim()
        if (raw === '') continue
        const num = parseFloat(raw)
        if (isNaN(num) || num < 0) throw new Error(`Costo inválido en "${r.descripcion}".`)
        const { data, error: upErr } = await sb
          .from('items_reparacion')
          .update({ costo_compra_unitario: num })
          .eq('id', r.id)
          .select('id')
        if (upErr) throw new Error(upErr.message)
        if (!data || data.length === 0) throw new Error('Sin permiso o sesión expirada.')
      }

      // Gasto en finanzas (opcional).
      if (comoGasto && totalCosto > 0) {
        const desc = ['Compra repuestos', factura.trim() && `Factura ${factura.trim()}`, proveedor.trim()]
          .filter(Boolean)
          .join(' · ')
        await registrarMovimiento(sb, {
          tipo: 'gasto',
          monto: totalCosto,
          fecha: new Date().toISOString().slice(0, 10),
          categoria: 'repuestos',
          descripcion: desc,
          ordenTrabajoId,
        })
      }

      setOk(true)
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setGuardando(false)
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`${btnSecondary} w-full justify-center`}
      >
        🧾 Cargar costos de factura ({repuestos.length} repuesto{repuestos.length === 1 ? '' : 's'})
      </button>
    )
  }

  return (
    <section className={`${card} space-y-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={sectionLabel}>Cargar costos de factura</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Ingresa el costo de compra de cada repuesto (con la factura a la vista) y guarda todo de una vez.
          </p>
        </div>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-neutral-500 hover:text-neutral-300">
          Cerrar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className={labelClass}>N° de factura (opcional)</label>
          <input className={inputClass} value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="ej: 12345" />
        </div>
        <div>
          <label className={labelClass}>Proveedor (opcional)</label>
          <input className={inputClass} value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="ej: Repuestos XX" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-black/[0.06]">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.03] text-left text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-3 py-2">Repuesto</th>
              <th className="px-3 py-2 text-center">Cant.</th>
              <th className="px-3 py-2 text-right">Venta unit.</th>
              <th className="px-3 py-2 text-right">Costo compra unit.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {repuestos.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-neutral-200">{r.descripcion}</td>
                <td className="px-3 py-2 text-center text-neutral-400">{r.cantidad}</td>
                <td className="px-3 py-2 text-right text-neutral-400">{fmtCLP(r.venta)}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    className="w-28 rounded border border-black/10 bg-white px-2 py-1 text-right text-sm text-neutral-800"
                    placeholder="0"
                    value={costos[r.id] ?? ''}
                    onChange={(e) => set(r.id, e.target.value)}
                    disabled={guardando}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-black/[0.03] px-4 py-3 text-sm">
        <span className="text-neutral-500">Total venta: <span className="font-medium text-neutral-300">{fmtCLP(totalVenta)}</span></span>
        <span className="text-neutral-500">Costo factura: <span className="font-semibold text-neutral-200">{fmtCLP(totalCosto)}</span></span>
        <span className="text-neutral-500">Utilidad: <span className={`font-semibold ${utilidad >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtCLP(utilidad)} ({margen}%)</span></span>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={comoGasto} onChange={(e) => setComoGasto(e.target.checked)} className="h-4 w-4" />
        Registrar el total ({fmtCLP(totalCosto)}) como gasto en Finanzas (categoría Repuestos)
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {ok && <p className="text-sm font-medium text-emerald-700">✓ Costos guardados{comoGasto ? ' y gasto registrado' : ''}.</p>}

      <button type="button" onClick={() => void guardar()} disabled={guardando} className={btnPrimary}>
        {guardando ? 'Guardando…' : 'Guardar costos'}
      </button>
    </section>
  )
}
