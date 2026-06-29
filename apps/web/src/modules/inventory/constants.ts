export const TIPOS_MOVIMIENTO = ['entrada', 'salida', 'ajuste', 'consumo_ot', 'devolucion'] as const

export const TIPO_MOVIMIENTO_LABEL: Record<string, string> = {
  entrada:     'Entrada',
  salida:      'Salida',
  ajuste:      'Ajuste',
  consumo_ot:  'Consumo OT',
  devolucion:  'Devolución',
}

export const UNIDADES_MEDIDA = [
  'unidad', 'litro', 'metro', 'kg', 'gramo', 'par', 'juego', 'caja', 'rollo',
] as const

export const UNIDADES_MEDIDA_LABEL: Record<string, string> = {
  unidad:  'Unidad',
  litro:   'Litro',
  metro:   'Metro',
  kg:      'Kilogramo',
  gramo:   'Gramo',
  par:     'Par',
  juego:   'Juego',
  caja:    'Caja',
  rollo:   'Rollo',
}

export const CATEGORIAS_REPUESTO = [
  'aceites_lubricantes',
  'frenos',
  'suspension',
  'motor',
  'electrico',
  'carroceria',
  'filtros',
  'neumaticos',
  'transmision',
  'refrigeracion',
  'otros',
] as const

export const CATEGORIA_LABEL: Record<string, string> = {
  aceites_lubricantes: 'Aceites y lubricantes',
  frenos:              'Frenos',
  suspension:          'Suspensión',
  motor:               'Motor',
  electrico:           'Eléctrico',
  carroceria:          'Carrocería',
  filtros:             'Filtros',
  neumaticos:          'Neumáticos',
  transmision:         'Transmisión',
  refrigeracion:       'Refrigeración',
  otros:               'Otros',
}

export const ESTADO_STOCK_LABEL: Record<string, string> = {
  en_stock:   'En stock',
  bajo_stock: 'Bajo stock',
  sin_stock:  'Sin stock',
}

export const ESTADO_STOCK_CLASS: Record<string, string> = {
  en_stock:   'border-green-500/25 bg-green-500/10 text-green-400',
  bajo_stock: 'border-yellow-500/25 bg-yellow-500/10 text-yellow-400',
  sin_stock:  'border-red-500/25 bg-red-500/10 text-red-400',
}
