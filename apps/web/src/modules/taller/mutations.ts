import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { mapPostgrestError, RlsError } from '@/lib/errors'
import type { ConfiguracionManoObra, ConfiguracionManoObraUpdate } from './types'

const COLUMNS =
  'org_id, valor_hora_mecanica, valor_hora_mantencion, valor_hora_diagnostico, valor_hora_electricidad, valor_hora_diesel, valor_alineacion_liviano, valor_alineacion_camioneta, valor_reprog_ecu_basica, valor_reprog_dpf_egr, valor_programacion_tpms, valor_rectificado_disco, valor_balanceo_rueda, valor_montaje_neumatico, moneda, iva_porcentaje, actualizado_en'

export async function updateConfiguracionManoObra(
  supabase: DbClient,
  campos: ConfiguracionManoObraUpdate,
): Promise<ConfiguracionManoObra> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('configuracion_mano_obra')
    .update(campos)
    .eq('org_id', orgId)
    .select(COLUMNS)

  if (error) throw mapPostgrestError(error)
  if (!data || data.length === 0) {
    throw new RlsError('No se pudo actualizar la configuración. Verifique permisos.')
  }
  return data[0] as ConfiguracionManoObra
}
