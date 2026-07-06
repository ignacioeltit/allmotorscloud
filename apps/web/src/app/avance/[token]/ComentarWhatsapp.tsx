'use client'

// Caja de comentario del cliente en la página pública de avance. El cliente
// escribe una consulta y al enviar se abre SU WhatsApp con el mensaje dirigido
// al número del taller (no se guarda nada en el servidor; es un deep link).

import { useState } from 'react'

function telWhatsapp(tel: string | null): string | null {
  if (!tel) return null
  const d = tel.replace(/[^\d]/g, '')
  if (!d) return null
  if (d.startsWith('56')) return d
  if (d.length === 9) return `56${d}` // móvil chileno sin prefijo país
  return d
}

export function ComentarWhatsapp({
  telefono,
  numeroOt,
  vehiculoLabel,
}: {
  telefono: string | null
  numeroOt: string
  vehiculoLabel: string | null
}) {
  const [texto, setTexto] = useState('')
  const tel = telWhatsapp(telefono)
  if (!tel) return null

  const abrir = () => {
    const encabezado = `Hola, tengo una consulta sobre mi ${vehiculoLabel || 'vehículo'} (${numeroOt}):`
    const cuerpo = texto.trim() ? `${encabezado}\n\n${texto.trim()}` : encabezado
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(cuerpo)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="mt-8 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
      <p className="text-sm font-semibold text-[#111827]">¿Tienes una consulta o comentario?</p>
      <p className="mt-0.5 text-xs text-[#6b7280]">Escríbenos y te contactaremos por WhatsApp.</p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        placeholder="Escribe aquí tu comentario…"
        className="mt-3 w-full resize-none rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#16a34a] focus:outline-none"
      />
      <button
        onClick={abrir}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d]"
      >
        Enviar por WhatsApp
      </button>
    </div>
  )
}
