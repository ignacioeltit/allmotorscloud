'use client'

// Inspección integral de la OT: checklist de 14 puntos. El mecánico marca cada
// punto (OK / Observación / Requiere atención / No aplica) y agrega una nota.
// Los puntos marcados con observación o atención pueden convertirse en una
// recomendación para la próxima visita con un clic.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { guardarInspeccion } from '@/modules/inspecciones/mutations'
import { crearRecomendacion } from '@/modules/recomendaciones/mutations'
import {
  PUNTOS_INSPECCION,
  type EstadoPunto,
  type Inspeccion,
} from '@/modules/inspecciones/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, btnPrimary } from '@/components/ui/styles'

const OPCIONES: { estado: EstadoPunto; label: string; clase: string; claseActiva: string }[] = [
  { estado: 'ok', label: 'OK', clase: 'text-neutral-500', claseActiva: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/40' },
  { estado: 'observacion', label: 'Obs.', clase: 'text-neutral-500', claseActiva: 'bg-amber-500/15 text-amber-800 border-amber-500/40' },
  { estado: 'atencion', label: 'Atención', clase: 'text-neutral-500', claseActiva: 'bg-red-500/15 text-red-800 border-red-500/40' },
  { estado: 'na', label: 'N/A', clase: 'text-neutral-500', claseActiva: 'bg-black/[0.06] text-neutral-700 border-black/20' },
]

export function InspeccionSection({
  ordenTrabajoId,
  vehiculoId,
  initial,
}: {
  ordenTrabajoId: string
  vehiculoId: string
  initial: Inspeccion | null
}) {
  const router = useRouter()

  const inicialMap = useMemo(() => {
    const est: Record<string, EstadoPunto> = {}
    const not: Record<string, string> = {}
    for (const p of initial?.puntos ?? []) {
      est[p.codigo] = p.estado
      if (p.nota) not[p.codigo] = p.nota
    }
    return { est, not }
  }, [initial])

  const [estados, setEstados] = useState<Record<string, EstadoPunto>>(inicialMap.est)
  const [notas, setNotas] = useState<Record<string, string>>(inicialMap.not)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [recomCreada, setRecomCreada] = useState<Record<string, boolean>>({})

  const resumen = useMemo(() => {
    let okN = 0, obs = 0, att = 0
    for (const p of PUNTOS_INSPECCION) {
      const e = estados[p.codigo]
      if (e === 'ok') okN++
      else if (e === 'observacion') obs++
      else if (e === 'atencion') att++
    }
    const evaluados = Object.keys(estados).length
    return { okN, obs, att, evaluados }
  }, [estados])

  function marcar(codigo: string, estado: EstadoPunto) {
    setOk(false)
    setEstados((p) => {
      // Un segundo clic en el mismo estado lo desmarca.
      if (p[codigo] === estado) {
        const rest = { ...p }
        delete rest[codigo]
        return rest
      }
      return { ...p, [codigo]: estado }
    })
  }

  function setNota(codigo: string, v: string) {
    setNotas((p) => ({ ...p, [codigo]: v }))
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    setOk(false)
    try {
      const puntos = PUNTOS_INSPECCION.filter((p) => estados[p.codigo]).map((p) => ({
        codigo: p.codigo,
        estado: estados[p.codigo]!,
        nota: (notas[p.codigo] ?? '').trim(),
      }))
      await guardarInspeccion(createClient(), { ordenTrabajoId, vehiculoId, puntos })
      setOk(true)
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setGuardando(false)
    }
  }

  async function aRecomendacion(codigo: string, label: string) {
    const nota = (notas[codigo] ?? '').trim()
    const estado = estados[codigo]
    const descripcion = nota ? `${label}: ${nota}` : label
    setError(null)
    try {
      await crearRecomendacion(createClient(), {
        vehiculoId,
        ordenTrabajoId,
        descripcion,
        prioridad: estado === 'atencion' ? 'alta' : 'normal',
      })
      setRecomCreada((p) => ({ ...p, [codigo]: true }))
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    }
  }

  return (
    <section className={`${card} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={sectionLabel}>Inspección integral</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Checklist de 14 puntos. Marca cada punto y agrega una nota si corresponde.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-800">{resumen.okN} OK</span>
          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 font-medium text-amber-800">{resumen.obs} obs.</span>
          <span className="rounded-md bg-red-500/10 px-2 py-0.5 font-medium text-red-800">{resumen.att} atención</span>
          <span className="text-neutral-500">{resumen.evaluados}/{PUNTOS_INSPECCION.length}</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="divide-y divide-black/[0.06]">
        {PUNTOS_INSPECCION.map((p) => {
          const estado = estados[p.codigo]
          const mostrarNota = estado === 'observacion' || estado === 'atencion'
          return (
            <div key={p.codigo} className="py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-neutral-200">
                  <span className="mr-1.5 text-[11px] font-semibold text-neutral-500">{p.codigo}</span>
                  {p.label}
                </p>
                <div className="flex items-center gap-1">
                  {OPCIONES.map((o) => {
                    const activo = estado === o.estado
                    return (
                      <button
                        key={o.estado}
                        type="button"
                        onClick={() => marcar(p.codigo, o.estado)}
                        className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                          activo ? o.claseActiva : `border-black/10 bg-black/[0.02] ${o.clase} hover:bg-black/[0.05]`
                        }`}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {mostrarNota && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    className={`${inputClass} flex-1`}
                    placeholder="Detalle (ej: discos con rebarba, pastillas al 20%)…"
                    value={notas[p.codigo] ?? ''}
                    onChange={(e) => setNota(p.codigo, e.target.value)}
                  />
                  {recomCreada[p.codigo] ? (
                    <span className="text-xs font-medium text-emerald-700">✓ En recomendaciones</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void aRecomendacion(p.codigo, p.label)}
                      className="shrink-0 rounded-md border border-accent-500/40 bg-accent-500/10 px-2.5 py-1.5 text-xs font-medium text-accent-500 hover:bg-accent-500/20"
                    >
                      + recomendación
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3 border-t border-black/[0.06] pt-3">
        <button type="button" onClick={() => void guardar()} disabled={guardando} className={btnPrimary}>
          {guardando ? 'Guardando…' : 'Guardar inspección'}
        </button>
        {ok && <span className="text-sm font-medium text-emerald-700">✓ Guardada</span>}
      </div>
    </section>
  )
}
