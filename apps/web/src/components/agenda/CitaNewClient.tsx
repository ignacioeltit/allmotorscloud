'use client'

// Nueva cita. Se agenda sobre un vehículo YA registrado: se busca por patente
// (y se carga su propietario), o viene precargado desde una cotización
// (?vehiculo_id&cliente_id&motivo). Vehículos nuevos entran por recepción.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getVehiculoByPatente } from '@/modules/vehicles/queries'
import { getPropietarioActivoByVehiculo } from '@/modules/customers/queries'
import { crearCita } from '@/modules/agenda/mutations'
import type { Vehiculo } from '@/modules/vehicles/types'
import type { Cliente } from '@/modules/customers/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, inputClass, inputXL, labelClass, sectionLabel, btnPrimary, btnSecondary } from '@/components/ui/styles'

function hoyYMD(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export interface CitaPrefill {
  vehiculoId: string
  clienteId: string | null
  vehiculoLabel: string
  clienteNombre: string | null
  motivo: string
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  )
}

export function CitaNewClient({ prefill }: { prefill?: CitaPrefill }) {
  const router = useRouter()

  const [patente, setPatente] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)

  // Cuando viene precargado desde una cotización, no hace falta buscar patente.
  const vehiculoId = prefill?.vehiculoId ?? vehiculo?.id ?? null
  const clienteId = prefill?.clienteId ?? cliente?.id ?? null
  const vehiculoLabel = prefill?.vehiculoLabel ?? (vehiculo ? `${vehiculo.patente} · ${vehiculo.marca} ${vehiculo.modelo}` : null)
  const clienteNombre = prefill?.clienteNombre ?? cliente?.nombre ?? null

  const [fecha, setFecha] = useState(hoyYMD())
  const [hora, setHora] = useState('09:00')
  const [motivo, setMotivo] = useState(prefill?.motivo ?? '')
  const [notas, setNotas] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  async function onBuscar(e: FormEvent) {
    e.preventDefault()
    const q = patente.trim()
    if (!q) return
    setBuscando(true)
    setError(null)
    try {
      const supabase = createClient()
      const v = await getVehiculoByPatente(supabase, q)
      if (!v) {
        setError('No encontramos ese vehículo. Regístralo en una recepción o cotización primero.')
        return
      }
      const c = await getPropietarioActivoByVehiculo(supabase, v.id)
      setVehiculo(v)
      setCliente(c)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBuscando(false)
    }
  }

  async function crear() {
    if (!vehiculoId) return
    setCreando(true)
    setError(null)
    try {
      const fechaCita = new Date(`${fecha}T${hora}`).toISOString()
      await crearCita(createClient(), {
        vehiculoId,
        clienteId,
        fechaCita,
        tipoServicio: motivo.trim() || undefined,
        notas: notas.trim() || undefined,
      })
      router.push('/agenda')
      router.refresh()
    } catch (err) {
      setError(toErrorMessage(err))
      setCreando(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Paso 1 — Vehículo */}
      <section className={card}>
        <div className="mb-4 flex items-center justify-between">
          <p className={sectionLabel}>Vehículo</p>
          {!prefill && vehiculo && (
            <button
              type="button"
              onClick={() => {
                setVehiculo(null)
                setCliente(null)
                setError(null)
              }}
              className={btnSecondary}
            >
              Buscar otro
            </button>
          )}
        </div>

        {vehiculoId ? (
          <div>
            <p className="font-medium tracking-wide text-neutral-100">{vehiculoLabel}</p>
            <p className="text-sm text-neutral-500">{clienteNombre ?? 'Sin cliente asociado'}</p>
          </div>
        ) : (
          <form onSubmit={onBuscar}>
            <input
              autoFocus
              value={patente}
              onChange={(e) => setPatente(e.target.value)}
              placeholder="Patente (ABCD12)"
              className={inputXL}
              aria-label="Patente"
            />
            <p className="mt-2 text-xs text-neutral-600">
              {buscando ? 'Buscando…' : 'Escribe la patente de un vehículo ya registrado y presiona Enter.'}
            </p>
          </form>
        )}
      </section>

      {/* Paso 2 — Fecha, hora y motivo */}
      {vehiculoId && (
        <section className={card}>
          <p className={`${sectionLabel} mb-4`}>Detalle de la cita</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fecha *">
              <input type="date" className={inputClass} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Field>
            <Field label="Hora *">
              <input type="time" className={inputClass} value={hora} onChange={(e) => setHora(e.target.value)} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Motivo / servicio">
              <input
                className={inputClass}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Cambio de aceite, revisión de frenos"
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Notas (opcional)">
              <textarea rows={2} className={inputClass} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </Field>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={() => void crear()} disabled={creando || !fecha || !hora} className={btnPrimary}>
              {creando ? 'Agendando…' : 'Agendar cita →'}
            </button>
          </div>
        </section>
      )}

      {/* Error de búsqueda cuando aún no hay vehículo */}
      {!vehiculoId && error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  )
}
