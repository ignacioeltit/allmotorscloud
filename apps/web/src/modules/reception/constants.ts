// Constantes del flujo de Recepción (Sprint 6).
// Este módulo es una capa de orquestación: no tiene tabla propia, compone otros módulos.

/** Ítems del checklist visual de recepción del vehículo. */
export const CHECKLIST_RECEPCION = [
  { key: 'luces', label: 'Luces' },
  { key: 'espejos', label: 'Espejos' },
  { key: 'neumaticos', label: 'Neumáticos' },
  { key: 'golpes', label: 'Golpes / Rayones' },
  { key: 'combustible', label: 'Combustible' },
  { key: 'documentacion', label: 'Documentación' },
  { key: 'llave', label: 'Llave entregada' },
  { key: 'rueda_repuesto', label: 'Rueda de repuesto' },
  { key: 'gata', label: 'Gata' },
  { key: 'triangulos', label: 'Triángulos' },
  { key: 'objetos_personales', label: 'Objetos personales' },
] as const

export type ChecklistKey = (typeof CHECKLIST_RECEPCION)[number]['key']

/** Opciones de combustible (se persisten en vehiculo.notas, no hay columna dedicada). */
export const COMBUSTIBLES = ['Bencina', 'Diésel', 'Eléctrico', 'Híbrido', 'GLP', 'Otro'] as const

/** Opciones de transmisión (se persisten en vehiculo.notas). */
export const TRANSMISIONES = ['Manual', 'Automática', 'CVT', 'Otro'] as const

/** Prioridad de la recepción (se persiste en la descripción del evento; no hay columna dedicada). */
export const PRIORIDADES = ['baja', 'normal', 'alta', 'urgente'] as const
export type Prioridad = (typeof PRIORIDADES)[number]
export const PRIORIDAD_DEFAULT: Prioridad = 'normal'
