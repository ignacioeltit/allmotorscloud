'use client'

// Buscador global (⌘K / Ctrl+K): busca vehículos, clientes y OTs y navega.
// CommandPalette se monta una vez (modal vía portal); CommandTrigger es el botón
// que lo abre (dispara un evento global).

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuthContext } from '@/lib/auth/context'
import { listVehiculos } from '@/modules/vehicles/queries'
import { listClientes } from '@/modules/customers/queries'

const EVENT = 'cmdk:open'

type Resultado = { kind: 'vehiculo' | 'cliente' | 'ot'; id: string; label: string; sub: string; href: string }
const KIND_LABEL: Record<Resultado['kind'], string> = { vehiculo: 'Vehículos', cliente: 'Clientes', ot: 'Órdenes' }
const KIND_ICON: Record<Resultado['kind'], string> = { vehiculo: '🚗', cliente: '👤', ot: '🔧' }

export function CommandTrigger({ compact = false }: { compact?: boolean }) {
  const abrir = () => window.dispatchEvent(new CustomEvent(EVENT))
  if (compact) {
    return (
      <button
        type="button"
        onClick={abrir}
        aria-label="Buscar"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-black/[0.06] hover:text-neutral-200"
      >
        🔍
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={abrir}
      className="mb-4 flex w-full items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-neutral-500 hover:bg-black/[0.06]"
    >
      <span>🔍</span>
      <span className="flex-1 text-left">Buscar…</span>
      <kbd className="rounded border border-black/10 bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">⌘K</kbd>
    </button>
  )
}

export function CommandPalette() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [cargando, setCargando] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(EVENT, onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQ('')
      setResultados([])
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const term = q.trim()
    if (timer.current) clearTimeout(timer.current)
    if (term.length < 2) {
      setResultados([])
      return
    }
    timer.current = setTimeout(async () => {
      setCargando(true)
      try {
        const sb = createClient()
        const { orgId } = await getAuthContext(sb)
        const [vehs, clis, otRes] = await Promise.all([
          listVehiculos(sb, { search: term, limit: 5 }),
          listClientes(sb, { search: term, limit: 5 }),
          sb
            .from('ordenes_trabajo')
            .select('id, numero_ot, vehiculos(patente)')
            .eq('org_id', orgId)
            .ilike('numero_ot', `%${term}%`)
            .is('eliminado_en', null)
            .limit(5),
        ])
        type OtRow = { id: string; numero_ot: string; vehiculos: { patente: string } | null }
        const res: Resultado[] = [
          ...vehs.map((v) => ({ kind: 'vehiculo' as const, id: v.id, label: v.patente, sub: `${v.marca} ${v.modelo}`, href: `/vehicles/${v.id}` })),
          ...clis.map((c) => ({ kind: 'cliente' as const, id: c.id, label: c.nombre, sub: c.rut ?? c.telefono ?? '', href: `/customers/${c.id}` })),
          ...(((otRes.data ?? []) as unknown as OtRow[]).map((o) => ({ kind: 'ot' as const, id: o.id, label: o.numero_ot, sub: o.vehiculos?.patente ?? '', href: `/repair-orders/${o.id}` }))),
        ]
        setResultados(res)
      } catch {
        setResultados([])
      } finally {
        setCargando(false)
      }
    }, 250)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [q, open])

  function ir(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      {mounted && open
        ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-black/10 bg-neutral-900 shadow-2xl shadow-black/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-black/[0.06] px-4">
          <span className="text-neutral-500">🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && resultados[0]) ir(resultados[0].href)
            }}
            placeholder="Buscar patente, cliente, RUT, N° de OT…"
            className="w-full bg-transparent py-3.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
          />
          <kbd className="rounded border border-black/10 bg-black/[0.04] px-1.5 py-0.5 text-[10px] text-neutral-500">esc</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {q.trim().length < 2 ? (
            <p className="px-3 py-6 text-center text-xs text-neutral-500">Escribe al menos 2 letras…</p>
          ) : cargando ? (
            <p className="px-3 py-6 text-center text-xs text-neutral-500">Buscando…</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-neutral-500">Sin resultados.</p>
          ) : (
            (['vehiculo', 'cliente', 'ot'] as const).map((kind) => {
              const items = resultados.filter((r) => r.kind === kind)
              if (items.length === 0) return null
              return (
                <div key={kind} className="mb-1">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{KIND_LABEL[kind]}</p>
                  {items.map((r) => (
                    <button
                      key={`${r.kind}-${r.id}`}
                      type="button"
                      onClick={() => ir(r.href)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-black/[0.05]"
                    >
                      <span>{KIND_ICON[r.kind]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-100">{r.label}</span>
                        {r.sub && <span className="block truncate text-xs text-neutral-500">{r.sub}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>,
            document.body,
          )
        : null}
    </>
  )
}
