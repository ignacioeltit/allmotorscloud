'use client'

// Propietario del vehículo: muestra el dueño actual y permite asignarlo o
// cambiarlo buscando un cliente. Usa asignarPropietario (cierra al dueño
// anterior y registra el nuevo). Solo gestión (RLS: admin/jefe/recepcionista).

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { listClientes } from '@/modules/customers/queries'
import { asignarPropietario } from '@/modules/customers/mutations'
import type { Cliente } from '@/modules/customers/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, btnSecondary, linkClass } from '@/components/ui/styles'

export function AsignarPropietario({
  vehiculoId,
  propietarioActual,
  puedeGestionar,
}: {
  vehiculoId: string
  propietarioActual: { id: string; nombre: string } | null
  puedeGestionar: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<Cliente[]>([])
  const [buscando, setBuscando] = useState(false)
  const [asignando, setAsignando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!abierto) return
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) { setResultados([]); return }
    setBuscando(true)
    timer.current = setTimeout(async () => {
      try {
        const rows = await listClientes(createClient(), { search: q.trim(), limit: 8 })
        setResultados(rows)
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [q, abierto])

  async function asignar(cliente: Cliente) {
    setAsignando(true)
    setError(null)
    try {
      await asignarPropietario(createClient(), { vehiculoId, clienteId: cliente.id })
      setAbierto(false)
      setQ('')
      setResultados([])
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setAsignando(false)
    }
  }

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={sectionLabel}>Propietario</p>
        {puedeGestionar && !abierto && (
          <button type="button" className={btnSecondary} onClick={() => setAbierto(true)}>
            {propietarioActual ? 'Cambiar propietario' : 'Asignar propietario'}
          </button>
        )}
      </div>

      <div className="mt-3">
        {propietarioActual ? (
          <Link href={`/customers/${propietarioActual.id}`} className={`${linkClass} text-base font-medium`}>
            {propietarioActual.nombre}
          </Link>
        ) : (
          <p className="text-sm text-amber-700">Sin propietario asignado.</p>
        )}
      </div>

      {abierto && (
        <div className="mt-4 space-y-2 border-t border-black/[0.06] pt-4">
          <input
            autoFocus
            className={inputClass}
            placeholder="Buscar cliente por nombre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={asignando}
          />
          {buscando && <p className="text-xs text-neutral-500">Buscando…</p>}
          {resultados.length > 0 && (
            <ul className="divide-y divide-black/[0.05] overflow-hidden rounded-lg border border-black/[0.06]">
              {resultados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void asignar(c)}
                    disabled={asignando}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-black/[0.03] disabled:opacity-50"
                  >
                    <span className="text-sm text-neutral-200">{c.nombre}</span>
                    <span className="text-xs text-neutral-500">{c.rut ?? c.telefono ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && !buscando && resultados.length === 0 && (
            <p className="text-xs text-neutral-500">
              Sin resultados. Si el cliente no existe,{' '}
              <Link href="/customers/new" className={linkClass}>créalo primero</Link>.
            </p>
          )}
          <button type="button" onClick={() => { setAbierto(false); setQ('') }} className="text-xs text-neutral-500 hover:text-neutral-300">
            Cancelar
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  )
}
