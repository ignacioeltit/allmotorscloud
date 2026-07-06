'use client'

// Equipo del taller: tabla de miembros + alta de mecánicos (fila en usuarios,
// sin cuenta de acceso — solo para asignarles trabajos).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { agregarMecanico } from '@/modules/users/mutations'
import type { MiembroEquipo } from '@/modules/users/queries'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, labelClass, btnPrimary, btnSecondary } from '@/components/ui/styles'

const ROL_LABEL: Record<string, string> = {
  admin: 'Administrador',
  jefe_taller: 'Jefe de taller',
  recepcionista: 'Recepcionista',
  mecanico: 'Mecánico',
  cliente_portal: 'Cliente',
}

export function EquipoClient({ equipo }: { equipo: MiembroEquipo[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await agregarMecanico(createClient(), {
        nombre,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
      })
      setNombre('')
      setEmail('')
      setTelefono('')
      setShowForm(false)
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Escritorio: tabla */}
      <section className={`${card} hidden overflow-x-auto p-0 md:block`}>
        <table className="w-full text-sm">
          <thead className="border-b border-black/[0.06] bg-black/[0.02] text-left text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Email</th>
            </tr>
          </thead>
          <tbody>
            {equipo.map((m) => (
              <tr key={m.id} className="border-b border-black/[0.04] last:border-0">
                <td className="px-4 py-3 font-medium text-neutral-100">{m.nombre}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full border border-black/[0.08] bg-black/[0.03] px-2.5 py-0.5 text-xs text-neutral-500">
                    {ROL_LABEL[m.rol] ?? m.rol}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-400">{m.telefono ?? '—'}</td>
                <td className="px-4 py-3 text-neutral-500">
                  {m.email.endsWith('@equipo.allmotors.local') ? '—' : m.email}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Móvil: cards */}
      <div className="space-y-2 md:hidden">
        {equipo.map((m) => (
          <div key={m.id} className={card}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-neutral-100">{m.nombre}</p>
              <span className="shrink-0 rounded-full border border-black/[0.08] bg-black/[0.03] px-2.5 py-0.5 text-xs text-neutral-500">
                {ROL_LABEL[m.rol] ?? m.rol}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-500">
              {m.telefono && <span>{m.telefono}</span>}
              {!m.email.endsWith('@equipo.allmotors.local') && <span>{m.email}</span>}
            </div>
          </div>
        ))}
      </div>

      {showForm ? (
        <section className={card}>
          <p className={`${sectionLabel} mb-4`}>Nuevo mecánico</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Nombre *</label>
              <input autoFocus className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Pedro Soto" />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input className={inputClass} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Email (opcional)</label>
              <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={() => void guardar()} disabled={guardando} className={btnPrimary}>
              {guardando ? 'Guardando…' : 'Agregar mecánico'}
            </button>
            <button onClick={() => setShowForm(false)} disabled={guardando} className={btnSecondary}>
              Cancelar
            </button>
          </div>
        </section>
      ) : (
        <button onClick={() => setShowForm(true)} className={btnPrimary}>
          + Agregar mecánico
        </button>
      )}
    </div>
  )
}
