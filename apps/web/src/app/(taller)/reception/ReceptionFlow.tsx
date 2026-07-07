'use client'

// Flujo de recepción en una sola pantalla: buscar patente → cargar o crear cliente+vehículo
// → checklist → "Recibir vehículo" → crea cliente/vehículo/evento/OT y redirige a la OT.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { listVehiculos, getVehiculoByPatente } from '@/modules/vehicles/queries'
import { confirmarAnioVehiculo } from '@/modules/vehicles/mutations'
import { listClientes, listVehiculosByCliente } from '@/modules/customers/queries'
import { cargarFichaVehiculo } from '@/modules/reception/queries'
import { recibirVehiculo } from '@/modules/reception/mutations'
import { vincularCotizacionAOT } from '@/modules/estimates/mutations'
import {
  CHECKLIST_RECEPCION,
  COMBUSTIBLES,
  TRANSMISIONES,
  PRIORIDADES,
  PRIORIDAD_DEFAULT,
  type Prioridad,
} from '@/modules/reception/constants'
import { TIPOS_VEHICULO } from '@/modules/vehicles/constants'
import { TIPOS_CLIENTE, TIPO_CLIENTE_LABEL, TIPO_CLIENTE_DEFAULT, type TipoCliente } from '@/modules/customers/constants'
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

/** Conversión de cotización a OT (Fase C): precarga vehículo+motivo y enlaza al recibir. */
export interface RecepcionPrefill {
  presupuestoId: string
  vehiculoId: string
  folio: string | null
  motivo: string
}

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
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-black/[0.06] text-[11px] font-semibold text-neutral-400">
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
  prefill = null,
}: {
  tipoRecepcionId: string
  /** true si hay un proveedor de enriquecimiento activo. Si es false, se va directo a ingreso manual. */
  enrichmentEnabled: boolean
  /** Presente cuando la recepción viene de convertir una cotización autorizada. */
  prefill?: RecepcionPrefill | null
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
  const [cTipo, setCTipo] = useState<TipoCliente>(TIPO_CLIENTE_DEFAULT)
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

  // Confirmación del año estimado del VIN (vehículo existente con anio_por_confirmar)
  const [anioConf, setAnioConf] = useState('')

  // Recepción
  const [km, setKm] = useState('')
  const [motivo, setMotivo] = useState(prefill?.motivo ?? '')
  const [prioridad, setPrioridad] = useState<Prioridad>(PRIORIDAD_DEFAULT)
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

  // Conversión de cotización: cargar el vehículo (con su cliente) al montar.
  useEffect(() => {
    if (prefill?.vehiculoId) void selectVehiculo(prefill.vehiculoId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      setAnioConf(f.vehiculo.anio != null ? String(f.vehiculo.anio) : '')
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
  // Regla del taller: NINGUNA OT se abre sin kilometraje.
  const kmValido = km.trim() !== '' && Number.isFinite(Number.parseInt(km, 10)) && Number.parseInt(km, 10) >= 0
  const canSubmit =
    ready &&
    motivo.trim().length > 0 &&
    kmValido &&
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
              tipo: cTipo,
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
        ...(observaciones.trim() && { observaciones: observaciones.trim() }),
        ...(kmNum != null ? { km: kmNum } : {}),
        checklist,
      }

      const supabase = createClient()
      const result = await recibirVehiculo(supabase, input)

      // Conversión de cotización (Fase C): enlazar la cotización autorizada a la
      // OT recién creada. Si falla, no bloquea la recepción — la OT ya existe y
      // el enlace puede repetirse volviendo a entrar con ?presupuesto_id.
      if (prefill?.presupuestoId) {
        try {
          await vincularCotizacionAOT(supabase, prefill.presupuestoId, result.ordenTrabajoId)
        } catch {
          /* no bloquear la recepción */
        }
      }

      // Si el vehículo tenía año por confirmar y el recepcionista lo validó,
      // guardarlo y bajar la bandera (no bloquea la recepción si falla).
      if (mode === 'existing' && ficha?.vehiculo.anio_por_confirmar) {
        const anioNum = anioConf.trim() ? Number.parseInt(anioConf, 10) : null
        if (anioNum != null && Number.isFinite(anioNum)) {
          try {
            await confirmarAnioVehiculo(supabase, ficha.vehiculo.id, anioNum)
          } catch {
            /* no bloquear la recepción por esto */
          }
        }
      }

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

      {prefill && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-accent-500/30 bg-accent-500/10 px-4 py-3 text-sm text-accent-400">
          <span className="text-base">📋</span>
          <p>
            Convirtiendo la cotización <span className="font-semibold">{prefill.folio ?? ''}</span> en
            orden de trabajo: al recibir el vehículo, la cotización quedará enlazada a la OT con su
            trabajo autorizado.
          </p>
        </div>
      )}

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
            <div className="mb-4 inline-flex rounded-lg border border-black/[0.08] bg-black/[0.02] p-1">
              <button
                type="button"
                onClick={() => setSearchMode('patente')}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  searchMode === 'patente'
                    ? 'bg-black/[0.08] text-neutral-100'
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
                    ? 'bg-black/[0.08] text-neutral-100'
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
                <ul className="mt-3 divide-y divide-black/[0.05] overflow-hidden rounded-lg border border-black/[0.06]">
                  {suggestions.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => selectVehiculo(v.id)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-black/[0.04]"
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
                <div className="mt-3 flex items-center justify-between rounded-lg border border-black/[0.06] bg-black/[0.02] px-4 py-3">
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
                  <ul className="divide-y divide-black/[0.05] overflow-hidden rounded-lg border border-black/[0.06]">
                    {vehiculosCliente.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => selectVehiculo(v.id)}
                          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-black/[0.04]"
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
                    <ul className="mt-3 divide-y divide-black/[0.05] overflow-hidden rounded-lg border border-black/[0.06]">
                      {clienteSuggestions.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => selectCliente(c)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-black/[0.04]"
                          >
                            <span className="font-semibold text-neutral-100">{c.nombre}</span>
                            <span className="text-sm text-neutral-400">{c.rut || c.telefono || '—'}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {clienteQuery.trim().length >= 2 && !searchingClientes && clienteSuggestions.length === 0 && (
                    <div className="mt-3 rounded-lg border border-black/[0.06] bg-black/[0.02] px-4 py-3">
                      <span className="text-sm text-neutral-400">No hay clientes con ese nombre.</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {ready && (
            <div className="flex items-center gap-3">
              <span className="rounded-lg border border-black/10 bg-neutral-950/60 px-4 py-2 text-lg font-semibold tracking-[0.18em] text-neutral-50">
                {patente.toUpperCase()}
              </span>
              <span className="text-sm text-neutral-500">
                {mode === 'existing' ? 'Vehículo encontrado' : 'Vehículo nuevo'}
                {mode === 'new' && clientePreseleccionado ? ` · ${clientePreseleccionado.nombre}` : ''}
              </span>
            </div>
          )}
        </Section>

        {/* Aviso: el vehículo ya tiene una OT abierta → la recepción se sumará a ella */}
        {(() => {
          const otActiva = ficha?.ordenes.find((o) => o.estado !== 'cerrada' && o.estado !== 'cancelada')
          if (!otActiva) return null
          return (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <p className="text-sm text-amber-800">
                ⚠ Este vehículo <strong>ya tiene una OT abierta</strong> ({otActiva.numero_ot}). Si continúas, la
                recepción se suma a esa misma OT (no se crea una nueva).
              </p>
              <Link
                href={`/repair-orders/${otActiva.id}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/20 px-3.5 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-500/30"
              >
                Ver la OT abierta →
              </Link>
            </div>
          )
        })()}

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
                  {ficha.vehiculo.anio_por_confirmar ? (
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-700">
                        Año
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[9px] font-medium normal-case tracking-normal text-amber-800">
                          por confirmar
                        </span>
                      </label>
                      <input
                        type="number"
                        className={`${inputClass} mt-0.5 border-amber-500/40`}
                        value={anioConf}
                        onChange={(e) => setAnioConf(e.target.value)}
                        placeholder="Año"
                      />
                      <p className="mt-1 text-[10px] text-neutral-500">Estimado del VIN. Corrige si no calza.</p>
                    </div>
                  ) : (
                    <Info label="Año" value={ficha.vehiculo.anio?.toString() ?? null} />
                  )}
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
                            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
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
                        <div className="rounded-lg border border-black/10 bg-black/[0.03] px-3.5 py-2.5 text-sm text-neutral-300">
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
                <div className="mt-5 grid grid-cols-1 gap-4 border-t border-black/[0.06] pt-4 sm:grid-cols-2">
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
                <Field label="Kilómetros *">
                  <input type="number" min="0" className={inputClass} value={km} onChange={(e) => setKm(e.target.value)} />
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
                  <Field label="Síntomas y observaciones">
                    <textarea rows={3} className={inputClass} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Lo que reporta el cliente y notas del ingreso (ruidos, luces, fugas, estado…)" />
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
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900'
                            : 'border-black/[0.07] bg-black/[0.02] text-neutral-400 hover:border-black/15'
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            on ? 'border-emerald-400 bg-emerald-500 text-neutral-950' : 'border-black/20'
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
              <div className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-900">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {/* Barra de acción fija */}
      {ready && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/[0.08] bg-neutral-950/80 backdrop-blur md:pl-64">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 md:px-8">
            <p className="text-sm text-neutral-500">
              {mode === 'existing' ? 'Vehículo existente' : 'Vehículo nuevo'} ·{' '}
              {!motivo.trim()
                ? 'Indica el motivo del ingreso'
                : !kmValido
                  ? 'Falta el kilometraje (obligatorio)'
                  : 'Listo para recibir'}
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
