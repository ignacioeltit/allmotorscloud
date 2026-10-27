// Constantes del módulo customers (tabla `clientes`).
// Fieles a migration 002 — CHECK chk_clientes_tipo (extendido en migration 023).

export const TIPOS_CLIENTE = ['persona_natural', 'empresa', 'familia', 'mercado_publico', 'aseguradora'] as const
export type TipoCliente = (typeof TIPOS_CLIENTE)[number]

export const TIPO_CLIENTE_DEFAULT: TipoCliente = 'persona_natural'

/** Etiquetas legibles para el tipo de cliente. */
export const TIPO_CLIENTE_LABEL: Record<TipoCliente, string> = {
  persona_natural: 'Particular',
  empresa: 'Empresa',
  familia: 'Familia',
  mercado_publico: 'Mercado Público',
  aseguradora: 'Aseguradora',
}

/** Canal de adquisición del cliente ("¿cómo nos conoció?") — para marketing. */
export const CANALES_ADQUISICION = [
  'recomendacion',
  'google',
  'redes_sociales',
  'paso_por_fuera',
  'convenio_empresa',
  'cliente_recurrente',
  'publicidad',
  'otro',
] as const
export type CanalAdquisicion = (typeof CANALES_ADQUISICION)[number]

export const CANAL_ADQUISICION_LABEL: Record<CanalAdquisicion, string> = {
  recomendacion: 'Recomendación',
  google: 'Google / web',
  redes_sociales: 'Redes sociales',
  paso_por_fuera: 'Pasó por fuera',
  convenio_empresa: 'Convenio / empresa',
  cliente_recurrente: 'Cliente recurrente',
  publicidad: 'Publicidad',
  otro: 'Otro',
}

/** Tamaño de página por defecto para listados de clientes. */
export const CLIENTES_PAGE_SIZE = 50
