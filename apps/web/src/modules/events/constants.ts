// Constantes del módulo events (tabla `eventos`, migration 002).
//
// IMPORTANTE: estos estados son los REALES del CHECK chk_eventos_estado (migration 002).
// `@allmotors/shared` exporta un `ESTADOS_EVENTO` distinto y DESACTUALIZADO
// (['abierto','en_progreso','completado','cerrado','cancelado']) que NO coincide con la
// base. No usar el de shared para eventos hasta que se corrija (ver riesgos del sprint).

export const ESTADOS_EVENTO = [
  'creado',
  'pendiente',
  'asignado',
  'en_ejecucion',
  'en_espera',
  'finalizado',
  'cerrado',
  'cancelado',
] as const
export type EstadoEvento = (typeof ESTADOS_EVENTO)[number]

export const ESTADO_EVENTO_DEFAULT: EstadoEvento = 'creado'

/** Estados terminales: se alcanzan solo vía cerrarEvento / cancelarEvento. */
export const ESTADOS_EVENTO_TERMINALES = ['cerrado', 'cancelado'] as const
export type EstadoEventoTerminal = (typeof ESTADOS_EVENTO_TERMINALES)[number]

/** Estados no terminales: editables vía updateEvento. */
export const ESTADOS_EVENTO_ACTIVOS = [
  'creado',
  'pendiente',
  'asignado',
  'en_ejecucion',
  'en_espera',
  'finalizado',
] as const
export type EstadoEventoActivo = (typeof ESTADOS_EVENTO_ACTIVOS)[number]

/** Categorías de tipo de evento (CHECK chk_tipos_evento_categoria, migration 002). */
export const CATEGORIAS_TIPO_EVENTO = [
  'inspeccion',
  'mantencion',
  'reparacion',
  'garantia',
  'estimacion',
  'documentacion',
  'comunicacion',
  'administracion',
] as const
export type CategoriaTipoEvento = (typeof CATEGORIAS_TIPO_EVENTO)[number]

export const EVENTOS_PAGE_SIZE = 50
