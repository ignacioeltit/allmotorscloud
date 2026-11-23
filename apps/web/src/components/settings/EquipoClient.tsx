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

  // Alta de usuario CON ACCESO (asesor de servicio / jefe de taller).
  const [showAcceso, setShowAcceso] = useState(false)
  const [aNombre, setANombre] = useState('')
  const [aEmail, setAEmail] = useState('')
  const [aPass, setAPass] = useState('')
  const [aTelefono, setATelefono] = useState('')
  const [aRol, setARol] = useState('recepcionista')
  const [aGuardando, setAGuardando] = useState(false)
  const [aError, setAError] = useState<string | null>(null)
  const [aOk, setAOk] = useState<string | null>(null)

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

  async function guardarAcceso() {
    setAError(null)
    setAOk(null)
    if (!aNombre.trim() || !aEmail.trim() || aPass.length < 6) {
      setAError('Completa nombre, email y una clave de al menos 6 caracteres.')
      return
    }
    setAGuardando(true)
    try {
      const res = await fetch('/api/equipo/usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: aNombre.trim(),
          email: aEmail.trim(),
          password: aPass,
          telefono: aTelefono.trim(),
          rol: aRol,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; email?: string; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'No se pudo crear el usuario.')
      setAOk(`Usuario creado: ${data.email}. Ya puede iniciar sesión con esa clave.`)
      setANombre('')
      setAEmail('')
      setAPass('')
      setATelefono('')
      setShowAcceso(false)
      router.refresh()
    } catch (e) {
      setAError(toErrorMessage(e))
    } finally {
      setAGuardando(false)
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

      {aOk && (
        <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-800">{aOk}</p>
      )}

      {/* Alta de usuario con acceso (asesor de servicio / jefe de taller) */}
      {showAcceso ? (
        <section className={card}>
          <p className={`${sectionLabel} mb-1`}>Nuevo usuario con acceso</p>
          <p className="mb-4 text-xs text-neutral-500">
            Crea una cuenta para entrar a la app (recibir vehículos, aprobar fotos, cotizar…). Entra con el email y la clave que definas.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Nombre *</label>
              <input autoFocus className={inputClass} value={aNombre} onChange={(e) => setANombre(e.target.value)} placeholder="Ej: María Pérez" />
            </div>
            <div>
              <label className={labelClass}>Rol *</label>
              <select className={inputClass} value={aRol} onChange={(e) => setARol(e.target.value)}>
                <option value="recepcionista">Asesor de servicio (recepcionista)</option>
                <option value="jefe_taller">Jefe de taller</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input type="email" className={inputClass} value={aEmail} onChange={(e) => setAEmail(e.target.value)} placeholder="correo@taller.cl" />
            </div>
            <div>
              <label className={labelClass}>Clave * (mín. 6)</label>
              <input type="text" className={inputClass} value={aPass} onChange={(e) => setAPass(e.target.value)} placeholder="Clave inicial" />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input className={inputClass} value={aTelefono} onChange={(e) => setATelefono(e.target.value)} />
            </div>
          </div>
          {aError && <p className="mt-3 text-sm text-red-800">{aError}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={() => void guardarAcceso()} disabled={aGuardando} className={btnPrimary}>
              {aGuardando ? 'Creando…' : 'Crear usuario con acceso'}
            </button>
            <button onClick={() => { setShowAcceso(false); setAError(null) }} disabled={aGuardando} className={btnSecondary}>
              Cancelar
            </button>
          </div>
        </section>
      ) : (
        <button onClick={() => { setShowAcceso(true); setAOk(null) }} className={btnSecondary}>
          + Agregar asesor de servicio
        </button>
      )}

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
