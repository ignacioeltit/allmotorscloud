'use client'

// Navegación lateral del ERP con resaltado de ruta activa.
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { href: '/customers', label: 'Clientes', icon: 'users' },
  { href: '/vehicles', label: 'Vehículos', icon: 'car' },
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
  return null
}

export function SidebarNav() {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const receptionActive = pathname.startsWith('/recepcion') || pathname.startsWith('/reception')

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
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-white/[0.07] text-neutral-50'
                : 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200'
            }`}
          >
            <span className={active ? 'text-accent-400' : 'text-neutral-500'}>
              <Icon name={item.icon} />
            </span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
