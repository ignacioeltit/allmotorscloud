# Physical Schema — All Motors Cloud

**Estado:** Oficial (Night Build — Physical Schema Design Board, Junio 2026)
**Versión:** 1.0
**Última actualización:** Junio 2026
**Propósito:** Decisiones físicas que gobiernan toda implementación SQL. Ninguna migración se escribe sin trazarse hasta aquí.

---

## 1. Filosofía del esquema físico

1. **Las decisiones de hoy son los costos de mañana.** El particionamiento, los tipos de PK y la inmutabilidad no se pueden corregir en caliente sobre una tabla con 100M filas.
2. **PostgreSQL es la fuente de verdad, no la aplicación.** Los constraints, triggers y RLS protegen los invariantes aunque la aplicación tenga bugs.
3. **La legibilidad del schema es documentación.** Un nombre ambiguo o un tipo incorrecto es deuda técnica que escala con el equipo.
4. **Los índices son contratos de performance.** Crear uno innecesario cobra RAM; omitir uno necesario cobra latencia. Ninguno sin justificación documentada.
5. **Multi-tenancy es física, no lógica.** org_id en cada tabla per-tenant + RLS como último guardian. No existe ningún tenant sin esa garantía.

---

## 2. Tipos de datos — reglas de uso

| Tipo | Cuándo usar | Cuándo NO usar | Alternativa |
|---|---|---|---|
| `UUID` | PKs, FKs, IDs expuestos en API | Claves de negocio legibles por humanos | `TEXT` con UNIQUE para business keys |
| `TEXT` | Strings de longitud variable: descripciones, notas, estados con evolución | Como sustituto de tipos estructurados cuando el valor es consultado con WHERE exacto | `TEXT CHECK(val IN (...))` o ENUM estable |
| `VARCHAR(n)` | Límite regulatorio fijo: RUT (12 chars), código ISO país (3 chars) | Strings de longitud real variable | `TEXT` |
| `BOOLEAN` | Flags binarios sin historial: activo, requiere_garantia, visible_cliente | Estado con más de dos valores posibles | `TEXT CHECK` |
| `NUMERIC(p,s)` | Montos, precios, descuentos, impuestos — nunca floats para dinero | Contadores enteros | `INTEGER` o `BIGINT` |
| `INTEGER` | Cantidades de stock, posición ordinal, versión | Montos monetarios | `NUMERIC(15,2)` |
| `TIMESTAMPTZ` | Todo momento en el tiempo: creado_en, cerrado_en, fecha_inicio_reparacion | `TIMESTAMP` sin zona — ambiguo bajo DST | Siempre TIMESTAMPTZ |
| `DATE` | Fecha pura sin hora: fecha_prometida_entrega, fecha_vencimiento_garantia | Momentos con hora — perder la hora rompe alertas | `TIMESTAMPTZ` |
| `JSONB` | Datos semiestructurados: configuracion_org, metadatos_migracion, diff en audit_log | Datos con estructura fija consultados con WHERE sobre subclave | Columnas tipadas |
| `BYTEA` | Binarios pequeños embebidos (firma digital <50KB) | Archivos > 1MB | Supabase Storage + URL en TEXT |

---

## 3. Estrategia de claves

### 3.1 Clave primaria — UUID v4 en MVP

`gen_random_uuid()` como DEFAULT en todas las PKs. Razones: generación en cliente sin round-trip, sin colisiones cross-tenant, sin exposición de volumen por enumeración secuencial.

**Límite conocido:** UUID v4 es pseudoaleatorio. El B-tree del índice de PK acumula page splits desde ~10–20M filas porque cada insert aterriza en una página aleatoria. Para `transiciones_evento`, que crece sin límite, este es un riesgo real a mediano plazo. **Plan V2:** migrar a UUIDv7 (ordenado por tiempo, tipo-compatible con UUID en PostgreSQL) en tablas que superen 5M filas. No impacta la API — el tipo en capa de datos y API sigue siendo UUID.

### 3.2 Business key vs. PK técnica

Coexisten siempre. La PK UUID es el identificador interno. La business key tiene UNIQUE constraint y es la referencia legible.

| Tabla | PK técnica | Business key | Alcance unicidad |
|---|---|---|---|
| vehiculos | id UUID | patente TEXT | Global (una patente = un vehículo en todo el sistema) |
| ordenes_trabajo | id UUID | numero_ot TEXT | Por tenant: UNIQUE(org_id, numero_ot) |
| repuestos | id UUID | codigo TEXT | Por tenant: UNIQUE(org_id, codigo) |
| clientes | id UUID | rut TEXT | Por tenant: UNIQUE(org_id, rut) |

### 3.3 Claves foráneas

**Regla base: `ON DELETE RESTRICT`** en todas las FKs. Nunca se pierde un padre con hijos vivos. El código de aplicación resuelve la dependencia primero.

`ON DELETE CASCADE` solo cuando se cumplen simultáneamente: (1) el hijo no tiene significado sin el padre, y (2) no existe ni existirá audit trail que referencie al hijo post-eliminación.

| FK | Nulabilidad | Razón |
|---|---|---|
| evidencias.evento_id | NOT NULL | Una evidencia sin evento es un dato huérfano inválido |
| eventos.orden_trabajo_id | NULL | Un evento puede existir antes de abrir la OT |
| items_presupuesto.repuesto_id | NULL | Ítem de mano de obra no referencia repuesto |
| movimientos_stock.orden_trabajo_id | NULL | Ajuste de inventario manual sin OT |

**Índice en toda FK — obligatorio y manual.** PostgreSQL no crea índice automático en columnas FK. Toda columna `*_id` que sea FK debe tener índice explícito. En multi-tenant, un FK sin índice causa seq-scan sobre filas de todos los talleres antes de que RLS las filtre.

### 3.4 Constraints y defaults

| Columna | Default | Invariante |
|---|---|---|
| id | `gen_random_uuid()` | La app nunca genera el UUID — riesgo de colisión o nulo |
| creado_en | `NOW()` | El servidor fija el timestamp — clock skew entre instancias serverless |
| actualizado_en | `NOW()` + trigger BEFORE UPDATE | Nunca escrito por la app — solo por el trigger compartido fn_set_updated_at() |
| org_id | Sin default — NOT NULL explícito | Ninguna fila per-tenant sin tenant asignado |

**TEXT + CHECK (no ENUM) para estados:** `ALTER TYPE ADD VALUE` en PG 12+ no bloquea, pero renombrar o eliminar un valor de ENUM sigue requiriendo `USING` con reescritura de la tabla. Los estados de OT y de evento tienen ciclos de vida que evolucionan — TEXT + CHECK permite cambiar la constraint sin tocar filas existentes.

---

## 4. Particionamiento

| Tabla | Estrategia | Criterio | Tamaño de partición | Desde | Razón |
|---|---|---|---|---|---|
| transiciones_evento | RANGE | creado_en | Trimestral | **Migration 001** | Append-only sin límite de crecimiento. Retro-particionar una tabla de 100M filas en producción es inviable. |
| audit_log | RANGE | created_at | Trimestral | **Migration 001** | Mismo patrón. Queries de auditoría son siempre por rango de fecha. |
| movimientos_stock | Diferida a V1 | fecha_movimiento | Trimestral | Migration 003 o posterior | Activar si supera 5M filas o queries de período degradan bajo 200ms con índice B-tree existente. |
| embeddings_diagnosticos | **No particionar** | — | — | — | pgvector HNSW construye el grafo sobre la tabla completa. Particionar fragmenta el espacio vectorial y destruye el índice global. |

**Nota crítica:** el particionamiento de `transiciones_evento` beneficia archivado y mantenimiento, no las queries más frecuentes (por vehiculo_id). El índice compuesto `(vehiculo_id, creado_en)` cubre esas queries independientemente de la partición. El partition pruning opera en queries con filtro sobre creado_en (reportes temporales, archivado).

---

## 5. Estrategia de índices

| Tipo | Para qué sirve | Ejemplo en este proyecto | Cuándo NO usar |
|---|---|---|---|
| **B-tree** | Igualdad, rango, ORDER BY (default) | (org_id, estado, creado_en) en ordenes_trabajo — dashboard diario | Columnas de texto largo, arrays, similitud |
| **GIN** | pg_trgm, tsvector, arrays, JSONB keys | clientes.nombre con gin_trgm_ops; eventos._fts con tsvector | Columnas de baja cardinalidad sin búsqueda textual |
| **BRIN** | Columnas con correlación física de inserción (append-only, datos cronológicos) | creado_en dentro de cada partición trimestral de transiciones_evento | Tablas con updates frecuentes o inserts desordenados — BRIN pierde efectividad |
| **HNSW** (pgvector) | Búsqueda ANN por similitud coseno | embeddings_diagnosticos.vector | No para búsquedas exactas ni tablas con < 500 vectores — overhead sin beneficio |
| **Partial index** | Subconjunto frecuente de filas | ordenes_trabajo donde estado NOT IN ('cerrada','cancelada') — OTs activas | Si el subset no es el 80%+ del acceso real |
| **Covering index** | Evitar heap access en queries de solo lectura | INDEX ON eventos(org_id, estado) INCLUDE (titulo, creado_en) — listado de dashboard | Si las columnas INCLUDE son muy anchas o se actualizan frecuentemente |

**Regla de oro:** todos los índices de negocio son índices parciales con `WHERE eliminado_en IS NULL`. Los registros soft-deleted no participan en queries operacionales — no deben inflar los índices.

**Anti-patrones prohibidos:**
- Índice en columna booleana sin condición WHERE (cardinalidad 2 — inútil)
- Índice en org_id sola (siempre va compuesto con al menos una columna más)
- GIN en columna que nunca usa LIKE, @@, @> ni operadores de similitud
- Índice en columna que nunca aparece en WHERE, JOIN, ORDER BY

---

## 6. JSONB — cuándo sí, cuándo no

| Caso de uso | JSONB | Razón |
|---|---|---|
| configuracion_org (notificaciones, moneda, zona horaria) | Sí | Heterogénea por org; sin filtrado por subclave |
| metadatos_migracion (tallergp_id, tallergp_url_original, migrado_en) | Sí | Único por registro migrado; esquema irregular entre versiones de TallerGP |
| cambios en audit_log (before/after) | Sí | Heterogéneo por tabla auditada; consultado completo, nunca filtrado por subclave |
| Estado de un evento | No | Filtrado frecuente en WHERE → columna TEXT CHECK |
| Precios, totales, descuentos | No | Calculados, agregados en reportes → columnas NUMERIC |
| Razón de cancelación | No | Texto breve, aparece en filtros de reporte → columna TEXT |

**Regla:** si cualquier subclave del JSONB aparece en un `WHERE`, `ORDER BY`, `GROUP BY` o es requisito de un índice → columna tipada, no JSONB.

---

## 7. Auditoría e inmutabilidad

### 7.1 Tablas inmutables

| Tabla | Tipo | Regla |
|---|---|---|
| transiciones_evento | Append-only | Solo INSERT. UPDATE y DELETE bloqueados por RLS + trigger simultáneamente |
| audit_log | Append-only | Solo INSERT vía función SECURITY DEFINER. Ningún rol puede UPDATE/DELETE |
| movimientos_stock | Append-only | Solo INSERT. Correcciones = nuevo movimiento de signo inverso |

### 7.2 Columnas de auditoría — per-tenant operacional

Toda tabla per-tenant operacional tiene: `creado_en`, `actualizado_en` (trigger), `creado_por` FK usuarios, `eliminado_en` TIMESTAMPTZ NULL, `eliminado_por` FK usuarios nullable.

### 7.3 Los tres triggers críticos

**Trigger 1 — Inmutabilidad de eventos cerrados** (BEFORE UPDATE en eventos): si `OLD.cerrado_en IS NOT NULL` y el UPDATE modifica cualquier campo técnico excluyendo `visible_cliente` → RAISE EXCEPTION. Implementado como función SECURITY DEFINER para que no pueda ser saltado por permisos de rol.

**Trigger 2 — Anti-ciclo en referencias_evento** (BEFORE INSERT): CTE recursiva que sigue la cadena de `referenciado_id` hasta 50 niveles. Si el `evento_id` nuevo aparece en la cadena → RAISE EXCEPTION. **Requiere advisory lock** sobre el `evento_id` raíz del grafo para evitar race condition TOCTOU bajo inserciones concurrentes: dos transacciones pueden leer el mismo estado del grafo antes de que la otra confirme, pasando ambas el check y creando un ciclo real.

**Trigger 3 — actualizado_en** (BEFORE UPDATE en todas las tablas per-tenant operacionales): `NEW.actualizado_en = NOW()`. Función compartida `fn_set_updated_at()` referenciada desde múltiples triggers.

### 7.4 PII en audit_log

El campo `cambios JSONB` en audit_log contiene el diff before/after. Antes de insertar, el trigger inspector hashea (SHA-256) los valores de campos PII conocidos (`rut`, `nombre`, `telefono`, `email`). El hash preserva la capacidad de verificar que dos registros tenían el mismo valor sin revelar cuál era. Nunca se persiste PII en claro en audit_log.

### 7.5 PII en tsvector generado

La columna `_fts GENERATED ALWAYS AS (...) STORED` se regenera automáticamente cuando se actualizan los campos fuente. Anonimizar la columna fuente y luego hacer UPDATE regenera el tsvector sin PII. Sin embargo, `_fts` debe excluirse explícitamente de exportaciones de compliance hasta confirmar que el fuente fue anonimizado.

---

## 8. Multi-tenant y RLS

### 8.1 Categorías de tablas

| Categoría | Tiene org_id | RLS | Ejemplos |
|---|---|---|---|
| Per-tenant operacional | Sí | SELECT+WRITE por org_id+rol | vehiculos, clientes, eventos, presupuestos |
| Per-tenant append-only | Sí | Solo INSERT | transiciones_evento, audit_log |
| Catálogos globales | No | SELECT público | roles, tipos_evento_base, modelos_vehiculos |
| Auth | No aplica | Supabase Auth gestiona | auth.users, auth.sessions |

### 8.2 Los 3 patrones RLS

1. **Lectura por tenant:** `org_id = mi_org_id()`. Si el JWT es inválido, `mi_org_id()` retorna NULL → el usuario ve vacío, no error explícito.
2. **Escritura por rol:** `org_id = mi_org_id() AND mi_rol() IN ('admin', 'editor', 'recepcion')`. El rol `mecanico` solo accede vía security-barrier views.
3. **Append-only:** solo política INSERT. UPDATE y DELETE retornan FALSE incondicional o no están definidas.

### 8.3 Funciones SECURITY DEFINER

`mi_org_id()` y `mi_rol()` llevan `SET search_path = public`. Sin esto, un usuario malicioso puede crear un objeto homónimo en su propio schema — PostgreSQL resolvería el nombre usando los objetos falsos y retornaría un `org_id` arbitrario, bypasseando RLS completamente. El valor siempre proviene de `auth.jwt()` — nunca del request body.

---

## 9. Búsqueda y IA — convenciones físicas

**pg_trgm (GIN):** clientes.nombre, clientes.rut, vehiculos.patente, repuestos.nombre, repuestos.codigo.

**tsvector generado:** columna `_fts GENERATED ALWAYS AS (to_tsvector('spanish', ...)) STORED` en eventos, diagnosticos, repuestos. El índice GIN va sobre `_fts`, nunca sobre el texto original. El diccionario `spanish` requiere la extensión `unaccent` instalada en Migration 001.

**pgvector (HNSW, coseno, dimensión 1536):** tabla `embeddings_diagnosticos`. Dimensión fija desde el primer día — cambiarla requiere recrear el índice completo. HNSW no requiere entrenamiento previo (a diferencia de IVFFlat). Búsqueda filtrada por `org_id` antes del ANN scan para evitar contaminación cross-tenant.

---

## 10. Convenciones SQL (naming)

| Elemento | Convención | Ejemplo |
|---|---|---|
| Tablas | snake_case, plural | ordenes_trabajo, transiciones_evento |
| Columnas | snake_case | creado_en, orden_trabajo_id |
| PKs | Siempre `id` | id UUID |
| FKs | `{tabla_singular}_id` | vehiculo_id, orden_trabajo_id |
| Funciones internas (triggers, audit) | Prefijo `fn_` | fn_set_updated_at(), fn_audit_insert() |
| Funciones RLS-facing (invocadas en policies) | Sin prefijo, nombre semántico | mi_org_id(), mi_rol(), mi_sucursal_id() |
| Triggers | Prefijo `trg_` | trg_inmutabilidad_evento, trg_anti_ciclo_refs |
| Vistas | Prefijo `v_` | v_clientes_mecanico, v_historial_tecnico_ia |
| Materialized views | Prefijo `mv_` | mv_dashboard_ots_activas |
| Schemas | Solo `public` para dominio + `auth` de Supabase | No crear schemas adicionales en MVP |
| Índices | `idx_{tabla}_{columnas}` | idx_eventos_org_estado, idx_vehiculos_patente_trgm |
| Constraints | `chk_{tabla}_{columna}` | chk_eventos_estado |

---

## 11. Roadmap de migrations

| Migration | Qué incluye | Dependencias |
|---|---|---|
| **001 — Foundation** | Extensiones (uuid-ossp, pg_trgm, unaccent, pgcrypto, vector). Funciones: mi_org_id(), mi_rol(), mi_sucursal_id(), fn_set_updated_at(), fn_audit_insert(). Tablas: organizaciones, usuarios, roles, permisos_rol, tipos_evento_base. Particionamiento: transiciones_evento y audit_log con particiones desde 2020 hasta Q1 2027. Seed: roles base, tipos_evento_base. | Ninguna |
| **002 — Vehículos y Eventos** | vehiculos, historias_tecnicas, propietarios_vehiculo, clientes, conductores. tipos_evento (per-tenant). eventos, referencias_evento. Triggers: anti-ciclo en referencias_evento. Índices: GIN pg_trgm en clientes.nombre, clientes.rut, vehiculos.patente. | 001 |
| **003 — OT y Flujo Operacional** | ordenes_trabajo, presupuestos, items_presupuesto, reparaciones, items_reparacion, entregas, citas, evidencias, garantias. Triggers: inmutabilidad de eventos cerrados. Índices B-tree compuestos para dashboard. | 002 |
| **004 — Inventario y Facturación** | repuestos, proveedores, movimientos_stock, facturas, items_factura. | 003 |
| **005 — Migración TallerGP (DDL)** | Tablas staging: _tallergp_id_map, _tallergp_clientes, _tallergp_vehiculos, _tallergp_ordenes, _tallergp_facturas. | 003 |
| **006 — Vistas y Búsqueda** | v_clientes_mecanico (security_barrier), v_items_presupuesto_mecanico (security_barrier), v_historial_tecnico_ia. Columnas _fts tsvector en eventos, diagnosticos, repuestos. Índices GIN tsvector. pgvector HNSW (si V1 activado). | 004, 005 |

**Por qué DDL de dominio y ETL de TallerGP en migrations separadas:** si el ETL falla a mitad, el rollback de la migration solo afecta las tablas staging — no elimina inventario ni facturación que ya están listos para producción.

---

## 12. Riesgos conocidos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| UUID v4 B-tree degradación a >10M filas en transiciones_evento | Alto | Planificar migración a UUIDv7 en V2 antes de alcanzar ese umbral |
| RANGE trimestral no ayuda queries por vehiculo_id | Medio | Índice compuesto (vehiculo_id, creado_en) cubre esas queries independientemente de la partición |
| TOCTOU en trigger anti-ciclo bajo inserciones concurrentes | Medio | Advisory lock por evento raíz antes de ejecutar la CTE recursiva |
| PII en tsvector sin regenerar tras anonimización | Medio | Proceso de anonimización actualiza la columna fuente → GENERATED ALWAYS regenera automáticamente. Excluir _fts de exports de compliance hasta confirmar. |
| Migration 005 (TallerGP staging) con datos corruptos bloquea cutover | Medio | Script de validación pre-cutover: conteos, checksums PDF, integridad FK cruzada. Cutover solo cuando 3 checks pasen. |
| TEXT+CHECK más difícil de refactorizar si los estados cambian de nombre | Bajo | Documentar estados permitidos en este archivo como fuente de verdad. Cambios de nombre requieren migration explícita + update de datos. |

---

*Este documento son las decisiones físicas de All Motors Cloud.*
*Ninguna migración SQL se escribe sin que cada decisión de tipo, índice, constraint y particionamiento pueda trazarse hasta una sección documentada aquí.*
*Modificaciones requieren revisión del Architecture Board.*
