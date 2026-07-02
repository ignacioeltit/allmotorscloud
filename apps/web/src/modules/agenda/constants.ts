// Estados de una cita (tabla citas, migration 003) y sus etiquetas/estilos para la UI.

export const ESTADOS_CITA = [
  'programada',
  'confirmada',
  'realizada',
  'cancelada',
  'no_presentada',
] as const

export type EstadoCita = (typeof ESTADOS_CITA)[number]

export const ESTADO_CITA_LABEL: Record<EstadoCita, string> = {
  programada: 'Agendada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  no_presentada: 'No se presentó',
}

/** Clases del badge por estado (tema claro invertido — usa tonos con buen contraste). */
export const ESTADO_CITA_BADGE: Record<EstadoCita, string> = {
  programada: 'border-sky-500/30 bg-sky-500/10 text-sky-800',
  confirmada: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800',
  realizada: 'border-violet-500/30 bg-violet-500/10 text-violet-800',
  cancelada: 'border-red-500/30 bg-red-500/10 text-red-800',
  no_presentada: 'border-amber-500/30 bg-amber-500/10 text-amber-800',
}

/** Estados que ocupan un cupo en la agenda (se muestran como citas activas). */
export const ESTADOS_ACTIVOS: EstadoCita[] = ['programada', 'confirmada']

export const TZ = 'America/Santiago'
