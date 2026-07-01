import type { DbClient } from '@/lib/supabase/types'
import { getAuthContext } from '@/lib/auth/context'
import { mapPostgrestError } from '@/lib/errors'
import type { ConfiguracionManoObra } from './types'

const COLUMNS =
  'org_id, valor_hora_mecanica, valor_hora_mantencion, valor_hora_diagnostico, valor_hora_electricidad, valor_hora_diesel, valor_alineacion_liviano, valor_alineacion_camioneta, valor_reprog_ecu_basica, valor_reprog_dpf_egr, valor_programacion_tpms, valor_rectificado_disco, valor_balanceo_rueda, valor_montaje_neumatico, moneda, iva_porcentaje, actualizado_en'

function defaultConfig(orgId: string): ConfiguracionManoObra {
  return {
    org_id:                   orgId,
    valor_hora_mecanica:      29412,
    valor_hora_mantencion:    28500,
    valor_hora_diagnostico:   29412,
    valor_hora_electricidad:  29412,
    valor_hora_diesel:        29412,
    valor_alineacion_liviano:   12605,
    valor_alineacion_camioneta: 16807,
    valor_reprog_ecu_basica:    400000,
    valor_reprog_dpf_egr:       100000,
    valor_programacion_tpms:    35000,
    valor_rectificado_disco:    8403,
    valor_balanceo_rueda:       4980,
    valor_montaje_neumatico:    4697,
    moneda:        'CLP',
    iva_porcentaje: 19,
    actualizado_en: new Date().toISOString(),
  }
}

export async function getConfiguracionManoObra(
  supabase: DbClient,
): Promise<ConfiguracionManoObra> {
  const { orgId } = await getAuthContext(supabase)

  const { data, error } = await supabase
    .from('configuracion_mano_obra')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) throw mapPostgrestError(error)

  // Si no existe fila, retornar defaults. Ocurre en orgs creadas antes de M005
  // o en ambientes de test sin seed. Los valores defaults son los reales de TallerGP.
  return (data as ConfiguracionManoObra | null) ?? defaultConfig(orgId)
}
