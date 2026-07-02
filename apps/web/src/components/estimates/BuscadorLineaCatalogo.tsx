'use client'

// Input de descripción con autocompletado desde el catálogo. Según el grupo,
// busca en servicios (mano de obra) o en repuestos (materiales). Al elegir una
// sugerencia, rellena descripción + precio. Permite texto libre si no hay match.

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { searchRepuestos } from '@/modules/inventory/queries'
import { buscarServiciosCatalogo } from '@/modules/catalogo/queries'

export interface SugerenciaCatalogo {
  descripcion: string
  precio: number | null
  detalle: string
}

async function buscar(grupo: 'mano_obra' | 'repuesto', q: string): Promise<SugerenciaCatalogo[]> {
  const supabase = createClient()
  if (grupo === 'repuesto') {
    const rows = await searchRepuestos(supabase, q)
    return rows.map((r) => ({
      descripcion: r.nombre,
      precio: r.precio_venta,
      detalle: [r.codigo, r.stock_actual != null ? `stock ${r.stock_actual}` : null].filter(Boolean).join(' · '),
    }))
  }
  const rows = await buscarServiciosCatalogo(supabase, q)
  return rows.map((s) => ({
    descripcion: s.nombre,
    precio: s.precio_unitario,
    detalle: [s.codigo, s.categoria].filter(Boolean).join(' · '),
  }))
}

export function BuscadorLineaCatalogo({
  grupo,
  value,
  onChangeText,
  onPick,
  className,
  placeholder,
}: {
  grupo: 'mano_obra' | 'repuesto'
  value: string
  onChangeText: (text: string) => void
  onPick: (s: SugerenciaCatalogo) => void
  className: string
  placeholder?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [sugerencias, setSugerencias] = useState<SugerenciaCatalogo[]>([])
  const [buscando, setBuscando] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function onChange(text: string) {
    onChangeText(text)
    if (timer.current) clearTimeout(timer.current)
    const q = text.trim()
    if (q.length < 2) {
      setSugerencias([])
      setAbierto(false)
      return
    }
    timer.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await buscar(grupo, q)
        setSugerencias(res)
        setAbierto(res.length > 0)
      } catch {
        /* búsqueda silenciosa */
      } finally {
        setBuscando(false)
      }
    }, 250)
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (sugerencias.length > 0) setAbierto(true) }}
        autoComplete="off"
      />
      {abierto && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-lg border border-black/10 bg-neutral-900 shadow-xl shadow-black/20">
          {sugerencias.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onPick(s)
                  setAbierto(false)
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-black/[0.04]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-neutral-200">{s.descripcion}</span>
                  {s.detalle && <span className="block truncate text-[11px] text-neutral-500">{s.detalle}</span>}
                </span>
                {s.precio != null && (
                  <span className="shrink-0 text-xs font-medium text-neutral-400">
                    {s.precio.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
                  </span>
                )}
              </button>
            </li>
          ))}
          {buscando && <li className="px-3 py-2 text-xs text-neutral-500">Buscando…</li>}
        </ul>
      )}
    </div>
  )
}
