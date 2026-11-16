// Shell del ERP: barra lateral (marca + navegación + logout) y área principal.
// Oscuro, sobrio, premium. Sin guard real aquí — el middleware protege las rutas.
import Link from 'next/link'
import { SidebarNav } from './SidebarNav'
import { MobileNav } from './MobileNav'
import { CommandPalette, CommandTrigger } from './CommandPalette'
import { LogoutButton } from '@/components/auth/LogoutButton'

interface AppShellProps {
  children: React.ReactNode
  pendientesCatalogo?: number
  rolUsuario?: string
}

export function AppShell({ children, pendientesCatalogo = 0, rolUsuario }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-[#1c1f24] via-[#16181c] to-[#101114] px-4 py-5 shadow-xl shadow-black/20 md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-3 px-1.5">
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-black ring-1 ring-white/10 shadow-md shadow-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-allmotors.jpg" alt="All Motors" className="h-full w-full object-contain" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight text-white">All Motors</span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400">Cloud</span>
          </span>
        </Link>

        <CommandTrigger />

        {/* El menú hace scroll por dentro; "Cerrar sesión" queda siempre visible
            abajo (antes se salía de la pantalla en notebooks). */}
        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 pb-2">
          <SidebarNav pendientesCatalogo={pendientesCatalogo} rolUsuario={rolUsuario} />
        </div>

        <div className="shrink-0 border-t border-white/[0.08] pt-4">
          <LogoutButton tono="oscuro" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b-2 border-orange-500 bg-[#16181c]/95 px-3 py-2.5 text-white backdrop-blur md:hidden">
          <div className="flex min-w-0 items-center gap-1">
            <MobileNav pendientesCatalogo={pendientesCatalogo} rolUsuario={rolUsuario} />
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
              <span className="h-7 w-7 shrink-0 overflow-hidden rounded-md bg-black ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-allmotors.jpg" alt="All Motors" className="h-full w-full object-contain" />
              </span>
              <span className="truncate">
                All Motors <span className="text-orange-400">Cloud</span>
              </span>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <CommandTrigger compact />
            <Link
              href="/recepcion"
              className="whitespace-nowrap rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-orange-900/40"
            >
              + Recepción
            </Link>
          </div>
        </header>

        <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-5 sm:py-7 md:px-8">{children}</main>
      </div>

      <CommandPalette />
    </div>
  )
}
