'use client'

// Navegación lateral del ERP (barra oscura grafito) con resaltado de ruta activa.
// Los ítems, colores por sección y roles viven en ./nav.ts.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { navItemsParaRol, TONO_CHIP } from './nav'

function Icon({ name }: { name: string }) {
  const common = {
    width: 16,
    height: 16,
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
  if (name === 'chart')
    return (
      <svg {...common}>
        <path d="M3 3v18h18" />
        <rect x="7" y="12" width="3" height="6" rx="0.5" />
        <rect x="12" y="8" width="3" height="10" rx="0.5" />
        <rect x="17" y="5" width="3" height="13" rx="0.5" />
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
  if (name === 'cart')
    return (
      <svg {...common}>
        <circle cx="8" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
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

  return (
    <nav className="flex flex-col gap-0.5">
      <Link
        href="/recepcion"
        className={`mb-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-900/40 ring-1 ring-inset ring-white/15 transition hover:from-orange-400 hover:to-orange-500 ${
          receptionActive ? 'ring-2 ring-orange-300/70' : ''
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Nueva Recepción
      </Link>

      {navItemsParaRol(rolUsuario).map((item) => {
        const active = isActive(item.href)
        const showBadge = item.href === '/catalogo' && pendientesCatalogo > 0

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-white/[0.08] text-white'
                : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
            }`}
          >
            {active && (
              <span className="absolute -left-4 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-orange-500" aria-hidden />
            )}
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset transition ${
                TONO_CHIP[item.tono]
              } ${active ? '' : 'opacity-80 group-hover:opacity-100'}`}
            >
              <Icon name={item.icon} />
            </span>
            <span className="flex-1">{item.label}</span>
            {showBadge && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-amber-950">
                {pendientesCatalogo > 99 ? '99+' : pendientesCatalogo}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
