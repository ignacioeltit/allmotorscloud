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

// IMPORTANTE: Next.js solo inyecta las variables NEXT_PUBLIC_* en el bundle del browser
// cuando se acceden como literal estático `process.env.NEXT_PUBLIC_X`. Un acceso dinámico
// (`process.env[variable]`) NO se reemplaza y queda `undefined` en el cliente. Por eso
// aquí se leen como literales a nivel de módulo (no mediante un helper con clave variable).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Crea un cliente Supabase para el browser, ligado a la sesión del usuario.
 * Reutilizable: @supabase/ssr memoiza la instancia internamente por par url+key.
 */
export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en el bundle del browser. ' +
        'Revisa apps/web/.env.local y reinicia el servidor de desarrollo.',
    )
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
