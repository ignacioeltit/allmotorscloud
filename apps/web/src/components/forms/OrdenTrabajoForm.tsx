'use client'

// Formulario de apertura de Orden de Trabajo para un vehículo.
// Regla de dominio (trigger): no puede existir una segunda OT activa para el mismo vehículo.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createOrdenTrabajo } from '@/modules/repair-orders/mutations'
import type { OrdenTrabajoCreateInput } from '@/modules/repair-orders/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { inputClass, labelClass, btnPrimary, btnSecondary, card } from '@/components/ui/styles'

export function OrdenTrabajoForm({ vehiculoId }: { vehiculoId: string }) {
  const router = useRouter()
  const [numeroOt, setNumeroOt] = useState('')
  const [kmIngreso, setKmIngreso] = useState('')
  const [fechaPrometida, setFechaPrometida] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const input: OrdenTrabajoCreateInput = {
        vehiculo_id: vehiculoId,
        numero_ot: numeroOt.trim(),
        ...(kmIngreso.trim() && { km_ingreso: Number.parseInt(kmIngreso, 10) }),
        ...(fechaPrometida.trim() && { fecha_prometida_entrega: fechaPrometida }),
        ...(notas.trim() && { notas: notas.trim() }),
      }
      const supabase = createClient()
      await createOrdenTrabajo(supabase, input)
      router.push(`/vehicles/${vehiculoId}`)
      router.refresh()
    } catch (err) {
      setError(toErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className={`${card} space-y-4`}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="numeroOt">
            Número de OT *
          </label>
          <input
            id="numeroOt"
            className={inputClass}
            value={numeroOt}
            onChange={(e) => setNumeroOt(e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="kmIngreso">
            Kilometraje de ingreso
          </label>
          <input
            id="kmIngreso"
            type="number"
            className={inputClass}
            value={kmIngreso}
            onChange={(e) => setKmIngreso(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="fechaPrometida">
          Fecha prometida de entrega
        </label>
        <input
          id="fechaPrometida"
          type="date"
          className={inputClass}
          value={fechaPrometida}
          onChange={(e) => setFechaPrometida(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="notas">
          Notas
        </label>
        <textarea
          id="notas"
          className={inputClass}
          rows={3}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-danger-600">{error}</p> : null}

      <div className="flex gap-3">
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? 'Abriendo…' : 'Abrir orden de trabajo'}
        </button>
        <button type="button" className={btnSecondary} onClick={() => router.back()}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
