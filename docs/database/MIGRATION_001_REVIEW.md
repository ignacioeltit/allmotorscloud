# Migration 001 — DBA Review (Gate 0 Pre-SQL)

**Estado:** APPROVED WITH CONDITIONS — Architecture Board completado  
**Versión:** 1.1  
**Fecha:** Junio 2026  
**Revisor:** Principal PostgreSQL Database Engineer  
**Documento revisado:** `docs/database/MIGRATION_001_SPEC.md` v0.2  
**Fuentes autoritativas leídas:** CLAUDE.md · product-bible/** · business/** · domain-model/** · application/** · architecture/** · docs/database/MIGRATION_001_SPEC.md

---

## Propósito

Este documento es el último gate técnico antes de escribir una sola línea de SQL para Migration 001. Su función es detectar problemas que son triviales de corregir en el diseño pero catastrophic de corregir en producción con datos reales.

Un error en un índice se corrige en horas. Un error en la estrategia de particionamiento de una tabla con 500M filas se corrige en semanas con downtime. Este documento existe para que el segundo escenario nunca ocurra.

**Resultado requerido:** APPROVED, APPROVED WITH CONDITIONS, o BLOCKED.  
**Si BLOCKED:** ningún SQL se escribe hasta resolver los blockers.  
**Si APPROVED WITH CONDITIONS:** el SQL puede comenzar, pero los conditions deben resolverse antes del primer merge a main.

---

## Resumen ejecutivo

| Sección | Estado | Bloqueadores | HIGH | MEDIUM | LOW |
|---|---|---|---|---|---|
| 1. Orden de creación | WARN | 0 | 2 | 2 | 1 |
| 2. Foreign Keys | FAIL | 1 | 2 | 1 | 0 |
| 3. Índices | WARN | 1 | 1 | 3 | 1 |
| 4. Particionamiento | PASS | 0 | 1 | 2 | 1 |
| 5. Concurrencia | WARN | 0 | 3 | 2 | 1 |
| 6. RLS | WARN | 0 | 2 | 2 | 1 |
| 7. Triggers | FAIL | 1 | 2 | 1 | 1 |
| 8. Ejecución de migration | FAIL | 1 | 1 | 1 | 0 |
| 9. Supabase | WARN | 0 | 3 | 2 | 1 |
| 10. Escalabilidad | WARN | 0 | 1 | 2 | 1 |

**Veredicto DBA v1.0:** BLOCKED — 3 blockers encontrados  
**Veredicto Architecture Board v1.1:** APPROVED WITH CONDITIONS — ver §13

---

## 1. Orden de Creación

### 1.1 Análisis del grafo de dependencias

El orden especificado en §2 del spec es:

```
Paso 1: Extensiones
Paso 2: Funciones SECURITY DEFINER
Paso 3: Tablas catálogo global (roles, tipos_evento_base)
Paso 4: organizaciones
Paso 5: sucursales
Paso 6: usuarios → ALTER TABLE organizaciones/sucursales ADD FK creado_por
Paso 7: permisos_rol
Paso 8: transiciones_evento (particionada) + audit_log (particionada)
Paso 9: Triggers
Paso 10: Índices
Paso 11: RLS
Paso 12: Seeds
```

**Dependencias resueltas correctamente:**
- `roles` antes de `usuarios` (necesario para FK `rol_id`): ✓
- `organizaciones` antes de `sucursales` (FK `org_id`): ✓
- `sucursales` antes de `usuarios` (FK `sucursal_id`): ✓
- Funciones antes de RLS policies (policies las invocan): ✓
- Tablas antes de triggers (triggers referencian tablas): ✓
- Tablas antes de índices (índices necesitan tabla): ✓
- Seeds al final (RLS activo en ese momento): ✓

### 1.2 HIGH — organizaciones.creado_por sin FK no bloquea pero crea un estado de integridad incompleto

**Contexto:** el spec declara `organizaciones.creado_por` como UUID nullable sin FK en Paso 4, y añade la FK via ALTER TABLE en Paso 6 después de crear `usuarios`.

**Problema:** entre Paso 4 y Paso 6, `organizaciones` existe con la columna `creado_por` sin FK. Si la migration falla entre Paso 4 y Paso 6 (por ejemplo, al crear `usuarios` por un error de constraint), y se re-ejecuta parcialmente, el estado resultante tiene `organizaciones` sin FK en `creado_por` — un constraint que debería existir. El implementador puede asumir que la migration completó correctamente cuando no lo hizo.

**Mitigación requerida:** la migration debe ser idempotente. El ALTER TABLE de Paso 6 debe usar `ADD CONSTRAINT IF NOT EXISTS`. Si el implementador re-ejecuta la migration desde el principio (DROP+recreate), esto no es un problema porque todo se recrea. Pero si solo re-ejecuta el Paso 6 en una migration fallida, la constraint puede ya existir. El spec no especifica la estrategia ante fallo parcial.

**Resolución:** añadir al spec la instrucción explícita de que toda migration debe ejecutarse dentro de BEGIN/COMMIT (ver §8) excepto las extensiones, y que `IF NOT EXISTS` se usa en todas las DDL statements de la migration.

### 1.3 HIGH — El orden Paso 9 (triggers) antes de Paso 10 (índices) es subóptimo para seeds

**Contexto:** los seeds se insertan en Paso 12, después de que los triggers de auditoría están activos (Paso 9) y los índices existen (Paso 10).

**Problema:** el trigger `fn_audit_insert_trigger` se activará durante la inserción de seeds (INSERT en `roles`, INSERT en `tipos_evento_base`). Esto generará filas en `audit_log` para las inserciones de seed. Estas filas tienen `actor_id = NULL` (no hay usuario autenticado durante una migration) y `org_id = NULL` para los catálogos globales que no tienen `org_id`.

**Consecuencias:**
- `audit_log` tendrá filas con `actor_id = NULL` y `org_id = NULL` desde el momento 0 de producción.
- El índice `(org_id, created_at DESC)` en `audit_log` tendrá NULL values desde el inicio.
- Si `org_id NOT NULL` es el constraint elegido en `audit_log`, los seeds provocarán un error de constraint durante la migration.

**Resolución:** el spec debe decidir explícitamente una de estas opciones:
- (A) `audit_log.org_id` permite NULL para registros de sistema/migration. En este caso los seeds generan filas válidas.
- (B) los triggers de auditoría se crean DESPUÉS de los seeds (intercambiar Paso 9 y Paso 12), y se activan a partir del primer uso real.
- (C) los seeds se ejecutan sin triggers activos (SET session_replication_role = replica; para deshabilitar triggers temporalmente).

**Opción recomendada:** (B). Los seeds son datos de instalación, no actividad de usuario. El audit trail debe registrar actividad operacional, no instalación del software.

### 1.4 MEDIUM — Orden Paso 11 (RLS) antes de Paso 12 (Seeds) puede bloquear seeds inesperadamente

**Contexto:** RLS se habilita en Paso 11. Seeds se insertan en Paso 12.

**Problema:** si la migration se ejecuta bajo un rol que no es `postgres` o `service_role`, las policies RLS de los catálogos globales (`roles`, `tipos_evento_base`) bloquean INSERT para roles de aplicación. Las migrations en Supabase se ejecutan como `postgres` (superuser), que BYPASSRLS. Sin embargo, si en algún momento la migration se ejecuta con un rol diferente (error de configuración del proyecto Supabase), los seeds fallarán silenciosamente por RLS.

**Mitigación:** documentar explícitamente en el spec y en el checklist §11 que la migration debe ejecutarse como el rol `postgres` o `service_role`. Verificar el contexto de ejecución antes de comenzar.

### 1.5 LOW — `transiciones_evento` y `audit_log` se crean antes de sus índices (Paso 8 antes de Paso 10)

Esto es correcto y esperado — no se puede crear un índice antes de que exista la tabla. No es un problema. La observación es solo para confirmar que el orden no fue accidental.

---

## 2. Foreign Keys

### 2.1 Tabla completa de FKs en Migration 001

| Tabla | Columna | Referencia | Nullable | Puede crearse inmediato | Diferida | FK en spec | Riesgo |
|---|---|---|---|---|---|---|---|
| `sucursales` | `org_id` | `organizaciones.id` | NOT NULL | Sí (Paso 5 después de Paso 4) | No | Sí | Ninguno |
| `sucursales` | `creado_por` | `usuarios.id` | NULL | No (usuarios no existe en Paso 5) | Sí, ALTER en Paso 6 | Sí ✓ | Ver §1.2 |
| `sucursales` | `eliminado_por` | `usuarios.id` | NULL | No | Sí, ALTER en Paso 6 | **No mencionada** | HIGH — ver abajo |
| `usuarios` | `org_id` | `organizaciones.id` | NOT NULL | Sí (Paso 6 después de Paso 4) | No | Sí | Ninguno |
| `usuarios` | `sucursal_id` | `sucursales.id` | NULL (admin sin sucursal) | Sí (Paso 6 después de Paso 5) | No | Sí | Ninguno |
| `usuarios` | `rol_id` | `roles.id` | NOT NULL | Sí (Paso 6 después de Paso 3) | No | Sí | Ninguno |
| `usuarios` | `creado_por` | `usuarios.id` (self-referential) | NULL | No — auto-referencia circular | Sí, ALTER en Paso 6 | **No mencionada** | HIGH — ver abajo |
| `usuarios` | `eliminado_por` | `usuarios.id` | NULL | No | Sí, ALTER en Paso 6 | **No mencionada** | HIGH |
| `organizaciones` | `creado_por` | `usuarios.id` | NULL | No (usuarios no existe en Paso 4) | Sí, ALTER en Paso 6 | Sí ✓ | Ver §1.2 |
| `organizaciones` | `eliminado_por` | `usuarios.id` | NULL | No | Sí, ALTER en Paso 6 | **No mencionada** | HIGH |
| `permisos_rol` | `org_id` | `organizaciones.id` | NOT NULL | Sí (Paso 7 después de Paso 4) | No | Sí | Ninguno |
| `permisos_rol` | `rol_id` | `roles.id` | NOT NULL | Sí (Paso 7 después de Paso 3) | No | Sí | Ninguno |
| `permisos_rol` | `creado_por` | `usuarios.id` | NULL | Sí (Paso 7 después de Paso 6) | No | **No mencionada** | MEDIUM |
| `transiciones_evento` | `evento_id` | `eventos.id` | NOT NULL | No (eventos no existe en 001) | Sí, ALTER en Migration 002 | Sí ✓ | Ver §2.2 |
| `transiciones_evento` | `org_id` | `organizaciones.id` | NOT NULL | Sí (Paso 8 después de Paso 4) | No | **No mencionada** | MEDIUM |
| `transiciones_evento` | `actor_id` | `usuarios.id` | NULL? | Sí si nullable (Paso 8 después de Paso 6) | — | **No mencionada** | HIGH — ver abajo |
| `audit_log` | `org_id` | `organizaciones.id` | NULL? | Depende de nullability | — | **No mencionada** | HIGH — ver abajo |
| `audit_log` | `actor_id` | `usuarios.id` | NULL | Sí si nullable | No | **No mencionada** | MEDIUM |

### 2.2 BLOCKER — `vehiculo_id` no existe como columna en `transiciones_evento` pero el spec requiere un índice sobre ella

**Descripción del problema:**

`MIGRATION_001_SPEC.md` §6.5 define el índice:
```
B-tree (vehiculo_id, creado_en DESC) en transiciones_evento
Propósito: "Índice primario para queries de Historia Técnica por vehículo"
```

`PHYSICAL_SCHEMA.md` §4 confirma: "El índice compuesto `(vehiculo_id, creado_en)` cubre esas queries independientemente de la partición."

Sin embargo, `DATABASE_MODEL.md` §4.2 define `transiciones_evento` con las columnas conceptuales:
- `id`, `evento_id`, `org_id`, `estado_anterior`, `estado_nuevo`, `actor_id`, `actor_tipo`, `creado_en`, `razon`

`vehiculo_id` **no aparece** en el modelo de `transiciones_evento`.

**Diagnóstico:** hay una de dos situaciones:
- (A) `vehiculo_id` fue omitido en la lista de columnas de DATABASE_MODEL.md §4.2 pero está diseñado para existir como columna denormalizada en `transiciones_evento` (para evitar el triple JOIN `transiciones_evento → eventos → historias_tecnicas → vehiculos` en el hot query path).
- (B) `vehiculo_id` no existe en `transiciones_evento`, el índice del spec es un error, y las queries por vehiculo_id deben hacerse via JOIN a `eventos`.

**Impacto de la opción A (columna existe como denormalización):**
- El implementador debe añadir `vehiculo_id UUID NOT NULL` a `transiciones_evento`.
- Debe documentarse la fuente del valor: el trigger que inserta en `transiciones_evento` debe recibir `vehiculo_id` del evento referenciado, o la aplicación debe proveerlo.
- Si Migration 002 añade la FK `transiciones_evento.evento_id → eventos.id`, la FK de `vehiculo_id → vehiculos.id` también debe añadirse en Migration 002.
- Esta es una denormalización deliberada — debe documentarse explícitamente.

**Impacto de la opción B (columna no existe):**
- El índice `(vehiculo_id, creado_en DESC)` no puede crearse — provoca un error DDL.
- `PHYSICAL_SCHEMA.md` §4 está incorrecto y debe actualizarse.
- Las queries de Historia Técnica requieren JOIN a `eventos` para obtener `vehiculo_id` o `historia_tecnica_id`.

**Resolución requerida antes de escribir SQL:** el Architecture Board y el autor del spec deben decidir entre opción A u opción B, y actualizar todos los documentos afectados. No existe un default razonable — esta es una decisión de diseño con impacto en el hot query path del sistema.

**Si se elige opción A:** añadir `vehiculo_id UUID NOT NULL` a la especificación de columnas de `transiciones_evento` en DATABASE_MODEL.md §4.2, con nota "denormalización deliberada para el índice de Historia Técnica". También añadir la FK `vehiculo_id → vehiculos.id` como deferred a Migration 002.

**Si se elige opción B:** eliminar el índice `(vehiculo_id, creado_en DESC)` del spec §6.5 y actualizar PHYSICAL_SCHEMA.md §4 para reflejar que las queries de historia técnica requieren JOIN.

### 2.3 HIGH — FKs de `eliminado_por` y `creado_por` en sucursales, organizaciones y permisos_rol no están en el spec

El spec §2 solo menciona el ALTER TABLE para `organizaciones.creado_por → usuarios.id`. Las siguientes FKs similares están ausentes del spec:

- `sucursales.eliminado_por → usuarios.id`
- `organizaciones.eliminado_por → usuarios.id`
- `usuarios.creado_por → usuarios.id` (self-referential)
- `usuarios.eliminado_por → usuarios.id` (self-referential)
- `permisos_rol.creado_por → usuarios.id`

Estas FKs comparten la misma característica: son circulares o referencian tablas no creadas aún en el orden del spec. Todas deben estar en el ALTER TABLE del Paso 6.

La ausencia en el spec no significa que no deban crearse — significa que el implementador puede omitirlas al escribir el SQL porque no están en la checklist.

**Resolución:** completar el paso 6 del spec con todos los ALTER TABLE pendientes, no solo el de `organizaciones.creado_por`.

### 2.4 HIGH — `audit_log.org_id` y `transiciones_evento.org_id`: nullability y FK no especificadas

**Para `transiciones_evento.org_id`:**
El spec §8.2 muestra policies RLS que usan `org_id = mi_org_id()`. Esto implica que `org_id` existe como columna. Pero no está especificada en la tabla de columnas (que no existe formalmente en el spec para `transiciones_evento`). La FK `org_id → organizaciones.id` no está en el spec.

**Para `audit_log.org_id`:**
`audit_log` registra actividad de sistema (incluyendo seeds durante la migration). Estos registros pueden tener `org_id = NULL` si los catálogos globales se auditan. Si `audit_log.org_id` es NOT NULL, los seeds (que insertan en `roles` y `tipos_evento_base` sin org_id) generarán errores de constraint durante la migration. Si es NULL, el índice `(org_id, created_at DESC)` debe ser un índice parcial `WHERE org_id IS NOT NULL` para evitar miles de entradas NULL en el índice.

**Resolución:** especificar explícitamente:
- `transiciones_evento.org_id UUID NOT NULL`, FK a organizaciones.id (creada en Paso 8)
- `audit_log.org_id UUID NULL`, sin FK (para preservar registros de sistema y migración), índice parcial `WHERE org_id IS NOT NULL`

### 2.5 MEDIUM — `audit_log.actor_id` sin FK a usuarios

El actor de una acción de auditoría puede ser un usuario eliminado (soft-deleted). Si `actor_id` tiene FK a `usuarios.id`, un intento de soft-delete del usuario mientras existen registros de audit_log con ese `actor_id` activaría `ON DELETE RESTRICT`. Dado que `audit_log` es inmutable, esta situación crea un deadlock lógico: el usuario no puede ser eliminado (ni siquiera soft-deleted si la FK también restringe updates... pero soft-delete es UPDATE de `eliminado_en`, no DELETE de la fila, así que no aplica RESTRICT directamente).

Sin embargo, el caso de `actor_id` en `audit_log` es mejor sin FK para preservar registros históricos independientemente del estado del usuario.

**Resolución:** `audit_log.actor_id UUID NULL` sin FK a usuarios. El actor_id se registra como valor referencial, no como FK activa.

---

## 3. Índices

### 3.1 BLOCKER — Índice `(vehiculo_id, creado_en DESC)` no puede crearse sin columna `vehiculo_id`

Ver §2.2. Si no se resuelve la pregunta sobre la existencia de `vehiculo_id` en `transiciones_evento`, este índice no puede crearse y el SQL de Migration 001 fallará.

### 3.2 HIGH — Falta índice en `audit_log(entidad, entidad_id)`

El caso de uso más frecuente de `audit_log` no es "mostrar todo el log de un tenant" — es "mostrar el historial de cambios de este registro específico". Por ejemplo: "¿quién cambió el estado del evento E3A2B4C5?" o "¿quién modificó el usuario U9F8E7D6?".

Esta query pattern es: `WHERE org_id = $1 AND entidad = 'usuarios' AND entidad_id = $2`.

El índice `(org_id, created_at DESC)` no sirve para esta query. Requeriría un seq-scan de toda la partición filtrado por org_id y luego por entidad+entidad_id.

El índice necesario es: `(org_id, entidad, entidad_id, created_at DESC)` o al menos `(entidad, entidad_id)` en `audit_log`.

Sin este índice, la funcionalidad de "ver historial de cambios de un registro" — que es el caso de uso principal de audit_log para el admin del taller — tiene O(partition_size) cost.

**Resolución:** añadir índice `(org_id, entidad, entidad_id, created_at DESC)` en `audit_log` en §6.6 del spec.

### 3.3 MEDIUM — Índice en `usuarios.org_id` debe ser parcial

El spec §6.3 define un B-tree simple en `usuarios.org_id`. Pero la regla de `PHYSICAL_SCHEMA.md` §5 establece que todos los índices de negocio son índices parciales `WHERE eliminado_en IS NULL`.

Un `usuarios.org_id` sin `WHERE eliminado_en IS NULL` incluye a usuarios desactivados (soft-deleted) en el índice. Las queries operacionales siempre filtraran por `eliminado_en IS NULL`, lo que significa que el índice se usará menos eficientemente de lo que podría.

**Resolución:** cambiar el índice de `usuarios.org_id` a índice parcial `WHERE eliminado_en IS NULL`. El mismo principio aplica a los FK indexes de `sucursal_id` y `rol_id` en usuarios.

### 3.4 MEDIUM — Índice en `permisos_rol` necesita el único compuesto correcto

El spec §6.4 define:
- B-tree `org_id`
- B-tree `rol_id`
- Unique parcial `(org_id, rol_id, nombre_permiso)` WHERE `eliminado_en IS NULL`

El índice B-tree simple en `org_id` es correcto para el RLS hot path. El índice en `rol_id` solo es necesario si existen queries que buscan "todos los permisos de este rol a través de todos los tenants" — que no es un caso de uso válido en un sistema multi-tenant.

**Resolución:** eliminar el índice simple en `permisos_rol.rol_id`. El índice compuesto `(org_id, rol_id, nombre_permiso)` ya lo cubre.

### 3.5 MEDIUM — Falta de covering index para queries de dashboard de usuarios

El query pattern más común de administración es: "listar los usuarios activos de mi organización con nombre, email y rol". Esto requiere acceder a las columnas `nombre`, `email`, `rol_id` además del predicado `org_id + eliminado_en IS NULL`.

Con el índice parcial en `(org_id)`, PostgreSQL puede filtrar por org_id, pero luego debe hacer un heap fetch para obtener `nombre`, `email`, `rol_id`. Un covering index `(org_id, nombre, email) INCLUDE (rol_id)` WHERE `eliminado_en IS NULL` evitaría el heap access completamente para ese query pattern.

**Resolución:** evaluar añadir covering index en Migration 001 o diferirlo al sprint de UI cuando el query pattern esté confirmado.

### 3.6 LOW — El índice `(org_id, creado_en DESC)` en `transiciones_evento` tiene un problema de column order

El índice `(org_id, creado_en DESC)` sirve bien para: `WHERE org_id = $1 ORDER BY creado_en DESC`.

Pero este índice requiere que `creado_en` esté en el WHERE para que partition pruning funcione. Si la query solo especifica `WHERE org_id = $1` sin rango de fechas, PostgreSQL escaneará todas las particiones para ese tenant.

El índice `(vehiculo_id, creado_en DESC)` (si se decide añadir la columna) es el índice más selectivo para el hot path de Historia Técnica. El índice `(org_id, creado_en DESC)` sirve para reportes y auditoría.

No es un error — es una observación de que el segundo índice tiene utilidad limitada sin filtros de rango de fecha.

---

## 4. Particionamiento

### 4.1 Análisis técnico de RANGE por TIMESTAMPTZ

**Correcto:** PostgreSQL RANGE partitioning sobre columna TIMESTAMPTZ es el pattern estándar para tablas append-only de crecimiento temporal. Los boundaries deben ser literales TIMESTAMPTZ compatibles.

**Verificación de boundaries:** el spec usa formato `YYYY-MM-DD` para los boundaries (e.g., `[2026-04-01, 2026-07-01)`). PostgreSQL acepta este formato y lo interpreta como midnight UTC en TIMESTAMPTZ. Correcto para un sistema cuya zona horaria operacional es Chile Standard Time (UTC-4 / UTC-3 en verano). Sin embargo: si el servidor PostgreSQL (Supabase) usa UTC (que es el default), y la aplicación envía timestamps en horario local de Chile, los boundaries de partición son correctos en UTC. No hay problema.

### 4.2 HIGH — Autovacuum en tablas particionadas requiere configuración explícita

Las tablas particionadas heredan la configuración de autovacuum del parent, pero en PostgreSQL las particiones individuales son tablas independientes para efectos de autovacuum. Los parámetros default de autovacuum pueden ser inadecuados para particiones muy grandes (> 10M filas) o muy pequeñas (particiones históricas 2020-2025 que solo reciben datos durante migration).

**Recomendaciones específicas:**

Para particiones activas (trimestre actual):
- `autovacuum_vacuum_scale_factor = 0.01` (vacuum cuando el 1% de filas cambia, no el 20% default)
- `autovacuum_analyze_scale_factor = 0.005`
- Para `transiciones_evento` (append-only): `autovacuum_vacuum_insert_scale_factor = 0.05`

Para particiones históricas (2020-2025):
- `autovacuum_enabled = off` después de la migration de datos (son estáticas)

**Resolución:** añadir instrucciones de configuración de autovacuum en el checklist §11 del spec, específicamente para las particiones que reciben inserciones activas.

### 4.3 MEDIUM — Constraint exclusion y partition pruning en Supabase

PostgreSQL 12+ usa partition pruning automática basada en las constraints de la tabla particionada. Sin embargo, el planificador solo puede hacer pruning si el predicado WHERE usa la columna de partición (`creado_en` o `created_at`).

Las queries más frecuentes en `transiciones_evento` serán por `evento_id` o `vehiculo_id`, **no** por `creado_en`. Esto significa que la mayoría de las queries de dominio harán sequential scan de todas las particiones (en ese tenant). La partición solo ayuda a:
- Archivado (DROP PARTITION vs DELETE miles de filas)
- Queries de reporte temporal ("transiciones del último trimestre")
- VACUUM independiente por partición

El beneficio principal del particionamiento para `transiciones_evento` **no es performance de queries de dominio** — es mantenibilidad y archivado. Esto ya está documentado en `PHYSICAL_SCHEMA.md` §4, pero el spec no lo enfatiza suficientemente. El implementador podría esperar mejoras de performance que no se materializarán para los casos de uso más frecuentes.

**Resolución:** añadir nota en §5 del spec: "El beneficio principal del particionamiento de `transiciones_evento` y `audit_log` es mantenibilidad y archivado, no performance de queries de dominio. Las queries de dominio se resuelven por índices B-tree, no por partition pruning."

### 4.4 MEDIUM — Estrategia de archivado de particiones históricas no especificada

El spec crea particiones anuales desde 2020 para datos de TallerGP. Después de completar la migration, estas particiones:
- Contienen datos estáticos (no se insertan más filas)
- Son candidatas a archivado (mover a tablespace de menor costo, o comprimir via pg_compress si disponible)
- Deben excluirse de AUTOVACUUM después de stabilization

El spec no define qué ocurre con estas particiones a largo plazo. Sin una política de archivado documentada, las particiones históricas permanecerán indefinidamente en el sistema activo, consumiendo espacio de storage de Supabase Pro.

**Resolución:** añadir §5.6 "Política de archivado de particiones" que defina: (a) cuándo una partición pasa a ser "estática", (b) qué hacer con ella (TABLESPACE, DETACH, archivado externo), (c) cómo se marca para no ser recorrida en VACUUM activo.

### 4.5 LOW — El spec no menciona `pg_partition_info` y herramientas de monitoreo

Para verificar que las particiones están correctamente definidas y que el planificador las usa, se necesitan queries de diagnóstico:
- `SELECT * FROM pg_partitions WHERE tablename = 'transiciones_evento'`
- `EXPLAIN ANALYZE SELECT ... FROM transiciones_evento WHERE creado_en > '2026-06-01'` para verificar partition pruning

El checklist §11 verifica la existencia de particiones pero no verifica que el planificador las use. Añadir un test explícito de partition pruning en el checklist.

---

## 5. Concurrencia

### 5.1 HIGH — Hot pages en `transiciones_evento` durante carga masiva de migration

**Escenario:** al importar datos de TallerGP (5.449 OTs con múltiples transiciones cada una), todos los INSERTs a `transiciones_evento` para datos históricos van a las particiones 2020-2025. Bajo inserción masiva paralela, muchos workers intentan insertar en las mismas páginas al final de cada partición.

PostgreSQL maneja esto con buffer locks (no table locks), pero si la tasa de inserción es muy alta, puede crear contention en los buffer managers de las particiones más recientes dentro de cada año.

**Mitigación:** durante la migration de TallerGP, usar una sola conexión secuencial de inserción para datos históricos, no inserción paralela masiva. Documentar esto en el pipeline de migration.

### 5.2 HIGH — Riesgo de "último admin" en organizaciones

**Escenario:** un tenant tiene dos admins. Admin A soft-deletes a Admin B. Concurrentemente, Admin B soft-deletes a Admin A. Ambas operaciones leen el estado de `usuarios` antes de que la otra confirme, y ambas pasan la verificación "¿hay al menos otro admin activo?". El resultado: el tenant queda sin ningún admin activo.

Con un solo admin activo, si ese admin es desactivado accidentalmente, el tenant queda inaccesible para siempre (no puede haber otro admin que invite a un nuevo admin, y la desactivación no puede revertirse sin service_role).

**Mitigación requerida:** añadir un trigger o constraint CHECK que prevenga la desactivación del último admin de una organización. Podría ser un BEFORE UPDATE trigger en `usuarios` que verifique que `COUNT(*) FROM usuarios WHERE org_id = NEW.org_id AND rol_id = [admin_rol_id] AND eliminado_en IS NULL > 0` antes de permitir el soft-delete.

Este trigger no es parte de Migration 001 (pertenece al sprint de administración UC-A01), pero debe documentarse como requisito previo al sprint. Sin esta protección, la desactivación accidental del último admin es un data loss catastrophic para el tenant.

**Añadir a los riesgos del spec como R13 (HIGH).**

### 5.3 HIGH — Race condition en INSERT de `permisos_rol` para el mismo permiso

**Escenario:** dos admins del mismo tenant intentan crear el mismo permiso simultáneamente. Ambas transacciones leen el estado de `permisos_rol`, no ven el permiso, e intentan insertarlo. El constraint UNIQUE `(org_id, rol_id, nombre_permiso) WHERE eliminado_en IS NULL` previene el duplicado — pero la segunda transacción recibe un error 23505 (unique violation) que debe manejarse en la aplicación.

Este es el patrón estándar de "insert-or-ignore" en sistemas de permisos. El problema es que no está documentado en el spec. La aplicación debe manejar el 23505 gracefully (no como un error fatal).

**Impacto:** bajo, porque múltiples admins creando el mismo permiso simultáneamente es improbable en producción. Pero el constraint UNIQUE parcial `WHERE eliminado_en IS NULL` tiene una trampa: si un permiso fue soft-deleted y luego se intenta recrear, el constraint permite el INSERT (porque la fila deleted no cuenta en el partial index). El resultado son dos filas para el mismo permiso: una activa y una deleted. Las queries que lean `permisos_rol` deben siempre filtrar por `eliminado_en IS NULL`.

### 5.4 MEDIUM — Deadlock en actualización de roles + permisos

**Escenario:** Admin A actualiza `usuarios.rol_id` para Usuario X (lock en row de X). Concurrentemente, Admin B actualiza `permisos_rol` para el rol que tiene Usuario X (lock en permisos del rol). Si el trigger de auditoría `fn_audit_insert_trigger` en `usuarios` escribe en `audit_log`, y el trigger en `permisos_rol` también escribe en `audit_log`, ambas transacciones compiten por escribir en `audit_log` al mismo tiempo.

En PostgreSQL, los INSERTs en la misma tabla desde múltiples transacciones concurrentes no generan deadlocks (las filas son distintas). Sin embargo, si existe cualquier lock adicional (advisory lock, lock en secuencias de índice, etc.), puede haber contention.

**Mitigación:** garantizar que `fn_audit_insert()` no adquiere locks adicionales en sus operaciones internas. El uso de `pg_advisory_lock` dentro de fn_audit_insert() estaría prohibido.

### 5.5 MEDIUM — Session variable `app.canal` y `app.current_ip` en Supabase connection pool

**Descripción crítica:** el spec §7.2 define que `fn_audit_insert()` recibe `p_ip_origen INET` y `p_canal TEXT` como parámetros. El trigger que llama a esta función necesita obtener estos valores de algún lugar. La única forma en PostgreSQL de pasar información específica de la request desde la aplicación hasta el trigger es via variables de sesión: `SET app.current_ip = '1.2.3.4'` y `SET app.canal = 'web_erp'`.

**Problema con Supabase pgBouncer:** Supabase usa pgBouncer en transaction mode por defecto. En transaction mode, las variables de sesión (`SET`) **se resetean entre transacciones**. Esto significa que si la aplicación hace `SET app.current_ip = '...'` al inicio de una request y luego realiza una transacción, las variables pueden no estar disponibles cuando el trigger se ejecuta.

**Más específicamente:** en transaction mode, `SET LOCAL` (que expira al fin de la transacción) sería incorrecto. `SET` (que persiste en la sesión) no funciona en transaction mode porque la "sesión" pgBouncer no persiste.

**La solución correcta en Supabase:** usar `SET LOCAL` dentro de la transacción explícita (`BEGIN; SET LOCAL app.current_ip = '...'; ... INSERT ...; COMMIT;`). O usar `SET` en una conexión dedicada (fuera de pgBouncer). O pasar estos valores como parámetros directamente a la función en lugar de usar variables de sesión (pero el trigger no puede recibir parámetros adicionales fácilmente).

**Resolución requerida:** el spec debe documentar explícitamente el mecanismo para pasar `ip_origen` y `canal` al trigger bajo Supabase pgBouncer en transaction mode. Las opciones son:

- (A) El trigger obtiene ip_origen via `NULLIF(current_setting('app.current_ip', true), '')::INET` con `missing_ok=true` → devuelve NULL si no está seteado. Documentar que NULL es aceptable para ip_origen en contextos sin IP disponible.
- (B) Usar `canal` con un DEFAULT de 'sistema' cuando no está seteado.
- (C) Mover ip_origen y canal fuera de la firma de fn_audit_insert() y hacerlos opcionales/nullable.

Esta es una decisión de diseño que afecta la utilidad del audit log. Si ip_origen siempre es NULL porque Supabase pgBouncer resetea las variables, el audit log pierde un campo de valor para compliance.

---

## 6. RLS

### 6.1 Análisis de cada policy

**`organizaciones` — SELECT:** `id = mi_org_id()`. Correcto. El tenant ve solo su fila.

**`organizaciones` — INSERT:** solo service_role. Correcto. Ver §9.2 del spec.

**`organizaciones` — UPDATE:** `id = mi_org_id() AND mi_rol() = 'admin'`. Correcto.

**`organizaciones` — DELETE:** bloqueado (no policy). Correcto.

**`sucursales` — SELECT:** `org_id = mi_org_id() AND eliminado_en IS NULL`. **WARN:** si `eliminado_en IS NULL` está en la policy y no en el índice, PostgreSQL puede no usar el partial index para esta query. El partial index `WHERE eliminado_en IS NULL` en `sucursales.org_id` permitiría que el planificador lo use para esta query. Verificar que el índice parcial y la policy usan la misma condición.

**`usuarios` — UPDATE:** `org_id = mi_org_id() AND (mi_rol() = 'admin' OR id = auth.uid())`. **WARN:** esta policy permite que un usuario edite su propia fila. ¿Puede un usuario cambiar su propio `rol_id` o `org_id`? Si la policy no restringe qué campos pueden actualizarse, un usuario con acceso UPDATE a su propia fila podría cambiar su `rol_id` a admin. La restricción de qué campos pueden actualizarse debe estar en la aplicación (serializer) o en un trigger que rechace cambios a campos protegidos.

**`transiciones_evento` — INSERT:** `mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')`. **Observación:** esta policy no incluye `org_id = mi_org_id()`. Esto significa que un usuario podría potencialmente insertar una transición con el `org_id` de otro tenant si construye el INSERT manualmente. Añadir `org_id = mi_org_id()` a la condición de INSERT.

**`audit_log` — No INSERT policy directa:** correcto. Solo fn_audit_insert() via trigger.

### 6.2 HIGH — `usuarios` UPDATE policy permite escalada de privilegios

Ver análisis en §6.1. La policy `id = auth.uid()` permite que un usuario actualice su propia fila. Sin una restricción a nivel de columnas (que RLS no puede hacer — RLS es row-level), un usuario podría hacer `UPDATE usuarios SET rol_id = (SELECT id FROM roles WHERE nombre = 'admin') WHERE id = auth.uid()`. La policy lo permite porque el usuario tiene derecho a actualizar su propia fila.

**Resolución:**
- (A) La aplicación nunca expone el campo `rol_id` en el formulario de edición de perfil propio.
- (B) Un trigger BEFORE UPDATE en `usuarios` verifica que `NEW.rol_id = OLD.rol_id` cuando `auth.uid() = id` (es decir, el usuario no puede cambiar su propio rol).
- (C) La policy de UPDATE por propio usuario solo aplica a campos de perfil no-sensibles: `UPDATE usando (id = auth.uid()) WITH CHECK (rol_id = OLD.rol_id AND org_id = OLD.org_id AND sucursal_id = OLD.sucursal_id)`.

La opción (C) es la más segura y la que PostgreSQL soporta via la cláusula `WITH CHECK` en policies. Debe añadirse al spec.

### 6.3 HIGH — `transiciones_evento` INSERT policy incompleta (sin org_id check)

Ver §6.1. La policy INSERT no verifica `org_id = mi_org_id()`. Un usuario autenticado podría insertar una transición con cualquier `org_id` si construye la query directamente en Supabase JS SDK.

**Resolución:** cambiar la policy INSERT a: `org_id = mi_org_id() AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')`.

### 6.4 MEDIUM — Policy SELECT en `tipos_evento_base` usa "todos los autenticados"

La policy SELECT en `tipos_evento_base` permite SELECT a cualquier usuario autenticado. Esto incluye `cliente_portal`. ¿Un cliente del portal debe poder leer el catálogo completo de tipos de evento?

Probablemente sí (necesita saber el tipo de evento para mostrar "Diagnóstico", "Reparación", etc. en su portal). Pero es una decisión deliberada que debe estar documentada.

**Observación adicional:** `tipos_evento_base` no tiene `org_id`. Si se añade Row Level Security con `TRUE` para SELECT, es correcto. Pero si se añade con `org_id = mi_org_id()`, fallará porque la tabla no tiene `org_id`. El spec dice "Verdadero para todos los usuarios autenticados" — esto es correcto.

### 6.5 MEDIUM — `mi_rol()` con valor incorrecto en JWT no genera error visible

Si el JWT contiene `app_metadata.role = 'super_jefe'` (un typo o un valor inválido), `mi_rol()` retorna `'super_jefe'`. Ninguna policy de INSERT o UPDATE incluirá `'super_jefe'` en su lista de roles permitidos, por lo que todas las mutaciones serán silenciosamente bloqueadas (0 rows affected, no error). El usuario creerá que el sistema no funciona.

No hay validación de que `mi_rol()` retorne uno de los 5 roles válidos del sistema. Un Auth hook mal configurado puede escribir un rol no reconocido.

**Resolución:** añadir un CHECK en el Auth hook (Edge Function) que valide que el rol a escribir es uno de los 5 válidos. Documentar en el checklist §11 del spec.

### 6.6 LOW — Ausencia de policy en tablas particionadas: comportamiento heredado

Cuando se define una policy RLS en la tabla padre de una partición, las particiones hijas heredan la policy. Esto es correcto en PostgreSQL 12+. Sin embargo, si se intenta definir una policy directamente en una partición (no en la tabla padre), y la tabla padre ya tiene policies, las policies se duplican. El spec no advierte sobre esto.

**Resolución:** añadir nota en §8.2 del spec: "Las policies RLS se definen SOLO sobre la tabla padre (`transiciones_evento`, `audit_log`). Definir policies en particiones individuales causa duplicación. PostgreSQL hereda las policies del padre automáticamente."

---

## 7. Triggers

### 7.1 BLOCKER — Contrato de sesión no documentado para fn_audit_insert_trigger

**Descripción:** el trigger `fn_audit_insert_trigger` llama a `fn_audit_insert()` con parámetros que incluyen `p_ip_origen INET` y `p_canal TEXT`. Estos valores no están disponibles directamente en el contexto del trigger (que tiene acceso a `NEW`, `OLD`, `auth.uid()`, `mi_rol()`, `mi_org_id()`, pero no a la IP del cliente ni al canal de la aplicación).

La única forma de hacer estos valores disponibles es via variables de sesión PostgreSQL: `current_setting('app.current_ip', true)` y `current_setting('app.canal', true)`.

**El contrato de sesión no está documentado en ningún lugar del spec.** La aplicación (Supabase Edge Functions, Route Handlers) debe ejecutar `SET LOCAL app.current_ip = '...'` y `SET LOCAL app.canal = '...'` dentro de la misma transacción antes de cualquier mutación que dispare el trigger.

Sin este contrato documentado y respetado:
- `p_ip_origen` será NULL en todos los registros de audit_log (el `current_setting` con `missing_ok=true` devuelve '')
- `p_canal` será NULL o vacío en todos los registros

Esto no rompe el sistema — fn_audit_insert() puede aceptar NULLs. Pero vacía de valor dos campos del audit_log que son importantes para compliance y detección de intrusiones.

**Resolución requerida antes de SQL:**
1. Decidir si `p_ip_origen` y `p_canal` son obligatorios o opcionales en fn_audit_insert().
2. Si son opcionales (NULL permitido): documentar que se obtienen via `current_setting('app.current_ip', true)` dentro de la función, no como parámetros. Actualizar la firma de fn_audit_insert().
3. Si son obligatorios: documentar el contrato de sesión en un nuevo §9.3 del spec, y añadir al checklist §11 una prueba de que las variables de sesión están disponibles en el contexto del trigger.
4. Resolver la compatibilidad con Supabase pgBouncer (ver §5.5 de este documento).

### 7.2 HIGH — Orden de ejecución de triggers con múltiples BEFORE y AFTER

**En `usuarios` (BEFORE UPDATE):**
- `trg_usuarios_set_updated_at` (BEFORE UPDATE) — ejecuta fn_set_updated_at()

**En `usuarios` (AFTER INSERT/UPDATE/DELETE):**
- `trg_usuarios_audit` — llama a fn_audit_insert()

PostgreSQL ejecuta BEFORE triggers en orden alfabético de nombre (o de `CREATE TRIGGER` si los nombres son iguales). AFTER triggers igualmente.

Con un solo BEFORE y un solo AFTER, no hay problema de orden. Pero **cuando se añadan triggers adicionales en sprints futuros** (por ejemplo, un trigger de validación de "último admin" mencionado en §5.2 de este documento), el orden de ejecución puede importar.

**Convención requerida:** establecer una convención de naming para garantizar el orden de ejecución via nombre:
- `trg_01_usuarios_validar_ultimo_admin` (se ejecuta primero en BEFORE)
- `trg_50_usuarios_set_updated_at` (se ejecuta segundo en BEFORE)
- `trg_99_usuarios_audit` (AFTER)

Sin esta convención, los triggers se nombran sin orden implícito y el orden de ejecución puede cambiar si se añade un trigger cuyo nombre alfabéticamente queda entre dos existentes.

### 7.3 HIGH — Trigger de auditoría sobre `roles` y `tipos_evento_base` (catálogos globales)

El spec §7.2 lista los triggers de auditoría solo en tablas per-tenant: `organizaciones`, `sucursales`, `usuarios`, `permisos_rol`.

¿Deben auditarse las modificaciones a `roles` y `tipos_evento_base` (catálogos globales)? Modificar un catálogo global afecta a todos los tenants simultáneamente — es una de las operaciones más críticas del sistema. Sin embargo, solo el `postgres` role (via migration) puede modificar estos catálogos.

**Caso de uso real:** un desarrollador ejecuta una migration que añade un nuevo tipo de evento base. ¿Debería quedar en audit_log? Sin auditoría de catálogos globales, cambios críticos al catálogo pueden ocurrir sin rastro.

**Resolución:** decidir explícitamente si `roles` y `tipos_evento_base` tienen trigger de auditoría. Si sí, el trigger debe manejar el caso `org_id = NULL` (catálogos globales no tienen org_id). Si no, documentar como decisión explícita.

### 7.4 MEDIUM — fn_set_updated_at llamado en tablas particionadas (no aplica a transiciones_evento ni audit_log)

El spec §7.1 lista correctamente solo `organizaciones`, `sucursales`, `usuarios`, `permisos_rol` como tablas con trigger fn_set_updated_at. `transiciones_evento` y `audit_log` son append-only y no tienen `actualizado_en`. Correcto.

Sin embargo, el spec no dice explícitamente que fn_set_updated_at **no** debe añadirse a las tablas particionadas. Un implementador podría añadirlo por error. Añadir esta nota al spec.

### 7.5 LOW — fn_audit_insert_trigger sobre tablas particionadas: herencia en todas las particiones

PostgreSQL hereda los triggers definidos en la tabla padre a todas las particiones hijas. Esto significa que el trigger de auditoría sobre `organizaciones` (si se decide que es necesario) no necesita ser redefinido en particiones.

Para `transiciones_evento` y `audit_log` **no hay trigger de auditoría** (correcto — ver §7.3 del spec). Pero si alguien añade un trigger por error a la tabla padre, este se propagará a todas las 17+ particiones. Documentar este riesgo.

---

## 8. Ejecución de Migration

### 8.1 BLOCKER — `CREATE EXTENSION` no es transaccional

**Descripción:** las sentencias `CREATE EXTENSION` en PostgreSQL **no pueden ser revertidas dentro de una transacción**. Si un `ROLLBACK` ocurre después de `CREATE EXTENSION vector`, la extensión queda instalada aunque el rollback haya ocurrido. Más importante: si la migration falla después de instalar las extensiones y antes de crear las tablas, y se intenta re-ejecutar la migration, los `CREATE EXTENSION` fallarán con "extension already exists".

**Impacto:** si la migration se ejecuta con la convención `BEGIN ... CREATE EXTENSION ... CREATE TABLE ... COMMIT`, una falla en la fase de tablas dejará las extensiones instaladas y hará que la re-ejecución falle en `CREATE EXTENSION`.

**Solución obligatoria:** usar `CREATE EXTENSION IF NOT EXISTS` para todas las extensiones. Esta es la práctica estándar en PostgreSQL. La sentencia `IF NOT EXISTS` hace que la operación sea idempotente: si la extensión ya existe, no hace nada (no falla). Esto permite que la migration pueda re-ejecutarse después de un fallo parcial.

El spec no menciona `IF NOT EXISTS` en ningún lugar de la sección de extensiones.

**Impacto adicional:** `CREATE INDEX CONCURRENTLY` tampoco puede ejecutarse dentro de una transacción. Si los índices de Migration 001 son todos creados dentro de BEGIN/COMMIT, deben ser `CREATE INDEX` (no CONCURRENTLY). Esto puede causar lock temporales en las tablas nuevas. Para tablas recién creadas (sin datos), esto no es un problema. Sin embargo, para los índices de tablas particionadas (que afectan al parent y a todas las particiones), la creación puede ser más lenta. El spec debe especificar que Migration 001 no usa `CREATE INDEX CONCURRENTLY` (no es necesario en tablas vacías).

### 8.2 HIGH — Reversibilidad de Migration 001

**¿Es reversible Migration 001?** 

Migration 001 crea extensiones, funciones, tablas, índices, triggers, RLS y seeds. En términos de Supabase migrations, un "rollback" sería ejecutar el archivo `undo` de la migration.

**Elementos no reversibles o difíciles de revertir:**
- `CREATE EXTENSION vector` — `DROP EXTENSION vector` puede fallar si hay tipos dependientes. La reversión requiere `DROP EXTENSION vector CASCADE`.
- `CREATE EXTENSION pgcrypto` — mismo riesgo.
- Las particiones de `transiciones_evento` y `audit_log` con datos — si hay datos insertados, no se pueden DROP sin perderlos.
- Seeds en `roles` y `tipos_evento_base` con datos dependientes en otras tablas (si existen en fases futuras).

**Mitigación:** para Migration 001 en estado inicial (sin datos de producción), la reversión es completa: DROP TABLE CASCADE elimina las tablas y sus datos, DROP EXTENSION elimina las extensiones. Pero el spec no documenta el procedimiento de rollback.

**Resolución:** añadir §8 "Procedimiento de rollback" al spec con:
- Orden de DROP inverso al de creación
- `DROP EXTENSION IF EXISTS ... CASCADE` para todas las extensiones
- Confirmación de que el rollback es safe si no hay datos de producción

### 8.3 MEDIUM — Separación de los elementos no-transaccionales en un paso previo

La práctica recomendada en Supabase es separar `CREATE EXTENSION` en un paso ejecutado antes del archivo de migration (via Supabase Dashboard → Extensions, o en un script de setup inicial), no dentro del archivo `.sql` de la migration. Esto evita el problema de no-transaccionalidad.

**Resolución:** especificar en el spec que las extensiones deben estar instaladas antes de ejecutar el archivo de migration principal. El archivo de migration debe comenzar con `CREATE EXTENSION IF NOT EXISTS` (para idempotencia), pero el proceso de setup documentado debe instalarlas antes.

---

## 9. Supabase

### 9.1 Compatibilidad de Auth

**`auth.jwt()` return type:** en Supabase, `auth.jwt()` retorna un `jsonb` con la estructura completa del JWT claims. La función `mi_org_id()` extrae `app_metadata.org_id` vía:
```
(auth.jwt() ->> 'app_metadata')::jsonb ->> 'org_id'
```
Este es el patrón correcto. Verificado.

**Límite de tamaño del JWT:** `app_metadata` puede crecer si se añaden más claims. JWT tokens de Supabase tienen un límite práctico de ~8KB. El spec añade `org_id`, `role`, `sucursal_id` — tres campos UUID + string. Total: ~150 bytes. Muy lejos del límite.

**Edge Functions y service_role:** el spec §9.2 especifica que el onboarding usa Edge Functions con service_role. Las Edge Functions de Supabase tienen acceso al `SUPABASE_SERVICE_ROLE_KEY` via variable de entorno. Correcto.

**TTL de JWT:** el spec menciona 1h access / 7d refresh / 30d mechanic app. En Supabase, el TTL se configura en Authentication Settings. Verificar que la configuración de Supabase del proyecto coincide con estos valores antes del lanzamiento.

### 9.2 HIGH — Supabase Realtime y tablas particionadas

**Problema crítico:** Supabase Realtime usa el mecanismo de Logical Replication de PostgreSQL. Las **tablas particionadas requieren configuración específica** para Logical Replication en PostgreSQL.

En PostgreSQL 13+, las tablas particionadas se pueden replicar, pero cada partición se trata como una tabla independiente. Supabase Realtime, que escucha cambios vía `pg_notify` y Logical Replication, puede no propagar correctamente los cambios en tablas particionadas a los clientes suscritos.

**Impacto en Migration 001:** si algún componente de la aplicación suscribe a cambios en `transiciones_evento` vía Supabase Realtime (`supabase.from('transiciones_evento').on('INSERT', ...)`), estos eventos pueden no llegar.

**Verificación requerida:** probar explícitamente en staging que Supabase Realtime propaga INSERTs en `transiciones_evento` (tabla particionada) a los suscriptores. Si no funciona, la aplicación debe usar un mecanismo alternativo (polling, webhooks, o Realtime en la tabla `eventos` que no está particionada).

**Para `audit_log`:** deshabilitar Realtime explícitamente. El audit log no debe ser observable vía Realtime (privacidad, ruido).

### 9.3 HIGH — pgBouncer y variables de sesión

Duplicado de §5.5. Crítico para el funcionamiento del audit trigger. Ver §5.5 para la descripción completa.

### 9.4 HIGH — pgvector HNSW disponibilidad en Supabase

`pgvector` con soporte HNSW (índice jerárquico de grafo de mundos pequeños) requiere la versión 0.5.0+. Supabase Pro instaló pgvector HNSW en sus instancias desde agosto 2023. Sin embargo, si el proyecto usa una instancia de Supabase creada antes de esa fecha o una región donde la extensión no está actualizada, `CREATE EXTENSION vector` instalará una versión sin HNSW.

**Verificación requerida:** después de `CREATE EXTENSION vector`, ejecutar `SELECT extversion FROM pg_extension WHERE extname = 'vector'` y verificar que es >= 0.5.0. Añadir esta verificación al checklist §11 del spec.

### 9.5 MEDIUM — Supabase Storage y el modelo de evidencias

El spec no cubre el schema de tablas de Migration 001 relacionadas con Storage (porque Storage pertenece a migrations posteriores). Sin embargo, la configuración de Supabase Storage (buckets, policies de acceso) debe estar coordinada con Migration 001 si la auditoría registra operaciones de Storage.

**Observación:** las policies de Storage en Supabase son independientes de las RLS policies de la base de datos. Un usuario que puede ver `evidencias` via RLS no necesariamente puede acceder al archivo en Storage si las Storage policies no lo permiten. Esta coordinación debe documentarse.

### 9.6 LOW — Supabase Dashboard y acceso a `audit_log`

`audit_log` está protegida por RLS que solo permite SELECT a admin y jefe_taller. Pero el Supabase Dashboard (que usa service_role) puede leer `audit_log` directamente. Esto es correcto para debugging y soporte, pero debe documentarse como una excepción intencional: service_role bypasea RLS, por lo que Supabase Dashboard siempre ve todo.

---

## 10. Escalabilidad

### 10.1 Escenario A: 100 talleres activos

**Volúmenes estimados (12 meses de operación):**
- `organizaciones`: 100 filas
- `usuarios`: ~500 filas (5 promedio por taller)
- `tipos_evento_base`: 31 filas (constante)
- `transiciones_evento`: ~720K filas/año (100 talleres × 200 OTs/mes × 12 meses × ~30 transiciones promedio)
- `audit_log`: ~200K filas/año

**Performance:** trivial para todos los patrones de query. Ningún índice alcanza un tamaño problemático. Los B-tree son óptimos. UUID v4 degradación está a años de distancia.

**Supabase plan:** Free o Starter plan. Posible con pgBouncer en session mode (no transaction mode), lo que resolvería el problema de variables de sesión §5.5.

### 10.2 Escenario B: 1.000 talleres activos

**Volúmenes estimados (24 meses de operación):**
- `organizaciones`: 1.000 filas
- `usuarios`: ~5.000 filas
- `transiciones_evento`: ~14.4M filas acumuladas (1K × 200 × 24 × 30)
  - Distribución: ~1.2M filas/mes — 3.6M filas/trimestre
  - Con particionamiento trimestral: partición activa tiene ~3.6M filas
  - UUID v4 en PK de las particiones: comienza a mostrar degradación leve (~3-5% overhead)
- `audit_log`: ~2.4M filas acumuladas

**Performance:** aceptable. Los índices B-tree en `(vehiculo_id, creado_en DESC)` y `(org_id, creado_en DESC)` mantienen queries sub-50ms para la mayoría de los casos de uso.

**Hotspot potencial:** el RLS scan en queries sin índice que usen `mi_org_id()` con `STABLE` optimization. PostgreSQL llama a `mi_org_id()` una vez por query (no por fila). Verificar que el planificador hace inline del resultado y no re-evalúa en cada row.

**Supabase plan:** Pro plan recomendado (8GB RAM, 200MB/s I/O).

### 10.3 Escenario C: 10.000 talleres activos

**Volúmenes estimados (36 meses de operación):**
- `transiciones_evento`: ~1.08B filas acumuladas (10K × 200 × 36 × 30)
  - Partición trimestral activa: ~36M filas
  - UUID v4 degradación: **significativa** — B-tree de PK necesita frecuentes page splits. UUID v7 debe estar implementado antes de este punto (acción requerida al llegar a 5M filas por tabla según spec).
- `audit_log`: ~360M filas acumuladas
- `usuarios`: ~50K filas (trivial)

**Problemas de performance a 10K talleres:**

1. **UUID v4 B-tree degradation:** el spec lo reconoce con umbral de 5M filas para planificar la migración a UUIDv7. A 10K talleres, se alcanza 5M filas por partición en el primer trimestre operacional. La migración a UUIDv7 no es opcional a este escala.

2. **Supabase Realtime a 10K conexiones simultáneas:** si 10K talleres tienen usuarios activos simultáneamente, Supabase Realtime puede necesitar hasta 10K × (número de canales por taller) conexiones WebSocket. El plan Enterprise de Supabase soporta esto, pero el plan Pro tiene límites de ~500 conexiones simultáneas.

3. **Función `mi_org_id()` y JIT compilation:** a 10K talleres con queries concurrentes, PostgreSQL puede activar JIT compilation para queries complejas. Las funciones SECURITY DEFINER interactúan de manera specific con JIT. Verificar que `mi_org_id()` no desactiva JIT optimization en el planificador.

4. **pg_notify límite de payload:** Supabase Realtime usa `pg_notify` internamente. El límite de payload de `pg_notify` es 8KB. Para `transiciones_evento` con un diff JSONB grande, esto podría truncarse. Verificar que el payload de los cambios Realtime no supera este límite.

### 10.4 Escenario D: 50 millones de eventos, 100 millones de auditorías

**Suponiendo 50M eventos en `eventos` y 4 transiciones promedio por evento:**
- `transiciones_evento`: 200M filas
- `audit_log`: 100M filas

**Crítico:** a este volumen, ningún plan de Supabase standard es suficiente. Se requiere Supabase Enterprise con instancias dedicadas, PostgreSQL read replicas para queries de lectura (Historia Técnica, reportes), y separación de escrituras (primary) de lecturas (replicas).

**Arquitectura requerida (no cubierta en Migration 001 pero que debe considerarse desde el día 1 de diseño):**
- Read replica para queries de `transiciones_evento` y `audit_log`
- Connection pooling agresivo (PgCat o pgBouncer con múltiples pools por tenant)
- Archivado de particiones antiguas a tablespace de cold storage
- `pg_partman` para gestión automática de particiones

### 10.5 HIGH — Supabase Auth API rate limits

Las funciones `mi_org_id()` y `mi_rol()` leen del JWT claims, no de la base de datos. Esto es correcto y O(1). Sin embargo, el endpoint de refresh token de Supabase Auth tiene rate limits. A 10K talleres con sesiones de 1 hora, hay un pico de ~10K refresh requests por hora (distribuidos). Supabase Pro soporta esto, pero debe monitorearse.

---

## 11. Registro de Riesgos

### Blockers

| ID | Riesgo | Sección | Resolución requerida |
|---|---|---|---|
| BLK-1 | `vehiculo_id` no existe como columna en `transiciones_evento` pero el spec requiere índice sobre ella | §2.2, §3.1 | Decidir opción A (columna denormalizada) u opción B (sin columna, sin índice). Actualizar spec, DATABASE_MODEL.md y PHYSICAL_SCHEMA.md. |
| BLK-2 | Contrato de sesión para `fn_audit_insert_trigger` (variables `app.current_ip`, `app.canal`) no documentado ni compatible con Supabase pgBouncer transaction mode | §7.1, §5.5 | Definir contrato de sesión. Decidir nullability de ip_origen y canal. Actualizar firma de fn_audit_insert(). Verificar comportamiento con pgBouncer. |
| BLK-3 | `CREATE EXTENSION` no es transaccional — migration no es idempotente sin `IF NOT EXISTS` | §8.1 | Todos los `CREATE EXTENSION` deben usar `IF NOT EXISTS`. Actualizar spec §3. |

### HIGH

| ID | Riesgo | Sección |
|---|---|---|
| H-1 | FKs de `eliminado_por`, `creado_por` en sucursales/organizaciones/usuarios no están en el spec | §2.3 |
| H-2 | `audit_log.org_id` nullability y FK no definidas — conflict con seeds de catálogos globales | §2.4 |
| H-3 | `audit_log.actor_id` con FK a usuarios puede bloquear soft-delete | §2.5 |
| H-4 | Falta índice en `audit_log(org_id, entidad, entidad_id, created_at DESC)` — hot query path de historial de cambios inservible sin él | §3.2 |
| H-5 | Seeds deben ejecutarse ANTES de activar triggers de auditoría (orden Paso 9 y Paso 12 a revisar) | §1.3 |
| H-6 | Race condition "último admin" — tenant puede quedar inaccesible | §5.2 |
| H-7 | Race condition INSERT de `transiciones_evento` sin `org_id` en la policy — posible cross-tenant write | §6.3 |
| H-8 | Policy UPDATE en `usuarios` permite escalada de privilegios vía edición de propio `rol_id` | §6.2 |
| H-9 | Supabase Realtime puede no propagar cambios en tablas particionadas | §9.2 |
| H-10 | pgvector HNSW disponibilidad no verificada — version mínima no especificada en checklist | §9.4 |
| H-11 | UUID v4 degradación en `transiciones_evento` a 10K talleres dentro de primer trimestre | §10.3 |
| H-12 | Autovacuum no configurado para particiones de alta inserción | §4.2 |

### MEDIUM

| ID | Riesgo | Sección |
|---|---|---|
| M-1 | `sucursales` SELECT policy con `eliminado_en IS NULL` puede no usar partial index | §6.1 |
| M-2 | `índices en usuarios.sucursal_id, rol_id` deben ser parciales (WITH eliminado_en IS NULL) | §3.3 |
| M-3 | Índice redundante en `permisos_rol.rol_id` — cubierto por el unique compuesto | §3.4 |
| M-4 | `transiciones_evento` partitioning no mejora queries de dominio — solo archivado (debe documentarse) | §4.3 |
| M-5 | Política de archivado de particiones históricas 2020-2025 no definida | §4.4 |
| M-6 | Deadlock potencial en actualización concurrent de roles + permisos con fn_audit_insert | §5.4 |
| M-7 | Session variable `app.canal` no seteada = canal siempre NULL en audit_log | §5.5 |
| M-8 | `mi_rol()` con valor no válido en JWT falla silenciosamente (0 rows, no error) | §6.5 |
| M-9 | Migration debe separar extensiones de DDL (transaccionalidad) | §8.3 |
| M-10 | Supabase Storage policies independientes de RLS — coordinación no documentada | §9.5 |
| M-11 | Convención de naming de triggers para garantizar orden de ejecución | §7.2 |
| M-12 | Auditoría de catálogos globales (`roles`, `tipos_evento_base`) no definida | §7.3 |

### LOW

| ID | Riesgo | Sección |
|---|---|---|
| L-1 | `transiciones_evento` y `audit_log` parent table pueden tener triggers añadidos accidentalmente | §7.5 |
| L-2 | Ausencia de test explícito de partition pruning en checklist | §4.5 |
| L-3 | Supabase Dashboard (service_role) puede leer audit_log — debe documentarse como excepción | §9.6 |
| L-4 | Covering index para dashboard de usuarios no definido (diferible a sprint UI) | §3.5 |

---

## 12. Checklist de Aprobación Pre-SQL

Ningún SQL puede escribirse hasta que todos los ítems de la sección A (Blockers) estén completados. Los ítems de la sección B (Condiciones) deben completarse antes del merge a main.

### Sección A — Blockers (Pre-SQL obligatorio)

- [ ] **BLK-1 resuelto:** `vehiculo_id` en `transiciones_evento` — decisión documentada (opción A o B), DATABASE_MODEL.md y PHYSICAL_SCHEMA.md actualizados, spec §6.5 actualizado
- [ ] **BLK-2 resuelto:** contrato de sesión de fn_audit_insert documentado; compatibilidad con pgBouncer verificada; firma de fn_audit_insert() actualizada en spec §7.2 y §8.1; behavior de NULL en ip_origen y canal documentado
- [ ] **BLK-3 resuelto:** spec §3 actualizado con `CREATE EXTENSION IF NOT EXISTS` para todas las extensiones
- [ ] **H-7 resuelto:** policy INSERT de `transiciones_evento` actualizada con `AND org_id = mi_org_id()`
- [ ] **H-8 resuelto:** policy UPDATE de `usuarios` incluye `WITH CHECK (rol_id = OLD.rol_id AND org_id = OLD.org_id)` para prevenir escalada de privilegios
- [ ] **H-5 resuelto:** orden de triggers y seeds revisado — triggers de auditoría se crean DESPUÉS de los seeds, o seeds se ejecutan sin triggers activos
- [ ] **Verificación de columnas de `transiciones_evento`:** lista completa de columnas documentada en DATABASE_MODEL.md §4.2 o referenciada desde MIGRATION_001_SPEC.md §5
- [ ] **Verificación de columnas de `audit_log`:** nullability de `org_id` y `actor_id` documentadas; FK o no-FK para cada una documentada
- [ ] **H-1 resuelto:** spec §2 Paso 6 incluye todos los ALTER TABLE: `sucursales.eliminado_por`, `organizaciones.eliminado_por`, `usuarios.creado_por`, `usuarios.eliminado_por`, `permisos_rol.creado_por`
- [ ] **H-4 resuelto:** índice `(org_id, entidad, entidad_id, created_at DESC)` añadido a spec §6.6

### Sección B — Condiciones (Pre-merge a main)

- [ ] **H-2 resuelto:** `audit_log.org_id` nullable documentado, índice parcial `WHERE org_id IS NOT NULL` definido
- [ ] **H-3 resuelto:** `audit_log.actor_id` sin FK a usuarios, documentado como intencional
- [ ] **H-12 resuelto:** spec §5.3 incluye instrucciones de configuración de autovacuum para particiones activas e históricas
- [ ] **H-9 verificado:** test en staging de Supabase Realtime con tabla particionada — resultado documentado
- [ ] **H-10 resuelto:** checklist §11 del spec incluye verificación de versión de pgvector >= 0.5.0
- [ ] **M-2 resuelto:** índices parciales en usuarios.sucursal_id, usuarios.rol_id añadidos
- [ ] **M-3 resuelto:** índice redundante en permisos_rol.rol_id eliminado del spec
- [ ] **M-6 documentado:** garantía de que fn_audit_insert() no adquiere advisory locks añadida al spec §7.2
- [ ] **M-9 resuelto:** instrucción de setup de extensiones separada del archivo de migration principal
- [ ] **M-11 resuelto:** convención de naming de triggers con prefijo numérico para orden de ejecución documentada en spec §7
- [ ] **M-12 resuelto:** decisión sobre auditoría de catálogos globales documentada en spec §7.3
- [ ] **Nota Realtime en audit_log:** spec §9 o checklist §11 incluye instrucción de deshabilitar Realtime en audit_log
- [ ] **Nota de rollback:** spec incluye procedimiento de rollback de Migration 001

### Sección C — Validaciones Pre-Go-Live (no bloquean escribir SQL, pero bloquean producción)

- [ ] **R6 del spec:** job automático de creación de particiones implementado y testeado
- [ ] **R9 del spec:** módulo de revocación de JWT en desactivación de usuario implementado (UC-A01)
- [ ] **R13 nuevo:** trigger de protección de "último admin" implementado antes del sprint UC-A01
- [ ] **H-11:** plan de migración a UUIDv7 documentado con threshold de monitoreo (alerta a 4M filas, acción antes de 5M)
- [ ] Test de aislamiento cross-tenant automatizado en CI
- [ ] Test de PII en audit_log verificado (RUT en cambios JSONB es hash SHA-256)
- [ ] Versión de pgvector verificada en la instancia de Supabase del proyecto

---

## Veredicto DBA v1.0

**BLOCKED — 3 blockers originales (ver §13 para decisiones del Architecture Board)**

---

## 13. Architecture Board — Veredictos y Decisiones (v1.1)

**Fecha:** Junio 2026  
**Especialistas:** PostgreSQL Guardian · Performance Guardian · Security Guardian · Scalability Guardian · Supabase Guardian · Reviewer · Lead Architect

### 13.1 Tabla de veredictos por especialista

| Especialista | Veredicto | Nuevos Blockers | Nuevos HIGH |
|---|---|---|---|
| PostgreSQL Guardian | APPROVED WITH CONDITIONS | 0 | 1 |
| Performance Guardian | APPROVED WITH CONDITIONS | 0 | 1 (H-4 como candidato a blocker pre-SQL) |
| Security Guardian | BLOCKED | 2 (SEC-1, H-8 elevado) | 2 |
| Scalability Guardian | APPROVED WITH CONDITIONS | 0 | 2 |
| Supabase Guardian | APPROVED WITH CONDITIONS | 0 | 2 |
| Reviewer | Review APROBADO | — | — |
| Lead Architect | **APPROVED WITH CONDITIONS** | — | — |

**Veredicto final Architecture Board: APPROVED WITH CONDITIONS**

### 13.2 Decisiones ejecutivas del Lead Architect

#### BLK-1 — RESUELTO: vehiculo_id → Opción A (denormalización)

**Decisión:** `vehiculo_id UUID NOT NULL` debe añadirse como columna explícita a `transiciones_evento`. Es una denormalización deliberada, no un error de diseño.

**Justificación:** el triple JOIN `transiciones_evento → eventos → historias_tecnicas → vehiculos` sobre una tabla particionada de cientos de millones de filas destruiría el plan del hot query path de Historia Técnica. La denormalización es el patrón correcto para sistemas event-centric. El valor se propaga desde el evento al momento del INSERT por la aplicación o trigger.

**Acciones requeridas antes de SQL:**
- Añadir `vehiculo_id UUID NOT NULL` a DATABASE_MODEL.md §4.2 con nota "denormalización deliberada"
- Confirmar en spec §5 la lista canónica de columnas de `transiciones_evento` (ver también §13.3)
- FK `vehiculo_id → vehiculos.id` deferred a Migration 002 (igual que `evento_id`)

#### BLK-2 — DEGRADADO a HIGH: fn_audit_insert() lee internamente

**Decisión:** `ip_origen` y `canal` NO son parámetros del contrato de invocación del trigger. La función los obtiene internamente via `current_setting('app.current_ip', true)` y `current_setting('app.canal', true)` con `missing_ok=true`. Ambos son nullable en la firma y en `audit_log`.

**Justificación:** un trigger no puede recibir parámetros adicionales de forma dinámica. La solución de `current_setting` con `missing_ok=true` hace la función resiliente a pgBouncer transaction mode: cuando la variable no está disponible, `ip_origen = NULL`, lo cual es un valor válido y aceptable. Los campos críticos del audit trail (`actor_id`, `org_id`, `accion`, `entidad`, `cambios`) siguen siendo completos.

**Acciones:** actualizar firma de `fn_audit_insert()` en spec §7.2 eliminando `p_ip_origen` y `p_canal` como parámetros mandatorios. Documentar el mecanismo `current_setting` como contrato de enriquecimiento opcional.

#### BLK-3 — DEGRADADO a corrección trivial en SQL

**Decisión:** `IF NOT EXISTS` en extensiones es una línea por extensión, resuelta en el SQL mismo. No requiere decisión arquitectural previa.

**Condición:** el commit que crea el SQL de Migration 001 debe incluir `IF NOT EXISTS` en todas las sentencias `CREATE EXTENSION`. Documentar en spec §3 para idempotencia.

#### H-8 — ELEVADO a BLOCKER pre-deploy (no pre-SQL)

**Decisión (Security Guardian + Lead Architect):** la policy UPDATE de `usuarios` con `id = auth.uid()` sin `WITH CHECK` es explotable con una sola llamada desde el Supabase JS SDK. No bloquea escribir el SQL inicial, pero **bloquea el primer deploy**. El SQL correcto incluye esta protección desde el inicio.

**Vector:** `.from('usuarios').update({ rol_id: admin_id }).eq('id', auth.uid())` — ningún conocimiento especial requerido.

**Resolución:** `WITH CHECK (rol_id = OLD.rol_id AND org_id = OLD.org_id)` en la policy UPDATE. Se añade a Sección A del Checklist §12 actualizado.

### 13.3 Nuevos hallazgos del Architecture Board

#### BLOCKER-SEC-1 (Security Guardian) — org_id poisoning en transiciones_evento

**Descripción:** hasta que Migration 002 active la FK `evento_id → eventos.id`, un usuario autenticado puede insertar filas en `transiciones_evento` con su `org_id` propio pero un `evento_id` UUID arbitrario apuntando a eventos de otro tenant. Las filas quedan en el sistema con `org_id` del atacante pero referenciando datos huérfanos o ajenos. No es solo cross-tenant write (H-7) — es contaminación persistente del audit trail con datos fabricados.

**Severidad combinada con H-7:** ambos se resuelven con la misma línea: policy INSERT de `transiciones_evento` con `AND org_id = mi_org_id()`. Lead Architect los consolida: **H-7 se eleva a BLOCKER pre-deploy junto con BLOCKER-SEC-1**.

**Resolución:** añadir `org_id = mi_org_id()` a la policy INSERT. Se mueve a Sección A del Checklist §12.

#### HIGH-PG-1 (PostgreSQL Guardian) — STABLE re-evaluation en contextos de escritura

En triggers BEFORE y evaluación de policies `WITH CHECK` durante UPDATE, PostgreSQL puede re-evaluar funciones STABLE por fila si el planificador no puede garantizar estabilidad del contexto. Para `mi_org_id()` que lee `auth.jwt()` (que es `current_setting('request.jwt.claims', true)`), si ese setting cambia dentro de la transacción, STABLE no es suficiente. En uso normal esto no ocurre. En Edge Functions con service_role impersonating, puede.

**Resolución:** documentar en spec §8.1 que las funciones de JWT son STABLE para queries normales pero que el implementador debe ser consciente de que service_role impersonating invalida el resultado en esa transacción.

#### HIGH-PERF-1 (Performance Guardian) — Write amplification en trigger AFTER de particionadas

Cada INSERT en una tabla auditada genera un segundo INSERT en `audit_log` dentro de la misma transacción, re-routeando a la partición activa. A alta tasa de inserciones concurrentes (migración TallerGP), esto duplica el I/O de escritura síncrona.

**Resolución:** durante la migración masiva de datos históricos de TallerGP, desactivar temporalmente el trigger `fn_audit_insert_trigger` con `ALTER TABLE ... DISABLE TRIGGER`. Documentar este paso en el pipeline de migration de TallerGP. Añadir a checklist §11 del spec.

#### HIGH-SCALE-1 (Scalability Guardian) — Saturación del connection pool desde ~500-800 tenants activos

El trigger de auditoría síncrono convierte cada operación de 1 write en 2 writes serializadas. Con pgBouncer Pro (~200-500 conexiones) y picos coordinados (lunes 8am, fin de mes), el pool empieza a saturarse antes de 1K tenants activos simultáneos, no recién a 10K como el review §10 sugería.

**Resolución:** añadir monitoreo de pool saturation al dashboard de producción desde el día 1. Evaluar trigger de auditoría asíncrono (via `pg_notify` + consumer externo) antes de superar 500 tenants activos simultáneos.

#### HIGH-SCALE-2 (Scalability Guardian) — Contradicción interna: 36M filas/trimestre vs umbral de 20M

El spec §5.2 define el umbral de cambio a granularidad mensual en 20M filas/partición. La proyección §10.3 (10K talleres) es 36M filas/trimestre desde el primer trimestre operacional. El spec se contradice.

**Resolución:** el job de creación de particiones debe evaluar el umbral por número de tenants activos, no solo por conteo de filas post-hoc. Añadir regla al spec: "Si la proyección de tenants activos supera 500, crear particiones mensuales en lugar de trimestrales".

#### HIGH-SUP-1 (Supabase Guardian) — Mecanismo del Auth Hook no especificado

Supabase tiene dos mecanismos de Auth Hook con comportamiento diferente: (a) trigger en `auth.users` (no tiene acceso al JWT en creación), (b) Supabase Auth Hooks v2 via Edge Function webhook (disponible en Pro desde 2024). La confusión entre ambos puede resultar en que `mi_org_id()` retorne NULL en producción si se escribe `app_metadata` en el lugar incorrecto.

**Resolución:** el spec §9.1 debe especificar explícitamente: "Auth Hook tipo Supabase Auth Hook v2 (webhook a Edge Function). Escribe en `raw_app_meta_data` de `auth.users`. Verificar que `auth.jwt() -> 'app_metadata'` retorna los valores seteados antes de cualquier query RLS."

#### HIGH-SUP-2 (Supabase Guardian) — PostgREST INSERT+RETURNING falla silenciosamente en tablas particionadas

PostgREST puede retornar un array vacío (200 OK) en lugar de error cuando hace INSERT a una tabla particionada con `.select()` y la partición activa no existe. Agrava R1 del spec: un INSERT que cae fuera de las particiones definidas puede parecer exitoso vía SDK.

**Resolución:** añadir al checklist §11 del spec: "Test explícito vía Supabase JS SDK: `supabase.from('transiciones_evento').insert(...).select()` — verificar que retorna la fila insertada, no array vacío. Testear en staging antes del primer deploy."

### 13.4 Correcciones del Reviewer al DBA Review

| Hallazgo del Reviewer | Acción |
|---|---|
| BLK-3 es HIGH operacional, no blocker arquitectural | Aceptado: degradado a corrección trivial en SQL (§13.2) |
| BLK-2 es HIGH de implementación, no blocker DDL | Aceptado: degradado (§13.2) |
| Falta lista canónica de columnas de `transiciones_evento` y `audit_log` (no solo vehiculo_id) | Aceptado: el spec debe documentar TODOS los campos de ambas tablas particionadas |
| H-5 en Sección A pero clasificado solo como HIGH — inconsistencia | Corregido: H-5 permanece en Sección A (el Board lo confirma como condición pre-merge) |
| §9.3 duplica §5.5 — infla conteo | Aceptado: M-7 y H-SUP-3 son el mismo problema. §9.3 se consolida como referencia, no hallazgo independiente |
| §7.3 (auditoría de catálogos globales) es una no-pregunta | Aceptado por PostgreSQL Guardian: catálogos globales se auditan via git + `schema_migrations`, no via trigger. M-12 se cierra como "decisión documentada: NO trigger en catálogos globales" |

### 13.5 Decisión sobre puertas cerradas (Scalability Guardian)

El shared schema multi-tenant (vs schema-per-tenant) es la única decisión de Migration 001 que cierra una puerta de larga data. Es la decisión correcta para el MVP y los primeros 2-3 años. Para el horizonte de 10K tenants:

**Criterio de re-evaluación documentado:** cuando se alcancen 5K tenants activos simultáneos, evaluar migración a Citus o sharding horizontal por tenant. Esta evaluación debe ocurrir antes de alcanzar ese umbral, no en el momento de crisis.

### 13.6 Checklist §12 — Versión actualizada post-Architecture Board

#### Sección A — Condiciones para comenzar SQL (reemplaza Sección A original)

- [ ] **BLK-1 resuelto:** `vehiculo_id UUID NOT NULL` añadido a DATABASE_MODEL.md §4.2 y al schema canónico de `transiciones_evento`. FK deferred a Migration 002 documentada.
- [ ] **BLK-2 resuelto:** firma de `fn_audit_insert()` actualizada en spec §7.2 — `ip_origen` y `canal` obtenidos internamente via `current_setting(..., true)`, no como parámetros de trigger.
- [ ] **BLK-3 confirmado:** todas las sentencias `CREATE EXTENSION` en el SQL usarán `IF NOT EXISTS`.
- [ ] **Schema canónico de `transiciones_evento` documentado:** lista completa de columnas (id, evento_id, vehiculo_id, org_id, estado_anterior, estado_nuevo, actor_id, actor_tipo, creado_en, razon — y cualquier campo adicional decidido) en DATABASE_MODEL.md §4.2.
- [ ] **Schema canónico de `audit_log` documentado:** lista completa de columnas con nullability y FK/no-FK de org_id y actor_id explícitos.

#### Sección B — Condiciones pre-merge a main (reemplaza Sección B original)

- [ ] **H-7 + BLOCKER-SEC-1:** policy INSERT de `transiciones_evento` con `AND org_id = mi_org_id()`.
- [ ] **H-8 (BLOCKER pre-deploy):** policy UPDATE de `usuarios` con `WITH CHECK (rol_id = OLD.rol_id AND org_id = OLD.org_id)`.
- [ ] **H-1:** spec §2 Paso 6 incluye TODOS los ALTER TABLE: `sucursales.eliminado_por`, `organizaciones.eliminado_por`, `usuarios.creado_por`, `usuarios.eliminado_por`, `permisos_rol.creado_por`.
- [ ] **H-4:** índice `(org_id, entidad, entidad_id, created_at DESC)` en `audit_log` añadido a spec §6.6.
- [ ] **H-5:** Paso 12 (seeds) se ejecuta ANTES que Paso 9 (triggers de auditoría) en el spec §2.
- [ ] **H-2:** `audit_log.org_id` nullable documentado; índice parcial `WHERE org_id IS NOT NULL`.
- [ ] **H-3:** `audit_log.actor_id` sin FK, documentado como intencional.
- [ ] **HIGH-SUP-1:** spec §9.1 especifica Auth Hook v2 vía webhook, no trigger en `auth.users`.
- [ ] **HIGH-SUP-2:** checklist §11 del spec incluye test PostgREST INSERT+RETURNING en tabla particionada.
- [ ] **M-9:** pg_partman eliminado de opciones disponibles en Supabase Pro (§5.4 del spec).
- [ ] **M-11:** convención de naming de triggers con prefijo numérico (`trg_01_`, `trg_50_`, `trg_99_`) documentada.
- [ ] **M-12 cerrada:** nota "NO trigger de auditoría en catálogos globales — auditados via git + schema_migrations" añadida al spec §7.3.

#### Sección C — Pre-go-live (sin cambios respecto a v1.0)

- [ ] R6: job automático de particiones implementado y testeado.
- [ ] R9 + H-8: revocación de JWT en desactivación (UC-A01) + protección de "último admin".
- [ ] HIGH-SCALE-1: monitoreo de pool saturation activo desde el primer deploy.
- [ ] HIGH-SCALE-2: lógica de switch a particiones mensuales documentada con umbral de 500 tenants.
- [ ] H-11: plan UUIDv7 documentado con threshold de alerta (4M filas).
- [ ] Test de aislamiento cross-tenant automatizado en CI.
- [ ] Test PII en audit_log: SHA-256 verificado en staging.
- [ ] pgvector >= 0.5.0 verificado en la instancia Supabase del proyecto.
- [ ] Restricción de sprint documentada: ningún sprint puede introducir tablas con PII de clientes hasta que Migration 006 esté aplicada y validada.

---

## Veredicto final Architecture Board (v1.1)

**APPROVED WITH CONDITIONS**

**El SQL de Migration 001 puede comenzar cuando:**
1. `vehiculo_id UUID NOT NULL` esté documentado en DATABASE_MODEL.md §4.2 con schema canónico completo de `transiciones_evento` y `audit_log`.
2. La firma de `fn_audit_insert()` esté actualizada en el spec (ip_origen y canal como campos internos nullable, no parámetros de trigger).
3. El commit inicial confirme `CREATE EXTENSION IF NOT EXISTS` para todas las extensiones.

**El diseño fundamental es correcto:** SECURITY DEFINER con JWT, particionamiento desde día 1, append-only audit, multi-tenant shared schema. Ningún especialista encontró un error arquitectural — todos los hallazgos son gaps de especificación resolubles.

**Los 5 issues de seguridad críticos** (H-7, H-8, BLOCKER-SEC-1, H-1, H-5) deben estar en el SQL desde el primer commit — no son "parches posteriores". El SQL de Migration 001 escrito correctamente los incluye por diseño.

