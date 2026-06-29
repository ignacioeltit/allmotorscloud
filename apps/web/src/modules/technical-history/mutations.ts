// Escrituras del módulo technical-history (UPDATE sobre `historias_tecnicas`).
//
// Solo se permite actualizar `notas`. No hay create (lo hace un trigger) ni delete.
// RLS restringe el UPDATE a roles 'admin' y 'jefe_taller'; si el rol no aplica, la
// operación afecta 0 filas y se lanza RlsError (no se hardcodea el chequeo de rol aquí).

import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { unwrapWritten } from '@/lib/supabase/result'
import { validationErrorFromZod } from '@/lib/errors'
import {
  historiaUpdateSchema,
  type HistoriaTecnica,
  type HistoriaUpdateInput,
} from './types'

const COLUMNS = 'id, vehiculo_id, org_id, notas, creado_en, actualizado_en'

/** Actualiza las notas de una historia técnica. Requiere rol admin/jefe_taller (RLS). */
export async function updateHistoriaNotas(
  supabase: DbClient,
  id: string,
  input: HistoriaUpdateInput,
): Promise<HistoriaTecnica> {
  const parsed = historiaUpdateSchema.safeParse(input)
  if (!parsed.success) throw validationErrorFromZod(parsed.error.flatten())

  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('historias_tecnicas')
    .update({ notas: parsed.data.notas })
    .eq('org_id', orgId)
    .eq('id', id)
    .select(COLUMNS)

  return unwrapWritten<HistoriaTecnica>(data, error)
}
