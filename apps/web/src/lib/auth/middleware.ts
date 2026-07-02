// Middleware de sesión + protección de rutas del grupo (taller).
//
// - Refresca la sesión Supabase en cada request (patrón @supabase/ssr).
// - Redirige a /login si no hay usuario autenticado en una ruta protegida.
// - Redirige a /dashboard si un usuario ya autenticado visita /login.
//
// RLS sigue siendo la última línea de defensa: este guard es UX, no seguridad real
// (SYSTEM_ARCHITECTURE §9, capa 1).

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

interface CookieToSet {
  name: string
  value: string
  options: CookieOptions
}

/** Rutas accesibles sin sesión. */
const PUBLIC_PATHS = new Set<string>(['/login'])

/** Prefijos públicos (ej. enlace de cotización para el cliente, sin login). */
const PUBLIC_PREFIXES = ['/cotizacion/']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

export default async function middleware(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Sin configuración de Supabase no podemos validar sesión: dejamos pasar
  // (entorno sin .env.local). Documentado como riesgo: no protege rutas sin env.
  if (!url || !anonKey) return response

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // getUser() valida el JWT contra el servidor de Auth (no confía en la cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  if (!user && !isPublic(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && pathname === '/login') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  return response
}
