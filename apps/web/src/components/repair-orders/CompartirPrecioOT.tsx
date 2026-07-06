'use client'

// Compartir con el cliente el precio actual de los trabajos de la OT (sin
// necesidad de un presupuesto formal): mensaje de WhatsApp con el desglose y el
// total con IVA, más el enlace al documento imprimible de la OT.

import Link from 'next/link'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function telWhatsapp(tel: string | null): string | null {
  if (!tel) return null
  const d = tel.replace(/[^\d]/g, '')
  if (!d) return null
  if (d.startsWith('56')) return d
  if (d.length === 9) return `56${d}` // móvil chileno sin prefijo país
  return d
}

export function CompartirPrecioOT({
  ordenTrabajoId,
  numeroOt,
  tallerNombre,
  vehiculoLabel,
  clienteNombre,
  clienteTelefono,
  totalMO,
  totalRep,
  totalOtros,
  totalConIva,
}: {
  ordenTrabajoId: string
  numeroOt: string
  tallerNombre: string
  vehiculoLabel: string | null
  clienteNombre: string | null
  clienteTelefono: string | null
  totalMO: number
  totalRep: number
  totalOtros: number
  totalConIva: number
}) {
  const lineas = [
    `Hola${clienteNombre ? ' ' + clienteNombre.split(' ')[0] : ''}, desde ${tallerNombre} te paso el detalle de los trabajos${vehiculoLabel ? ` para tu ${vehiculoLabel}` : ''} (${numeroOt}):`,
    '',
    totalMO > 0 ? `Mano de obra: ${fmtCLP(totalMO)}` : null,
    totalRep > 0 ? `Repuestos / materiales: ${fmtCLP(totalRep)}` : null,
    totalOtros > 0 ? `Otros: ${fmtCLP(totalOtros)}` : null,
    '',
    `Total con IVA: ${fmtCLP(totalConIva)}`,
    '',
    'Cualquier consulta nos avisas.',
  ].filter((l) => l !== null)
  const texto = encodeURIComponent(lineas.join('\n'))
  const tel = telWhatsapp(clienteTelefono)
  const waUrl = tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-3">
      <span className="text-xs text-neutral-500">Compartir el precio con el cliente:</span>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-500/20"
      >
        Enviar precio por WhatsApp
      </a>
      <Link
        href={`/repair-orders/${ordenTrabajoId}/imprimir`}
        className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-3.5 py-2 text-sm font-medium text-neutral-300 hover:bg-black/[0.06]"
      >
        🖨 Imprimir / PDF de la OT
      </Link>
    </div>
  )
}
