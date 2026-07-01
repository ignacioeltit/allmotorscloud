'use client'

// Envoltorio cliente para listados server-side con búsqueda y paginación por URL
// (?search=&page=). La tabla llega como children desde el Server Component; acá
// solo vive el input con debounce, la barra de paginación y el dimming al navegar.

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { inputClass, btnSecondary } from '@/components/ui/styles'

interface BusquedaPaginadaProps {
  total: number
  currentPage: number
  totalPages: number
  pageSize: number
  initialSearch: string
  placeholder: string
  children: ReactNode
}

export function BusquedaPaginada({
  total,
  currentPage,
  totalPages,
  pageSize,
  initialSearch,
  placeholder,
  children,
}: BusquedaPaginadaProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [inputValue, setInputValue] = useState(initialSearch)
  const [navigating, setNavigating] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setInputValue(initialSearch)
  }, [initialSearch])

  // Quitar dimming cuando el servidor entrega la página nueva
  useEffect(() => {
    setNavigating(false)
  }, [children])

  const navigate = useCallback(
    (search: string, page: number) => {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (page > 1) params.set('page', String(page))
      const qs = params.toString()
      setNavigating(true)
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`)
    },
    [router, pathname],
  )

  function handleSearchChange(value: string) {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => navigate(value, 1), 300)
  }

  const from = Math.min((currentPage - 1) * pageSize + 1, total)
  const to = Math.min(currentPage * pageSize, total)

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          className={inputClass}
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        {navigating && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 animate-pulse text-xs text-neutral-500">
            Buscando…
          </span>
        )}
      </div>

      <div className={`transition-opacity duration-150 ${navigating ? 'pointer-events-none opacity-40' : 'opacity-100'}`}>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            {initialSearch ? (
              <>Sin resultados para <span className="font-mono text-neutral-300">{initialSearch}</span>.</>
            ) : (
              'Aún no hay registros.'
            )}
          </p>
        ) : (
          <>
            {children}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.05] pt-4">
              <p className="text-xs text-neutral-500">
                Mostrando {from}–{to} de {total.toLocaleString('es-CL')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(inputValue, currentPage - 1)}
                  disabled={currentPage <= 1 || navigating}
                  className={`${btnSecondary} px-3 py-1.5 text-xs disabled:opacity-30`}
                >
                  ← Anterior
                </button>
                <span className="min-w-[4rem] text-center text-xs text-neutral-400">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => navigate(inputValue, currentPage + 1)}
                  disabled={currentPage >= totalPages || navigating}
                  className={`${btnSecondary} px-3 py-1.5 text-xs disabled:opacity-30`}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
