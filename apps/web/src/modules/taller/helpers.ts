import type { ConfiguracionManoObra } from './types'

/**
 * Devuelve el valor hora correspondiente a la categoría del servicio.
 * Si la categoría no tiene una tarifa específica, usa valor_hora_mecanica.
 */
export function getValorHoraForServicio(
  config: ConfiguracionManoObra,
  categoria: string | null,
): number {
  switch (categoria) {
    case 'mantencion':    return config.valor_hora_mantencion
    case 'diagnostico':   return config.valor_hora_diagnostico
    case 'electricidad':  return config.valor_hora_electricidad
    case 'diesel':        return config.valor_hora_diesel
    default:              return config.valor_hora_mecanica
  }
}
