# All Motors Cloud

Plataforma de gestión para talleres mecánicos, construida desde la operación real de
[All Motors SPA](https://allmotors.cl) (Chillán Viejo, Chile). No es un ERP genérico:
cada módulo nace de un problema real del taller.

## Principios

- **El vehículo es la entidad principal** — todo gira alrededor de su historia técnica, no de la factura ni de la orden de trabajo.
- **El software nunca debe disminuir la productividad** — el taller gana dinero reparando vehículos, no usando software.
- **Toda información se captura una sola vez** y todo queda trazado.

La especificación funcional completa vive en [`docs/erp-master/ERP_MASTER_v1.0.md`](docs/erp-master/ERP_MASTER_v1.0.md).

## Stack

- **Web**: Next.js (App Router) + Tailwind CSS
- **Backend**: Supabase — PostgreSQL con RLS multi-tenant, Auth, Realtime, Storage
- **Móvil** (en desarrollo): React Native / Expo
- **Monorepo**: pnpm workspaces + Turbo

## Estructura

```
apps/
  web/               # App principal del taller (recepción, OTs, inventario, catálogo)
  mechanic/          # App móvil para mecánicos (en desarrollo)
packages/
  database/          # Tipos generados del schema Supabase
  design-tokens/     # Colores y espaciado compartidos
  ui/, shared/, …    # Componentes y utilidades comunes
supabase/
  migrations/        # Schema completo, numerado e incremental
migration-toolkit/   # Extracción de datos históricos desde TallerGP (solo lectura)
scripts/tallergp/    # Importadores hacia Supabase (dry-run por defecto)
docs/
  erp-master/        # Especificación funcional, roadmap y changelog
  database/          # Specs de migraciones y decisiones de datos
```

## Desarrollo

```bash
pnpm install
cp .env.example .env.local   # completar credenciales de Supabase
pnpm dev:web                 # http://localhost:3000
```

Comandos útiles:

```bash
pnpm typecheck               # TypeScript estricto en todo el monorepo
pnpm build:web               # build de producción de la web
supabase db push --linked    # aplicar migraciones pendientes
```

## Estado

En desarrollo activo — Fase 1 (núcleo operativo: recepción, órdenes de trabajo,
catálogo de servicios e inventario). Ver [`docs/erp-master/ROADMAP.md`](docs/erp-master/ROADMAP.md).
