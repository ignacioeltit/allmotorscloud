'use client'

// Recomendaciones para la próxima visita del vehículo, dentro de la OT.
// El mecánico (o gestión) deja la nota; el asesor de servicio (gestión) la edita
// y la resuelve. Saltan cuando el vehículo vuelve a entrar.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { crearRecomendacion, editarRecomendacion, resolverRecomendacion } from '@/modules/recomendaciones/mutations'
import type { Recomendacion, PrioridadRecomendacion } from '@/modules/recomendaciones/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, btnPrimary, btnSecondary } from '@/components/ui/styles'

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function RecomendacionesSection({
  vehiculoId,
  ordenTrabajoId,
  initial,
  puedeGestionar,
}: {
  vehiculoId: string
  ordenTrabajoId: string
  initial: Recomendacion[]
  puedeGestionar: boolean
}) {
  const router = useRouter()
  const [lista, setLista] = useState<Recomendacion[]>(initial)
  const [texto, setTexto] = useState('')
  const [prioridad, setPrioridad] = useState<PrioridadRecomendacion>('normal')
  const [guardando, setGuardando] = useState(false)
  const [accion, setAccion] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editTexto, setEditTexto] = useState('')
  const [editPrio, setEditPrio] = useState<PrioridadRecomendacion>('normal')
  const [error, setError] = useState<string | null>(null)

  async function agregar() {
    if (!texto.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const r = await crearRecomendacion(createClient(), {
        vehiculoId,
        ordenTrabajoId,
        descripcion: texto.trim(),
        prioridad,
      })
      setLista((prev) => [r, ...prev])
      setTexto('')
      setPrioridad('normal')
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setGuardando(false)
    }
  }

  async function resolver(id: string) {
    setAccion(id)
    setError(null)
    try {
      await resolverRecomendacion(createClient(), id, ordenTrabajoId)
      setLista((prev) => prev.filter((r) => r.id !== id))
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setAccion(null)
    }
  }

  async function guardarEdicion(id: string) {
    if (!editTexto.trim()) return
    setAccion(id)
    setError(null)
    try {
      const r = await editarRecomendacion(createClient(), id, { descripcion: editTexto.trim(), prioridad: editPrio })
      setLista((prev) => prev.map((x) => (x.id === id ? r : x)))
      setEditId(null)
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setAccion(null)
    }
  }

  return (
    <section className={`${card} space-y-3`}>
      <div>
        <p className={sectionLabel}>Recomendaciones para la próxima visita</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Notas que saltarán cuando este vehículo vuelva a entrar al taller.
        </p>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {lista.length > 0 && (
        <div className="space-y-2">
          {lista.map((r) => {
            const alta = r.prioridad === 'alta'
            if (editId === r.id) {
              return (
                <div key={r.id} className="rounded-lg border border-black/[0.08] bg-black/[0.02] p-2.5 space-y-2">
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={editTexto}
                    onChange={(e) => setEditTexto(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs text-neutral-700"
                      value={editPrio}
                      onChange={(e) => setEditPrio(e.target.value as PrioridadRecomendacion)}
                    >
                      <option value="normal">Prioridad normal</option>
                      <option value="alta">Prioridad alta</option>
                    </select>
                    <button type="button" onClick={() => void guardarEdicion(r.id)} disabled={accion === r.id} className={btnPrimary}>
                      {accion === r.id ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button type="button" onClick={() => setEditId(null)} className={btnSecondary}>Cancelar</button>
                  </div>
                </div>
              )
            }
            return (
              <div
                key={r.id}
                className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                  alta ? 'border-red-500/30 bg-red-500/[0.06]' : 'border-black/[0.06] bg-black/[0.02]'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm text-neutral-200">
                    {alta && <span className="mr-1.5 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700">Alta</span>}
                    {r.descripcion}
                  </p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">Registrada el {fmtFecha(r.creado_en)}</p>
                </div>
                {puedeGestionar && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setEditId(r.id); setEditTexto(r.descripcion); setEditPrio(r.prioridad) }}
                      className="text-xs text-neutral-500 hover:text-neutral-300"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void resolver(r.id)}
                      disabled={accion === r.id}
                      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      {accion === r.id ? '…' : '✓ Resolver'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Agregar (mecánico o gestión) */}
      <div className="space-y-2 border-t border-black/[0.06] pt-3">
        <textarea
          className={inputClass}
          rows={2}
          placeholder="Ej: Pastillas de freno al 20%, cambiar en la próxima mantención."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs text-neutral-700"
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as PrioridadRecomendacion)}
          >
            <option value="normal">Prioridad normal</option>
            <option value="alta">Prioridad alta</option>
          </select>
          <button type="button" onClick={() => void agregar()} disabled={guardando || !texto.trim()} className={btnPrimary}>
            {guardando ? 'Agregando…' : '+ Agregar recomendación'}
          </button>
        </div>
      </div>
    </section>
  )
}
