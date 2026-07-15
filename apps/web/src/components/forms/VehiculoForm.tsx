'use client'

// Formulario de creación de vehículo. Al crear, un trigger de DB crea la historia
// técnica 1:1. Permite asignar un cliente existente (buscándolo) o dejarlo sin
// cliente para asignarlo después. Si viene desde la ficha de un cliente, llega
// preseleccionado vía `clienteInicial`.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createVehiculo } from '@/modules/vehicles/mutations'
import { asignarPropietario } from '@/modules/customers/mutations'
import { listClientes } from '@/modules/customers/queries'
import { TIPOS_VEHICULO, TIPO_VEHICULO_DEFAULT, type TipoVehiculo } from '@/modules/vehicles/constants'
import type { VehiculoCreateInput } from '@/modules/vehicles/types'
import type { Cliente } from '@/modules/customers/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { inputClass, labelClass, btnPrimary, btnSecondary, card } from '@/components/ui/styles'

export function VehiculoForm({
  clienteInicial,
}: {
  clienteInicial?: { id: string; nombre: string }
}) {
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

  // Cliente / propietario
  const [cliente, setCliente] = useState<{ id: string; nombre: string } | null>(clienteInicial ?? null)
  const [clienteQuery, setClienteQuery] = useState('')
  const [resultados, setResultados] = useState<Cliente[]>([])
  const [buscando, setBuscando] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (cliente) return
    const q = clienteQuery.trim()
    if (timer.current) clearTimeout(timer.current)
    if (q.length < 2) {
      setResultados([])
      return
    }
    timer.current = setTimeout(async () => {
      setBuscando(true)
      try {
        setResultados(await listClientes(createClient(), { search: q, limit: 8 }))
      } catch {
        /* búsqueda silenciosa */
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [clienteQuery, cliente])

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
      if (cliente) {
        await asignarPropietario(supabase, { vehiculoId: creado.id, clienteId: cliente.id })
      }
      router.push(`/vehicles/${creado.id}`)
      router.refresh()
    } catch (err) {
      setError(toErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className={`${card} space-y-4`}>
      {/* Cliente / propietario */}
      <div>
        <label className={labelClass}>Cliente (propietario)</label>
        {cliente ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2">
            <span className="text-sm font-medium text-neutral-100">{cliente.nombre}</span>
            <button
              type="button"
              className="text-xs text-neutral-500 hover:text-neutral-300"
              onClick={() => {
                setCliente(null)
                setClienteQuery('')
              }}
            >
              Cambiar
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              className={inputClass}
              placeholder="Buscar cliente por nombre, RUT o teléfono…"
              value={clienteQuery}
              onChange={(e) => setClienteQuery(e.target.value)}
            />
            {(buscando || resultados.length > 0) && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-neutral-900 shadow-lg">
                {buscando && <p className="px-3 py-2 text-xs text-neutral-500">Buscando…</p>}
                {resultados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCliente({ id: c.id, nombre: c.nombre })
                      setResultados([])
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-neutral-200 hover:bg-black/20"
                  >
                    {c.nombre}
                    {c.rut ? <span className="ml-2 text-xs text-neutral-500">{c.rut}</span> : null}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-neutral-600">
              Opcional: puedes crear el vehículo sin cliente y asignarlo después desde la ficha del vehículo.
            </p>
          </div>
        )}
      </div>

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
