// Constantes del módulo vehicles (tabla `vehiculos`).
// Fieles a migration 002 — CHECK chk_vehiculos_tipo.

export const TIPOS_VEHICULO = [
  'auto',
  'camioneta',
  'moto',
  'furgon',
  'camion',
  'otro',
] as const
export type TipoVehiculo = (typeof TIPOS_VEHICULO)[number]

export const TIPO_VEHICULO_DEFAULT: TipoVehiculo = 'auto'

/** Año mínimo aceptado para `anio`. */
export const ANIO_VEHICULO_MIN = 1900

/** Tamaño de página por defecto para listados de vehículos. */
export const VEHICULOS_PAGE_SIZE = 50
