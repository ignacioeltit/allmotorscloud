'use client'

// Editor inline del kilometraje de ingreso, para OTs que quedaron sin km
// (creadas antes de que fuera obligatorio, o importadas). Sin km la OT no se
// puede entregar ni cerrar, así que este es el camino para sanearla.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { actualizarKmIngreso } from '@/modules/repair-orders/mutations'
import { toErrorMessage } from '@/lib/ui/error-message'

export function KmIngresoInline({ ordenId }: { ordenId: string }) {
  const router = useRouter()
  const [km, setKm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    const n = Number.parseInt(km, 10)
    if (!Number.isFinite(n) || n < 0) {
      setError('Km inválido')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await actualizarKmIngreso(createClient(), ordenId, n)
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-medium text-amber-700">Km ingreso (obligatorio):</span>
      <input
        type="number"
        min="0"
        value={km}
        onChange={(e) => setKm(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void guardar() }}
        placeholder="km"
        disabled={saving}
        className="w-24 rounded border border-amber-500/40 bg-white px-2 py-0.5 text-xs text-neutral-800 outline-none focus:border-amber-500 disabled:opacity-50"
        aria-label="Kilometraje de ingreso"
      />
      <button
        onClick={() => void guardar()}
        disabled={saving || !km.trim()}
        className="rounded border border-black/10 bg-black/[0.04] px-2 py-0.5 text-xs font-medium text-neutral-600 hover:bg-black/[0.08] disabled:opacity-50"
      >
        {saving ? '…' : 'Guardar'}
      </button>
      {error && <span className="text-red-700">{error}</span>}
    </span>
  )
}
