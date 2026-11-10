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
import { buscarServiciosCatalogo } from '@/modules/catalogo/queries'
import { addItemsPresupuesto } from '@/modules/estimates/mutations'
import { getAceiteSugerido, getFiltrosSugeridos, type AceiteSugerido } from '@/modules/estimates/queries'
import { parseMensaje } from '@/modules/estimates/parse-mensaje'
import { listPaquetesMantencion, expandirPlantilla, type PlantillaResumen } from '@/modules/plantillas/queries'
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

  // ── Desde mensaje (WhatsApp): pegar texto → analizar → pre-llenar ──
  const [mensaje, setMensaje] = useState('')
  const [analizado, setAnalizado] = useState(false)
  const [servicios, setServicios] = useState<string[]>([])
  const [sintomas, setSintomas] = useState<string[]>([])
  // Mantención: paquete sugerido + aceite deducido del historial.
  const [paquetesMant, setPaquetesMant] = useState<PlantillaResumen[]>([])
  const [paquetesElegidos, setPaquetesElegidos] = useState<string[]>([])
  const [aceiteSug, setAceiteSug] = useState<AceiteSugerido | null>(null)
  const [filtrosSug, setFiltrosSug] = useState<AceiteSugerido[]>([])

  /** Busca un vehículo por patente y arma el modo existente/nuevo. */
  async function buscarPatente(q: string): Promise<void> {
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
  }

  async function onBuscar(e: FormEvent) {
    e.preventDefault()
    const q = patente.trim()
    if (!q) return
    setBuscando(true)
    setError(null)
    try {
      await buscarPatente(q)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBuscando(false)
    }
  }

  /** Analiza el mensaje pegado y pre-llena los campos del formulario. */
  async function analizarMensaje() {
    const p = parseMensaje(mensaje)
    setServicios(p.servicios)
    setSintomas(p.sintomas)
    setAnalizado(true)
    if (!notas.trim()) setNotas(p.textoOriginal)
    // Pre-carga datos del cliente/vehículo nuevo por si la patente no existe.
    if (p.nombre) setCNombre(p.nombre)
    if (p.telefono) setCTelefono(p.telefono)
    if (p.marca) setVMarca(p.marca)
    if (p.modelo) setVModelo(p.modelo)
    if (p.anio) setVAnio(p.anio)
    setBuscando(true)
    setError(null)
    try {
      const supabase = createClient()
      // Mantención: si pide aceite o filtros, proponer paquete + aceite del historial.
      const pideMantencion = p.servicios.includes('Cambio de aceite') || p.servicios.includes('Cambio de filtros')
      if (pideMantencion) {
        const [paquetes, aceite, filtros] = await Promise.all([
          listPaquetesMantencion(supabase),
          p.marca ? getAceiteSugerido(supabase, p.marca, p.modelo) : Promise.resolve(null),
          p.marca ? getFiltrosSugeridos(supabase, p.marca, p.modelo) : Promise.resolve([]),
        ])
        setPaquetesMant(paquetes)
        setPaquetesElegidos(paquetes.map((p) => p.id)) // todos marcados por defecto
        setAceiteSug(aceite)
        setFiltrosSug(filtros)
      } else {
        setPaquetesMant([])
        setPaquetesElegidos([])
        setAceiteSug(null)
        setFiltrosSug([])
      }

      if (p.patente) {
        await buscarPatente(p.patente)
      } else {
        // Sin patente clara → entra directo a captura de datos nuevos.
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
    setAnalizado(false)
    setServicios([])
    setSintomas([])
    setPaquetesMant([])
    setPaquetesElegidos([])
    setAceiteSug(null)
    setFiltrosSug([])
  }

  const necesitaCliente = modo === 'nuevo' || (modo === 'existente' && !cliente)
  // Para no perder clientes, la cotización se puede crear con los mínimos datos:
  // sin nombre y sin vehículo. Si la patente/marca/modelo están, se registra el
  // vehículo; si no, el presupuesto queda suelto (se asocia después) y lo que se
  // sepa del vehículo/contacto se guarda en las notas.
  const tieneVehiculoNuevo = modo === 'nuevo' && !!(patente.trim() && vMarca.trim() && vModelo.trim())
  const registraVehiculo = modo === 'existente' || tieneVehiculoNuevo
  const puedeCrear = true

  async function crear() {
    setCreando(true)
    setError(null)
    try {
      const supabase = createClient()
      const anioNum = vAnio.trim() ? Number.parseInt(vAnio, 10) : null

      // Crea cliente solo si hay algún dato de contacto (si no, cotización sin cliente).
      const creaCliente = necesitaCliente && !!(cNombre.trim() || cTelefono.trim() || cRut.trim())

      // Si el vehículo no se registra (falta patente), preservamos en las notas
      // lo que sepamos de él y del contacto, para no perder nada.
      let notasFinal = notas.trim()
      if (modo === 'nuevo' && !tieneVehiculoNuevo) {
        const vehInfo = [patente.trim().toUpperCase(), vMarca.trim(), vModelo.trim(), vAnio.trim()].filter(Boolean).join(' ')
        const extra: string[] = []
        if (vehInfo) extra.push(`Vehículo (sin registrar): ${vehInfo}`)
        if (!creaCliente) {
          const contacto = [cNombre.trim(), cTelefono.trim()].filter(Boolean).join(' · ')
          if (contacto) extra.push(`Contacto: ${contacto}`)
        }
        if (extra.length) notasFinal = [extra.join('\n'), notasFinal].filter(Boolean).join('\n\n')
      }

      const payload = {
        p_cliente_id: modo === 'existente' && cliente ? cliente.id : null,
        p_cliente: creaCliente
          ? {
              nombre: cNombre.trim() || (cTelefono.trim() ? `Cliente ${cTelefono.trim()}` : 'Cliente'),
              tipo: cTipo,
              ...(cRut.trim() && { rut: cRut.trim() }),
              ...(cTelefono.trim() && { telefono: cTelefono.trim() }),
            }
          : null,
        p_vehiculo_id: modo === 'existente' && vehiculo ? vehiculo.id : null,
        // Solo se registra el vehículo si hay patente (+ marca/modelo); si no, va en notas.
        p_vehiculo: tieneVehiculoNuevo
          ? {
              patente: patente.trim().toUpperCase(),
              marca: vMarca.trim(),
              modelo: vModelo.trim(),
              tipo: vTipo,
              ...(anioNum != null && Number.isFinite(anioNum) ? { anio: String(anioNum) } : {}),
              ...(vColor.trim() && { color: vColor.trim() }),
            }
          : null,
        p_notas: notasFinal || null,
      }

      const { data, error: rpcError } = await supabase.rpc('fn_crear_cotizacion', payload)
      if (rpcError) throw new Error(rpcError.message)
      const result = data as { presupuesto_id: string }

      // Si se analizó un mensaje, pre-carga las líneas detectadas:
      //  - si se usa un paquete de mantención: se expande (reemplaza aceite/filtros
      //    sueltos) y su línea de aceite se cambia por el aceite sugerido del historial.
      //  - cada otro servicio se cotiza con el precio del catálogo (si hay match).
      //  - cada síntoma entra como línea de diagnóstico, con precio a confirmar.
      type LineaItem = {
        tipo: 'mano_obra' | 'repuesto' | 'otros'
        codigo?: string
        descripcion: string
        cantidad: number
        precioUnitario: number
        repuestoId?: string
      }
      const items: LineaItem[] = []
      const esAceite = (d: string) => /aceite/i.test(d) && !/filtro/i.test(d)
      const paquetesSel = paquetesMant.filter((p) => paquetesElegidos.includes(p.id))
      const usaPaquete = paquetesSel.length > 0
      // Servicios que los paquetes de mantención ya cubren (no se agregan sueltos).
      const CUBIERTOS = new Set(['Cambio de aceite', 'Cambio de filtros'])

      let paqueteCubreFiltros = false // ¿algún paquete ya incluye filtros?
      if (usaPaquete) {
        let aceitePuesto = false // el aceite sugerido se pone una sola vez
        for (const paquete of paquetesSel) {
          const lineas = await expandirPlantilla(supabase, paquete)
          for (const l of lineas) {
            // Un paquete "cubre" aceite/filtros solo si trae el PRODUCTO (repuesto),
            // no una línea de mano de obra como "RENOVAR FILTRO/ACEITE".
            const esRepuesto = l.grupo === 'repuesto'
            if (esRepuesto && /filtro/i.test(l.descripcion)) paqueteCubreFiltros = true
            if (esRepuesto && esAceite(l.descripcion) && aceiteSug && !aceitePuesto) {
              // El paquete trae aceite como producto → se usa el del historial.
              aceitePuesto = true
              items.push({
                tipo: 'repuesto',
                descripcion: aceiteSug.descripcion,
                cantidad: aceiteSug.cantidad ?? l.cantidad,
                precioUnitario: aceiteSug.precio_unitario ?? l.precio,
                ...(aceiteSug.repuesto_id ? { repuestoId: aceiteSug.repuesto_id } : l.repuestoId ? { repuestoId: l.repuestoId } : {}),
              })
            } else {
              // El resto de líneas del paquete se mantienen tal cual (incluida la
              // mano de obra "RENOVAR ACEITE/FILTRO").
              items.push({
                tipo: l.grupo,
                descripcion: l.descripcion,
                cantidad: l.cantidad,
                precioUnitario: l.precio,
                ...(l.repuestoId ? { repuestoId: l.repuestoId } : {}),
              })
            }
          }
        }
        // Si ningún paquete traía el aceite como producto, se agrega del historial.
        if (!aceitePuesto && aceiteSug) {
          items.push({
            tipo: 'repuesto',
            descripcion: aceiteSug.descripcion,
            cantidad: aceiteSug.cantidad ?? 1,
            precioUnitario: aceiteSug.precio_unitario ?? 0,
            ...(aceiteSug.repuesto_id ? { repuestoId: aceiteSug.repuesto_id } : {}),
          })
        }
      }

      // Filtros deducidos del historial: si se pidieron filtros y ningún paquete
      // seleccionado trae los filtros PRODUCTO, se agregan como líneas de repuesto.
      if (servicios.includes('Cambio de filtros') && !(usaPaquete && paqueteCubreFiltros) && filtrosSug.length > 0) {
        for (const f of filtrosSug) {
          items.push({
            tipo: 'repuesto',
            descripcion: f.descripcion,
            cantidad: f.cantidad ?? 1,
            precioUnitario: f.precio_unitario ?? 0,
            ...(f.repuesto_id ? { repuestoId: f.repuesto_id } : {}),
          })
        }
      }

      // Evita duplicar una misma línea cuando dos servicios detectados matchean
      // el mismo servicio del catálogo (ej. "aceite" y "filtros" → el mismo ítem).
      const vistos = new Set<string>()
      for (const label of servicios) {
        if (usaPaquete && CUBIERTOS.has(label)) continue
        const matches = await buscarServiciosCatalogo(supabase, label)
        const m = matches[0]
        const clave = (m?.id ?? (m?.nombre ?? label)).toLowerCase()
        if (vistos.has(clave)) continue
        vistos.add(clave)
        items.push({
          tipo: 'mano_obra',
          ...(m?.codigo ? { codigo: m.codigo } : {}),
          descripcion: m?.nombre ?? label,
          cantidad: 1,
          precioUnitario: m?.precio_unitario ?? 0,
        })
      }

      // Sin paquete pero con cambio de aceite pedido: agrega el aceite del historial.
      if (!usaPaquete && aceiteSug && servicios.includes('Cambio de aceite')) {
        items.push({
          tipo: 'repuesto',
          descripcion: aceiteSug.descripcion,
          cantidad: 1,
          precioUnitario: aceiteSug.precio_unitario ?? 0,
          ...(aceiteSug.repuesto_id ? { repuestoId: aceiteSug.repuesto_id } : {}),
        })
      }

      for (const s of sintomas) {
        items.push({ tipo: 'mano_obra', descripcion: `Diagnóstico: ${s}`, cantidad: 1, precioUnitario: 0 })
      }
      if (items.length > 0) {
        await addItemsPresupuesto(supabase, { presupuestoId: result.presupuesto_id, items })
      }

      router.push(`/estimates/${result.presupuesto_id}`)
      router.refresh()
    } catch (err) {
      setError(toErrorMessage(err))
      setCreando(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Paso 0 — Desde un mensaje (opcional): pegar WhatsApp y analizar */}
      <section className={card}>
        <div className="mb-3 flex items-center justify-between">
          <p className={sectionLabel}>Desde un mensaje (WhatsApp)</p>
          <span className="text-xs text-neutral-600">Opcional</span>
        </div>
        <textarea
          rows={3}
          className={inputClass}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Pega aquí el mensaje del cliente. Ej: 'Hola soy Ignacio, tengo una RAM PDFC21, quiero cambio de aceite y tiene un ruido en la rueda delantera derecha'"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void analizarMensaje()}
            disabled={!mensaje.trim() || buscando}
            className={btnSecondary}
          >
            {buscando ? 'Analizando…' : '✨ Analizar mensaje'}
          </button>
          <p className="text-xs text-neutral-500">
            Detecta cliente, patente, marca y servicios. Luego revisas y ajustas el borrador.
          </p>
        </div>

        {analizado && (
          <div className="mt-4 space-y-2 border-t border-black/[0.06] pt-3 text-xs">
            {servicios.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-neutral-500">Servicios:</span>
                {servicios.map((s) => (
                  <span key={s} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-800">
                    {s}
                  </span>
                ))}
              </div>
            )}
            {sintomas.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-neutral-500">A diagnosticar:</span>
                {sintomas.map((s) => (
                  <span key={s} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-800">
                    {s}
                  </span>
                ))}
              </div>
            )}
            {servicios.length === 0 && sintomas.length === 0 && (
              <p className="text-neutral-500">No se detectaron servicios ni síntomas. Agrégalos luego a mano.</p>
            )}

            {/* Mantención: paquete sugerido + aceite deducido del historial */}
            {(paquetesMant.length > 0 || aceiteSug) && (
              <div className="rounded-lg border border-sky-500/25 bg-sky-500/[0.06] px-3 py-2.5">
                <p className="mb-1.5 font-semibold text-sky-800">🔧 Mantención</p>
                {paquetesMant.length > 0 && (
                  <>
                    <p className="mb-1 text-neutral-400">Paquetes a aplicar (destilda los que no correspondan):</p>
                    <div className="space-y-1">
                      {paquetesMant.map((p) => {
                        const marcado = paquetesElegidos.includes(p.id)
                        return (
                          <label key={p.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={(e) =>
                                setPaquetesElegidos((prev) =>
                                  e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id),
                                )
                              }
                            />
                            <span className="text-neutral-200">{p.nombre}</span>
                          </label>
                        )
                      })}
                    </div>
                  </>
                )}
                {aceiteSug ? (
                  <p className="mt-2 text-neutral-300">
                    🛢 Aceite sugerido (historial): <span className="font-medium text-neutral-100">{aceiteSug.descripcion}</span>
                    <span className="text-neutral-500"> · usado {aceiteSug.veces} {aceiteSug.veces === 1 ? 'vez' : 'veces'} en vehículos similares</span>
                  </p>
                ) : (
                  <p className="mt-2 text-neutral-500">Sin historial de aceite para este vehículo — defines el aceite al cotizar.</p>
                )}
                {filtrosSug.length > 0 && (
                  <div className="mt-2">
                    <p className="text-neutral-300">🧰 Filtros sugeridos (historial):</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {filtrosSug.map((f) => (
                        <span key={f.descripcion} className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-neutral-200">
                          {f.descripcion}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-neutral-500">
              Se agregarán como líneas al crear la cotización (los precios de servicios salen del catálogo; el diagnóstico queda a confirmar).
            </p>
          </div>
        )}
      </section>

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
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-neutral-600">
                {buscando ? 'Buscando…' : 'Escribe la patente y presiona Enter. Si no existe, la registras.'}
              </p>
              <button type="button" onClick={() => setModo('nuevo')} className="text-xs font-medium text-accent-400 hover:text-accent-300">
                Cotizar sin vehículo →
              </button>
            </div>
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
            <Field label="Patente">
              <input className={inputClass} value={patente} onChange={(e) => setPatente(e.target.value)} />
            </Field>
            <Field label="Marca">
              <input className={inputClass} value={vMarca} onChange={(e) => setVMarca(e.target.value)} />
            </Field>
            <Field label="Modelo">
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
              <Field label="Nombre (opcional)">
                <input className={inputClass} value={cNombre} onChange={(e) => setCNombre(e.target.value)} placeholder="Si aún no lo sabes, lo completas después" />
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
            {registraVehiculo ? (
              <p className="text-xs text-neutral-500">Luego agregas los ítems (mano de obra y repuestos).</p>
            ) : (
              <p className="text-xs text-amber-700">
                Se creará <span className="font-medium">sin vehículo</span> (lo que sepas queda en las notas; lo asocias después).
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
