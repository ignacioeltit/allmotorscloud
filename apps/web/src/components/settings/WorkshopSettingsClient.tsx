'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateConfiguracionManoObra } from '@/modules/taller/mutations'
import type { ConfiguracionManoObra } from '@/modules/taller/types'
import { inputClass, btnPrimary } from '@/components/ui/styles'

interface WorkshopSettingsClientProps {
  initialConfig: ConfiguracionManoObra
}

interface FieldRow {
  key: keyof ConfiguracionManoObra
  label: string
  description: string
}

const HORA_FIELDS: FieldRow[] = [
  { key: 'valor_hora_mecanica',    label: 'Mecánica general',   description: 'Tarifa base para trabajos de mecánica' },
  { key: 'valor_hora_mantencion',  label: 'Mantención',         description: 'Revisiones preventivas y cambio de aceite' },
  { key: 'valor_hora_diagnostico', label: 'Diagnóstico',        description: 'Diagnóstico de fallas' },
  { key: 'valor_hora_electricidad',label: 'Electricidad',       description: 'Trabajos eléctricos y electrónicos' },
  { key: 'valor_hora_diesel',      label: 'Diesel',             description: 'Sistemas de inyección diesel' },
]

const EVENTO_FIELDS: FieldRow[] = [
  { key: 'valor_alineacion_liviano',   label: 'Alineación liviano',    description: 'Por evento, auto particular' },
  { key: 'valor_alineacion_camioneta', label: 'Alineación camioneta',  description: 'Por evento, SUV y camioneta' },
  { key: 'valor_reprog_ecu_basica',    label: 'Reprog. ECU básica',    description: 'Por evento' },
  { key: 'valor_reprog_dpf_egr',       label: 'Reprog. DPF/EGR',       description: 'Por evento' },
  { key: 'valor_programacion_tpms',    label: 'Programación TPMS',     description: 'Por evento' },
]

const UNIDAD_FIELDS: FieldRow[] = [
  { key: 'valor_rectificado_disco',  label: 'Rectificado disco',   description: 'Por disco' },
  { key: 'valor_balanceo_rueda',     label: 'Balanceo',            description: 'Por rueda' },
  { key: 'valor_montaje_neumatico',  label: 'Montaje neumático',   description: 'Por rueda' },
]

export function WorkshopSettingsClient({ initialConfig }: WorkshopSettingsClientProps) {
  const [config, setConfig] = useState<ConfiguracionManoObra>(initialConfig)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function getValue(key: keyof ConfiguracionManoObra): string {
    if (key in draft) return draft[key as string] ?? ''
    const v = config[key]
    return v != null ? String(v) : ''
  }

  function onChange(key: keyof ConfiguracionManoObra, value: string) {
    setSaved(false)
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function save() {
    setError(null)
    setSaved(false)

    const updates: Record<string, number | null> = {}
    let hasChanges = false

    const allFields = [...HORA_FIELDS, ...EVENTO_FIELDS, ...UNIDAD_FIELDS]
    for (const field of allFields) {
      const raw = draft[field.key as string]
      if (raw === undefined) continue
      const trimmed = raw.trim()
      if (trimmed === '' || trimmed === String(config[field.key])) continue

      const num = parseInt(trimmed, 10)
      if (isNaN(num) || num < 0) {
        setError(`Valor inválido en "${field.label}". Ingresa un número entero positivo.`)
        return
      }
      if (num > 10_000_000) {
        setError(`Valor demasiado alto en "${field.label}". Máximo $10.000.000.`)
        return
      }
      updates[field.key as string] = num
      hasChanges = true
    }

    // IVA
    const ivaRaw = draft['iva_porcentaje']
    if (ivaRaw !== undefined) {
      const iva = parseFloat(ivaRaw)
      if (isNaN(iva) || iva < 0 || iva > 100) {
        setError('IVA debe ser un número entre 0 y 100.')
        return
      }
      if (iva !== config.iva_porcentaje) {
        updates['iva_porcentaje'] = iva
        hasChanges = true
      }
    }

    if (!hasChanges) { setSaved(true); return }

    startTransition(async () => {
      try {
        const supabase = createClient()
        const updated = await updateConfiguracionManoObra(supabase, updates as Parameters<typeof updateConfiguracionManoObra>[1])
        setConfig(updated)
        setDraft({})
        setSaved(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al guardar la configuración.')
      }
    })
  }

  function FieldInput({ field }: { field: FieldRow }) {
    return (
      <div className="flex items-start justify-between gap-4 border-b border-black/[0.04] pb-4 last:border-0 last:pb-0">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-200">{field.label}</p>
          <p className="mt-0.5 text-xs text-neutral-600">{field.description}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-neutral-600">$</span>
          <input
            type="number"
            min="0"
            step="1"
            className={`${inputClass} w-32 text-right`}
            value={getValue(field.key)}
            onChange={(e) => onChange(field.key, e.target.value)}
            disabled={pending}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {/* Tarifas hora */}
      <section className="rounded-xl border border-black/[0.06] bg-neutral-900/50 p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Tarifas por hora (CLP)
        </p>
        <p className="mb-5 text-xs text-neutral-600">
          Precio = horas estándar × tarifa. Se aplica automáticamente al agregar servicios del catálogo a una OT.
        </p>
        <div className="space-y-4">
          {HORA_FIELDS.map((f) => <FieldInput key={f.key as string} field={f} />)}
        </div>
      </section>

      {/* Precios por evento */}
      <section className="rounded-xl border border-black/[0.06] bg-neutral-900/50 p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Precios por evento (CLP)
        </p>
        <p className="mb-5 text-xs text-neutral-600">
          Precio fijo independiente de las horas trabajadas.
        </p>
        <div className="space-y-4">
          {EVENTO_FIELDS.map((f) => <FieldInput key={f.key as string} field={f} />)}
        </div>
      </section>

      {/* Precios por unidad */}
      <section className="rounded-xl border border-black/[0.06] bg-neutral-900/50 p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Precios por unidad (CLP)
        </p>
        <div className="space-y-4">
          {UNIDAD_FIELDS.map((f) => <FieldInput key={f.key as string} field={f} />)}
        </div>
      </section>

      {/* IVA */}
      <section className="rounded-xl border border-black/[0.06] bg-neutral-900/50 p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">General</p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-200">IVA (%)</p>
            <p className="mt-0.5 text-xs text-neutral-600">Impuesto aplicado a los presupuestos</p>
          </div>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            className={`${inputClass} w-24 text-right shrink-0`}
            value={getValue('iva_porcentaje')}
            onChange={(e) => onChange('iva_porcentaje', e.target.value)}
            disabled={pending}
          />
        </div>
      </section>

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {saved && !error && (
        <p className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-800">
          Configuración guardada correctamente.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={btnPrimary}
          onClick={save}
          disabled={pending}
        >
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <p className="text-xs text-neutral-600">
          Última actualización:{' '}
          {new Date(config.actualizado_en).toLocaleString('es-CL', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  )
}
