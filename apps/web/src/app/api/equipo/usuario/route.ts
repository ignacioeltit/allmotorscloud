// POST /api/equipo/usuario
//
// Crea un usuario CON ACCESO a la app (asesor de servicio = recepcionista, o
// jefe de taller): cuenta en Supabase Auth con el rol y la organización en el
// app_metadata (que es de donde RLS lee el rol/org), más su fila en `usuarios`.
//
// Solo un ADMIN del taller puede crearlos. El rol y la organización se fuerzan
// en el servidor (nunca desde el body) para evitar escalada de privilegios.
// Usa el service_role (server-only) para crear la cuenta de auth.

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'

export const dynamic = 'force-dynamic'

// Roles con acceso que un admin puede crear desde Equipo.
const ROLES_PERMITIDOS = new Set(['recepcionista', 'jefe_taller'])

function esEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: Request) {
  // 1) Solo un admin autenticado puede crear usuarios con acceso.
  const supabase = await createClient()
  let ctx
  try {
    ctx = await getAuthContext(supabase)
  } catch {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }
  if (ctx.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo un administrador puede agregar usuarios con acceso.' }, { status: 403 })
  }

  // 2) Validar entrada.
  const body = (await request.json().catch(() => null)) as
    | { nombre?: string; email?: string; password?: string; telefono?: string; rol?: string }
    | null
  if (!body) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })

  const nombre = (body.nombre ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const telefono = (body.telefono ?? '').trim()
  const rol = (body.rol ?? 'recepcionista').trim()

  if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 })
  if (!esEmailValido(email)) return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'La clave debe tener al menos 6 caracteres.' }, { status: 400 })
  if (!ROLES_PERMITIDOS.has(rol)) return NextResponse.json({ error: 'Rol no permitido.' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Configuración del servidor incompleta.' }, { status: 500 })
  }
  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false } })

  // 3) rol_id del catálogo.
  const { data: rolRow, error: rolErr } = await admin.from('roles').select('id').eq('nombre', rol).single()
  if (rolErr || !rolRow) {
    return NextResponse.json({ error: 'No se encontró el rol.' }, { status: 500 })
  }

  // 4) Crear la cuenta de auth con rol + org en app_metadata (de ahí lee RLS).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: rol, org_id: ctx.orgId },
    user_metadata: { nombre },
  })
  if (createErr || !created?.user) {
    const msg = /already registered|already exists|duplicate/i.test(createErr?.message ?? '')
      ? 'Ese email ya tiene una cuenta.'
      : 'No se pudo crear la cuenta.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // 5) Fila en usuarios (id = id de la cuenta de auth).
  const { error: insErr } = await admin.from('usuarios').insert({
    id: created.user.id,
    org_id: ctx.orgId,
    rol_id: (rolRow as { id: string }).id,
    nombre,
    email,
    ...(telefono ? { telefono } : {}),
    creado_por: ctx.userId,
  })
  if (insErr) {
    // Revertir la cuenta de auth si no se pudo enlazar en usuarios.
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {})
    return NextResponse.json({ error: 'No se pudo enlazar el usuario.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, email }, { status: 201 })
}
