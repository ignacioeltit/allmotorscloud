// Inspección integral de la OT (tabla `inspecciones_ot`, migration 044).
// El checklist de 14 puntos vive acá como constante; la DB solo guarda el estado
// de cada punto en un arreglo JSONB.

import { z } from 'zod'

export type EstadoPunto = 'ok' | 'observacion' | 'atencion' | 'na'

/** Un punto del checklist evaluado. */
export interface PuntoInspeccion {
  codigo: string
  estado: EstadoPunto
  nota: string
  /** bucket_path de una foto del punto (opcional), en el bucket `evidencias`. */
  foto?: string | null
}

export interface Inspeccion {
  id: string
  org_id: string
  orden_trabajo_id: string
  vehiculo_id: string
  puntos: PuntoInspeccion[]
  creado_por: string | null
  creado_en: string
  actualizado_en: string
}

export const INSPECCION_COLUMNS =
  'id, org_id, orden_trabajo_id, vehiculo_id, puntos, creado_por, creado_en, actualizado_en'

/** Catálogo fijo de los 14 puntos de la inspección (orden de ejecución). */
export const PUNTOS_INSPECCION: { codigo: string; label: string }[] = [
  { codigo: 'R1', label: 'Revisión de luces' },
  { codigo: 'R2', label: 'Suspensión' },
  { codigo: 'R3', label: 'Niveles (aceite / refrigerante)' },
  { codigo: 'R4', label: 'Filtros' },
  { codigo: 'R5', label: 'Correas' },
  { codigo: 'R6', label: 'Frenos (sacar rueda)' },
  { codigo: 'R7', label: 'Dirección' },
  { codigo: 'R8', label: 'Tren delantero' },
  { codigo: 'R9', label: 'Neumáticos' },
  { codigo: 'R10', label: 'Presión de inflado' },
  { codigo: 'R11', label: 'Fugas de aceite motor' },
  { codigo: 'R12', label: 'Batería (diagnóstico)' },
  { codigo: 'R13', label: 'Plumillas' },
  { codigo: 'R14', label: 'Nivel líquido limpiaparabrisas' },
]

export const ESTADO_PUNTO_LABEL: Record<EstadoPunto, string> = {
  ok: 'OK',
  observacion: 'Observación',
  atencion: 'Requiere atención',
  na: 'No aplica',
}

const puntoSchema = z.object({
  codigo: z.string().trim().min(1).max(10),
  estado: z.enum(['ok', 'observacion', 'atencion', 'na']),
  nota: z.string().trim().max(500).default(''),
  foto: z.string().trim().max(500).nullish(),
})

export const guardarInspeccionSchema = z.object({
  ordenTrabajoId: z.string().uuid(),
  vehiculoId: z.string().uuid(),
  puntos: z.array(puntoSchema).max(50),
})
export type GuardarInspeccionInput = z.infer<typeof guardarInspeccionSchema>
