'use client'

// Comparte con el cliente el LINK público de avance de la OT (misma página donde
// ve las fotos): ahí ve el detalle de los trabajos con precio, las fotos y puede
// dejar un comentario que llega al taller por WhatsApp. Reemplaza el antiguo
// mensaje de texto con el desglose de precios.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { generarTokenAvance } from '@/modules/evidencias'

function telWhatsapp(tel: string | null): string | null {
  if (!tel) return null
  const d = tel.replace(/[^\d]/g, '')
  if (!d) return null
  if (d.startsWith('56')) return d
  if (d.length === 9) return `56${d}` // móvil chileno sin prefijo país
  return d
}

export function CompartirAvanceOT({
  ordenTrabajoId,
  numeroOt,
  tallerNombre,
  vehiculoLabel,
  clienteNombre,
  clienteTelefono,
  tokenInicial,
}: {
  ordenTrabajoId: string
  numeroOt: string
  tallerNombre: string
  vehiculoLabel: string | null
  clienteNombre: string | null
  clienteTelefono: string | null
  tokenInicial: string | null
}) {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(tokenInicial)
  const [copiado, setCopiado] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const link = token && typeof window !== 'undefined' ? `${window.location.origin}/avance/${token}` : null

  async function generar() {
    setGenerando(true)
    setError(null)
    try {
      const t = await generarTokenAvance(createClient(), ordenTrabajoId)
      setToken(t)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el link')
    } finally {
      setGenerando(false)
    }
  }

  function copiar() {
    if (!link) return
    navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  const mensaje = link
    ? `Hola${clienteNombre ? ' ' + clienteNombre.split(' ')[0] : ''}, desde ${tallerNombre} te comparto el avance${vehiculoLabel ? ` de tu ${vehiculoLabel}` : ''} (${numeroOt}). Ahí puedes ver las fotos, el detalle con el precio y dejarnos un comentario:\n${link}`
    : ''
  const tel = telWhatsapp(clienteTelefono)
  const waUrl = link
    ? tel
      ? `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(mensaje)}`
    : null

  return (
    <div className="mt-4 border-t border-black/[0.06] pt-3">
      <span className="text-xs text-neutral-500">Compartir la OT con el cliente (fotos + precio + comentario):</span>
      {link ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="min-w-[12rem] flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-neutral-700"
          />
          <button
            type="button"
            onClick={copiar}
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-1.5 text-sm font-medium text-neutral-300 hover:bg-black/[0.06]"
          >
            {copiado ? '✓ Copiado' : 'Copiar'}
          </button>
          <a
            href={waUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-500/20"
          >
            Enviar por WhatsApp
          </a>
          <Link
            href={`/repair-orders/${ordenTrabajoId}/imprimir`}
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-3.5 py-1.5 text-sm font-medium text-neutral-300 hover:bg-black/[0.06]"
          >
            🖨 Imprimir / PDF
          </Link>
        </div>
      ) : (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => void generar()}
            disabled={generando}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500 disabled:opacity-50"
          >
            {generando ? 'Generando…' : '🔗 Generar link para el cliente'}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
