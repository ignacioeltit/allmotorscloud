'use client'

// Flujo de recepción en una sola pantalla: buscar patente → cargar o crear cliente+vehículo
// → checklist → "Recibir vehículo" → crea cliente/vehículo/evento/OT y redirige a la OT.

import { useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { listVehiculos, getVehiculoByPatente } from '@/modules/vehicles/queries'
import { listClientes, listVehiculosByCliente } from '@/modules/customers/queries'
import { cargarFichaVehiculo } from '@/modules/reception/queries'
import { recibirVehiculo } from '@/modules/reception/mutations'
import {
  CHECKLIST_RECEPCION,
  COMBUSTIBLES,
  TRANSMISIONES,
  PRIORIDADES,
  PRIORIDAD_DEFAULT,
  type Prioridad,
} from '@/modules/reception/constants'
import { TIPOS_VEHICULO } from '@/modules/vehicles/constants'
import type { Vehiculo } from '@/modules/vehicles/types'
import type { Cliente } from '@/modules/customers/types'
import type { FichaVehiculo, RecibirVehiculoInput } from '@/modules/reception/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import {
  inputClass,
  inputXL,
  labelClass,
  sectionLabel,
  btnPrimary,
  btnSecondary,
  btnLarge,
  card,
  otEstadoBadge,
  otEstadoLabel,
} from '@/components/ui/styles'

type Mode = 'search' | 'existing' | 'new'

/** Sugerencia de datos vehiculares devuelta por /api/vehiculos/enriquecer. */
type SuggestedVehicle = {
  marca?: string
  modelo?: string
  anio?: number
  vin?: string
  motor?: string
  combustible?: string
  transmision?: string
  color?: string
  fuente: string
  fechaConsulta: string
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  )
}

function Section({
  step,
  title,
  children,
  action,
}: {
  step: string
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className={card}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-[11px] font-semibold text-neutral-400">
            {step}
          </span>
          <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ReceptionFlow({
  tipoRecepcionId,
  enrichmentEnabled,
}: {
  tipoRecepcionId: string
  /** true si hay un proveedor de enriquecimiento activo. Si es false, se va directo a ingreso manual. */
  enrichmentEnabled: boolean
}) {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('search')
  const [patente, setPatente] = useState('')
  const [suggestions, setSuggestions] = useState<Vehiculo[]>([])
  const [searching, setSearching] = useState(false)
  const [ficha, setFicha] = useState<FichaVehiculo | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Búsqueda: por patente (default) o por cliente
  const [searchMode, setSearchMode] = useState<'patente' | 'cliente'>('patente')
  const [clienteQuery, setClienteQuery] = useState('')
  const [clienteSuggestions, setClienteSuggestions] = useState<Cliente[]>([])
  const [searchingClientes, setSearchingClientes] = useState(false)
  const [clientePreseleccionado, setClientePreseleccionado] = useState<Cliente | null>(null)
  const [vehiculosCliente, setVehiculosCliente] = useState<Vehiculo[] | null>(null)
  const clienteSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cliente nuevo
  const [cNombre, setCNombre] = useState('')
  const [cRut, setCRut] = useState('')
  const [cTelefono, setCTelefono] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cDireccion, setCDireccion] = useState('')

  // Vehículo nuevo
  const [vMarca, setVMarca] = useState('')
  const [vModelo, setVModelo] = useState('')
  const [vTipo, setVTipo] = useState<(typeof TIPOS_VEHICULO)[number]>('auto')
  const [vAnio, setVAnio] = useState('')
  const [vMotor, setVMotor] = useState('')
  const [vVin, setVVin] = useState('')
  const [vCombustible, setVCombustible] = useState('')
  const [vTransmision, setVTransmision] = useState('')
  const [vColor, setVColor] = useState('')

  // Recepción
  const [km, setKm] = useState('')
  const [motivo, setMotivo] = useState('')
  const [prioridad, setPrioridad] = useState<Prioridad>(PRIORIDAD_DEFAULT)
  const [sintomas, setSintomas] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Enriquecimiento externo por patente (sugerencia para vehículo nuevo)
  const [enriching, setEnriching] = useState(false)
  const [enrichSuggestion, setEnrichSuggestion] = useState<SuggestedVehicle | null>(null)
  const [enrichMessage, setEnrichMessage] = useState<string | null>(null)

  const needClienteForm =
    (mode === 'new' && !clientePreseleccionado) || (mode === 'existing' && !ficha?.cliente)
  const ready = mode === 'existing' || mode === 'new'

  // ── Búsqueda de patente ──────────────────────────────────────────────────
  function onPatenteChange(value: string) {
    setPatente(value)
    setError(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const q = value.trim()
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const supabase = createClient()
        setSuggestions(await listVehiculos(supabase, { search: q, limit: 6 }))
      } catch {
        /* búsqueda silenciosa */
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  async function onPatenteSubmit(e: FormEvent) {
    e.preventDefault()
    const q = patente.trim()
    if (!q) return
    setSearching(true)
    setError(null)
    try {
      const supabase = createClient()
      const v = await getVehiculoByPatente(supabase, q)
      if (v) await selectVehiculo(v.id)
      else startNew()
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setSearching(false)
    }
  }

  async function selectVehiculo(id: string) {
    setSearching(true)
    try {
      const supabase = createClient()
      const f = await cargarFichaVehiculo(supabase, id)
      setFicha(f)
      setMode('existing')
      setSuggestions([])
      setClientePreseleccionado(null)
      setVehiculosCliente(null)
      setPatente(f.vehiculo.patente)
      if (f.vehiculo.km_actual != null) setKm(String(f.vehiculo.km_actual))
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setSearching(false)
    }
  }

  // ── Búsqueda de cliente ──────────────────────────────────────────────────
  function onClienteQueryChange(value: string) {
    setClienteQuery(value)
    setError(null)
    setVehiculosCliente(null)
    if (clienteSearchTimer.current) clearTimeout(clienteSearchTimer.current)
    const q = value.trim()
    if (q.length < 2) {
      setClienteSuggestions([])
      return
    }
    clienteSearchTimer.current = setTimeout(async () => {
      setSearchingClientes(true)
      try {
        const supabase = createClient()
        setClienteSuggestions(await listClientes(supabase, { search: q, limit: 6 }))
      } catch {
        /* búsqueda silenciosa */
      } finally {
        setSearchingClientes(false)
      }
    }, 300)
  }

  /** Selecciona un cliente de la búsqueda: carga directo si tiene 1 vehículo,
   *  muestra selector si tiene varios, o pasa a ingreso de patente nueva si no tiene ninguno. */
  async function selectCliente(cliente: Cliente) {
    setSearchingClientes(true)
    setError(null)
    try {
      const supabase = createClient()
      const vehiculos = await listVehiculosByCliente(supabase, cliente.id)
      const unico = vehiculos.length === 1 ? vehiculos[0] : undefined
      if (unico) {
        await selectVehiculo(unico.id)
      } else if (vehiculos.length === 0) {
        setClientePreseleccionado(cliente)
        setClienteSuggestions([])
        setVehiculosCliente(null)
        setSearchMode('patente')
        setPatente('')
      } else {
        setClientePreseleccionado(cliente)
        setVehiculosCliente(vehiculos)
        setClienteSuggestions([])
      }
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setSearchingClientes(false)
    }
  }

  /** Desde el selector de vehículos de un cliente: registrar un vehículo nuevo para él. */
  function nuevoVehiculoParaCliente() {
    setVehiculosCliente(null)
    setSearchMode('patente')
    setPatente('')
  }

  function startNew() {
    setMode('new')
    setFicha(null)
    setSuggestions([])
    const plate = patente.trim().toUpperCase()
    setPatente(plate)
    if (enrichmentEnabled) {
      // Hay proveedor activo: intentar enriquecimiento externo.
      void enriquecer(plate)
    } else {
      // Sin proveedor: ir directo a ingreso manual con aviso claro (no es un fallo).
      setEnriching(false)
      setEnrichSuggestion(null)
      setEnrichMessage('Consulta automática no configurada. Ingresa los datos manualmente.')
    }
  }

  /**
   * Consulta /api/vehiculos/enriquecer (server-only, sin tokens en el cliente).
   * NO autocompleta: presenta una sugerencia que el recepcionista confirma o descarta.
   */
  async function enriquecer(plate: string) {
    setEnriching(true)
    setEnrichSuggestion(null)
    setEnrichMessage(null)
    try {
      const res = await fetch(`/api/vehiculos/enriquecer?patente=${encodeURIComponent(plate)}`)
      const json = (await res.json()) as
        | { found: true; data: SuggestedVehicle }
        | { found: false; reason?: string }

      if (res.ok && json.found && json.data) {
        setEnrichSuggestion(json.data)
      } else {
        const reason = !json.found ? json.reason : undefined
        setEnrichMessage(
          reason === 'not_configured'
            ? 'Consulta automática no configurada. Ingresa los datos manualmente.'
            : 'No encontramos datos para esta patente. Ingresa los datos manualmente.',
        )
      }
    } catch {
      setEnrichMessage('No encontramos datos para esta patente. Ingresa los datos manualmente.')
    } finally {
      setEnriching(false)
    }
  }

  /** Aplica la sugerencia a los campos del formulario (todos siguen editables). */
  function usarSugerencia() {
    const d = enrichSuggestion
    if (!d) return
    if (d.marca) setVMarca(d.marca)
    if (d.modelo) setVModelo(d.modelo)
    if (d.anio != null) setVAnio(String(d.anio))
    if (d.vin) setVVin(d.vin)
    if (d.motor) setVMotor(d.motor)
    if (d.color) setVColor(d.color)
    if (d.combustible && (COMBUSTIBLES as readonly string[]).includes(d.combustible)) {
      setVCombustible(d.combustible)
    }
    if (d.transmision && (TRANSMISIONES as readonly string[]).includes(d.transmision)) {
      setVTransmision(d.transmision)
    }
    setEnrichSuggestion(null)
    setEnrichMessage(`Datos aplicados desde ${d.fuente}. Revisa antes de guardar.`)
  }

  function descartarSugerencia() {
    setEnrichSuggestion(null)
    setEnrichMessage('Ingresa los datos del vehículo manualmente.')
  }

  function resetSearch() {
    setMode('search')
    setFicha(null)
    setSuggestions([])
    setError(null)
    setEnrichSuggestion(null)
    setEnrichMessage(null)
    setSearchMode('patente')
    setClienteQuery('')
    setClienteSuggestions([])
    setClientePreseleccionado(null)
    setVehiculosCliente(null)
  }

  function toggleCheck(key: string) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const canSubmit =
    ready &&
    motivo.trim().length > 0 &&
    (!needClienteForm || cNombre.trim().length > 0) &&
    (mode !== 'new' || (patente.trim() && vMarca.trim() && vModelo.trim()))

  async function onRecibir() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const kmNum = km.trim() ? Number.parseInt(km, 10) : undefined
      const anioNum = vAnio.trim() ? Number.parseInt(vAnio, 10) : undefined

      const clienteIdPreexistente =
        mode === 'existing' && ficha?.cliente
          ? ficha.cliente.id
          : mode === 'new' && clientePreseleccionado
            ? clientePreseleccionado.id
            : null

      const input: RecibirVehiculoInput = {
        tipoEventoRecepcionId: tipoRecepcionId,
        clienteId: clienteIdPreexistente,
        clienteNuevo: needClienteForm
          ? {
              nombre: cNombre.trim(),
              tipo: 'persona_natural',
              ...(cRut.trim() && { rut: cRut.trim() }),
              ...(cTelefono.trim() && { telefono: cTelefono.trim() }),
              ...(cEmail.trim() && { email: cEmail.trim() }),
              ...(cDireccion.trim() && { direccion: cDireccion.trim() }),
            }
          : null,
        vehiculoId: mode === 'existing' && ficha ? ficha.vehiculo.id : null,
        vehiculoNuevo:
          mode === 'new'
            ? {
                patente: patente.trim(),
                marca: vMarca.trim(),
                modelo: vModelo.trim(),
                tipo: vTipo,
                ...(anioNum != null ? { anio: anioNum } : {}),
                ...(vVin.trim() && { vin: vVin.trim() }),
                ...(vColor.trim() && { color: vColor.trim() }),
                ...(kmNum != null ? { km_actual: kmNum } : {}),
                ...(vMotor.trim() && { motor: vMotor.trim() }),
                ...(vCombustible.trim() && { combustible: vCombustible.trim() }),
                ...(vTransmision.trim() && { transmision: vTransmision.trim() }),
              }
            : null,
        motivo: motivo.trim(),
        prioridad,
        ...(sintomas.trim() && { sintomas: sintomas.trim() }),
        ...(observaciones.trim() && { observaciones: observaciones.trim() }),
        ...(kmNum != null ? { km: kmNum } : {}),
        checklist,
      }

      const supabase = createClient()
      const result = await recibirVehiculo(supabase, input)
      router.push(`/repair-orders/${result.ordenTrabajoId}`)
      router.refresh()
    } catch (err) {
      setError(toErrorMessage(err))
      setSubmitting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="pb-28">
      <header className="mb-6">
        <p className={sectionLabel}>Recepción</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-50">Nueva Recepción</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Recibe un vehículo en una sola pantalla. Busca la patente; si existe se carga todo.
        </p>
      </header>

      <div className="space-y-5">
        {/* Sección 1 — Búsqueda */}
        <Section
          step="1"
          title={searchMode === 'patente' ? 'Patente' : 'Cliente'}
          action={
            ready ? (
              <button type="button" onClick={resetSearch} className={btnSecondary}>
                Buscar otra
              </button>
            ) : null
          }
        >
          {!ready && (
            <div className="mb-4 inline-flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
              <button
                type="button"
                onClick={() => setSearchMode('patente')}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  searchMode === 'patente'
                    ? 'bg-white/[0.08] text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Por patente
              </button>
              <button
                type="button"
                onClick={() => setSearchMode('cliente')}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  searchMode === 'cliente'
                    ? 'bg-white/[0.08] text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Por cliente
              </button>
            </div>
          )}

          {!ready && searchMode === 'patente' && (
            <form onSubmit={onPatenteSubmit}>
              <input
                autoFocus
                value={patente}
                onChange={(e) => onPatenteChange(e.target.value)}
                placeholder="ABCD12"
                className={inputXL}
                aria-label="Patente"
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-neutral-600">
                  {clientePreseleccionado
                    ? `Vehículo nuevo para ${clientePreseleccionado.nombre}. Escribe la patente.`
                    : searching
                      ? 'Buscando…'
                      : 'Escribe y presiona Enter para buscar.'}
                </p>
              </div>

              {suggestions.length > 0 && (
                <ul className="mt-3 divide-y divide-white/[0.05] overflow-hidden rounded-lg border border-white/[0.06]">
                  {suggestions.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => selectVehiculo(v.id)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="font-semibold tracking-wide text-neutral-100">
                          {v.patente}
                        </span>
                        <span className="text-sm text-neutral-400">
                          {v.marca} {v.modelo}
                          {v.anio ? ` · ${v.anio}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {patente.trim().length >= 2 && !searching && suggestions.length === 0 && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <span className="text-sm text-neutral-400">
                    No hay un vehículo con esa patente.
                  </span>
                  <button type="button" onClick={startNew} className={btnSecondary}>
                    Registrar nuevo vehículo
                  </button>
                </div>
              )}
            </form>
          )}

          {!ready && searchMode === 'cliente' && (
            <div>
              {vehiculosCliente ? (
                <div>
                  <p className="mb-3 text-sm text-neutral-400">
                    Vehículos de <span className="text-neutral-200">{clientePreseleccionado?.nombre}</span>:
                  </p>
                  <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-lg border border-white/[0.06]">
                    {vehiculosCliente.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => selectVehiculo(v.id)}
                          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                        >
                          <span className="font-semibold tracking-wide text-neutral-100">
                            {v.patente}
                          </span>
                          <span className="text-sm text-neutral-400">
                            {v.marca} {v.modelo}
                            {v.anio ? ` · ${v.anio}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={nuevoVehiculoParaCliente}
                    className={`${btnSecondary} mt-3`}
                  >
                    Registrar otro vehículo para este cliente
                  </button>
                </div>
              ) : (
                <>
                  <input
                    autoFocus
                    value={clienteQuery}
                    onChange={(e) => onClienteQueryChange(e.target.value)}
                    placeholder="Nombre del cliente"
                    className={inputXL}
                    aria-label="Cliente"
                  />
                  <p className="mt-2 text-xs text-neutral-600">
                    {searchingClientes ? 'Buscando…' : 'Escribe al menos 2 letras.'}
                  </p>

                  {clienteSuggestions.length > 0 && (
                    <ul className="mt-3 divide-y divide-white/[0.05] overflow-hidden rounded-lg border border-white/[0.06]">
                      {clienteSuggestions.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => selectCliente(c)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                          >
                            <span className="font-semibold text-neutral-100">{c.nombre}</span>
                            <span className="text-sm text-neutral-400">{c.rut || c.telefono || '—'}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {clienteQuery.trim().length >= 2 && !searchingClientes && clienteSuggestions.length === 0 && (
                    <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                      <span className="text-sm text-neutral-400">No hay clientes con ese nombre.</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {ready && (
            <div className="flex items-center gap-3">
              <span className="rounded-lg border border-white/10 bg-neutral-950/60 px-4 py-2 text-lg font-semibold tracking-[0.18em] text-neutral-50">
                {patente.toUpperCase()}
              </span>
              <span className="text-sm text-neutral-500">
                {mode === 'existing' ? 'Vehículo encontrado' : 'Vehículo nuevo'}
                {mode === 'new' && clientePreseleccionado ? ` · ${clientePreseleccionado.nombre}` : ''}
              </span>
            </div>
          )}
        </Section>

        {ready && (
          <>
            {/* Sección 2 — Cliente */}
            <Section step="2" title="Cliente">
              {(mode === 'existing' && ficha?.cliente) || (mode === 'new' && clientePreseleccionado) ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Info label="Nombre" value={(ficha?.cliente ?? clientePreseleccionado)?.nombre ?? null} />
                  <Info label="RUT" value={(ficha?.cliente ?? clientePreseleccionado)?.rut ?? null} />
                  <Info label="Teléfono" value={(ficha?.cliente ?? clientePreseleccionado)?.telefono ?? null} />
                  <Info label="Email" value={(ficha?.cliente ?? clientePreseleccionado)?.email ?? null} />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Nombre *">
                    <input className={inputClass} value={cNombre} onChange={(e) => setCNombre(e.target.value)} />
                  </Field>
                  <Field label="RUT">
                    <input className={inputClass} value={cRut} onChange={(e) => setCRut(e.target.value)} />
                  </Field>
                  <Field label="Teléfono">
                    <input className={inputClass} value={cTelefono} onChange={(e) => setCTelefono(e.target.value)} />
                  </Field>
                  <Field label="Email">
                    <input type="email" className={inputClass} value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Dirección">
                      <input className={inputClass} value={cDireccion} onChange={(e) => setCDireccion(e.target.value)} />
                    </Field>
                  </div>
                </div>
              )}
            </Section>

            {/* Sección 3 — Vehículo */}
            <Section step="3" title="Vehículo">
              {mode === 'existing' && ficha ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Info label="Marca" value={ficha.vehiculo.marca} />
                  <Info label="Modelo" value={ficha.vehiculo.modelo} />
                  <Info label="Año" value={ficha.vehiculo.anio?.toString() ?? null} />
                  <Info label="Color" value={ficha.vehiculo.color} />
                  <Info label="VIN" value={ficha.vehiculo.vin} />
                  <Info label="Tipo" value={ficha.vehiculo.tipo} />
                  <Info label="Km registrado" value={ficha.vehiculo.km_actual?.toLocaleString('es-CL') ?? null} />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {enriching || enrichSuggestion || enrichMessage ? (
                    <div className="sm:col-span-3">
                      {enriching ? (
                        <p className="text-sm text-neutral-500">Consultando datos del vehículo…</p>
                      ) : enrichSuggestion ? (
                        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                              Datos encontrados
                            </p>
                            <p className="text-xs text-neutral-500">
                              {enrichSuggestion.fuente} ·{' '}
                              {new Date(enrichSuggestion.fechaConsulta).toLocaleString('es-CL')}
                            </p>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                            <Info label="Marca" value={enrichSuggestion.marca ?? null} />
                            <Info label="Modelo" value={enrichSuggestion.modelo ?? null} />
                            <Info label="Año" value={enrichSuggestion.anio?.toString() ?? null} />
                            <Info label="Color" value={enrichSuggestion.color ?? null} />
                            <Info label="VIN" value={enrichSuggestion.vin ?? null} />
                            <Info label="Motor" value={enrichSuggestion.motor ?? null} />
                            <Info label="Combustible" value={enrichSuggestion.combustible ?? null} />
                            <Info label="Transmisión" value={enrichSuggestion.transmision ?? null} />
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2.5">
                            <button type="button" onClick={usarSugerencia} className={btnPrimary}>
                              Usar datos
                            </button>
                            <button type="button" onClick={descartarSugerencia} className={btnSecondary}>
                              Ingresar manualmente
                            </button>
                          </div>
                        </div>
                      ) : enrichMessage ? (
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-neutral-300">
                          {enrichMessage}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <Field label="Marca *">
                    <input className={inputClass} value={vMarca} onChange={(e) => setVMarca(e.target.value)} />
                  </Field>
                  <Field label="Modelo *">
                    <input className={inputClass} value={vModelo} onChange={(e) => setVModelo(e.target.value)} />
                  </Field>
                  <Field label="Año">
                    <input type="number" className={inputClass} value={vAnio} onChange={(e) => setVAnio(e.target.value)} />
                  </Field>
                  <Field label="Motor">
                    <input className={inputClass} value={vMotor} onChange={(e) => setVMotor(e.target.value)} placeholder="2.0T" />
                  </Field>
                  <Field label="VIN">
                    <input className={inputClass} value={vVin} onChange={(e) => setVVin(e.target.value)} />
                  </Field>
                  <Field label="Tipo">
                    <select className={inputClass} value={vTipo} onChange={(e) => setVTipo(e.target.value as (typeof TIPOS_VEHICULO)[number])}>
                      {TIPOS_VEHICULO.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Combustible">
                    <select className={inputClass} value={vCombustible} onChange={(e) => setVCombustible(e.target.value)}>
                      <option value="">—</option>
                      {COMBUSTIBLES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Transmisión">
                    <select className={inputClass} value={vTransmision} onChange={(e) => setVTransmision(e.target.value)}>
                      <option value="">—</option>
                      {TRANSMISIONES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Color">
                    <input className={inputClass} value={vColor} onChange={(e) => setVColor(e.target.value)} />
                  </Field>
                </div>
              )}

              {mode === 'existing' && ficha && (ficha.eventos.length > 0 || ficha.ordenes.length > 0) && (
                <div className="mt-5 grid grid-cols-1 gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
                  <div>
                    <p className={sectionLabel}>Últimas OT</p>
                    <ul className="mt-2 space-y-1.5">
                      {ficha.ordenes.slice(0, 3).map((ot) => (
                        <li key={ot.id} className="flex items-center justify-between text-sm">
                          <span className="text-neutral-300">{ot.numero_ot}</span>
                          <span className={otEstadoBadge(ot.estado)}>{otEstadoLabel(ot.estado)}</span>
                        </li>
                      ))}
                      {ficha.ordenes.length === 0 && <li className="text-sm text-neutral-600">Sin OT previas</li>}
                    </ul>
                  </div>
                  <div>
                    <p className={sectionLabel}>Últimos eventos</p>
                    <ul className="mt-2 space-y-1.5">
                      {ficha.eventos.slice(0, 3).map((ev) => (
                        <li key={ev.id} className="truncate text-sm text-neutral-400">
                          {ev.titulo ?? 'Evento'}
                        </li>
                      ))}
                      {ficha.eventos.length === 0 && <li className="text-sm text-neutral-600">Sin eventos</li>}
                    </ul>
                  </div>
                </div>
              )}
            </Section>

            {/* Sección 4 — Recepción */}
            <Section step="4" title="Recepción">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Kilómetros">
                  <input type="number" className={inputClass} value={km} onChange={(e) => setKm(e.target.value)} />
                </Field>
                <Field label="Prioridad">
                  <select
                    className={inputClass}
                    value={prioridad}
                    onChange={(e) => setPrioridad(e.target.value as Prioridad)}
                  >
                    {PRIORIDADES.map((p) => (
                      <option key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-3">
                  <Field label="Motivo del ingreso *">
                    <input className={inputClass} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mantención 40.000 km, ruido al frenar…" />
                  </Field>
                </div>
                <div className="sm:col-span-3">
                  <Field label="Síntomas">
                    <textarea rows={2} className={inputClass} value={sintomas} onChange={(e) => setSintomas(e.target.value)} />
                  </Field>
                </div>
                <div className="sm:col-span-3">
                  <Field label="Observaciones">
                    <textarea rows={2} className={inputClass} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                  </Field>
                </div>
              </div>

              <div className="mt-5">
                <p className={sectionLabel}>Checklist de recepción</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {CHECKLIST_RECEPCION.map((item) => {
                    const on = checklist[item.key] === true
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => toggleCheck(item.key)}
                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                          on
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                            : 'border-white/[0.07] bg-white/[0.02] text-neutral-400 hover:border-white/15'
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            on ? 'border-emerald-400 bg-emerald-500 text-neutral-950' : 'border-white/20'
                          }`}
                        >
                          {on && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </span>
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </Section>

            {error && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {/* Barra de acción fija */}
      {ready && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.08] bg-neutral-950/80 backdrop-blur md:pl-64">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 md:px-8">
            <p className="text-sm text-neutral-500">
              {mode === 'existing' ? 'Vehículo existente' : 'Vehículo nuevo'} ·{' '}
              {motivo.trim() ? 'Listo para recibir' : 'Indica el motivo del ingreso'}
            </p>
            <button type="button" onClick={onRecibir} disabled={!canSubmit || submitting} className={btnLarge}>
              {submitting ? 'Recibiendo…' : 'Recibir vehículo →'}
            </button>
          </div>
        </div>
      )}
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
