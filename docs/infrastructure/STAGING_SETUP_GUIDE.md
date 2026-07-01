# Guía de creación y configuración — Entorno Staging

**Proyecto:** All Motors Cloud  
**Fecha:** 2026-06-30  
**Contexto:** `all-motors-cloud` (iowxkemtvsffohakczpi) se trata como producción.
Antes de aplicar Migration 005 o cualquier migración estructural futura,
se requiere un proyecto Supabase de staging separado.

---

## Índice

1. [Por qué staging separado](#1-por-qué-staging-separado)
2. [Crear el proyecto Supabase staging](#2-crear-el-proyecto-supabase-staging)
3. [Variables de entorno necesarias](#3-variables-de-entorno-necesarias)
4. [Linkear staging con la CLI](#4-linkear-staging-con-la-cli)
5. [Aplicar todas las migraciones 001-005](#5-aplicar-todas-las-migraciones-001-005)
6. [Crear usuarios de prueba por rol](#6-crear-usuarios-de-prueba-por-rol)
7. [Validar RLS con usuarios reales](#7-validar-rls-con-usuarios-reales)
8. [Regenerar tipos TypeScript desde staging](#8-regenerar-tipos-typescript-desde-staging)
9. [Checklist pre-producción](#9-checklist-pre-producción)
10. [Riesgos y consideraciones](#10-riesgos-y-consideraciones)

---

## 1. Por qué staging separado

`all-motors-cloud` ya tiene datos reales (OTs importadas desde TallerGP,
schema 001-004 aplicado). Una migración estructural fallida o con datos
incorrectos en producción puede:

- Bloquear el acceso a la UI si una tabla queda en estado inconsistente
- Romper RLS silenciosamente si las policies tienen errores de rol
- Corromper seeds si se insertan con org_id incorrecto
- Requerir un rollback manual de DDL (PostgreSQL no hace rollback automático de
  `ALTER TABLE` en la mayoría de casos en Supabase cloud)

**La única mitigación segura es: validar primero en un proyecto idéntico.**

---

## 2. Crear el proyecto Supabase staging

### Opción A — Dashboard (recomendada para primera vez)

1. Ir a [supabase.com/dashboard](https://supabase.com/dashboard)
2. Seleccionar la organización **ttpjyjhtmoaiwyxnsicd** (la misma que all-motors-cloud)
3. Clic en **"New project"**
4. Configurar:
   ```
   Name:     all-motors-staging
   Database Password: [generar una contraseña segura — guardarla, se necesita después]
   Region:   us-west-2   ← mismo que producción para paridad
   Plan:     Free (suficiente para staging de un taller)
   ```
5. Esperar a que el proyecto esté en estado **ACTIVE_HEALTHY** (~2 minutos)
6. Anotar el **Project Ref** (aparece en la URL: `https://supabase.com/dashboard/project/<REF>`)

### Opción B — CLI

```bash
# Listar organizaciones disponibles
supabase orgs list

# Crear proyecto (requiere --org-id de la organización)
supabase projects create all-motors-staging \
  --org-id ttpjyjhtmoaiwyxnsicd \
  --region us-west-2 \
  --db-password "<contraseña-segura>"

# El comando devuelve el project_ref → anotarlo
```

---

## 3. Variables de entorno necesarias

### Archivo `.env.staging` (crear en raíz del proyecto, NO commitear)

```bash
# ─── Supabase Staging ──────────────────────────────────────────────────────────
# Obtener desde: https://supabase.com/dashboard/project/<REF>/settings/api

NEXT_PUBLIC_SUPABASE_URL=https://<REF_STAGING>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-del-proyecto-staging>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-del-proyecto-staging>

# ─── Variables para CLI de Supabase ────────────────────────────────────────────
# Obtener desde: https://supabase.com/dashboard/account/tokens
SUPABASE_ACCESS_TOKEN=<personal-access-token>

# Project Ref del proyecto staging (sin https://, solo el ID)
SUPABASE_PROJECT_REF_STAGING=<ref-del-proyecto-staging>

# URL de conexión directa a la DB de staging (para psql o db push con --db-url)
# Obtener desde: Dashboard → Settings → Database → Connection string → URI
DATABASE_URL_STAGING=postgresql://postgres:<contraseña>@db.<REF_STAGING>.supabase.co:5432/postgres
```

### Dónde encontrar cada valor

| Variable | Ubicación en Dashboard |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project → Settings → API → Project API keys → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Project → Settings → API → Project API keys → service_role |
| `SUPABASE_ACCESS_TOKEN` | [Account → Access Tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_REF_STAGING` | URL del proyecto: `.../dashboard/project/<REF>` |
| `DATABASE_URL_STAGING` | Project → Settings → Database → Connection string (URI mode) |

> **Seguridad:** `.env.staging` ya está en `.gitignore` del proyecto (verificar).
> Nunca commitear ninguno de estos valores.

---

## 4. Linkear staging con la CLI

```bash
# Desde el directorio raíz del proyecto
cd /Users/ignacioeltit/APPTALLERPROPIA

# Opción A: linkear interactivo (pide el project ref)
supabase link

# Opción B: linkear directo con project ref
supabase link --project-ref <REF_STAGING>
# La CLI pide la contraseña de la DB → ingresar la que se configuró al crear

# Verificar que el link apunta al staging (NO a iowxkemtvsffohakczpi)
supabase status

# Verificar project ref antes de cualquier push
supabase projects list
# Confirmar que el linked project es all-motors-staging, no all-motors-cloud
```

> ⚠️ **Verificación crítica:** antes del push, ejecutar `supabase migration list`
> y confirmar que el "Remote" en la lista corresponde a staging.
> Si aparece `iowxkemtvsffohakczpi` en la URL, detener inmediatamente.

---

## 5. Aplicar todas las migraciones 001-005

El proyecto staging es nuevo — no tiene ninguna migración aplicada.
Se deben aplicar las 5 en orden.

```bash
# Verificar estado antes del push (debe mostrar todas vacías en Remote)
supabase migration list

# Dry-run para confirmar qué se va a aplicar
supabase db push --linked --dry-run
# Salida esperada:
# Would push these migrations:
#   • 001_initial_schema.sql
#   • 002_domain_core.sql
#   • 003_operational_core.sql
#   • 004_inventory.sql
#   • 005_labor_services.sql

# Aplicar (Supabase aplica en orden, dentro de transacciones individuales)
supabase db push --linked --yes

# Verificar resultado
supabase migration list
# Todos deben aparecer con ✅ en Remote
```

### Aplicar seed de la migración (si aplica)

Migration 005 tiene seeds embebidos en el SQL (se aplican automáticamente con el push).
Si se necesita re-aplicar solo los seeds:

```bash
# Conectarse directamente a la DB de staging
psql "$DATABASE_URL_STAGING"

# Verificar que los seeds se aplicaron
SELECT codigo, nombre, precio_unitario FROM catalogo_servicios ORDER BY frecuencia_uso DESC LIMIT 5;
SELECT codigo, nombre, tipo_precio FROM plantillas_trabajo;
SELECT * FROM configuracion_mano_obra;
```

---

## 6. Crear usuarios de prueba por rol

En el dashboard de staging, crear 4 usuarios mínimos para validar RLS:

```
admin@test.allmotors.cl       → rol: admin
jefe@test.allmotors.cl        → rol: jefe_taller
recepcion@test.allmotors.cl   → rol: recepcionista
mecanico@test.allmotors.cl    → rol: mecanico
```

### Desde SQL (con service_role key):

```sql
-- Ejecutar en el SQL Editor del dashboard de staging
-- o con psql "$DATABASE_URL_STAGING"

-- Crear organización de prueba
INSERT INTO organizaciones (id, nombre, rut, email_contacto)
VALUES (
  '00000000-test-0000-0000-000000000001',
  'All Motors Staging Test',
  '76123456-7',
  'test@allmotors.cl'
);

-- El INSERT de usuarios en auth.users requiere la API de Admin o el Dashboard.
-- Usar el Dashboard de Supabase → Authentication → Users → Add User para cada uno.
-- Después de crear los auth.users, obtener sus UUIDs y ejecutar:

INSERT INTO usuarios (id, org_id, nombre, email, rol) VALUES
  ('<uuid-auth-admin>',       '00000000-test-0000-0000-000000000001', 'Admin Test',        'admin@test.allmotors.cl',       'admin'),
  ('<uuid-auth-jefe>',        '00000000-test-0000-0000-000000000001', 'Jefe Taller Test',  'jefe@test.allmotors.cl',        'jefe_taller'),
  ('<uuid-auth-recepcion>',   '00000000-test-0000-0000-000000000001', 'Recepción Test',    'recepcion@test.allmotors.cl',   'recepcionista'),
  ('<uuid-auth-mecanico>',    '00000000-test-0000-0000-000000000001', 'Mecánico Test',     'mecanico@test.allmotors.cl',    'mecanico');

-- Configurar app_metadata para que mi_org_id() y mi_rol() funcionen via JWT:
-- Esto requiere la API de Admin de Supabase (service_role):

-- Opción A: desde psql con service_role
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'),
  '{org_id}',
  '"00000000-test-0000-0000-000000000001"'
)
WHERE email IN (
  'admin@test.allmotors.cl',
  'jefe@test.allmotors.cl',
  'recepcion@test.allmotors.cl',
  'mecanico@test.allmotors.cl'
);

-- Configurar el rol (mi_rol() lo lee desde JWT → app_metadata.rol)
UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"rol":"admin"}'
WHERE email = 'admin@test.allmotors.cl';

UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"rol":"jefe_taller"}'
WHERE email = 'jefe@test.allmotors.cl';

UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"rol":"recepcionista"}'
WHERE email = 'recepcion@test.allmotors.cl';

UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"rol":"mecanico"}'
WHERE email = 'mecanico@test.allmotors.cl';
```

---

## 7. Validar RLS con usuarios reales

Usar el **SQL Editor del dashboard** con la sesión de cada usuario (o con `psql` usando el JWT de cada uno).

La forma más práctica en Supabase es usar el **Table Editor → View as role** o las funciones `set_config`:

```sql
-- Simular sesión de usuario específico en SQL Editor (solo funciona como postgres/service_role)
-- La RLS real se valida con una conexión autenticada por JWT.

-- ALTERNATIVA: usar la API desde Postman/curl con el token de cada usuario
-- POST https://<REF_STAGING>.supabase.co/auth/v1/token?grant_type=password
-- Body: { "email": "admin@test.allmotors.cl", "password": "..." }
-- Guardar el access_token para cada rol.
```

### Matriz de validación RLS — Migration 005

Ejecutar cada query con el JWT del rol correspondiente:

```sql
-- ─── catalogo_servicios ─────────────────────────────────────────────────────
-- SELECT: todos los roles deben ver servicios activos
SELECT COUNT(*) FROM catalogo_servicios;
-- Esperado: admin=41, jefe_taller=41, recepcionista=41, mecanico=41

-- INSERT: solo admin y jefe_taller
INSERT INTO catalogo_servicios (org_id, nombre, precio_unitario)
VALUES (mi_org_id(), 'Prueba RLS', 1000);
-- admin=✅, jefe_taller=✅, recepcionista=❌ (0 rows o error), mecanico=❌

-- UPDATE: solo admin y jefe_taller
UPDATE catalogo_servicios SET precio_unitario = 999 WHERE codigo = 'TEST-RLS';
-- admin=✅, jefe_taller=✅, recepcionista=❌, mecanico=❌

-- ─── cargos_ot ──────────────────────────────────────────────────────────────
-- SELECT: admin, jefe_taller, recepcionista pueden ver. mecanico NO.
SELECT COUNT(*) FROM cargos_ot;
-- mecanico=0 (RLS filtra, no error — silent exclusion)

-- INSERT: admin, jefe_taller, recepcionista pueden insertar. mecanico NO.
INSERT INTO cargos_ot (org_id, orden_trabajo_id, concepto, monto, creado_por)
VALUES (mi_org_id(), '<ot-id-existente>', 'Insumos test', 5000, auth.uid());
-- mecanico=❌ (0 rows afectadas por RLS)

-- ─── configuracion_mano_obra ─────────────────────────────────────────────────
-- SELECT: admin, jefe_taller, recepcionista. mecanico NO.
SELECT * FROM configuracion_mano_obra;
-- mecanico=0 rows (excluido por RLS)

-- UPDATE: solo admin
UPDATE configuracion_mano_obra SET valor_hora_mecanica = 30000 WHERE org_id = mi_org_id();
-- jefe_taller=❌, recepcionista=❌, mecanico=❌

-- ─── v_ot_totales ───────────────────────────────────────────────────────────
-- La vista hereda RLS de ordenes_trabajo.
SELECT COUNT(*) FROM v_ot_totales;
-- Todos los roles que pueden ver ordenes_trabajo deberían ver sus OTs
```

### Test del trigger cross-org

```sql
-- Con usuario autenticado (cualquier rol), intentar insertar cargo en OT de otro tenant
-- (La OT existe pero pertenece a otro org_id → el trigger debe rechazar)
INSERT INTO cargos_ot (org_id, orden_trabajo_id, concepto, monto, creado_por)
VALUES (mi_org_id(), '<ot-id-de-otro-tenant>', 'Attack', 999, auth.uid());
-- Esperado: ERROR "cargos_ot_cross_org: la orden de trabajo X no pertenece a la organización Y"
```

---

## 8. Regenerar tipos TypeScript desde staging

Una vez aplicadas las migraciones en staging:

```bash
# Generar tipos desde staging (no desde producción)
supabase gen types typescript \
  --project-id <REF_STAGING> \
  > packages/database/src/generated/types.ts

# Verificar que aparecen las nuevas tablas de Migration 005
grep -E "catalogo_servicios|cargos_ot|v_ot_totales" packages/database/src/generated/types.ts
# Debe mostrar las 5 nuevas tablas + la vista

# Ejecutar typecheck
npx tsc --noEmit -p apps/web/tsconfig.json
# Esperado: 0 errores

# Ejecutar build completo
cd apps/web && npx next build
# Esperado: EXIT 0
```

**Nota:** el script `pnpm db:types` del package.json usa `--local` (requiere Docker).
Sin Docker, usar siempre `--project-id <REF_STAGING>` o `--linked` (con el staging linkeado).

---

## 9. Checklist pre-producción

Completar todos antes de hacer push a `all-motors-cloud`:

### Schema y migración
- [ ] Staging creado y confirmado como proyecto separado de producción
- [ ] Migraciones 001-005 aplicadas en staging sin errores
- [ ] `supabase migration list` muestra todas las migraciones con ✅ en staging
- [ ] Seeds de catalogo_servicios (41 filas) verificados en staging
- [ ] Seeds de plantillas_trabajo (5 plantillas, 25 items) verificados en staging
- [ ] configuracion_mano_obra revisada y confirmada por el taller con los precios reales

### RLS y seguridad
- [ ] SELECT de catalogo_servicios funciona para los 4 roles
- [ ] INSERT en catalogo_servicios bloqueado para recepcionista y mecanico
- [ ] SELECT de cargos_ot bloqueado para mecanico
- [ ] SELECT de configuracion_mano_obra bloqueado para mecanico
- [ ] UPDATE de configuracion_mano_obra bloqueado para todos excepto admin
- [ ] Trigger cross-org rechaza INSERT con OT de otro tenant
- [ ] fn_validar_org_cargos_ot con OWNER=postgres no bloquea por RLS de ordenes_trabajo
- [ ] v_ot_totales devuelve valores correctos en al menos una OT real con datos

### TypeScript
- [ ] Tipos regenerados desde staging incluyen las 5 nuevas tablas
- [ ] `npx tsc --noEmit` con 0 errores después de regenerar tipos
- [ ] `next lint` con 0 errores
- [ ] `next build` con EXIT 0

### Datos
- [ ] Valores de configuracion_mano_obra confirmados con All Motors (precio/hora real)
- [ ] Items de KITMAXUSTR y KITL200 poblados (depende de repuestos.id)

---

## 10. Riesgos y consideraciones

| Riesgo | Mitigación |
|---|---|
| seeds de la migración usan `(SELECT id FROM organizaciones LIMIT 1)` — si no hay org en staging, los INSERTs fallan con FK violation | Crear la organización de prueba ANTES del db push, o crear seed separado post-migración |
| `fn_validar_org_cargos_ot OWNER TO postgres` — en Supabase cloud, el rol `postgres` es el superuser propietario de las funciones por defecto. Si Supabase restringe `ALTER FUNCTION ... OWNER TO` en el plan free, puede fallar | Verificar en el log del push; si falla, eliminar esa línea de la migración (el SECURITY DEFINER + search_path es suficiente en cloud) |
| plan Free de Supabase limita a 2 proyectos por organización — si ya hay 2, no se puede crear staging | Revisar en el dashboard antes; considerar pausar un proyecto inactivo o usar plan Pro |
| sin Docker, `pnpm db:types` falla silenciosamente | Siempre usar `supabase gen types typescript --project-id <REF>` directamente |
| Supabase puede tardar hasta 5 min en propagar cambios de `raw_app_meta_data` al JWT | Hacer logout/login del usuario de prueba después de actualizar app_metadata |

---

## Referencia rápida — Comandos del flujo completo

```bash
# 0. Variables (cargar desde .env.staging)
export SUPABASE_PROJECT_REF_STAGING="<ref-del-staging>"
export DATABASE_URL_STAGING="postgresql://postgres:<pass>@db.<ref>.supabase.co:5432/postgres"

# 1. Linkear staging
supabase link --project-ref $SUPABASE_PROJECT_REF_STAGING

# 2. Verificar que linked = staging (no producción)
supabase migration list   # confirmar que Remote está vacío o tiene solo 001-004 de staging

# 3. Dry-run
supabase db push --linked --dry-run

# 4. Push real a staging
supabase db push --linked --yes

# 5. Verificar migraciones
supabase migration list

# 6. Generar tipos desde staging
supabase gen types typescript \
  --project-id $SUPABASE_PROJECT_REF_STAGING \
  > packages/database/src/generated/types.ts

# 7. Typecheck + build
npx tsc --noEmit -p apps/web/tsconfig.json
cd apps/web && npx next build

# 8. Validar RLS (desde SQL Editor del dashboard de staging)
#    → seguir la Sección 7 de esta guía

# 9. Una vez todo validado: volver a linkear producción
supabase link --project-ref iowxkemtvsffohakczpi
# Y solo entonces:
supabase db push --linked --dry-run   # confirmar que solo aplica 005
supabase db push --linked --yes       # push a producción
```

---

*Guía generada por Claude Code — Sprint 10, All Motors Cloud.*
*Actualizar este documento cuando el staging esté operativo.*
