'use client'

// Navegación móvil: botón hamburguesa + drawer deslizable que reutiliza el
// mismo SidebarNav del escritorio. Se cierra al navegar, al tocar el fondo o Esc.
// Solo visible en móvil (el AppShell lo monta dentro del header `md:hidden`).

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SidebarNav } from './SidebarNav'
import { LogoutButton } from '@/components/auth/LogoutButton'

export function MobileNav({
  pendientesCatalogo = 0,
  rolUsuario,
}: {
  pendientesCatalogo?: number
  rolUsuario?: string
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setMounted(true) }, [])

  // Cerrar al navegar (cambia la ruta).
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Bloquear scroll del body y cerrar con Esc mientras está abierto.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        aria-expanded={open}
        className="-ml-1 inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-300 hover:bg-black/[0.06]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && mounted && createPortal(
        // Portal a document.body: escapa el `backdrop-blur` del header, que de
        // otro modo confina el `position: fixed` a la caja del header.
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Fondo */}
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          {/* Panel */}
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col border-r border-black/[0.08] bg-neutral-900 px-4 py-5 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-sm font-bold text-white">A</span>
                <span className="text-sm font-semibold tracking-tight text-neutral-100">
                  All Motors <span className="text-neutral-500">Cloud</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-black/[0.06]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <SidebarNav pendientesCatalogo={pendientesCatalogo} rolUsuario={rolUsuario} />
            </div>

            <div className="mt-4 border-t border-black/[0.06] pt-4">
              <LogoutButton />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
