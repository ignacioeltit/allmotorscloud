// Constantes del módulo customers (tabla `clientes`).
// Fieles a migration 002 — CHECK chk_clientes_tipo.

export const TIPOS_CLIENTE = ['persona_natural', 'empresa', 'aseguradora'] as const
export type TipoCliente = (typeof TIPOS_CLIENTE)[number]

export const TIPO_CLIENTE_DEFAULT: TipoCliente = 'persona_natural'

/** Etiquetas legibles para el tipo de cliente. */
export const TIPO_CLIENTE_LABEL: Record<TipoCliente, string> = {
  persona_natural: 'Persona natural',
  empresa: 'Empresa',
  aseguradora: 'Aseguradora',
}

/** Tamaño de página por defecto para listados de clientes. */
export const CLIENTES_PAGE_SIZE = 50
