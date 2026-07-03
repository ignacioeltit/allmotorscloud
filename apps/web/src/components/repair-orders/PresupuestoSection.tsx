'use client'

// Presupuesto de una OT. Las líneas se cargan con la misma ficha de ingreso por
// lotes que usan las cotizaciones (FichaIngresoLineas: materiales / mano de obra /
// otros, con búsqueda en catálogo y paquetes) — antes había un formulario de un
// ítem a la vez.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { crearPresupuesto, enviarPresupuesto } from '@/modules/estimates/mutations'
import { pasarPresupuestoATrabajos } from '@/modules/reparaciones/mutations'
import { ESTADO_PRESUPUESTO_LABEL, TIPO_ITEM_LABEL } from '@/modules/estimates/constants'
import type { PresupuestoConItems } from '@/modules/estimates/types'
import { FichaIngresoLineas } from '@/components/estimates/FichaIngresoLineas'
import { CompartirPresupuestoOT } from './CompartirPresupuestoOT'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, btnPrimary, btnSecondary, btnGhost } from '@/components/ui/styles'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

interface PresupuestoSectionProps {
  ordenTrabajoId: string
  initialPresupuesto: PresupuestoConItems | null
  tallerNombre: string
  clienteNombre: string | null
  clienteTelefono: string | null
  vehiculoLabel: string | null
  citaActiva: string | null
  /** Para "Pasar a Trabajos": historia técnica y tipo de evento reparación. */
  historiaId: string | null
  tipoEventoReparacionId: string | null
  /** true si los ítems de este presupuesto ya fueron copiados a Trabajos. */
  yaEnTrabajos: boolean
}

export function PresupuestoSection({
  ordenTrabajoId,
  initialPresupuesto,
  tallerNombre,
  clienteNombre,
  clienteTelefono,
  vehiculoLabel,
  citaActiva,
  historiaId,
  tipoEventoReparacionId,
  yaEnTrabajos,
}: PresupuestoSectionProps) {
  const router = useRouter()
  const [showAddItem, setShowAddItem] = useState(false)
  const [creando, setCreando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [pasando, setPasando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pasarATrabajos() {
    const p = initialPresupuesto
    if (!p || !historiaId || !tipoEventoReparacionId) return
    setPasando(true)
    setError(null)
    try {
      await pasarPresupuestoATrabajos(createClient(), {
        ordenTrabajoId,
        historiaId,
        tipoEventoReparacionId,
        folio: p.folio,
        items: p.items.map((it) => ({
          id: it.id,
          tipo: it.tipo,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          descuento_porcentaje: it.descuento_porcentaje,
        })),
      })
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setPasando(false)
    }
  }

  function refresh() {
    router.refresh()
  }

  async function crear() {
    setCreando(true)
    setError(null)
    try {
      const supabase = createClient()
      await crearPresupuesto(supabase, { ordenTrabajoId })
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear el presupuesto.')
    } finally {
      setCreando(false)
    }
  }

  async function enviar() {
    if (!initialPresupuesto) return
    setEnviando(true)
    setError(null)
    try {
      const supabase = createClient()
      await enviarPresupuesto(supabase, initialPresupuesto.id)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar el presupuesto.')
    } finally {
      setEnviando(false)
    }
  }

  if (!initialPresupuesto) {
    return (
      <section className={card}>
        <p className={sectionLabel}>Presupuesto</p>
        <p className="mt-3 text-sm text-neutral-500">Esta OT no tiene un presupuesto activo.</p>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <button onClick={() => void crear()} disabled={creando} className={`${btnPrimary} mt-3`}>
          {creando ? 'Creando…' : '+ Crear presupuesto'}
        </button>
      </section>
    )
  }

  const p = initialPresupuesto
  const esBorrador = p.estado === 'borrador'

  return (
    <div className="space-y-4">
      {p.items.length > 0 && (
        <CompartirPresupuestoOT
          presupuesto={p}
          tallerNombre={tallerNombre}
          clienteNombre={clienteNombre}
          clienteTelefono={clienteTelefono}
          vehiculoLabel={vehiculoLabel}
          citaActiva={citaActiva}
        />
      )}

      <section className={`${card} space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <p className={sectionLabel}>Presupuesto v{p.version}{p.folio ? ` · ${p.folio}` : ''}</p>
        <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-800">
          {ESTADO_PRESUPUESTO_LABEL[p.estado]}
        </span>
      </div>

      {/* Presupuesto aprobado → un click lo convierte en el trabajo a ejecutar */}
      {p.estado === 'autorizado' && (
        yaEnTrabajos ? (
          <p className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-800">
            ✓ Cargado en Trabajos — ejecuta y marca avance arriba
          </p>
        ) : historiaId && tipoEventoReparacionId && p.items.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent-500/30 bg-accent-500/10 px-4 py-3">
            <p className="text-sm text-accent-400">
              El cliente aprobó este presupuesto. Pásalo a Trabajos para ejecutarlo:
            </p>
            <button
              onClick={() => void pasarATrabajos()}
              disabled={pasando}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-500 disabled:opacity-50"
            >
              {pasando ? 'Pasando…' : '🔧 Pasar a Trabajos'}
            </button>
          </div>
        ) : null
      )}

      {p.items.length > 0 ? (
        <div className="space-y-1.5">
          {p.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <span className="mr-2 rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[10px] text-neutral-500">
                  {TIPO_ITEM_LABEL[item.tipo] ?? item.tipo}
                </span>
                <span className="text-neutral-300">{item.descripcion}</span>
                {item.cantidad !== 1 && (
                  <span className="ml-2 text-xs text-neutral-600">× {item.cantidad}</span>
                )}
              </div>
              <span className="shrink-0 font-medium text-neutral-200">{fmtCLP(item.precio_total)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-white/[0.06] pt-3 text-sm">
            <span className="text-neutral-500">Mano de obra</span>
            <span className="text-neutral-300">{fmtCLP(p.total_mano_obra)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">Repuestos</span>
            <span className="text-neutral-300">{fmtCLP(p.total_repuestos)}</span>
          </div>
          {p.total_otros > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Otros</span>
              <span className="text-neutral-300">{fmtCLP(p.total_otros)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-neutral-400">Total neto</span>
            <span className="text-neutral-100">{fmtCLP(p.total_neto)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">Sin ítems en el presupuesto.</p>
      )}

      {p.notas && <p className="text-xs text-neutral-500">{p.notas}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {esBorrador && (
        showAddItem ? (
          <div className="rounded-lg border border-black/[0.08] bg-black/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Cargar líneas</p>
              <button onClick={() => setShowAddItem(false)} className={`${btnGhost} text-xs`}>
                Cerrar
              </button>
            </div>
            <FichaIngresoLineas
              presupuestoId={p.id}
              onGuardado={() => {
                setShowAddItem(false)
                refresh()
              }}
            />
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setShowAddItem(true)} className={`${btnGhost} text-xs`}>
              + Cargar líneas
            </button>
            {p.items.length > 0 && (
              <button onClick={() => void enviar()} disabled={enviando} className={`${btnSecondary} text-xs`}>
                {enviando ? 'Enviando…' : 'Marcar como enviado'}
              </button>
            )}
          </div>
        )
      )}
      </section>
    </div>
  )
}
