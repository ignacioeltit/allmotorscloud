'use client'

// Botón de logout: cierra la sesión Supabase (browser client) y vuelve a /login.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { btnSecondary } from '@/components/ui/styles'

export function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function onLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button type="button" onClick={onLogout} disabled={loading} className={btnSecondary}>
      {loading ? 'Saliendo…' : 'Salir'}
    </button>
  )
}
