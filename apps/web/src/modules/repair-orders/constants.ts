// Constantes del módulo repair-orders (tabla `ordenes_trabajo`, migration 003).
//
// Los estados de OT en `@allmotors/shared` SÍ coinciden con el CHECK de la base
// (a diferencia de ESTADOS_EVENTO), por eso los reexportamos desde shared.

import { ESTADOS_OT, ESTADOS_OT_ACTIVOS, type EstadoOT } from '@allmotors/shared'

export { ESTADOS_OT, ESTADOS_OT_ACTIVOS }
export type { EstadoOT }

export const ESTADO_OT_DEFAULT: EstadoOT = 'pendiente_diagnostico'

/** Estados terminales: liberan el vehículo (el trigger setea cerrado_en automáticamente). */
export const ESTADOS_OT_TERMINALES = ['cerrada', 'cancelada'] as const
export type EstadoOTTerminal = (typeof ESTADOS_OT_TERMINALES)[number]

export const ORDENES_TRABAJO_PAGE_SIZE = 50
