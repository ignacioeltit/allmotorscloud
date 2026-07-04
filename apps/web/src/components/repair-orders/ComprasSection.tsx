'use client'

// Compras de repuestos de la OT: marcar qué repuestos hay que conseguir (por
// comprar / comprado en camino / recibido), con nota (Mercado Libre, importación,
// proveedor…), y al volver el comprador, ingresar el costo de cada uno. Desde
// aquí se emite la Orden de compra (imprimible / WhatsApp) para el encargado.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { actualizarCompraItem } from '@/modules/reparaciones/mutations'
import {
  ESTADOS_COMPRA, ESTADO_COMPRA_LABEL, ESTADO_COMPRA_BADGE, ESTADOS_COMPRA_PENDIENTES,
  type EstadoCompra,
} from '@/modules/reparaciones/constants'
import type { ReparacionConItems, ItemReparacion } from '@/modules/reparaciones/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel } from '@/components/ui/styles'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

/** Texto de WhatsApp para el encargado de compras. */
function mensajeCompra(
  vehiculoLabel: string | null,
  numeroOt: string,
  items: ItemReparacion[],
): string {
  const lineas = [
    `Comprar repuestos${vehiculoLabel ? ` para ${vehiculoLabel}` : ''} (${numeroOt}):`,
    '',
    ...items.map((it) => {
      const cant = it.cantidad !== 1 ? ` x${it.cantidad}` : ''
      const nota = it.nota_compra ? ` — ${it.nota_compra}` : ''
      return `• ${it.descripcion}${cant}${nota}`
    }),
  ]
  return lineas.join('\n')
}

export function ComprasSection({
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
  const router = useRouter()
  const repuestos = reparaciones.flatMap((r) => r.items).filter((i) => i.tipo === 'repuesto')

  if (repuestos.length === 0) return null

  const porComprar = repuestos.filter((i) => ESTADOS_COMPRA_PENDIENTES.includes(i.estado_compra))
  const totalCompra = repuestos.reduce(
    (acc, i) => acc + (i.costo_compra_unitario ?? 0) * i.cantidad,
    0,
  )

  const waText = encodeURIComponent(mensajeCompra(vehiculoLabel, numeroOt, porComprar))
  const waUrl = `https://wa.me/?text=${waText}`

  return (
    <section className={`${card} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={sectionLabel}>Repuestos y compras</p>
        <div className="flex items-center gap-3 text-sm">
          {porComprar.length > 0 && (
            <span className="text-red-700">{porComprar.length} por conseguir</span>
          )}
          {totalCompra > 0 && <span className="text-neutral-400">Costo compra: {fmtCLP(totalCompra)}</span>}
        </div>
      </div>

      <div className="space-y-2">
        {repuestos.map((it) => (
          <FilaCompra key={it.id} item={it} onChanged={() => router.refresh()} />
        ))}
      </div>

      {porComprar.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-black/[0.06] pt-3">
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
          <span className="self-center text-xs text-neutral-500">
            Datos del vehículo + repuestos a comprar para el encargado.
          </span>
        </div>
      )}
    </section>
  )
}

function FilaCompra({ item, onChanged }: { item: ItemReparacion; onChanged: () => void }) {
  const [estado, setEstado] = useState<EstadoCompra>(item.estado_compra)
  const [nota, setNota] = useState(item.nota_compra ?? '')
  const [costo, setCosto] = useState(item.costo_compra_unitario != null ? String(item.costo_compra_unitario) : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const sucio =
    estado !== item.estado_compra ||
    nota !== (item.nota_compra ?? '') ||
    costo !== (item.costo_compra_unitario != null ? String(item.costo_compra_unitario) : '')

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const costoNum = costo.trim() !== '' ? parseFloat(costo) : null
      await actualizarCompraItem(createClient(), {
        itemId: item.id,
        estadoCompra: estado,
        notaCompra: nota.trim() || null,
        ...(costoNum != null && !isNaN(costoNum) ? { costoCompraUnitario: costoNum } : { costoCompraUnitario: null }),
      })
      setOk(true)
      setTimeout(() => setOk(false), 1500)
      onChanged()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="rounded-lg border border-black/[0.05] bg-black/[0.02] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-neutral-200">
          {item.descripcion}
          {item.cantidad !== 1 && <span className="ml-2 text-xs text-neutral-500">× {item.cantidad}</span>}
        </span>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${ESTADO_COMPRA_BADGE[item.estado_compra]}`}>
          {ESTADO_COMPRA_LABEL[item.estado_compra]}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoCompra)}
          className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-neutral-700 outline-none focus:border-accent-500"
        >
          {ESTADOS_COMPRA.map((s) => <option key={s} value={s}>{ESTADO_COMPRA_LABEL[s]}</option>)}
        </select>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota: Mercado Libre, importación, proveedor…"
          className="min-w-[10rem] flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-neutral-700 outline-none focus:border-accent-500"
        />
        <span className="inline-flex items-center gap-1">
          <span className="text-[11px] text-neutral-500">Costo</span>
          <input
            type="number"
            min="0"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            placeholder="0"
            className="w-24 rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-neutral-700 outline-none focus:border-accent-500"
          />
        </span>
        {sucio && (
          <button
            onClick={() => void guardar()}
            disabled={guardando}
            className="rounded-md bg-accent-600 px-3 py-1 text-xs font-semibold text-white hover:bg-accent-500 disabled:opacity-50"
          >
            {guardando ? '…' : 'Guardar'}
          </button>
        )}
        {ok && <span className="text-xs text-emerald-700">✓</span>}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  )
}
