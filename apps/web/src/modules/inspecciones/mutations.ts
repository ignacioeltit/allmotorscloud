// Escrituras de inspecciones de OT: upsert del checklist completo.
// La ejecuta el mecánico; gestión también puede editarla (lo impone RLS).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { validationErrorFromZod } from '@/lib/errors'
import {
  guardarInspeccionSchema,
  INSPECCION_COLUMNS,
  type GuardarInspeccionInput,
  type Inspeccion,
} from './types'

/**
 * Guarda (crea o reemplaza) la inspección de una OT. Upsert por orden_trabajo_id
 * — hay una sola inspección por OT (UNIQUE uq_inspeccion_ot).
 */
export async function guardarInspeccion(
  supabase: DbClient,
  input: GuardarInspeccionInput,
): Promise<Inspeccion> {
  const parsed = guardarInspeccionSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { userId, orgId } = await getAuthContext(supabase)
  const { ordenTrabajoId, vehiculoId, puntos } = parsed.data

  const { data, error } = await supabase
    .from('inspecciones_ot')
    .upsert(
      {
        org_id: orgId,
        orden_trabajo_id: ordenTrabajoId,
        vehiculo_id: vehiculoId,
        puntos,
        creado_por: userId,
      },
      { onConflict: 'orden_trabajo_id' },
    )
    .select(INSPECCION_COLUMNS)

  return unwrapWritten<Inspeccion>(data, error)
}
