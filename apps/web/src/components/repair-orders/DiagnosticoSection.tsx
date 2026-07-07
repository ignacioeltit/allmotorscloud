'use client'

// Diagnóstico del mecánico: lo que encontró al evaluar el vehículo (ej: "rótula
// derecha mala, bandeja doblada"). Cada registro es un evento tipo 'diagnostico'
// en la historia técnica; al registrar el primero, la OT avanza de
// 'pendiente_diagnostico' a 'diagnosticada'. Con el diagnóstico registrado, el
// paso siguiente es cargar el presupuesto con esas reparaciones.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createEvento, updateEvento } from '@/modules/events/mutations'
import { cambiarEstadoOrdenTrabajo } from '@/modules/repair-orders/mutations'
import type { Evento } from '@/modules/events/types'
import type { MecanicoSimple } from '@/modules/users/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, labelClass, btnPrimary } from '@/components/ui/styles'

export function DiagnosticoSection({
  ordenTrabajoId,
  historiaId,
  tipoEventoDiagnosticoId,
  estadoOT,
  diagnosticos,
  mecanicos,
  puedeGestionar,
}: {
  ordenTrabajoId: string
  historiaId: string
  tipoEventoDiagnosticoId: string | null
  estadoOT: string
  diagnosticos: Evento[]
  mecanicos: MecanicoSimple[]
  puedeGestionar: boolean
}) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [mecanicoId, setMecanicoId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [visibles, setVisibles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(diagnosticos.map((d) => [d.id, d.visible_cliente])),
  )
  const [alternando, setAlternando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggleVisible(id: string) {
    const nuevo = !visibles[id]
    setAlternando(id)
    setError(null)
    try {
      await updateEvento(createClient(), id, { visible_cliente: nuevo })
      setVisibles((prev) => ({ ...prev, [id]: nuevo }))
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setAlternando(null)
    }
  }

  const terminal = estadoOT === 'cerrada' || estadoOT === 'cancelada'
  const nombreMecanico = (id: string | null) =>
    id ? mecanicos.find((m) => m.id === id)?.nombre ?? null : null

  async function registrar() {
    if (!texto.trim() || !tipoEventoDiagnosticoId) return
    setGuardando(true)
    setError(null)
    try {
      const supabase = createClient()
      await createEvento(supabase, {
        historia_tecnica_id: historiaId,
        tipo_evento_id: tipoEventoDiagnosticoId,
        orden_trabajo_id: ordenTrabajoId,
        titulo: 'Diagnóstico',
        descripcion: texto.trim(),
        ...(mecanicoId ? { asignado_a: mecanicoId } : {}),
      })
      // Primer diagnóstico: la OT avanza sola (no retrocede estados posteriores).
      if (estadoOT === 'pendiente_diagnostico') {
        try {
          await cambiarEstadoOrdenTrabajo(supabase, ordenTrabajoId, { estado: 'diagnosticada' })
        } catch {
          /* el diagnóstico ya quedó registrado; el estado se puede mover a mano */
        }
      }
      setTexto('')
      setMecanicoId('')
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setGuardando(false)
    }
  }

  if (!tipoEventoDiagnosticoId && diagnosticos.length === 0) return null

  return (
    <section className={`${card} space-y-4`}>
      <p className={sectionLabel}>Diagnóstico del mecánico</p>

      {diagnosticos.length > 0 && (
        <div className="space-y-2">
          {diagnosticos.map((d) => (
            <div key={d.id} className="rounded-lg border border-black/[0.05] bg-black/[0.02] px-3 py-2.5">
              <p className="whitespace-pre-wrap text-sm text-neutral-200">{d.descripcion}</p>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-neutral-500">
                  {new Date(d.creado_en).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {nombreMecanico(d.asignado_a) ? ` · 🔧 ${nombreMecanico(d.asignado_a)}` : ''}
                </p>
                {puedeGestionar ? (
                  <button
                    type="button"
                    onClick={() => void toggleVisible(d.id)}
                    disabled={alternando === d.id}
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                      visibles[d.id]
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                        : 'border-black/10 bg-black/[0.03] text-neutral-500'
                    }`}
                    title="Mostrar u ocultar este hallazgo en el link de avance del cliente"
                  >
                    {alternando === d.id ? '…' : visibles[d.id] ? '👁 El cliente lo ve' : '🔒 Interno'}
                  </button>
                ) : (
                  visibles[d.id] && <span className="text-[11px] text-emerald-700">👁 Visible al cliente</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!terminal && tipoEventoDiagnosticoId && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>
              {diagnosticos.length === 0 ? '¿Qué encontró el mecánico?' : 'Agregar otro hallazgo'}
            </label>
            <textarea
              rows={2}
              className={inputClass}
              placeholder="Ej: Rótula derecha mala, bandeja delantera doblada. Requiere reemplazo de ambas."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={guardando}
            />
          </div>
          {mecanicos.length > 0 && (
            <div className="max-w-xs">
              <label className={labelClass}>Mecánico que diagnosticó</label>
              <select className={inputClass} value={mecanicoId} onChange={(e) => setMecanicoId(e.target.value)} disabled={guardando}>
                <option value="">—</option>
                {mecanicos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-sm text-red-800">{error}</p>}
          <div className="flex items-center gap-3">
            <button onClick={() => void registrar()} disabled={guardando || !texto.trim()} className={btnPrimary}>
              {guardando ? 'Registrando…' : 'Registrar diagnóstico'}
            </button>
            <p className="text-xs text-neutral-500">
              Luego carga el presupuesto con las reparaciones para cotizarle al cliente.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
