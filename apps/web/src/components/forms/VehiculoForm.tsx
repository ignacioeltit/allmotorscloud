'use client'

// Formulario de creación de vehículo. Al crear, un trigger de DB crea la historia técnica 1:1.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createVehiculo } from '@/modules/vehicles/mutations'
import { TIPOS_VEHICULO, TIPO_VEHICULO_DEFAULT, type TipoVehiculo } from '@/modules/vehicles/constants'
import type { VehiculoCreateInput } from '@/modules/vehicles/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { inputClass, labelClass, btnPrimary, btnSecondary, card } from '@/components/ui/styles'

export function VehiculoForm() {
  const router = useRouter()
  const [patente, setPatente] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [tipo, setTipo] = useState<TipoVehiculo>(TIPO_VEHICULO_DEFAULT)
  const [vin, setVin] = useState('')
  const [anio, setAnio] = useState('')
  const [color, setColor] = useState('')
  const [kmActual, setKmActual] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const input: VehiculoCreateInput = {
        patente: patente.trim(),
        marca: marca.trim(),
        modelo: modelo.trim(),
        tipo,
        ...(vin.trim() && { vin: vin.trim() }),
        ...(anio.trim() && { anio: Number.parseInt(anio, 10) }),
        ...(color.trim() && { color: color.trim() }),
        ...(kmActual.trim() && { km_actual: Number.parseInt(kmActual, 10) }),
        ...(notas.trim() && { notas: notas.trim() }),
      }
      const supabase = createClient()
      const creado = await createVehiculo(supabase, input)
      router.push(`/vehicles/${creado.id}`)
      router.refresh()
    } catch (err) {
      setError(toErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className={`${card} space-y-4`}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="patente">
            Patente *
          </label>
          <input
            id="patente"
            className={inputClass}
            value={patente}
            onChange={(e) => setPatente(e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="marca">
            Marca *
          </label>
          <input
            id="marca"
            className={inputClass}
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="modelo">
            Modelo *
          </label>
          <input
            id="modelo"
            className={inputClass}
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="tipo">
            Tipo
          </label>
          <select
            id="tipo"
            className={inputClass}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoVehiculo)}
          >
            {TIPOS_VEHICULO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="anio">
            Año
          </label>
          <input
            id="anio"
            type="number"
            className={inputClass}
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="kmActual">
            Kilometraje
          </label>
          <input
            id="kmActual"
            type="number"
            className={inputClass}
            value={kmActual}
            onChange={(e) => setKmActual(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="vin">
            VIN
          </label>
          <input id="vin" className={inputClass} value={vin} onChange={(e) => setVin(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="color">
            Color
          </label>
          <input id="color" className={inputClass} value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="notas">
          Notas
        </label>
        <textarea
          id="notas"
          className={inputClass}
          rows={3}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-danger-600">{error}</p> : null}

      <div className="flex gap-3">
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? 'Guardando…' : 'Crear vehículo'}
        </button>
        <button type="button" className={btnSecondary} onClick={() => router.back()}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
