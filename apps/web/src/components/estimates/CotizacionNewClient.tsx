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
import { searchRepuestos } from '@/modules/inventory/queries'
import type { RepuestoResumen } from '@/modules/inventory/types'
import { addItemsPresupuesto } from '@/modules/estimates/mutations'
import { getAceiteSugerido, getFiltrosSugeridos, type AceiteSugerido } from '@/modules/estimates/queries'
import { parseMensaje } from '@/modules/estimates/parse-mensaje'
import { ordenarItemsPorTipo } from '@/lib/ui/ordenar-items'
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

type LineaItem = {
  tipo: 'mano_obra' | 'repuesto' | 'otros'
  codigo?: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  repuestoId?: string
}

const TIPO_LINEA_LABEL: Record<LineaItem['tipo'], string> = {
  mano_obra: 'Mano de obra',
  repuesto: 'Repuesto',
  otros: 'Otros',
}

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
  // Paso de revisión: líneas propuestas, editables antes de crear.
  const [revisando, setRevisando] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [lineasPropuestas, setLineasPropuestas] = useState<LineaItem[]>([])
  const [textoFalta, setTextoFalta] = useState('')
  const [agregandoTexto, setAgregandoTexto] = useState(false)
  // Autocompletado de repuestos por fila en la tabla de revisión.
  const [filaActiva, setFilaActiva] = useState<number | null>(null)
  const [repResultados, setRepResultados] = useState<RepuestoResumen[]>([])

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
    setRevisando(false)
    setLineasPropuestas([])
    setTextoFalta('')
  }

  const necesitaCliente = modo === 'nuevo' || (modo === 'existente' && !cliente)
  // Para no perder clientes, la cotización se puede crear con los mínimos datos:
  // sin nombre y sin vehículo. Si la patente/marca/modelo están, se registra el
  // vehículo; si no, el presupuesto queda suelto (se asocia después) y lo que se
  // sepa del vehículo/contacto se guarda en las notas.
  const tieneVehiculoNuevo = modo === 'nuevo' && !!(patente.trim() && vMarca.trim() && vModelo.trim())
  const registraVehiculo = modo === 'existente' || tieneVehiculoNuevo
  const puedeCrear = true

  // Paso 1: arma las líneas propuestas (paquetes + aceite + filtros + servicios +
  // síntomas), las deduplica y abre el paso de revisión para editar/eliminar.
  async function prepararLineas() {
    setPreparando(true)
    setError(null)
    try {
      const supabase = createClient()
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

      // Dedup final por tipo + descripción (evita filtros/ítems repetidos).
      const dedup: LineaItem[] = []
      const claves = new Set<string>()
      for (const it of items) {
        const k = `${it.tipo}|${it.descripcion.trim().toLowerCase()}`
        if (claves.has(k)) continue
        claves.add(k)
        dedup.push(it)
      }

      // Orden: repuestos arriba, mano de obra abajo (igual que el documento), con
      // dos líneas libres entre medio para agregar algo más.
      const ordenadas = ordenarItemsPorTipo(dedup)
      const libres: LineaItem[] = [
        { tipo: 'repuesto', descripcion: '', cantidad: 1, precioUnitario: 0 },
        { tipo: 'repuesto', descripcion: '', cantidad: 1, precioUnitario: 0 },
      ]
      const corte = ordenadas.findIndex((l) => l.tipo !== 'repuesto')
      const conLibres =
        corte === -1 ? [...ordenadas, ...libres] : [...ordenadas.slice(0, corte), ...libres, ...ordenadas.slice(corte)]

      setLineasPropuestas(conLibres)
      setRevisando(true)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setPreparando(false)
    }
  }

  // Edición de las líneas en el paso de revisión.
  function editarLinea(i: number, campos: Partial<LineaItem>) {
    setLineasPropuestas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...campos } : l)))
  }
  function eliminarLinea(i: number) {
    setLineasPropuestas((prev) => prev.filter((_, idx) => idx !== i))
  }

  // Busca repuestos para el autocompletado de la fila mientras se escribe.
  async function buscarRepParaFila(i: number, q: string) {
    if (q.trim().length < 2) {
      setFilaActiva(null)
      setRepResultados([])
      return
    }
    try {
      const reps = await searchRepuestos(createClient(), q)
      setFilaActiva(i)
      setRepResultados(reps)
    } catch {
      setRepResultados([])
    }
  }

  // Aplica un repuesto elegido del autocompletado a la fila.
  function elegirRepuesto(i: number, r: RepuestoResumen) {
    editarLinea(i, {
      tipo: 'repuesto',
      descripcion: r.nombre,
      precioUnitario: r.precio_venta ?? 0,
      repuestoId: r.id,
      ...(r.codigo ? { codigo: r.codigo } : {}),
    })
    setFilaActiva(null)
    setRepResultados([])
  }
  function agregarLinea() {
    setLineasPropuestas((prev) => [...prev, { tipo: 'mano_obra', descripcion: '', cantidad: 1, precioUnitario: 0 }])
  }

  // Agrega líneas desde texto libre (ej. "falta el aceite y el filtro de polen"):
  // por cada ítem busca primero en repuestos (inventario), luego en el catálogo
  // de servicios; si no hay match, lo deja como línea libre para completar.
  async function agregarDesdeTexto() {
    const txt = textoFalta.trim()
    if (!txt) return
    setAgregandoTexto(true)
    setError(null)
    try {
      const supabase = createClient()
      const limpiar = (f: string) =>
        f.toLowerCase()
          .replace(/\b(me|falta|faltan|agrega|agregar|agregame|poner|pon|añade|anade|incluir|incluye|sumar|suma|tambien|también|el|la|los|las|un|una|unos|unas|de|del)\b/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

      const fragmentos = txt.split(/[,;\n]+|\s+y\s+/i).map(limpiar).filter(Boolean)
      const nuevas: LineaItem[] = []
      for (const frag of fragmentos) {
        const reps = await searchRepuestos(supabase, frag)
        if (reps[0]) {
          const r = reps[0]
          nuevas.push({ tipo: 'repuesto', ...(r.codigo ? { codigo: r.codigo } : {}), descripcion: r.nombre, cantidad: 1, precioUnitario: r.precio_venta ?? 0, repuestoId: r.id })
          continue
        }
        const servs = await buscarServiciosCatalogo(supabase, frag)
        if (servs[0]) {
          const m = servs[0]
          nuevas.push({ tipo: 'mano_obra', ...(m.codigo ? { codigo: m.codigo } : {}), descripcion: m.nombre, cantidad: 1, precioUnitario: m.precio_unitario ?? 0 })
          continue
        }
        nuevas.push({ tipo: 'repuesto', descripcion: cap(frag), cantidad: 1, precioUnitario: 0 })
      }

      setLineasPropuestas((prev) => {
        const claves = new Set(prev.map((l) => `${l.tipo}|${l.descripcion.trim().toLowerCase()}`))
        const add = nuevas.filter((n) => !claves.has(`${n.tipo}|${n.descripcion.trim().toLowerCase()}`))
        return [...prev, ...add]
      })
      setTextoFalta('')
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setAgregandoTexto(false)
    }
  }

  const totalRevision = lineasPropuestas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0)

  // Paso 2: crea la cotización con las líneas ya revisadas/editadas.
  async function confirmarCrear() {
    setCreando(true)
    setError(null)
    try {
      const supabase = createClient()
      const anioNum = vAnio.trim() ? Number.parseInt(vAnio, 10) : null
      const creaCliente = necesitaCliente && !!(cNombre.trim() || cTelefono.trim() || cRut.trim())

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

      const items = lineasPropuestas.filter((l) => l.descripcion.trim() && l.cantidad > 0)
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
                {filtrosSug.length > 0 ? (
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
                ) : servicios.includes('Cambio de filtros') ? (
                  <p className="mt-2 text-neutral-500">
                    Sin filtros en el historial de este modelo — agrégalos en el paso de revisión (cuadro “Agregar lo que falta” o buscando el repuesto).
                  </p>
                ) : null}
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
          {!revisando ? (
            <div className="mt-4 flex items-center gap-3">
              <button type="button" onClick={() => void prepararLineas()} disabled={!puedeCrear || preparando} className={btnPrimary}>
                {preparando ? 'Armando líneas…' : 'Revisar líneas →'}
              </button>
              {registraVehiculo ? (
                <p className="text-xs text-neutral-500">Revisa y edita las líneas antes de crear.</p>
              ) : (
                <p className="text-xs text-amber-700">
                  Se creará <span className="font-medium">sin vehículo</span> (lo que sepas queda en las notas; lo asocias después).
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-neutral-100">Revisa las líneas antes de crear</p>
                <button type="button" onClick={agregarLinea} className={btnSecondary}>+ Línea vacía</button>
              </div>

              {/* Agregar lo que falta por texto (busca en repuestos y servicios) */}
              <div className="rounded-lg border border-accent-500/25 bg-accent-500/[0.05] p-2.5">
                <label className="text-xs text-neutral-400">Agregar lo que falta (busca en repuestos e inventario):</label>
                <div className="mt-1 flex gap-2">
                  <input
                    className={`${inputClass} !py-1.5 text-sm`}
                    value={textoFalta}
                    onChange={(e) => setTextoFalta(e.target.value)}
                    placeholder="Ej: falta el aceite y el filtro de polen"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void agregarDesdeTexto() } }}
                  />
                  <button type="button" onClick={() => void agregarDesdeTexto()} disabled={!textoFalta.trim() || agregandoTexto} className={btnSecondary}>
                    {agregandoTexto ? 'Buscando…' : 'Agregar'}
                  </button>
                </div>
              </div>

              {lineasPropuestas.length === 0 ? (
                <p className="text-sm text-neutral-500">No hay líneas. Agrega al menos una, o vuelve y crea una cotización vacía.</p>
              ) : (
                <div className="space-y-2">
                  {/* Encabezados (desktop) */}
                  <div className="hidden gap-2 px-1 text-[11px] uppercase tracking-wide text-neutral-500 sm:grid sm:grid-cols-[7rem_1fr_4rem_7rem_2rem]">
                    <span>Tipo</span><span>Descripción</span><span className="text-right">Cant.</span><span className="text-right">P. unit.</span><span />
                  </div>
                  {lineasPropuestas.map((l, i) => (
                    <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-black/[0.06] p-2 sm:grid-cols-[7rem_1fr_4rem_7rem_2rem] sm:items-center sm:border-0 sm:p-0">
                      <select
                        className={`${inputClass} !py-1.5 text-xs`}
                        value={l.tipo}
                        onChange={(e) => editarLinea(i, { tipo: e.target.value as LineaItem['tipo'] })}
                      >
                        {(['mano_obra', 'repuesto', 'otros'] as const).map((t) => (
                          <option key={t} value={t}>{TIPO_LINEA_LABEL[t]}</option>
                        ))}
                      </select>
                      <div className="relative">
                        <input
                          className={`${inputClass} !py-1.5 text-sm`}
                          value={l.descripcion}
                          placeholder="Descripción (escribe para buscar repuesto)"
                          onChange={(e) => {
                            // Al editar el texto se desvincula el repuesto anterior.
                            editarLinea(i, { descripcion: e.target.value, repuestoId: undefined })
                            void buscarRepParaFila(i, e.target.value)
                          }}
                          onFocus={() => { if (l.descripcion.trim().length >= 2) void buscarRepParaFila(i, l.descripcion) }}
                          onBlur={() => setTimeout(() => setFilaActiva((f) => (f === i ? null : f)), 150)}
                          autoComplete="off"
                        />
                        {filaActiva === i && repResultados.length > 0 && (
                          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-black/10 bg-white shadow-lg">
                            {repResultados.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => elegirRepuesto(i, r)}
                                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-black/[0.04]"
                              >
                                <span className="truncate text-neutral-800">
                                  {r.codigo ? <span className="mr-1.5 font-mono text-[11px] text-neutral-500">{r.codigo}</span> : null}
                                  {r.nombre}
                                </span>
                                <span className="shrink-0 text-xs text-neutral-500">
                                  {r.precio_venta != null ? r.precio_venta.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }) : '—'} · stk {r.stock_actual}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        type="number" step="0.01" min="0"
                        className={`${inputClass} !py-1.5 text-right text-sm`}
                        value={l.cantidad}
                        onChange={(e) => editarLinea(i, { cantidad: Number.parseFloat(e.target.value) || 0 })}
                      />
                      <input
                        type="number" step="1" min="0"
                        className={`${inputClass} !py-1.5 text-right text-sm`}
                        value={l.precioUnitario}
                        onChange={(e) => editarLinea(i, { precioUnitario: Number.parseFloat(e.target.value) || 0 })}
                      />
                      <button type="button" onClick={() => eliminarLinea(i)} className="justify-self-end text-red-600 hover:text-red-500" title="Eliminar">✕</button>
                    </div>
                  ))}
                  <div className="flex justify-end border-t border-black/[0.06] pt-2 text-sm">
                    <span className="text-neutral-500">Neto estimado:&nbsp;</span>
                    <span className="font-semibold text-neutral-100">
                      {totalRevision.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button type="button" onClick={() => void confirmarCrear()} disabled={creando} className={btnPrimary}>
                  {creando ? 'Creando…' : 'Confirmar y crear →'}
                </button>
                <button type="button" onClick={() => setRevisando(false)} disabled={creando} className={btnSecondary}>
                  ← Volver
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
