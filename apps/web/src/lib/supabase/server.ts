// Cliente Supabase para Server Components, Route Handlers y middleware de Next.js.
// Usa @supabase/ssr con cookies() de Next.js 15 (async).
//
// Reglas:
//   - Usar SOLO en: Server Components, Route Handlers, middleware de Next.js.
//   - NUNCA importar desde: Client Components, apps/mechanic.
//   - Usa ANON key + sesión del usuario (JWT en cookie). RLS SIEMPRE activo.
//   - NUNCA usar SUPABASE_SERVICE_ROLE_KEY aquí — eso haría bypass de RLS.

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

interface CookieToSet {
  name: string
  value: string
  options: CookieOptions
}

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
 * Crea un cliente Supabase ligado a la sesión del request (cookies).
 * Toda query/mutation queda sujeta a las políticas RLS del usuario autenticado.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // En un Server Component puro `set` lanza; Next.js lo refresca via middleware.
          // Capturamos para no romper el render de lectura inicial.
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Llamado desde un Server Component sin contexto de escritura de cookies.
          }
        },
      },
    },
  )
}
