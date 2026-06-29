'use client'

// Acciones de la OT: cambiar estado, cerrar OT y volver a la ficha del vehículo.
// Mutaciones desde el browser client (RLS). El trigger fn_set_cerrado_en gestiona cerrado_en.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cambiarEstadoOrdenTrabajo } from '@/modules/repair-orders/mutations'
import { ESTADOS_OT, type EstadoOT } from '@/modules/repair-orders/constants'
import { Button } from '@/components/ui/Button'
import { inputClass, btnGhost, otEstadoLabel } from '@/components/ui/styles'
import { toErrorMessage } from '@/lib/ui/error-message'

export function OrdenTrabajoActions({
  id,
  estado,
  vehiculoId,
}: {
  id: string
  estado: string
  vehiculoId: string
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const terminal = estado === 'cerrada' || estado === 'cancelada'

  async function aplicar(nuevoEstado: EstadoOT) {
    if (nuevoEstado === estado) return
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      await cambiarEstadoOrdenTrabajo(supabase, id, { estado: nuevoEstado })
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          aria-label="Cambiar estado"
          disabled={saving || terminal}
          value={estado}
          onChange={(e) => aplicar(e.target.value as EstadoOT)}
          className={`${inputClass} max-w-[16rem] disabled:opacity-50`}
        >
          {ESTADOS_OT.map((s) => (
            <option key={s} value={s}>
              {otEstadoLabel(s)}
            </option>
          ))}
        </select>

        <Button variant="secondary" onClick={() => aplicar('cerrada')} disabled={saving || terminal}>
          Cerrar OT
        </Button>

        <Link href={`/vehicles/${vehiculoId}`} className={btnGhost}>
          Ver ficha vehículo
        </Link>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  )
}
