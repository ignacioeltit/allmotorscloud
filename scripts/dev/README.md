# Dev bootstrap — sesión real para el Vertical Slice

Pasos mínimos para ejecutar el frontend (`apps/web`) con una sesión Supabase real.

## 1. Variables de entorno

Copia `.env.example` a `apps/web/.env.local` (o raíz `.env.local`) y completa con tu
proyecto Supabase (local o cloud):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...     # SOLO para el seed local. Nunca se usa en la app.
```

> Las migraciones 001–003 deben estar aplicadas (`supabase db push` / `supabase db reset`).

## 2. Crear el usuario admin + datos base

El seed es **idempotente** y crea: organización demo, usuario admin en Auth con
`app_metadata { org_id, role: 'admin' }`, la fila `public.usuarios`, y tipos de evento.

```bash
node --env-file=.env.local scripts/dev/seed-dev.mjs
```

Salida esperada: `Login → admin@allmotors.local / Admin123!` y el `org_id` creado.

Credenciales por defecto (override con `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`):

| Email | Password |
|---|---|
| `admin@allmotors.local` | `Admin123!` |

### Por qué un seed y no onboarding

No existe aún Edge Function de onboarding ni trigger `handle_new_user`. Por eso el
seed:

- inserta `app_metadata.org_id` y `app_metadata.role` en el usuario de Auth — son los
  claims que leen `mi_org_id()` y `mi_rol()` (RLS, migration 001);
- crea manualmente la fila `public.usuarios` (no hay trigger que la genere);
- puebla `tipos_evento` (sin esto, la pantalla "Registrar evento" se bloquea).

## 3. Iniciar sesión

```bash
npx pnpm@11.9.0 dev   # o: pnpm --filter @allmotors/web dev
```

1. Abre `http://localhost:3000` → el middleware redirige a `/login`.
2. Ingresa con las credenciales del seed.
3. Quedas en `/dashboard`. "Salir" (arriba a la derecha) cierra sesión.

## Notas / seguridad

- `SUPABASE_SERVICE_ROLE_KEY` se usa **solo** en este script de bootstrap local.
  La aplicación nunca lo usa (todo pasa por anon key + RLS).
- El login usa email+password por simplicidad local. El mecanismo definitivo del taller
  es **magic link** (SYSTEM_ARCHITECTURE §9) — pendiente.
