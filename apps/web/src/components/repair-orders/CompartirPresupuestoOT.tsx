'use client'

// "Compartir con el cliente" para el presupuesto de una OT: mismo enlace público
// + WhatsApp + PDF que ya existe para cotizaciones sueltas (CotizacionDetailClient),
// pero autocontenido — se duplica a propósito en vez de reutilizar aquel
// componente: este vive dentro de PresupuestoSection (OT), tiene menos props
// disponibles (no hay "convertir a OT", ya está en una) y así no se arriesga la
// UI de cotizaciones sueltas, ya verificada en producción.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { generarEnlacePublico } from '@/modules/estimates/mutations'
import type { PresupuestoConItems } from '@/modules/estimates/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, btnSecondary } from '@/components/ui/styles'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function telefonoWhatsapp(telefono: string | null): string | null {
  if (!telefono) return null
  const d = telefono.replace(/\D/g, '')
  if (d.startsWith('56')) return d
  if (d.length === 9 && d.startsWith('9')) return `56${d}`
  if (d.length === 8) return `569${d}`
  return d || null
}

export function CompartirPresupuestoOT({
  presupuesto,
  tallerNombre,
  clienteNombre,
  clienteTelefono,
  vehiculoLabel,
  citaActiva,
}: {
  presupuesto: PresupuestoConItems
  tallerNombre: string
  clienteNombre: string | null
  clienteTelefono: string | null
  vehiculoLabel: string | null
  citaActiva: string | null
}) {
  const p = presupuesto
  const [token, setToken] = useState<string | null>(p.token_publico)
  const [generando, setGenerando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')

  useEffect(() => setOrigin(window.location.origin), [])
  const enlaceCliente = token ? `${origin}/cotizacion/${token}` : null
  const respondida = p.estado === 'autorizado' || p.estado === 'rechazado'

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

  useEffect(() => {
    if (!token && p.items.length > 0 && !generando) void generarEnlace()
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

  const tel = telefonoWhatsapp(clienteTelefono)
  const iva = Math.round(p.total_neto * 0.19)
  const lineas = [
    `Hola${clienteNombre ? ' ' + clienteNombre.split(' ')[0] : ''}, te enviamos la cotización de ${tallerNombre}${vehiculoLabel ? ` para tu ${vehiculoLabel}` : ''}.`,
    `Total: ${fmtCLP(p.total_neto + iva)} (con IVA).`,
    '',
    ...(enlaceCliente ? ['Aquí puedes ver el detalle, descargar el PDF y autorizarla:', enlaceCliente] : []),
  ]
  const waUrl = `https://wa.me/${tel ?? ''}?text=${encodeURIComponent(lineas.join('\n'))}`

  if (p.items.length === 0) return null

  return (
    <div className="space-y-3">
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

        {error && <p className="mt-2 text-xs text-red-800">{error}</p>}

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
          {p.agendar_solicitado && !citaActiva && (
            <p className="mt-1 font-medium">El cliente quiere agendar — contáctalo para coordinar la hora.</p>
          )}
          {p.nota_cliente && <p className="mt-1 text-neutral-600">Nota del cliente: “{p.nota_cliente}”</p>}
          {p.estado === 'autorizado' && citaActiva && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-800">
              ✓ Cita agendada para el{' '}
              {new Date(citaActiva).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })} a las{' '}
              {new Date(citaActiva).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
