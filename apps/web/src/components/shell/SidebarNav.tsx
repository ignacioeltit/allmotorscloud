'use client'

// Navegación lateral del ERP con resaltado de ruta activa.
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/dashboard',   label: 'Dashboard',    icon: 'grid' },
  { href: '/agenda',      label: 'Agenda',       icon: 'calendar' },
  { href: '/customers',   label: 'Clientes',     icon: 'users' },
  { href: '/vehicles',    label: 'Vehículos',    icon: 'car' },
  { href: '/repair-orders', label: 'Órdenes',    icon: 'wrench' },
  { href: '/estimates',   label: 'Presupuestos', icon: 'file' },
  { href: '/inventory',   label: 'Inventario',   icon: 'package' },
  { href: '/catalogo',    label: 'Catálogo',     icon: 'catalog' },
  { href: '/catalogo/paquetes', label: 'Paquetes', icon: 'layers' },
] as const

function Icon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (name === 'grid')
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    )
  if (name === 'wallet')
    return (
      <svg {...common}>
        <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
        <path d="M21 7H7a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h14v-4z" />
        <circle cx="16" cy="11" r="1" />
      </svg>
    )
  if (name === 'layers')
    return (
      <svg {...common}>
        <path d="M12 2 2 7l10 5 10-5-10-5z" />
        <path d="m2 17 10 5 10-5" />
        <path d="m2 12 10 5 10-5" />
      </svg>
    )
  if (name === 'calendar')
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    )
  if (name === 'users')
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    )
  if (name === 'car')
    return (
      <svg {...common}>
        <path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13" />
        <path d="M5 13h14a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1" />
        <path d="M6 18H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1" />
        <circle cx="7.5" cy="18" r="1.5" />
        <circle cx="16.5" cy="18" r="1.5" />
      </svg>
    )
  if (name === 'package')
    return (
      <svg {...common}>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    )
  if (name === 'file')
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h8" />
        <path d="M8 9h2" />
      </svg>
    )
  if (name === 'catalog')
    return (
      <svg {...common}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
        <path d="M8 15h5" />
      </svg>
    )
  if (name === 'wrench')
    return (
      <svg {...common}>
        <path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6-2-.4-.4-2 2.6-2.6z" />
      </svg>
    )
  if (name === 'building')
    return (
      <svg {...common}>
        <path d="M3 21h18" />
        <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
        <path d="M9 7h1M9 11h1M9 15h1M14 7h1M14 11h1M14 15h1" />
      </svg>
    )
  if (name === 'settings')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    )
  return null
}

interface SidebarNavProps {
  pendientesCatalogo?: number
  rolUsuario?: string
}

export function SidebarNav({ pendientesCatalogo = 0, rolUsuario }: SidebarNavProps) {
  const pathname = usePathname()
  // 'Catálogo' no se marca activo cuando el activo es su sub-ruta 'Paquetes'
  // (ambos viven en el menú; el prefijo /catalogo/ matchearía los dos).
  const isActive = (href: string) => {
    if (href === '/catalogo' && pathname.startsWith('/catalogo/paquetes')) return false
    return pathname === href || pathname.startsWith(`${href}/`)
  }
  const receptionActive = pathname.startsWith('/recepcion') || pathname.startsWith('/reception')
  const canConfig = rolUsuario === 'admin' || rolUsuario === 'jefe_taller'
  const canFinanzas = canConfig || rolUsuario === 'recepcionista'
  const canEmpresa = rolUsuario === 'admin'

  return (
    <nav className="flex flex-col gap-1">
      <Link
        href="/recepcion"
        className={`mb-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
          receptionActive
            ? 'bg-accent-500 text-white'
            : 'bg-accent-600 text-white hover:bg-accent-500'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Nueva Recepción
      </Link>

      {items.map((item) => {
        const active = isActive(item.href)
        const isCatalogo = item.href === '/catalogo'
        const showBadge = isCatalogo && pendientesCatalogo > 0

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-black/[0.07] text-neutral-50'
                : 'text-neutral-400 hover:bg-black/[0.04] hover:text-neutral-200'
            }`}
          >
            <span className={active ? 'text-accent-400' : 'text-neutral-500'}>
              <Icon name={item.icon} />
            </span>
            <span className="flex-1">{item.label}</span>
            {showBadge && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-700">
                {pendientesCatalogo > 99 ? '99+' : pendientesCatalogo}
              </span>
            )}
          </Link>
        )
      })}

      {canFinanzas && (() => {
        const active = isActive('/finanzas')
        return (
          <Link
            href="/finanzas"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-black/[0.07] text-neutral-50'
                : 'text-neutral-400 hover:bg-black/[0.04] hover:text-neutral-200'
            }`}
          >
            <span className={active ? 'text-accent-400' : 'text-neutral-500'}>
              <Icon name="wallet" />
            </span>
            Finanzas
          </Link>
        )
      })()}

      {canConfig && (() => {
        const active = isActive('/settings/equipo')
        return (
          <Link
            href="/settings/equipo"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-black/[0.07] text-neutral-50'
                : 'text-neutral-400 hover:bg-black/[0.04] hover:text-neutral-200'
            }`}
          >
            <span className={active ? 'text-accent-400' : 'text-neutral-500'}>
              <Icon name="users" />
            </span>
            Equipo
          </Link>
        )
      })()}

      {canEmpresa && (() => {
        const active = isActive('/settings/empresa')
        return (
          <Link
            href="/settings/empresa"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-black/[0.07] text-neutral-50'
                : 'text-neutral-400 hover:bg-black/[0.04] hover:text-neutral-200'
            }`}
          >
            <span className={active ? 'text-accent-400' : 'text-neutral-500'}>
              <Icon name="building" />
            </span>
            Empresa
          </Link>
        )
      })()}

      {canConfig && (() => {
        const active = isActive('/settings/workshop')
        return (
          <Link
            href="/settings/workshop"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-black/[0.07] text-neutral-50'
                : 'text-neutral-400 hover:bg-black/[0.04] hover:text-neutral-200'
            }`}
          >
            <span className={active ? 'text-accent-400' : 'text-neutral-500'}>
              <Icon name="settings" />
            </span>
            Configuración
          </Link>
        )
      })()}
    </nav>
  )
}
