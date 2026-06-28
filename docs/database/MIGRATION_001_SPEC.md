# Migration 001 — Foundation Spec

**Estado:** v0.3 FINAL FROZEN — Architecture Board APPROVED WITH CONDITIONS, Sprint 2.2 conditions resolved  
**Versión:** 0.3  
**Última actualización:** Junio 2026  
**Propósito:** Especificación completa de la primera migración del sistema. Define qué se crea, en qué orden, con qué restricciones, y qué riesgos existen. No contiene SQL.

**Fuentes autoritativas (leer antes de implementar):**

| Documento | Qué define |
|---|---|
| `PHYSICAL_SCHEMA.md` | Tipos de dato, índices, particionamiento, triggers |
| `DATABASE_MODEL.md` | Tablas, relaciones, patrones transversales |
| `DOMAIN_MODEL.md` | Entidades, invariantes, reglas de negocio |
| `SECURITY_MODEL.md` + `PERMISSION_MODEL.md` | RLS, roles, funciones SECURITY DEFINER |
| `PERSISTENCE_ARCHITECTURE.md` | Estrategia de almacenamiento, clases de datos |
| `MULTI_TENANT_MODEL.md` | Aislamiento de tenant, propagación de org_id |
| `EVENT_MODEL.md` §4 | Tipos de evento canónicos para seed de `tipos_evento_base` |

**Nota de nomenclatura — org_id vs empresa_id:** `SECURITY_MODEL.md` usa `empresa_id` para el identificador de tenant. Este spec y todos los documentos de implementación usan `org_id`. Son el mismo concepto. `org_id` es el nombre canónico en el esquema físico (ver `DATABASE_MODEL.md` §14). Esto aplica también a la columna `audit_log.org_id` que `SECURITY_MODEL.md` §9 nombra como `empresa_id`.

---

## 1. Objetivo de Migration 001

Migration 001 crea la fundación de toda la base de datos de All Motors Cloud. Es el único cimiento sobre el cual se construyen todas las migraciones siguientes.

**No incluye lógica de negocio operacional** (vehículos, clientes, OTs, diagnósticos). Solo establece:

1. Las **extensiones PostgreSQL** de las que dependen todos los tipos, índices y funciones del sistema.
2. Las **funciones SECURITY DEFINER** que gobiernan el aislamiento multi-tenant y la auditoría inmutable.
3. Las **tablas organizacionales y de catálogo** que actúan como padres de todas las tablas del dominio.
4. El **particionamiento obligatorio** de las dos tablas append-only de crecimiento ilimitado.
5. Los **seeds iniciales** de catálogos globales que se copian a cada tenant al activarse.

**Regla de diseño clave:** ninguna decisión en esta migración puede deshacerse en producción sin downtime o pérdida de datos. El particionamiento de `transiciones_evento` y `audit_log` no puede agregarse retroactivamente a una tabla con datos. La estrategia de `org_id` y la estructura de JWT claims no puede cambiar sin migrar todos los tokens activos. Esta migración se hace bien desde el inicio o tiene costo prohibitivo a futuro.

**Tres categorías de entidades en esta migración:**

| Categoría | Tablas | Tiene org_id | Tiene datos en seed |
|---|---|---|---|
| Catálogos globales | `roles`, `tipos_evento_base` | No | Sí |
| Tenant raíz | `organizaciones` | — es el tenant | No (se crea en onboarding) |
| Per-tenant, vacías hasta onboarding | `sucursales`, `usuarios`, `permisos_rol` | Sí | No |
| Append-only / audit | `transiciones_evento`, `audit_log` | Sí | No |

**Dependencias:** ninguna. Migration 001 no requiere que exista ninguna otra migración previa.

---

## 2. Orden exacto de creación

El orden importa por dependencias de FK y por disponibilidad de funciones en policies RLS. Dentro de cada paso, el orden entre elementos sin dependencia entre sí es flexible.

```
Paso 1 — Extensiones
  uuid-ossp
  pgcrypto
  pg_trgm
  unaccent
  vector

Paso 2 — Funciones SECURITY DEFINER
  fn_set_updated_at()       ← trigger function compartida
  mi_org_id()               ← usada en policies RLS
  mi_rol()                  ← usada en policies RLS
  mi_sucursal_id()          ← usada en policies RLS de sucursal
  fn_audit_insert()         ← única vía de escritura en audit_log

Paso 3 — Tablas catálogo global (sin org_id, sin FK a tenant)
  roles                     ← no FK externas
  tipos_evento_base         ← no FK externas

Paso 4 — Tabla tenant raíz
  organizaciones
  NOTA FK CIRCULAR: organizaciones.creado_por → usuarios.id
  no puede ser NOT NULL ni FK activa en este paso.
  Se declara como UUID nullable sin constraint FK.
  La FK se añade via ALTER TABLE en Paso 6 post-creación de usuarios.

Paso 5 — Tabla con FK a organizaciones
  sucursales                ← FK a organizaciones

Paso 6 — Tablas con FK a organizaciones + sucursales + roles
  usuarios                  ← FK a organizaciones, sucursales, roles
  ALTER TABLE organizaciones ADD CONSTRAINT fk_creado_por
    FOREIGN KEY (creado_por) REFERENCES usuarios(id);
  ALTER TABLE sucursales ADD CONSTRAINT fk_creado_por ...;
  (igual para eliminado_por en todas las tablas del paso 4 y 5)

Paso 7 — Tabla con FK a organizaciones + roles
  permisos_rol              ← FK a organizaciones, roles

Paso 8 — Tablas particionadas (parent + todas las particiones desde 2020 hasta Q1 2027)
  transiciones_evento       ← RANGE por creado_en (TIMESTAMPTZ)
                               WITHOUT FK en evento_id — ver nota deferred FK abajo
  audit_log                 ← RANGE por created_at (TIMESTAMPTZ)

Paso 9 — Triggers
  fn_set_updated_at sobre: organizaciones, sucursales, usuarios, permisos_rol
  fn_audit_insert_trigger sobre: organizaciones, sucursales, usuarios, permisos_rol
  (ver §7 para detalles de ambos triggers)

Paso 10 — Índices
  Ver §6 completo

Paso 11 — RLS: habilitar + policies
  Todas las tablas de los pasos 3-8

Paso 12 — Seeds
  Insertar roles base (5 filas)
  Insertar tipos_evento_base (31 filas — ver §4)
```

**Nota — FK diferida de transiciones_evento.evento_id:**

`transiciones_evento.evento_id` es una columna UUID que apunta conceptualmente a `eventos.id`. La tabla `eventos` no existe en Migration 001. Por ello:

- La columna `evento_id` se crea en Migration 001 como `UUID NOT NULL` **sin** constraint FK (la FK no puede declararse sobre una tabla inexistente).
- La constraint FK se añade al inicio de Migration 002 via `ALTER TABLE transiciones_evento ADD CONSTRAINT fk_evento ...` después de que `eventos` sea creada.
- El índice sobre `evento_id` se crea en Migration 001 aunque la FK formal no exista aún (ver §6.5).
- El INSERT policy de `transiciones_evento` acepta cualquier UUID en `evento_id` hasta que Migration 002 active la FK. Esto es aceptable: no hay código de aplicación que inserte en `transiciones_evento` antes de que `eventos` exista.

Esta nota debe copiarse literalmente al inicio del spec de Migration 002.

**Restricción crítica:** las policies RLS no pueden crearse antes de que existan las funciones `mi_org_id()` y `mi_rol()` (Paso 2). El orden Paso 2 → Paso 11 es obligatorio.

---

## 3. Extensiones PostgreSQL

Todas las extensiones se instalan en el schema `public`. No se crean schemas adicionales en MVP (ver `PHYSICAL_SCHEMA.md` §10).

**Requisito obligatorio de implementación:** toda sentencia `CREATE EXTENSION` en el SQL de Migration 001 **debe** usar la forma `CREATE EXTENSION IF NOT EXISTS`. Esta forma es idempotente: si la extensión ya existe (por una ejecución previa o porque el dashboard de Supabase la instaló), la sentencia no falla. Sin `IF NOT EXISTS`, una re-ejecución de la migration tras un fallo parcial falla inmediatamente al intentar crear una extensión ya instalada. Nota operacional: `CREATE EXTENSION` no es transaccional en PostgreSQL — una extensión instalada no se deshace si la migración hace `ROLLBACK` posteriormente. La idempotencia via `IF NOT EXISTS` es la única protección práctica.

### 3.1 Tabla de extensiones

| Extensión | Motivo | Primera migración que la usa | Notas |
|---|---|---|---|
| `uuid-ossp` | `gen_random_uuid()` explícito como default en PKs | **001** | En PG 13+ está disponible sin extensión, pero se instala para declaración explícita del contrato |
| `pgcrypto` | SHA-256 para hashing de campos PII en `audit_log.cambios` | **001** | El trigger `fn_audit_insert_trigger` hashea RUT, nombre, teléfono, email antes de persistir |
| `pg_trgm` | Índices GIN trigram para búsqueda parcial de patente, cliente, repuesto | **002** | Se instala en 001 para disponibilidad; primer índice GIN en Migration 002 |
| `unaccent` | Normalización de acentos en tsvector español (full-text search) | **002** | Requerida por diccionario `spanish` de PostgreSQL |
| `vector` (pgvector) | Columna VECTOR(1536) + índice HNSW para embeddings de diagnósticos | **V1** | Se instala ahora para evitar re-migrar; el índice HNSW se crea en V1 cuando el corpus exista |

### 3.2 Advertencia sobre pgvector

No crear el índice HNSW en Migration 001. La extensión `vector` habilita el tipo y operadores; el índice espera hasta V1 cuando exista corpus suficiente (ver `PHYSICAL_SCHEMA.md` §4: `embeddings_diagnosticos` no se particiona porque HNSW requiere tabla completa).

---

## 4. Seeds iniciales

Los seeds corresponden a catálogos globales que existen independientemente de cualquier tenant. Se insertan en Migration 001 después de crear las tablas y habilitar RLS.

### 4.1 Tabla `roles` — 5 filas

| nombre | descripcion | nivel_acceso |
|---|---|---|
| `admin` | Administrador completo de la organización. Gestiona usuarios, configuración, billing y reportes financieros. | 100 |
| `jefe_taller` | Supervisión técnica y operativa. Acceso a toda información técnica y financiera. Puede aprobar control de calidad. | 80 |
| `recepcionista` | Operación de front-desk. Flujo completo de atención: recepción, presupuestos, autorizaciones, cobros. | 60 |
| `mecanico` | Trabajo técnico exclusivo. Solo vehículos y eventos asignados. Sin acceso a precios, finanzas ni PII del cliente. | 40 |
| `cliente_portal` | Acceso externo de solo lectura. Solo sus propios vehículos y registros marcados como visibles. | 10 |

**Invariante:** estos 5 roles son el catálogo base global. No tienen `org_id`. Los usuarios referencian directamente los roles de esta tabla. La personalización de permisos por tenant vive en `permisos_rol` (per-tenant).

### 4.2 Tabla `tipos_evento_base` — 31 filas

Esta seed **debe coincidir exactamente con `EVENT_MODEL.md` §4**. Las slugs a continuación son las versiones snake_case de los nombres canónicos definidos en ese documento. Cualquier discrepancia debe resolverse actualizando este spec, no el código.

**Categoría 1 — Contacto y Programación**

| slug | nombre_visible | genera_ot |
|---|---|---|
| `consulta` | Consulta | false |
| `cita` | Cita | false |

**Categoría 2 — Ingreso del Vehículo**

| slug | nombre_visible | genera_ot |
|---|---|---|
| `recepcion` | Recepción | true |
| `check_in` | Check-In | false |

**Categoría 3 — Evaluación Técnica**

| slug | nombre_visible | genera_ot |
|---|---|---|
| `diagnostico` | Diagnóstico | true |
| `escaneo_electronico` | Escaneo Electrónico | false |
| `inspeccion_visual` | Inspección Visual | false |
| `prueba_ruta` | Prueba de Ruta | false |
| `revision_preventiva` | Revisión Preventiva | true |
| `revision_precompra` | Revisión Precompra | false |
| `peritaje` | Peritaje | false |

**Categoría 4 — Presupuesto y Autorización**

| slug | nombre_visible | genera_ot |
|---|---|---|
| `cotizacion` | Cotización | false |
| `presupuesto` | Presupuesto | true |
| `autorizacion` | Autorización | true |
| `modificacion_presupuesto` | Modificación de Presupuesto | true |

**Categoría 5 — Ejecución del Trabajo**

| slug | nombre_visible | genera_ot |
|---|---|---|
| `reparacion` | Reparación | true |
| `mantencion` | Mantención | true |
| `instalacion` | Instalación | false |
| `solicitud_repuestos` | Solicitud de Repuestos | false |
| `espera_repuestos` | Espera de Repuestos | false |
| `lavado` | Lavado | false |

**Categoría 6 — Calidad y Entrega**

| slug | nombre_visible | genera_ot |
|---|---|---|
| `control_calidad` | Control de Calidad | true |
| `entrega` | Entrega | true |

**Categoría 7 — Post-Venta y Garantía**

| slug | nombre_visible | genera_ot |
|---|---|---|
| `seguimiento` | Seguimiento | false |
| `reclamo_cliente` | Reclamo del Cliente | false |
| `garantia` | Garantía | true |
| `reingreso` | Reingreso | true |

**Categoría 8 — Generados por el Sistema**

| slug | nombre_visible | genera_ot |
|---|---|---|
| `alerta_mantencion` | Alerta de Mantención | false |
| `recordatorio_cita` | Recordatorio de Cita | false |
| `alerta_vencimiento_garantia` | Alerta de Vencimiento de Garantía | false |

**Tipo adicional obligatorio (extensión documentada del catálogo base):**

| slug | nombre_visible | genera_ot | Justificación |
|---|---|---|---|
| `correccion` | Corrección | false | Requerido por `DATABASE_MODEL.md` §4.2: "errores en eventos cerrados se corrigen creando un nuevo evento de tipo `correccion`". Sin este tipo en el catálogo, la corrección de registros cerrados no puede ejecutarse. |

**Total: 31 tipos en 8 categorías (+ 1 extensión documentada).**

**Tipos extensibles por tenant (NO en seed global):**

Los siguientes tipos mencionados en versiones previas de este spec son extensiones por taller, no tipos del catálogo base. Los talleres pueden crearlos en su `tipos_evento` per-tenant:
- `cambio_propietario` — evento administrativo del taller, no universal
- `anotacion_interna` — variante de `consulta`
- `migracion_tallergp` — específico del pipeline de migración de All Motors SPA, no universal

**Nota sobre sincronización de catálogo (PA11):** cuando un tenant nuevo se activa, el sistema copia estas 31 filas a su tabla `tipos_evento` per-tenant (se crea en Migration 002). El mecanismo de copia inicial es responsabilidad del flujo de onboarding y debe especificarse en el spec de Migration 002. La pregunta abierta PA11 (actualización del catálogo global hacia tenants existentes tras agregar nuevos tipos base) sigue sin resolver y no es parte de Migration 001.

---

## 5. Particionamiento

Esta sección define el único aspecto de Migration 001 que es completamente irreversible sin downtime y riesgo de pérdida de datos. **Leer completo antes de implementar.**

### 5.1 Fundamento

Dos tablas del sistema tienen crecimiento proporcional a toda la actividad de todos los tenants, para siempre:

- **`transiciones_evento`**: cada cambio de estado de cualquier evento de cualquier OT de cualquier taller genera una fila.
- **`audit_log`**: cada acción de cada usuario en cada tenant genera una fila.

Convertir una tabla activa a particionada en PostgreSQL requiere recrearla. Si se llega a 50M filas sin particionamiento, la ventana de mantenimiento para recrear la tabla destruye el SLA. **Este riesgo se elimina completamente si la tabla se crea como particionada desde Migration 001.**

### 5.2 Estrategia de particionamiento

| Tabla | Estrategia | Columna de partición | Granularidad inicial | Umbral para cambiar a mensual | Desde |
|---|---|---|---|---|---|
| `transiciones_evento` | RANGE | `creado_en` (TIMESTAMPTZ) | Trimestral | Si partición proyectada > 20M filas | **Migration 001** |
| `audit_log` | RANGE | `created_at` (TIMESTAMPTZ) | Trimestral | Si partición proyectada > 20M filas | **Migration 001** |

**Umbral de cambio de granularidad:** si el análisis de crecimiento indica que una partición trimestral superará 20M filas antes de su cierre, las particiones futuras deben crearse con granularidad mensual. El job de creación automática de particiones (ver §5.4) debe soportar ambas granularidades. A 10K talleres con 200 OTs/mes × 15 transiciones = 30M filas/mes, la granularidad mensual es obligatoria desde el inicio; a menos de 500 talleres activos, la trimestral es suficiente.

### 5.3 Particiones a crear en Migration 001

**Regla:** si no existe partición matching para el valor de `creado_en` en un INSERT, PostgreSQL lanza error (tablas RANGE sin partición DEFAULT). Deben existir particiones para todas las fechas posibles en el momento de go-live.

**Particiones históricas (para datos importados de TallerGP):**

`migracion_tallergp` puede importar OTs con fechas desde 2020 (o antes según la historia de All Motors SPA). Sin estas particiones, cada INSERT de un evento histórico fallará.

Crear particiones históricas anuales:

| Partición | Rango |
|---|---|
| `*_2020` | [2020-01-01, 2021-01-01) |
| `*_2021` | [2021-01-01, 2022-01-01) |
| `*_2022` | [2022-01-01, 2023-01-01) |
| `*_2023` | [2023-01-01, 2024-01-01) |
| `*_2024` | [2024-01-01, 2025-01-01) |
| `*_2025` | [2025-01-01, 2026-01-01) |

Las particiones históricas usan granularidad **anual** (no trimestral) porque contienen datos estáticos de migración — no habrá nuevos INSERTs masivos sobre ellas después de la migración inicial.

**Particiones operacionales 2026 (año de lanzamiento):**

| Partición | Rango |
|---|---|
| `*_2026_q1` | [2026-01-01, 2026-04-01) |
| `*_2026_q2` | [2026-04-01, 2026-07-01) ← **Q2 está activo en el momento de escribir esta spec** |
| `*_2026_q3` | [2026-07-01, 2026-10-01) |
| `*_2026_q4` | [2026-10-01, 2027-01-01) |

**Partición buffer 2027:**

| Partición | Rango |
|---|---|
| `*_2027_q1` | [2027-01-01, 2027-04-01) |

**Total por tabla:** 6 anuales (2020-2025) + 4 trimestrales (2026) + 1 buffer = 11 particiones.

La misma estructura aplica a `transiciones_evento` y a `audit_log`.

**Advertencia crítica:** la partición Q2 2026 `[2026-04-01, 2026-07-01)` es la que está activa en junio 2026. Cualquier ejecución de Migration 001 en staging o producción durante Q2 2026 requiere que esta partición exista antes del primer INSERT. Si la ejecución ocurre después de julio 2026, Q3 2026 pasa a ser la partición activa — verificar siempre que la partición del trimestre actual exista antes de ejecutar.

### 5.4 Estrategia de creación de particiones futuras

Migration 001 no puede crear particiones para todos los años futuros. Se requiere un mecanismo para crearlas antes de que sean necesarias:

**Opción A (MVP — única viable en Supabase Pro):** job de Vercel Cron mensual que verifica si existen particiones para los próximos 3 meses y las crea si no. Registra su ejecución en tabla `job_runs`.

**Opción B (Enterprise only):** extensión `pg_partman`. **No disponible en Supabase Pro ni Starter.** Solo en instancias Enterprise dedicadas. No planificar para MVP.

El job debe soportar crear particiones con granularidad mensual cuando el umbral de §5.2 lo requiera. No implementar solo granularidad trimestral.

### 5.5 Qué NO se particiona en Migration 001

- `embeddings_diagnosticos`: **nunca particionar**. pgvector HNSW construye el grafo sobre la tabla completa (ver `PHYSICAL_SCHEMA.md` §4).
- Todas las demás tablas de Migration 001: volumen insuficiente en MVP.

### 5.6 Impacto en índices

Los índices en tablas RANGE particionadas se crean sobre la tabla padre y se heredan por cada partición. No crear índices directamente en particiones individuales. Todos los índices de `transiciones_evento` y `audit_log` se definen sobre la tabla padre.

---

## 6. Índices

Los índices de Migration 001 cubren los necesarios para que las funciones SECURITY DEFINER, las policies RLS y las constraints de negocio operen con performance aceptable desde el primer INSERT.

**Regla base (de `PHYSICAL_SCHEMA.md` §3.3 y §5):**
- Toda columna FK debe tener índice explícito — PostgreSQL no lo crea automáticamente.
- `org_id` nunca se indexa solo — siempre compuesto con al menos otra columna.
- Todos los índices de tablas operacionales per-tenant son índices parciales: `WHERE eliminado_en IS NULL`.
- No crear índices GIN en Migration 001 (los GIN de pg_trgm y tsvector van en Migration 002).
- No crear HNSW en Migration 001.

### 6.1 Tabla `organizaciones`

| Índice | Tipo | Columnas | Propósito |
|---|---|---|---|
| Unique | B-tree | `slug` | URL routing: orgSlug → org_id en middleware |
| Unique | B-tree | `rut` | Un RUT por taller en todo el sistema |

### 6.2 Tabla `sucursales`

| Índice | Tipo | Columnas | Propósito |
|---|---|---|---|
| B-tree | B-tree | `org_id` | FK index — RLS por tenant |
| Unique parcial | B-tree | `(org_id, nombre)` WHERE `eliminado_en IS NULL` | Sin sucursales duplicadas por taller |

### 6.3 Tabla `usuarios`

| Índice | Tipo | Columnas | Propósito |
|---|---|---|---|
| B-tree | B-tree | `org_id` | FK index + RLS hot path |
| Unique parcial | B-tree | `(org_id, email)` WHERE `eliminado_en IS NULL` | Email único por taller |
| B-tree | B-tree | `rol_id` | FK index |
| B-tree | B-tree | `sucursal_id` | FK index |

### 6.4 Tabla `permisos_rol`

| Índice | Tipo | Columnas | Propósito |
|---|---|---|---|
| B-tree | B-tree | `org_id` | FK index — RLS |
| B-tree | B-tree | `rol_id` | FK index |
| Unique parcial | B-tree | `(org_id, rol_id, nombre_permiso)` WHERE `eliminado_en IS NULL` | Sin permisos duplicados |

### 6.5 Tabla `transiciones_evento` (particionada)

Los índices se definen sobre la tabla padre y heredan a todas las particiones.

**Columnas de `transiciones_evento` (schema canónico completo):**

| Columna | Tipo | Nullable | Notas |
|---|---|---|---|
| `id` | UUID | NOT NULL | PK, gen_random_uuid() |
| `evento_id` | UUID | NOT NULL | FK diferida a Migration 002. El valor debe ser el id real del evento — integridad garantizada por aplicación hasta que Migration 002 active la FK. |
| `vehiculo_id` | UUID | NOT NULL | **Denormalización deliberada.** Evita triple JOIN para Historia Técnica. Sincronización: el INSERT debe proveer el vehiculo_id del evento referenciado (obtenido de `eventos.historia_tecnica_id → historias_tecnicas.vehiculo_id`). FK `vehiculo_id → vehiculos.id` diferida a Migration 002. |
| `org_id` | UUID | NOT NULL | Aislamiento multi-tenant. FK `org_id → organizaciones.id` activa en Migration 001. |
| `estado_anterior` | TEXT | NULL | NULL en creación del evento (primera transición). |
| `estado_nuevo` | TEXT | NOT NULL | Estado al que transiciona el evento. |
| `actor_id` | UUID | NULL | NULL cuando el actor es el sistema. |
| `actor_tipo` | TEXT | NOT NULL | CHECK en (`humano`, `sistema`). |
| `razon` | TEXT | NULL | Obligatoria cuando `estado_nuevo = 'cancelado'` — validada por trigger o aplicación. |
| `creado_en` | TIMESTAMPTZ | NOT NULL | DEFAULT NOW(). Columna de particionamiento RANGE. |

**Índices (sobre tabla padre, heredados por todas las particiones):**

| Índice | Tipo | Columnas | Propósito |
|---|---|---|---|
| B-tree | B-tree | `(vehiculo_id, creado_en DESC)` | **Índice primario — hot path de Historia Técnica.** Requerido por `PHYSICAL_SCHEMA.md` §4 y `DATABASE_MODEL.md` §8. Requiere la columna denormalizada `vehiculo_id`. FK de `vehiculo_id` diferida a Migration 002. |
| B-tree | B-tree | `(org_id, creado_en DESC)` | Queries de auditoría por tenant + rango de fecha. Partition pruning activa cuando `creado_en` también está en WHERE. |
| B-tree | B-tree | `evento_id` | **FK placeholder** — columna existe pero FK formal se añade en Migration 002. Índice necesario ahora per `PHYSICAL_SCHEMA.md` §3.3 para evitar seq-scan en el futuro JOIN. |

**Nota sobre BRIN:** revisiones de esta spec evaluaron un índice BRIN sobre `creado_en` dentro de cada partición. Conclusión: con inserts concurrentes multi-tenant (no ordenados físicamente por ningún criterio de negocio), BRIN no aporta beneficio measurable sobre el B-tree compuesto ya existente y el partition pruning. Se omite en favor de la simplicidad per `PHYSICAL_SCHEMA.md` §5 ("ningún índice sin justificación documentada").

### 6.6 Tabla `audit_log` (particionada)

**Columnas de `audit_log` (schema canónico completo):**

| Columna | Tipo | Nullable | Notas |
|---|---|---|---|
| `id` | UUID | NOT NULL | PK, gen_random_uuid() |
| `created_at` | TIMESTAMPTZ | NOT NULL | DEFAULT NOW(). Columna de particionamiento RANGE. |
| `actor_id` | UUID | NULL | NULL para operaciones de sistema (seeds, migrations). Sin FK a usuarios (preservar registros históricos). |
| `actor_rol` | TEXT | NULL | Valor de mi_rol() en el momento de la acción. NULL para actor sistema. |
| `org_id` | UUID | NULL | NULL para operaciones sobre catálogos globales (seeds de roles, tipos_evento_base). Sin FK a organizaciones (preservar registros post-offboarding). Índice parcial WHERE org_id IS NOT NULL. |
| `accion` | TEXT | NOT NULL | 'INSERT', 'UPDATE', 'DELETE', o código semántico. |
| `entidad` | TEXT | NOT NULL | Nombre de la tabla afectada. |
| `entidad_id` | UUID | NOT NULL | id del registro afectado. |
| `cambios` | JSONB | NULL | Diff before/after. PII hasheado con SHA-256 antes de persistir. NULL en operaciones sin cambio de datos. |
| `ip_origen` | INET | NULL | Obtenido internamente via current_setting('app.current_ip', true). NULL si no disponible (pgBouncer transaction mode). |
| `canal` | TEXT | NULL | Obtenido internamente via current_setting('app.canal', true). NULL si no disponible. |

**Índices (sobre tabla padre, heredados por todas las particiones):**

| Índice | Tipo | Columnas | Propósito |
|---|---|---|---|
| B-tree | B-tree | `(org_id, created_at DESC)` | Queries de auditoría por tenant + rango de fecha |
| B-tree parcial | B-tree | `(org_id, entidad, entidad_id, created_at DESC)` WHERE `org_id IS NOT NULL` | **Hot path del historial de cambios:** "¿quién modificó este registro específico?" — sin este índice, la query requiere seq-scan de toda la partición. Requerido por Architecture Board (H-4). |
| B-tree | B-tree | `actor_id` | Queries por usuario actor (sin FK activa) |

---

## 7. Triggers

Migration 001 implementa dos de los tres triggers críticos del sistema. El tercero (inmutabilidad de eventos cerrados) requiere la tabla `eventos`, que no existe en esta migración.

### 7.1 Trigger 3 — fn_set_updated_at (BEFORE UPDATE)

**Propósito:** mantener `actualizado_en` actualizado con la hora del servidor.  
**Función:** `fn_set_updated_at()` — SECURITY DEFINER, compartida.  
**Tipo:** BEFORE UPDATE FOR EACH ROW.

| Tabla | Trigger name |
|---|---|
| `organizaciones` | `trg_organizaciones_set_updated_at` |
| `sucursales` | `trg_sucursales_set_updated_at` |
| `usuarios` | `trg_usuarios_set_updated_at` |
| `permisos_rol` | `trg_permisos_rol_set_updated_at` |

**Invariante:** `actualizado_en` nunca es escrita por la aplicación. Solo por este trigger. Cualquier valor que la aplicación intente escribir en UPDATE es sobreescrito por `NOW()`.

### 7.2 Trigger de auditoría — fn_audit_insert_trigger (AFTER INSERT/UPDATE/DELETE)

**Propósito:** garantizar que toda mutación en tablas críticas quede registrada en `audit_log` independientemente del código de aplicación. Esto es una **garantía de base de datos**, no una convención de código.

**Mecanismo:** trigger AFTER en cada tabla auditable llama a `fn_audit_insert()` automáticamente. La aplicación no necesita (ni puede omitir) llamar a fn_audit_insert() directamente.

**Tipo:** AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW.

**Función:** `fn_audit_insert()` — SECURITY DEFINER, owned by `postgres` role.

**Por qué SECURITY DEFINER + postgres owner garantiza el INSERT en audit_log:**

`audit_log` no tiene policy INSERT para ningún rol de aplicación (ver §8.2). La función `fn_audit_insert()`, creada en una migration (que corre como `postgres`), es owned by `postgres`. El rol `postgres` tiene `BYPASSRLS`. Por tanto, cuando el trigger llama a `fn_audit_insert()`, la ejecución ocurre con los privilegios del `postgres` owner, bypaseando RLS y permitiendo el INSERT en `audit_log`. Si la función fuera owned por `authenticated` o `anon`, no tendría `BYPASSRLS` y el INSERT fallaría silenciosamente.

**Firma de fn_audit_insert():**

```
fn_audit_insert(
  p_actor_id      UUID,       -- auth.uid() en el momento de la mutación
  p_actor_rol     TEXT,       -- mi_rol() en el momento de la mutación
  p_org_id        UUID,       -- org_id del registro afectado
  p_accion        TEXT,       -- 'INSERT', 'UPDATE', 'DELETE', o código semántico
  p_entidad       TEXT,       -- nombre de la tabla afectada
  p_entidad_id    UUID,       -- id del registro afectado
  p_estado_ant    JSONB,      -- valores OLD antes del cambio (NULL en INSERT)
  p_estado_nuevo  JSONB       -- valores NEW después del cambio (NULL en DELETE)
) RETURNS VOID
```

**Campos ip_origen y canal — lectura interna obligatoria:**

`ip_origen` y `canal` **no son parámetros de la función**. El trigger no puede recibir parámetros dinámicos adicionales de la aplicación; estos valores se obtienen dentro de `fn_audit_insert()` directamente de las variables de sesión PostgreSQL:

- `ip_origen INET` ← `NULLIF(current_setting('app.current_ip', true), '')::INET`
- `canal TEXT` ← `NULLIF(current_setting('app.canal', true), '')`

El segundo argumento `true` (missing_ok) garantiza que si la variable no está seteada, la función devuelve `NULL` en lugar de lanzar una excepción. Ambos campos son **nullable** en `audit_log`: un registro de auditoría sin IP o sin canal es válido y no rompe el sistema. Los campos críticos para la trazabilidad (`actor_id`, `org_id`, `accion`, `entidad`, `entidad_id`, `cambios`) siempre se proveen como parámetros y no son nullable.

**Contrato de enriquecimiento (opcional):** la aplicación puede enriquecer el audit log seteando estas variables antes de una mutación: `SET LOCAL app.current_ip = '1.2.3.4'; SET LOCAL app.canal = 'web_erp';` dentro de la misma transacción explícita `BEGIN...COMMIT`. Con Supabase pgBouncer en transaction mode, `SET LOCAL` (no `SET`) es el único mecanismo que funciona de forma confiable, ya que las variables de sesión se resetean entre transacciones en ese modo. Si las variables no están seteadas, los campos en audit_log quedan NULL — comportamiento correcto para entornos serverless donde las variables no pueden garantizarse.

**Hashing de PII dentro de fn_audit_insert():**

Antes de persistir `p_estado_ant` y `p_estado_nuevo` en `audit_log.cambios`, la función hashea con SHA-256 (via `pgcrypto.digest()`) los valores de cualquier clave conocida como PII: `rut`, `nombre`, `nombre_completo`, `telefono`, `email`, `direccion`. El hash permite verificar igualdad entre registros sin revelar el valor original. **Nunca se almacena PII en claro en `audit_log`.**

**Tablas con trigger de auditoría en Migration 001:**

| Tabla | Acciones auditadas |
|---|---|
| `organizaciones` | INSERT, UPDATE |
| `sucursales` | INSERT, UPDATE, DELETE (soft) |
| `usuarios` | INSERT, UPDATE (cambio de rol, desactivación) |
| `permisos_rol` | INSERT, UPDATE, DELETE |

**Tablas que NO tienen trigger de auditoría en Migration 001** (se añaden en migraciones posteriores cuando las tablas existan): `eventos`, `ordenes_trabajo`, `clientes`, `presupuestos`, `autorizaciones`, `pagos`, `facturas`.

**Nota sobre `transiciones_evento`:** esta tabla es en sí misma un audit trail del ciclo de vida de eventos. No recibe trigger `fn_audit_insert_trigger`. Auditar la tabla de auditoría crearía un loop.

### 7.3 Triggers que NO van en Migration 001

| Trigger | Dónde va | Por qué no en 001 |
|---|---|---|
| Trigger 1 — Inmutabilidad de eventos cerrados (BEFORE UPDATE en `eventos`) | Migration 003 | La tabla `eventos` no existe en Migration 001 |
| Trigger 2 — Anti-ciclo en `referencias_evento` (BEFORE INSERT) | Migration 002 | La tabla `referencias_evento` no existe en Migration 001 |

### 7.4 Estrategia de append-only para transiciones_evento y audit_log

La inmutabilidad de estas tablas se implementa mediante **ausencia de policies RLS de UPDATE/DELETE** (ver §8.2), no mediante trigger. La ausencia de policy es más robusta que un trigger que podría ser desactivado por el `service_role` bajo determinadas circunstancias. El `service_role` bypasea RLS — su uso para modificar estas tablas se controla por disciplina operacional, no por mecanismo técnico de base de datos.

---

## 8. Seguridad

### 8.1 Funciones SECURITY DEFINER — especificación

**Requisito absoluto:** todas las funciones SECURITY DEFINER **deben** incluir `SET search_path = public`. Sin esta cláusula, un usuario malicioso puede crear un objeto homónimo en su propio schema y hacer que PostgreSQL lo use en lugar de la función real, retornando un `org_id` arbitrario y bypaseando el aislamiento multi-tenant completo (ver `PHYSICAL_SCHEMA.md` §8.3).

| Función | Tipo | Lee de | Notas de implementación |
|---|---|---|---|
| `mi_org_id()` | SECURITY DEFINER, STABLE | `(auth.jwt() ->> 'app_metadata')::jsonb ->> 'org_id'` luego `::UUID` | Usar `->>`  (extracción a TEXT) no `->` (extracción a JSONB) para evitar error de cast. La Auth hook debe escribir `org_id` como string JSON, no como tipo raw. |
| `mi_rol()` | SECURITY DEFINER, STABLE | `(auth.jwt() ->> 'app_metadata')::jsonb ->> 'role'` | Igual que mi_org_id(). |
| `mi_sucursal_id()` | SECURITY DEFINER, STABLE | `(auth.jwt() ->> 'app_metadata')::jsonb ->> 'sucursal_id'` luego `::UUID` | Puede ser NULL para usuarios sin sucursal asignada (por ejemplo, admin global). |
| `fn_set_updated_at()` | SECURITY DEFINER, VOLATILE | — | SET NEW.actualizado_en = NOW() |
| `fn_audit_insert(...)` | SECURITY DEFINER, VOLATILE, owned by postgres | Parámetros de llamada | Ver firma completa en §7.2. Debe ser owned by postgres para BYPASSRLS. |

**Por qué mi_org_id() lee del JWT y no de la tabla `usuarios`:**

PostgreSQL evalúa `mi_org_id()` por cada fila al aplicar una policy RLS. Si la función hace `SELECT org_id FROM usuarios WHERE id = auth.uid()`, genera un lookup implícito por cada fila examinada. Leer del JWT (`auth.jwt()`) es O(1) sin toca ninguna tabla. A 1K talleres activos simultáneos con decenas de requests por segundo, la diferencia es la entre funcionamiento correcto y saturación del connection pool. (Ver `PERSISTENCE_ARCHITECTURE.md` §9.)

**Consecuencia operacional del JWT-based approach:** cuando se cambia el rol o la sucursal asignada de un usuario en tabla `usuarios`, el cambio no es efectivo hasta que el usuario re-autentica (o hasta el vencimiento del JWT de 1 hora). Para el caso de desactivación de usuario (eliminado_en), ver §8.3.

**Contrato con el Auth hook:** el hook (Database Function trigger en `auth.users` o Edge Function en `auth.user.created/updated`) debe escribir en `app_metadata`:
```json
{
  "org_id": "uuid-string-here",
  "role": "admin",
  "sucursal_id": "uuid-string-or-null"
}
```
Los valores deben ser strings JSON (no tipos raw). `org_id` null indica usuario sin tenant asignado — el sistema lo verá como vacío en todas las queries RLS.

### 8.2 Policies RLS por tabla

**Tabla `roles` (catálogo global)**

| Operación | Policy |
|---|---|
| SELECT | Verdadero para todos los usuarios autenticados |
| INSERT / UPDATE / DELETE | Bloqueado para roles de aplicación (solo service_role en migraciones) |

**Tabla `tipos_evento_base` (catálogo global)**

| Operación | Policy |
|---|---|
| SELECT | Verdadero para todos los usuarios autenticados |
| INSERT / UPDATE / DELETE | Bloqueado (solo service_role en migraciones) |

**Tabla `organizaciones`**

| Operación | Policy | Condición |
|---|---|---|
| SELECT | Tenant isolation | `id = mi_org_id()` — el tenant solo ve su propia fila |
| INSERT | **Solo service_role** | No existe policy INSERT para roles de aplicación |
| UPDATE | Admin de la organización | `id = mi_org_id() AND mi_rol() = 'admin'` |
| DELETE | Bloqueado | — |

**Nota onboarding crítica:** la ausencia de policy INSERT para roles de aplicación en `organizaciones` significa que **la creación de un nuevo tenant requiere el service_role key**. El flujo de onboarding debe ejecutarse desde un Edge Function server-side con service_role, nunca desde el cliente browser con el JWT del usuario. Un implementador que intente llamar a `supabase.from('organizaciones').insert(...)` desde un componente cliente recibirá 0 filas afectadas sin error visible — un fallo silencioso que bloqueará el registro de nuevos talleres.

**Tabla `sucursales`**

| Operación | Policy | Condición |
|---|---|---|
| SELECT | Tenant isolation | `org_id = mi_org_id() AND eliminado_en IS NULL` |
| INSERT | Admin | `org_id = mi_org_id() AND mi_rol() = 'admin'` |
| UPDATE | Admin | `org_id = mi_org_id() AND mi_rol() = 'admin'` |
| DELETE | Bloqueado | Soft-delete via UPDATE de `eliminado_en` |

**Tabla `usuarios`**

| Operación | Policy | Condición |
|---|---|---|
| SELECT | Tenant isolation | `org_id = mi_org_id() AND eliminado_en IS NULL` |
| INSERT | Admin | `org_id = mi_org_id() AND mi_rol() = 'admin'` |
| UPDATE | Admin o el propio usuario (para perfil) | `org_id = mi_org_id() AND (mi_rol() = 'admin' OR id = auth.uid())` |
| DELETE | Bloqueado | Soft-delete via UPDATE de `eliminado_en` |

**Tabla `permisos_rol`**

| Operación | Policy | Condición |
|---|---|---|
| SELECT | Tenant isolation | `org_id = mi_org_id()` |
| INSERT / UPDATE | Admin | `org_id = mi_org_id() AND mi_rol() = 'admin'` |
| DELETE | Bloqueado | — |

**Tabla `transiciones_evento` (append-only)**

| Operación | Policy | Condición |
|---|---|---|
| SELECT | Tenant isolation | `org_id = mi_org_id()` |
| INSERT | Roles operacionales | `org_id = mi_org_id() AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')` |
| UPDATE | **No existe policy** | Retorna 0 filas — efectivamente bloqueado |
| DELETE | **No existe policy** | Retorna 0 filas — efectivamente bloqueado |

`cliente_portal` no puede insertar transiciones. Un cliente del portal no tiene autoridad sobre la máquina de estados interna del taller.

**Tabla `audit_log` (append-only via SECURITY DEFINER)**

| Operación | Policy | Condición |
|---|---|---|
| SELECT | Admin y jefe_taller | `org_id = mi_org_id() AND mi_rol() IN ('admin', 'jefe_taller')` |
| INSERT | **No existe policy directa** | Solo via trigger `fn_audit_insert_trigger` que llama a `fn_audit_insert()` con BYPASSRLS |
| UPDATE | **No existe policy** | Bloqueado |
| DELETE | **No existe policy** | Bloqueado |

**Diseño intencional:** los actores que generan registros de auditoría (todos los roles) no pueden leer todos los registros de auditoría. Solo admin y jefe_taller pueden leer `audit_log`. Esta asimetría es deliberada: un usuario no puede ver ni eliminar su propio rastro de auditoría. La ausencia de policy UPDATE/DELETE en `audit_log` lo hace inmutable incluso para el admin.

**Mechanic data minimization — deferred:** las restricciones de visibilidad del rol `mecanico` (sin PII de clientes, sin datos financieros) dependen de las vistas `v_clientes_mecanico` y `v_items_presupuesto_mecanico` con `security_barrier = true`. Estas vistas se crean en Migration 006 (ver `PHYSICAL_SCHEMA.md` §11) sobre tablas que no existen en Migration 001. **Ningún sprint que involucre al mecánico puede comenzar antes de que Migration 006 esté aplicada y validada.**

### 8.3 Campos de auditoría en tablas operacionales

Toda tabla per-tenant operacional en Migration 001 incluye:

| Columna | Tipo | Default | Constraint |
|---|---|---|---|
| `creado_en` | TIMESTAMPTZ | `NOW()` | NOT NULL |
| `actualizado_en` | TIMESTAMPTZ | `NOW()` | NOT NULL, set by trigger |
| `creado_por` | UUID | NULL | FK nullable a `usuarios.id` (ver nota circular FK en §2) |
| `eliminado_en` | TIMESTAMPTZ | NULL | NULL = activo |
| `eliminado_por` | UUID | NULL | FK nullable a `usuarios.id` |

**Excepción documentada:** `transiciones_evento` y `audit_log` son append-only y no tienen `eliminado_en` (ver `DATABASE_MODEL.md` §7, `PHYSICAL_SCHEMA.md` §7.1).

**Nota sobre columnas de audit_log:** la estructura de `audit_log` se rige por `SECURITY_MODEL.md` §9. El nombre canónico de la columna de tenant en `audit_log` es `org_id` en esta implementación (donde `SECURITY_MODEL.md` usa `empresa_id`), y el nombre de la columna de timestamp es `created_at` (donde `SECURITY_MODEL.md` usa `timestamp`). Ver nota de nomenclatura al inicio de este documento.

### 8.4 PII en audit_log

Ver §7.2 para la implementación técnica (función `fn_audit_insert()`). Regla de negocio: ningún valor de PII (RUT, nombre, teléfono, email, dirección) puede aparecer en texto plano en `audit_log.cambios`. Los campos PII son reemplazados por su hash SHA-256 antes de persistir. Esta es una invariante de base de datos implementada en el trigger, no una convención de aplicación.

### 8.5 Desactivación de usuario — gap documentado

`SECURITY_MODEL.md` §12 Rule 5: "Un usuario desactivado pierde el acceso en la próxima request."

Migration 001 implementa el soft-delete (`eliminado_en IS NOT NULL` en `usuarios`). Sin embargo, el JWT activo del usuario desactivado sigue siendo válido hasta su expiración natural (1 hora para access token, 7 días para refresh token).

**Esto es un gap entre el modelo de seguridad y la implementación de Migration 001.** La solución completa requiere un trigger o hook que llame a la Supabase Auth Admin API (`admin.deleteUser()` o `admin.updateUserById()` con `ban_duration`) cuando `usuarios.eliminado_en` sea actualizado. Esta lógica es de aplicación (Route Handler o Edge Function), no de migración SQL.

**Acción requerida antes de go-live:** el módulo de gestión de usuarios (UC-A01) debe implementar la revocación del refresh token de Supabase Auth cuando se soft-delete un usuario. Este es un requisito de seguridad no negociable per `SECURITY_MODEL.md`. Se documenta aquí como gap conocido para que no se pase por alto en la implementación del sprint de administración.

---

## 9. Dependencias

### 9.1 Qué debe existir ANTES de ejecutar Migration 001

| Prerequisito | Por qué | Responsable |
|---|---|---|
| Proyecto Supabase creado (Plan Pro o superior) | pg_cron, capacidades avanzadas de particionamiento | DevOps |
| PostgreSQL 15+ en Supabase | gen_random_uuid() nativo, RANGE PARTITION madura | Supabase gestiona |
| Variables de entorno configuradas | `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | DevOps |
| **Auth hook implementado y activo** | Sin hook, `mi_org_id()` retorna NULL → RLS muestra vacío a todos | Auth Config |
| Supabase CLI instalado y proyecto linkeado | `supabase db push` para aplicar la migración | Dev local |

**El Auth hook es el prerequisito más crítico.** Debe escribir `org_id`, `role`, `sucursal_id` en `app_metadata` del JWT al crear o actualizar un usuario. Mecanismos válidos: Database Function trigger en `auth.users`, o Edge Function en evento `auth.user.created/updated`. Antes de ejecutar Migration 001 en staging: autenticar un usuario de prueba y verificar manualmente que `(auth.jwt() ->> 'app_metadata')::jsonb ->> 'org_id'` no sea NULL.

### 9.2 Flujo de onboarding — qué requiere service_role

El onboarding de un nuevo taller crea la fila en `organizaciones`. Como la policy INSERT de `organizaciones` es service_role only, el flujo de onboarding **debe** ejecutarse desde un Edge Function server-side con `SUPABASE_SERVICE_ROLE_KEY`. Nunca desde el cliente browser.

Secuencia minimal:

```
Edge Function (service_role):
  1. INSERT en organizaciones → obtener org_id nuevo
  2. Crear usuario en Supabase Auth (admin.createUser)
  3. SET app_metadata: { org_id, role: 'admin', sucursal_id: null }
  4. INSERT en usuarios (con org_id y rol_id del admin)

Usuario:
  5. Re-autenticar (o refresh token) para recibir JWT con org_id
  6. Wizard: crear sucursal → INSERT en sucursales (ya con JWT válido)
  7. Copiar tipos_evento_base → tipos_evento (ver Migration 002 spec)
```

Entre los pasos 1-5, el usuario no tiene org_id en su JWT y no puede leer nada vía RLS. El wizard de onboarding no debe mostrar datos del tenant hasta que el paso 5 esté confirmado.

### 9.3 Qué depende de Migration 001

| Migración / Componente | Por qué depende de 001 |
|---|---|
| **Migration 002** | Usa tablas `organizaciones`, `sucursales`, `usuarios`, `tipos_evento_base`, funciones RLS |
| **Onboarding flow** | Inserta en `organizaciones` y `usuarios` |
| **pnpm db:types** | `supabase gen types` genera los tipos TypeScript desde el schema; `packages/database/src/types/` debe actualizarse después de cada migración |

### 9.4 Qué NO depende de Migration 001

`apps/web` y `apps/mechanic` compilan sin base de datos activa. La generación de tipos TypeScript (`pnpm db:types`) requiere Migration 001 aplicada, pero el build del monorepo no.

---

## 10. Riesgos

| # | Riesgo | Severidad | Probabilidad | Mitigación |
|---|---|---|---|---|
| R1 | **Partición del trimestre activo no creada** — Migration 001 ejecutada sin la partición Q2 2026 resulta en INSERT fallido inmediato. | Crítico | Alta (error de checklist) | Crear Q1+Q2+Q3+Q4 2026 + Q1 2027 + históricas 2020-2025 en Migration 001. Checklist §11 verifica cada partición individualmente. |
| R2 | **Auth hook no configurado** — `mi_org_id()` retorna NULL → RLS muestra vacío sin error visible. | Alto | Alta en setup inicial | Validar hook antes de ejecutar Migration 001: autenticar usuario de prueba y verificar `app_metadata.org_id` no es NULL. |
| R3 | **SECURITY DEFINER sin SET search_path** — bypass de RLS mediante schema homónimo. | Crítico | Baja | Revisión explícita de todas las funciones SECURITY DEFINER antes de mergear. Test: crear schema conflictivo y verificar que `mi_org_id()` retorna el valor correcto. |
| R4 | **PII en audit_log en claro** — Si `fn_audit_insert()` no hashea antes de persistir, RUT/nombre/email quedan en tabla inmutable. Violación de Ley 19.628 irrecuperable. | Crítico | Media (error de implementación) | Test de humo pre-go-live: insertar registro con RUT real de prueba, verificar que `audit_log.cambios` no contiene el RUT en texto plano. |
| R5 | **UUID v4 degradación B-tree** — page splits en PK de `transiciones_evento` a partir de **5M filas** (umbral de acción; la degradación visible comienza ~10-20M). | Medio | Baja en MVP | Monitorear con alerta automática al alcanzar 4M filas. Planificar migración a UUIDv7 antes del umbral de 5M. No urgente en MVP. |
| R6 | **Particiones futuras no creadas automáticamente** — primer INSERT del trimestre siguiente falla en producción. | Alto | Media | Crear particiones hasta Q1 2027 en Migration 001. Job automático crea las siguientes. Alerta si job falla. |
| R7 | **Seed de tipos_evento_base incompleto** — UI falla al intentar seleccionar un tipo inexistente en formularios de recepción/diagnóstico. | Medio | Media si no se valida | Cruzar la tabla en §4.2 con `EVENT_MODEL.md` §4 antes de ejecutar. Test de smoke: verificar que cada slug requerido por la UI existe en la tabla. |
| R8 | **Cambio de rol/org_id no efectivo inmediatamente** — JWT activo retiene el rol antiguo hasta re-autenticación. | Bajo | Alta (comportamiento esperado) | Documentado como comportamiento conocido. Para desactivación de usuario, ver R9. |
| R9 | **Desactivación de usuario no revoca JWT** — usuario con `eliminado_en IS NOT NULL` sigue con acceso hasta expiración del JWT (1h access, 7d refresh). | Alto | Alta si no se implementa | Implementar revocación de sesión Supabase Auth en el módulo UC-A01 (sprint de administración). No es SQL de Migration 001 — es lógica de aplicación. Documentado en §8.5. |
| R10 | **Datos históricos de TallerGP sin partición** — OTs con fecha 2020-2025 generan INSERT error en `transiciones_evento` sin particiones históricas. | Alto | Alta (hay datos históricos conocidos) | Crear particiones anuales 2020-2025 en Migration 001 (§5.3). |
| R11 | **organizaciones.creado_por circular FK** — crear `organizaciones.creado_por → usuarios.id` antes de que `usuarios` exista falla en DDL. | Medio | Alta si no se sigue el orden del §2 | Seguir el orden de Paso 6 en §2: añadir FK via ALTER TABLE después de crear `usuarios`. |
| R12 | **Volumen que hace trimestral insuficiente** — a >500 talleres activos, las particiones trimestrales pueden superar 20M filas en operación normal. | Medio | Baja en MVP | Umbral de cambio a mensual definido en §5.2. Job de particiones debe soportar ambas granularidades. |

---

## 11. Checklist final

Antes de considerar Migration 001 completa y aprobada para continuar con Migration 002, verificar cada ítem. Los ítems agrupados por área de verificación.

### Prerequisitos (antes de ejecutar Migration 001)

- [ ] Proyecto Supabase Pro activado
- [ ] Auth hook implementado: test de autenticación → verificar `app_metadata.org_id` no NULL
- [ ] Auth hook escribe `org_id`, `role`, `sucursal_id` como strings JSON en `app_metadata`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurado en variables de entorno del entorno target

### Extensiones

- [ ] `uuid-ossp` instalada: `SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp'`
- [ ] `pgcrypto` operativa: `SELECT digest('test', 'sha256')` retorna resultado sin error
- [ ] `pg_trgm` instalada: `SELECT similarity('test', 'tost')` retorna valor numérico
- [ ] `unaccent` instalada: `SELECT unaccent('café')` retorna `'cafe'`
- [ ] `vector` (pgvector) instalada: `SELECT '[1,2,3]'::vector` sin error

### Funciones SECURITY DEFINER

- [ ] `mi_org_id()` creada con `SET search_path = public` — verificar en `pg_proc`
- [ ] `mi_rol()` creada con `SET search_path = public`
- [ ] `mi_sucursal_id()` creada con `SET search_path = public`
- [ ] `fn_set_updated_at()` creada con `SET search_path = public`
- [ ] `fn_audit_insert()` creada, owned by `postgres`, con `SET search_path = public`
- [ ] Test funcional: autenticar usuario con JWT válido → `SELECT mi_org_id()` retorna UUID correcto (no NULL)
- [ ] Test: `SELECT mi_rol()` retorna el rol correcto del usuario de prueba

### Tablas y estructura

- [ ] `roles` creada con RLS habilitado (`relrowsecurity = true` en `pg_class`)
- [ ] `tipos_evento_base` creada con RLS habilitado
- [ ] `organizaciones` creada con `slug` unique, `rut` unique, RLS habilitado
- [ ] `organizaciones.creado_por` es nullable UUID sin FK activa (FK se añade en Paso 6)
- [ ] `sucursales` creada con FK a `organizaciones`, RLS habilitado
- [ ] `usuarios` creada con FK a `organizaciones`, `sucursales`, `roles`, RLS habilitado
- [ ] Después de crear `usuarios`: FK `organizaciones.creado_por → usuarios.id` añadida via ALTER TABLE
- [ ] `permisos_rol` creada con FK a `organizaciones`, `roles`, RLS habilitado
- [ ] `transiciones_evento` creada como RANGE PARTITIONED (verificar `pg_partitioned_table`)
- [ ] `transiciones_evento.evento_id` es UUID NOT NULL **sin** FK (FK deferred a Migration 002 — ver §2)
- [ ] `audit_log` creada como RANGE PARTITIONED

### Particionamiento — crítico

- [ ] **Históricas (2020-2025):** partición `transiciones_evento_2020` creada
- [ ] Partición `transiciones_evento_2021` creada
- [ ] Partición `transiciones_evento_2022` creada
- [ ] Partición `transiciones_evento_2023` creada
- [ ] Partición `transiciones_evento_2024` creada
- [ ] Partición `transiciones_evento_2025` creada
- [ ] **Operacionales 2026:** partición `transiciones_evento_2026_q1` creada ← datos de onboarding previos al Q2
- [ ] **Partición activa:** partición `transiciones_evento_2026_q2` creada ← **activa en junio 2026**
- [ ] Partición `transiciones_evento_2026_q3` creada
- [ ] Partición `transiciones_evento_2026_q4` creada
- [ ] **Buffer:** partición `transiciones_evento_2027_q1` creada
- [ ] Mismas 11 particiones creadas para `audit_log`
- [ ] Test funcional: `INSERT INTO transiciones_evento (..., creado_en = NOW())` persiste sin error
- [ ] Test funcional: `INSERT INTO transiciones_evento (..., creado_en = '2022-06-15')` persiste sin error (partición histórica)
- [ ] Test funcional: `INSERT INTO transiciones_evento (..., creado_en = '2027-01-15')` persiste sin error (buffer)

### Triggers

- [ ] `trg_organizaciones_set_updated_at` activo: UPDATE → `actualizado_en` cambia a `NOW()`
- [ ] `trg_sucursales_set_updated_at` activo
- [ ] `trg_usuarios_set_updated_at` activo
- [ ] `trg_permisos_rol_set_updated_at` activo
- [ ] `trg_organizaciones_audit` activo: INSERT en `organizaciones` → fila en `audit_log`
- [ ] `trg_usuarios_audit` activo: UPDATE en `usuarios` (desactivación) → fila en `audit_log`

### Índices

- [ ] Unique en `organizaciones.slug` activo
- [ ] Unique en `organizaciones.rut` activo
- [ ] FK index en `sucursales.org_id` activo
- [ ] Unique parcial en `(sucursales.org_id, sucursales.nombre)` WHERE `eliminado_en IS NULL` activo
- [ ] FK index en `usuarios.org_id` activo
- [ ] Unique parcial en `(usuarios.org_id, usuarios.email)` WHERE `eliminado_en IS NULL` activo
- [ ] B-tree `(vehiculo_id, creado_en DESC)` en `transiciones_evento` padre activo
- [ ] B-tree `(org_id, creado_en DESC)` en `transiciones_evento` padre activo
- [ ] B-tree `evento_id` en `transiciones_evento` padre activo (FK placeholder)
- [ ] B-tree `(org_id, created_at DESC)` en `audit_log` padre activo
- [ ] B-tree `actor_id` en `audit_log` padre activo

### RLS y Seguridad

- [ ] RLS habilitado en todas las tablas (verificar `relrowsecurity = true` en `pg_class` para cada una)
- [ ] **Test de aislamiento cross-tenant (automatizado en CI):**
  - Insertar fila para tenant A en `sucursales`
  - Autenticar como usuario de tenant B
  - `SELECT * FROM sucursales` → debe retornar 0 filas
  - Este test es parte permanente del test suite, no solo verificación de Migration 001
- [ ] Test append-only `transiciones_evento`: UPDATE retorna 0 filas afectadas (no error, 0 filas)
- [ ] Test append-only `audit_log`: INSERT directo con JWT de aplicación → bloqueado
- [ ] Test `fn_audit_insert` trigger: INSERT en `usuarios` → genera fila en `audit_log`
- [ ] **Test PII:** insertar `usuarios` con RUT de prueba `12.345.678-9` → verificar que `audit_log.cambios` no contiene `12345678` ni `12.345.678-9` en texto plano
- [ ] Test onboarding: INSERT en `organizaciones` con JWT de aplicación (no service_role) → bloqueado (0 filas)
- [ ] Test onboarding: INSERT en `organizaciones` con service_role → exitoso

### Seeds

- [ ] 5 roles insertados: admin, jefe_taller, recepcionista, mecanico, cliente_portal
- [ ] 31 tipos de evento insertados en `tipos_evento_base` (30 de EVENT_MODEL.md + `correccion`)
- [ ] Cruzar slugs con EVENT_MODEL.md §4: cada categoría y nombre coincide
- [ ] `audit_log` NO tiene filas del tipo `tipos_evento_base` — esta tabla no recibe trigger de auditoría

### Generación de tipos TypeScript

- [ ] Ejecutar `pnpm db:types` (script en raíz del monorepo)
- [ ] `packages/database/src/types/index.ts` actualizado con tipos de las nuevas tablas
- [ ] `pnpm typecheck` pasa en todo el monorepo sin errores nuevos

### Gate para Migration 002

- [ ] Todos los ítems anteriores verificados y documentados
- [ ] Auth hook configurado en todos los entornos (local, staging, producción)
- [ ] Job automático de creación de particiones implementado o fecha comprometida
- [ ] Gap de desactivación de usuario (R9 / §8.5) asignado a sprint de administración (UC-A01)
- [ ] Gap de vistas security_barrier para mecanico (§8.2) asignado a sprint previo al primer sprint con mecánico
- [ ] Un tenant de prueba creado via flujo de onboarding correcto (Edge Function con service_role), no por inserción directa

---

*Este documento es la especificación de diseño de Migration 001, no su implementación.*  
*Ninguna línea de SQL debe escribirse sin que cada decisión pueda trazarse hasta una sección de este documento o de los documentos autoritativos listados en el encabezado.*  
*Modificaciones requieren revisión del Architecture Board.*  
*Migration 002 no puede comenzarse hasta que el Checklist §11 esté completamente verificado.*
