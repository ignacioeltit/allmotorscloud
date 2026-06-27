# Persistence Architecture — All Motors Cloud

**Estado:** Oficial (Night Build — Physical Persistence Architecture Board, Junio 2026)
**Versión:** 1.0
**Última actualización:** Junio 2026
**Propósito:** Referencia completa de la estrategia de almacenamiento. Toda decisión sobre dónde y cómo guardar datos debe trazarse hasta aquí.

---

## 1. Filosofía de persistencia

**Una capa por tipo de acceso.** Cada mecanismo de almacenamiento tiene una razón de ser. Guardar el dato en la capa equivocada produce ineficiencia o inconsistencia, no redundancia beneficiosa.

| Capa | Para qué sirve | Regla de decisión |
|---|---|---|
| **PostgreSQL** | Datos estructurados con integridad referencial, visibilidad por RLS, consistencia transaccional | Si necesita `WHERE`, `JOIN`, o pertenecer a un tenant → PostgreSQL |
| **Object Storage** | Binarios opacos de tamaño variable accedidos por referencia | Si el dato es un archivo y no se filtra por contenido → Storage |
| **Cache** | Lecturas costosas o frecuentes que toleran staleness controlada | Si se lee 10× por cada escritura y tiene TTL razonable → Cache |
| **Índice de búsqueda** | Búsqueda por similitud, texto libre o semántica | Si la consulta es por relevancia y no por igualdad exacta → índice especializado |

**Lo que no se duplica:** un dato tiene una fuente de verdad. Cache e índices son derivados. Si se pierden, se reconstruyen. Si se pierde el origen, no hay recuperación.

---

## 2. PostgreSQL — datos de dominio

### 2.1 Criterio de pertenencia

Un dato pertenece a PostgreSQL si cumple al menos uno:
- Requiere integridad referencial (FK a otro dato de dominio)
- Su acceso debe estar controlado por tenant (org_id + RLS)
- Debe ser auditable con causalidad (quién lo cambió, cuándo, desde qué estado)
- Participa en transacciones que deben ser atómicas

### 2.2 Clases de datos

| Clase | Ejemplos | Escritura | Lectura | Particionamiento |
|---|---|---|---|---|
| **Dominio transaccional** | vehículos, clientes, OTs, presupuestos, reparaciones, garantías | Browser Client directo | Por org_id + filtros de dominio | No requerido en MVP |
| **Log inmutable — técnico** | transiciones_evento | Append-only. Sin UPDATE/DELETE. | Por rango de fecha + vehiculo_id | **Obligatorio desde Migration 001** — por `creado_en` |
| **Log inmutable — acciones** | audit_log | Solo INSERT via función SECURITY DEFINER | Por org_id + rango de fecha | **Obligatorio desde Migration 001** — por `created_at` |
| **Catálogos per-tenant** | tipos_evento, repuestos, modelos_vehiculo del taller | Admin del taller + seed inicial | Frecuente, cacheable TTL 1h | No |
| **Catálogos globales** | roles, tipos_evento_base, marcas_vehiculo | Solo migraciones | Solo lectura por todos los tenants | No |
| **Referencias a archivos** | tabla evidencias (path + evento_id NOT NULL) | Al confirmar upload exitoso en Storage | Por evento_id o OT | No |
| **Migración temporal** | tablas staging de TallerGP | Pipeline de ingesta | Solo durante migración | No — se purgan a 90 días |
| **Embeddings IA** *(V1+)* | embeddings_diagnosticos (pgvector) | Tras generar diagnóstico | Búsqueda por coseno | No — índice HNSW propio |

### 2.3 Datos que nunca deben perderse

- La cadena completa de `transiciones_evento` de cualquier OT — historial legal de lo ocurrido
- Las autorizaciones de presupuesto — definen responsabilidad legal del cliente por el trabajo encargado
- La cadena OT → Factura → Pago — soporte contable obligatorio
- El historial de propietarios del vehículo — determina responsabilidad de garantías
- Las garantías activas y sus condiciones — exposición económica del taller

### 2.4 Datos que no pertenecen a PostgreSQL

| Dato | Por qué no va en PostgreSQL |
|---|---|
| Archivos binarios (fotos, PDF, video) | Sin filtrado por contenido; tamaño variable; acceso esporádico |
| Sesiones JWT activas | Gestionadas por Supabase Auth; efímeras por diseño |
| Signed URLs cacheadas de Storage | Derivadas, regenerables, TTL corto |
| Resultados intermedios de jobs de cron | Efímeros — solo importa el resultado final |

### 2.5 Particionamiento — no negociable

`transiciones_evento` es append-only y crece de forma proporcional a toda la actividad de todos los tenants, para siempre. `audit_log` tiene la misma propiedad. Ambas se crean particionadas desde **Migration 001**. Convertir una tabla activa a particionada en producción requiere recrearla con riesgo de downtime. El costo de hacerlo bien en Migration 001 es cero; en producción con datos reales, es prohibitivo.

---

## 3. Object Storage — archivos y evidencias

### 3.1 Estructura de buckets

| Bucket | Contenido | Visibilidad | Path canónico | TTL signed URL |
|---|---|---|---|---|
| `evidencias` | Fotos, videos diagnóstico/recepción/entrega, firmas, archivos OBD | Privado | `{org_id}/{vehiculo_id}/{event_id}/{uuid}.ext` | 1 hora |
| `documentos-pdf` | Presupuestos, facturas, certificados | Privado | `{org_id}/{tipo}/{doc_id}/{uuid}.pdf` | 1 hora |
| `exportaciones-pdf` | Reportes on-demand regenerables | Privado, auto-purge | `{org_id}/exports/{uuid}.pdf` | 15 minutos |
| `migracion-tallergp` | PDFs históricos re-alojados desde CDN TallerGP | Privado | `{org_id}/legacy/{uuid}.ext` | 1 hora |

### 3.2 Política de acceso

Las Signed URLs solo se generan en servidor, previa validación de JWT y verificación de que el `org_id` del path coincide con el tenant del solicitante. No existen URLs públicas permanentes. Una URL pública de una evidencia equivale a acceso sin autenticación — exposición legal y violación de privacidad del cliente del taller.

**Optimización de costo:** la tabla `evidencias` incluye `signed_url_cache` y `url_expires_at`. El servidor verifica si la URL existente sigue vigente antes de generar una nueva. Esto elimina llamadas innecesarias a Storage API cuando un técnico revisa el mismo expediente múltiples veces en una sesión. Sin esto, 20 fotos × 500 orgs × 10 técnicos = 100K llamadas/día solo para URLs.

### 3.3 Versionado de archivos

Las evidencias son **inmutables**. Una foto no se reemplaza — se agrega una nueva evidencia con nuevo uuid y nuevo registro en la tabla. Los documentos con versión lógica (presupuesto v2, factura corregida) usan campo `version` en la tabla correspondiente. La versión anterior se preserva como audit trail. El campo `version_actual = true` apunta al documento vigente.

### 3.4 Retención de archivos

| Tipo | Retención mínima | Razón |
|---|---|---|
| Fotos de recepción / diagnóstico / entrega | Vida del vehículo en el sistema | Garantías, disputas, responsabilidad civil |
| Facturas y presupuestos PDF | 6 años desde emisión | Ley 20.780, obligación SII |
| Firmas digitales de autorización | Vida del vehículo + 3 años | Consentimiento informado, disputas post-garantía |
| Videos de diagnóstico | 1 año o fin de garantía asociada | Referencia técnica |
| Archivos OBD / scanner | Vida del vehículo | Historial de diagnósticos electrónicos |
| Exportaciones PDF on-demand | 15 minutos (auto-purge) | Regenerables; no son documentos de registro |

### 3.5 Migración de CDN TallerGP

1. GET desde CDN CloudFront + registro de URL original
2. SHA-256 del binario descargado
3. Upload al bucket `migracion-tallergp` con path canónico
4. Re-descarga desde Supabase + verificación de checksum idéntico
5. Persistir `tallergp_url_original` como campo en la tabla de documentos
6. Dar de baja TallerGP solo cuando 100% de archivos estén validados

### 3.6 Georeplica

Obligatoria antes del primer cliente en producción. Migrar datos con un cliente activo crea una ventana de pérdida irrecuperable de evidencias legales. Target: RTO < 4h, RPO < 1h.

---

## 4. Cache

### 4.1 ¿Redis en MVP?

**No.** El sistema puede operar hasta ~500 talleres con el Router Cache de Next.js (TTL 30s, invalidado por triple mecanismo) más el manejo nativo de JWT claims de Supabase Auth, que ya inyecta `org_id` y `rol` en la sesión de PostgreSQL. `mi_org_id()` lee del JWT claim — no hace lookup por fila en cada evaluación de RLS. Redis no se justifica hasta que el profiling confirme un cuello de botella concreto.

### 4.2 Candidatos a cache

| Dato | Por qué cachear | TTL | Invalidación | Fase |
|---|---|---|---|---|
| Roles globales del sistema | Inmutables entre deploys | 24h | Deploy / migración de schema | MVP |
| Signed URLs de evidencias | Evitar N llamadas a Storage API por expediente | TTL de la URL (< 1h) | Al expirar `url_expires_at` | MVP |
| `tipos_evento` per-tenant | Cambia raramente; leído en cada apertura de OT | 1h | Al editar catálogo del taller | V1 |
| `repuestos_frecuentes` per-tenant | Hot path en apertura de presupuesto | 15 min | Al crear/editar repuesto | V1 |
| Historial técnico reciente por patente | Búsqueda por patente es el hot path de recepción | 5 min | Al crear nueva OT sobre ese vehículo | V1 |

### 4.3 Datos que NO deben cachearse

- Estado actual de una OT — cambia por transiciones en tiempo real; cache introduce inconsistencia visible al técnico
- `transiciones_evento` recientes — son el log de auditoría; omitir una es un problema legal
- Datos financieros (totales de factura, pagos) — RLS los protege; cache que bypasea RLS rompe aislamiento entre tenants
- Disponibilidad de mecánicos — mutable por turno; falso positivo produce asignaciones erróneas

### 4.4 Plan de adopción Redis/Upstash (V1)

Activar cuando cualquiera de estas condiciones se cumpla:
- Latencia media del dashboard supera 800ms en Vercel Analytics con >200 talleres activos simultáneos
- El connection pool de Supabase muestra saturación sostenida en horas peak
- Se implementa rate-limiting por taller en la API (requiere contador distribuido)

El primer uso es Upstash (serverless, pago por request): contador de rate-limit y cache de catálogos. No Redis gestionado propio.

---

## 5. Búsqueda

### 5.1 Estrategia por entidad

| Entidad | Tipo de búsqueda | Tecnología | Fase |
|---|---|---|---|
| Vehículo por patente exacta | Exacta | B-tree index | MVP |
| Vehículo por patente parcial | Fuzzy / parcial | pg_trgm (GIN) | MVP |
| Cliente por nombre | Fuzzy + parcial | pg_trgm (GIN) | MVP |
| Cliente por RUT | Exacta / parcial por dígitos | B-tree + ilike | MVP |
| Diagnóstico por síntoma (texto) | Full-text search | FTS con tsvector (diccionario español) | MVP |
| Repuesto por código | Exacta | B-tree index | MVP |
| Repuesto por nombre | Parcial + fuzzy | pg_trgm (GIN) | MVP |
| Historial técnico por tipo de evento | Filtro + FTS en notas | Enum filter + FTS | MVP |
| Diagnóstico semántico (síntoma → casos similares) | Semántica por similitud | pgvector (cosine similarity) | V1 |

### 5.2 Regla de decisión

- **pg_trgm**: el usuario no sabe la ortografía exacta o el formato completo. Opera sobre caracteres, sin entrenamiento.
- **FTS (tsvector)**: el texto es una frase o párrafo y el usuario busca por concepto. Requiere diccionario en español configurado.
- **pgvector**: la intención semántica importa más que las palabras. "Motor hace ruido al frenar" debe encontrar "vibración en discos traseros". Requiere embeddings pre-generados.

### 5.3 ¿Elasticsearch o Typesense?

No se justifica en ninguna fase proyectada. Los tres umbrales que lo activarían: (1) >5M filas de diagnósticos con FTS degradado bajo 200ms con GIN, (2) búsqueda facetada compleja con ranking personalizado, (3) highlighting de fragmentos en documentos largos. Agotar pg_trgm + FTS + particionamiento por org_id antes de evaluar motor externo.

### 5.4 Catálogos cross-tenant

Dos tablas globales de solo lectura (sin org_id): `catalog_repuestos` (códigos OEM, nombres canónicos) y `modelos_vehiculos` (marca, modelo, año). La búsqueda las usa como sugerencia cuando el tenant no tiene coincidencia en su inventario propio.

### 5.5 Degradación graceful

Si pgvector no está disponible o el corpus del tenant tiene < 50 diagnósticos, la UI presenta automáticamente resultados de FTS sin exponer el fallo. El umbral de corpus mínimo es configurable por tenant.

---

## 6. Inteligencia Artificial — capa de datos

### 6.1 Mapa de almacenamiento

| Tipo de dato | Dónde vive | Retención | Fase |
|---|---|---|---|
| Embeddings de diagnósticos | Tabla `embeddings_diagnosticos` (pgvector) | Permanente | V1 |
| Corpus de entrenamiento | Vista `v_historial_tecnico_ia` (solo lectura) | Derivada de la DB transaccional | V1 |
| Cola de eventos IA | Tabla `cola_eventos_ia` con clave de idempotencia | 30 días post-procesado | V1 |
| Sugerencias generadas al usuario | Tabla `sugerencias_ia` | Permanente | V1 |
| Feedback mecánico (aceptó/rechazó) | Tabla `feedback_sugerencias` | Permanente | V2 |
| Memoria de conversación IA | Tabla `conversaciones_ia` (prevista) | 90 días | V2 |

### 6.2 Separación tenant en embeddings

Los embeddings se almacenan con `org_id`. La búsqueda RAG opera en dos capas: (1) corpus del mismo tenant (prioritario), (2) corpus global anónimo si el tenant tiene < 50 diagnósticos. El corpus global no expone `org_id`, patente ni datos de cliente.

### 6.3 Cola de eventos IA — deduplicación obligatoria

`cola_eventos_ia` tiene clave de idempotencia: hash de `(evento_id + tipo_procesamiento)`. Si un evento ya fue procesado (`processed_at` no nulo), la Edge Function descarta el duplicado silenciosamente. Sin esta guardia, un trigger que se dispara dos veces genera dos embeddings para el mismo diagnóstico y corrompe el corpus de búsqueda semántica.

### 6.4 Datos de IA que nunca deben perderse

- **Feedback de mecánicos** — cada aceptación/rechazo es señal de aprendizaje irreproducible
- **Sugerencias entregadas al usuario** — si el mecánico tomó una decisión basada en una sugerencia, eso es parte del historial técnico con implicancias de garantía
- **Definición de `v_historial_tecnico_ia`** — es el contrato entre la DB transaccional y la capa IA; una migración que la rompa sin versión alternativa lista es un incidente crítico

Los embeddings son regenerables desde el corpus fuente — importantes, pero no irreemplazables.

---

## 7. Auditoría e inmutabilidad

### 7.1 Mapa de mutabilidad

| Tipo de dato | ¿Modificable? | ¿Hard delete? | ¿Anonimizable? | Mecanismo |
|---|---|---|---|---|
| Evento con `cerrado_en` no nulo | No (campos técnicos). Excepción: `visible_cliente` | No | No | Immutabilidad por RLS + trigger |
| `transiciones_evento` | No | No | No | Tabla append-only sin políticas UPDATE/DELETE |
| `audit_log` | No | No | No | Solo INSERT via función SECURITY DEFINER |
| PII del cliente (RUT, nombre, email, teléfono) | Sí (por administrador del taller) | No — se anonimiza | **Sí, obligatorio a pedido** | UPDATE que reemplaza por valores anónimos irreversibles |
| Facturas y presupuestos | Soft-delete solo (`eliminado_en`) | No | No | Restricción contable y legal |
| Archivo binario en Storage | Registro en DB persiste siempre. Binario eliminable solo si retención venció + solicitud. | Solo el binario, con condiciones | Registro queda con `path = NULL` | Proceso controlado por administrador |
| Tablas staging de migración | Sí (durante el proceso) | **Sí — a 90 días post-validación** | No aplica | Auto-purge por job de cron |

### 7.2 Regla de hard delete

La única excepción al "nunca hard delete" es el archivo binario en Storage cuya retención mínima venció **más** solicitud explícita documentada del cliente (derecho de supresión, Ley 19.628). El registro en tabla `evidencias` permanece con `path = NULL`. El historial técnico del vehículo no se borra — solo se desvincula de la identidad de la persona.

### 7.3 Anonimización de PII

Al recibir una solicitud de supresión, los campos PII del cliente se reemplazan de forma irreversible: RUT → hash SHA-256 sin sal reversible, nombre / teléfono / email → NULL. El historial técnico del vehículo permanece intacto y vinculado al vehículo, pero desvinculado de la identidad de la persona. La garantía es que sin acceso externo al VIN o patente, no puede reconstruirse la identidad.

---

## 8. Retención y ciclo de vida

| Dato | Retención mínima | Qué ocurre al vencer |
|---|---|---|
| Fotos recepción, diagnóstico, entrega | Vida del vehículo en el sistema | Eliminable solo con solicitud de supresión |
| Facturas y presupuestos PDF | 6 años desde emisión (SII, Ley 20.780) | Archivado frío en Storage de bajo costo |
| Firmas digitales de autorización | Vida del vehículo + 3 años | Archivado frío |
| Videos de diagnóstico | 1 año o fin de garantía asociada | Evaluación de eliminación |
| Archivos OBD / scanner | Vida del vehículo | Archivado frío |
| `audit_log` filas | 7 años (responsabilidad civil comercial) | Exportación a Storage fría; eliminación de PostgreSQL activo |
| `transiciones_evento` | Permanente en DB activa por 5 años; luego archivado frío | Particiones antiguas exportadas y eliminadas de PostgreSQL activo |
| PII de cliente inactivo | Relación activa + 5 años de inactividad | Anonimización irreversible |
| Tablas staging TallerGP | 90 días post-migración validada | Hard delete con confirmación de administrador |
| Exportaciones PDF on-demand | 15 minutos | Auto-purge en bucket |

---

## 9. Multi-tenant y aislamiento

- `org_id` obligatorio en todas las tablas per-tenant, NOT NULL
- `mi_org_id()` lee del JWT claim inyectado por Supabase Auth — no hace lookup en tabla `usuarios` por cada evaluación de RLS
- RLS policy base en todas las tablas per-tenant: `org_id = mi_org_id()`
- Catálogos globales (`roles`, `modelos_vehiculos`, `catalog_repuestos`) no tienen `org_id` y son de solo lectura para todos los tenants
- Buckets de Storage segmentados por `org_id` en el path — el servidor valida que el `org_id` del path coincide con el tenant del JWT antes de generar cualquier Signed URL
- `embeddings_diagnosticos` tiene `org_id` — la búsqueda cross-tenant del corpus anónimo se hace sobre una vista que proyecta solo campos no identificadores

---

## 10. Backup y recuperación

### 10.1 Estrategia general

- **DB**: backups automáticos de Supabase (diarios, retención 7 días en Pro, 30 días en Enterprise). Point-in-time recovery disponible en Pro+.
- **Storage**: georeplica activa antes del primer cliente en producción. RTO < 4h, RPO < 1h.
- **Logs de larga retención**: exportación periódica de particiones antiguas de `audit_log` y `transiciones_evento` a Storage de bajo costo antes de eliminarlas de PostgreSQL activo.

### 10.2 Lo que puede reconstruirse sin pérdida

Si se pierde, se regenera:
- Índices GIN (pg_trgm, FTS) — con REINDEX
- Embeddings en pgvector — desde el corpus de diagnósticos
- Vistas materializadas y `v_historial_tecnico_ia` — derivadas de las tablas base
- Signed URLs cacheadas — desde Storage
- Cache de catálogos (Router Cache, Redis futuro)

### 10.3 Lo que nunca puede perderse

| Dato | Por qué es irrecuperable si se pierde |
|---|---|
| `transiciones_evento` | Historia técnica legal — sin ella no hay trazabilidad |
| `audit_log` | Registro de quién hizo qué — sin él no hay respuesta a incidentes |
| Facturas y autorizaciones de presupuesto | Obligación contable y legal; sin ellas el taller no puede acreditar cobros |
| Archivos de evidencias dentro de retención activa | Soporte físico de garantías y disputas; irrecuperable |
| Feedback de mecánicos (`feedback_sugerencias`) | Señal de aprendizaje de IA irreproducible |

---

## 11. Roadmap de persistencia

### MVP — stack mínimo operacional

- PostgreSQL: todas las tablas del dominio, `transiciones_evento` y `audit_log` particionados desde Migration 001
- Object Storage: bucket `evidencias` + `documentos-pdf`, ambos privados, georeplica activa antes de go-live
- Cache: Next.js Router Cache + campos `signed_url_cache` / `url_expires_at` en tabla `evidencias`
- Búsqueda: pg_trgm (clientes, vehículos, repuestos) + FTS tsvector español (diagnósticos)
- Auditoría: `transiciones_evento` + `audit_log` append-only operativos desde migration 001

### V1 — búsqueda semántica + cache activo

- pgvector: `embeddings_diagnosticos`, `cola_eventos_ia` con idempotencia, `sugerencias_ia`
- Vista `v_historial_tecnico_ia` definida como contrato formal
- Cache de catálogos per-tenant con invalidación explícita
- Redis/Upstash: solo si profiling confirma cuello de botella
- Exportación de particiones `audit_log` y `transiciones_evento` > 2 años a cold tier

### V2 — IA avanzada + cumplimiento enterprise

- `feedback_sugerencias` activo para señal de aprendizaje
- `conversaciones_ia` para memoria de sesión (90 días TTL)
- Integración `lecturas_odometro` (PA10) en vista IA y metadata de embeddings
- Cifrado a nivel columna para PII (RUT, teléfono) — activado por primer tenant enterprise o auditoría externa
- API de exportación de datos per-tenant (portabilidad, cumplimiento regulatorio)

---

## 12. Riesgos conocidos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| `audit_log` y `transiciones_evento` sin particionamiento → tabla gigante en 3 años | Alto | **Particionamiento obligatorio en Migration 001.** Índice compuesto `(org_id, created_at)`. Archivado frío a 7 años. |
| Storage API cost por Signed URLs sin cache | Medio | Campos `signed_url_cache` + `url_expires_at` en `evidencias` desde Migration 001. Regenerar solo si expiró. |
| `cola_eventos_ia` con duplicados silenciosos | Medio | Clave de idempotencia `(evento_id, tipo_procesamiento)` + campo `processed_at`. |
| pgvector no es portable entre providers | Medio | Es extensión estándar PostgreSQL — migrar a RDS/Aurora con pgvector es factible. Exportar embeddings como JSON antes de cualquier migración de provider. |
| Supabase como único vendor (Storage + DB + Auth) | Alto | Aceptado en MVP. Mitigación V1: georeplica de Storage. Mitigación V2: evaluación de réplica de lectura independiente. |
| Archivado frío sin proceso definido → Storage de PostgreSQL activo crece sin límite | Medio | Definir job de archivado en V1 antes de que las tablas inmutables superen 50M filas. |

---

*Este documento es la referencia de persistencia de All Motors Cloud.*
*Toda decisión sobre dónde almacenar, cuánto tiempo retener, y cómo acceder a los datos debe trazarse hasta aquí.*
*Modificaciones requieren revisión del Architecture Board.*
