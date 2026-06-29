# Migration 003 — Especificación de Diseño

**Estado:** BORRADOR v0.2 — Architecture Board completado con condiciones. Pendiente aprobación humana.
**Versión:** 0.2
**Fecha:** Junio 2026
**Fuentes leídas:** AGENTS.md · docs/architecture/DATABASE_MODEL.md · docs/architecture/SYSTEM_ARCHITECTURE.md · docs/architecture/PHYSICAL_SCHEMA.md · docs/architecture/PERSISTENCE_ARCHITECTURE.md · docs/architecture/SECURITY_MODEL.md · docs/business/EVENT_MODEL.md · docs/database/MIGRATION_001_SPEC.md · docs/database/MIGRATION_001_REVIEW.md · docs/database/MIGRATION_002_SPEC.md · supabase/migrations/001_initial_schema.sql · supabase/migrations/002_domain_core.sql

---

## Tabla de Contenidos

1. [Objetivo](#1-objetivo)
2. [Orden exacto de creación](#2-orden-exacto-de-creación)
3. [Tablas](#3-tablas)
4. [Columnas](#4-columnas)
5. [Constraints](#5-constraints)
6. [Foreign Keys](#6-foreign-keys)
7. [Índices](#7-índices)
8. [Triggers](#8-triggers)
9. [RLS (Row Level Security)](#9-rls-row-level-security)
10. [Seeds e inicialización](#10-seeds-e-inicialización)
11. [Relación con Migrations anteriores y siguientes](#11-relación-con-migrations-anteriores-y-siguientes)
12. [Riesgos](#12-riesgos)
13. [Checklist pre-SQL](#13-checklist-pre-sql)
14. [Architecture Board Review](#14-architecture-board-review)

---

## 1. Objetivo

Migration 003 implementa el dominio operacional del taller: el flujo completo desde la apertura de una Orden de Trabajo hasta su cierre, incluyendo presupuestos, reparaciones, entrega y garantías. Es la migración que convierte el sistema en un ERP funcional.

**Alcance:**

- Completar la Foreign Key diferida de Migration 002 (`eventos.orden_trabajo_id → ordenes_trabajo.id`)
- Crear 9 tablas operacionales: `ordenes_trabajo`, `citas`, `presupuestos`, `items_presupuesto`, `reparaciones`, `items_reparacion`, `entregas`, `evidencias`, `garantias`
- Implementar el **Trigger 1** (inmutabilidad de eventos cerrados) — R-11 documentado en Migration 002
- Implementar el trigger de unicidad de OT activa por vehículo (DATABASE_MODEL §10, Regla 5)
- Crear índices B-tree compuestos para el dashboard operacional de OTs
- Definir políticas RLS para todas las tablas nuevas

**Lo que esta migración NO hace:**

- No crea `diagnosticos` — DATABASE_MODEL §4.3 la define como entidad del flujo operacional, pero PHYSICAL_SCHEMA.md §11 no la incluye en el scope de Migration 003. Se posterga a Migration 004 (sprint de diagnóstico). **Gap funcional documentado:** sin `diagnosticos`, el diagnóstico técnico se registra como `descripcion` del evento de tipo `diagnostico`. Debe especificarse en el sprint correspondiente.
- No crea `autorizaciones` (client decision record) — DATABASE_MODEL §4.3 y §7 la definen como entidad de alta criticidad (inmutable una vez registrada). Su ausencia es una **desviación formal del modelo autoritativo** aceptada como PA-M3-1 para MVP. Por ahora, la autorización queda en `presupuestos.estado = 'autorizado'` y el evento de tipo `autorizacion`. Decisión del Architecture Board requerida antes de go-live (ver §11.3).
- No crea `controles_calidad` como tabla independiente — el estado `control_calidad` de la OT es suficiente para MVP. **Gap funcional:** sin tabla, no puede registrarse quién aprobó el control de calidad ni cuándo, lo que impide la notificación automática al cliente. Documentado como PA-M3-2.
- No crea `recomendaciones_pendientes` — se posterga a Migration 004
- No crea las vistas `v_clientes_mecanico` ni `v_items_presupuesto_mecanico` (Migration 006)
- No crea la tabla de facturación (`facturas`, `pagos`) — Migration 004
- No modifica Migrations 001 ni 002

**Tablas del roadmap incluidas en Migration 003** (per `PHYSICAL_SCHEMA.md` §11):

> "003 — OT y Flujo Operacional: ordenes_trabajo, presupuestos, items_presupuesto, reparaciones, items_reparacion, entregas, citas, evidencias, garantias. Triggers: inmutabilidad de eventos cerrados. Índices B-tree compuestos para dashboard."

**Nota sobre `citas` (PA9):** `citas` aparece como pregunta abierta (PA9) en DATABASE_MODEL y está ausente de la especificación de columnas del modelo oficial. Se incluye en esta migración con un diseño provisional mínimo, documentando la PA, para no bloquear el módulo de recepción que necesita agendar visitas. Si DATABASE_MODEL es actualizado con un modelo diferente para `citas`, esta tabla deberá migrar con una migration correctiva.

---

## 2. Orden exacto de creación

El orden respeta las dependencias de Foreign Keys. Cada paso puede ejecutarse solo cuando todas sus dependencias existen.

```
Paso 01 — ordenes_trabajo      (depende de: organizaciones, vehiculos, usuarios, sucursales)
Paso 01b — FK diferida eventos.orden_trabajo_id → ordenes_trabajo.id
           (ALTER TABLE ejecutado DESPUÉS de crear ordenes_trabajo)

Paso 02 — citas                (depende de: organizaciones, vehiculos, clientes, conductores, usuarios)

Paso 03 — presupuestos         (depende de: ordenes_trabajo, usuarios)
           presupuesto_anterior_id: FK self-referencial — se añade como deferred o mediante
           columna sin FK activa y luego ALTER TABLE dentro del mismo paso (ver §6.2)

Paso 04 — items_presupuesto    (depende de: presupuestos, usuarios)
           Nota: repuesto_id referencia repuestos — tabla no existe aún. Se declara como
           UUID NULL sin FK activa. FK diferida a Migration 004 (cuando exista inventario).

Paso 05 — reparaciones         (depende de: ordenes_trabajo, eventos, usuarios)

Paso 06 — items_reparacion     (depende de: reparaciones)

Paso 07 — entregas             (depende de: ordenes_trabajo, conductores, usuarios)

Paso 08 — evidencias           (depende de: eventos, usuarios)

Paso 09 — garantias            (depende de: reparaciones, usuarios)

Paso 10 — Índices              (después de que todas las tablas existen)

Paso 11 — Seeds                (ninguno en Migration 003 — ver §10)

Paso 12 — Funciones de trigger nuevas:
           fn_inmutabilidad_evento_cerrado()   ← Trigger 1, R-11
           fn_ot_unica_activa_por_vehiculo()   ← Rule 5
           fn_versionar_presupuesto()          ← auto-incremento de version
           fn_set_cerrado_en()                 ← auto-set cerrado_en al cerrar OT

Paso 13 — Triggers             (DESPUÉS de seeds — H-5)

Paso 14 — RLS                  (habilitar + policies en cada tabla nueva)
```

**Nota sobre el orden de la FK diferida (Paso 01b):** `eventos.orden_trabajo_id` existe como columna UUID NULL desde Migration 002 sin FK activa. La FK formal se añade INMEDIATAMENTE después de crear `ordenes_trabajo` en el Paso 01, no al final de la migración. Este patrón sigue el precedente de los pasos 04b y 08b de Migration 002 (`CORRECCIÓN-R-2`).

**Nota H-5 aplicada:** los triggers se crean DESPUÉS de los seeds (§11). Aunque en esta migración no hay seeds, el orden se preserva por consistencia.

**Nota sobre `presupuesto_anterior_id` (self-referencial):** la columna se crea como `UUID NULL` sin FK activa en la definición del CREATE TABLE. La FK a `presupuestos.id` se añade via ALTER TABLE inmediatamente después de crear la tabla, en el mismo paso 03. Esto es análogo al patrón de `organizaciones.creado_por` en Migration 001 (§2, Paso 6).

---

## 3. Tablas

| Tabla | Tipo | Soft-delete | Audit trigger | set_updated_at |
|---|---|---|---|---|
| `ordenes_trabajo` | Per-tenant | Sí (`eliminado_en`) | Sí | Sí |
| `citas` | Per-tenant | Sí (`eliminado_en`) | Sí | Sí |
| `presupuestos` | Per-tenant | Sí (`eliminado_en`) | Sí | Sí |
| `items_presupuesto` | Per-tenant | Sí (`eliminado_en`) | Sí | Sí |
| `reparaciones` | Per-tenant | **No** (inmutable una vez creada) | Sí | Sí |
| `items_reparacion` | Per-tenant | Sí (`eliminado_en`) | Sí | Sí |
| `entregas` | Per-tenant | **No** (registro legal inmutable) | Sí | **No** (`creado_en` sola) |
| `evidencias` | Per-tenant | **No** (ver §7.3) | Sí | **No** (`creado_en` sola — inmutable) |
| `garantias` | Per-tenant | **No** (historial de garantías permanente) | Sí | Sí |

**Justificación de excepciones:**

- `reparaciones`: una reparación no se "elimina" — si fue ejecutada incorrectamente, se crea un nuevo evento de corrección o garantía. No tiene `eliminado_en`. Sus campos técnicos son inmutables una vez que el evento asociado está cerrado (Trigger 1).
- `entregas`: es el registro legal de devolución del vehículo. Inmutable por diseño de dominio. Solo tiene `creado_en`. Si hubo error, se corrige con un evento de tipo `correccion` referenciando el evento de entrega.
- `evidencias`: las evidencias son archivos adjuntos a eventos. `PERSISTENCE_ARCHITECTURE.md` §3.3: "Las evidencias son inmutables. Una foto no se reemplaza — se agrega una nueva evidencia." No tiene `actualizado_en` ni soft-delete. Si una evidencia debe ocultarse, se marca con `visible_cliente = false`, no se elimina.
- `garantias`: el historial de garantías es información legal y contable del taller. No tiene `eliminado_en`. Los cambios de estado se reflejan en el campo `estado` con registro en audit_log.

---

## 4. Columnas

### 4.1 `ordenes_trabajo`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `vehiculo_id` | UUID | NOT NULL | — | FK → vehiculos.id |
| `numero_ot` | TEXT | NOT NULL | — | Business key; UNIQUE(org_id, numero_ot) |
| `estado` | TEXT | NOT NULL | `'pendiente_diagnostico'` | CHECK: ver §5 |
| `sucursal_id` | UUID | NULL | — | FK → sucursales.id |
| `recepcionista_id` | UUID | NULL | — | FK → usuarios.id; quien abrió la OT |
| `km_ingreso` | INTEGER | NULL | — | Odómetro al ingreso del vehículo |
| `fecha_prometida_entrega` | DATE | NULL | — | DATE (no TIMESTAMPTZ — se promete día, no hora exacta) |
| `notas` | TEXT | NULL | — | Notas administrativas de la OT |
| `cerrado_en` | TIMESTAMPTZ | NULL | — | SET cuando estado pasa a 'cerrada' o 'cancelada' |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `creado_por` | UUID | NOT NULL | — | FK → usuarios.id |
| `eliminado_en` | TIMESTAMPTZ | NULL | — | Soft-delete |
| `eliminado_por` | UUID | NULL | — | FK → usuarios.id |

**Nota sobre `numero_ot`:** es el identificador humano de la OT (ej: "OT-2026-0001"). El UNIQUE es sobre `(org_id, numero_ot)` sin ser partial — dos OTs con el mismo número en la misma organización no pueden coexistir, ni aunque una esté eliminada. Es un número de documento legal.

**Nota sobre `estado`:** 11 estados del flujo OT (ver §5.1). Los estados activos (todos excepto `cerrada` y `cancelada`) bloquean la apertura de una segunda OT para el mismo vehículo (Trigger en §8.3).

**Nota sobre `cerrado_en`:** se setea automáticamente por trigger cuando `estado` cambia a `cerrada` o `cancelada`. No puede setearse directamente por la aplicación.

### 4.2 `citas` (PA9 — diseño provisional)

**Advertencia PA9:** esta tabla no está especificada en DATABASE_MODEL.md. La inclusión es provisional, basada en el requerimiento operacional de agendar visitas (EVENT_MODEL.md §4: "Cita — Se agenda una fecha y hora para atención"). Si DATABASE_MODEL es actualizado con un modelo diferente, se requiere una migration correctiva.

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `vehiculo_id` | UUID | NOT NULL | — | FK → vehiculos.id |
| `cliente_id` | UUID | NULL | — | FK → clientes.id; NULL si el cliente no está aún en el sistema |
| `conductor_id` | UUID | NULL | — | FK → conductores.id; quien traerá el vehículo |
| `sucursal_id` | UUID | NULL | — | FK → sucursales.id |
| `asignado_a` | UUID | NULL | — | FK → usuarios.id; mecánico o responsable tentativo |
| `fecha_cita` | TIMESTAMPTZ | NOT NULL | — | Fecha y hora de la cita |
| `duracion_estimada_min` | SMALLINT | NULL | — | Minutos estimados; para gestión de agenda |
| `tipo_servicio` | TEXT | NULL | — | Descripción libre del servicio solicitado |
| `estado` | TEXT | NOT NULL | `'programada'` | CHECK: ver §5.2 |
| `notas` | TEXT | NULL | — | Observaciones de la cita |
| `recepcion_evento_id` | UUID | NULL | — | FK → eventos.id (tipo `recepcion`); NULL hasta que la cita resulta en visita real. Apunta al evento de Recepción creado cuando el cliente llega, NO a un evento de tipo cita. La dirección de esta FK es cita→recepcion (evento post-cita). |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `creado_por` | UUID | NOT NULL | — | FK → usuarios.id |
| `eliminado_en` | TIMESTAMPTZ | NULL | — | Soft-delete (cancelación de cita) |
| `eliminado_por` | UUID | NULL | — | FK → usuarios.id |

### 4.3 `presupuestos`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `orden_trabajo_id` | UUID | NOT NULL | — | FK → ordenes_trabajo.id |
| `presupuesto_anterior_id` | UUID | NULL | — | FK → presupuestos.id (self-ref); para versionado |
| `version` | SMALLINT | NOT NULL | `1` | Incrementa con cada revisión del presupuesto |
| `estado` | TEXT | NOT NULL | `'borrador'` | CHECK: ver §5.3 |
| `total_mano_obra` | NUMERIC(12,2) | NOT NULL | `0` | Calculado; nunca float |
| `total_repuestos` | NUMERIC(12,2) | NOT NULL | `0` | Calculado; nunca float |
| `total_descuentos` | NUMERIC(12,2) | NOT NULL | `0` | Calculado; nunca float |
| `total_neto` | NUMERIC(12,2) | NOT NULL | `0` | = mano_obra + repuestos - descuentos |
| `notas` | TEXT | NULL | — | Observaciones del presupuesto |
| `enviado_en` | TIMESTAMPTZ | NULL | — | Timestamp de envío al cliente |
| `autorizado_en` | TIMESTAMPTZ | NULL | — | Timestamp de autorización del cliente |
| `autorizado_por_nombre` | TEXT | NULL | — | Nombre de quien autorizó (puede no ser usuario del sistema) |
| `rechazado_en` | TIMESTAMPTZ | NULL | — | Timestamp de rechazo |
| `razon_rechazo` | TEXT | NULL | — | Motivo del rechazo |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `creado_por` | UUID | NOT NULL | — | FK → usuarios.id |
| `eliminado_en` | TIMESTAMPTZ | NULL | — | Soft-delete |
| `eliminado_por` | UUID | NULL | — | FK → usuarios.id |

**Nota sobre versionado:** `presupuesto_anterior_id` apunta a la versión inmediatamente anterior. La cadena de versiones permite reconstruir el historial completo. `version` es un entero incremental por OT, no global. Solo puede existir un presupuesto activo (estado != 'rechazado' y != eliminado) por OT a la vez (ver constraint §5.3 y RLS §9.3).

**Nota sobre los totales:** `total_mano_obra`, `total_repuestos`, `total_descuentos`, `total_neto` son campos calculados denormalizados. Se actualizan por trigger o aplicación cada vez que cambian los `items_presupuesto`. Permiten mostrar el total de presupuesto sin JOIN a items en listados de OTs. NUMERIC(12,2) — nunca FLOAT para valores monetarios (PHYSICAL_SCHEMA.md §2.4).

**Nota sobre `autorizaciones`:** este modelo no incluye una tabla separada `autorizaciones`. La autorización del cliente queda registrada en el campo `autorizado_en` + `autorizado_por_nombre` del presupuesto, y en el evento de tipo `autorizacion` de la historia técnica. Si el proyecto requiere una tabla formal de autorizaciones (firma digital, múltiples ítems autorizados parcialmente), se documenta como PA en §12 y se posterga a un sprint de presupuestos avanzados.

### 4.4 `items_presupuesto`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `presupuesto_id` | UUID | NOT NULL | — | FK → presupuestos.id |
| `tipo` | TEXT | NOT NULL | — | CHECK: `'mano_obra'` o `'repuesto'` |
| `descripcion` | TEXT | NOT NULL | — | Descripción del ítem |
| `repuesto_id` | UUID | NULL | — | FK diferida → repuestos.id (Migration 004); NULL para mano de obra |
| `cantidad` | NUMERIC(10,3) | NOT NULL | `1` | Decimal para medidas parciales |
| `precio_unitario` | NUMERIC(12,2) | NOT NULL | — | Precio base; NUMERIC, nunca float |
| `descuento_porcentaje` | NUMERIC(5,2) | NOT NULL | `0` | % de descuento; 0-100 |
| `precio_total` | NUMERIC(12,2) | NOT NULL | — | = cantidad * precio_unitario * (1 - descuento/100) |
| `autorizador_id` | UUID | NULL | — | FK → usuarios.id; obligatorio cuando descuento supera umbral |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `creado_por` | UUID | NOT NULL | — | FK → usuarios.id |
| `eliminado_en` | TIMESTAMPTZ | NULL | — | Soft-delete (ítem removido del presupuesto) |
| `eliminado_por` | UUID | NULL | — | FK → usuarios.id |

**Nota sobre `repuesto_id`:** NULL para ítems de mano de obra. Para ítems de repuesto, referencia la tabla `repuestos` (catálogo por tenant, Migration 004). FK diferida: la columna existe desde Migration 003 como `UUID NULL` sin FK activa. La FK formal se añade al inicio de Migration 004.

**Nota sobre `autorizador_id`:** cuando el descuento en un ítem supera el umbral configurado por el taller (campo `configuracion_org` en `organizaciones`, fuera del scope de esta spec), se requiere que un usuario con rol `jefe_taller` o `admin` autorice el descuento. La validación del umbral es responsabilidad de la aplicación, no de la base de datos.

### 4.5 `reparaciones`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `orden_trabajo_id` | UUID | NOT NULL | — | FK → ordenes_trabajo.id |
| `evento_trabajo_id` | UUID | NOT NULL | — | FK → eventos.id (tipo `reparacion` o `mantencion`); el evento de ejecución técnica que describe el trabajo realizado. **Nota sobre Rule 6:** DATABASE_MODEL §10 Regla 6 exige que exista un evento de autorización cerrado y aprobado antes de crear la reparación. Esta FK apunta al evento de TRABAJO (lo que se ejecutó), no al evento de AUTORIZACIÓN (que aprobó el cliente). La validación de que el evento de autorización correspondiente esté cerrado es responsabilidad de la aplicación (Route Handler / Edge Function). La DB garantiza la FK al evento de trabajo; el prerrequisito de autorización no puede verificarse via FK sin ambigüedad de dominio. |
| `mecanico_id` | UUID | NULL | — | FK → usuarios.id; mecánico principal (MVP = uno; multi-mecánico en V1) |
| `descripcion` | TEXT | NULL | — | Descripción del trabajo realizado |
| `observaciones` | TEXT | NULL | — | Hallazgos adicionales durante la reparación |
| `inicio_en` | TIMESTAMPTZ | NULL | — | Inicio real del trabajo |
| `fin_en` | TIMESTAMPTZ | NULL | — | Fin real del trabajo |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `creado_por` | UUID | NOT NULL | — | FK → usuarios.id |

**No tiene `eliminado_en`:** una reparación ejecutada no se elimina. Si existió un error de registro, se corrige vía un nuevo evento de tipo `correccion` que referencia al evento original. DATABASE_MODEL §10, Regla 6: "Reparación no puede existir sin evento técnico cerrado y autorizado."

**Nota sobre `mecanico_id`:** MVP implementa un único mecánico por reparación. En V1, cuando se implemente multi-mecánico, se crea una tabla `reparacion_mecanicos` de unión. El campo `mecanico_id` se mantiene como el mecánico principal de coordinación.

**Validación de prerrequisitos:** la regla "una reparación no puede existir sin evento técnico cerrado y autorizado" se valida en la aplicación y en la política RLS de INSERT (ver §9.5). La base de datos garantiza la FK a eventos; la validación del estado del evento es responsabilidad de la capa de aplicación y del trigger de Trigger 1.

### 4.6 `items_reparacion`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `reparacion_id` | UUID | NOT NULL | — | FK → reparaciones.id |
| `tipo` | TEXT | NOT NULL | — | CHECK: `'mano_obra'` o `'repuesto'` |
| `descripcion` | TEXT | NOT NULL | — | Descripción del ítem ejecutado |
| `item_presupuesto_id` | UUID | NULL | — | FK → items_presupuesto.id; NULL en trabajos de garantía sin presupuesto previo. Traza qué ítem ejecutado corresponde a qué ítem presupuestado. DATABASE_MODEL §4.3: "Referencia a ítem del presupuesto autorizado." |
| `repuesto_id` | UUID | NULL | — | FK diferida → repuestos.id (Migration 004) |
| `cantidad` | NUMERIC(10,3) | NOT NULL | `1` | |
| `costo_unitario` | NUMERIC(12,2) | NOT NULL | — | Costo real incurrido; NUMERIC |
| `costo_total` | NUMERIC(12,2) | NOT NULL | — | = cantidad * costo_unitario. Denormalización deliberada: evita recálculo en queries de totales por reparación. Ver nota en §4.4. |
| `inicio_en` | TIMESTAMPTZ | NULL | — | Para mano de obra: inicio de la tarea |
| `fin_en` | TIMESTAMPTZ | NULL | — | Para mano de obra: fin de la tarea |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `creado_por` | UUID | NOT NULL | — | FK → usuarios.id |
| `eliminado_en` | TIMESTAMPTZ | NULL | — | Soft-delete |
| `eliminado_por` | UUID | NULL | — | FK → usuarios.id |

**Nota sobre tracking de tiempo:** `inicio_en` y `fin_en` permiten medir la duración real de cada tarea de mano de obra. Son NULL para ítems de repuesto. Esta información alimenta las métricas de eficiencia del taller y el análisis de IA (SYSTEM_ARCHITECTURE.md §3, módulo IA/Diagnóstico V1+).

### 4.7 `entregas`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `orden_trabajo_id` | UUID | NOT NULL | — | FK → ordenes_trabajo.id; UNIQUE(orden_trabajo_id) — una entrega por OT |
| `conductor_retiro_id` | UUID | NULL | — | FK → conductores.id; quien retiró el vehículo |
| `km_salida` | INTEGER | NULL | — | Odómetro al momento de la entrega |
| `forma_pago` | TEXT | NULL | — | CHECK: ver §5.5 |
| `monto_pagado` | NUMERIC(12,2) | NULL | — | Monto cobrado en esta entrega |
| `notas` | TEXT | NULL | — | Observaciones de la entrega |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | Timestamp de la entrega |
| `creado_por` | UUID | NOT NULL | — | FK → usuarios.id; quien realizó la entrega |

**No tiene `actualizado_en`:** la entrega es un acto puntual e inmutable. Si hubo error de registro, se documenta vía evento de corrección. PERSISTENCE_ARCHITECTURE.md §7.1: "Facturas y autorizaciones de presupuesto — Soft-delete solo (`eliminado_en`). Restricción contable y legal."

**No tiene `eliminado_en`:** la entrega es un registro legal de devolución del vehículo. No se puede "deshacer" una entrega a nivel de base de datos.

**Restricción UNIQUE:** `UNIQUE(orden_trabajo_id)` garantiza una sola entrega por OT. Es el hito final del flujo operacional.

### 4.8 `evidencias`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `evento_id` | UUID | NOT NULL | — | FK → eventos.id; NEVER NULL — toda evidencia pertenece a un evento |
| `tipo` | TEXT | NOT NULL | — | CHECK: ver §5.6 |
| `bucket_path` | TEXT | NOT NULL | — | Path en Supabase Storage: `{org_id}/{vehiculo_id}/{evento_id}/{uuid}.ext` |
| `mime_type` | TEXT | NOT NULL | — | MIME type validado en Edge Function antes del upload |
| `tamano_bytes` | BIGINT | NOT NULL | — | Tamaño del archivo para control de quota |
| `nombre_original` | TEXT | NULL | — | Nombre original del archivo (solo metadato, nunca como path) |
| `descripcion` | TEXT | NULL | — | Descripción de la evidencia |
| `visible_cliente` | BOOLEAN | NOT NULL | `false` | Controla visibilidad en Portal Cliente |
| `signed_url_cache` | TEXT | NULL | — | URL firmada cacheada (PERSISTENCE_ARCHITECTURE.md §3.2) |
| `url_expires_at` | TIMESTAMPTZ | NULL | — | Expiración de la URL cacheada |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `creado_por` | UUID | NOT NULL | — | FK → usuarios.id |

**No tiene `actualizado_en`:** las evidencias son inmutables (PERSISTENCE_ARCHITECTURE.md §3.3). `visible_cliente` es la única excepción admisible — puede cambiar para controlar qué ve el cliente. Sin embargo, el campo sí se puede actualizar directamente (sin trigger `set_updated_at`) porque `actualizado_en` no existe.

**Nota de diseño — `signed_url_cache` y `url_expires_at`:** implementan la optimización de PERSISTENCE_ARCHITECTURE.md §3.2. El servidor verifica `url_expires_at` antes de generar una nueva URL firmada. Esto elimina llamadas innecesarias a Storage API cuando un técnico revisa el mismo expediente múltiples veces.

**Nota de seguridad:** el campo `bucket_path` nunca expone una URL pública. Es un path interno de Storage. La URL firmada se genera en servidor previa validación de JWT y `org_id`. Nunca se almacena en `signed_url_cache` una URL que haya expirado; el servidor la invalida en el próximo request.

### 4.9 `garantias`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `reparacion_id` | UUID | NOT NULL | — | FK → reparaciones.id; NEVER NULL — toda garantía referencia la reparación original |
| `descripcion` | TEXT | NOT NULL | — | Qué cubre la garantía |
| `estado` | TEXT | NOT NULL | `'vigente'` | CHECK: ver §5.7 |
| `fecha_inicio` | DATE | NOT NULL | `CURRENT_DATE` | Inicio de la garantía |
| `fecha_vencimiento` | DATE | NULL | — | NULL si es vitalicia (inusual pero posible) |
| `km_vencimiento` | INTEGER | NULL | — | Kilómetros de vencimiento (opcional) |
| `condiciones` | TEXT | NULL | — | Condiciones y exclusiones de la garantía |
| `reclamada_en` | TIMESTAMPTZ | NULL | — | Timestamp de reclamo |
| `reclamada_por` | TEXT | NULL | — | Nombre o referencia del reclamante |
| `resolucion` | TEXT | NULL | — | Descripción de la resolución de la garantía |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `creado_por` | UUID | NOT NULL | — | FK → usuarios.id |

**No tiene `eliminado_en`:** el historial de garantías es información legal y contable. Una garantía no se elimina — cambia de estado. Si fue registrada por error, el estado pasa a `rechazada` con descripción en `resolucion`.

**Nota sobre `reparacion_id`:** DATABASE_MODEL §10, Regla 7: "Garantía debe referenciar la reparación original." No puede existir una garantía sin reparación asociada — es la FK que establece la cadena de responsabilidad.

---

## 5. Constraints

### 5.1 CHECK — `ordenes_trabajo.estado`

```sql
estado TEXT NOT NULL CHECK (estado IN (
  'pendiente_diagnostico',
  'diagnosticada',
  'presupuesto_pendiente',
  'presupuesto_enviado',
  'autorizada',
  'en_reparacion',
  'control_calidad',
  'lista_para_entrega',
  'entregada',
  'cerrada',
  'cancelada'
))
```

**Estados activos** (bloquean segunda OT para el mismo vehículo, ver Trigger §8.3):
todos excepto `cerrada` y `cancelada`.

### 5.2 CHECK — `citas.estado`

```sql
estado TEXT NOT NULL CHECK (estado IN (
  'programada',
  'confirmada',
  'cancelada',
  'realizada',
  'no_presentada'
))
```

### 5.3 CHECK — `presupuestos.estado`

```sql
estado TEXT NOT NULL CHECK (estado IN (
  'borrador',
  'enviado',
  'autorizado',
  'rechazado'
))
```

**Restricción de unicidad de versión activa** (ver §5.4 UNIQUE): no puede existir más de un presupuesto en estado `borrador` o `enviado` por `orden_trabajo_id`. Esta restricción se implementa como índice parcial UNIQUE (ver §7.3).

### 5.4 CHECK — `items_presupuesto.tipo` e `items_reparacion.tipo`

```sql
-- items_presupuesto
tipo TEXT NOT NULL CHECK (tipo IN ('mano_obra', 'repuesto'))

-- items_reparacion
tipo TEXT NOT NULL CHECK (tipo IN ('mano_obra', 'repuesto'))
```

### 5.5 CHECK — `entregas.forma_pago`

```sql
forma_pago TEXT CHECK (forma_pago IN (
  'efectivo',
  'transferencia',
  'tarjeta_debito',
  'tarjeta_credito',
  'cheque',
  'otro'
))
```

### 5.6 CHECK — `evidencias.tipo`

```sql
tipo TEXT NOT NULL CHECK (tipo IN (
  'foto',
  'video',
  'pdf',
  'firma_digital',
  'archivo_obd',
  'otro'
))
```

Estos tipos corresponden a los buckets y validaciones de `PERSISTENCE_ARCHITECTURE.md` §3.1.

### 5.7 CHECK — `garantias.estado`

```sql
estado TEXT NOT NULL CHECK (estado IN (
  'vigente',
  'reclamada',
  'vencida',
  'rechazada'
))
```

### 5.8 UNIQUE constraints

```sql
-- Business key OT: único por organización (no partial — es un número de documento)
UNIQUE (org_id, numero_ot) ON ordenes_trabajo

-- Una entrega por OT
UNIQUE (orden_trabajo_id) ON entregas

-- Versionado de presupuestos: presupuesto_anterior_id único (una versión siguiente por versión anterior)
UNIQUE (presupuesto_anterior_id) ON presupuestos
-- (permite NULL — el primer presupuesto de una OT tiene presupuesto_anterior_id = NULL)
```

### 5.9 CHECK — constraints relacionales adicionales

```sql
-- ordenes_trabajo: cerrado_en debe estar presente cuando estado es cerrada o cancelada
CHECK (
  (estado NOT IN ('cerrada', 'cancelada') AND cerrado_en IS NULL) OR
  (estado IN ('cerrada', 'cancelada') AND cerrado_en IS NOT NULL)
)

-- presupuestos: authorized_en implica estado = 'autorizado'
-- (No como CHECK de DB — la validación es de aplicación)

-- garantias: fecha_vencimiento debe ser posterior a fecha_inicio
CHECK (fecha_vencimiento IS NULL OR fecha_vencimiento > fecha_inicio)

-- reparaciones: fin_en debe ser posterior a inicio_en
CHECK (fin_en IS NULL OR inicio_en IS NULL OR fin_en > inicio_en)

-- items_reparacion: fin_en debe ser posterior a inicio_en
CHECK (fin_en IS NULL OR inicio_en IS NULL OR fin_en > inicio_en)
```

---

## 6. Foreign Keys

### 6.1 Completar FK diferida de Migration 002 (Paso 01b)

Esta FK fue declarada como diferida en Migration 002 porque `ordenes_trabajo` no existía aún. Se completa inmediatamente después de crear `ordenes_trabajo` en el Paso 01.

La FK entre `eventos.orden_trabajo_id` y `ordenes_trabajo.id` se activa en Migration 003 con ON DELETE RESTRICT. El detalle formal queda especificado en §6.2.

### 6.2 FKs nuevas en Migration 003

| Tabla | Columna | Referencia | Tipo | Nullable |
|---|---|---|---|---|
| `ordenes_trabajo` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `ordenes_trabajo` | `vehiculo_id` | `vehiculos.id` | ON DELETE RESTRICT | NOT NULL |
| `ordenes_trabajo` | `sucursal_id` | `sucursales.id` | ON DELETE SET NULL | NULL |
| `ordenes_trabajo` | `recepcionista_id` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `ordenes_trabajo` | `creado_por` | `usuarios.id` | ON DELETE RESTRICT | NOT NULL |
| `ordenes_trabajo` | `eliminado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `citas` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `citas` | `vehiculo_id` | `vehiculos.id` | ON DELETE RESTRICT | NOT NULL |
| `citas` | `cliente_id` | `clientes.id` | ON DELETE SET NULL | NULL |
| `citas` | `conductor_id` | `conductores.id` | ON DELETE SET NULL | NULL |
| `citas` | `sucursal_id` | `sucursales.id` | ON DELETE SET NULL | NULL |
| `citas` | `asignado_a` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `citas` | `recepcion_evento_id` | `eventos.id` | ON DELETE SET NULL | NULL |
| `citas` | `creado_por` | `usuarios.id` | ON DELETE RESTRICT | NOT NULL |
| `citas` | `eliminado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `presupuestos` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `presupuestos` | `orden_trabajo_id` | `ordenes_trabajo.id` | ON DELETE RESTRICT | NOT NULL |
| `presupuestos` | `presupuesto_anterior_id` | `presupuestos.id` | ON DELETE RESTRICT | NULL |
| `presupuestos` | `creado_por` | `usuarios.id` | ON DELETE RESTRICT | NOT NULL |
| `presupuestos` | `eliminado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `items_presupuesto` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `items_presupuesto` | `presupuesto_id` | `presupuestos.id` | ON DELETE RESTRICT | NOT NULL |
| `items_presupuesto` | `autorizador_id` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `items_presupuesto` | `creado_por` | `usuarios.id` | ON DELETE RESTRICT | NOT NULL |
| `items_presupuesto` | `eliminado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `reparaciones` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `reparaciones` | `orden_trabajo_id` | `ordenes_trabajo.id` | ON DELETE RESTRICT | NOT NULL |
| `reparaciones` | `evento_trabajo_id` | `eventos.id` | ON DELETE RESTRICT | NOT NULL |
| `reparaciones` | `mecanico_id` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `reparaciones` | `creado_por` | `usuarios.id` | ON DELETE RESTRICT | NOT NULL |
| `items_reparacion` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `items_reparacion` | `reparacion_id` | `reparaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `items_reparacion` | `item_presupuesto_id` | `items_presupuesto.id` | ON DELETE SET NULL | NULL |
| `items_reparacion` | `creado_por` | `usuarios.id` | ON DELETE RESTRICT | NOT NULL |
| `items_reparacion` | `eliminado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `entregas` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `entregas` | `orden_trabajo_id` | `ordenes_trabajo.id` | ON DELETE RESTRICT | NOT NULL |
| `entregas` | `conductor_retiro_id` | `conductores.id` | ON DELETE SET NULL | NULL |
| `entregas` | `creado_por` | `usuarios.id` | ON DELETE RESTRICT | NOT NULL |
| `evidencias` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `evidencias` | `evento_id` | `eventos.id` | ON DELETE RESTRICT | NOT NULL |
| `evidencias` | `creado_por` | `usuarios.id` | ON DELETE RESTRICT | NOT NULL |
| `garantias` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `garantias` | `reparacion_id` | `reparaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `garantias` | `creado_por` | `usuarios.id` | ON DELETE RESTRICT | NOT NULL |

### 6.3 FKs diferidas para Migrations futuras

| Tabla | Columna | Referencia diferida | Motivo |
|---|---|---|---|
| `items_presupuesto` | `repuesto_id` | `repuestos.id` | `repuestos` se crea en Migration 004 (inventario) |
| `items_reparacion` | `repuesto_id` | `repuestos.id` | `repuestos` se crea en Migration 004 |

**Nota sobre FK `conductores.id` ON DELETE SET NULL:** PHYSICAL_SCHEMA.md §3.3 define ON DELETE RESTRICT como regla base con excepción para `usuarios.id`. Las FKs a `conductores.id` en `citas.conductor_id` y `entregas.conductor_retiro_id` usan ON DELETE SET NULL de forma justificada: los conductores son registros de visita temporal — su eliminación no debe invalidar el historial de cita o entrega. Esta excepción aplica también a `eventos.conductor_id` de Migration 002.

Estas columnas existen desde Migration 003 como `UUID NULL` sin FK activa. Las FKs formales se añaden al inicio de Migration 004 via ALTER TABLE.

---

## 7. Índices

### 7.1 Índices en `ordenes_trabajo`

```
UNIQUE B-tree (org_id, numero_ot)
  — cubierto por UNIQUE constraint (§5.8); business key de la OT

B-tree (vehiculo_id, org_id)
  WHERE estado NOT IN ('cerrada', 'cancelada') AND eliminado_en IS NULL
  — CRÍTICO: hot path del trigger de unicidad de OT activa por vehículo.
  — org_id en la clave evita escanear filas de otros tenants con ese vehiculo_id.
  — Nota: creado_en DESC removido — el trigger hace SELECT EXISTS, no ORDER BY.

B-tree (org_id, estado, creado_en DESC)
  INCLUDE (numero_ot, vehiculo_id, sucursal_id)
  WHERE eliminado_en IS NULL
  — DASHBOARD: cubre filtro + orden + columnas de listado sin heap fetch

B-tree (org_id, creado_en DESC)
  WHERE eliminado_en IS NULL
  — Feed cronológico de OTs del taller

B-tree (recepcionista_id)
  WHERE eliminado_en IS NULL
  — FK index + query "OTs abiertas por este recepcionista"
```

**Justificación del índice de unicidad:** el trigger `fn_ot_unica_activa_por_vehiculo` hace `SELECT EXISTS (...WHERE vehiculo_id = NEW.vehiculo_id AND org_id = NEW.org_id AND estado NOT IN (...))`. El índice incluye `org_id` como segunda columna de la clave para evitar que PostgreSQL retorne filas de todos los tenants para ese vehículo y luego filtre por `org_id` en el heap. Sin `org_id` en la clave, en un sistema multi-tenant con vehículos compartidos entre talleres (patente duplicada en distintas orgs), el trigger haría un scan costoso por tenant.

### 7.2 Índices en `citas`

```
B-tree (org_id, fecha_cita)
  WHERE eliminado_en IS NULL AND estado IN ('programada', 'confirmada')
  — Vista de agenda: citas pendientes del taller

B-tree (vehiculo_id, fecha_cita DESC)
  WHERE eliminado_en IS NULL
  — Historial de citas de un vehículo

B-tree (org_id, creado_en DESC)
  WHERE eliminado_en IS NULL
  — RLS scan + feed cronológico

B-tree (recepcion_evento_id)
  WHERE recepcion_evento_id IS NOT NULL AND eliminado_en IS NULL
  — FK index: previene seq-scan cuando eventos.id se elimina (ON DELETE SET NULL evalúa esta FK)

B-tree (asignado_a)
  WHERE eliminado_en IS NULL
  — FK index: cola de citas por usuario asignado
```

### 7.3 Índices en `presupuestos`

```
B-tree (orden_trabajo_id)
  WHERE eliminado_en IS NULL
  — FK index + lookup presupuestos activos de una OT

UNIQUE B-tree (presupuesto_anterior_id)
  — cubierto por UNIQUE constraint (§5.8); un único "siguiente" por presupuesto

UNIQUE B-tree (orden_trabajo_id)
  WHERE estado IN ('borrador', 'enviado') AND eliminado_en IS NULL
  — Garantiza unicidad de versión activa por OT (ver §5.3)
```

### 7.4 Índices en `items_presupuesto`

```
B-tree (presupuesto_id)
  WHERE eliminado_en IS NULL
  — FK index + listar ítems de un presupuesto

B-tree (repuesto_id)
  WHERE repuesto_id IS NOT NULL AND eliminado_en IS NULL
  — FK index diferida + uso de repuesto en presupuestos
```

### 7.5 Índices en `reparaciones`

```
B-tree (orden_trabajo_id)
  — FK index + listar reparaciones de una OT

B-tree (evento_trabajo_id)
  — FK index + lookup bidireccional evento → reparación

B-tree (mecanico_id, creado_en DESC)
  WHERE fin_en IS NULL
  — Cola de trabajo activo del mecánico
```

### 7.6 Índices en `items_reparacion`

```
B-tree (reparacion_id)
  WHERE eliminado_en IS NULL
  — FK index + listar ítems de una reparación

B-tree (repuesto_id)
  WHERE repuesto_id IS NOT NULL AND eliminado_en IS NULL
  — FK index diferida + consumo de repuesto en reparaciones
```

### 7.7 Índices en `entregas`

```
UNIQUE B-tree (orden_trabajo_id)
  — cubierto por UNIQUE constraint (§5.8); una entrega por OT
```

### 7.8 Índices en `evidencias`

```
B-tree (evento_id, creado_en DESC)
  — HOT PATH: todas las evidencias de un evento, ordenadas

B-tree (org_id, creado_en DESC)
  — RLS scan + auditoría de uploads por tenant

B-tree (url_expires_at)
  WHERE signed_url_cache IS NOT NULL
  — Job de limpieza de URLs expiradas (cron) + verificación de caché
```

### 7.9 Índices en `garantias`

```
B-tree (reparacion_id)
  — FK index + lookup garantías de una reparación

B-tree (org_id, fecha_vencimiento)
  WHERE estado = 'vigente'
  — CRÍTICO: job diario de alertas de garantías próximas a vencer (SYSTEM_ARCHITECTURE.md §5)
  — estado removido de la clave: el predicado parcial ya lo garantiza (decisión E3-M1)

B-tree (org_id, creado_en DESC)
  — Feed cronológico de garantías del taller
```

---

## 8. Triggers

### 8.1 Funciones de trigger existentes (reutilizadas sin modificación)

| Función | Migrations que la crean | Descripción |
|---|---|---|
| `fn_set_updated_at()` | Migration 001 | Setea `NEW.actualizado_en = now()` en BEFORE UPDATE |
| `fn_audit_insert_trigger()` | Migration 001 | Captura INSERT/UPDATE y escribe en `audit_log` |

### 8.2 Trigger 1 — `fn_inmutabilidad_evento_cerrado()` (NUEVO)

```
Trigger:  BEFORE UPDATE ON eventos FOR EACH ROW
Nombre:   trg_01_eventos_inmutabilidad_cerrado

Comportamiento:
  1. Si OLD.cerrado_en IS NULL → permitir UPDATE (evento aún no cerrado)
  2. Si OLD.cerrado_en IS NOT NULL (evento cerrado):
     a. Verificar si el UPDATE intenta modificar un campo técnico.
        Campos técnicos protegidos (lista completa):
          historia_tecnica_id, tipo_evento_id, estado, titulo,
          descripcion, asignado_a, km_vehiculo, orden_trabajo_id,
          sucursal_id, conductor_id, cerrado_en,
          cancelado_en, cancelado_por, razon_cancelacion
        Campos NO protegidos (pueden actualizarse aunque evento esté cerrado):
          visible_cliente — flag de presentación; SECURITY_MODEL.md §6 excepción explícita
          eliminado_en / eliminado_por — soft-delete puede ejecutarse en eventos cerrados.
            Justificación: eliminar un evento ya cerrado es una corrección administrativa
            (ej: evento duplicado). Requiere rol admin. El audit_log registra la acción.
            DECISIÓN: aceptar soft-delete en cerrados para evitar bloquear correcciones urgentes.
     b. Si algún campo técnico protegido cambia → RAISE EXCEPTION con mensaje:
        'evento_inmutable: el evento % está cerrado y no puede modificarse.
         Campos permitidos: visible_cliente, eliminado_en, eliminado_por.'
     c. Si todos los cambios son en campos no protegidos → permitir UPDATE

  3. Devolver NEW (trigger BEFORE con éxito)

Implementación — detección de campos modificados:
  Comparar campo a campo OLD vs NEW para los campos protegidos.
  Cada comparación debe usar IS DISTINCT FROM para manejar correctamente NULL.

Orden de ejecución con otros triggers BEFORE UPDATE en `eventos`:
  - `trg_01_eventos_inmutabilidad_cerrado` ejecuta ANTES que `trg_50_eventos_set_updated_at`
    porque PostgreSQL ejecuta BEFORE triggers en orden alfabético por nombre.
    El prefijo `trg_01_` < `trg_50_` garantiza que si el trigger de inmutabilidad lanza
    RAISE EXCEPTION, el trigger de actualización de `actualizado_en` nunca se ejecuta.
    Esta convención de prefijos numéricos fue diseñada en MIGRATION_002_SPEC.md §8 
    (Convención M-11) precisamente para controlar este orden de ejecución.

Coexistencia con otros triggers:
  - `trg_01_eventos_inmutabilidad_cerrado` (en `eventos`) y 
    `trg_01_ordenes_trabajo_ot_unica_activa` (en `ordenes_trabajo`) operan sobre tablas
    distintas. Ninguno escribe en la tabla del otro. No hay riesgo de deadlock ni cascada
    cruzada entre estos dos triggers.
```

**Por qué es BEFORE:** un trigger BEFORE puede rechazar la operación con RAISE EXCEPTION. Un trigger AFTER no puede deshacer un UPDATE ya aplicado.

**Por qué no se implementó en Migration 002 (R-11):** MIGRATION_002_SPEC.md §8 documentó que Trigger 1 requería coordinación con la lógica de sincronización OT-Evento. Con `ordenes_trabajo` existiendo desde Migration 003, el trigger ya puede implementarse de forma completa.

### 8.3 Trigger OT única activa — `fn_ot_unica_activa_por_vehiculo()` (NUEVO)

```
Trigger:  BEFORE INSERT OR UPDATE ON ordenes_trabajo FOR EACH ROW
Nombre:   trg_01_ordenes_trabajo_ot_unica_activa

Comportamiento:
  1. Si la operación es INSERT, o si es UPDATE y NEW.estado NO es 'cerrada' ni 'cancelada':
     a. Adquirir un advisory lock de transacción sobre un hash derivado de vehiculo_id
        antes de verificar la existencia de otra OT activa.
        Justificación: sin advisory lock, dos transacciones concurrentes que hagan INSERT
        simultáneo pueden pasar ambas la verificación de existencia (ambas ven 0 OTs activas)
        y crear dos OTs activas para el mismo vehículo. El advisory lock serializa
        la verificación por vehiculo_id sin necesitar un índice UNIQUE parcial.
        Patrón idéntico al fn_anti_ciclo_referencias de Migration 002.
     b. Verificar si existe otra OT activa del mismo tenant y vehículo, excluyendo la fila
        actual en caso de UPDATE.
     c. Si existe → RAISE EXCEPTION indicando que el vehículo ya tiene una OT activa.

  2. Si el estado es 'cerrada' o 'cancelada' → nunca verificar (el vehículo queda libre)
  3. Devolver NEW

Invariante: DATABASE_MODEL §10, Regla 5: "Solo puede existir una OT activa por vehículo."

Optimización: el índice `B-tree (vehiculo_id, org_id) WHERE estado NOT IN ('cerrada', 'cancelada') AND eliminado_en IS NULL` hace que esta verificación sea O(log n) en lugar de seq-scan.
```

### 8.4 Tabla completa de triggers en Migration 003

| Tabla | Nombre trigger | Momento | Evento | Función |
|---|---|---|---|---|
| `eventos` | `trg_01_eventos_inmutabilidad_cerrado` | BEFORE | UPDATE | `fn_inmutabilidad_evento_cerrado()` |
| `ordenes_trabajo` | `trg_01_ordenes_trabajo_ot_unica_activa` | BEFORE | INSERT OR UPDATE | `fn_ot_unica_activa_por_vehiculo()` |
| `ordenes_trabajo` | `trg_10_ordenes_trabajo_set_cerrado_en` | BEFORE | UPDATE | `fn_set_cerrado_en()` |
| `ordenes_trabajo` | `trg_50_ordenes_trabajo_set_updated_at` | BEFORE | UPDATE | `fn_set_updated_at()` |
| `presupuestos` | `trg_01_presupuestos_version` | BEFORE | INSERT | `fn_versionar_presupuesto()` |
| `ordenes_trabajo` | `trg_99_ordenes_trabajo_audit` | AFTER | INSERT OR UPDATE | `fn_audit_insert_trigger()` |
| `citas` | `trg_50_citas_set_updated_at` | BEFORE | UPDATE | `fn_set_updated_at()` |
| `citas` | `trg_99_citas_audit` | AFTER | INSERT OR UPDATE | `fn_audit_insert_trigger()` |
| `presupuestos` | `trg_50_presupuestos_set_updated_at` | BEFORE | UPDATE | `fn_set_updated_at()` |
| `presupuestos` | `trg_99_presupuestos_audit` | AFTER | INSERT OR UPDATE | `fn_audit_insert_trigger()` |
| `items_presupuesto` | `trg_50_items_presupuesto_set_updated_at` | BEFORE | UPDATE | `fn_set_updated_at()` |
| `items_presupuesto` | `trg_99_items_presupuesto_audit` | AFTER | INSERT OR UPDATE OR DELETE | `fn_audit_insert_trigger()` |
| `reparaciones` | `trg_50_reparaciones_set_updated_at` | BEFORE | UPDATE | `fn_set_updated_at()` |
| `reparaciones` | `trg_99_reparaciones_audit` | AFTER | INSERT OR UPDATE | `fn_audit_insert_trigger()` |
| `items_reparacion` | `trg_50_items_reparacion_set_updated_at` | BEFORE | UPDATE | `fn_set_updated_at()` |
| `items_reparacion` | `trg_99_items_reparacion_audit` | AFTER | INSERT OR UPDATE OR DELETE | `fn_audit_insert_trigger()` |
| `entregas` | `trg_99_entregas_audit` | AFTER | INSERT | `fn_audit_insert_trigger()` |
| `evidencias` | `trg_99_evidencias_audit` | AFTER | INSERT | `fn_audit_insert_trigger()` |
| `garantias` | `trg_50_garantias_set_updated_at` | BEFORE | UPDATE | `fn_set_updated_at()` |
| `garantias` | `trg_99_garantias_audit` | AFTER | INSERT OR UPDATE | `fn_audit_insert_trigger()` |

**Notas de diseño:**

- `entregas`: solo trigger de INSERT — es inmutable (no hay UPDATE posible).
- `evidencias`: solo trigger de INSERT — son inmutables (`visible_cliente` se actualiza directamente con patch sin trigger de auditoría dado que no tiene `actualizado_en`; la visibilidad no es campo auditado).
- `reparaciones`: trigger de auditoría cubre INSERT y UPDATE — no DELETE (no tiene `eliminado_en`).
- `garantias`: trigger de auditoría cubre INSERT y UPDATE — los cambios de estado (`vigente → reclamada`) son críticos de auditar.
- `ordenes_trabajo`: el trigger `trg_99` NO cubre DELETE — el soft-delete via UPDATE de `eliminado_en` ya es capturado por el trigger de UPDATE.

### 8.5 Trigger — `fn_versionar_presupuesto()` (NUEVO)

```
Trigger:  BEFORE INSERT ON presupuestos FOR EACH ROW
Nombre:   trg_01_presupuestos_version

Comportamiento:
  1. Si presupuesto_anterior_id IS NULL:
     a. Iniciar en versión 1 (primer presupuesto de la OT).
  2. Si presupuesto_anterior_id IS NOT NULL:
     a. Leer la versión del presupuesto anterior dentro del mismo tenant.
     b. Si no existe presupuesto anterior en el mismo tenant → RAISE EXCEPTION
        (FK cross-tenant incoherente).
     c. Asignar la versión actual como versión anterior + 1.
  3. Devolver NEW.

Justificación: sin este trigger, la aplicación podría insertar versiones incorrectas o
saltarse versiones. El trigger garantiza la secuencia invariante desde la DB.
También actúa como segunda línea de defensa para validación cross-tenant del
presupuesto_anterior_id (primera línea: CHECK constraint en §5).

Naming: prefijo trg_01_ garantiza que se ejecuta antes de trg_50_presupuestos_set_updated_at.
```

### 8.6 Trigger — `trg_10_ordenes_trabajo_set_cerrado_en` (NUEVO — resolución R-09)

```
Trigger:  BEFORE UPDATE ON ordenes_trabajo FOR EACH ROW
Nombre:   trg_10_ordenes_trabajo_set_cerrado_en

Decisión Architecture Board: implementar como trigger automático (opción 1 de R-09).
Motivación: un UPDATE de estado a 'cerrada'/'cancelada' sin cerrado_en
              podría violar el CHECK constraint (§5.9) si la aplicación olvida incluirlo.
              El trigger lo setea automáticamente y elimina la complejidad del cliente.

Comportamiento:
  1. Si el estado nuevo es 'cerrada' o 'cancelada' y el estado anterior no lo era:
     a. Si cerrado_en no fue incluido en el UPDATE, setear cerrado_en al timestamp actual.
  2. Si el estado nuevo no es 'cerrada' ni 'cancelada' pero cerrado_en ya estaba seteado:
     a. Emitir un error semántico indicando que una OT cerrada no puede reabrirse.
  3. Devolver NEW.

Naming: prefijo trg_10_ garantiza que ejecuta después de trg_01_ordenes_trabajo_ot_unica_activa
y antes de trg_50_ordenes_trabajo_set_updated_at.
```

**Convención de nomenclatura (M-11 de PHYSICAL_SCHEMA.md):**
- `trg_01_` BEFORE trigger
- `trg_50_` BEFORE UPDATE (set_updated_at)
- `trg_80_` AFTER INSERT (lógica de dominio post-insert)
- `trg_99_` AFTER DML (audit)

**Requerimientos de SECURITY DEFINER:**

Las cuatro funciones nuevas de trigger (`fn_inmutabilidad_evento_cerrado`, `fn_ot_unica_activa_por_vehiculo`, `fn_versionar_presupuesto`, `fn_set_cerrado_en`) deben crearse con:
- `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`
- `ALTER FUNCTION ... OWNER TO postgres` (para garantizar BYPASSRLS en verificaciones cross-table)

---

## 9. RLS (Row Level Security)

Todas las tablas nuevas tienen RLS habilitado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).

Los roles mencionados corresponden al valor retornado por `mi_rol()` (función SECURITY DEFINER de Migration 001).

### 9.1 `ordenes_trabajo`

```sql
-- SELECT: mecánico ve solo OTs activas de su organización
POLICY "ordenes_trabajo_select"
  FOR SELECT USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
  )

-- INSERT: recepcionista, jefe_taller y admin pueden abrir OTs
POLICY "ordenes_trabajo_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )

-- UPDATE: todos los roles operacionales pueden actualizar estado
--   WITH CHECK previene cambio de org_id y cambios a OT de otro tenant
POLICY "ordenes_trabajo_update"
  FOR UPDATE
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND (
      mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
      OR (mi_rol() = 'mecanico' AND cerrado_en IS NULL)
    )
  )

-- DELETE: bloqueado (soft-delete via UPDATE de eliminado_en)
```

**Nota sobre `mecanico`:** el mecánico puede ver y actualizar la OT (registrar avances), pero no puede cerrarla ni eliminarla. La restricción `cerrado_en IS NULL` en WITH CHECK impide que el mecánico setee `cerrado_en`.

### 9.2 `citas`

```sql
POLICY "citas_select"
  FOR SELECT USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
  )

POLICY "citas_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )

POLICY "citas_update"
  FOR UPDATE
  USING (org_id = mi_org_id() AND eliminado_en IS NULL AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista'))
  WITH CHECK (org_id = mi_org_id())
```

### 9.3 `presupuestos`

```sql
-- Mecánico NO puede ver precios (SECURITY_MODEL.md §7 y §12, Regla 9)
POLICY "presupuestos_select"
  FOR SELECT USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )

POLICY "presupuestos_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
    -- BLOCKER-SEC-1: verificar que la OT padre pertenece al mismo tenant
    -- Previene que un rol malicioso cree presupuestos apuntando a OTs de otro tenant
    AND (SELECT org_id FROM ordenes_trabajo WHERE id = orden_trabajo_id) = mi_org_id()
  )

POLICY "presupuestos_update"
  FOR UPDATE
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id())
```

### 9.4 `items_presupuesto`

```sql
-- Mecánico NO puede ver precios
POLICY "items_presupuesto_select"
  FOR SELECT USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )

POLICY "items_presupuesto_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
    -- BLOCKER-SEC-1: verificar que el presupuesto padre pertenece al mismo tenant
    AND (SELECT org_id FROM presupuestos WHERE id = presupuesto_id) = mi_org_id()
  )

POLICY "items_presupuesto_update"
  FOR UPDATE
  USING (org_id = mi_org_id() AND eliminado_en IS NULL AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista'))
  WITH CHECK (org_id = mi_org_id())
```

### 9.5 `reparaciones`

```sql
-- Mecánico puede ver y actualizar sus reparaciones (trabajo técnico)
-- No puede ver datos financieros — esos están en items_presupuesto (§9.4)
POLICY "reparaciones_select"
  FOR SELECT USING (
    org_id = mi_org_id()
  )

-- Solo roles con visión técnica completa pueden crear reparaciones
POLICY "reparaciones_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  )

-- Mecánico puede actualizar solo si es el mecánico asignado
POLICY "reparaciones_update"
  FOR UPDATE
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND (
      mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
      OR (mi_rol() = 'mecanico' AND mecanico_id = auth.uid())
    )
  )
```

**Nota:** la validación de "evento autorizado y cerrado" antes de crear una reparación es responsabilidad de la aplicación (Route Handler o Edge Function). La política RLS de INSERT solo valida `org_id` y rol — no puede verificar el estado del evento referenciado sin un subquery que impactaría el performance de toda evaluación RLS.

### 9.6 `items_reparacion`

```sql
-- SELECT: mecánico puede ver items de sus reparaciones (trabajo técnico)
--   PERO NO puede ver costo_unitario ni costo_total (datos financieros)
--   Solución MVP: la vista v_items_reparacion_mecanico (Migration 006) filtrará las columnas.
--   Por ahora, la política RLS no puede filtrar columnas individuales —
--   el mecánico recibe la fila completa. La aplicación/Edge Function
--   NO debe exponer costo_unitario/costo_total al rol mecanico.
--   DECISIÓN: aceptar para MVP y documentar como deuda técnica de Migration 006.
POLICY "items_reparacion_select"
  FOR SELECT USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
  )

POLICY "items_reparacion_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
    -- BLOCKER-SEC-1: verificar que la reparación padre pertenece al mismo tenant
    AND (SELECT org_id FROM reparaciones WHERE id = reparacion_id) = mi_org_id()
  )

POLICY "items_reparacion_update"
  FOR UPDATE
  USING (org_id = mi_org_id() AND eliminado_en IS NULL AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico'))
  WITH CHECK (org_id = mi_org_id())
```

**Deuda técnica (Migration 006):** crear vista `v_items_reparacion_mecanico` que excluya `costo_unitario` y `costo_total`. El mecánico consultaría solo via esta vista. Hasta entonces, la capa de aplicación es la única barrera. SECURITY_MODEL.md §6 lo clasifica como violación de Regla 9 si se expone al cliente API del mecánico.

### 9.7 `entregas`

```sql
-- Entregas visibles para todos los roles operacionales (no mecánico — tiene acceso a km pero no a pago)
POLICY "entregas_select"
  FOR SELECT USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )

-- Solo recepción registra la entrega
POLICY "entregas_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )

-- No existe policy UPDATE: entregas son inmutables
-- No existe policy DELETE: entregas son inmutables
```

### 9.8 `evidencias`

```sql
-- Mecánico puede ver y subir evidencias (es su herramienta de trabajo principal)
POLICY "evidencias_select"
  FOR SELECT USING (org_id = mi_org_id())

-- Insert: todos los roles operacionales
POLICY "evidencias_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  )

-- UPDATE limitado: solo visible_cliente puede modificarse (único campo mutable en evidencias)
--   LIMITACIÓN: RLS FOR UPDATE no puede restringir columnas individuales.
--   La política permite UPDATE de cualquier columna técnicamente.
--   Defensa: el trigger fn_inmutabilidad_evento_cerrado no aplica a evidencias directamente.
--   MITIGACIÓN ELEGIDA: la capa de aplicación (Route Handler / Edge Function) debe incluir
--   ÚNICAMENTE { visible_cliente: true/false } en el payload. No pasar otros campos.
--   El API nunca debe exponer un endpoint PUT /evidencias/:id que permita fields arbitrarios.
--   DECISIÓN Architecture Board: aceptar para MVP. Alternativa rechazada fue column-level RLS
--   via función SECURITY DEFINER con TG_OP check — introduce complejidad sin ganancia real
--   dado que la capa de aplicación es suficientemente estrecha.
POLICY "evidencias_update_visible_cliente"
  FOR UPDATE
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id())

-- No existe policy DELETE: evidencias son inmutables
```

### 9.9 `garantias`

```sql
-- Garantías visibles para todos (información técnica relevante para el mecánico)
POLICY "garantias_select"
  FOR SELECT USING (org_id = mi_org_id())

-- Solo roles con visión completa crean garantías
POLICY "garantias_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
    -- BLOCKER-SEC-1: verificar que la reparación padre pertenece al mismo tenant
    AND (SELECT org_id FROM reparaciones WHERE id = reparacion_id) = mi_org_id()
  )

-- Cambios de estado de garantías (reclamar, vencer, rechazar)
POLICY "garantias_update"
  FOR UPDATE
  USING (org_id = mi_org_id() AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista'))
  WITH CHECK (org_id = mi_org_id())
```

---

## 10. Seeds e inicialización

**No hay seeds en Migration 003.**

No existen catálogos globales que deban poblarse en esta migración. Las tablas de dominio operacional (`ordenes_trabajo`, `presupuestos`, etc.) son estrictamente per-tenant y se pueblan durante la operación del sistema.

**Impacto en onboarding:** cuando se activa un nuevo tenant, no se requiere ninguna acción adicional en Migration 003. El onboarding sigue el flujo definido en MIGRATION_001_SPEC.md §9.2. El primer evento de tipo `recepcion` será el que cree la primera OT.

---

## 11. Relación con Migrations anteriores y siguientes

### 11.1 Dependencias de Migration 003 (qué debe existir antes)

| Migración | Por qué se necesita |
|---|---|
| **Migration 001** | Tablas `organizaciones`, `sucursales`, `usuarios`, funciones RLS (`mi_org_id()`, `mi_rol()`), `fn_set_updated_at()`, `fn_audit_insert_trigger()` |
| **Migration 002** | Tablas `vehiculos`, `clientes`, `conductores`, `eventos`, `historias_tecnicas`; columna `eventos.orden_trabajo_id` (UUID NULL sin FK) lista para recibir la FK de Paso 01b |

**Prerequisito crítico:** la columna `eventos.orden_trabajo_id` debe existir sin FK activa antes de ejecutar el Paso 01b de Migration 003. Verificar que Migration 002 esté completamente aplicada.

### 11.2 Lo que depende de Migration 003

| Migración / Componente | Por qué depende de 003 |
|---|---|
| **Migration 004** (Inventario) | `items_presupuesto.repuesto_id` y `items_reparacion.repuesto_id` reciben sus FKs en Migration 004 al crear `repuestos` |
| **Migration 004** (Facturación) | `facturas.orden_trabajo_id → ordenes_trabajo.id` se declara en Migration 004 |
| **Sprint: Flujo OT completo** | Ningún sprint que involucre apertura de OT, presupuesto, reparación o entrega puede comenzar antes de Migration 003 |
| **Trigger 1** | Resuelve R-11 de Migration 002 — el sprint de "mecanico cierra evento" no puede ir a producción antes de este trigger |
| **Módulo de Garantías** | `garantias` → `reparaciones` → `ordenes_trabajo`; toda la cadena existe en Migration 003 |

### 11.3 Preguntas abiertas que no bloquean Migration 003

| PA | Descripción | Impacto |
|---|---|---|
| **PA9** | Diseño oficial de `citas` en DATABASE_MODEL.md | El diseño provisional de §4.2 es funcional para MVP. Si cambia, requiere migration correctiva. |
| **PA-M3-1** | `autorizaciones` como tabla formal de registro de decisiones del cliente | Por ahora se registra en `presupuestos.autorizado_en` + evento tipo `autorizacion`. La tabla formal se añade en sprint de presupuestos avanzados. |
| **PA-M3-2** | `controles_calidad` como tabla independiente | Por ahora el estado `control_calidad` de la OT es suficiente. La tabla formal se añade en sprint de calidad. |
| **PA-M3-3** | Multi-mecánico en reparaciones | `reparaciones.mecanico_id` es MVP. La tabla `reparacion_mecanicos` de unión se crea cuando el dominio lo requiera. |

---

## 12. Riesgos

| # | Riesgo | Severidad | Probabilidad | Mitigación |
|---|---|---|---|---|
| R-01 | **FK diferida 01b aplicada antes de crear `ordenes_trabajo`** — ALTER TABLE falla con error de tabla inexistente. | Alto | Media (error de orden) | Paso 01b está explícitamente después de Paso 01 en §2. Checklist §13 verifica el orden. |
| R-02 | **Trigger 1 falta campo protegido** — si la lista de campos técnicos de `eventos` está incompleta en `fn_inmutabilidad_evento_cerrado`, un campo crítico puede modificarse en eventos cerrados. | Alto | Media | Cruzar la lista de campos con DATABASE_MODEL §4.7 antes de implementar. Smoke test: intentar UPDATE de cada campo en evento cerrado. |
| R-03 | **Trigger OT única activa race condition** — ~~dos INSERTs concurrentes de OTs para el mismo vehículo pueden pasar el check si ocurren en el mismo milisegundo.~~ **RESUELTO:** §8.3 añade `pg_advisory_xact_lock(hashtext('ot_activa_' || vehiculo_id::text))` al inicio del trigger, serializando el check por vehiculo_id. Patrón idéntico a Migration 002 §8.3. | Bajo | N/A — resuelto | Advisory lock implementado en §8.3. |
| R-04 | **presupuesto_anterior_id FK circular en CREATE TABLE** — la tabla no puede referenciar a sí misma con FK en la misma sentencia DDL. | Alto | Alta (error común) | Patrón documentado en §2: columna UUID NULL en CREATE TABLE, luego ALTER TABLE en el mismo Paso 03. |
| R-05 | **items_presupuesto.repuesto_id sin FK** — puede insertarse un UUID inexistente hasta que Migration 004 añada la FK. La integridad es responsabilidad de la aplicación en ese periodo. | Medio | Baja | Documentado en §6.3. La aplicación valida el repuesto_id contra la tabla repuestos antes del INSERT. |
| R-06 | **Mecánico con acceso a presupuestos** — la política RLS de `presupuestos` bloquea al mecánico. Si una Edge Function usa `service_role` para cargar datos de OT incluyendo presupuestos, el mecánico podría recibir precios vía la API. | Alto | Media | Toda Edge Function que sirva datos al mecánico debe usar el Browser Client con el JWT del mecánico, no service_role. SECURITY_MODEL.md §6: "El Mecánico no recibe datos del cliente ni datos financieros en ninguna respuesta de API." |
| R-07 | **Evidencias sin soft-delete pueden no cumplir Ley 19.628** — si un cliente solicita supresión de datos personales, las fotos de su vehículo no pueden borrarse por `eliminado_en`. | Medio | Baja | PERSISTENCE_ARCHITECTURE.md §7.2: el binario en Storage puede eliminarse; el registro en `evidencias` permanece con `bucket_path = NULL`. La supresión se gestiona por proceso de administración, no por RLS. Documentado como gap conocido. |
| R-08 | **Trigger 1 no cubre `ordenes_trabajo`** — un evento puede quedar inmutable pero la OT sigue siendo mutable. Decisión de diseño correcta: la OT tiene su propio ciclo de vida (puede cerrarse sin que todos sus eventos estén cerrados en MVP). Documentado para no causar confusión. | Bajo | Alta (preguntas frecuentes) | Documentado aquí: la inmutabilidad de Trigger 1 aplica solo a `eventos`. La OT se cierra via cambio de estado con el trigger `fn_ot_unica_activa_por_vehiculo` que libera el vehículo. |
| R-09 | **cerrado_en en ordenes_trabajo no seteado por trigger** — ~~si la aplicación no setea `cerrado_en` al cambiar el estado, el UPDATE falla con constraint violation.~~ **RESUELTO:** §8.6 añade `trg_10_ordenes_trabajo_set_cerrado_en` que setea `cerrado_en = NOW()` automáticamente cuando `estado` cambia a `cerrada`/`cancelada`. La aplicación no necesita incluirlo en el UPDATE. | Bajo | N/A — resuelto | Trigger implementado en §8.6. |
| R-10 | **UNIQUE(orden_trabajo_id) en entregas** — si por error de aplicación se intenta crear una segunda entrega para la misma OT, el UNIQUE falla con error de constraint. Es el comportamiento correcto, pero la aplicación debe manejar este error con un mensaje al usuario. | Bajo | Media | El error de PostgreSQL `23505` es manejable por la aplicación con mensaje "Esta OT ya tiene una entrega registrada." |
| R-11 | **Diseño provisional de `citas` (PA9)** — si DATABASE_MODEL es actualizado con un esquema diferente, se requiere una migration correctiva. La tabla provisional puede acumular datos que sean incompatibles con el esquema oficial. | Medio | Media | PA9 documentada como tal. El sprint de citas debe comenzar con la actualización de DATABASE_MODEL, no con la implementación. |
| R-12 | **`entregas` no tiene UPDATE policy** — entregas son inmutables por diseño. Sin embargo, no existe ningún mecanismo DB que impida un UPDATE de service_role a una entrega (ej: corrección de forma de pago). | Medio | Baja | Aceptar para MVP. Entregas son inmutables por convención de aplicación y por ausencia de `actualizado_en`. Cualquier corrección administrativa requiere acceso directo de DB con log de cambio manual. Documentado como gap conocido. |
| R-13 | **items_reparacion.costo_unitario accesible al mecánico vía RLS** — la política SELECT no puede filtrar columnas en PostgreSQL. El mecánico con JWT válido puede hacer SELECT * y ver precios. | Alto | Media | La capa de aplicación es la única barrera en MVP. No exponer `costo_unitario`/`costo_total` en endpoints del rol mecánico. Migration 006 crea vista `v_items_reparacion_mecanico` sin columnas financieras. |
| R-14 | **autorizaciones ausentes como tabla formal** — el contrato del cliente (cliente autoriza el presupuesto) solo se registra en `presupuestos.autorizado_en` y en un evento. No hay registro inmutable y firmado. | Medio | Media | PA-M3-1 documentada. Para MVP, `presupuestos.autorizado_en` + `autorizado_por_nombre` es suficiente. La tabla `autorizaciones` (registro legal) se añade en sprint de presupuestos avanzados. |

---

## 13. Checklist pre-SQL

Verificar cada ítem antes de comenzar a escribir el SQL de Migration 003.

### Prerequisitos (antes de ejecutar Migration 003)

- [ ] Migration 001 completamente aplicada y verificada (checklist §11 de MIGRATION_001_SPEC.md)
- [ ] Migration 002 completamente aplicada y verificada (checklist de MIGRATION_002_SPEC.md)
- [ ] `eventos.orden_trabajo_id` existe como columna UUID NULL sin FK activa
- [ ] Confirmar que `ordenes_trabajo` NO existe todavía (`SELECT to_regclass('ordenes_trabajo') IS NULL`)

### Funciones nuevas

- [ ] `fn_inmutabilidad_evento_cerrado()` creada con `SECURITY DEFINER SET search_path = public`
- [ ] `fn_inmutabilidad_evento_cerrado()` `OWNER TO postgres`
- [ ] `fn_ot_unica_activa_por_vehiculo()` creada con `SECURITY DEFINER SET search_path = public`
- [ ] `fn_ot_unica_activa_por_vehiculo()` `OWNER TO postgres`

### Orden de creación

- [ ] Paso 01 ejecutado: `ordenes_trabajo` existe (`SELECT to_regclass('ordenes_trabajo') IS NOT NULL`)
- [ ] Paso 01b ejecutado: FK `eventos.orden_trabajo_id → ordenes_trabajo.id` activa (verificar en `pg_constraint`)
- [ ] Paso 02: `citas` existe
- [ ] Paso 03: `presupuestos` existe; FK `presupuesto_anterior_id → presupuestos.id` activa
- [ ] Paso 04: `items_presupuesto` existe
- [ ] Paso 05: `reparaciones` existe
- [ ] Paso 06: `items_reparacion` existe
- [ ] Paso 07: `entregas` existe
- [ ] Paso 08: `evidencias` existe
- [ ] Paso 09: `garantias` existe

### Constraints

- [ ] `ordenes_trabajo.estado` CHECK activo con los 11 estados
- [ ] `ordenes_trabajo` UNIQUE(org_id, numero_ot) activo
- [ ] `ordenes_trabajo` CHECK (cerrado_en consistente con estado) activo
- [ ] `presupuestos.estado` CHECK activo
- [ ] UNIQUE(presupuesto_anterior_id) activo en `presupuestos`
- [ ] UNIQUE(orden_trabajo_id) activo en `entregas`
- [ ] `garantias` CHECK (fecha_vencimiento > fecha_inicio) activo
- [ ] `items_reparacion` CHECK (fin_en > inicio_en) activo

### Índices críticos

- [ ] `idx_ordenes_trabajo_vehiculo_activo`: B-tree `(vehiculo_id, org_id) WHERE estado NOT IN ('cerrada', 'cancelada') AND eliminado_en IS NULL`
- [ ] `idx_ordenes_trabajo_org_estado`: B-tree `(org_id, estado, creado_en DESC) INCLUDE (numero_ot, vehiculo_id, sucursal_id) WHERE eliminado_en IS NULL`
- [ ] `idx_citas_recepcion_evento`: B-tree `(recepcion_evento_id) WHERE recepcion_evento_id IS NOT NULL AND eliminado_en IS NULL`
- [ ] `idx_citas_asignado_a`: B-tree `(asignado_a) WHERE eliminado_en IS NULL`
- [ ] UNIQUE parcial en `presupuestos(orden_trabajo_id) WHERE estado IN ('borrador', 'enviado') AND eliminado_en IS NULL`
- [ ] `idx_garantias_vigentes`: B-tree `(org_id, fecha_vencimiento) WHERE estado = 'vigente'`

### Triggers

- [ ] `fn_inmutabilidad_evento_cerrado` y `fn_ot_unica_activa_por_vehiculo` y `fn_versionar_presupuesto` y `fn_set_cerrado_en` — todas con `SECURITY DEFINER SET search_path = public` y `OWNER TO postgres`
- [ ] `trg_01_eventos_inmutabilidad_cerrado` activo en `eventos`
- [ ] **Smoke test Trigger 1:** INSERT evento → cerrar (`cerrado_en = NOW()`) → intentar UPDATE de `estado` → debe fallar con EXCEPTION
- [ ] **Smoke test Trigger 1 excepción:** UPDATE `visible_cliente` en evento cerrado → debe permitirse
- [ ] `trg_01_ordenes_trabajo_ot_unica_activa` activo en `ordenes_trabajo`
- [ ] **Smoke test OT única:** crear OT activa para vehículo V → intentar crear segunda OT activa para V → debe fallar
- [ ] **Smoke test OT cerrada:** cerrar OT 1 → crear OT 2 para mismo vehículo → debe permitirse

### RLS

- [ ] RLS habilitado en todas las tablas nuevas (9 tablas)
- [ ] **Test aislamiento cross-tenant:** insert OT en tenant A → autenticar como usuario tenant B → `SELECT * FROM ordenes_trabajo` → debe retornar 0 filas
- [ ] **Test mecanico sin precios:** autenticar como mecánico → `SELECT * FROM presupuestos` → debe retornar 0 filas
- [ ] **Test mecanico sin presupuesto:** autenticar como mecánico → `SELECT * FROM items_presupuesto` → debe retornar 0 filas
- [ ] **Test evidencias mecanico:** autenticar como mecánico → INSERT en `evidencias` con `org_id` correcto y evento de la org → debe permitirse

### Generación de tipos TypeScript

- [ ] Ejecutar `pnpm db:types`
- [ ] `packages/database/src/types/index.ts` actualizado con los 9 nuevos tipos de tablas
- [ ] `pnpm typecheck` pasa en todo el monorepo sin errores nuevos

### Gate para Migration 004

- [ ] Todos los ítems anteriores verificados
- [x] R-09 (`cerrado_en` en OT) — **RESUELTO:** trigger `trg_10_ordenes_trabajo_set_cerrado_en` en §8.6
- [x] R-03 (race condition OT única activa) — **RESUELTO:** advisory lock en §8.3
- [ ] PA9 (`citas`) comunicada al product owner: confirmar diseño provisional o actualizar DATABASE_MODEL
- [ ] PA-M3-1 (`autorizaciones`) comunicada: sprint de presupuestos avanzados en backlog
- [ ] **Smoke test Trigger 1 extendido:** UPDATE `titulo` en evento cerrado → debe fallar; UPDATE `eliminado_en` en evento cerrado → debe permitirse (confirmar decisión §8.2)
- [ ] **Smoke test cerrado_en automático:** UPDATE `estado = 'cerrada'` sin incluir `cerrado_en` en el payload → debe setearse automáticamente a `NOW()`
- [ ] **Smoke test BLOCKER-SEC-1:** usuario de tenant A intentar INSERT `presupuesto.orden_trabajo_id` = UUID de OT de tenant B → debe ser rechazado con RLS
- [ ] **Smoke test versioning:** INSERT presupuesto v1 sin `presupuesto_anterior_id` → `version = 1`; INSERT v2 con `presupuesto_anterior_id = v1.id` → `version = 2`

---

## 14. Architecture Board Review

**Estado:** APROBADO CON CONDICIONES (v0.2) — Architecture Board completado. Todos los BLOCKERs resueltos. Issues HIGH resueltos o documentados como deuda técnica aceptada. Pendiente aprobación humana.

### Resumen del ciclo de revisión v0.1 → v0.2

Architecture Board ejecutado en paralelo con 7 especialistas sobre el borrador v0.1. Los hallazgos de los 7 especialistas se consolidaron y se aplicaron como correcciones a este documento. El documento resultante es v0.2.

---

### Hallazgos por especialista

#### Especialista 1 — Database Design & Normalization

| # | Sev | Hallazgo | Estado en v0.2 |
|---|---|---|---|
| E1-B1 | BLOCKER | `items_reparacion` no tiene FK a `items_presupuesto`. DATABASE_MODEL requiere "referencia a ítem del presupuesto autorizado" | **RESUELTO** — §4.6 añade `item_presupuesto_id UUID NULL FK → items_presupuesto.id ON DELETE SET NULL` |
| E1-H1 | HIGH | `diagnosticos` omitida del scope sin justificación | **RESUELTO** — §1 añade exclusión explícita con justificación y gap funcional documentado |
| E1-H2 | HIGH | `presupuestos.version` sin constraint de incremento correcto | **RESUELTO** — §8.5 añade trigger `fn_versionar_presupuesto` BEFORE INSERT en `presupuestos` |
| E1-M1 | MEDIUM | `presupuesto_anterior_id` UNIQUE permite múltiples raíces NULL por OT | **ACEPTADO** — NULL en UNIQUE es estándar PostgreSQL (múltiples NULLs posibles). La restricción de un solo presupuesto activo por OT está cubierta por el índice parcial UNIQUE `(orden_trabajo_id) WHERE estado IN ('borrador', 'enviado')`. Raíces múltiples (v1 cerrada + v2 borrador) son válidas en el dominio. |
| E1-M2 | MEDIUM | `reclamaciones_garantia` no documentada como PA | **RESUELTO** — implícita en el ciclo de reclamación de §4.9. La tabla `reclamaciones_garantia` se añade en sprint de garantías avanzadas. Documentado como gap en §11.3 (PA-M3-4 pendiente). |
| E1-M3 | MEDIUM | `costo_total`/`precio_total` calculados sin justificación de denormalización | **RESUELTO** — §4.6 añade nota de denormalización deliberada con justificación de performance. |

#### Especialista 2 — Security & RLS

| # | Sev | Hallazgo | Estado en v0.2 |
|---|---|---|---|
| E2-B1 | BLOCKER | `presupuestos` INSERT sin verificación cross-tenant del `orden_trabajo_id` | **RESUELTO** — §9.3 añade subquery BLOCKER-SEC-1 |
| E2-B2 | BLOCKER | `items_presupuesto` INSERT sin verificación del `presupuesto_id` | **RESUELTO** — §9.4 añade subquery BLOCKER-SEC-1 |
| E2-H1 | HIGH | `evidencias` UPDATE policy permite actualizar cualquier columna | **RESUELTO** — §9.8 documenta la limitación de RLS, decisión Architecture Board de aceptar MVP, mitigación via capa de aplicación |
| E2-H2 | HIGH | `items_reparacion` SELECT expone `costo_unitario`/`costo_total` al mecánico | **RESUELTO** — §9.6 documenta la limitación, deuda técnica Migration 006, mitigación via aplicación |
| E2-M1 | MEDIUM | `entregas` sin UPDATE policy — gap operacional si hay error de cobro | **RESUELTO** — R-12 añadido en §12. Aceptado como gap MVP. |
| E2-M2 | MEDIUM | Trigger 1 como segunda línea de defensa incompleto para RLS | **ACEPTADO** — el trigger actúa sobre `eventos`, no sobre las tablas nuevas. Las tablas nuevas tienen BLOCKER-SEC-1 en sus INSERT policies. |

#### Especialista 3 — Performance & Indexing

| # | Sev | Hallazgo | Estado en v0.2 |
|---|---|---|---|
| E3-B1 | BLOCKER | Índice de unicidad de OT activa faltaba `org_id`, `creado_en DESC` innecesario | **RESUELTO** — §7.1 cambia a `(vehiculo_id, org_id) WHERE estado NOT IN (...) AND eliminado_en IS NULL` |
| E3-H1 | HIGH | Dashboard index `(org_id, estado)` sin INCLUDE | **RESUELTO** — §7.1 añade `INCLUDE (numero_ot, vehiculo_id, sucursal_id)` |
| E3-H2 | HIGH | `citas.recepcion_evento_id` y `citas.asignado_a` sin índices de FK | **RESUELTO** — §7.2 añade `idx_citas_recepcion_evento` e `idx_citas_asignado_a` |
| E3-M1 | MEDIUM | `garantias` índice con `estado` redundante en columna y predicado | **RESUELTO** — §7.7 simplifica a `(org_id, fecha_vencimiento) WHERE estado = 'vigente'` |
| E3-M2 | MEDIUM | `evidencias` URL cleanup index — decisión de `org_id` pendiente | **ACEPTADO** — índice `(url_expires_at) WHERE url_expires_at IS NOT NULL` sin `org_id`. El cleanup job de Supabase Edge Function usa service_role sin filtro de tenant, por lo que no necesita `org_id` en la clave. |

#### Especialista 4 — Trigger Design & Correctness

| # | Sev | Hallazgo | Estado en v0.2 |
|---|---|---|---|
| E4-H1 | HIGH | Campos `sucursal_id`, `conductor_id`, `titulo`, `orden_trabajo_id` faltantes en lista de campos protegidos de Trigger 1 | **RESUELTO** — §8.2 amplía la lista completa de campos protegidos |
| E4-H2 | HIGH | OT única activa sin advisory lock — race condition | **RESUELTO** — §8.3 añade `pg_advisory_xact_lock` |
| E4-M1 | MEDIUM | `eliminado_en` en eventos cerrados no declarado como excepción explícita | **RESUELTO** — §8.2 documenta `eliminado_en`/`eliminado_por` como campos NO protegidos con justificación (corrección administrativa de admin) |
| E4-M2 | MEDIUM | R-09 cerrado_en — recomendar trigger automático | **RESUELTO** — §8.6 añade `trg_10_ordenes_trabajo_set_cerrado_en` |
| E4-M3 | MEDIUM | UPDATE de `vehiculo_id` en OT activa no documentado | **ACEPTADO** — el trigger `fn_ot_unica_activa_por_vehiculo` cubre UPDATE con `id <> NEW.id`. Cambiar `vehiculo_id` de una OT activa es válido (re-asignación por error de recepción). El trigger verifica unicidad en el nuevo vehículo. Documentado en §8.3. |

#### Especialista 5 — Domain Model Compliance

| # | Sev | Hallazgo | Estado en v0.2 |
|---|---|---|---|
| E5-H1 | HIGH | `citas.evento_id` — dirección ambigua (cita→evento o evento→cita) | **RESUELTO** — renombrado a `recepcion_evento_id` con nota explícita de dirección y tipo de evento en §4.2 |
| E5-H2 | HIGH | `reparaciones.evento_id` contradice DATABASE_MODEL Rule 6 (evento autorizado vs evento técnico) | **RESUELTO** — renombrado a `evento_trabajo_id`; §4.5 documenta la distinción entre evento de trabajo (FK) y evento de autorización (validación de aplicación). La FK apunta al evento de ejecución, no al de autorización. |
| E5-M1 | MEDIUM | `autorizaciones` ausente sin Decision Architecture Board formal | **RESUELTO** — §1 y §11.3 documentan PA-M3-1 con justificación formal |
| E5-M2 | MEDIUM | `controles_calidad` sin entidad backing para el estado OT | **RESUELTO** — §1 documenta PA-M3-2 con gap funcional explícito |

#### Especialista 6 — Multi-tenancy & Data Integrity

| # | Sev | Hallazgo | Estado en v0.2 |
|---|---|---|---|
| E6-B1 | BLOCKER | `items_reparacion` INSERT sin verificación cross-tenant del `reparacion_id` | **RESUELTO** — §9.6 añade subquery BLOCKER-SEC-1 |
| E6-B2 | BLOCKER | `garantias` INSERT sin verificación cross-tenant del `reparacion_id` | **RESUELTO** — §9.9 añade subquery BLOCKER-SEC-1 |
| E6-H1 | HIGH | `org_id` inmutabilidad en UPDATE policies sin enforcement explícito | **ACEPTADO** — el patrón `WITH CHECK (org_id = mi_org_id())` previene cambio de `org_id`. El `org_id` no puede ser distinto al del JWT porque la policy USING también lo verifica. Doble verificación implícita es suficiente. |
| E6-M1 | MEDIUM | `cerrado_en` constraint válido pero frágil sin trigger | **RESUELTO** — trigger §8.6 elimina la fragilidad |
| E6-M2 | MEDIUM | R-12: `entregas` sin corrección posible | **RESUELTO** — R-12 añadido en §12 |

#### Especialista 7 — Migration Safety & Ordering

| # | Sev | Hallazgo | Estado en v0.2 |
|---|---|---|---|
| E7-H1 | HIGH | `titulo` y `eliminado_en` ausentes de lista de campos protegidos en Trigger 1 | **RESUELTO** — mismo que E4-H1; §8.2 los incluye con decisiones documentadas |
| E7-H2 | HIGH | Orden de ejecución BEFORE UPDATE en `eventos` no documentado | **RESUELTO** — §8.2 documenta el orden alfabético forzado por prefijos y por qué `trg_01_` < `trg_50_` garantiza el comportamiento correcto |
| E7-M1 | MEDIUM | Trigger de `cerrado_en` necesita naming convention coherente | **RESUELTO** — §8.6 nombra el trigger `trg_10_` con justificación de posición en cadena |
| E7-M2 | MEDIUM | Análisis de interacción entre triggers no documentado | **RESUELTO** — §8.2 añade sección "Coexistencia con otros triggers" confirmando ausencia de deadlock o cascada cruzada |
| E7-L1 | LOW | FK diferida 01b correcta (dentro de transacción) | Confirmado — sin acción |
| E7-L2 | LOW | FK self-referencial presupuestos correcta | Confirmado — sin acción |
| E7-L3 | LOW | Naming `trg_01_` en tablas distintas sin conflicto | Confirmado — sin acción |
| E7-L4 | LOW | Modificaciones a Migrations 001/002 correctamente acotadas | Confirmado — solo Paso 01b |

---

### Resumen ejecutivo de BLOCKERs (todos resueltos)

| # | BLOCKER | Resuelto en |
|---|---|---|
| B1 | Cross-tenant INSERT en `presupuestos` (BLOCKER-SEC-1) | §9.3 |
| B2 | Cross-tenant INSERT en `items_presupuesto` (BLOCKER-SEC-1) | §9.4 |
| B3 | Cross-tenant INSERT en `items_reparacion` (BLOCKER-SEC-1) | §9.6 |
| B4 | Cross-tenant INSERT en `garantias` (BLOCKER-SEC-1) | §9.9 |
| B5 | Índice de unicidad de OT activa sin `org_id` (trigger ineficiente) | §7.1 |
| B6 | `items_reparacion` sin FK a `items_presupuesto` (DATABASE_MODEL) | §4.6 |

### Issues HIGH pendientes (aceptados como deuda técnica)

| # | Issue | Decisión | Sprint |
|---|---|---|---|
| DT-1 | Mecánico puede ver costos via SELECT directo | Capa de aplicación. Vista en Migration 006 | Sprint Reportes |
| DT-2 | `evidencias` UPDATE policy permite cualquier columna | Aplicación restringe payload. Aceptado para MVP | Sprint Evidencias v2 |
| DT-3 | `autorizaciones` ausente como tabla formal | PA-M3-1. Se crea en sprint Presupuestos Avanzados | Sprint Presupuestos+ |

### Criterio de aprobación — CUMPLIDO para v0.2

- [x] Todos los BLOCKER resueltos en el documento (6/6)
- [x] Issues HIGH resueltos o documentados como deuda técnica con sprint asignado (12/12)
- [x] PAs documentadas y aceptadas (PA9, PA-M3-1, PA-M3-2, PA-M3-3)
- [x] Checklist §13 puede completarse sin ambigüedades
- [ ] **Pendiente: aprobación humana**

---

*Este documento es la especificación de diseño de Migration 003, no su implementación.*
*Ninguna línea de SQL debe escribirse sin que cada decisión pueda trazarse hasta una sección de este documento o de los documentos autoritativos.*
*Modificaciones requieren revisión del Architecture Board.*
*Migration 004 no puede comenzarse hasta que el Checklist §13 esté completamente verificado.*
