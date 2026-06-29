'use client'

// Formulario de creación de cliente. Client Component: usa el browser client
// y la mutation createCliente (patrón de mutaciones del proyecto — nunca Server Action).

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createCliente } from '@/modules/customers/mutations'
import { TIPOS_CLIENTE, TIPO_CLIENTE_DEFAULT, type TipoCliente } from '@/modules/customers/constants'
import type { ClienteCreateInput } from '@/modules/customers/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { inputClass, labelClass, btnPrimary, btnSecondary, card } from '@/components/ui/styles'

export function ClienteForm() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoCliente>(TIPO_CLIENTE_DEFAULT)
  const [rut, setRut] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [direccion, setDireccion] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const input: ClienteCreateInput = {
        nombre: nombre.trim(),
        tipo,
        ...(rut.trim() && { rut: rut.trim() }),
        ...(telefono.trim() && { telefono: telefono.trim() }),
        ...(email.trim() && { email: email.trim() }),
        ...(direccion.trim() && { direccion: direccion.trim() }),
        ...(notas.trim() && { notas: notas.trim() }),
      }
      const supabase = createClient()
      await createCliente(supabase, input)
      router.push('/customers')
      router.refresh()
    } catch (err) {
      setError(toErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className={`${card} space-y-4`}>
      <div>
        <label className={labelClass} htmlFor="nombre">
          Nombre *
        </label>
        <input
          id="nombre"
          className={inputClass}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="tipo">
          Tipo
        </label>
        <select
          id="tipo"
          className={inputClass}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoCliente)}
        >
          {TIPOS_CLIENTE.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="rut">
            RUT
          </label>
          <input id="rut" className={inputClass} value={rut} onChange={(e) => setRut(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="telefono">
            Teléfono
          </label>
          <input
            id="telefono"
            className={inputClass}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="direccion">
          Dirección
        </label>
        <input
          id="direccion"
          className={inputClass}
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="notas">
          Notas
        </label>
        <textarea
          id="notas"
          className={inputClass}
          rows={3}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-danger-600">{error}</p> : null}

      <div className="flex gap-3">
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? 'Guardando…' : 'Crear cliente'}
        </button>
        <button type="button" className={btnSecondary} onClick={() => router.back()}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
