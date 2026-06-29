'use client'

// Formulario de creación de evento en la historia técnica de un vehículo.
// Recibe historiaTecnicaId, vehiculoId y los tipos de evento disponibles (desde el Server Component).

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createEvento } from '@/modules/events/mutations'
import { ESTADOS_EVENTO_ACTIVOS, type EstadoEventoActivo } from '@/modules/events/constants'
import type { EventoCreateInput, TipoEvento } from '@/modules/events/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { Notice } from '@/components/ui/Notice'
import { inputClass, labelClass, btnPrimary, btnSecondary, card } from '@/components/ui/styles'

export function EventoForm({
  vehiculoId,
  historiaTecnicaId,
  tipos,
}: {
  vehiculoId: string
  historiaTecnicaId: string
  tipos: TipoEvento[]
}) {
  const router = useRouter()
  const [tipoEventoId, setTipoEventoId] = useState(tipos[0]?.id ?? '')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [estado, setEstado] = useState<EstadoEventoActivo | ''>('')
  const [kmVehiculo, setKmVehiculo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const sinTipos = tipos.length === 0

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const input: EventoCreateInput = {
        historia_tecnica_id: historiaTecnicaId,
        tipo_evento_id: tipoEventoId,
        ...(estado && { estado }),
        ...(titulo.trim() && { titulo: titulo.trim() }),
        ...(descripcion.trim() && { descripcion: descripcion.trim() }),
        ...(kmVehiculo.trim() && { km_vehiculo: Number.parseInt(kmVehiculo, 10) }),
      }
      const supabase = createClient()
      await createEvento(supabase, input)
      router.push(`/vehicles/${vehiculoId}`)
      router.refresh()
    } catch (err) {
      setError(toErrorMessage(err))
      setSaving(false)
    }
  }

  if (sinTipos) {
    return (
      <Notice tone="warning" title="No hay tipos de evento configurados">
        Esta organización aún no tiene tipos de evento. Se crean durante el onboarding del
        taller. No es posible registrar eventos hasta que existan.
      </Notice>
    )
  }

  return (
    <form onSubmit={onSubmit} className={`${card} space-y-4`}>
      <div>
        <label className={labelClass} htmlFor="tipoEvento">
          Tipo de evento *
        </label>
        <select
          id="tipoEvento"
          className={inputClass}
          value={tipoEventoId}
          onChange={(e) => setTipoEventoId(e.target.value)}
          required
        >
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} ({t.categoria})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="titulo">
          Título
        </label>
        <input
          id="titulo"
          className={inputClass}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="descripcion">
          Descripción
        </label>
        <textarea
          id="descripcion"
          className={inputClass}
          rows={4}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="estado">
            Estado inicial
          </label>
          <select
            id="estado"
            className={inputClass}
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoEventoActivo | '')}
          >
            <option value="">— por defecto (creado) —</option>
            {ESTADOS_EVENTO_ACTIVOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="kmVehiculo">
            Kilometraje del vehículo
          </label>
          <input
            id="kmVehiculo"
            type="number"
            className={inputClass}
            value={kmVehiculo}
            onChange={(e) => setKmVehiculo(e.target.value)}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-danger-600">{error}</p> : null}

      <div className="flex gap-3">
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? 'Guardando…' : 'Registrar evento'}
        </button>
        <button type="button" className={btnSecondary} onClick={() => router.back()}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
