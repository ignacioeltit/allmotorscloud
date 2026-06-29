'use client'

// Login mínimo con Supabase Auth (email + contraseña) vía browser client.
// Nota de arquitectura: el mecanismo definitivo del taller es magic link
// (SYSTEM_ARCHITECTURE §9). Este login email+password es el mínimo usable en local;
// queda como deuda migrar a magic link.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toErrorMessage } from '@/lib/ui/error-message'
import { inputClass, labelClass, btnPrimary, card } from '@/components/ui/styles'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        setError('Credenciales inválidas. Verifica tu email y contraseña.')
        setSubmitting(false)
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(toErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className={`${card} w-full max-w-sm space-y-4`}>
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-neutral-500">All Motors Cloud — ERP del taller</p>
      </div>

      <div>
        <label className={labelClass} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error ? <p className="text-sm text-danger-600">{error}</p> : null}

      <button type="submit" className={`${btnPrimary} w-full`} disabled={submitting}>
        {submitting ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}
