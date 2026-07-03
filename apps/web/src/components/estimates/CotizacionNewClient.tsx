'use client'

// Crear una cotización (presupuesto sin OT): busca el vehículo por patente
// (si existe, carga su cliente); si no, captura cliente + vehículo nuevos.
// Al crear llama fn_crear_cotizacion (atómico) y redirige al detalle para
// agregar los ítems cotizados.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getVehiculoByPatente } from '@/modules/vehicles/queries'
import { getPropietarioActivoByVehiculo } from '@/modules/customers/queries'
import { TIPOS_VEHICULO } from '@/modules/vehicles/constants'
import { TIPOS_CLIENTE, TIPO_CLIENTE_LABEL, TIPO_CLIENTE_DEFAULT, type TipoCliente } from '@/modules/customers/constants'
import type { Vehiculo } from '@/modules/vehicles/types'
import type { Cliente } from '@/modules/customers/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import {
  card,
  inputClass,
  inputXL,
  labelClass,
  sectionLabel,
  btnPrimary,
  btnSecondary,
} from '@/components/ui/styles'

type Modo = 'buscar' | 'existente' | 'nuevo'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-neutral-600">{label}</p>
      <p className="mt-0.5 text-sm text-neutral-200">{value || '—'}</p>
    </div>
  )
}

export function CotizacionNewClient() {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>('buscar')
  const [patente, setPatente] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  // Existente
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)

  // Nuevo cliente
  const [cNombre, setCNombre] = useState('')
  const [cTipo, setCTipo] = useState<TipoCliente>(TIPO_CLIENTE_DEFAULT)
  const [cRut, setCRut] = useState('')
  const [cTelefono, setCTelefono] = useState('')
  // Nuevo vehículo
  const [vMarca, setVMarca] = useState('')
  const [vModelo, setVModelo] = useState('')
  const [vTipo, setVTipo] = useState<(typeof TIPOS_VEHICULO)[number]>('auto')
  const [vAnio, setVAnio] = useState('')
  const [vColor, setVColor] = useState('')

  const [notas, setNotas] = useState('')

  async function onBuscar(e: FormEvent) {
    e.preventDefault()
    const q = patente.trim()
    if (!q) return
    setBuscando(true)
    setError(null)
    try {
      const supabase = createClient()
      const v = await getVehiculoByPatente(supabase, q)
      if (v) {
        const c = await getPropietarioActivoByVehiculo(supabase, v.id)
        setVehiculo(v)
        setCliente(c)
        setModo('existente')
      } else {
        setPatente(q.toUpperCase())
        setModo('nuevo')
      }
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBuscando(false)
    }
  }

  function reset() {
    setModo('buscar')
    setVehiculo(null)
    setCliente(null)
    setError(null)
  }

  const necesitaCliente = modo === 'nuevo' || (modo === 'existente' && !cliente)
  const puedeCrear =
    modo === 'existente'
      ? true
      : Boolean(patente.trim() && vMarca.trim() && vModelo.trim() && cNombre.trim())

  async function crear() {
    setCreando(true)
    setError(null)
    try {
      const supabase = createClient()
      const anioNum = vAnio.trim() ? Number.parseInt(vAnio, 10) : null

      const payload = {
        p_cliente_id: modo === 'existente' && cliente ? cliente.id : null,
        p_cliente: necesitaCliente
          ? {
              nombre: cNombre.trim(),
              tipo: cTipo,
              ...(cRut.trim() && { rut: cRut.trim() }),
              ...(cTelefono.trim() && { telefono: cTelefono.trim() }),
            }
          : null,
        p_vehiculo_id: modo === 'existente' && vehiculo ? vehiculo.id : null,
        p_vehiculo:
          modo === 'nuevo'
            ? {
                patente: patente.trim().toUpperCase(),
                marca: vMarca.trim(),
                modelo: vModelo.trim(),
                tipo: vTipo,
                ...(anioNum != null && Number.isFinite(anioNum) ? { anio: String(anioNum) } : {}),
                ...(vColor.trim() && { color: vColor.trim() }),
              }
            : null,
        p_notas: notas.trim() || null,
      }

      const { data, error: rpcError } = await supabase.rpc('fn_crear_cotizacion', payload)
      if (rpcError) throw new Error(rpcError.message)
      const result = data as { presupuesto_id: string }
      router.push(`/estimates/${result.presupuesto_id}`)
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
          {modo !== 'buscar' && (
            <button type="button" onClick={reset} className={btnSecondary}>
              Buscar otra
            </button>
          )}
        </div>

        {modo === 'buscar' ? (
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
              {buscando ? 'Buscando…' : 'Escribe la patente y presiona Enter. Si no existe, la registras.'}
            </p>
          </form>
        ) : modo === 'existente' && vehiculo ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Info label="Patente" value={vehiculo.patente} />
            <Info label="Marca" value={vehiculo.marca} />
            <Info label="Modelo" value={vehiculo.modelo} />
            <Info label="Año" value={vehiculo.anio?.toString() ?? null} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Patente *">
              <input className={inputClass} value={patente} onChange={(e) => setPatente(e.target.value)} />
            </Field>
            <Field label="Marca *">
              <input className={inputClass} value={vMarca} onChange={(e) => setVMarca(e.target.value)} />
            </Field>
            <Field label="Modelo *">
              <input className={inputClass} value={vModelo} onChange={(e) => setVModelo(e.target.value)} />
            </Field>
            <Field label="Año">
              <input type="number" className={inputClass} value={vAnio} onChange={(e) => setVAnio(e.target.value)} />
            </Field>
            <Field label="Tipo">
              <select className={inputClass} value={vTipo} onChange={(e) => setVTipo(e.target.value as (typeof TIPOS_VEHICULO)[number])}>
                {TIPOS_VEHICULO.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Color">
              <input className={inputClass} value={vColor} onChange={(e) => setVColor(e.target.value)} />
            </Field>
          </div>
        )}
      </section>

      {/* Paso 2 — Cliente */}
      {modo !== 'buscar' && (
        <section className={card}>
          <p className={`${sectionLabel} mb-4`}>Cliente</p>
          {modo === 'existente' && cliente ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Info label="Nombre" value={cliente.nombre} />
              <Info label="RUT" value={cliente.rut} />
              <Info label="Teléfono" value={cliente.telefono} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre *">
                <input className={inputClass} value={cNombre} onChange={(e) => setCNombre(e.target.value)} />
              </Field>
              <Field label="Tipo de cliente">
                <select className={inputClass} value={cTipo} onChange={(e) => setCTipo(e.target.value as TipoCliente)}>
                  {TIPOS_CLIENTE.map((t) => (
                    <option key={t} value={t}>{TIPO_CLIENTE_LABEL[t]}</option>
                  ))}
                </select>
              </Field>
              <Field label="RUT">
                <input className={inputClass} value={cRut} onChange={(e) => setCRut(e.target.value)} />
              </Field>
              <Field label="Teléfono">
                <input className={inputClass} value={cTelefono} onChange={(e) => setCTelefono(e.target.value)} />
              </Field>
            </div>
          )}
        </section>
      )}

      {/* Paso 3 — Notas + crear */}
      {modo !== 'buscar' && (
        <section className={card}>
          <p className={`${sectionLabel} mb-4`}>Cotización</p>
          <Field label="Notas (opcional)">
            <textarea rows={2} className={inputClass} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: Cotización solicitada por teléfono" />
          </Field>
          {error && (
            <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={() => void crear()} disabled={!puedeCrear || creando} className={btnPrimary}>
              {creando ? 'Creando…' : 'Crear cotización →'}
            </button>
            <p className="text-xs text-neutral-500">Luego agregas los ítems (mano de obra y repuestos).</p>
          </div>
        </section>
      )}
    </div>
  )
}
