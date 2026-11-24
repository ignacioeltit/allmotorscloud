// Ítems de la navegación lateral: ruta, ícono, color de sección y roles.
//
// Cada sección tiene su color (chip del ícono) para reconocerla de un vistazo.
// Las clases van completas y literales para que Tailwind las incluya.

export type Tono =
  | 'orange' | 'amber' | 'sky' | 'violet' | 'blue' | 'teal'
  | 'emerald' | 'indigo' | 'fuchsia' | 'rose' | 'cyan' | 'slate'

export interface NavItem {
  href: string
  label: string
  icon: string
  tono: Tono
  /** Roles que ven el ítem. Sin lista = todos. */
  roles?: readonly string[]
}

const GESTION = ['admin', 'jefe_taller', 'recepcionista'] as const
const CONFIG = ['admin', 'jefe_taller'] as const

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard',         label: 'Dashboard',     icon: 'grid',     tono: 'orange' },
  { href: '/tablero',           label: 'Tablero',       icon: 'layers',   tono: 'amber' },
  { href: '/agenda',            label: 'Agenda',        icon: 'calendar', tono: 'sky' },
  { href: '/customers',         label: 'Clientes',      icon: 'users',    tono: 'violet' },
  { href: '/vehicles',          label: 'Vehículos',     icon: 'car',      tono: 'blue' },
  { href: '/repair-orders',     label: 'Órdenes',       icon: 'wrench',   tono: 'orange' },
  { href: '/estimates',         label: 'Presupuestos',  icon: 'file',     tono: 'teal' },
  { href: '/inventory',         label: 'Inventario',    icon: 'package',  tono: 'emerald' },
  { href: '/catalogo',          label: 'Catálogo',      icon: 'catalog',  tono: 'indigo' },
  { href: '/catalogo/paquetes', label: 'Paquetes',      icon: 'layers',   tono: 'fuchsia' },
  { href: '/pos',               label: 'Mostrador',     icon: 'cart',     tono: 'rose',    roles: GESTION },
  { href: '/finanzas',          label: 'Finanzas',      icon: 'wallet',   tono: 'emerald', roles: GESTION },
  { href: '/reports',           label: 'Reportes',      icon: 'chart',    tono: 'cyan',    roles: GESTION },
  { href: '/settings/equipo',   label: 'Equipo y usuarios', icon: 'users', tono: 'violet',  roles: CONFIG },
  { href: '/settings/empresa',  label: 'Empresa',       icon: 'building', tono: 'slate',   roles: ['admin'] },
  { href: '/settings/workshop', label: 'Configuración', icon: 'settings', tono: 'slate',   roles: CONFIG },
]

/** Ítems visibles para un rol. */
export function navItemsParaRol(rol: string | undefined): NavItem[] {
  return NAV_ITEMS.filter((i) => !i.roles || (rol != null && i.roles.includes(rol)))
}

/** Clases del chip del ícono por tono (sobre la barra oscura). */
export const TONO_CHIP: Record<Tono, string> = {
  orange:  'bg-orange-500/15 text-orange-300 ring-orange-400/20',
  amber:   'bg-amber-500/15 text-amber-300 ring-amber-400/20',
  sky:     'bg-sky-500/15 text-sky-300 ring-sky-400/20',
  violet:  'bg-violet-500/15 text-violet-300 ring-violet-400/20',
  blue:    'bg-blue-500/15 text-blue-300 ring-blue-400/20',
  teal:    'bg-teal-500/15 text-teal-300 ring-teal-400/20',
  emerald: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/20',
  indigo:  'bg-indigo-500/15 text-indigo-300 ring-indigo-400/20',
  fuchsia: 'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/20',
  rose:    'bg-rose-500/15 text-rose-300 ring-rose-400/20',
  cyan:    'bg-cyan-500/15 text-cyan-300 ring-cyan-400/20',
  slate:   'bg-slate-400/15 text-slate-300 ring-slate-300/20',
}
