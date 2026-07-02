'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { crearPresupuesto, addItemPresupuesto, enviarPresupuesto } from '@/modules/estimates/mutations'
import { TIPOS_ITEM_PRESUPUESTO, ESTADO_PRESUPUESTO_LABEL } from '@/modules/estimates/constants'
import type { PresupuestoConItems } from '@/modules/estimates/types'
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

interface AgregarItemPresupuestoFormProps {
  presupuestoId: string
  onDone: () => void
  onCancel: () => void
}

function AgregarItemPresupuestoForm({ presupuestoId, onDone, onCancel }: AgregarItemPresupuestoFormProps) {
  const [tipo, setTipo] = useState<'mano_obra' | 'repuesto'>('mano_obra')
  const [descripcion, setDescripcion] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [precioUnitario, setPrecioUnitario] = useState('')
  const [descuento, setDescuento] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const cantNum = parseFloat(cantidad)
    const precioNum = parseFloat(precioUnitario)
    const descNum = parseFloat(descuento) || 0
    if (!descripcion.trim() || isNaN(cantNum) || cantNum <= 0 || isNaN(precioNum) || precioNum < 0) {
      setError('Completa todos los campos correctamente.')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const supabase = createClient()
        await addItemPresupuesto(supabase, {
          presupuestoId,
          tipo,
          descripcion: descripcion.trim(),
          cantidad: cantNum,
          precioUnitario: precioNum,
          descuentoPorcentaje: descNum,
        })
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al agregar ítem.')
      }
    })
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-lg border border-white/[0.06] bg-neutral-950/40 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Nuevo ítem</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Tipo</label>
          <select className={inputClass} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} disabled={pending}>
            {TIPOS_ITEM_PRESUPUESTO.map((t) => (
              <option key={t} value={t}>{t === 'mano_obra' ? 'Mano de obra' : 'Repuesto / material'}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Descripción</label>
          <input
            className={inputClass}
            placeholder="ej: Cambio de batería 90AMP"
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
            step="any"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>Precio unitario (CLP)</label>
          <input
            className={inputClass}
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={precioUnitario}
            onChange={(e) => setPrecioUnitario(e.target.value)}
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>Descuento (%)</label>
          <input
            className={inputClass}
            type="number"
            min="0"
            max="100"
            step="1"
            value={descuento}
            onChange={(e) => setDescuento(e.target.value)}
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

interface PresupuestoSectionProps {
  ordenTrabajoId: string
  initialPresupuesto: PresupuestoConItems | null
}

export function PresupuestoSection({ ordenTrabajoId, initialPresupuesto }: PresupuestoSectionProps) {
  const router = useRouter()
  const [showAddItem, setShowAddItem] = useState(false)
  const [creando, setCreando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function refresh() {
    router.refresh()
  }

  async function crear() {
    setCreando(true)
    setError(null)
    try {
      const supabase = createClient()
      await crearPresupuesto(supabase, { ordenTrabajoId })
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear el presupuesto.')
    } finally {
      setCreando(false)
    }
  }

  async function enviar() {
    if (!initialPresupuesto) return
    setEnviando(true)
    setError(null)
    try {
      const supabase = createClient()
      await enviarPresupuesto(supabase, initialPresupuesto.id)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar el presupuesto.')
    } finally {
      setEnviando(false)
    }
  }

  if (!initialPresupuesto) {
    return (
      <section className={card}>
        <p className={sectionLabel}>Presupuesto</p>
        <p className="mt-3 text-sm text-neutral-500">Esta OT no tiene un presupuesto activo.</p>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <button onClick={() => void crear()} disabled={creando} className={`${btnPrimary} mt-3`}>
          {creando ? 'Creando…' : '+ Crear presupuesto'}
        </button>
      </section>
    )
  }

  const p = initialPresupuesto
  const esBorrador = p.estado === 'borrador'

  return (
    <section className={`${card} space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <p className={sectionLabel}>Presupuesto v{p.version}</p>
        <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-800">
          {ESTADO_PRESUPUESTO_LABEL[p.estado]}
        </span>
      </div>

      {p.items.length > 0 ? (
        <div className="space-y-1.5">
          {p.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <span className="mr-2 rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[10px] text-neutral-500">
                  {item.tipo === 'mano_obra' ? 'Mano de obra' : 'Repuesto'}
                </span>
                <span className="text-neutral-300">{item.descripcion}</span>
                {item.cantidad !== 1 && (
                  <span className="ml-2 text-xs text-neutral-600">× {item.cantidad}</span>
                )}
              </div>
              <span className="shrink-0 font-medium text-neutral-200">{fmtCLP(item.precio_total)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-white/[0.06] pt-3 text-sm">
            <span className="text-neutral-500">Mano de obra</span>
            <span className="text-neutral-300">{fmtCLP(p.total_mano_obra)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">Repuestos</span>
            <span className="text-neutral-300">{fmtCLP(p.total_repuestos)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-neutral-400">Total neto</span>
            <span className="text-neutral-100">{fmtCLP(p.total_neto)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">Sin ítems en el presupuesto.</p>
      )}

      {p.notas && <p className="text-xs text-neutral-500">{p.notas}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {esBorrador && (
        showAddItem ? (
          <AgregarItemPresupuestoForm
            presupuestoId={p.id}
            onDone={() => { setShowAddItem(false); refresh() }}
            onCancel={() => setShowAddItem(false)}
          />
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setShowAddItem(true)} className={`${btnGhost} text-xs`}>
              + Agregar ítem
            </button>
            {p.items.length > 0 && (
              <button onClick={() => void enviar()} disabled={enviando} className={`${btnSecondary} text-xs`}>
                {enviando ? 'Enviando…' : 'Marcar como enviado'}
              </button>
            )}
          </div>
        )
      )}
    </section>
  )
}
