// Middleware de Next.js — protección de rutas y gestión de sesión Supabase.
// Implementar en Sprint 2 — Auth module.
// Este archivo debe existir en src/ (no en src/app/) para que Next.js lo detecte.

export { default } from './lib/auth/middleware'

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
