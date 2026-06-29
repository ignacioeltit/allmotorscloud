// Cliente Supabase para componentes React (browser).
// Usa @supabase/ssr (createBrowserClient) — comparte la sesión via cookies con el server client.
//
// Reglas:
//   - Usar en: Client Components ('use client'), hooks, stores de Zustand.
//   - NUNCA importar desde: Server Components, Route Handlers, middleware.
//   - Patrón de mutaciones del proyecto (BACKEND_ARCHITECTURE §6): las mutaciones
//     se ejecutan SIEMPRE desde el browser client, nunca desde Server Actions.
//   - Usa ANON key + sesión del usuario. RLS SIEMPRE activo.

import { createBrowserClient } from '@supabase/ssr'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Variable de entorno faltante: ${name}. Revisar .env.local (ver .env.example).`,
    )
  }
  return value
}

/**
 * Crea un cliente Supabase para el browser, ligado a la sesión del usuario.
 * Reutilizable: @supabase/ssr memoiza la instancia internamente por par url+key.
 */
export function createClient() {
  return createBrowserClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  )
}
