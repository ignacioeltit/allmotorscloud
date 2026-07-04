'use client'

// Pestañas de la ficha de OT. Recibe cada bloque YA renderizado en el servidor
// como `content` (los componentes de sección no cambian, solo se reparten).
// La pestaña activa queda en la URL (?tab=…) sin refetch, así sobrevive a los
// router.refresh() que dispara la app al guardar.

import { useState } from 'react'

export interface OtTab {
  id: string
  label: string
  /** Contador opcional (ej. n° de trabajos). */
  badge?: string | number | null
  /** Punto de atención (ej. presupuesto por autorizar / listo para entrega). */
  alert?: boolean
  // Tipado laxo a propósito: el monorepo tiene dos versiones de @types/react
  // (apps/mechanic v18, apps/web v19) y ReactNode no unifica al cruzar el
  // límite de este componente. Mismo patrón que FloatingDropdown.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any
}

export function OtTabs({ tabs, initial }: { tabs: OtTab[]; initial?: string }) {
  const first = tabs[0]!
  const valido = initial && tabs.some((t) => t.id === initial) ? initial : first.id
  const [active, setActive] = useState(valido)

  function select(id: string) {
    setActive(id)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', id)
      window.history.replaceState(null, '', url)
    }
  }

  const activa = tabs.find((t) => t.id === active) ?? first

  return (
    <div className="space-y-5">
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-black/[0.08]">
        {tabs.map((t) => {
          const on = t.id === active
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => select(t.id)}
              className={`relative -mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                on
                  ? 'border-accent-500 text-neutral-50'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {t.label}
              {t.badge != null && t.badge !== '' && (
                <span className="rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400">
                  {t.badge}
                </span>
              )}
              {t.alert && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />}
            </button>
          )
        })}
      </div>
      <div role="tabpanel">{activa.content}</div>
    </div>
  )
}
