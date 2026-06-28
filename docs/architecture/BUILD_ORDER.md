# BUILD_ORDER.md — All Motors Cloud

**Versión**: 1.0  
**Propósito**: Qué depende de qué. Leer antes de comenzar cualquier módulo.

---

## Árbol de dependencias

```
packages/config
  └── packages/design-tokens
  └── packages/utils
  └── packages/shared
        └── packages/database
              └── apps/web
              └── apps/mechanic
        └── packages/ui
              └── apps/web
```

**Regla**: siempre construir en orden ascendente. Un paquete no puede importar de uno que dependa de él.

---

## Capa 0 — Configuración (sin dependencias)

| Artefacto | Archivo | Estado |
|---|---|---|
| TypeScript base | `packages/config/tsconfig.base.json` | ✅ Sprint 1 |
| ESLint base | `packages/config/eslint.base.js` | ✅ Sprint 1 |
| Prettier | `.prettierrc` | ✅ Sprint 1 |
| Turbo pipeline | `turbo.json` | ✅ Sprint 1 |
| pnpm workspaces | `pnpm-workspace.yaml` | ✅ Sprint 1 |

---

## Capa 1 — Paquetes sin framework (sin React, sin Next.js, sin Expo)

Pueden usarse tanto en web como en mobile.

| Paquete | Dependencias | Sprint |
|---|---|---|
| `@allmotors/design-tokens` | Ninguna | Sprint 1 |
| `@allmotors/utils` | Ninguna | Sprint 1 |
| `@allmotors/shared` | `zod` | Sprint 1 |

**Regla crítica**: nada en esta capa puede importar `react`, `next`, `expo`, ni `@supabase/ssr`.

---

## Capa 2 — Database package

Depende de: Capa 1

| Artefacto | Descripción | Sprint |
|---|---|---|
| `client/browser.ts` | `@supabase/ssr` + cookies browser | Sprint 2 |
| `client/server.ts` | `@supabase/ssr` + `cookies()` de Next.js | Sprint 2 |
| `client/native.ts` | `@supabase/supabase-js` + Expo SecureStore | Sprint 9 |
| `generated/types.ts` | Auto-generado por `supabase gen types` | Sprint 1 (vacío) → Sprint 2+ |
| `schema/index.ts` | Tipos de dominio manuales | Incremental |

**Regla crítica**: `client/server.ts` NUNCA se importa desde `apps/mechanic`. `client/native.ts` NUNCA se importa desde `apps/web`.

---

## Capa 3 — UI package

Depende de: Capa 1 (`design-tokens`, `utils`)  
Solo para: `apps/web` (Next.js)

| Artefacto | Sprint |
|---|---|
| Componentes base (Button, Input, Badge, Dialog) | Sprint 2 |
| Componentes de dominio (OTCard, VehicleRow) | Sprint 3+ |

---

## Capa 4 — Aplicaciones

### apps/web (Next.js 15)

Depende de: Capas 1, 2, 3

#### Orden de construcción de módulos

```
1. auth              ← primer módulo, todos los demás dependen de la sesión
2. organizations     ← necesita auth
3. users             ← necesita organizations
4. vehicles          ← necesita organizations + users (para org_id)
5. customers         ← necesita organizations + vehicles (propietario-vehículo)
6. technical-history ← necesita vehicles + customers
7. events            ← necesita technical-history + vehicles
8. repair-orders     ← necesita events + vehicles + customers
9. estimates         ← necesita repair-orders
10. invoices         ← necesita estimates + repair-orders
11. inventory        ← necesita organizations (puede paralelizarse con 8-10)
12. suppliers        ← necesita inventory (puede paralelizarse)
13. media            ← necesita repair-orders + events (evidencias)
14. notifications    ← necesita repair-orders + customers (destinatarios)
15. reports          ← necesita todos los anteriores
16. ai               ← necesita technical-history + events + reports
```

#### Orden de construcción de capas dentro de cada módulo

```
1. types.ts          ← tipos TypeScript del dominio
2. constants.ts      ← constantes de estado, config
3. queries.ts        ← funciones de lectura (Supabase SELECT)
4. mutations.ts      ← funciones de escritura (Supabase INSERT/UPDATE)
5. hooks/            ← hooks React que envuelven queries/mutations
6. components/       ← componentes React que consumen los hooks
```

**Regla**: las mutations NUNCA se llaman desde Server Components. Solo desde Client Components o hooks.

#### Orden de construcción de rutas

```
1. (auth)/taller/login     ← antes de cualquier ruta protegida
2. (auth)/portal/login     ← antes del portal
3. (auth)/callback         ← antes de cualquier flujo OAuth/magic link
4. middleware.ts            ← protege (taller)/* y (portal)/*
5. (taller)/dashboard       ← primera pantalla post-login
6. (taller)/vehicles/[id]   ← detalle depende del dashboard
7. (taller)/repair-orders/[id] ← depende de vehicles
8. (taller)/estimates/[id]  ← depende de repair-orders
9. (taller)/customers       ← puede paralelizarse con 6
10. (taller)/inventory      ← puede paralelizarse con 7-8
11. (taller)/reports        ← al final, necesita datos reales
12. (portal)/*              ← después de sprint de portal cliente
```

### apps/mechanic (Expo)

Depende de: Capas 1, 2 (`client/native.ts`)

```
1. Auth Expo (SecureStore tokens)         Sprint 9
2. SQLite schema + Drizzle migrations     Sprint 9
3. Sync engine (OTs asignadas)            Sprint 9
4. Pantalla OTs asignadas                 Sprint 9
5. Detalle OT + registro de trabajo       Sprint 9
6. Upload de evidencias (cámara → Storage) Sprint 9
```

---

## Base de datos — orden de migraciones

```
001_foundation.sql
  → Habilita: auth, organizations, users, audit_log
  → Prerrequisito para: TODAS las demás migraciones

002_vehicles_events.sql
  → Depende de: 001
  → Habilita: vehicles, customers, technical-history, events modules

003_repair_orders.sql
  → Depende de: 002
  → Habilita: repair-orders, estimates, media modules

004_inventory_invoices.sql
  → Depende de: 003
  → Habilita: inventory, suppliers, invoices modules

005_tallergp_migration.sql
  → Depende de: 001-004 (todas las tablas destino deben existir)
  → Habilita: Migration Toolkit (import de datos TallerGP)

006_views_search_ai.sql
  → Depende de: 001-004 (datos reales necesarios para FTS/HNSW)
  → Habilita: reports, ai modules, búsqueda semántica
```

---

## Reglas de dependencia prohibidas

| Prohibición | Razón |
|---|---|
| `apps/mechanic` importa `@supabase/ssr` | Rompe Hermes (React Native engine) |
| `apps/web` client component importa `client/server.ts` | `cookies()` solo disponible en request context |
| `packages/ui` importa `@supabase/supabase-js` | UI no debe tener dependencias de red |
| `packages/shared` importa `react` | Debe ser compatible con Expo/Node |
| Módulo N importa de módulo M si M > N en el orden de arriba | Evita ciclos de dependencia |
| `mutations.ts` usa Server Actions para licitaciones | Falla silencioso en Vercel serverless |

---

## Ciclos prohibidos en `referencias_evento`

La tabla `referencias_evento` puede crear referencias entre eventos (ej: evento B "repara" evento A). El trigger `trg_anti_ciclo_referencias` previene ciclos con advisory lock. Esto implica:

- El módulo `events` DEBE implementar `mutations.ts` con manejo de error `P0001` (ciclo detectado)
- El UI de referencias debe validar antes de submit para prevenir error en DB

---

## CI/CD: qué corre en cada PR

```
1. pnpm install          (verifica lockfile)
2. turbo typecheck       (todos los paquetes)
3. turbo lint            (todos los paquetes)
4. turbo test            (cuando haya tests)
5. supabase db test      (migration smoke test — Sprint 1)
```

**Regla**: un PR no se puede mergear si typecheck o lint fallan. Sin excepciones.
