# System Architecture — All Motors Cloud

**Estado:** Oficial (Night Build — System Architecture Design Board, Junio 2026)  
**Versión:** 1.0  
**Última actualización:** Junio 2026  
**Propósito:** Constitución técnica del software. Todo documento de implementación debe trazarse hasta aquí.

---

## 1. Filosofía de evolución (10 años)

All Motors Cloud es el sistema operativo de un taller mecánico, no una app de formularios. El sistema crece desde un monolito operacionalmente sólido hasta una plataforma con módulos de IA y API pública, sin rediseñar el núcleo.

**Principios que no cambian con el tiempo:**

1. **El vehículo y su Historia Técnica son el activo central.** Todo lo demás es soporte.
2. **El mecánico no es un operador de sistema.** Cada campo adicional es tiempo de reparación perdido.
3. **Ningún dato se pierde.** La inmutabilidad del historial no es una opción.
4. **La seguridad es multicapa.** La aplicación puede tener bugs. La DB no puede ceder.
5. **La arquitectura creció desde un taller real.** Cada complejidad añadida debe justificarse con un problema real de ese taller.

---

## 2. Patrón arquitectónico

**Monolito modular** — un único repositorio, un único deploy por aplicación web, con límites de módulo internamente respetados.

| Por qué no microservicios | Por qué no monolito puro |
|---|---|
| Latencia de red entre servicios tiene cero beneficio para un solo taller en MVP | Sin límites internos, el código se enreda conforme crece |
| El equipo es pequeño: la complejidad operacional destruye velocidad | Módulos sin contratos claros impiden extraer IA o API cuando sea necesario |
| Los dominios comparten PostgreSQL y no tienen requerimientos de escala independiente | — |

Cuando un módulo específico (IA de diagnóstico, facturación electrónica SII) justifique extracción por escala o aislamiento de secretos, se extrae como servicio independiente sin rediseñar el resto.

---

## 3. Módulos del sistema

Cada módulo tiene un propósito único, límites claros, y se comunica via eventos persistidos — no por llamadas directas entre módulos.

| Módulo | Propósito | Eventos publicados | Eventos consumidos |
|---|---|---|---|
| **Vehículos / Historia** | Registro de activos y biografía técnica completa | `vehiculo.creado`, `historia.actualizada` | `ot.cerrada`, `entrega.confirmada` |
| **Eventos / Transiciones** | Motor de estado del sistema. Valida y persiste cada cambio de estado. | `evento.registrado`, `estado.cambiado` | Todos los eventos del dominio |
| **OT / Flujo** | Ciclo de vida de la Orden de Trabajo (Recepción→Entrega) | `ot.creada`, `ot.etapa_cambiada`, `ot.cerrada` | `presupuesto.autorizado`, `qc.aprobado` |
| **Presupuesto** | Cotización, versiones y autorización del cliente | `presupuesto.autorizado`, `presupuesto.rechazado` | `ot.creada`, `diagnostico.completado` |
| **Reparación** | Ejecución técnica, partes usadas, hallazgos adicionales | `reparacion.iniciada`, `reparacion.completada` | `presupuesto.autorizado`, `stock.reservado` |
| **Inventario / Stock** | Repuestos por sucursal, alertas de stock crítico | `stock.critico`, `stock.reservado`, `stock.consumido` | `reparacion.iniciada`, `cron.stock_check` |
| **Facturación** | Facturas, pagos, métricas de ingresos por tenant | `factura.emitida`, `pago.registrado` | `ot.cerrada` |
| **Notificaciones** | Email, push web, push móvil al cliente y equipo | — | `ot.etapa_cambiada`, `garantia.proxima`, `stock.critico` |
| **Migración TallerGP** | Pipeline único de ingesta desde sistema legado | `migracion.completada`, `migracion.error` | — |
| **IA / Diagnóstico** *(V1+)* | Diagnóstico asistido, detección de patrones | `sugerencia.generada` | `evento.registrado`, `diagnostico.iniciado` |

---

## 4. Las cinco aplicaciones

| Aplicación | Tipo | Usuarios | Propósito | Stack |
|---|---|---|---|---|
| **ERP del Taller** | Web (SSR + SPA) | Recepción, Jefe Taller, Admin | Gestión completa de OTs, presupuestos, facturación, inventario | Next.js 15 App Router — grupo `(taller)` |
| **Portal del Cliente** | Web móvil | Clientes del taller | Seguimiento del vehículo, aprobación de presupuestos, historial visible | Next.js 15 App Router — grupo `(portal)` |
| **App Mecánico** | App nativa móvil | Mecánicos en piso | OTs asignadas, avance, evidencias, hallazgos. Offline-first. | React Native / Expo — proyecto separado |
| **API Pública** *(V2)* | REST + webhooks | Sistemas externos, flotas, aseguradoras | Integraciones con terceros bajo scopes granulares | Next.js Route Handlers `/api/v1/` |
| **Servicios IA** *(V2+)* | Microservicio aislado | Interno (sistema) | Diagnóstico asistido, predicciones, análisis de patrones | Vercel Edge Functions + Claude API |

El ERP del Taller y el Portal del Cliente comparten el mismo proyecto Next.js — grupos de ruta físicamente separados con layouts, guards y contextos de sesión distintos. Un cliente del Portal nunca ejecuta código del ERP.

---

## 5. Comunicación

### Síncrona (usuario → sistema)

El cliente browser llama a Supabase directamente via Browser Client. No hay servidor intermedio para operaciones CRUD. La API `(Route Handlers)` solo interviene para webhooks externos, jobs de cron, presigned URLs de Storage y operaciones con secretos.

### Asíncrona (módulos → módulos)

Los módulos no se llaman entre sí. Publican eventos persistidos en `transiciones_evento` y en una tabla `domain_events`. Un mecanismo de Supabase Database Webhooks notifica a los Route Handlers interesados cuando un evento relevante se persiste.

### Tiempo real (sistema → usuario)

| Canal | Filtro | Consumidores |
|---|---|---|
| `org:{org_id}` | Eventos de la organización | Dashboard del taller, notificaciones internas |
| `ot:{ot_id}` | Eventos de una OT activa | Vista de detalle de OT, App Mecánico |
| `cliente:{cliente_id}` | Eventos visibles al cliente | Portal del Cliente |

**Límite crítico:** Realtime usa WebSockets por cliente. Por encima de 2.000 talleres activos simultáneos el plan estándar de Supabase se satura. A esa escala, migrar a polling inteligente (30s) para canales de baja frecuencia y reservar WebSockets para OTs activas únicamente.

### Jobs automáticos (sistema → sistema)

Vercel Cron dispara Route Handlers a intervalos definidos. Cada job registra su ejecución en tabla `job_runs` para detectar fallos silenciosos. Los jobs que superan 10 segundos de ejecución se extraen a Supabase Edge Functions.

| Job | Frecuencia | Acción |
|---|---|---|
| Alertas de mantención | Diario 08:00 | Detecta vehículos próximos a intervención |
| Garantías por vencer | Diario 09:00 | Alerta al recepcionista y opcionalmente al cliente |
| Seguimiento post-entrega | Diario 10:00 | Crea registro de seguimiento en OTs cerradas hace 7 días |
| Stock crítico | Cada hora | Alerta al administrador si stock < mínimo |
| Detección tiempo excedido | Cada hora | Alerta al jefe si OT supera estimado × 1.2 |

### Webhooks y comunicación externa

| Dirección | Origen/Destino | Propósito |
|---|---|---|
| Entrante | TallerGP API | Migración de datos históricos (pipeline único) |
| Entrante | Resend callbacks | Confirmación de emails entregados |
| Saliente | Resend | Emails transaccionales a clientes y equipo |
| Saliente | Expo Push Notifications | Notificaciones a mecánicos en App |
| Saliente | SII *(V2)* | Emisión de documentos tributarios electrónicos |

---

## 6. Almacenamiento

| Capa | Tecnología | Qué guarda | Escala |
|---|---|---|---|
| **Relacional** | Supabase PostgreSQL + RLS | Todos los datos del dominio. `transiciones_evento` particionado por `creado_en` desde migration 001. | Hasta 5K tenants activos en plan Pro. Plan dedicado a partir de 5K. |
| **Archivos / Evidencias** | Supabase Storage (bucket privado) | Fotos, videos, PDFs, firmas. Path: `{org_id}/{vehiculo}/{event_id}/{uuid}`. Signed URLs TTL 1h. | Georeplica en R2/S3 desde el primer cliente en producción. |
| **Cache de navegación** | Next.js Router Cache (TTL 30s) + localStorage events + Realtime | Estado de UI del browser. Invalidado por triple mecanismo. | Stateless — escala con Vercel. |
| **Búsqueda de texto** *(V1)* | PostgreSQL FTS con `pg_trgm` | Búsqueda de clientes, vehículos, diagnósticos | Migrar a Typesense si latencia >200ms en producción |
| **Embeddings / IA** *(V1+)* | pgvector en Supabase | Vectores de diagnósticos para búsqueda semántica | Una colección por tenant o colección global según volumen |

---

## 7. Escalabilidad

| Escenario | Estado | Acción requerida |
|---|---|---|
| **100 talleres** | Verde — stack actual sin cambios | Ninguna |
| **1.000 talleres** | Amarillo | Materializar `org_id` en sesión (evitar query por fila en RLS). PgBouncer en modo transaction. Monitorear Realtime connections. |
| **10.000 talleres** | Rojo sin acción previa | Supabase Enterprise (DB dedicada). Realtime con fanout externo (Redis Pub/Sub). Sharding de Storage por región. |
| **1M vehículos** | Condicional | `transiciones_evento` particionado. `evidencias` con política de archivado de blobs viejos. Paginación obligatoria en Historia Técnica. |

**Decisión de particionamiento — no negociable:** `transiciones_evento` se crea particionada desde la Migration 001. Migrar una tabla activa a particionamiento en PostgreSQL requiere recrearla. Si se llega a 500K filas sin particiones, la ventana de mantenimiento destruye el SLA.

---

## 8. Inteligencia Artificial

### Ubicación por función

| Función | Ubicación | Fase |
|---|---|---|
| Detección de reparaciones repetidas | Supabase (consulta sobre `transiciones_evento`) | MVP |
| Alertas de garantía con riesgo | Supabase (trigger → `cola_eventos_ia`) | MVP |
| Búsqueda semántica de diagnósticos | Supabase pgvector | V1 |
| Diagnóstico asistido (RAG) | Vercel Edge Function + Claude API | V1 — corpus mínimo ~500 eventos |
| Predicción de mantenciones | Vercel Edge Function | V1 — bloqueado por PA10 (`lecturas_odometro`) |
| Análisis de productividad por mecánico | Supabase (vistas calculadas) | V1 |
| Detección de abandono de clientes | Servicio externo | V2 |

### Arquitectura de datos para IA

Una vista dedicada `v_historial_tecnico_ia` consolida el corpus de entrenamiento: `eventos`, `transiciones_evento`, `diagnosticos`, `items_reparacion` (con tiempos reales), `garantias`. Los servicios de ML consumen esta vista en modo solo lectura — nunca tocan las tablas base.

### Flujo RAG

Cuando el mecánico ingresa un síntoma, pgvector recupera los N diagnósticos más similares del historial del taller. Ese contexto se inyecta en un prompt a Claude API. La sugerencia generada incluye trazabilidad a los casos históricos que la fundamentan. La decisión final siempre es del mecánico.

### Bus de eventos IA

Cada inserción en `transiciones_evento` puede activar lógica asíncrona sin bloquear la transacción principal. Los triggers de Supabase escriben en `cola_eventos_ia`. Una Edge Function consume la cola de forma asíncrona y ejecuta las funciones inteligentes correspondientes.

---

## 9. Seguridad

### Autenticación por actor

| Actor | Mecanismo | TTL sesión | Revocación |
|---|---|---|---|
| Empleados del taller | Magic link (email) — sin contraseñas | 1h access / 7d refresh | Inmediata al desactivar en UC-A01 |
| Mecánico (App móvil) | Email + contraseña — credenciales estables en taller | 1h access / 30d refresh | Inmediata via Supabase Auth Admin |
| Clientes (Portal) | OTP de 6 dígitos — sin contraseñas | 4h | Expiración natural |
| Jobs internos (cron) | `SUPABASE_SERVICE_ROLE_KEY` en servidor | Por request | Rotación de secretos |

### Tres capas de autorización

1. **Aplicación** — guards de ruta en Next.js middleware. Prima el UX, no la seguridad real. Puede ser evadida.
2. **API** — Route Handlers validan JWT, aplican Zod, verifican `org_id` desde el token (nunca desde el request body). Primera barrera real.
3. **RLS (PostgreSQL)** — inmune a bugs en las capas superiores. `org_id = mi_org_id()` en todas las tablas per-tenant. `mi_org_id()` lee el JWT, nunca el request. Última línea de defensa imposible de eludir.

El diseño asume que las capas 1 y 2 pueden estar comprometidas. La capa 3 debe sobrevivir sola.

### Restricción de visibilidad del Mecánico

La separación financiera y de PII del mecánico opera en tres niveles simultáneos: la App Mecánico es un proyecto separado (no existe código que mostrar), el endpoint de sync solo devuelve campos explícitamente permitidos (el servidor filtra), y las vistas `v_clientes_mecanico` y `v_items_presupuesto_mecanico` con `security_barrier` bloquean el acceso a columnas sensibles incluso via SQL directo.

### Auditoría e inmutabilidad

Dos registros paralelos: `transiciones_evento` (audit técnico del ciclo de vida — append-only, sin `eliminado_en`) y `audit_log` (acciones de usuario — solo INSERT via función SECURITY DEFINER, ningún rol puede UPDATE/DELETE). PII nunca en texto plano en audit_log — solo FKs.

### PII y Ley 19.628

El derecho de supresión se implementa como anonimización irreversible de los campos PII del cliente, preservando la integridad del historial técnico del vehículo (necesario para garantías y responsabilidad civil). Los campos PII nunca aparecen en logs de error ni en el cuerpo de respuestas de error.

---

## 10. Roadmap técnico

### Fase 1 — Core ERP (MVP operacional)

Objetivo: All Motors SPA opera sin TallerGP. Un taller, un equipo, flujo completo.

- Migración de datos desde TallerGP (pipeline ETL)
- ERP Web: recepción, diagnóstico, presupuesto, autorización, reparación, control de calidad, entrega
- Realtime en dashboard y detalle de OT
- Inventario básico: repuestos y stock por sucursal
- Notificaciones: email vía Resend
- Autenticación para empleados del taller

### Fase 2 — Experiencia ampliada

Objetivo: el mecánico no toca el web, el cliente sigue su vehículo en tiempo real.

- App Mecánico (React Native/Expo): offline-first, captura de evidencias, hallazgos
- Portal del Cliente: estado de OT, historial visible, presupuesto de lectura
- Garantías y recomendaciones pendientes
- Alertas automáticas (mantención, garantías, seguimiento post-entrega)
- Push notifications web al cliente y al mecánico

### Fase 3 — Inteligencia y analítica

Objetivo: el sistema sugiere, detecta y anticipa.

- Búsqueda semántica de diagnósticos (pgvector)
- RAG: diagnóstico asistido por historial del taller
- `lecturas_odometro` para predicción de mantenciones
- Dashboard de BI: productividad por mecánico, tiempos por tipo de reparación, garantías reclamadas
- Aprobación remota de presupuesto desde Portal del Cliente

### Fase 4 — Plataforma y ecosistema

Objetivo: All Motors Cloud como plataforma abierta para la industria automotriz.

- API Pública con scopes granulares y API keys por cliente
- Integración SII para facturación electrónica (DTE)
- Multi-sucursal avanzado: reportes consolidados entre sucursales
- Portal de proveedores: órdenes de compra, confirmación de entregas
- Módulo de aseguradoras como tipo de cliente con flujos específicos

---

## 11. Riesgos conocidos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Supabase como único vendor: outage = sistema totalmente caído | Crítico | Aceptado en MVP. En Fase 2: modo lectura offline en App Mecánico. En Fase 3: evaluar DB réplica de lectura independiente. |
| `transiciones_evento` sin particionamiento desde migration 001 | Alto | Obligatorio en migration 001. No negociable. |
| `mi_org_id()` evaluada por fila a 1K+ talleres concurrentes | Alto | Materializar `org_id` en sesión de PostgreSQL al inicio de cada request antes de llegar a 500 talleres activos. |
| OT + Inventario sin transacción atómica | Medio | Envolver ambas escrituras en una única transacción PostgreSQL. Definir comportamiento si el stock falla (bloquear OT o registrar deuda). |
| Realtime WebSockets a 2K+ talleres simultáneos | Medio | Monitorear conexiones activas. Plan de migración a polling para canales de baja frecuencia antes de saturar. |
| Vercel Cron falla silenciosamente | Medio | Tabla `job_runs` con registro de cada ejecución. Alerta al administrador si un job no ejecuta en su ventana esperada. |
| Storage sin georeplica en MVP | Medio | Replicar bucket `evidencias` en R2 o S3 antes del primer cliente en producción. |

---

## 12. Decisiones rechazadas

| Alternativa | Por qué se rechazó |
|---|---|
| Microservicios desde el inicio | Complejidad operacional sin beneficio real para un equipo pequeño en MVP |
| Server Actions para mutaciones de BD | Fallan silenciosamente en Vercel serverless (cookie context no se transmite) |
| Polling como mecanismo de tiempo real | Latencia inaceptable para OTs activas que cambian en segundos |
| URLs públicas permanentes para Storage | Se filtran en logs, referrer headers y caché del browser |
| Contraseñas para usuarios internos | Vector de ataque más común — magic links eliminan contraseñas débiles y reutilizadas |
| `audit_log` con soft-delete | Un administrador malicioso podría borrar su rastro |
| `org_id` como parámetro del request | Puede manipularse; debe venir siempre del JWT |

---

*Este documento es la constitución técnica de All Motors Cloud.*  
*Toda decisión de arquitectura, módulo, endpoint o migración debe poder trazarse hasta una sección documentada aquí.*  
*Modificaciones requieren revisión del Architecture Board.*
