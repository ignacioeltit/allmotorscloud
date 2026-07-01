'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { aprobarServicio, rechazarServicio } from '@/modules/catalogo/mutations'
import type { CamposEditables } from '@/modules/catalogo/mutations'
import {
  CATEGORIAS_CATALOGO,
  CATEGORIA_LABEL,
  CATEGORIA_COLOR,
} from '@/modules/catalogo/constants'
import type { CategoriaCatalogo } from '@/modules/catalogo/constants'
import type { CatalogoServicio } from '@/modules/catalogo/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { sectionLabel, inputClass, labelClass, btnPrimary, btnSecondary, btnGhost } from '@/components/ui/styles'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function fmtRelativa(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  if (days < 30) return `hace ${Math.floor(days / 7)} semanas`
  return `hace ${Math.floor(days / 30)} meses`
}

function CategoriaBadge({ categoria }: { categoria: string | null }) {
  const cat = categoria as CategoriaCatalogo | null
  const label = cat && CATEGORIA_LABEL[cat] ? CATEGORIA_LABEL[cat] : (categoria ?? 'Sin categoría')
  const color = cat && CATEGORIA_COLOR[cat]
    ? CATEGORIA_COLOR[cat]
    : 'border-white/10 bg-white/[0.04] text-neutral-500'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${color}`}>
      {label}
    </span>
  )
}

// ── Tipos internos ────────────────────────────────────────────────────────────

interface EditForm {
  nombre: string
  codigo: string
  descripcion: string
  categoria: string
  horasEstandar: string
  precioUnitario: string
}

function initEditForm(s: CatalogoServicio): EditForm {
  return {
    nombre: s.nombre,
    codigo: s.codigo ?? '',
    descripcion: s.descripcion ?? '',
    categoria: s.categoria ?? 'otro',
    horasEstandar: s.horas_estandar != null ? String(s.horas_estandar) : '',
    precioUnitario: String(s.precio_unitario),
  }
}

function parseEditForm(form: EditForm): CamposEditables {
  return {
    nombre: form.nombre.trim() || undefined,
    codigo: form.codigo.trim() ? form.codigo.trim() : null,
    descripcion: form.descripcion.trim() ? form.descripcion.trim() : null,
    categoria: (form.categoria as CategoriaCatalogo) || undefined,
    horasEstandar: form.horasEstandar !== '' ? parseFloat(form.horasEstandar) : null,
    precioUnitario: form.precioUnitario !== '' ? parseFloat(form.precioUnitario) : undefined,
  }
}

function validateEditForm(form: EditForm): string | null {
  if (!form.nombre.trim() || form.nombre.trim().length < 5) {
    return 'El nombre debe tener al menos 5 caracteres.'
  }
  if (form.horasEstandar !== '') {
    const h = parseFloat(form.horasEstandar)
    if (isNaN(h) || h < 0) return 'Las horas no pueden ser negativas.'
    if (h > 24) return 'Las horas no pueden superar 24.'
  }
  if (form.precioUnitario !== '') {
    const p = parseFloat(form.precioUnitario)
    if (isNaN(p) || p < 0) return 'El precio no puede ser negativo.'
  }
  return null
}

// ── Subcomponente: tarjeta individual ────────────────────────────────────────

interface CardProps {
  s: CatalogoServicio
  isEditing: boolean
  editForm: EditForm
  isRejectConfirm: boolean
  saving: boolean
  error: string | null
  onStartEdit: () => void
  onCancelEdit: () => void
  onEditChange: (field: keyof EditForm, value: string) => void
  onAproveDirect: () => void
  onAproveWithEdit: () => void
  onRejectStart: () => void
  onRejectCancel: () => void
  onRejectConfirm: () => void
}

function PendienteCard({
  s,
  isEditing,
  editForm,
  isRejectConfirm,
  saving,
  error,
  onStartEdit,
  onCancelEdit,
  onEditChange,
  onAproveDirect,
  onAproveWithEdit,
  onRejectStart,
  onRejectCancel,
  onRejectConfirm,
}: CardProps) {
  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      isEditing
        ? 'border-accent-500/30 bg-accent-500/[0.04]'
        : isRejectConfirm
        ? 'border-red-500/30 bg-red-500/[0.04]'
        : 'border-amber-500/20 bg-amber-500/[0.03] hover:bg-amber-500/[0.06]'
    }`}>

      {/* ── Vista colapsada ── */}
      {!isEditing && !isRejectConfirm && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-neutral-100">{s.nombre}</span>
                <CategoriaBadge categoria={s.categoria} />
                <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-400">
                  Pendiente
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                <span>
                  Código:{' '}
                  <span className="font-mono text-neutral-400">{s.codigo ?? 'Sin código'}</span>
                </span>
                <span>
                  Horas:{' '}
                  <span className="text-neutral-400">
                    {s.horas_estandar != null ? `${s.horas_estandar}h` : '—'}
                  </span>
                </span>
                <span>
                  Precio:{' '}
                  <span className="text-neutral-400">{fmtCLP(s.precio_unitario)}</span>
                </span>
                <span>Creado {fmtRelativa(s.creado_en)}</span>
              </div>
              {s.descripcion && (
                <p className="mt-1.5 text-xs text-neutral-500">{s.descripcion}</p>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
            <button
              type="button"
              onClick={onAproveDirect}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              Aprobar
            </button>
            <button
              type="button"
              onClick={onStartEdit}
              disabled={saving}
              className={`${btnGhost} text-xs`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Editar
            </button>
            <button
              type="button"
              onClick={onRejectStart}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Rechazar
            </button>
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-400">{error}</p>
          )}
        </>
      )}

      {/* ── Confirmación de rechazo ── */}
      {isRejectConfirm && (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-100">{s.nombre}</p>
            <p className="mt-1 text-sm text-neutral-400">
              ¿Rechazar este servicio? Quedará eliminado del catálogo. Los datos históricos
              de las OTs que lo usaron no se modifican.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRejectConfirm}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/80 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Confirmar rechazo
            </button>
            <button
              type="button"
              onClick={onRejectCancel}
              disabled={saving}
              className={`${btnGhost} text-xs`}
            >
              Cancelar
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>
      )}

      {/* ── Formulario de edición ── */}
      {isEditing && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-neutral-100">Editar servicio</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Ajusta los campos y haz clic en &ldquo;Aprobar y publicar&rdquo; para agregar al catálogo oficial.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Nombre */}
            <div className="sm:col-span-2">
              <label className={labelClass}>
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={editForm.nombre}
                onChange={(e) => onEditChange('nombre', e.target.value)}
                className={inputClass}
                placeholder="Ej: RENOVAR CORREA DE DISTRIBUCIÓN"
                maxLength={300}
              />
            </div>

            {/* Código */}
            <div>
              <label className={labelClass}>Código</label>
              <input
                type="text"
                value={editForm.codigo}
                onChange={(e) => onEditChange('codigo', e.target.value.toUpperCase())}
                className={inputClass}
                placeholder="Ej: KITDIST"
                maxLength={50}
              />
              <p className="mt-1 text-[11px] text-neutral-600">Opcional. Dejar vacío si aún no aplica.</p>
            </div>

            {/* Categoría */}
            <div>
              <label className={labelClass}>
                Categoría <span className="text-red-400">*</span>
              </label>
              <select
                value={editForm.categoria}
                onChange={(e) => onEditChange('categoria', e.target.value)}
                className={inputClass}
              >
                {CATEGORIAS_CATALOGO.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIA_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>

            {/* Horas estándar */}
            <div>
              <label className={labelClass}>Horas estándar</label>
              <input
                type="number"
                value={editForm.horasEstandar}
                onChange={(e) => onEditChange('horasEstandar', e.target.value)}
                className={inputClass}
                placeholder="Ej: 1.5"
                min="0"
                max="24"
                step="0.25"
              />
              <p className="mt-1 text-[11px] text-neutral-600">Opcional. Ej: 0.5, 1, 2.</p>
            </div>

            {/* Precio */}
            <div>
              <label className={labelClass}>
                Precio unitario (CLP) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={editForm.precioUnitario}
                onChange={(e) => onEditChange('precioUnitario', e.target.value)}
                className={inputClass}
                placeholder="Ej: 29412"
                min="0"
                max="2000000"
                step="1"
              />
            </div>

            {/* Descripción */}
            <div className="sm:col-span-2">
              <label className={labelClass}>Descripción</label>
              <textarea
                value={editForm.descripcion}
                onChange={(e) => onEditChange('descripcion', e.target.value)}
                className={`${inputClass} resize-none`}
                rows={2}
                placeholder="Descripción interna opcional"
                maxLength={1000}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
            <button
              type="button"
              onClick={onAproveWithEdit}
              disabled={saving}
              className={`${btnPrimary} text-xs`}
            >
              {saving ? (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              Aprobar y publicar
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={saving}
              className={`${btnSecondary} text-xs`}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  initialPendientes: CatalogoServicio[]
}

export function PendientesClient({ initialPendientes }: Props) {
  const router = useRouter()
  const [pendientes, setPendientes] = useState<CatalogoServicio[]>(initialPendientes)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [errorMap, setErrorMap] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()

  function setError(id: string, msg: string) {
    setErrorMap((prev) => ({ ...prev, [id]: msg }))
  }

  function clearError(id: string) {
    setErrorMap((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function removeFromList(id: string) {
    setPendientes((prev) => prev.filter((s) => s.id !== id))
    startTransition(() => { router.refresh() })
  }

  // ── Edición ──

  function handleStartEdit(id: string) {
    const s = pendientes.find((x) => x.id === id)
    if (!s) return
    clearError(id)
    setRejectConfirmId(null)
    setEditingId(id)
    setEditForm(initEditForm(s))
  }

  function handleCancelEdit(id: string) {
    clearError(id)
    setEditingId(null)
    setEditForm(null)
  }

  function handleEditChange(field: keyof EditForm, value: string) {
    setEditForm((prev) => prev ? { ...prev, [field]: value } : prev)
  }

  // ── Aprobar directo (sin editar) ──

  async function handleAproveDirect(id: string) {
    clearError(id)
    setSavingId(id)
    try {
      const supabase = createClient()
      await aprobarServicio(supabase, id, {})
      removeFromList(id)
    } catch (e) {
      setError(id, e instanceof Error ? e.message : 'Error al aprobar el servicio.')
    } finally {
      setSavingId(null)
    }
  }

  // ── Aprobar con edición ──

  async function handleAproveWithEdit(id: string) {
    if (!editForm) return
    const validationError = validateEditForm(editForm)
    if (validationError) {
      setError(id, validationError)
      return
    }
    clearError(id)
    setSavingId(id)
    try {
      const supabase = createClient()
      const campos = parseEditForm(editForm)
      await aprobarServicio(supabase, id, campos)
      setEditingId(null)
      setEditForm(null)
      removeFromList(id)
    } catch (e) {
      setError(id, e instanceof Error ? e.message : 'Error al aprobar el servicio.')
    } finally {
      setSavingId(null)
    }
  }

  // ── Rechazar ──

  function handleRejectStart(id: string) {
    clearError(id)
    setEditingId(null)
    setEditForm(null)
    setRejectConfirmId(id)
  }

  function handleRejectCancel(id: string) {
    clearError(id)
    setRejectConfirmId(null)
  }

  async function handleRejectConfirm(id: string) {
    clearError(id)
    setSavingId(id)
    try {
      const supabase = createClient()
      await rechazarServicio(supabase, id)
      setRejectConfirmId(null)
      removeFromList(id)
    } catch (e) {
      setError(id, e instanceof Error ? e.message : 'Error al rechazar el servicio.')
    } finally {
      setSavingId(null)
    }
  }

  // ── Render ──

  if (pendientes.length === 0) {
    return (
      <EmptyState
        title="Todo al día"
        description="No hay servicios pendientes de revisión. Los servicios creados desde OTs aparecerán aquí."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="mb-1 flex items-center gap-2">
        <span className={sectionLabel}>
          Servicios creados desde OTs — pendientes de aprobación
        </span>
      </div>
      {pendientes.map((s) => (
        <PendienteCard
          key={s.id}
          s={s}
          isEditing={editingId === s.id}
          editForm={editingId === s.id && editForm ? editForm : initEditForm(s)}
          isRejectConfirm={rejectConfirmId === s.id}
          saving={savingId === s.id}
          error={errorMap[s.id] ?? null}
          onStartEdit={() => handleStartEdit(s.id)}
          onCancelEdit={() => handleCancelEdit(s.id)}
          onEditChange={(field, value) => handleEditChange(field, value)}
          onAproveDirect={() => handleAproveDirect(s.id)}
          onAproveWithEdit={() => handleAproveWithEdit(s.id)}
          onRejectStart={() => handleRejectStart(s.id)}
          onRejectCancel={() => handleRejectCancel(s.id)}
          onRejectConfirm={() => handleRejectConfirm(s.id)}
        />
      ))}
    </div>
  )
}
