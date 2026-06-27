# API Model — All Motors Cloud

**Estado:** Draft  
**Versión:** 1.0  
**Última actualización:** Junio 2026  
**Propósito:** Definir la estructura, convenciones y contratos de la API REST de All Motors Cloud

---

## 1. Propósito

Este documento establece el diseño de la API REST de All Motors Cloud: la jerarquía de URLs, las convenciones de comunicación, la estrategia de autenticación, los patrones de paginación, el formato de errores, los webhooks y las reglas de separación entre la API interna y la API pública futura.

La API no es un accesorio. Es la interfaz contractual entre el backend y todos los consumidores: la aplicación web (Next.js), la app móvil del mecánico, el Portal del Cliente y las integraciones externas futuras.

---

## 2. Alcance

**Incluye:**
- URL structure y naming conventions
- Verbos HTTP y su uso semántico
- Autenticación y autorización (Bearer token via Supabase)
- Formato de respuesta exitosa y de error (RFC 7807)
- Paginación cursor-based
- Filtros y ordenamiento
- Endpoints por actor (recepción, mecánico, admin, portal cliente)
- Webhooks para Portal del Cliente e integraciones
- Distinción entre API interna (Next.js server) y API pública futura
- Reglas de inmutabilidad en la API
- Realtime via Supabase channels

**No incluye:** esquema de base de datos, lógica de negocio interna, migraciones, código de implementación.

---

## 3. Relación con el Domain Model

El dominio establece que el **Vehículo y su Historia Técnica** son el eje central. La API refleja esto directamente: la jerarquía de recursos comienza en `/vehicles` y todo lo demás cuelga de ahí.

| Concepto del dominio | Recurso en la API |
|---|---|
| Vehículo | `/v1/organizations/{orgId}/vehicles/{vehicleId}` |
| Historia Técnica | `/v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history` |
| Registro Técnico (Evento) | `/v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events` |
| Orden de Trabajo | `/v1/organizations/{orgId}/work-orders/{workOrderId}` |
| Presupuesto | `/v1/organizations/{orgId}/work-orders/{workOrderId}/budget` |
| Garantía | `/v1/organizations/{orgId}/vehicles/{vehicleId}/warranties` |
| Recomendación Pendiente | `/v1/organizations/{orgId}/vehicles/{vehicleId}/pending-recommendations` |
| Inventario | `/v1/organizations/{orgId}/inventory` |
| Clientes | `/v1/organizations/{orgId}/clients` |

La Orden de Trabajo existe como recurso de primer nivel bajo `organizations` (no bajo `vehicles`) porque es un documento financiero que requiere acceso directo por número de OT, independientemente del vehículo.

---

## 4. Estructura de URLs

### Prefijo base

```
/api/v1/organizations/{orgId}/...
```

Toda request lleva `orgId`. No existe ningún endpoint sin contexto de organización. El multi-tenant se impone en la URL, no solo en el middleware.

### Recursos principales

```
# Vehículos y búsqueda por patente (llave natural del taller)
GET    /v1/organizations/{orgId}/vehicles
GET    /v1/organizations/{orgId}/vehicles/{vehicleId}
GET    /v1/organizations/{orgId}/vehicles/by-plate/{patente}

# Historia Técnica
GET    /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history
GET    /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events
GET    /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events/{eventId}
POST   /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events

# Evidencias de un evento
GET    /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events/{eventId}/evidence
POST   /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events/{eventId}/evidence
DELETE /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events/{eventId}/evidence/{evidenceId}

# Órdenes de Trabajo
GET    /v1/organizations/{orgId}/work-orders
POST   /v1/organizations/{orgId}/work-orders
GET    /v1/organizations/{orgId}/work-orders/{workOrderId}
PATCH  /v1/organizations/{orgId}/work-orders/{workOrderId}

# Presupuesto (un presupuesto activo por OT; versiones como subcolección)
GET    /v1/organizations/{orgId}/work-orders/{workOrderId}/budget
POST   /v1/organizations/{orgId}/work-orders/{workOrderId}/budget
GET    /v1/organizations/{orgId}/work-orders/{workOrderId}/budget/versions

# Clientes y propietarios
GET    /v1/organizations/{orgId}/clients
POST   /v1/organizations/{orgId}/clients
GET    /v1/organizations/{orgId}/clients/{clientId}
PATCH  /v1/organizations/{orgId}/clients/{clientId}

# Garantías y recomendaciones pendientes
GET    /v1/organizations/{orgId}/vehicles/{vehicleId}/warranties
GET    /v1/organizations/{orgId}/vehicles/{vehicleId}/pending-recommendations

# Inventario y repuestos
GET    /v1/organizations/{orgId}/inventory
GET    /v1/organizations/{orgId}/inventory/{itemId}
PATCH  /v1/organizations/{orgId}/inventory/{itemId}

# Usuarios del taller
GET    /v1/organizations/{orgId}/users
GET    /v1/organizations/{orgId}/users/{userId}
```

### Acciones que no son CRUD (transiciones de estado)

Las transiciones de estado de un evento no se modelan como PATCH genérico. Cada transición es una acción nombrada bajo `/actions`:

```
POST /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events/{eventId}/actions/assign
POST /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events/{eventId}/actions/start
POST /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events/{eventId}/actions/pause
POST /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events/{eventId}/actions/resume
POST /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events/{eventId}/actions/complete
POST /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events/{eventId}/actions/close
POST /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events/{eventId}/actions/cancel

# Acciones de OT
POST /v1/organizations/{orgId}/work-orders/{workOrderId}/actions/open
POST /v1/organizations/{orgId}/work-orders/{workOrderId}/actions/close

# Acciones de presupuesto
POST /v1/organizations/{orgId}/work-orders/{workOrderId}/budget/actions/send
POST /v1/organizations/{orgId}/work-orders/{workOrderId}/budget/actions/approve
POST /v1/organizations/{orgId}/work-orders/{workOrderId}/budget/actions/reject

# Presigned URL para subir evidencia directamente a Supabase Storage
POST /v1/organizations/{orgId}/vehicles/{vehicleId}/technical-history/events/{eventId}/evidence/upload-url
```

---

## 5. Convenciones

### Verbos HTTP y su uso

| Verbo | Uso | Idempotente |
|---|---|---|
| GET | Leer un recurso o colección | Sí |
| POST | Crear un nuevo recurso o ejecutar una acción nombrada | No |
| PATCH | Actualizar campos específicos de un recurso mutable | Sí |
| PUT | No se usa — reemplazar un recurso completo no es un patrón del dominio | — |
| DELETE | Solo para evidencias adjuntas (archivos) en eventos aún no cerrados | Sí |

No existe DELETE sobre eventos, OTs, presupuestos, ni garantías. Los datos históricos son inmutables. Solo se cambia su estado.

### Formato de respuesta exitosa

Todas las respuestas exitosas siguen esta estructura:

```json
{
  "data": { ... },
  "meta": {
    "requestId": "req_01j...",
    "timestamp": "2026-06-15T10:23:00Z"
  }
}
```

Para colecciones:

```json
{
  "data": [ ... ],
  "pagination": {
    "nextCursor": "cur_...",
    "prevCursor": null,
    "hasMore": true,
    "count": 20
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

### Formato de error (RFC 7807 Problem Details)

```json
{
  "type": "https://api.allmotors.cl/errors/event-already-closed",
  "title": "El evento no puede modificarse",
  "status": 409,
  "detail": "El evento EVT-0041 fue cerrado el 2026-06-10T14:00:00Z y es inmutable.",
  "instance": "/v1/organizations/org_123/vehicles/veh_456/technical-history/events/EVT-0041",
  "requestId": "req_01j..."
}
```

Errores comunes y sus códigos HTTP:

| Situación | Status |
|---|---|
| Recurso no encontrado | 404 |
| Transición de estado no permitida | 409 |
| Falta autorización del cliente para reparación | 422 |
| Token inválido o expirado | 401 |
| Rol sin permiso para la operación | 403 |
| Validación de campos | 400 |
| Límite de rate alcanzado | 429 |

### Paginación

Se usa paginación cursor-based (no offset) porque las Historias Técnicas pueden tener miles de eventos y los offsets se vuelven inestables con inserciones concurrentes.

```
GET /v1/.../technical-history/events?limit=20&cursor=cur_abc123&order=desc
```

- `cursor`: token opaco que el servidor genera en cada respuesta
- `limit`: máximo 100, default 20
- `order`: `asc` (cronológico) o `desc` (más reciente primero)
- El cursor codifica `(created_at, event_id)` para estabilidad

### Filtros y ordenamiento

Los filtros van como query params con prefijo de campo:

```
GET /v1/.../technical-history/events?type=reparacion&status=closed&from=2026-01-01&to=2026-06-30
GET /v1/.../vehicles?search=SRDV88
GET /v1/.../work-orders?status=open&assignedTo={userId}
```

No se expone un lenguaje de query arbitrario. Los filtros soportados están documentados por endpoint.

---

## 6. Autenticación y autorización en la API

### Autenticación

Todas las requests requieren un Bearer token en el header:

```
Authorization: Bearer <supabase_access_token>
```

El token es emitido por Supabase Auth al momento del login. Expira según la configuración de la sesión (default 1 hora). El cliente refresca con el `refresh_token` automáticamente.

Para la API interna (Next.js App Router), el token se obtiene desde la cookie de sesión del servidor usando `createServerClient`. Nunca se expone el `SUPABASE_SERVICE_ROLE_KEY` al cliente.

Para la API pública futura (acceso de socios/integradores), se emitirán API Keys de organización con scopes limitados. Esta funcionalidad es V2.

### Autorización por rol

El `org_id` se extrae del token. El middleware valida que el usuario pertenece a esa organización antes de procesar cualquier request.

| Rol | Puede crear eventos | Puede ver finanzas | Puede cerrar OT | Puede ver Historia Técnica |
|---|---|---|---|---|
| Administrador | Sí | Sí | Sí | Sí |
| Jefe de Taller | Sí | Solo costos de OT activa | Sí | Sí |
| Recepcionista | Sí (recepción, entrega) | Sí (en OT activa) | Sí | Sí |
| Mecánico | Solo sobre eventos asignados | **No** | No | Sí (solo técnico, sin montos) |
| Portal Cliente | Solo lectura de su vehículo | Solo montos propios | No | Solo lo que el taller expone |

**La restricción financiera del Mecánico se impone en la API**, no solo en el frontend. Los endpoints de mecánico devuelven respuestas sin campos de costo, precio ni margen. El servidor los omite independientemente de lo que el cliente pida.

---

## 7. Endpoints por actor

### Recepción

Endpoints de acceso frecuente en el flujo de recepción:

```
GET  /v1/.../vehicles/by-plate/{patente}          # Búsqueda principal
POST /v1/.../vehicles                              # UC-R02
POST /v1/.../clients                               # UC-R01
POST /v1/.../work-orders                           # Abrir OT (UC-R05)
POST /v1/.../technical-history/events              # Registro de Recepción
POST /v1/.../evidence/upload-url                   # Fotos de ingreso
POST /v1/.../work-orders/{id}/budget/actions/send  # UC-P03
```

La respuesta de `GET /vehicles/by-plate/{patente}` está pre-ensamblada para evitar múltiples requests del cliente. Incluye: datos del vehículo, propietario actual, última OT si está abierta, y recomendaciones pendientes.

### Mecánico

El mecánico opera siempre sobre eventos que le están asignados:

```
GET  /v1/.../users/me/assigned-events             # Lista de eventos asignados hoy
GET  /v1/.../technical-history/events/{eventId}   # Detalle de un evento (sin campos financieros)
POST /v1/.../events/{eventId}/actions/start
POST /v1/.../events/{eventId}/actions/pause
POST /v1/.../events/{eventId}/actions/complete
POST /v1/.../events/{eventId}/evidence/upload-url
GET  /v1/.../vehicles/{vehicleId}/technical-history # Historia técnica completa (solo campos técnicos)
GET  /v1/.../vehicles/{vehicleId}/pending-recommendations
```

La vista `/users/me/assigned-events` devuelve los eventos agrupados por vehículo, con el contexto pre-ensamblado necesario para que el mecánico pueda comenzar sin navegación adicional.

### Administrador / Jefe de Taller

```
GET  /v1/.../work-orders                          # Tablero de OTs activas
POST /v1/.../events/{eventId}/actions/assign      # Asignar mecánico
POST /v1/.../events/{eventId}/actions/close       # Cerrar evento tras control calidad
GET  /v1/.../inventory                            # Estado del stock
GET  /v1/.../reports/dashboard                    # Métricas operativas
GET  /v1/.../reports/mechanic-productivity        # Tiempos por mecánico
```

### Portal del Cliente (API separada)

El Portal del Cliente usa un subpath propio para distinguirlo claramente de la API interna:

```
GET  /v1/portal/vehicles/{vehicleId}/history       # Historia técnica filtrada para cliente
GET  /v1/portal/vehicles/{vehicleId}/active-work-order
GET  /v1/portal/vehicles/{vehicleId}/warranties
POST /v1/portal/work-orders/{workOrderId}/budget/actions/approve  # Aprobación remota (V1)
```

Los endpoints de portal devuelven únicamente la información que el taller ha marcado como visible para el cliente. Los eventos de tipo "diagnóstico interno" u "observación interna" se excluyen de estas respuestas.

---

## 8. Webhooks y eventos push

### Realtime (Supabase Channels)

Para actualizaciones en tiempo real dentro de la aplicación, se usan los canales de Supabase Realtime. No se usan long-polling ni Server-Sent Events ad hoc.

| Canal | Quién se suscribe | Cuándo se emite |
|---|---|---|
| `org:{orgId}:work-orders` | Dashboard de recepción | Cambio de estado en cualquier OT |
| `org:{orgId}:events:{vehicleId}` | Vista de evento activo | Transición de estado del evento |
| `org:{orgId}:inventory` | Panel de administrador | Stock baja del mínimo |
| `vehicle:{vehicleId}:status` | Portal del Cliente | Cambio de estado de la OT del vehículo |

### Webhooks (para integraciones externas — V1)

Los webhooks notifican a sistemas externos cuando ocurren eventos relevantes. Se configuran por organización con una URL y un secreto HMAC-SHA256.

| Evento del webhook | Cuándo se dispara |
|---|---|
| `work_order.opened` | Nueva OT creada |
| `work_order.closed` | OT cerrada con pago |
| `budget.sent` | Presupuesto enviado al cliente |
| `budget.approved` | Cliente aprueba presupuesto |
| `vehicle.ready` | Control de calidad aprobado |
| `warranty.expiring_soon` | Garantía a menos de 7 días de vencer |
| `stock.critical` | Inventario bajo mínimo |

El payload de cada webhook incluye: `event`, `occurred_at`, `org_id`, `resource_type`, `resource_id`, y un `data` mínimo suficiente para que el receptor consulte el detalle si lo necesita. No se envían payloads masivos en el webhook.

Los webhooks se reintentan con backoff exponencial hasta 5 intentos. Se registra cada intento con su resultado HTTP para auditoría.

### Subida de archivos

Los archivos (fotos, videos, PDFs, resultados de scanner) **no pasan por la API**. El flujo es:

1. Cliente solicita `POST /evidence/upload-url` → recibe URL presignada de Supabase Storage (válida 10 min)
2. Cliente sube el archivo directamente a esa URL
3. Cliente notifica a la API con el path del archivo para registrar la evidencia en la Historia Técnica

Esto elimina la API como cuello de botella para archivos grandes y delega el almacenamiento a la infraestructura de Supabase Storage.

---

## 9. Decisiones principales

| Decisión | Elección | Razón |
|---|---|---|
| Versioning | `/v1/` en la URL | Simple, explícito, compatible con proxies y caches |
| Paginación | Cursor-based | Los historiales de vehículos son grandes; el offset se desestabiliza con inserciones |
| Transiciones de estado | Acciones nombradas (`/actions/start`) | Hace explícito el contrato; evita PATCHes con lógica implícita |
| Restricción financiera mecánico | Enforced en la API, no solo en UI | La UI puede ser evadida; la API es el contrato definitivo |
| Búsqueda por patente | `/vehicles/by-plate/{patente}` | La patente es la llave natural del negocio; el ID interno es secundario |
| Realtime | Supabase Channels | Evita implementar infraestructura de WebSockets propia |
| Uploads de archivos | Presigned URLs a Supabase Storage | La API no procesa binarios; escala sin límites de payload |
| Multi-tenant | `orgId` obligatorio en cada URL | Imposible hacer requests cross-tenant por construcción |
| Portal Cliente | Subpath `/portal/` separado | Facilita rate limiting diferenciado y auditoría por tipo de acceso |

---

## 10. Reglas

1. **No existe DELETE sobre datos históricos.** Eventos, OTs, presupuestos, garantías y clientes no tienen endpoint DELETE. Solo cambian de estado.
2. **El mecánico nunca recibe campos financieros.** El servidor los omite en cualquier respuesta a un token con rol `mechanic`.
3. **Toda request lleva `org_id` en la URL.** No existe endpoint global sin contexto de organización.
4. **Las acciones de transición de estado son idempotentes.** Llamar `POST /actions/start` en un evento ya iniciado devuelve 200 con el estado actual, no un error.
5. **El endpoint `/vehicles/by-plate/{patente}` devuelve respuesta pre-ensamblada.** No requiere que el cliente haga múltiples GETs para mostrar el contexto inicial de un vehículo.
6. **Los presupuestos tienen versiones.** Cada modificación al presupuesto crea una nueva versión; el endpoint GET devuelve siempre la versión activa. Las versiones anteriores están disponibles en `/budget/versions`.
7. **La patente se normaliza antes de guardar y buscar.** Mayúsculas, sin espacios ni guiones. La API acepta variantes y normaliza internamente.
8. **No existe `upsert` en endpoints de creación.** Si un vehículo ya existe, el POST devuelve 409 con referencia al recurso existente.

---

## 11. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Historial técnico crece indefinidamente | Respuestas lentas en vehículos con 5.000+ eventos (ej: SRDV88) | Paginación cursor-based + índice en `(vehicle_id, created_at)` |
| Respuesta pre-ensamblada de `by-plate` queda stale | Cliente muestra datos desactualizados | Cache de 5 segundos máximo; invalidar via Realtime al detectar cambio |
| Doble creación de vehículo por patente con variante | Duplicados en el sistema | Normalización de patente en la capa de API antes de consultar BD |
| Webhook con payload sensible interceptado | Fuga de información del cliente | HMAC-SHA256 en header `X-AllMotors-Signature`; HTTPS obligatorio |
| App móvil mecánico offline hace requests conflictivos | Datos inconsistentes al volver online | Política de conflicto documentada en UC-AM01; la API rechaza con 409 si el evento cambió de estado |
| Portal Cliente accede a información sensible de OT anterior | Privacidad entre propietarios | El endpoint `/portal/` filtra por propietario actual; la política de visibilidad histórica debe resolverse (ver Preguntas Abiertas) |

---

## 12. Preguntas abiertas

1. **Aprobación remota de presupuesto:** ¿el Portal Cliente puede hacer `POST /budget/actions/approve` directamente, o la aprobación siempre requiere que recepción registre el mensaje del cliente? Impacta el diseño del endpoint y la evidencia que queda en la Historia Técnica.
2. **Visibilidad del historial para nuevo propietario:** ¿el endpoint `/portal/vehicles/{vehicleId}/history` devuelve eventos de propietarios anteriores? Depende de la decisión documentada en DOMAIN_MODEL.md (Pregunta abierta 1).
3. **Rate limiting del Portal Cliente:** ¿cuántas requests por minuto se permiten desde el Portal? El portal es acceso público con auth ligera; necesita límites más bajos que la API interna.
4. **API pública para socios (V2):** ¿qué scopes se exponen? ¿Pueden los socios leer Historias Técnicas completas, o solo consultar si un vehículo tiene historial en el sistema?
5. **Patente como identificador público:** dado que la patente es pública, ¿se permite buscar vehículos por patente sin autenticación? La respuesta debe ser no, pero hay que documentar la decisión explícitamente.
6. **Integración SII:** si All Motors Cloud emite facturas electrónicas chilenas, el endpoint de cierre de OT deberá incluir o disparar la integración con el SII. ¿Es síncrona o asíncrona con la respuesta de la API?

---

## 13. Impacto futuro en desarrollo

**Implementación del backend (Next.js Route Handlers):**
- Cada área de use-cases (01 a 15) mapea directamente a una carpeta bajo `src/app/api/v1/organizations/[orgId]/`
- Las acciones de transición de estado son el punto más complejo: deben validar la transición contra la máquina de estados de `EVENT_MODEL.md` antes de ejecutar

**App móvil del mecánico:**
- Necesitará un endpoint de sincronización offline: `POST /users/me/sync` que recibe el bundle de cambios locales y devuelve el estado del servidor. Este endpoint no está en el scope MVP pero debe reservarse en el diseño de URLs.

**Portal del Cliente:**
- El subpath `/portal/` permite en el futuro desplegar un rate limiter, un CDN o un API Gateway diferente al de la API interna, sin cambios en los clientes.

**Inteligencia Artificial:**
- Los endpoints de Historia Técnica son la fuente de datos para el módulo de IA. La estructura cursor-based facilita el procesamiento en lotes sin cargar todo el historial en memoria.
- Se reserva `/v1/organizations/{orgId}/ai/suggestions/{vehicleId}` para futuros endpoints de sugerencia de diagnóstico.

**Versionado de la API:**
- `/v1/` es la única versión activa. Cuando existan cambios incompatibles, se creará `/v2/` y se mantendrá `/v1/` durante 12 meses con header de deprecación `Sunset: <fecha>`.

---

*Este documento guía la implementación de la API REST de All Motors Cloud.*  
*Toda decisión de endpoint debe poder trazarse hasta un caso de uso en `USE_CASE_MODEL.md` o una entidad en `DOMAIN_MODEL.md`.*
