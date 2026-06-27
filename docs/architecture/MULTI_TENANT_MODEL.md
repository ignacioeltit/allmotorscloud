# Multi-Tenant Model — All Motors Cloud

**Estado:** Draft  
**Versión:** 1.0  
**Última actualización:** Junio 2026  
**Propósito:** Definir la arquitectura multi-tenant de All Motors Cloud como plataforma SaaS

---

## 1. Propósito

Este documento define cómo All Motors Cloud sirve a múltiples talleres (tenants) desde una única plataforma SaaS. Define la estrategia de aislamiento de datos, los tiers de servicio, el flujo de onboarding de nuevos talleres, y las garantías de separación entre organizaciones.

All Motors Cloud no es el sistema interno de All Motors SPA. Es una plataforma que vende sus capacidades a cualquier taller mecánico. All Motors SPA es el primer tenant (Tenant #1) y actúa como caso de prueba real de producción.

---

## 2. Alcance

Este documento cubre:
- Estrategia de aislamiento de datos entre talleres
- Propagación del identificador de organización en toda la plataforma
- Definición de tiers de servicio y sus límites
- Flujo de onboarding de un nuevo taller
- Configuración personalizada por tenant
- Portabilidad y exportación de datos por tenant
- Modelo de routing de URLs
- Decisiones de arquitectura y sus justificaciones

No cubre: diseño de base de datos, esquema Prisma, código de implementación, ni migrations de SQL.

---

## 3. Relación con el Domain Model

El `DOMAIN_MODEL.md` define la entidad **Empresa / Taller** como la organización que opera All Motors Cloud, con **Sucursales** como unidades físicas subordinadas.

En el contexto multi-tenant, la entidad Empresa / Taller del Domain Model es precisamente el **tenant**. Cada taller que contrata el servicio es una instancia de esa entidad.

| Concepto del Domain Model | Concepto Multi-Tenant |
|---|---|
| Empresa / Taller | Tenant |
| `org_id` de la Empresa | Identificador del tenant en toda la DB |
| Sucursal | Unidad dentro de un tenant (no cruza tenants) |
| Usuario | Usuario de ese tenant específico |
| Vehículo, OT, Historia Técnica | Datos de ese tenant — nunca visibles a otro |

**Regla crítica del dominio:** el historial técnico de un vehículo pertenece al taller que lo registró, no al vehículo en abstracto. Si el mismo vehículo visita dos talleres distintos, cada uno tiene su propia Historia Técnica del vehículo. No hay historia compartida entre tenants.

---

## 4. Estrategia de aislamiento

### 4.1 Shared database con org_id

Todos los tenants comparten un único proyecto Supabase (PostgreSQL). No existen schemas separados por tenant. Cada tabla del dominio incluye una columna `org_id` que referencia al tenant dueño del registro.

Tablas que incluyen `org_id`: `vehicles`, `clients`, `repair_orders`, `technical_events`, `technical_histories`, `budgets`, `authorizations`, `repairs`, `quality_checks`, `deliveries`, `payments`, `invoices`, `warranties`, `pending_recommendations`, `inventory`, `stock_movements`, `providers`, `purchases`, `users`, `branches`.

`org_id` es `NOT NULL` en todas las tablas del dominio. No existen registros de dominio sin propietario de tenant.

### 4.2 RLS como garantía de aislamiento

Row Level Security (RLS) es la línea de defensa definitiva. Incluso si el código de aplicación tiene un bug y no filtra por `org_id`, la política RLS en la base de datos impide que un usuario de Tenant A lea o modifique datos de Tenant B.

Las políticas RLS se basan en el `org_id` presente en el JWT del usuario autenticado. Ese claim se propaga desde Supabase Auth en cada sesión.

Formato del claim en el JWT:
```
app_metadata.org_id  →  UUID del tenant
app_metadata.role    →  rol del usuario dentro de ese tenant
```

Las policies RLS son del tipo:
```
auth.jwt() -> 'app_metadata' -> 'org_id' = org_id
```

Toda política es `USING` (lectura) y `WITH CHECK` (escritura) simultáneamente. No existe política que solo restrinja escritura pero permita lectura libre.

### 4.3 Por qué no schemas separados

| Criterio | Schema por tenant | Shared DB con org_id + RLS |
|---|---|---|
| Complejidad operacional | Alta — migrations deben aplicarse en N schemas | Baja — una migration por todos |
| Onboarding de nuevo tenant | Requiere crear schema y aplicar migrations | Solo insertar fila en tabla `organizations` |
| Backups y restauración | Por schema o todo o nada | Flexible |
| Performance con < 500 tenants | Sin ventaja real | Sin desventaja real |
| Costo en Supabase | Sin diferencia | Sin diferencia |
| Aislamiento | Fuerte (por diseño) | Fuerte (vía RLS, más simple de mantener) |

Para el volumen proyectado de All Motors Cloud (decenas a pocos cientos de talleres en los próximos 3 años), el modelo shared con RLS es operacionalmente más simple sin sacrificar aislamiento.

---

## 5. Propagación de org_id

El `org_id` recorre toda la stack sin excepción:

**Capa de autenticación:** al autenticar, Supabase incluye `org_id` en el JWT. No se consulta la DB en cada request para obtenerlo.

**Capa de API / Server Actions:** todo handler de servidor extrae `org_id` del JWT del usuario autenticado antes de cualquier consulta. No acepta `org_id` como parámetro del request.

**Capa de base de datos:** RLS valida `org_id` en cada operación. Si la capa de aplicación no filtra por `org_id`, RLS lo hace de todos modos.

**Capa de storage:** los archivos (fotos, PDFs, videos) se almacenan bajo una ruta prefijada con `org_id`:
```
{bucket}/{org_id}/{entity_type}/{entity_id}/{filename}
```
Las políticas de Supabase Storage también validan `org_id` del JWT.

**Invariante:** ningún endpoint, query ni función del servidor puede operar sobre datos de dominio sin `org_id` resuelto desde el JWT. Si el JWT no tiene `org_id`, la sesión es inválida y se rechaza.

---

## 6. Tiers de servicio

### Starter

Orientado a talleres pequeños, una sola ubicación.

| Límite | Valor |
|---|---|
| Sucursales | 1 |
| Usuarios activos | 5 (incluye mecánicos) |
| Mecánicos simultáneos | 3 |
| Vehículos activos (OTs abiertas) | Sin límite |
| Storage para evidencias | 5 GB |
| Exportación de datos | CSV básico (clientes, vehículos, OTs) |
| Portal Cliente | No incluido |
| API pública | No |
| SLA | Mejor esfuerzo |
| Soporte | Email, 48h hábiles |

### Pro

Para talleres con crecimiento o múltiples sucursales.

| Límite | Valor |
|---|---|
| Sucursales | 3 |
| Usuarios activos | 20 |
| Mecánicos simultáneos | 10 |
| Vehículos activos | Sin límite |
| Storage para evidencias | 25 GB |
| Exportación de datos | CSV completo + JSON estructurado |
| Portal Cliente | Incluido |
| API pública | No |
| SLA | 99.5% uptime mensual |
| Soporte | Email + chat, 24h hábiles |
| Reportes avanzados | Incluidos |
| Integraciones (WhatsApp) | Incluidas |

### Enterprise

Para cadenas de talleres o grupos con necesidades específicas.

| Límite | Valor |
|---|---|
| Sucursales | Ilimitadas |
| Usuarios activos | Ilimitados |
| Mecánicos simultáneos | Ilimitados |
| Vehículos activos | Sin límite |
| Storage para evidencias | 100 GB (ampliable) |
| Exportación de datos | CSV, JSON, SQL dump bajo petición |
| Portal Cliente | Incluido con branding propio |
| API pública | Incluida con rate limits negociados |
| SLA | 99.9% uptime mensual + compensación |
| Soporte | Cuenta asignada, 4h hábiles |
| Campos personalizados | Ilimitados |
| Integraciones avanzadas | SII, sistemas de flota, seguros |

### Cómo se aplican los límites técnicamente

Los límites de tier **no se implementan como restricciones de RLS**. Se implementan como validaciones en la capa de aplicación (Server Actions / API handlers) que consultan la tabla `organizations` antes de crear ciertos recursos.

Tabla `organizations` incluye: `tier`, `max_branches`, `max_active_users`, `max_concurrent_mechanics`, `storage_quota_bytes`, `features` (JSONB con flags por funcionalidad).

Cuando un usuario intenta crear una sucursal adicional, el handler verifica `COUNT(branches WHERE org_id = ?) < organizations.max_branches`. Si el límite se alcanzó, se retorna un error con código `TIER_LIMIT_REACHED` y un link al upgrade.

El consumo de storage se calcula al momento de subir un archivo y se rechaza si supera la cuota. El contador se mantiene en `organizations.storage_used_bytes`.

---

## 7. Flujo de onboarding de un nuevo taller

El onboarding crea el tenant y su configuración mínima sin intervención manual del equipo de All Motors Cloud.

```
1. Registro
   └── El dueño del taller ingresa: nombre del taller, RUT, email, contraseña, plan elegido
   └── Sistema crea fila en tabla `organizations` con `org_id` (UUID), `slug`, `tier`
   └── Sistema crea primer usuario con rol `admin` asociado a ese `org_id`
   └── JWT del primer usuario incluye `org_id` y `role: admin`

2. Configuración inicial (wizard post-registro)
   └── Nombre comercial del taller, logo, dirección, teléfono
   └── Crear primera (y única en Starter) sucursal
   └── Invitar a los primeros usuarios (opcional en este paso)
   └── Configurar horarios de atención (para citas)

3. Primer uso
   └── El taller ya puede registrar su primer vehículo
   └── Todos los datos quedan bajo el org_id creado en el paso 1

4. Migración de datos (opcional — solo para tenants con historial previo)
   └── El equipo de All Motors Cloud activa el módulo de importación
   └── All Motors SPA usó este camino importando desde TallerGP
   └── Otros talleres pueden importar CSV de clientes/vehículos en formato estándar
```

El onboarding completo (pasos 1 y 2) toma menos de 10 minutos. El taller puede operar desde el paso 3 sin necesidad de configuración adicional obligatoria.

---

## 8. Configuración por tenant

Cada tenant puede personalizar la plataforma dentro de los límites de su tier.

| Configuración | Starter | Pro | Enterprise |
|---|---|---|---|
| Logo y nombre en UI | Sí | Sí | Sí |
| Campos personalizados en vehículo | No | 5 campos | Ilimitados |
| Campos personalizados en cliente | No | 3 campos | Ilimitados |
| Estados de OT adicionales | No | No | Sí |
| Flujo de autorización simplificado | No | Sí | Sí |
| Checklist de control de calidad propio | No | Sí | Sí |
| Notificaciones configurables (canal, texto) | Básico | Avanzado | Avanzado + webhook |
| Política de autorización verbal | Estándar | Configurable | Configurable |

La configuración por tenant se almacena en la tabla `tenant_config` (columnas JSONB por área de configuración). No modifica el esquema de la base de datos — los campos personalizados son pares clave-valor validados contra el schema del tenant.

---

## 9. Portabilidad y exportación de datos

Un taller tiene derecho a exportar todos sus datos en cualquier momento, sin depender del equipo de All Motors Cloud para generarlos.

**Qué se puede exportar:**
- Clientes (nombre, RUT, contacto)
- Vehículos (patente, VIN, datos técnicos)
- Historia Técnica por vehículo (todos los registros en orden cronológico)
- Órdenes de Trabajo (completas con ítems, presupuestos, autorizaciones)
- Facturas y pagos
- Inventario actual
- Usuarios y roles

**Formatos disponibles por tier:**
- Starter: CSV por entidad (un archivo por tabla)
- Pro: CSV + JSON estructurado (relaciones preservadas entre entidades)
- Enterprise: CSV, JSON, y SQL dump bajo petición formal

**Archivos adjuntos (fotos, PDFs, videos):**
- La exportación de datos no incluye archivos automáticamente por el tamaño potencial
- Se genera un manifiesto con todas las URLs de archivos del tenant
- El taller puede descargar los archivos individualmente o solicitar un dump en ZIP (Enterprise)

**Garantía de portabilidad:**
- La exportación incluye todos los datos sin excepción — no existen datos del tenant retenidos por All Motors Cloud
- El formato de exportación está documentado públicamente para que el taller pueda importarlo en otro sistema
- El proceso de exportación completa puede iniciarse desde el panel de administración sin intervención del soporte

---

## 10. Routing (URL por tenant)

All Motors Cloud usa **path-based routing** como esquema principal:

```
https://allmoterscloud.com/org/{orgSlug}/dashboard
https://allmoterscloud.com/org/{orgSlug}/vehiculos
https://allmoterscloud.com/org/{orgSlug}/ordenes
```

El `orgSlug` es un identificador legible elegido por el taller durante el onboarding (ej: `allmotors`, `tallersantiago`, `mecanicajuan`). Es único en toda la plataforma.

**Subdominios personalizados (solo Enterprise):**
```
https://tallersantiago.allmoterscloud.com/dashboard
```

**Por qué path-based sobre subdominios para todos los tiers:**
- Los subdominios requieren certificados SSL wildcard o individuales — mayor complejidad operacional
- El path-based funciona con un único certificado en el dominio principal
- Middleware de Next.js extrae `orgSlug` del path y lo usa para resolver el `org_id` desde una tabla de routing en la DB
- La resolución `orgSlug → org_id` se cachea en la capa de middleware para no consultar la DB en cada request

**Portal Cliente:** usa una URL por tenant para que el taller pueda compartirla a sus clientes:
```
https://allmoterscloud.com/portal/{orgSlug}
```

---

## 11. Decisiones principales

| Decisión | Elección | Justificación |
|---|---|---|
| Aislamiento de datos | Shared DB + RLS | Operacionalmente más simple que schemas separados para el volumen proyectado |
| Identificador de tenant | UUID (`org_id`) en todas las tablas | Imposible de predecir o enumerar; RLS lo valida siempre |
| JWT claim | `app_metadata.org_id` | Nunca editable por el usuario; propagado automáticamente por Supabase Auth |
| Routing | Path-based (`/org/{slug}`) | Un certificado, menos infra; subdominios solo en Enterprise |
| Límites de tier | Capa de aplicación, no RLS | RLS es aislamiento de seguridad; los límites son reglas de negocio |
| Exportación | Generada por el tenant, sin soporte | Autonomía del cliente; reduce carga operacional del equipo |
| Onboarding | Self-service | Escala sin intervención manual; reduce time-to-value |

---

## 12. Reglas

1. Toda tabla del dominio tiene `org_id NOT NULL` con FK a `organizations`.
2. Toda política RLS filtra por `org_id` del JWT. No existen policies sin este filtro.
3. `org_id` nunca se acepta como parámetro de request HTTP. Solo se lee del JWT.
4. El storage de archivos está prefijado con `org_id` y protegido por policy de Supabase Storage.
5. Ningún endpoint del sistema retorna datos de más de un tenant en la misma respuesta.
6. El historial de un vehículo es exclusivo del tenant que lo registró. No existe historia compartida entre talleres.
7. Un usuario pertenece a exactamente un tenant. No existen usuarios multi-tenant (excepto el rol interno `platform_admin` del equipo de All Motors Cloud, que opera fuera del RLS estándar con credenciales de service role, solo en operaciones administrativas autorizadas).
8. Los límites de tier se validan en la capa de aplicación **antes** de crear el recurso, no después.
9. Una exportación completa de datos debe poder iniciarse desde el panel de administración del tenant sin intervención del soporte.
10. El `orgSlug` es inmutable una vez elegido durante el onboarding (para no romper links y bookmarks).

---

## 13. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Bug en capa de aplicación que omita filtro por `org_id` | Media | Crítico | RLS actúa como segunda línea de defensa; tests de aislamiento entre tenants en suite de QA |
| Configuración incorrecta de RLS policy que permita cross-tenant | Baja | Crítico | Tests de aislamiento automatizados que intentan acceso cross-tenant en cada CI/CD |
| Crecimiento de DB que degrada performance de queries con `org_id` | Media (largo plazo) | Alto | Índices en `org_id` en todas las tablas; particionamiento por `org_id` si se supera 1M de filas por tabla |
| Tenant con datos muy grandes afecta performance de otros | Baja | Medio | Cuotas de storage; rate limits en API; separación futura a Supabase project dedicado si es Enterprise muy grande |
| `orgSlug` elegido conflictivo o inapropiado | Baja | Bajo | Validación en onboarding (lista negra, formato alfanumérico, longitud mínima/máxima) |
| Service role key comprometida expone datos de todos los tenants | Muy baja | Crítico | Rotación periódica; auditoría de uso; solo se usa en backend server-side estrictamente necesario |

---

## 14. Preguntas abiertas

1. **Tenant suspendido por impago:** ¿qué ocurre con sus datos? ¿Se preservan por X días antes de borrar? ¿Puede exportar durante el período de gracia?

2. **Migración de Starter a Pro:** ¿el upgrade es inmediato o requiere revisión? Si el tenant ya tiene 2 sucursales en Starter (error o excepción histórica), ¿cómo se maneja?

3. **platform_admin y auditoría:** ¿toda operación del rol `platform_admin` sobre datos de un tenant queda registrada en un log de auditoría accesible al tenant?

4. **Vehículo con la misma patente en dos tenants:** ¿se permite o se bloquea? La patente es única dentro de un tenant, pero no entre tenants. ¿Hay valor en detectar que el mismo vehículo existe en múltiples talleres?

5. **Precio del tier Enterprise:** ¿incluye soporte de migración inicial de datos? ¿O es un servicio adicional?

6. **Subdominios personalizados:** ¿el taller provee su propio dominio (`mi-taller.cl`) con CNAME al servidor de All Motors Cloud, o solo se ofrecen subdominios de `allmoterscloud.com`?

7. **Retención de datos tras cancelación:** ¿cuánto tiempo se retienen los datos de un tenant que cancela el servicio antes de eliminarlos definitivamente?

---

## 15. Impacto futuro en desarrollo

**Base de datos:** toda migration nueva debe incluir `org_id` en tablas de dominio y su policy RLS correspondiente. Nunca crear una tabla de dominio sin este par.

**Tests:** la suite de tests debe incluir un conjunto de pruebas de aislamiento entre tenants que se ejecute en cada CI. Estas pruebas intentan leer datos de Tenant B usando credenciales de Tenant A y deben fallar.

**Onboarding:** el wizard de onboarding es una pieza crítica de producto. Su UX determina el time-to-value del nuevo taller. Debe poder completarse sin documentación externa.

**Billing:** el módulo de billing (no definido en este documento) debe consultar el tier del tenant en `organizations.tier` para habilitar o bloquear funcionalidades. El tier es la fuente de verdad para las capacidades del tenant.

**Escalabilidad:** si All Motors Cloud supera los 200-300 tenants activos con uso intensivo, evaluar particionamiento de tablas grandes por `org_id` en Supabase (PostgreSQL partitioning nativo). Esta decisión no es necesaria en el lanzamiento.

**API pública (Enterprise):** cuando se implemente, toda llamada a la API pública debe incluir una `api_key` que se resuelve a un `org_id`. El `org_id` se inyecta en el contexto del request igual que si viniera de un JWT de usuario humano. La API nunca opera fuera del aislamiento de RLS.

---

*Este documento alimenta directamente `DATABASE_MODEL.md` (columnas `org_id` y policies RLS) y el módulo de autenticación/autorización.*  
*Toda decisión de acceso a datos debe poder trazarse hasta una regla definida aquí.*
