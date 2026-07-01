// Constantes del módulo catálogo.

export const CATEGORIAS_CATALOGO = [
  'mecanica',
  'mantencion',
  'frenos',
  'neumaticos',
  'electronica',
  'diagnostico',
  'inspeccion',
  'transmision',
  'otro',
] as const

export type CategoriaCatalogo = (typeof CATEGORIAS_CATALOGO)[number]

export const CATEGORIA_LABEL: Record<CategoriaCatalogo, string> = {
  mecanica: 'Mecánica',
  mantencion: 'Mantención',
  frenos: 'Frenos',
  neumaticos: 'Neumáticos',
  electronica: 'Electrónica',
  diagnostico: 'Diagnóstico',
  inspeccion: 'Inspección',
  transmision: 'Transmisión',
  otro: 'Otro',
}

export const CATEGORIA_COLOR: Record<CategoriaCatalogo, string> = {
  mecanica:    'border-neutral-500/30 bg-neutral-500/10 text-neutral-400',
  mantencion:  'border-sky-500/30 bg-sky-500/10 text-sky-700',
  frenos:      'border-red-500/30 bg-red-500/10 text-red-700',
  neumaticos:  'border-amber-500/30 bg-amber-500/10 text-amber-700',
  electronica: 'border-violet-500/30 bg-violet-500/10 text-violet-700',
  diagnostico: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700',
  inspeccion:  'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  transmision: 'border-orange-500/30 bg-orange-500/10 text-orange-700',
  otro:        'border-black/10 bg-black/[0.04] text-neutral-500',
}
