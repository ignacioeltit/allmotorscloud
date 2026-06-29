'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { crearReparacion, addItemReparacion, softDeleteItemReparacion } from '@/modules/reparaciones/mutations'
import { TIPOS_ITEM_REPARACION, TIPOS_ITEM_LABEL } from '@/modules/reparaciones/constants'
import type { ReparacionConItems } from '@/modules/reparaciones/types'
import {
  card,
  sectionLabel,
  inputClass,
  labelClass,
  btnPrimary,
  btnSecondary,
  btnGhost,
} from '@/components/ui/styles'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

interface AgregarItemFormProps {
  reparacionId: string
  onDone: () => void
  onCancel: () => void
}

function AgregarItemForm({ reparacionId, onDone, onCancel }: AgregarItemFormProps) {
  const [tipo, setTipo] = useState<'mano_obra' | 'repuesto'>('mano_obra')
  const [descripcion, setDescripcion] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [costoUnitario, setCostoUnitario] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const cantNum = parseFloat(cantidad)
    const costoNum = parseFloat(costoUnitario)
    if (!descripcion.trim() || isNaN(cantNum) || cantNum <= 0 || isNaN(costoNum) || costoNum < 0) {
      setError('Completa todos los campos correctamente.')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const supabase = createClient()
        await addItemReparacion(supabase, {
          reparacionId,
          tipo,
          descripcion: descripcion.trim(),
          cantidad: cantNum,
          costoUnitario: costoNum,
        })
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al agregar ítem.')
      }
    })
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 rounded-lg border border-white/[0.06] bg-neutral-950/40 p-4"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Nuevo ítem
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Tipo</label>
          <select
            className={inputClass}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as typeof tipo)}
            disabled={pending}
          >
            {TIPOS_ITEM_REPARACION.map((t) => (
              <option key={t} value={t}>
                {TIPOS_ITEM_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Descripción</label>
          <input
            className={inputClass}
            placeholder="ej: Cambio de pastillas, Aceite 5W30…"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>Cantidad</label>
          <input
            className={inputClass}
            type="number"
            min="0.001"
            step="0.001"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>Costo unitario (CLP)</label>
          <input
            className={inputClass}
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={costoUnitario}
            onChange={(e) => setCostoUnitario(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? 'Guardando…' : 'Agregar ítem'}
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={pending}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

interface AgregarTrabajoFormProps {
  ordenTrabajoId: string
  historiaId: string
  tipoEventoId: string
  onDone: () => void
  onCancel: () => void
}

function AgregarTrabajoForm({
  ordenTrabajoId,
  historiaId,
  tipoEventoId,
  onDone,
  onCancel,
}: AgregarTrabajoFormProps) {
  const [descripcion, setDescripcion] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const supabase = createClient()
        await crearReparacion(supabase, {
          ordenTrabajoId,
          historiaId,
          tipoEventoId,
          descripcion: descripcion.trim() || undefined,
          observaciones: observaciones.trim() || undefined,
        })
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al crear el trabajo.')
      }
    })
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-white/[0.06] bg-neutral-900/50 p-5"
    >
      <p className={`${sectionLabel} mb-4`}>Nuevo trabajo técnico</p>
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Descripción del trabajo</label>
          <input
            className={inputClass}
            placeholder="ej: Revisión de frenos, Cambio de aceite…"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>Diagnóstico / observaciones internas</label>
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            placeholder="Notas del mecánico, diagnóstico encontrado…"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? 'Creando…' : 'Crear trabajo'}
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={pending}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

interface TrabajoCardProps {
  reparacion: ReparacionConItems
  onChanged: () => void
}

function TrabajoCard({ reparacion, onChanged }: TrabajoCardProps) {
  const [showAddItem, setShowAddItem] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function eliminarItem(itemId: string) {
    setDeletingId(itemId)
    setDeleteError(null)
    try {
      const supabase = createClient()
      await softDeleteItemReparacion(supabase, itemId)
      onChanged()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Error al eliminar el ítem.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className={`${card} space-y-4`}>
      <div>
        <p className="font-semibold text-neutral-100">
          {reparacion.descripcion || 'Trabajo técnico'}
        </p>
        {reparacion.observaciones && (
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-neutral-400">
            {reparacion.observaciones}
          </p>
        )}
        <p className="mt-1 text-[11px] text-neutral-600">
          {new Date(reparacion.creado_en).toLocaleString('es-CL', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      </div>

      {reparacion.items.length > 0 && (
        <div className="space-y-1.5">
          <p className={`${sectionLabel} mb-1`}>Ítems</p>
          {reparacion.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2"
            >
              <div className="min-w-0">
                <span className="mr-2 rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[10px] text-neutral-500">
                  {TIPOS_ITEM_LABEL[item.tipo]}
                </span>
                <span className="text-sm text-neutral-200">{item.descripcion}</span>
                {item.cantidad !== 1 && (
                  <span className="ml-2 text-xs text-neutral-600">× {item.cantidad}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-medium text-neutral-300">{fmtCLP(item.costo_total)}</span>
                <button
                  onClick={() => void eliminarItem(item.id)}
                  disabled={deletingId === item.id}
                  className={`${btnGhost} px-2 py-1 text-red-400 hover:text-red-300`}
                  title="Eliminar ítem"
                >
                  {deletingId === item.id ? '…' : '×'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}

      {showAddItem ? (
        <AgregarItemForm
          reparacionId={reparacion.id}
          onDone={() => { setShowAddItem(false); onChanged() }}
          onCancel={() => setShowAddItem(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddItem(true)}
          className={`${btnGhost} text-xs`}
        >
          + Agregar ítem
        </button>
      )}
    </div>
  )
}

interface TrabajosSectionProps {
  ordenTrabajoId: string
  historiaId: string
  tipoEventoReparacionId: string | null
  initialReparaciones: ReparacionConItems[]
}

export function TrabajosSection({
  ordenTrabajoId,
  historiaId,
  tipoEventoReparacionId,
  initialReparaciones,
}: TrabajosSectionProps) {
  const router = useRouter()
  const [showAddTrabajo, setShowAddTrabajo] = useState(false)

  function refresh() {
    router.refresh()
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={sectionLabel}>Trabajos realizados</p>
        {tipoEventoReparacionId && !showAddTrabajo && (
          <button
            onClick={() => setShowAddTrabajo(true)}
            className={`${btnPrimary} py-1.5 text-xs`}
          >
            + Agregar trabajo
          </button>
        )}
      </div>

      {!tipoEventoReparacionId && (
        <p className="text-sm text-neutral-500">
          Configura los tipos de evento del taller para registrar trabajos.
        </p>
      )}

      {showAddTrabajo && tipoEventoReparacionId && (
        <AgregarTrabajoForm
          ordenTrabajoId={ordenTrabajoId}
          historiaId={historiaId}
          tipoEventoId={tipoEventoReparacionId}
          onDone={() => { setShowAddTrabajo(false); refresh() }}
          onCancel={() => setShowAddTrabajo(false)}
        />
      )}

      {initialReparaciones.length === 0 && !showAddTrabajo && (
        <p className="text-sm text-neutral-600">Sin trabajos registrados aún.</p>
      )}

      {initialReparaciones.map((rep) => (
        <TrabajoCard key={rep.id} reparacion={rep} onChanged={refresh} />
      ))}
    </section>
  )
}
