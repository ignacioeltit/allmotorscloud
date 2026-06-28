# ROADMAP_DEVELOPMENT.md — All Motors Cloud

**Versión**: 1.0  
**Estado**: Aprobado para Sprint 1  
**Horizonte**: MVP (~24 semanas / 12 sprints × 2 semanas)

---

## Principios de priorización

1. **Datos primero**: migraciones y schema antes de cualquier UI
2. **Vertical slice**: cada sprint entrega algo usable, no capas horizontales
3. **Un solo taller primero**: All Motors SPA (Chillán) es el cliente piloto
4. **Sin deuda de arquitectura**: RLS, particionado y event-sourcing desde el día 1

---

## Sprint 1 — Bootstrap + Foundation (semanas 1-2)

**Meta**: Monorepo funcionando, schema base, CI verde

### Entregables
- [ ] Monorepo Turborepo/pnpm listo (`pnpm install` funciona)
- [ ] Migration 001: extensions, `mi_org_id()`, `mi_rol()`, `fn_set_updated_at()`, `organizaciones`, `usuarios`, `roles`, partitioned empty tables (`transiciones_evento`, `audit_log`)
- [ ] Migration 002: `vehiculos`, `historias_tecnicas`, `clientes`, `propietarios_vehiculo`, `conductores`, `tipos_evento`, `eventos`, `referencias_evento`
- [ ] CI: typecheck + lint en cada PR (GitHub Actions)
- [ ] `supabase gen types` integrado en pipeline
- [ ] `@allmotors/shared` con constantes de dominio base
- [ ] `@allmotors/utils` con RUT, formatters, fechas

### Dependencias bloqueantes
- Ninguna (sprint de arranque)

---

## Sprint 2 — Auth + Organizations + Vehicles (semanas 3-4)

**Meta**: Un mecánico puede iniciar sesión y ver vehículos

### Entregables
- [ ] Auth: login taller, login portal cliente, callback, middleware de sesión
- [ ] `packages/database/src/client/browser.ts` — Supabase browser client con `@supabase/ssr`
- [ ] `packages/database/src/client/server.ts` — Supabase server client
- [ ] Módulo `organizations`: crear org, settings básicos
- [ ] Módulo `users`: invitar usuario, roles
- [ ] Módulo `vehicles`: CRUD vehículos, búsqueda por patente, ficha técnica
- [ ] Dashboard taller: lista de vehículos con búsqueda

### Dependencias bloqueantes
- Sprint 1 completo (schema + monorepo)

---

## Sprint 3 — Customers + Technical History + Basic Events (semanas 5-6)

**Meta**: Registrar la historia técnica de un vehículo

### Entregables
- [ ] Módulo `customers`: CRUD clientes, asociación propietario-vehículo
- [ ] Módulo `technical-history`: vista de historia por vehículo
- [ ] Módulo `events`: crear evento libre (nota, inspección), tipos de evento
- [ ] `transiciones_evento`: registrar cambios de estado
- [ ] Vista `v_historial_tecnico_ia` (sin pgvector aún — solo FTS)
- [ ] FTS en vehículos y clientes (pg_trgm)

### Dependencias bloqueantes
- Sprint 2 (auth + vehicles)

---

## Sprint 4 — Basic OT (semanas 7-8)

**Meta**: Abrir y cerrar una Orden de Trabajo completa

### Entregables
- [ ] Migration 003: `ordenes_trabajo`, `presupuestos`, `reparaciones`, `entregas`, `garantias`, `evidencias`
- [ ] Módulo `repair-orders`: crear OT, transiciones de estado (flujo completo)
- [ ] Evento automático al crear/cerrar OT
- [ ] Vista detalle OT: vehículo, cliente, historial de estado
- [ ] Trigger: inmutabilidad de eventos cerrados
- [ ] App web: pantalla OT activas + detalle

### Dependencias bloqueantes
- Sprint 3 (events + technical-history)

---

## Sprint 5 — Estimates + Client Authorization (semanas 9-10)

**Meta**: Enviar presupuesto y recibir autorización del cliente

### Entregables
- [ ] Módulo `estimates`: crear ítems, calcular totales, descuentos
- [ ] Email de presupuesto al cliente (Resend)
- [ ] Portal cliente: ver presupuesto, autorizar / rechazar
- [ ] Auth portal cliente (link mágico, no contraseña)
- [ ] Estado OT avanza automáticamente al autorizar
- [ ] PDF de presupuesto (react-pdf en Edge Function)

### Dependencias bloqueantes
- Sprint 4 (repair orders)

---

## Sprint 6 — Repair + QC + Delivery (semanas 11-12)

**Meta**: Ciclo completo: recepción → reparación → entrega

### Entregables
- [ ] Items de reparación: mecánico registra trabajo realizado
- [ ] Upload de evidencias (fotos): Supabase Storage, signed URLs con caché
- [ ] Control de calidad: checklist QC
- [ ] Entrega: registrar km, firma digital (canvas)
- [ ] Garantías: generar garantía al cerrar OT
- [ ] Notificación push al cliente: vehículo listo

### Dependencias bloqueantes
- Sprint 5 (estimates + authorization)

---

## Sprint 7 — Inventory (semanas 13-14)

**Meta**: Control de stock de repuestos integrado a OT

### Entregables
- [ ] Migration 004: `repuestos`, `proveedores`, `movimientos_stock`, `facturas`, `items_factura`
- [ ] Módulo `inventory`: CRUD repuestos, stock mínimo, alertas
- [ ] Módulo `suppliers`: CRUD proveedores
- [ ] Descuento automático de stock al registrar reparación
- [ ] Módulo `invoices`: generar factura desde OT cerrada
- [ ] Items de presupuesto/reparación: pueden apuntar a repuesto del inventario

### Dependencias bloqueantes
- Sprint 6 (repair cycle completo)

---

## Sprint 8 — Notifications + Portal Cliente completo (semanas 15-16)

**Meta**: El cliente tiene visibilidad en tiempo real de su vehículo

### Entregables
- [ ] Módulo `notifications`: push web, push mobile (Expo), email
- [ ] Supabase Realtime en portal cliente (estado OT en vivo)
- [ ] Portal cliente: historial de OTs, documentos, facturas
- [ ] Citas: solicitar turno desde portal
- [ ] Campaña de servicio: recordatorio próximo mantenimiento (cron)
- [ ] Migration 004 completa con facturas

### Dependencias bloqueantes
- Sprint 7 (inventory + invoices)

---

## Sprint 9 — App Mecánico Offline (semanas 17-18)

**Meta**: Mecánico trabaja sin conexión en el taller

### Entregables
- [ ] `packages/database/src/client/native.ts` — Supabase client Expo
- [ ] Drizzle ORM para Expo SQLite: schema y migraciones versionadas
- [ ] Sync bidireccional: SQLite local ↔ Supabase (OTs asignadas)
- [ ] App Mecánico: ver OT asignada, registrar trabajo, subir fotos
- [ ] Cámara: captura de evidencias con metadatos de localización
- [ ] Conflict resolution: last-write-wins para estado OT

### Dependencias bloqueantes
- Sprint 6 (repair cycle — define las entidades a sincronizar)

---

## Sprint 10 — TallerGP Migration (semanas 19-20)

**Meta**: Importar datos históricos del sistema anterior sin downtime

### Entregables
- [ ] Migration 005: `_tallergp_id_map`, staging tables
- [ ] Migration Toolkit: transformación completa (vehículos, clientes, OTs, facturas)
- [ ] Script de validación: comparar totales TallerGP vs All Motors
- [ ] Dry-run en ambiente staging con datos reales anonimizados
- [ ] Runbook de migración producción: ventana de mantenimiento, rollback plan
- [ ] Cutover: All Motors Cloud como sistema único

### Dependencias bloqueantes
- Sprints 1-7 (todas las tablas destino deben existir)
- Validación con el cliente (All Motors SPA)

---

## Sprint 11 — Reports + Dashboards (semanas 21-22)

**Meta**: Dueño del taller tiene KPIs en tiempo real

### Entregables
- [ ] Migration 006: `v_clientes_mecanico`, `v_historial_tecnico_ia`, FTS indexes, HNSW (pgvector)
- [ ] Módulo `reports`: ingresos por período, OTs por mecánico, tiempo promedio
- [ ] Dashboard principal: KPIs, agenda del día, alertas de stock
- [ ] Exportar reportes a CSV/PDF
- [ ] Módulo `ai` (base): embeddings de diagnósticos, `cola_eventos_ia`
- [ ] Búsqueda semántica: "buscar vehículos con falla similar" (RAG básico)

### Dependencias bloqueantes
- Sprint 10 (datos históricos importados para que los reportes sean relevantes)

---

## Sprint 12 — Polish + MVP Release (semanas 23-24)

**Meta**: Sistema listo para primer cliente de pago

### Entregables
- [ ] Georeplica Supabase activa (Supabase Pro)
- [ ] Monitoreo: Sentry en web + mobile, alertas de latencia
- [ ] Onboarding: wizard de configuración para nuevo taller
- [ ] Billing básico: plan por taller (Stripe), límite de usuarios por plan
- [ ] Documentación de usuario (guía de inicio)
- [ ] Load test: 50 OTs concurrentes, p99 < 500ms
- [ ] Penetration test básico: RLS policies auditadas
- [ ] Go-live All Motors SPA

### Dependencias bloqueantes
- Sprint 11 (feature completa)
- Decisión comercial: precio, plan, contrato

---

## Resumen de hitos

| Hito | Sprint | Descripción |
|---|---|---|
| Alpha Interno | 4 | OT completa funciona end-to-end |
| Beta Piloto | 8 | Portal cliente activo, notificaciones |
| Offline Ready | 9 | App Mecánico funciona sin conexión |
| Data Migration | 10 | Datos TallerGP importados |
| MVP v1.0 | 12 | Primer cliente de pago activo |

---

## Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Complejidad sync offline (S9) | Alto | Prototype en Sprint 4, no esperar Sprint 9 |
| Calidad datos TallerGP (S10) | Alto | Dry-run con datos reales en Sprint 8 |
| pgvector HNSW en production | Medio | Activar en staging en Sprint 6 |
| Citas PA9 (tabla en duda) | Bajo | Resolver antes de Migration 003 |
