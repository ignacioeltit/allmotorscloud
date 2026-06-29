// Layout del ERP del taller (grupo de ruta `(taller)`).
// Navegación mínima + contenedor. El middleware (src/middleware.ts) protege estas
// rutas redirigiendo a /login si no hay sesión; RLS es la barrera real de datos.
import Link from 'next/link'
import { LogoutButton } from '@/components/auth/LogoutButton'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/customers', label: 'Clientes' },
  { href: '/vehicles', label: 'Vehículos' },
]

export default function TallerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/dashboard" className="text-sm font-semibold text-brand-700">
            All Motors Cloud
          </Link>
          <nav className="flex gap-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-neutral-600 hover:text-brand-600"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
