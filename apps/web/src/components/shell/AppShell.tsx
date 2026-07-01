// Shell del ERP: barra lateral (marca + navegación + logout) y área principal.
// Oscuro, sobrio, premium. Sin guard real aquí — el middleware protege las rutas.
import Link from 'next/link'
import { SidebarNav } from './SidebarNav'
import { LogoutButton } from '@/components/auth/LogoutButton'

interface AppShellProps {
  children: React.ReactNode
  pendientesCatalogo?: number
  rolUsuario?: string
}

export function AppShell({ children, pendientesCatalogo = 0, rolUsuario }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-neutral-900/30 px-4 py-5 md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-sm font-bold text-white">
            A
          </span>
          <span className="text-sm font-semibold tracking-tight text-neutral-100">
            All Motors <span className="text-neutral-500">Cloud</span>
          </span>
        </Link>

        <SidebarNav pendientesCatalogo={pendientesCatalogo} rolUsuario={rolUsuario} />

        <div className="mt-auto border-t border-white/[0.06] pt-4">
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 md:hidden">
          <Link href="/dashboard" className="text-sm font-semibold text-neutral-100">
            All Motors <span className="text-neutral-500">Cloud</span>
          </Link>
          <Link
            href="/recepcion"
            className="rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            + Recepción
          </Link>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7 md:px-8">{children}</main>
      </div>
    </div>
  )
}
