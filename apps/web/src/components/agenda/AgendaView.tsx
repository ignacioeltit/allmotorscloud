'use client'

// Agenda del taller con dos vistas: lista por día y calendario semanal.
// Lee las citas de la semana que contiene la fecha ancla vía el cliente browser
// (RLS aplica) y permite cambiar el estado o eliminar una cita en la vista lista.
// Todo el cálculo de fechas es en hora local del navegador (el taller opera en
// Chile), consistente con cómo se guarda la cita al crearla.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { listCitasRango } from '@/modules/agenda/queries'
import { actualizarEstadoCita, eliminarCita } from '@/modules/agenda/mutations'
import { ESTADOS_CITA, ESTADO_CITA_LABEL, ESTADO_CITA_BADGE } from '@/modules/agenda/constants'
import type { EstadoCita } from '@/modules/agenda/constants'
import type { CitaConDetalle } from '@/modules/agenda/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, btnPrimary, btnSecondary, btnGhost } from '@/components/ui/styles'

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function atMidnight(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
/** Lunes de la semana que contiene a d (semana lunes→domingo). */
function startOfWeek(d: Date): Date {
  const x = atMidnight(d)
  const dow = (x.getDay() + 6) % 7 // 0 = lunes
  return addDays(x, -dow)
}
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtDiaLargo(d: Date): string {
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function vehiculoLabel(c: CitaConDetalle): string {
  const v = c.vehiculo
  if (!v) return 'Vehículo'
  return v.patente ?? ([v.marca, v.modelo].filter(Boolean).join(' ') || 'Vehículo')
}

export function AgendaView() {
  const [vista, setVista] = useState<'lista' | 'semana'>('lista')
  const [anchor, setAnchor] = useState<Date>(() => atMidnight(new Date()))
  const [citas, setCitas] = useState<CitaConDetalle[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accion, setAccion] = useState<string | null>(null)

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const hoy = useMemo(() => atMidnight(new Date()), [])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const desde = weekStart.toISOString()
      const hasta = addDays(weekStart, 7).toISOString()
      const data = await listCitasRango(createClient(), desde, hasta)
      setCitas(data)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setCargando(false)
    }
  }, [weekStart])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const citasDelDia = useCallback(
    (d: Date) =>
      citas
        .filter((c) => sameDay(new Date(c.fecha_cita), d))
        .sort((a, b) => a.fecha_cita.localeCompare(b.fecha_cita)),
    [citas],
  )

  async function cambiarEstado(id: string, estado: EstadoCita) {
    setAccion(id)
    setError(null)
    try {
      await actualizarEstadoCita(createClient(), { citaId: id, estado })
      await cargar()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setAccion(null)
    }
  }

  async function borrar(id: string) {
    if (!window.confirm('¿Eliminar esta cita? No se puede deshacer.')) return
    setAccion(id)
    setError(null)
    try {
      await eliminarCita(createClient(), id)
      await cargar()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setAccion(null)
    }
  }

  const paso = vista === 'semana' ? 7 : 1
  const tituloRango =
    vista === 'semana'
      ? `${weekDays[0]!.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} – ${weekDays[6]!.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
      : fmtDiaLargo(anchor)

  return (
    <div className="space-y-4">
      {/* Barra de control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-black/10 bg-black/[0.02] p-1">
          <button
            onClick={() => setVista('lista')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${vista === 'lista' ? 'bg-accent-500 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
          >
            Día
          </button>
          <button
            onClick={() => setVista('semana')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${vista === 'semana' ? 'bg-accent-500 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
          >
            Semana
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setAnchor((d) => addDays(d, -paso))} className={btnGhost} aria-label="Anterior">
            ‹
          </button>
          <button onClick={() => setAnchor(atMidnight(new Date()))} className={btnSecondary}>
            Hoy
          </button>
          <button onClick={() => setAnchor((d) => addDays(d, paso))} className={btnGhost} aria-label="Siguiente">
            ›
          </button>
        </div>

        <Link href="/agenda/nueva" className={btnPrimary}>
          + Nueva cita
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold capitalize text-neutral-200">{tituloRango}</h2>
        {cargando && <span className="text-xs text-neutral-500">Cargando…</span>}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {vista === 'lista' ? (
        <ListaDia
          citas={citasDelDia(anchor)}
          accion={accion}
          onEstado={cambiarEstado}
          onBorrar={borrar}
          cargando={cargando}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {weekDays.map((d, i) => {
            const items = citasDelDia(d)
            const esHoy = sameDay(d, hoy)
            return (
              <div key={i} className={`${card} min-h-[7rem] p-3 ${esHoy ? 'ring-1 ring-accent-500/40' : ''}`}>
                <button
                  onClick={() => {
                    setAnchor(d)
                    setVista('lista')
                  }}
                  className="mb-2 flex w-full items-baseline justify-between text-left"
                >
                  <span className={`text-xs font-semibold ${esHoy ? 'text-accent-400' : 'text-neutral-400'}`}>
                    {DIAS_CORTOS[i]} {d.getDate()}
                  </span>
                  {items.length > 0 && <span className="text-[10px] text-neutral-600">{items.length}</span>}
                </button>
                <div className="space-y-1.5">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-neutral-600">—</p>
                  ) : (
                    items.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setAnchor(d)
                          setVista('lista')
                        }}
                        className={`block w-full rounded-md border px-2 py-1 text-left text-[11px] ${ESTADO_CITA_BADGE[c.estado]}`}
                      >
                        <span className="font-semibold">{fmtHora(c.fecha_cita)}</span>{' '}
                        <span className="font-medium tracking-wide">{vehiculoLabel(c)}</span>
                        {c.tipo_servicio && <span className="block truncate opacity-80">{c.tipo_servicio}</span>}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ListaDia({
  citas,
  accion,
  onEstado,
  onBorrar,
  cargando,
}: {
  citas: CitaConDetalle[]
  accion: string | null
  onEstado: (id: string, estado: EstadoCita) => void
  onBorrar: (id: string) => void
  cargando: boolean
}) {
  if (citas.length === 0) {
    return (
      <div className={`${card} py-12 text-center`}>
        <p className="text-sm text-neutral-400">{cargando ? 'Cargando…' : 'No hay citas para este día.'}</p>
        {!cargando && (
          <Link href="/agenda/nueva" className={`${btnSecondary} mt-4 inline-flex`}>
            Agendar una cita
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {citas.map((c) => {
        const ocupado = accion === c.id
        return (
          <div key={c.id} className={`${card} flex flex-wrap items-center gap-3 py-3`}>
            <div className="w-14 shrink-0 text-center">
              <p className="text-lg font-semibold tabular-nums text-neutral-100">{fmtHora(c.fecha_cita)}</p>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-wide text-neutral-100">{vehiculoLabel(c)}</span>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ESTADO_CITA_BADGE[c.estado]}`}>
                  {ESTADO_CITA_LABEL[c.estado]}
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-neutral-400">
                {c.cliente?.nombre ?? 'Sin cliente'}
                {c.vehiculo?.marca ? ` · ${c.vehiculo.marca} ${c.vehiculo.modelo ?? ''}` : ''}
                {c.cliente?.telefono ? ` · ${c.cliente.telefono}` : ''}
              </p>
              {c.tipo_servicio && <p className="mt-0.5 text-sm text-neutral-300">{c.tipo_servicio}</p>}
              {c.notas && <p className="mt-0.5 text-xs italic text-neutral-500">{c.notas}</p>}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={c.estado}
                disabled={ocupado}
                onChange={(e) => onEstado(c.id, e.target.value as EstadoCita)}
                className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs text-neutral-700 outline-none focus:border-accent-500 disabled:opacity-50"
                aria-label="Cambiar estado"
              >
                {ESTADOS_CITA.map((e) => (
                  <option key={e} value={e}>
                    {ESTADO_CITA_LABEL[e]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onBorrar(c.id)}
                disabled={ocupado}
                className={`${btnGhost} text-xs text-red-700 hover:bg-red-500/10 disabled:opacity-50`}
                aria-label="Eliminar cita"
              >
                Eliminar
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
