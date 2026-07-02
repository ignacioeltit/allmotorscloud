'use client'

// Detalle de una cotización: cliente + vehículo, ítems (mano de obra / repuesto),
// agregar ítems y marcar como enviada. La conversión a OT (Fase C) se engancha
// con el botón "Convertir a OT" cuando esté disponible.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { enviarPresupuesto, generarEnlacePublico } from '@/modules/estimates/mutations'
import { ESTADO_PRESUPUESTO_LABEL, TIPO_ITEM_LABEL } from '@/modules/estimates/constants'
import type { CotizacionDetalle } from '@/modules/estimates/queries'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, btnSecondary, btnGhost } from '@/components/ui/styles'
import { FichaIngresoLineas } from './FichaIngresoLineas'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

/** Número a formato internacional para wa.me (Chile +56 si es móvil de 9 dígitos). */
function telefonoWhatsapp(telefono: string | null): string | null {
  if (!telefono) return null
  let d = telefono.replace(/\D/g, '')
  if (d.startsWith('56')) return d
  if (d.length === 9 && d.startsWith('9')) return `56${d}`
  if (d.length === 8) return `569${d}`
  return d || null
}

/** Enlace de WhatsApp con un mensaje corto + el link (donde el cliente ve el detalle, el PDF y autoriza). */
function enlaceWhatsapp(p: CotizacionDetalle, tallerNombre: string, enlaceCliente: string | null): string {
  const tel = telefonoWhatsapp(p.cliente?.telefono ?? null)
  const veh = [p.vehiculo?.marca, p.vehiculo?.modelo, p.vehiculo?.patente ? `(${p.vehiculo.patente})` : null]
    .filter(Boolean)
    .join(' ')
  const iva = Math.round(p.total_neto * 0.19)
  const lineas = [
    `Hola${p.cliente?.nombre ? ' ' + p.cliente.nombre.split(' ')[0] : ''}, te enviamos la cotización de ${tallerNombre}${veh ? ` para tu ${veh}` : ''}.`,
    `Total: ${fmtCLP(p.total_neto + iva)} (con IVA).`,
    '',
    ...(enlaceCliente
      ? ['Aquí puedes ver el detalle, descargar el PDF y autorizarla:', enlaceCliente]
      : []),
  ]
  const texto = encodeURIComponent(lineas.join('\n'))
  return tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`
}

export function CotizacionDetailClient({
  cotizacion,
  tallerNombre,
}: {
  cotizacion: CotizacionDetalle
  tallerNombre: string
}) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(cotizacion.token_publico)
  const [generando, setGenerando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const p = cotizacion
  const esBorrador = p.estado === 'borrador'
  const conItems = p.items.length > 0
  const respondida = p.estado === 'autorizado' || p.estado === 'rechazado'
  // Motivo de la cita = referencia corta de la cotización + un detalle breve del
  // servicio (la mano de obra describe mejor el trabajo que los repuestos). Evita
  // volcar los números de parte de cada repuesto.
  const refCotizacion = `Cot. ${p.id.slice(0, 8).toUpperCase()}`
  const laborItems = p.items.filter((i) => i.tipo === 'mano_obra').map((i) => i.descripcion)
  const detalleBreve = (laborItems.length ? laborItems : p.items.map((i) => i.descripcion))
    .slice(0, 2)
    .join(', ')
  const motivoDesdeItems = `${refCotizacion}${detalleBreve ? ` · ${detalleBreve}` : ''}`.slice(0, 120)

  // origin se resuelve tras el montaje para no romper la hidratación (el server
  // no tiene window). Render inicial server/cliente coincide con origin = ''.
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  const enlaceCliente = token ? `${origin}/cotizacion/${token}` : null
  const waUrl = enlaceWhatsapp(p, tallerNombre, enlaceCliente)

  async function generarEnlace() {
    setGenerando(true)
    setError(null)
    try {
      const t = await generarEnlacePublico(createClient(), p.id)
      setToken(t)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setGenerando(false)
    }
  }

  // Auto-genera el link la primera vez que se abre una cotización con ítems, para
  // que esté siempre disponible sin un paso manual.
  useEffect(() => {
    if (!token && conItems && !generando) void generarEnlace()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function copiarEnlace() {
    if (!enlaceCliente) return
    try {
      await navigator.clipboard.writeText(enlaceCliente)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* ignore */
    }
  }

  async function enviar() {
    setEnviando(true)
    setError(null)
    try {
      await enviarPresupuesto(createClient(), p.id)
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Compartir con el cliente: link + WhatsApp + PDF */}
      {conItems && (
        <section className={card}>
          <p className={sectionLabel}>Compartir con el cliente</p>
          <p className="mt-1 text-xs text-neutral-500">
            El cliente abre el enlace, ve el detalle, descarga el PDF y autoriza o rechaza — sin cuenta.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-neutral-400">
              {enlaceCliente ?? (generando ? 'Generando enlace…' : '—')}
            </code>
            <button onClick={() => void copiarEnlace()} disabled={!enlaceCliente} className={`${btnSecondary} text-xs disabled:opacity-40`}>
              {copiado ? 'Copiado ✓' : 'Copiar link'}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-500/20"
            >
              Enviar por WhatsApp
            </a>
            <Link href={`/estimates/${p.id}/imprimir`} className={btnSecondary}>
              Ver / descargar PDF
            </Link>
          </div>
        </section>
      )}

      {/* Respuesta del cliente */}
      {respondida && (
        <section
          className={`rounded-xl border p-4 text-sm ${
            p.estado === 'autorizado'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800'
              : 'border-red-500/30 bg-red-500/10 text-red-800'
          }`}
        >
          <p className="font-semibold">
            {p.estado === 'autorizado' ? '✓ El cliente autorizó la cotización' : 'El cliente rechazó la cotización'}
          </p>
          {p.agendar_solicitado && (
            <p className="mt-1 font-medium">El cliente quiere agendar — contáctalo para coordinar la hora.</p>
          )}
          {p.nota_cliente && <p className="mt-1 text-neutral-600">Nota del cliente: “{p.nota_cliente}”</p>}
          {p.estado === 'autorizado' && p.vehiculo?.id && (
            <Link
              href={{
                pathname: '/agenda/nueva',
                query: {
                  vehiculo_id: p.vehiculo.id,
                  ...(p.cliente?.id ? { cliente_id: p.cliente.id } : {}),
                  vehiculo: [p.vehiculo.patente, p.vehiculo.marca, p.vehiculo.modelo].filter(Boolean).join(' · '),
                  ...(p.cliente?.nombre ? { cliente: p.cliente.nombre } : {}),
                  ...(motivoDesdeItems ? { motivo: motivoDesdeItems } : {}),
                  ...(p.nota_cliente ? { notas: p.nota_cliente } : {}),
                },
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-500"
            >
              📅 Agendar cita
            </Link>
          )}
        </section>
      )}

      {/* Cliente + vehículo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className={card}>
          <p className={sectionLabel}>Cliente</p>
          <p className="mt-2 font-medium text-neutral-100">{p.cliente?.nombre ?? '—'}</p>
          <p className="text-sm text-neutral-500">
            {[p.cliente?.rut, p.cliente?.telefono].filter(Boolean).join(' · ') || '—'}
          </p>
        </section>
        <section className={card}>
          <p className={sectionLabel}>Vehículo</p>
          <p className="mt-2 font-medium tracking-wide text-neutral-100">{p.vehiculo?.patente ?? '—'}</p>
          <p className="text-sm text-neutral-500">
            {[p.vehiculo?.marca, p.vehiculo?.modelo, p.vehiculo?.anio].filter(Boolean).join(' · ') || '—'}
          </p>
        </section>
      </div>

      {/* Ítems + totales */}
      <section className={`${card} space-y-4`}>
        <div className="flex items-center justify-between gap-3">
          <p className={sectionLabel}>Ítems de la cotización</p>
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-800">
            {ESTADO_PRESUPUESTO_LABEL[p.estado]}
          </span>
        </div>

        {p.items.length > 0 ? (
          <div className="space-y-1.5">
            {p.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-black/[0.05] bg-black/[0.02] px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="mr-2 rounded-full border border-black/[0.08] bg-black/[0.04] px-2 py-0.5 text-[10px] text-neutral-500">
                    {TIPO_ITEM_LABEL[item.tipo]}
                  </span>
                  <span className="text-neutral-300">{item.descripcion}</span>
                  {item.cantidad !== 1 && <span className="ml-2 text-xs text-neutral-500">× {item.cantidad}</span>}
                </div>
                <span className="shrink-0 font-medium text-neutral-200">{fmtCLP(item.precio_total)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-black/[0.06] pt-3 text-sm">
              <span className="text-neutral-500">Mano de obra</span>
              <span className="text-neutral-300">{fmtCLP(p.total_mano_obra)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Repuestos</span>
              <span className="text-neutral-300">{fmtCLP(p.total_repuestos)}</span>
            </div>
            {p.total_otros > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Otros</span>
                <span className="text-neutral-300">{fmtCLP(p.total_otros)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-neutral-400">Total neto</span>
              <span className="text-neutral-100">{fmtCLP(p.total_neto)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Aún no hay ítems. Agrega mano de obra y repuestos.</p>
        )}

        {p.notas && <p className="text-xs text-neutral-500">{p.notas}</p>}
        {error && <p className="text-xs text-red-800">{error}</p>}

        {esBorrador &&
          (showAdd ? (
            <div className="rounded-lg border border-black/[0.08] bg-black/[0.02] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Cargar líneas</p>
                <button onClick={() => setShowAdd(false)} className={`${btnGhost} text-xs`}>Cerrar</button>
              </div>
              <FichaIngresoLineas presupuestoId={p.id} onGuardado={() => { setShowAdd(false); router.refresh() }} />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowAdd(true)} className={`${btnGhost} text-xs`}>+ Cargar líneas</button>
              {p.items.length > 0 && (
                <button onClick={() => void enviar()} disabled={enviando} className={`${btnSecondary} text-xs`}>
                  {enviando ? 'Enviando…' : 'Marcar como enviada'}
                </button>
              )}
            </div>
          ))}
      </section>
    </div>
  )
}
