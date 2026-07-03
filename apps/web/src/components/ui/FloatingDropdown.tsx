'use client'

// Dropdown flotante que escapa cualquier ancestro con overflow (scroll horizontal
// de tablas, etc.). Un `position: absolute` dentro de un contenedor con
// overflow-x-auto se recorta: por spec CSS, overflow-x distinto de 'visible'
// fuerza overflow-y a 'auto' también, cortando cualquier hijo posicionado que
// se salga de la caja (ej: el listado de sugerencias del catálogo, inclicable
// en varias filas de la ficha de ingreso). Este componente renderiza el panel
// en un portal a document.body con `position: fixed`, calculado desde el
// bounding rect del elemento ancla.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function FloatingDropdown({
  anchorRef,
  panelRef,
  open,
  children,
  minWidth = 288,
}: {
  // Tipados laxos a propósito: el monorepo tiene dos versiones de @types/react
  // (apps/mechanic fija v18, apps/web usa v19) y RefObject/ReactNode no
  // unifican entre ellas al pasar por los límites de este componente.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  anchorRef: React.RefObject<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  panelRef?: React.RefObject<any>
  open: boolean
  children: React.ReactNode
  minWidth?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    if (!open || !anchorRef.current) return
    function update() {
      const r = anchorRef.current?.getBoundingClientRect()
      if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, anchorRef])

  if (!open || !rect || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        width: Math.max(rect.width, minWidth),
        zIndex: 9999,
      }}
      className="overflow-hidden rounded-lg border border-black/10 bg-neutral-900 shadow-xl shadow-black/20"
    >
      {children}
    </div>,
    document.body,
  )
}
