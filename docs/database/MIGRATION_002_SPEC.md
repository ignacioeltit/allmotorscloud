# Migration 002 — Especificación de Diseño

**Estado:** BORRADOR — Pendiente aprobación humana  
**Versión:** 0.1  
**Fecha:** Junio 2026  
**Fuentes leídas:** CLAUDE.md · docs/domain-model/DOMAIN_MODEL.md · docs/business/WORKSHOP_OPERATING_MODEL.md · docs/business/EVENT_MODEL.md · docs/architecture/DATABASE_MODEL.md · docs/architecture/PHYSICAL_SCHEMA.md · docs/architecture/PERSISTENCE_ARCHITECTURE.md · docs/architecture/PERMISSION_MODEL.md · docs/database/MIGRATION_001_SPEC.md · docs/database/MIGRATION_001_REVIEW.md · supabase/migrations/001_initial_schema.sql

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
11. [Relación con Migration 001](#11-relación-con-migration-001)
12. [Riesgos](#12-riesgos)
13. [Checklist pre-SQL](#13-checklist-pre-sql)
14. [Architecture Board Review](#14-architecture-board-review)

---

## 1. Objetivo

Migration 002 implementa el núcleo de dominio del sistema: la capa de vehículos, historia técnica, clientes, conductores y eventos. Es la migración más crítica del sistema — sin ella no es posible registrar un vehículo, un cliente ni ningún trabajo técnico.

**Alcance:**
- Completar las Foreign Keys diferidas de Migration 001 (`transiciones_evento.evento_id` y `transiciones_evento.vehiculo_id`)
- Crear las 8 tablas de dominio: `clientes`, `conductores`, `vehiculos`, `historias_tecnicas`, `propietarios_vehiculo`, `tipos_evento`, `eventos`, `referencias_evento`
- Crear 2 nuevas funciones de trigger: `fn_crear_historia_tecnica()` y `fn_referencias_evento_anti_ciclo()`
- Instalar triggers sobre las nuevas tablas usando las funciones ya existentes de Migration 001 (`fn_set_updated_at`, `fn_audit_insert_trigger`) y las dos nuevas
- Crear índices incluyendo GIN con `pg_trgm` sobre campos de búsqueda textual
- Definir políticas RLS para todas las tablas nuevas
- Documentar la FK deferred `eventos.orden_trabajo_id → ordenes_trabajo.id` para Migration 003

**Lo que esta migración NO hace:**
- No crea `ordenes_trabajo` ni sus tablas satélite (Migration 003+)
- No implementa el Trigger 1 de inmutabilidad de eventos cerrados (Migration 003 — requiere que `ordenes_trabajo` exista para el trigger de sincronización OT-Evento)
- No crea las vistas `v_clientes_mecanico` ni `v_items_presupuesto_mecanico` (Migration 006)
- No hace seed de `tipos_evento` — eso ocurre durante el onboarding via Edge Function
- No modifica Migration 001

---

## 2. Orden exacto de creación

El orden respeta las dependencias de Foreign Keys. Cada paso puede ejecutarse solo cuando todas sus dependencias ya existen.

```
Paso 01 — Completar FKs diferidas de Migration 001 (ALTER TABLE transiciones_evento)
Paso 02 — clientes           (depende de: organizaciones)
Paso 03 — conductores        (depende de: organizaciones)
Paso 04 — vehiculos          (depende de: organizaciones)
Paso 05 — historias_tecnicas (depende de: vehiculos)
Paso 06 — propietarios_vehiculo (depende de: vehiculos, clientes)
Paso 07 — tipos_evento       (depende de: organizaciones, tipos_evento_base)
Paso 08 — eventos            (depende de: historias_tecnicas, tipos_evento, usuarios, sucursales, conductores)
Paso 09 — referencias_evento (depende de: eventos)
Paso 10 — Índices            (después de que todas las tablas existen)
Paso 11 — Seeds              (ninguno en Migration 002 — ver §10)
Paso 12 — Funciones de trigger nuevas (fn_crear_historia_tecnica, fn_referencias_evento_anti_ciclo)
Paso 13 — Triggers           (después de que las funciones y tablas existen)
Paso 14 — RLS                (habilitar + policies en cada tabla nueva)
```

**Nota H-5 aplicada:** al igual que en Migration 001, los triggers se crean DESPUÉS de los seeds (aunque en esta migración no haya seeds, el orden se preserva por consistencia y para evitar que triggers de auditoría capturen inserciones de inicialización futura).

**Nota sobre transaccionalidad:** toda la migración se ejecuta dentro de `BEGIN ... COMMIT`. Las extensiones ya están instaladas desde Migration 001 (`pg_trgm`, `pgcrypto`, `vector`). No se usan `CREATE INDEX CONCURRENTLY` (tablas nuevas sin datos).

---

## 3. Tablas

| Tabla | Tipo | Soft-delete | Audit trigger | set_updated_at |
|---|---|---|---|---|
| `clientes` | Per-tenant | Sí (`eliminado_en`) | Sí | Sí |
| `conductores` | Per-tenant | Sí (`eliminado_en`) | Sí | Sí |
| `vehiculos` | Per-tenant | Sí (`eliminado_en`) | Sí | Sí |
| `historias_tecnicas` | Per-tenant | **No** (nunca se elimina) | Sí | Sí |
| `propietarios_vehiculo` | Per-tenant | No (`fecha_fin` en su lugar) | Sí | Sí |
| `tipos_evento` | Per-tenant | No (`activo = false` en su lugar) | Sí | Sí |
| `eventos` | Per-tenant | Sí (`eliminado_en`) | Sí | Sí |
| `referencias_evento` | Per-tenant | Sí (`eliminado_en`) | No (DAG inmutable, audit innecesario) | **No** (`creado_en` sola — inmutable) |

**Justificación de excepciones:**
- `historias_tecnicas`: no tiene `eliminado_en` porque su existencia garantiza que el historial técnico sobrevive el soft-delete del vehículo. DATABASE_MODEL §4.1: "Nunca se elimina."
- `propietarios_vehiculo`: la relación propietario-vehículo termina con `fecha_fin`, no con soft-delete. El registro histórico de cada propietario es parte del activo del taller.
- `referencias_evento`: no tiene trigger de auditoría porque es en sí misma un log de relaciones. Auditar un arco del DAG es ruido innecesario.

---

## 4. Columnas

### 4.1 `clientes`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `tipo` | TEXT | NOT NULL | `'persona_natural'` | CHECK: ver §5 |
| `nombre` | TEXT | NOT NULL | — | Nombre completo o razón social |
| `rut` | TEXT | NULL | — | Sin formato forzado; unique per org donde activo |
| `telefono` | TEXT | NULL | — | PII — hashed en audit_log |
| `email` | TEXT | NULL | — | PII — hashed en audit_log |
| `direccion` | TEXT | NULL | — | PII — hashed en audit_log |
| `notas` | TEXT | NULL | — | |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `creado_por` | UUID | NULL | — | FK → usuarios.id; NULL durante migración TallerGP |
| `eliminado_en` | TIMESTAMPTZ | NULL | — | Soft-delete |
| `eliminado_por` | UUID | NULL | — | FK → usuarios.id |

### 4.2 `conductores`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `nombre` | TEXT | NOT NULL | — | |
| `rut` | TEXT | NULL | — | PII |
| `telefono` | TEXT | NULL | — | PII |
| `email` | TEXT | NULL | — | PII |
| `licencia_tipo` | TEXT | NULL | — | Clase de licencia |
| `licencia_vencimiento` | DATE | NULL | — | |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `creado_por` | UUID | NULL | — | FK → usuarios.id |
| `eliminado_en` | TIMESTAMPTZ | NULL | — | Soft-delete |
| `eliminado_por` | UUID | NULL | — | FK → usuarios.id |

### 4.3 `vehiculos`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `patente` | TEXT | NOT NULL | — | Uppercase; unique per org |
| `vin` | TEXT | NULL | — | Vehicle Identification Number |
| `marca` | TEXT | NOT NULL | — | |
| `modelo` | TEXT | NOT NULL | — | |
| `anio` | SMALLINT | NULL | — | Año del vehículo |
| `color` | TEXT | NULL | — | |
| `tipo` | TEXT | NOT NULL | `'auto'` | CHECK: ver §5 |
| `km_actual` | INTEGER | NULL | — | Actualizado en cada recepción/entrega |
| `notas` | TEXT | NULL | — | |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `creado_por` | UUID | NULL | — | FK → usuarios.id |
| `eliminado_en` | TIMESTAMPTZ | NULL | — | Soft-delete |
| `eliminado_por` | UUID | NULL | — | FK → usuarios.id |

**Nota sobre `patente`:** la patente es el identificador humano primario del vehículo dentro de la organización. DATABASE_MODEL §4.1: "La patente es única por `org_id`." El UNIQUE constraint es NO parcial (sin `WHERE eliminado_en IS NULL`): en el mundo físico, una patente identifica un vehículo de por vida — no deben existir dos registros con la misma patente en la misma organización, activos o eliminados. Si un vehículo es eliminado accidentalmente y debe reactivarse, se hace UPDATE de `eliminado_en` a NULL, no se crea un registro nuevo.

### 4.4 `historias_tecnicas`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `vehiculo_id` | UUID | NOT NULL | — | FK → vehiculos.id; UNIQUE (1:1) |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id; denormalizado para RLS |
| `notas` | TEXT | NULL | — | Notas administrativas del taller |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |

**No tiene `creado_por`** — creada por trigger de sistema, no por usuario directo.
**No tiene `eliminado_en`** — inmutable, ver DATABASE_MODEL §4.1.

**Por qué `org_id` está denormalizado:** aunque `org_id` es derivable via `JOIN vehiculos`, tenerlo en `historias_tecnicas` permite que las políticas RLS hagan filtro O(1) sin JOIN, consistente con el patrón de toda la base de datos.

### 4.5 `propietarios_vehiculo`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `vehiculo_id` | UUID | NOT NULL | — | FK → vehiculos.id |
| `cliente_id` | UUID | NOT NULL | — | FK → clientes.id |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `fecha_inicio` | DATE | NOT NULL | `CURRENT_DATE` | Inicio de la propiedad |
| `fecha_fin` | DATE | NULL | — | NULL = propietario activo |
| `notas` | TEXT | NULL | — | |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `creado_por` | UUID | NULL | — | FK → usuarios.id |

**No tiene `eliminado_en`** — la relación propietario-vehículo termina con `fecha_fin`. El registro histórico es permanente.

### 4.6 `tipos_evento`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `tipo_evento_base_id` | UUID | NULL | — | FK → tipos_evento_base.id; NULL para tipos personalizados |
| `nombre` | TEXT | NOT NULL | — | Nombre legible: "Diagnóstico Inicial" |
| `slug` | TEXT | NOT NULL | — | Snake_case: 'diagnostico_inicial' |
| `descripcion` | TEXT | NULL | — | |
| `categoria` | TEXT | NOT NULL | — | CHECK: ver §5 |
| `activo` | BOOLEAN | NOT NULL | `true` | Desactivar en lugar de eliminar |
| `es_personalizado` | BOOLEAN | NOT NULL | `false` | true para tipos agregados por el taller |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `creado_por` | UUID | NULL | — | FK → usuarios.id; NULL para tipos copiados por Edge Function de onboarding |

**No tiene `eliminado_en`** — la desactivación es vía `activo = false`. Un tipo desactivado puede reactivarse.

### 4.7 `eventos`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `historia_tecnica_id` | UUID | NOT NULL | — | FK → historias_tecnicas.id |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `tipo_evento_id` | UUID | NOT NULL | — | FK → tipos_evento.id |
| `sucursal_id` | UUID | NULL | — | FK → sucursales.id |
| `conductor_id` | UUID | NULL | — | FK → conductores.id; conductor que trajo el vehículo en este evento |
| `orden_trabajo_id` | UUID | NULL | — | FK DIFERIDA a Migration 003 → ordenes_trabajo.id |
| `estado` | TEXT | NOT NULL | `'creado'` | CHECK: ver §5 |
| `titulo` | TEXT | NULL | — | Resumen breve del evento |
| `descripcion` | TEXT | NULL | — | Detalle técnico |
| `asignado_a` | UUID | NULL | — | FK → usuarios.id; mecánico o responsable asignado |
| `km_vehiculo` | INTEGER | NULL | — | Odómetro al momento del evento |
| `visible_cliente` | BOOLEAN | NOT NULL | `false` | Controla visibilidad en Portal Cliente |
| `cerrado_en` | TIMESTAMPTZ | NULL | — | Inmutabilidad: ver §5 y §8 |
| `cancelado_en` | TIMESTAMPTZ | NULL | — | |
| `cancelado_por` | UUID | NULL | — | FK → usuarios.id |
| `razon_cancelacion` | TEXT | NULL | — | Obligatoria cuando `cancelado_en IS NOT NULL` |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `creado_por` | UUID | NOT NULL | — | FK → usuarios.id |
| `eliminado_en` | TIMESTAMPTZ | NULL | — | Soft-delete |
| `eliminado_por` | UUID | NULL | — | FK → usuarios.id |

**Nota sobre `conductor_id`:** WORKSHOP_OPERATING_MODEL §4.2 identifica al conductor que trae el vehículo como dato capturado en Recepción. DATABASE_MODEL §4.7 establece que conductores "se asocian a una visita (evento de recepción) específica, no al vehículo ni al cliente permanentemente". El campo `conductor_id` en `eventos` implementa esta asociación de forma directa, sin tabla intermedia.

**Nota sobre `orden_trabajo_id`:** la columna existe en Migration 002 como UUID NULL sin FK activa. La FK formal se añade al inicio de Migration 003, cuando `ordenes_trabajo` exista.

### 4.8 `referencias_evento`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `evento_origen_id` | UUID | NOT NULL | — | FK → eventos.id |
| `evento_destino_id` | UUID | NOT NULL | — | FK → eventos.id |
| `org_id` | UUID | NOT NULL | — | FK → organizaciones.id |
| `tipo` | TEXT | NOT NULL | — | CHECK: ver §5 |
| `notas` | TEXT | NULL | — | |
| `creado_en` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `creado_por` | UUID | NOT NULL | — | FK → usuarios.id |
| `eliminado_en` | TIMESTAMPTZ | NULL | — | Anular un arco del DAG; el arco queda en historial |
| `eliminado_por` | UUID | NULL | — | FK → usuarios.id |

**No tiene `actualizado_en`** — las referencias son inmutables. Una referencia errónea se cancela con `eliminado_en` y se crea una nueva.

---

## 5. Constraints

### 5.1 CHECK constraints

```sql
-- clientes.tipo
tipo TEXT NOT NULL CHECK (tipo IN ('persona_natural', 'empresa', 'aseguradora'))

-- vehiculos.tipo
tipo TEXT NOT NULL CHECK (tipo IN ('auto', 'camioneta', 'moto', 'furgon', 'camion', 'otro'))

-- tipos_evento.categoria (8 categorías del EVENT_MODEL.md)
categoria TEXT NOT NULL CHECK (categoria IN (
  'inspeccion', 'mantencion', 'reparacion', 'garantia',
  'estimacion', 'documentacion', 'comunicacion', 'administracion'
))

-- eventos.estado (8 estados del EVENT_MODEL.md)
estado TEXT NOT NULL CHECK (estado IN (
  'creado', 'pendiente', 'asignado', 'en_ejecucion',
  'en_espera', 'finalizado', 'cerrado', 'cancelado'
))

-- eventos: razón obligatoria al cancelar
CHECK (
  (cancelado_en IS NULL AND razon_cancelacion IS NULL) OR
  (cancelado_en IS NOT NULL AND razon_cancelacion IS NOT NULL)
)

-- referencias_evento.tipo
tipo TEXT NOT NULL CHECK (tipo IN ('precede_a', 'relacionado_con', 'correccion_de', 'garantia_de'))

-- referencias_evento: prohibir auto-referencia
CHECK (evento_origen_id <> evento_destino_id)
```

### 5.2 UNIQUE constraints

```sql
-- Patente única por organización (NO parcial — ver nota en §4.3)
UNIQUE (org_id, patente) ON vehiculos

-- Historia técnica 1:1 con vehículo
UNIQUE (vehiculo_id) ON historias_tecnicas

-- Máximo un propietario activo por vehículo
UNIQUE (vehiculo_id) WHERE fecha_fin IS NULL ON propietarios_vehiculo

-- Slug de tipo de evento único y activo por organización
UNIQUE (org_id, slug) WHERE activo = true ON tipos_evento

-- RUT único por organización (solo entre registros activos)
UNIQUE (org_id, rut) WHERE eliminado_en IS NULL ON clientes
```

---

## 6. Foreign Keys

### 6.1 Completar FKs diferidas de Migration 001 (Paso 01)

Estas FKs fueron declaradas como diferidas en Migration 001 porque `eventos` y `vehiculos` no existían aún. Se completan al INICIO de Migration 002, antes de crear cualquier tabla nueva.

```sql
-- FK diferida 1: transiciones_evento.evento_id → eventos.id
-- Nota: evento_id ya existe como columna en transiciones_evento (Migration 001)
-- Completar solo cuando eventos exista.
-- Se ejecuta DESPUÉS de crear eventos en Paso 08 (ver §2 Paso 01 — en realidad al final de Paso 08)

-- FK diferida 2: transiciones_evento.vehiculo_id → vehiculos.id
-- vehiculo_id ya existe como columna en transiciones_evento (Migration 001, decisión BLK-1 Architecture Board v1.1)
-- Se ejecuta DESPUÉS de crear vehiculos en Paso 04
```

**Orden preciso:** estas dos ALTER TABLEs se ejecutan inmediatamente después de que las tablas referenciadas existen:
- `ALTER TABLE transiciones_evento ADD CONSTRAINT fk_transiciones_evento_vehiculo_id ...` → después del Paso 04 (vehiculos)
- `ALTER TABLE transiciones_evento ADD CONSTRAINT fk_transiciones_evento_evento_id ...` → después del Paso 08 (eventos)

### 6.2 FKs nuevas en Migration 002

| Tabla | Columna | Referencia | Tipo | Nullable |
|---|---|---|---|---|
| `clientes` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `clientes` | `creado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `clientes` | `eliminado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `conductores` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `conductores` | `creado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `conductores` | `eliminado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `vehiculos` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `vehiculos` | `creado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `vehiculos` | `eliminado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `historias_tecnicas` | `vehiculo_id` | `vehiculos.id` | ON DELETE RESTRICT | NOT NULL |
| `historias_tecnicas` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `propietarios_vehiculo` | `vehiculo_id` | `vehiculos.id` | ON DELETE RESTRICT | NOT NULL |
| `propietarios_vehiculo` | `cliente_id` | `clientes.id` | ON DELETE RESTRICT | NOT NULL |
| `propietarios_vehiculo` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `propietarios_vehiculo` | `creado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `tipos_evento` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `tipos_evento` | `tipo_evento_base_id` | `tipos_evento_base.id` | ON DELETE SET NULL | NULL |
| `tipos_evento` | `creado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `eventos` | `historia_tecnica_id` | `historias_tecnicas.id` | ON DELETE RESTRICT | NOT NULL |
| `eventos` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `eventos` | `tipo_evento_id` | `tipos_evento.id` | ON DELETE RESTRICT | NOT NULL |
| `eventos` | `sucursal_id` | `sucursales.id` | ON DELETE SET NULL | NULL |
| `eventos` | `conductor_id` | `conductores.id` | ON DELETE SET NULL | NULL |
| `eventos` | `asignado_a` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `eventos` | `cancelado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `eventos` | `creado_por` | `usuarios.id` | ON DELETE RESTRICT | NOT NULL |
| `eventos` | `eliminado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |
| `referencias_evento` | `evento_origen_id` | `eventos.id` | ON DELETE RESTRICT | NOT NULL |
| `referencias_evento` | `evento_destino_id` | `eventos.id` | ON DELETE RESTRICT | NOT NULL |
| `referencias_evento` | `org_id` | `organizaciones.id` | ON DELETE RESTRICT | NOT NULL |
| `referencias_evento` | `creado_por` | `usuarios.id` | ON DELETE RESTRICT | NOT NULL |
| `referencias_evento` | `eliminado_por` | `usuarios.id` | ON DELETE SET NULL | NULL |

### 6.3 FK diferida para Migration 003

| Columna | Referencia diferida | Motivo |
|---|---|---|
| `eventos.orden_trabajo_id` | `ordenes_trabajo.id` | `ordenes_trabajo` se crea en Migration 003 |

Esta columna existe en `eventos` desde Migration 002 como `UUID NULL` sin FK activa. El ALTER TABLE se ejecuta al inicio de Migration 003.

---

## 7. Índices

### 7.1 Índices en `clientes`

```
B-tree (org_id)              WHERE eliminado_en IS NULL  — RLS scan, lista de clientes activos
B-tree (org_id, rut)         WHERE eliminado_en IS NULL  — lookup exacto por RUT
GIN pg_trgm (nombre)                                     — búsqueda de texto en nombre (trigrama)
GIN pg_trgm (rut)                                        — búsqueda de texto en RUT parcial
```

**Justificación GIN en `rut`:** aunque el RUT es un identificador estructurado, los usuarios frecuentemente buscan por fragmento (ej: "11.111") sin el punto inicial. GIN pg_trgm es más eficiente que LIKE '%...%' sin índice. Para lookups exactos, el B-tree `(org_id, rut)` es suficiente.

### 7.2 Índices en `conductores`

```
B-tree (org_id)              WHERE eliminado_en IS NULL  — RLS scan
```

### 7.3 Índices en `vehiculos`

```
UNIQUE B-tree (org_id, patente)                          — ya cubierto por UNIQUE constraint (§5.2)
B-tree (org_id)              WHERE eliminado_en IS NULL  — RLS scan
GIN pg_trgm (patente)                                    — búsqueda de texto en patente (trigrama)
```

**Nota:** el UNIQUE constraint sobre `(org_id, patente)` crea automáticamente un índice B-tree. No se crea un índice duplicado explícito — solo el GIN adicional para búsqueda parcial.

### 7.4 Índices en `historias_tecnicas`

```
UNIQUE B-tree (vehiculo_id)                              — cubierto por UNIQUE constraint (§5.2)
B-tree (org_id)                                          — RLS scan
```

### 7.5 Índices en `propietarios_vehiculo`

```
B-tree (vehiculo_id)         WHERE fecha_fin IS NULL     — propietario activo por vehículo (hot path)
B-tree (vehiculo_id)                                     — historial completo de propietarios
B-tree (cliente_id)          WHERE fecha_fin IS NULL     — vehículos activos de un cliente
B-tree (org_id)                                          — RLS scan
```

### 7.6 Índices en `tipos_evento`

```
B-tree (org_id)              WHERE activo = true         — catálogo activo de un tenant
UNIQUE B-tree (org_id, slug) WHERE activo = true         — cubierto por UNIQUE constraint (§5.2)
```

### 7.7 Índices en `eventos`

```
B-tree (historia_tecnica_id, creado_en DESC)
  WHERE eliminado_en IS NULL                             — HOT PATH PRIMARIO: Historia Técnica de un vehículo
B-tree (historia_tecnica_id, tipo_evento_id, estado)
  WHERE eliminado_en IS NULL                             — filtro por tipo y estado en Historia Técnica
B-tree (org_id, estado)
  WHERE eliminado_en IS NULL                             — dashboard de eventos por organización
B-tree (asignado_a)
  WHERE eliminado_en IS NULL
    AND estado NOT IN ('cerrado', 'cancelado')           — cola de trabajo del mecánico
B-tree (org_id, creado_en DESC)
  WHERE eliminado_en IS NULL                             — feed cronológico por organización
```

**Justificación del índice en `(historia_tecnica_id, creado_en DESC)`:** DATABASE_MODEL §8 lo identifica como el índice más crítico del sistema. Cubre el query "mostrar todos los eventos del vehículo V, ordenados por recientes primero".

### 7.8 Índices en `referencias_evento`

```
B-tree (evento_origen_id)    WHERE eliminado_en IS NULL  — arcos salientes de un evento (DAG traversal)
B-tree (evento_destino_id)   WHERE eliminado_en IS NULL  — arcos entrantes (DAG reverso + cycle detection)
```

---

## 8. Triggers

### 8.1 Funciones de trigger existentes de Migration 001 (reutilizadas)

Las siguientes funciones ya existen desde Migration 001 y se reutilizan sin modificación:

- `fn_set_updated_at()` — setea `NEW.actualizado_en = now()` en BEFORE UPDATE
- `fn_audit_insert_trigger()` — captura INSERT/UPDATE y escribe en `audit_log` usando `fn_audit_insert()`

### 8.2 Nueva función: `fn_crear_historia_tecnica()`

```
Trigger:  AFTER INSERT ON vehiculos FOR EACH ROW
Nombre:   trg_80_vehiculos_crear_historia_tecnica

Comportamiento:
  - INSERT INTO historias_tecnicas (vehiculo_id, org_id, creado_en, actualizado_en)
    VALUES (NEW.id, NEW.org_id, now(), now())
  - No registra creado_por (es una acción de sistema, no de usuario)
  - Devuelve NULL (trigger AFTER no requiere retorno)

Invariante que protege: "Un vehículo tiene exactamente una historia técnica." (DATABASE_MODEL §4.1)
```

### 8.3 Nueva función: `fn_referencias_evento_anti_ciclo()`

```
Trigger:  BEFORE INSERT ON referencias_evento FOR EACH ROW
Nombre:   trg_01_referencias_evento_anti_ciclo

Comportamiento:
  1. Adquirir pg_advisory_xact_lock(hashtext('referencias_evento_ciclo'))
     — previene race condition entre INSERTs concurrentes al mismo grafo

  2. Recorrer el grafo activo partiendo desde NEW.evento_destino_id, siguiendo
     referencias no eliminadas (eliminado_en IS NULL) en la dirección de los arcos
     (origen → destino). Limitar la profundidad máxima a 50 niveles. Si durante
     el recorrido se alcanza NEW.evento_origen_id, existe un ciclo: rechazar la
     inserción con RAISE EXCEPTION indicando los dos eventos involucrados. Si se
     agotan los 50 niveles sin encontrar evento_origen_id, permitir el INSERT.

  3. Si la CTE retorna filas → ciclo detectado → RAISE EXCEPTION
     con mensaje: 'referencias_evento: ciclo detectado entre eventos %s y %s'

  4. Si la profundidad se agota (50 niveles) sin encontrar ciclo → permitir INSERT
     (grafos de más de 50 niveles son inaceptables operacionalmente)

  5. Devolver NEW (trigger BEFORE con éxito)

Justificación: DATABASE_MODEL §10 regla 11 y §7 sección "Acyclicidad de referencias_evento".
```

### 8.4 Tabla completa de triggers en Migration 002

| Tabla | Nombre trigger | Momento | Evento | Función |
|---|---|---|---|---|
| `clientes` | `trg_50_clientes_set_updated_at` | BEFORE | UPDATE | `fn_set_updated_at()` |
| `clientes` | `trg_99_clientes_audit` | AFTER | INSERT OR UPDATE OR DELETE | `fn_audit_insert_trigger()` |
| `conductores` | `trg_50_conductores_set_updated_at` | BEFORE | UPDATE | `fn_set_updated_at()` |
| `conductores` | `trg_99_conductores_audit` | AFTER | INSERT OR UPDATE OR DELETE | `fn_audit_insert_trigger()` |
| `vehiculos` | `trg_50_vehiculos_set_updated_at` | BEFORE | UPDATE | `fn_set_updated_at()` |
| `vehiculos` | `trg_80_vehiculos_crear_historia_tecnica` | AFTER | INSERT | `fn_crear_historia_tecnica()` |
| `vehiculos` | `trg_99_vehiculos_audit` | AFTER | INSERT OR UPDATE OR DELETE | `fn_audit_insert_trigger()` |
| `historias_tecnicas` | `trg_50_historias_tecnicas_set_updated_at` | BEFORE | UPDATE | `fn_set_updated_at()` |
| `historias_tecnicas` | `trg_99_historias_tecnicas_audit` | AFTER | UPDATE | `fn_audit_insert_trigger()` |
| `propietarios_vehiculo` | `trg_50_propietarios_vehiculo_set_updated_at` | BEFORE | UPDATE | `fn_set_updated_at()` |
| `propietarios_vehiculo` | `trg_99_propietarios_vehiculo_audit` | AFTER | INSERT OR UPDATE OR DELETE | `fn_audit_insert_trigger()` |
| `tipos_evento` | `trg_50_tipos_evento_set_updated_at` | BEFORE | UPDATE | `fn_set_updated_at()` |
| `tipos_evento` | `trg_99_tipos_evento_audit` | AFTER | INSERT OR UPDATE OR DELETE | `fn_audit_insert_trigger()` |
| `eventos` | `trg_50_eventos_set_updated_at` | BEFORE | UPDATE | `fn_set_updated_at()` |
| `eventos` | `trg_99_eventos_audit` | AFTER | INSERT OR UPDATE OR DELETE | `fn_audit_insert_trigger()` |
| `referencias_evento` | `trg_01_referencias_evento_anti_ciclo` | BEFORE | INSERT | `fn_referencias_evento_anti_ciclo()` |

**Nota sobre `historias_tecnicas`:** el trigger de auditoría solo cubre UPDATE (no INSERT) porque el INSERT ocurre via trigger de sistema (`fn_crear_historia_tecnica`), no via usuario autenticado. Auditar un trigger-driven INSERT con `actor_id = NULL` genera ruido sin valor. Si se decide auditar la creación de historias_tecnicas, debe hacerse dentro de `fn_crear_historia_tecnica()` directamente.

**Trigger 1 — inmutabilidad de eventos cerrados:** DATABASE_MODEL §7 define que un evento con `cerrado_en IS NOT NULL` no puede modificarse. Este trigger (BEFORE UPDATE ON eventos) se implementa en **Migration 003** porque requiere coordinación con la lógica de sincronización OT-Evento (que depende de `ordenes_trabajo`). En Migration 002, la regla de inmutabilidad se impone solo a nivel de aplicación y de política RLS WITH CHECK.

---

## 9. RLS (Row Level Security)

Todas las tablas nuevas tienen RLS habilitado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).

Los roles mencionados corresponden al valor retornado por `mi_rol()` (función SECURITY DEFINER de Migration 001 que lee del JWT).

### 9.1 `clientes`

```sql
-- SELECT: mecanico NO tiene acceso (PII de clientes, PERMISSION_MODEL §6)
POLICY "clientes_select"
  FOR SELECT USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  -- cliente_portal: diferido a Migration 006 (v_clientes_portal con security_barrier)

-- INSERT
POLICY "clientes_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )

-- UPDATE (WITH CHECK previene cambio de org_id — DATABASE_MODEL §10 regla 9)
POLICY "clientes_update"
  FOR UPDATE
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id())

-- DELETE: bloqueado (soft-delete únicamente)
```

### 9.2 `conductores`

```sql
-- SELECT: mecanico puede ver conductores (no contiene PII crítica financiera)
POLICY "conductores_select"
  FOR SELECT USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
  )

POLICY "conductores_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )

POLICY "conductores_update"
  FOR UPDATE
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id())
```

**Nota:** aunque `conductores` contiene `rut`, `telefono` y `email`, el PERMISSION_MODEL no clasifica explícitamente a conductores como PII restringida para mecánico (a diferencia de `clientes`). Esta decisión es conservadora — si el mecanico necesita contactar al conductor para coordinar la entrega, puede hacerlo. Reconsiderar en sprint de permiso de mecánico si se requiere restricción.

### 9.3 `vehiculos`

```sql
-- SELECT: todos los roles pueden ver vehículos de su organización
-- (el filtro de "solo asignados" para mecánico se aplica a nivel de OT, en Migration 003+)
POLICY "vehiculos_select"
  FOR SELECT USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
  )

POLICY "vehiculos_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )

POLICY "vehiculos_update"
  FOR UPDATE
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id())
```

### 9.4 `historias_tecnicas`

```sql
-- SELECT: todos los roles pueden leer historia técnica de su organización
POLICY "historias_tecnicas_select"
  FOR SELECT USING (org_id = mi_org_id())

-- INSERT: bloqueado para usuarios — solo via trigger fn_crear_historia_tecnica()
-- (La función es SECURITY DEFINER y BYPASSRLS via pertenencia a postgres)

-- UPDATE: solo admin y jefe_taller pueden añadir notas
POLICY "historias_tecnicas_update"
  FOR UPDATE
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id())
```

**Nota sobre fn_crear_historia_tecnica:** la función debe ser creada como `SECURITY DEFINER` y owned by postgres para bypassear el bloqueo de INSERT en `historias_tecnicas`. Si se ejecuta como `SECURITY INVOKER`, el INSERT fallará por la ausencia de policy INSERT.

### 9.5 `propietarios_vehiculo`

```sql
POLICY "propietarios_vehiculo_select"
  FOR SELECT USING (org_id = mi_org_id())

POLICY "propietarios_vehiculo_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )

POLICY "propietarios_vehiculo_update"
  FOR UPDATE
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id())
```

### 9.6 `tipos_evento`

```sql
-- SELECT: todos los roles pueden ver el catálogo de tipos (necesario para mostrar labels de eventos)
POLICY "tipos_evento_select"
  FOR SELECT USING (
    org_id = mi_org_id()
    AND activo = true
  )

-- INSERT/UPDATE: solo admin puede gestionar el catálogo
POLICY "tipos_evento_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin')
  )

POLICY "tipos_evento_update"
  FOR UPDATE
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin')
  )
  WITH CHECK (org_id = mi_org_id())
```

**Nota:** la copia de `tipos_evento_base` a `tipos_evento` durante onboarding se ejecuta con `service_role` (Edge Function), que bypasea RLS. La policy de INSERT de `admin` aplica solo a creaciones manuales posteriores.

### 9.7 `eventos`

```sql
-- SELECT: todos los roles (mecanico solo los asignados — filtrado en app layer hasta Migration 003)
POLICY "eventos_select"
  FOR SELECT USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
  )

-- INSERT: todos los roles operativos, incluyendo mecanico (puede reportar hallazgo adicional)
POLICY "eventos_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  )

-- UPDATE: mecanico solo puede actualizar eventos que le estén asignados
-- La verificación de asignación es a nivel de aplicación hasta Migration 003
-- A nivel DB: mecanico puede UPDATE eventos de su organización (restricción de campo en app layer)
POLICY "eventos_update"
  FOR UPDATE
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  )
  WITH CHECK (
    org_id = mi_org_id()
    -- Proteger inmutabilidad parcial: mecanico no puede cerrar eventos
    -- (esto se implementa completamente en Migration 003 via trigger)
  )
```

**Nota de seguridad:** la policy UPDATE para `mecanico` es permisiva a nivel DB. La restricción de "mecanico solo puede actualizar sus eventos asignados" y "mecanico no puede cerrar eventos" debe implementarse como trigger en Migration 003. Para Migration 002, la restricción existe en la capa de aplicación.

### 9.8 `referencias_evento`

```sql
-- SELECT: todos los roles pueden ver el grafo de referencias
POLICY "referencias_evento_select"
  FOR SELECT USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
  )

-- INSERT: roles que pueden crear relaciones entre eventos (con verificación cross-tenant en §9.9)
POLICY "referencias_evento_insert"
  FOR INSERT WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )

-- UPDATE: bloqueado (referencias son inmutables; soft-delete vía eliminado_en)
-- DELETE: bloqueado (soft-delete únicamente)
-- La anulación de un arco se hace UPDATE de eliminado_en
POLICY "referencias_evento_eliminar"
  FOR UPDATE
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller')
  )
  WITH CHECK (
    org_id = mi_org_id()
    -- Solo permite setear eliminado_en (anulación) — no permite cambiar otros campos
    -- La validación de "solo se modifica eliminado_en" es a nivel de aplicación
  )
```

### 9.9 Protección cross-tenant en `referencias_evento`

**Riesgo:** un usuario podría INSERT con `evento_origen_id` de su organización y `evento_destino_id` de otra organización. La policy INSERT solo verifica `org_id = mi_org_id()` pero no verifica que ambos eventos pertenezcan a esa misma organización.

**Mitigación:** la SELECT policy en `eventos` ya garantiza que el usuario solo puede ver eventos de su organización. Si el usuario solo puede obtener UUIDs de sus propios eventos, no puede construir un INSERT cross-tenant válido. Sin embargo, si el UUID es conocido (por fuerza bruta o fuente externa), el INSERT podría proceder.

**Resolución en Migration 002:** añadir verificación en la INSERT policy:
```sql
WITH CHECK (
  org_id = mi_org_id()
  AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  AND (SELECT org_id FROM eventos WHERE id = NEW.evento_origen_id) = mi_org_id()
  AND (SELECT org_id FROM eventos WHERE id = NEW.evento_destino_id) = mi_org_id()
)
```

**Nota de performance:** esta verificación agrega dos lookups por fila INSERT. El índice `(id)` PK de `eventos` hace estos lookups O(log n). Aceptable dado que las referencias de eventos son infrecuentes comparado con otros INSERTs.

---

## 10. Seeds e inicialización

**No hay seeds de datos en Migration 002.**

| Tabla | Población | Mecanismo |
|---|---|---|
| `tipos_evento` | Durante onboarding de cada tenant | Edge Function copia `tipos_evento_base` → `tipos_evento` |
| `clientes`, `conductores`, `vehiculos` | Durante migración TallerGP | Script de migración externo |
| `historias_tecnicas` | Automáticamente al crear vehículo | Trigger `trg_80_vehiculos_crear_historia_tecnica` |

**Nota PA11 (abierta desde Migration 001):** cuando se agrega un nuevo tipo al catálogo global `tipos_evento_base`, los tenants existentes no reciben la actualización automáticamente. Esta pregunta permanece abierta. No bloquea Migration 002.

---

## 11. Relación con Migration 001

### Tablas de Migration 001 que Migration 002 extiende

| Tabla Migration 001 | Extensión en Migration 002 |
|---|---|
| `transiciones_evento` | Completa FK `evento_id → eventos.id` y `vehiculo_id → vehiculos.id` |
| `organizaciones` | `clientes`, `conductores`, `vehiculos`, `tipos_evento`, `eventos` añaden FK a esta tabla |
| `usuarios` | Referenciada como `creado_por`, `asignado_a`, `cancelado_por`, etc. en las nuevas tablas |
| `sucursales` | Referenciada en `eventos.sucursal_id` |
| `tipos_evento_base` | Referenciada en `tipos_evento.tipo_evento_base_id` |
| `audit_log` | Captura actividad de todas las nuevas tablas via `fn_audit_insert_trigger` |

### Funciones de Migration 001 reutilizadas

| Función | Uso en Migration 002 |
|---|---|
| `mi_org_id()` | Todas las políticas RLS |
| `mi_rol()` | Todas las políticas RLS |
| `fn_set_updated_at()` | Trigger BEFORE UPDATE en 6 tablas nuevas |
| `fn_audit_insert_trigger()` | Trigger AFTER INSERT/UPDATE en tablas operacionales |
| `fn_audit_insert()` | Llamada internamente por `fn_audit_insert_trigger()` |

### Lo que Migration 002 deja abierto para Migration 003

- FK `eventos.orden_trabajo_id → ordenes_trabajo.id`
- Trigger 1: inmutabilidad de eventos cerrados (BEFORE UPDATE ON eventos)
- Trigger de sincronización OT-Evento
- Restricción DB: mecánico no puede cerrar eventos ni actualizar eventos no asignados

---

## 12. Riesgos

| ID | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R-01 | **fn_crear_historia_tecnica ejecutada como SECURITY INVOKER bloquearía INSERT en historias_tecnicas** | BLOCKER | La función DEBE ser SECURITY DEFINER owned by postgres. Verificar en checklist §13 antes de ejecutar SQL. |
| R-02 | **pg_advisory_xact_lock en anti-ciclo serializa todos los INSERTs en referencias_evento de una transacción** | MEDIUM | El lock es de transacción (`xact_lock`), no de sesión. El advisory se libera al commit. Para el volumen esperado (pocas referencias por evento), la serialización es aceptable. Si el uso crece, evaluar lock más granular basado en `(min(origen, destino), max(origen, destino))`. |
| R-03 | **UNIQUE(org_id, patente) sin partial permite que una patente soft-deleted bloquee re-registro** | MEDIUM | Decisión deliberada (ver §4.3): una patente identifica un vehículo de por vida. Re-activar via UPDATE eliminado_en=NULL es el flujo correcto. Documentar en UI y en script de migración TallerGP. |
| R-04 | **Migración TallerGP: vehiculos sin historia_tecnica al importar** | HIGH | El trigger `trg_80_vehiculos_crear_historia_tecnica` se dispara en EVERY INSERT de vehiculos, incluyendo los del script de migración. Verificar en smoke test post-migración que `COUNT(vehiculos) = COUNT(historias_tecnicas)`. |
| R-05 | **tipos_evento.UNIQUE(org_id, slug) WHERE activo=true puede permitir slugs duplicados si activo va alternando** | LOW | Comportamiento intencional: un slug desactivado puede reutilizarse. El riesgo es confusión en dashboards históricos que usan slug como identificador. Documentar que slug NO es un identificador permanente: usar `id` para referencias persistentes. |
| R-06 | **eventos.creado_por NOT NULL bloquea inserciones de sistema** | MEDIUM | Eventos creados por cron jobs o Edge Functions de sistema deben proveer un `usuario_id` de sistema. Definir un usuario de sistema por organización durante el onboarding, o hacer `creado_por` nullable. Este spec lo define como NOT NULL — implicación: Edge Functions deben autenticarse con un usuario real o con service_role (que bypasea RLS). |
| R-07 | **referencias_evento cross-tenant: los lookups de org_id en INSERT policy agregan 2 SELECTs por INSERT** | LOW | Aceptable para volumen esperado. Si el volumen de referencias crece (sistema de correcciones masivas), evaluar índice cubriente en eventos(id, org_id). |
| R-08 | **clientes_select excluye cliente_portal hasta Migration 006** | MEDIUM | Hasta que Migration 006 cree la vista `v_clientes_portal`, los usuarios con rol `cliente_portal` no pueden ver datos de su propio perfil de cliente. Verificar que el Portal Cliente no intenta leer `clientes` directamente antes de Migration 006. |
| R-09 | **fn_referencias_evento_anti_ciclo: CTE recursiva no sigue arcos eliminados (eliminado_en IS NULL)** | MEDIUM | La CTE filtra con `re.eliminado_en IS NULL`. Si un arco que cerraba un ciclo es eliminado (soft-deleted), el ciclo se "abre" en el grafo activo — el trigger correcto permitirá INSERTs que antes habría bloqueado. Este es el comportamiento deseado: el DAG activo es el que importa. |
| R-10 | **Depuración de grafos cíclicos durante migración TallerGP** | HIGH | El script de migración de TallerGP puede crear referencias de eventos que forman ciclos en el sistema legado. El trigger bloqueará estos INSERTs. El script debe detectar y loggear estos casos, y crear las referencias en un orden que evite ciclos (BFS/topological sort del grafo TallerGP antes de migrar). |

---

## 13. Checklist pre-SQL

Ningún SQL puede escribirse hasta que todos los ítems de la Sección A estén verificados.

### Sección A — Bloqueantes pre-SQL

- [ ] **R-01 verificado:** confirmar mecanismo para que `fn_crear_historia_tecnica()` sea SECURITY DEFINER owned by postgres y pueda INSERT en `historias_tecnicas` sin policy de INSERT activa para usuarios.
- [ ] **Schema canónico verificado:** todas las columnas de `eventos` (incluido `conductor_id` y `orden_trabajo_id`) revisadas contra DATABASE_MODEL.md §4.2 y WORKSHOP_OPERATING_MODEL.md.
- [ ] **Orden de FKs diferidas verificado:** los dos ALTER TABLE de `transiciones_evento` se ejecutan en los momentos correctos del script (después de crear `vehiculos` y `eventos` respectivamente).
- [ ] **Referencias_evento INSERT policy con subquery cross-tenant confirmada:** la verificación de org_id en `evento_origen_id` y `evento_destino_id` está en el WITH CHECK de la policy.
- [ ] **fn_referencias_evento_anti_ciclo usa pg_advisory_xact_lock (no advisory_lock de sesión):** verificar que la función usa `pg_advisory_xact_lock` y no `pg_advisory_lock` (el lock de sesión no se libera al commit).
- [ ] **historias_tecnicas sin policy INSERT para usuarios:** confirmar que ENABLE ROW LEVEL SECURITY sin policy de INSERT bloquea INSERTs desde roles de aplicación, y que la función SECURITY DEFINER las bypasea.
- [ ] **FKs ON DELETE especificadas para TODOS los campos FK en §6.2:** revisar que no hay FKs sin ON DELETE especificado en el SQL.

### Sección B — Pre-merge a main

- [ ] **R-04 verificado:** smoke test post-creación de tablas: `SELECT COUNT(*) FROM vehiculos` = `SELECT COUNT(*) FROM historias_tecnicas` = 0 (en DB vacía). Post-insert: insertar un vehiculo y verificar que se creó su historia_tecnica automáticamente.
- [ ] **Smoke test anti-ciclo:** insertar referencias A→B, B→C, luego intentar C→A — debe fallar con EXCEPTION. Intentar B→A — debe fallar. Insertar B→D — debe funcionar.
- [ ] **Smoke test RLS mecánico vs clientes:** con rol mecanico, intentar SELECT en clientes — debe retornar 0 filas. Con rol recepcionista — debe retornar filas.
- [ ] **Smoke test cross-tenant referencias_evento:** con usuario tenant A, intentar INSERT en referencias_evento con evento_destino_id de tenant B — debe fallar.
- [ ] **Smoke test GIN pg_trgm:** `SELECT * FROM clientes WHERE nombre ILIKE '%martín%'` — verificar que usa el índice GIN (EXPLAIN ANALYZE).
- [ ] **Verificar que tipos_evento insert de Edge Function de onboarding funciona con service_role:** la policy de INSERT requiere `mi_rol() IN ('admin')`. Con service_role, RLS es bypaseado → correcto. Sin service_role, la Edge Function fallaría. Documentar que la Edge Function de onboarding debe usar service_role.
- [ ] **R-06 resuelto:** decisión documentada sobre `creado_por` en eventos para inserciones de sistema: ¿usuario de sistema por org o nullable? Decisión tomada y reflejada en SQL.
- [ ] **Trigger naming verificado:** todos los triggers de Migration 002 siguen la convención `trg_{01|50|80|99}_{tabla}_{accion}`.
- [ ] **No triggers de auditoría en referencias_evento** — confirmar ausencia de `trg_99_referencias_evento_audit` en el SQL.
- [ ] **postrgresql ANALYZE** ejecutado después de la migración en staging para actualizar estadísticas antes de queries de production.

### Sección C — Pre-go-live

- [ ] Script de migración TallerGP para `vehiculos` + `clientes` + `conductores` resuelve duplicados de patente antes de importar.
- [ ] Script de migración TallerGP para `referencias_evento` hace topological sort del grafo antes de importar (evitar R-10).
- [ ] PA11 (sincronización de nuevos tipos al catálogo global) documentada como riesgo activo en el backlog.
- [ ] Portal Cliente (rol `cliente_portal`) no intenta leer `clientes` directamente antes de Migration 006.
- [ ] Test de aislamiento cross-tenant automatizado en CI para las 8 tablas nuevas.

---

## 14. Architecture Board Review

**Fecha:** Junio 2026  
**Estado:** COMPLETADO — ver veredicto en §14.7  
**Documento revisado:** este spec v0.1  
**Especialistas:** Lead Architect · PostgreSQL Guardian · Domain Guardian · Security Guardian · Performance Guardian · Reviewer

---

### 14.1 Lead Architect

**Veredicto:** APPROVED WITH CONDITIONS

**Hallazgos:**

**[HIGH-LA-1] — `fn_crear_historia_tecnica()` como SECURITY DEFINER no está suficientemente especificada**

La función necesita ser SECURITY DEFINER owned by postgres, igual que `fn_audit_insert()`. Si se define como SECURITY INVOKER (o con el owner incorrecto), el INSERT en `historias_tecnicas` falla silenciosamente para todos los orígenes (la table tiene RLS habilitado sin policy de INSERT para usuarios). El spec describe el comportamiento pero no especifica el `OWNER` ni el `SET search_path = public`.

**Resolución:** la declaración de la función en el SQL de Migration 002 debe cumplir los siguientes requisitos:
- Definida como `SECURITY DEFINER` para ejecutarse con los privilegios del owner, no del rol invocador.
- Incluir `SET search_path = public` para prevenir hijacking del search_path (mismo patrón que `fn_audit_insert()` en Migration 001).
- Ser propiedad de `postgres` (el rol con BYPASSRLS), no del rol de aplicación. Sin este ownership, la función SECURITY DEFINER no tendrá permisos para INSERT en `historias_tecnicas`, que no tiene policy de INSERT para usuarios.

Añadido al checklist §13 Sección A como primer ítem.

**[MEDIUM-LA-1] — `eventos.orden_trabajo_id` sin FK activa: riesgo de orphan UUIDs**

La columna existe como UUID NULL sin FK activa. Cualquier UUID puede insertarse como `orden_trabajo_id` en Migration 002 — no hay validación referencial. Esto incluye UUIDs de otras organizaciones o UUIDs inventados.

**Resolución aceptada:** el riesgo es bajo porque la columna es NULL por defecto y la aplicación no la usa hasta Migration 003. El spec ya lo documenta como deferred. Añadir nota en §11: "Hasta Migration 003, la aplicación no debe escribir en `eventos.orden_trabajo_id`. Si se escribe, el valor no tiene validación referencial."

**[LOW-LA-1] — Ausencia de `actor_tipo` en columnas de `eventos`**

`transiciones_evento` tiene `actor_tipo TEXT` ('humano' | 'sistema'). Los eventos creados por triggers de sistema (vs por usuarios) no tienen actualmente un campo equivalente. Para queries de "eventos generados automáticamente vs manualmente", no hay forma directa de distinguirlos excepto verificar `creado_por`.

**Resolución:** diferido. `creado_por IS NULL` podría usarse como proxy para eventos de sistema, pero `creado_por` es NOT NULL en el spec actual. Abrir como PA-12 en DATABASE_MODEL.md si se necesita en futuro.

---

### 14.2 PostgreSQL Guardian

**Veredicto:** APPROVED WITH CONDITIONS

**Hallazgos:**

**[HIGH-PG-1] — `fn_crear_historia_tecnica()` vs triggers AFTER INSERT en tables particionadas: verificar que vehiculos NO es particionada**

Migration 001 tiene `transiciones_evento` y `audit_log` como tablas particionadas. `vehiculos` NO es particionada, lo que es correcto para una tabla de entidades únicas. Sin embargo, el SQL de Migration 002 debe confirmar explícitamente que `vehiculos` se crea sin particionamiento. Si por error se hereda la sintaxis de una tabla particionada de Migration 001, el trigger AFTER INSERT fallará diferente según la partición.

**Resolución:** trivial — `vehiculos` no tiene cláusula `PARTITION BY`. Verificar en revisión de SQL.

**[HIGH-PG-2] — UNIQUE constraint `(org_id, patente)` sin partial puede coexistir con soft-delete, pero su semántica es correcta para el dominio**

El spec justifica la elección (§4.3). El Guardian confirma que la decisión es técnicamente correcta: en PostgreSQL, una UNIQUE constraint sin `WHERE` se aplica a TODAS las filas incluyendo soft-deleted. Esto es la semántica deseada para `vehiculos.patente`. La implicación: el script de migración TallerGP debe verificar unicidad de `(org_id, patente)` antes de importar (duplicados en TallerGP son posibles).

**[MEDIUM-PG-1] — `historias_tecnicas.org_id` redundante vs derivable desde vehiculos**

El Guardian confirma que la redundancia de `org_id` en `historias_tecnicas` es el patrón correcto para el sistema: evita JOINs en cada evaluación de RLS. La FK `historias_tecnicas.org_id → organizaciones.id` es válida. Sin embargo, debe garantizarse que `vehiculos.org_id = historias_tecnicas.org_id` para el mismo `vehiculo_id`. Esto no está forzado por constraints en el spec.

**Resolución:** añadir CHECK o trigger que verifique consistencia de org_id al crear historia_tecnica via trigger. En `fn_crear_historia_tecnica()`:
```sql
INSERT INTO historias_tecnicas (vehiculo_id, org_id, ...)
VALUES (NEW.id, NEW.org_id, ...);  -- NEW.org_id viene del vehiculo, garantizando consistencia
```
Esta consistencia es natural si se usa `NEW.org_id` en el trigger. El SQL debe usar `NEW.org_id` explícitamente.

**[LOW-PG-1] — `referencias_evento` no tiene `actualizado_en`**

Confirmado como correcto. Las referencias son inmutables. No se necesita trigger `fn_set_updated_at()` ni columna `actualizado_en`. Si se agrega accidentalmente, el trigger BEFORE UPDATE intentaría setear un campo que no existe → error DDL. El implementador debe omitir el trigger en esta tabla.

---

### 14.3 Domain Guardian

**Veredicto:** APPROVED WITH CONDITIONS

**Hallazgos:**

**[HIGH-DG-1] — La asociación conductor-evento no está en el Domain Model pero el spec la introduce**

`eventos.conductor_id` es una columna que este spec introduce como FK a `conductores`. DATABASE_MODEL §4.7 dice: "conductores se asocian a una visita (evento de recepción) específica". El spec interpreta esta asociación como un campo directo en `eventos`. Sin embargo, DATABASE_MODEL y DOMAIN_MODEL no especifican explícitamente que el link sea en `eventos` vs en `ordenes_trabajo` (que es el documento de recepción principal).

**Análisis de opciones:**
- **Opción A (spec actual):** `eventos.conductor_id` — directo, disponible desde Migration 002.
- **Opción B:** `ordenes_trabajo.conductor_id` — lógicamente más correcto (la OT es el documento de recepción), pero depende de Migration 003.

**Decisión del Architecture Board:** la Opción A es aceptable como implementación práctica. El evento de tipo "recepción" es donde el conductor aparece físicamente. Mantener `conductor_id` en `eventos`. Añadir nota en DATABASE_MODEL §4.7: "conductor_id se registra en el evento de recepción (FK en tabla `eventos`)."

**[MEDIUM-DG-1] — `referencias_evento.tipo` values no aparecen en ningún documento del dominio**

El spec introduce `tipo IN ('precede_a', 'relacionado_con', 'correccion_de', 'garantia_de')`. Estos valores son una decisión de implementación no documentada en DATABASE_MODEL ni EVENT_MODEL. DATABASE_MODEL §4.2 solo dice "un evento puede referenciar a otro como origen, contexto o corrección."

**Resolución:** los valores propuestos son coherentes con el modelo:
- `precede_a` — relación causal (diagnóstico precede a reparación)
- `relacionado_con` — relación contextual
- `correccion_de` — corrección de evento cerrado (DATABASE_MODEL §7, inmutabilidad)
- `garantia_de` — garantía referenciando reparación original (DATABASE_MODEL §4.5)

**Se acepta.** Añadir la enumeración al DATABASE_MODEL §4.2 como parte del contrato de `referencias_evento`.

**[LOW-DG-1] — `propietarios_vehiculo` no tiene FK a `conductores`**

El conductor que trae el vehículo y el propietario son entidades distintas. El spec las mantiene separadas correctamente. Sin embargo, el Portal Cliente (PA1) necesita saber qué vehículos pertenecen al cliente autenticado, y eso requiere navegar `propietarios_vehiculo.cliente_id`. Si el cliente_portal no tiene una forma de encontrar su `cliente_id`, este flujo no funciona.

**Estado:** confirmado como pendiente para Migration 006. El spec lo registra en R-08.

---

### 14.4 Security Guardian

**Veredicto:** APPROVED WITH CONDITIONS

**Hallazgos:**

**[BLOCKER-SEC-1] — `referencias_evento` INSERT policy sin subquery: cross-tenant reference posible hasta Migration 003**

El spec §9.9 ya identifica este riesgo e incluye la solución (subquery en WITH CHECK). El Guardian confirma que esta solución ES requerida en Migration 002. Sin ella:

```sql
-- Atacante del tenant A inserta referencia a evento de tenant B
INSERT INTO referencias_evento (evento_origen_id, evento_destino_id, org_id, tipo, creado_por)
VALUES (mi_evento_uuid, evento_ajeno_uuid, mi_org_id, 'relacionado_con', mi_usuario_id)
```

La SELECT policy en `eventos` previene que el atacante OBTENGA el UUID del evento ajeno via el SDK normal. Pero si el UUID es conocido (fue visto antes de un offboarding, o fue expuesto por otro vector), el INSERT puede proceder. La subquery en WITH CHECK cierra este vector.

**Severidad:** BLOCKER pre-deploy. El spec §9.9 ya lo incluye. Asegurar que el SQL lo implemente.

**[HIGH-SEC-1] — `historias_tecnicas` UPDATE policy demasiado permisiva para recepcionista**

El spec §9.4 permite UPDATE a recepcionista sobre `historias_tecnicas`. `historias_tecnicas` contiene `notas` administrativas sobre el historial. Un recepcionista podría borrar notas del historial técnico. Dado que la tabla no tiene soft-delete ni audit de campo-level, este cambio sería irreversible desde la perspectiva del negocio.

**Resolución:** cambiar UPDATE policy para `historias_tecnicas` a solo `admin` y `jefe_taller`. La recepcionista ve el historial (SELECT) pero no puede editarlo.

**[HIGH-SEC-2] — `eventos` UPDATE WITH CHECK no protege campos críticos**

La policy UPDATE en §9.7 incluye `WITH CHECK (org_id = mi_org_id())` pero no previene que un mecánico actualice `tipo_evento_id`, `historia_tecnica_id`, `creado_por`, o `cerrado_en`. Aunque el Trigger 1 (inmutabilidad de cerrados) irá en Migration 003, incluso antes del cierre estos campos no deben ser modificables.

**Resolución parcial para Migration 002:** añadir al WITH CHECK para `mecanico`:
```sql
WITH CHECK (
  org_id = mi_org_id()
  AND (
    mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
    OR (
      mi_rol() = 'mecanico'
      AND cerrado_en IS NULL  -- mecánico no puede actualizar eventos cerrados
    )
  )
)
```
La protección completa de campos individuales requiere el Trigger 1 en Migration 003.

**[MEDIUM-SEC-1] — `tipos_evento` INSERT por solo `admin` puede bloquear onboarding Edge Function**

Si la Edge Function de onboarding usa el JWT de un usuario con rol `recepcionista` o `jefe_taller` (por error de configuración), el INSERT de tipos_evento fallará silenciosamente (0 rows inserted, RLS block). La Edge Function debe usar `service_role` y esto debe verificarse en el checklist.

**Resolución:** añadido a §13 Sección B.

---

### 14.5 Performance Guardian

**Veredicto:** APPROVED WITH CONDITIONS

**Hallazgos:**

**[HIGH-PERF-1] — GIN pg_trgm en `clientes.rut` puede ser sobredimensionado para un campo estructurado**

El RUT chileno tiene formato `XX.XXX.XXX-Y` (9-12 caracteres). Los usuarios buscan por RUT exacto o por fragmento (ej: los últimos 4 dígitos). GIN pg_trgm genera trigramas para substring search, pero tiene overhead de creación y escritura vs un B-tree.

**Análisis:** el B-tree `(org_id, rut) WHERE eliminado_en IS NULL` (ya en §7.1) cubre el caso de lookup exacto eficientemente. El GIN adicional agrega capacidad de search ILIKE '%...%'. Para talleres con <5000 clientes, el seq-scan sobre el B-tree filtrado por org_id (~50-500 filas) es más rápido que el GIN para datasets pequeños.

**Decisión:** mantener GIN en `clientes.rut` para cuando el catálogo crezca (Migration 001 review confirmó que la extensión `pg_trgm` está instalada). El overhead es bajo (<1ms en INSERTs típicos). PERO: añadir nota al spec "GIN en rut puede diferirse a Migration 004+ si el volumen inicial de clientes no lo justifica."

**[HIGH-PERF-2] — Falta índice en `eventos(org_id, historia_tecnica_id)`**

El dashboard del taller probablemente mostrará "últimos N eventos de todos los vehículos de esta organización". El query es:
```sql
SELECT * FROM eventos WHERE org_id = $1 ORDER BY creado_en DESC LIMIT 20
```
El índice `(org_id, creado_en DESC)` en §7.7 cubre este caso. ✓ Ya está en el spec.

**Pero:** el query de "eventos de un vehículo específico" es:
```sql
SELECT * FROM eventos WHERE historia_tecnica_id = $1 ORDER BY creado_en DESC
```
El índice `(historia_tecnica_id, creado_en DESC)` en §7.7 cubre este caso. ✓ Ya está en el spec.

**Sin hallazgo bloqueante — confirmación de cobertura de hot paths.**

**[MEDIUM-PERF-1] — Falta índice en `eventos(tipo_evento_id)`**

El query "todos los eventos de tipo Diagnóstico en esta organización" o "contar diagnósticos en el mes" no está cubierto por ningún índice en §7.7.

**Resolución:** añadir índice:
```
B-tree (org_id, tipo_evento_id, creado_en DESC) WHERE eliminado_en IS NULL — queries de analytics por tipo
```

Añadido a §7.7 en versión actualizada.

**[LOW-PERF-1] — `propietarios_vehiculo` — índice en historial completo**

El índice `B-tree (vehiculo_id)` (sin WHERE) en §7.5 cubre el historial completo de propietarios de un vehículo. Con soft-delete ausente en esta tabla, todas las filas son siempre activas o terminadas por `fecha_fin`. El índice sin filtro es correcto.

---

### 14.6 Reviewer

**Veredicto:** Spec APROBADA con hallazgos menores

**Hallazgos de consistencia interna:**

**[CORRECCIÓN-R-1] — §8.4 tabla de triggers: `historias_tecnicas` audit solo AFTER UPDATE (no INSERT)**

El spec §8.4 menciona correctamente que el trigger de audit en `historias_tecnicas` cubre solo UPDATE (no INSERT). Consistente con §3 que dice "Audit trigger: Sí". El Reviewer confirma: el INSERT en `historias_tecnicas` es un evento de sistema y no debe auditarse via `fn_audit_insert_trigger()`. El audit de la CREACIÓN del vehículo (que dispara la creación de historia_tecnica) ya queda capturado en audit_log via el trigger de `vehiculos`. Coherente.

**[CORRECCIÓN-R-2] — §6.1 dice que el ALTER de transiciones_evento.vehiculo_id va "después de Paso 04" pero el spec §2 dice "Paso 01 — Completar FKs diferidas"**

Inconsistencia de orden: §2 pone las FK diferidas en Paso 01 (al inicio), pero §6.1 dice que cada FK se ejecuta después de crear la tabla referenciada. Solo `vehiculo_id` puede completarse después de Paso 04, y `evento_id` después de Paso 08.

**Resolución:** corregir §2. El Paso 01 se divide:
```
Paso 01a — (Vacío al inicio: las FKs diferidas se completan en los pasos correspondientes)
Paso 04b — Después de crear vehiculos: ALTER TABLE transiciones_evento ADD FK vehiculo_id
Paso 08b — Después de crear eventos: ALTER TABLE transiciones_evento ADD FK evento_id
```

**[CORRECCIÓN-R-3] — §9.4 `historias_tecnicas` policy UPDATE debe actualizarse a solo admin+jefe_taller (HIGH-SEC-1)**

Incorporado en §14.7 como condición pre-SQL.

**[CORRECCIÓN-R-4] — §7.7 falta el índice `(org_id, tipo_evento_id, creado_en DESC)` identificado por Performance Guardian**

Añadir a §7.7 en el SQL final.

**[CORRECCIÓN-R-5] — §8.3 fn_referencias_evento_anti_ciclo: la CTE recursiva navega arcos en el sentido DESTINO→ORIGEN o ORIGEN→DESTINO?**

El grafo DAG tiene dirección: un arco es `(origen, destino)`. Para detectar si agregar `(NEW.origen, NEW.destino)` crea un ciclo, se debe verificar si `NEW.origen` es alcanzable DESDE `NEW.destino` siguiendo arcos existentes.

La CTE en §8.3 dice: "nodo inicial: evento_destino". Luego expande `re.evento_destino_id` siguiendo `re.evento_origen_id = a.evento_id`. Esto navega arcos en la dirección correcta: desde `destino` hacia adelante (en dirección de los arcos), buscando si se alcanza `origen`. Si se alcanza, hay un ciclo.

**Confirmado como correcto.** La dirección de la CTE es la esperada.

---

### 14.7 Veredicto final Architecture Board

**APPROVED WITH CONDITIONS**

**Condiciones para comenzar SQL (Sección A del checklist §13 actualizada con hallazgos del Board):**

- [ ] **BLOCKER-SEC-1 resuelto en SQL:** `referencias_evento` INSERT policy WITH CHECK incluye subquery de verificación de org_id en ambos eventos referenciados.
- [ ] **HIGH-LA-1:** `fn_crear_historia_tecnica()` definida como SECURITY DEFINER + SET search_path = public + OWNER postgres.
- [ ] **HIGH-SEC-1:** `historias_tecnicas` UPDATE policy restringida a `admin` y `jefe_taller` únicamente (recepcionista solo SELECT).
- [ ] **HIGH-SEC-2:** `eventos` UPDATE WITH CHECK incluye restricción `cerrado_en IS NULL` para rol `mecanico`.
- [ ] **CORRECCIÓN-R-2:** el orden de §2 corregido: ALTER TABLE de FKs diferidas se ejecuta después de crear la tabla referenciada (vehiculos en Paso 04b, eventos en Paso 08b), no al inicio.
- [ ] **CORRECCIÓN-R-4:** índice `(org_id, tipo_evento_id, creado_en DESC) WHERE eliminado_en IS NULL` añadido a §7.7 en el SQL.

**Condiciones pre-merge (Sección B del checklist §13):**

- [ ] **MEDIUM-DG-1 documentado:** valores de `referencias_evento.tipo` añadidos a DATABASE_MODEL.md §4.2 (4 valores: precede_a, relacionado_con, correccion_de, garantia_de).
- [ ] **HIGH-DG-1 documentado:** nota en DATABASE_MODEL.md §4.7 que `conductor_id` se registra en `eventos`.
- [ ] **MEDIUM-SEC-1 verificado:** Edge Function de onboarding usa `service_role` (confirmado en código antes de deploy).
- [ ] Todos los ítems de Sección B de §13.

**Diseño fundamental aprobado:** la arquitectura de 8 tablas, las 2 nuevas funciones de trigger, el sistema de índices y las políticas RLS son correctas. Ningún especialista encontró un error arquitectural que requiera rediseño. Los hallazgos son gaps de especificación o ajustes de seguridad resolubles en el SQL.

**Nota específica del Lead Architect:** La deuda de trigger en `eventos` (Trigger 1 — inmutabilidad de cerrados) debe priorizarse en Migration 003 como primer ítem, no puede diferirse más allá. Cada sprint entre Migration 002 y Migration 003 que permita UPDATE a eventos cerrados es una ventana de degradación de datos sin corrección posible.

---

*Spec aprobada por Architecture Board. Pendiente revisión humana antes de escribir SQL.*  
*Siguiente paso: esperar aprobación. No crear Migration 002 hasta confirmación explícita.*
