// Tipos y schemas Zod del módulo technical-history (tabla `historias_tecnicas`, migration 002).
// Sin `creado_por` ni `eliminado_en` (la tabla no los tiene).

import { z } from 'zod'

/** Fila de la tabla `historias_tecnicas` (1:1 con vehículo). */
export interface HistoriaTecnica {
  id: string
  vehiculo_id: string
  org_id: string
  notas: string | null
  creado_en: string
  actualizado_en: string
}

/** Único campo editable de la historia técnica: las notas generales. */
export const historiaUpdateSchema = z.object({
  notas: z.string().trim().max(5000).nullable(),
})

export type HistoriaUpdateInput = z.infer<typeof historiaUpdateSchema>
