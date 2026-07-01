// Design system — tema oscuro tipo DMS profesional (Sprint 6).
// Strings puros: usables en Server y Client Components.
// Se conservan los nombres previos (card, inputClass, etc.) para no romper pantallas existentes.

// ── Superficies ─────────────────────────────────────────────────────────────
export const card =
  'rounded-xl border border-black/[0.06] bg-neutral-900/50 p-5'

export const cardElevated =
  'rounded-2xl border border-black/[0.08] bg-neutral-900 p-6 shadow-xl shadow-black/30'

export const cardInteractive =
  'rounded-xl border border-black/[0.06] bg-neutral-900/50 p-5 transition-colors hover:border-black/[0.14] hover:bg-neutral-900'

// ── Formularios ─────────────────────────────────────────────────────────────
export const inputClass =
  'w-full rounded-lg border border-black/10 bg-neutral-950/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 transition-colors focus:border-accent-500/60 focus:outline-none focus:ring-2 focus:ring-accent-500/20'

export const inputXL =
  'w-full rounded-xl border border-black/10 bg-neutral-950/60 px-5 py-4 text-2xl font-semibold uppercase tracking-[0.2em] text-neutral-50 placeholder:tracking-normal placeholder:text-neutral-700 transition-colors focus:border-accent-500/70 focus:outline-none focus:ring-2 focus:ring-accent-500/25'

export const labelClass = 'block text-[13px] font-medium text-neutral-400 mb-1.5'

export const sectionLabel =
  'text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500'

// ── Botones ─────────────────────────────────────────────────────────────────
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50'

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 bg-black/[0.02] px-4 py-2.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-black/[0.06] disabled:cursor-not-allowed disabled:opacity-50'

export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-400 transition-colors hover:bg-black/[0.05] hover:text-neutral-100'

export const btnLarge =
  'inline-flex items-center justify-center gap-2.5 rounded-xl bg-accent-600 px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50'

// ── Misc ────────────────────────────────────────────────────────────────────
export const badge =
  'inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-0.5 text-xs font-medium text-neutral-300'

export const linkClass = 'text-accent-400 hover:text-accent-300 transition-colors'

/** Clases de color para el badge de estado de una OT. */
export function otEstadoBadge(estado: string): string {
  const base =
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border'
  const map: Record<string, string> = {
    pendiente_diagnostico: 'border-amber-500/30 bg-amber-500/10 text-amber-800',
    diagnosticada: 'border-amber-500/30 bg-amber-500/10 text-amber-800',
    presupuesto_pendiente: 'border-sky-500/30 bg-sky-500/10 text-sky-800',
    presupuesto_enviado: 'border-sky-500/30 bg-sky-500/10 text-sky-800',
    autorizada: 'border-violet-500/30 bg-violet-500/10 text-violet-800',
    en_reparacion: 'border-accent-500/30 bg-accent-500/10 text-accent-400',
    control_calidad: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-800',
    lista_para_entrega: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800',
    entregada: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800',
    cerrada: 'border-black/10 bg-black/[0.04] text-neutral-400',
    cancelada: 'border-red-500/30 bg-red-500/10 text-red-800',
  }
  return `${base} ${map[estado] ?? 'border-black/10 bg-black/[0.04] text-neutral-300'}`
}

/** Etiqueta legible para un estado de OT. */
export function otEstadoLabel(estado: string): string {
  const map: Record<string, string> = {
    pendiente_diagnostico: 'Pendiente diagnóstico',
    diagnosticada: 'Diagnosticada',
    presupuesto_pendiente: 'Presupuesto pendiente',
    presupuesto_enviado: 'Presupuesto enviado',
    autorizada: 'Autorizada',
    en_reparacion: 'En reparación',
    control_calidad: 'Control de calidad',
    lista_para_entrega: 'Lista para entrega',
    entregada: 'Entregada',
    cerrada: 'Cerrada',
    cancelada: 'Cancelada',
  }
  return map[estado] ?? estado
}
