# Arquitectura Backend — All Motors Cloud

**Estado:** Draft  
**Versión:** 1.0  
**Última actualización:** Junio 2026  
**Propósito:** Definir la arquitectura del servidor, patrones de mutación, jobs automáticos, tiempo real, almacenamiento de archivos y pipeline de migración

---

## 1. Propósito

Este documento define cómo se construye y organiza el lado del servidor de All Motors Cloud. No contiene código. Define los patrones, las decisiones y las reglas de arquitectura que todo desarrollo backend debe seguir.

Es la referencia obligatoria antes de diseñar cualquier endpoint, job, suscripción en tiempo real o pipeline de archivos.

---

## 2. Alcance

Cubre:
- Arquitectura general del servidor (Next.js 15 App Router + Supabase)
- Reglas de decisión: Route Handlers vs Server Actions
- Patrón de mutaciones desde el cliente (regla crítica del proyecto)
- Estrategia de RLS en Supabase
- Arquitectura de tiempo real con Supabase Realtime
- Pipeline de carga y almacenamiento de evidencias
- Jobs automáticos: alertas, recordatorios, auditoría
- Pipeline de migración desde TallerGP

No cubre: diseño de base de datos (ver `DATABASE_MODEL.md`), diseño de pantallas, ni lógica de negocio específica de cada módulo.

---

## 3. Relación con el Domain Model

Todo concepto en este documento referencia entidades definidas en `DOMAIN_MODEL.md`:

| Concepto del backend | Entidad del dominio |
|---|---|
| Mutaciones de eventos | Registro Técnico (Evento) |
| Suscripciones Realtime | Orden de Trabajo, Estado del Evento |
| Jobs de alertas | Alerta de Mantención, Alerta de Garantía |
| Pipeline de archivos | Evidencia (Fotografía, Video, Scanner, PDF, Firma) |
| Pipeline de migración | Entidades de migración (§9 del Domain Model) |
| RLS por `org_id` | Empresa / Taller (multi-tenant) |

La arquitectura no inventa conceptos nuevos. Solo define cómo se implementan los que el dominio ya declaró.

---

## 4. Arquitectura general del servidor

```
Cliente (Next.js App Router)
  ├── Componentes cliente (.tsx con 'use client')
  │     ├── Mutaciones → Supabase Browser Client (directo)
  │     └── Suscripciones → Supabase Realtime Channel
  │
  ├── Server Components
  │     └── Lectura inicial de datos → Supabase Server Client
  │
  └── Route Handlers (src/app/api/*)
        ├── Webhooks externos (TallerGP, Resend callbacks)
        ├── Jobs disparados por cron (Vercel Cron)
        └── Presigned URLs para upload a Supabase Storage
```

**Supabase es la capa central.** PostgreSQL + Auth + Storage + Realtime. No hay servidor de aplicaciones intermedio para las operaciones del día a día.

**Vercel** ejecuta los Route Handlers y los Server Components. Es stateless: cada request es independiente.

**Supabase Edge Functions** se usan exclusivamente para los jobs automáticos que no pueden exponerse como Route Handlers públicos (por razones de seguridad o latencia).

---

## 5. Route Handlers vs Server Actions — cuándo usar cada uno

### Route Handlers (`src/app/api/*/route.ts`)

Usar cuando:
- La operación proviene de un agente externo (webhook de Resend, cron de Vercel, llamada desde TallerGP)
- Se necesita control explícito del método HTTP y los headers de respuesta
- Se generan presigned URLs para upload de archivos
- El proceso implica lógica server-only con secretos que no deben exponerse al cliente

Ejemplos concretos en este proyecto:
- `POST /api/migration/run` — inicia el pipeline de migración desde TallerGP
- `POST /api/cron/alertas` — disparado por Vercel Cron para generar alertas automáticas
- `POST /api/storage/presign` — genera URL firmada para subir evidencia a Supabase Storage
- `POST /api/notifications/webhook` — recibe callbacks de Resend

### Server Actions (`src/app/actions/*.ts`)

Usar **únicamente** cuando la operación requiere lógica server-only que no puede ejecutarse en el cliente y no es un webhook ni un cron. Ver regla crítica en sección 6.

Ejemplos válidos:
- Revalidación del caché de Next.js después de una mutación
- Generación de un PDF servidor-side (con datos sensibles)
- Envío de email transaccional que requiere `RESEND_API_KEY`

### Lectura de datos iniciales

Los Server Components leen datos con el Supabase Server Client para la carga inicial de la página. No usan Route Handlers ni Server Actions para lectura.

---

## 6. Patrón de mutaciones (regla crítica del proyecto)

**REGLA ABSOLUTA:** Las Server Actions fallan silenciosamente en Vercel serverless para mutaciones de base de datos. El contexto de cookies de la sesión no se transmite correctamente. Las actualizaciones nunca llegan a la DB sin error visible para el usuario.

### Patrón correcto — mutaciones desde componentes cliente

```
Componente cliente
  └── createClient() [Supabase Browser Client]
        └── supabase.from('tabla').update({}).eq('id', id)
              └── Verificar: data.length > 0 (si RLS bloqueó → error explícito)
```

Después de cada mutación exitosa:
1. Llamar a la función local de recarga de datos
2. Escribir `localStorage.setItem('dashboard_stale', '1')` para sincronizar otras pestañas
3. Llamar a `router.refresh()` para invalidar el caché del router

### Verificación obligatoria de RLS

Toda mutación con `supabase.update()` o `supabase.insert()` debe:
- Encadenar `.select('id')` para confirmar que la operación afectó filas
- Si `data.length === 0` → RLS bloqueó la operación o la sesión expiró
- Mostrar un error explícito al usuario con mensaje descriptivo

### Qué NO usar para mutaciones de licitaciones/eventos

- Server Actions con `'use server'` para operaciones de DB — fallan silenciosamente
- `fetch` a Route Handlers propios para operaciones CRUD simples — innecesario

---

## 7. Supabase RLS — estrategia y capas

### Principio

RLS es la última línea de defensa, no la única. La primera línea es la lógica de la aplicación. Ambas deben actuar en conjunto.

### Funciones de soporte (SECURITY DEFINER)

```
mi_org_id()    → devuelve el org_id del usuario autenticado actual
mi_rol()       → devuelve el rol del usuario actual ('admin', 'mecanico', 'recepcion', 'jefe_taller')
mi_sucursal_id() → devuelve la sucursal asignada al usuario
```

### Capas de políticas

**Capa 1 — Aislamiento multi-tenant (todas las tablas)**
Todo registro tiene `org_id`. Ningún usuario puede leer ni escribir fuera de su organización.

```
SELECT: org_id = mi_org_id()
INSERT: org_id = mi_org_id()  (forzado por la política, no confiar en el cliente)
UPDATE/DELETE: org_id = mi_org_id()
```

**Capa 2 — Control por rol**

| Operación | Roles permitidos |
|---|---|
| Crear/cerrar Orden de Trabajo | admin, recepcion, jefe_taller |
| Registrar Diagnóstico | mecanico, jefe_taller |
| Crear Presupuesto | recepcion, jefe_taller, admin |
| Registrar Autorización | recepcion (registra decisión del cliente) |
| Registrar mano de obra y partes | mecanico, jefe_taller |
| Cerrar Control de Calidad | jefe_taller |
| Cerrar Entrega y registrar Pago | recepcion, admin |
| Modificar inventario | admin |
| Ver reportes financieros | admin |

**Capa 3 — Inmutabilidad de eventos cerrados**

Los Registros Técnicos con `estado = 'cerrado'` tienen política UPDATE bloqueada. Solo puede insertarse un nuevo registro que los referencie.

### Consideración de rendimiento

Los índices en `org_id` son obligatorios en toda tabla con RLS. Sin ellos, las políticas generan full table scans.

---

## 8. Arquitectura de tiempo real (Supabase Realtime)

### Canal principal por organización

```
canal: `org:${org_id}`
tablas suscritas: eventos, ordenes_trabajo, vehiculos
filtro: org_id=eq.${org_id}
```

El canal se abre cuando el usuario entra al dashboard y se cierra cuando sale. Un solo canal por sesión para minimizar conexiones.

### Canal secundario por vehículo activo

Cuando un mecánico tiene una OT abierta, se suscribe al canal:

```
canal: `vehiculo:${vehiculo_id}`
tablas suscritas: eventos (filtrado por vehiculo_id)
```

Esto permite que múltiples usuarios que trabajan en el mismo vehículo vean los cambios en tiempo real.

### Eventos del sistema que disparan Realtime

| Cambio en DB | Efecto en el cliente |
|---|---|
| Evento → estado `cerrado` | Dashboard refresca el estado de la OT |
| Control de calidad aprobado | Dispara notificación automática al cliente (ver §10) |
| Stock baja del mínimo | Alerta visible para el administrador en tiempo real |
| Nuevo evento asignado al mecánico | App del mecánico muestra la nueva tarea |

### Mecanismo de sincronización entre pestañas

El evento `storage` de `localStorage` sincroniza pestañas abiertas del mismo usuario:
- La pestaña de detalle escribe `localStorage.setItem('dashboard_stale', '1')` al guardar
- El dashboard detecta el cambio y recarga datos
- El canal Realtime es el mecanismo principal para tiempo real; `localStorage` es el fallback para mismo-tab

---

## 9. Pipeline de archivos y evidencias

Toda Evidencia (fotografía, video, firma, scanner, PDF) se almacena en Supabase Storage. La base de datos guarda solo la URL y los metadatos.

### Flujo de carga de evidencia

```
1. Cliente solicita presigned URL
   POST /api/storage/presign
   { tipo_evidencia, registro_id, mime_type }
   → Servidor valida sesión y permisos
   → Genera presigned URL con TTL de 60 segundos
   → Devuelve: { upload_url, evidence_url, token }

2. Cliente sube el archivo directamente a Supabase Storage
   PUT {upload_url} con el archivo binario
   → Sin pasar por el servidor de Next.js (ahorra ancho de banda y tiempo)

3. Cliente confirma la carga
   supabase.from('evidencias').insert({
     registro_id,
     tipo,
     url: evidence_url,
     subido_por: usuario_id,
     created_at: now()
   })
```

### Estructura de carpetas en Supabase Storage

```
bucket: evidencias
  /{org_id}/{vehiculo_id}/{registro_id}/{tipo}/{filename}
```

Esta estructura permite:
- RLS por prefijo de path (todo bajo `{org_id}/` pertenece a esa organización)
- Listar todas las evidencias de un registro o de un vehículo eficientemente

### PDFs de TallerGP (migración)

Los PDFs históricos de TallerGP tienen URLs en `d31bmy06rjbdnm.cloudfront.net`. El pipeline de migración los descarga y los re-aloja en el bucket propio antes de que TallerGP sea dado de baja. La URL original queda guardada como `tallergp_pdf_url` en la entidad de migración (ver §11).

### Límites y restricciones

- Tamaño máximo por archivo: 50 MB (fotos y videos de diagnóstico)
- Tipos permitidos: `image/*`, `video/mp4`, `application/pdf`, `text/plain` (scanner OBD)
- Las URLs públicas de evidencias se generan con URLs firmadas de corta duración (no públicas permanentes)

---

## 10. Jobs automáticos (alertas, recordatorios, auditoría)

Los jobs se ejecutan por dos mecanismos complementarios:

| Mecanismo | Frecuencia | Uso |
|---|---|---|
| Vercel Cron + Route Handler | Configurable (1x/día mínimo) | Alertas de mantención, garantías próximas a vencer, seguimiento post-entrega |
| Supabase Edge Functions + pg_cron | En tiempo de DB | Auditoría interna, limpieza de presigned URLs vencidos |

### Job: Alertas de mantención (UC-S03)

**Disparador:** Vercel Cron — `0 8 * * *` (8:00 AM diario)  
**Lógica:**
1. Consultar `mantenciones_programadas` donde `fecha_estimada <= now() + 7 days` o `km_estimado <= km_actual + 500`
2. Filtrar las que no tienen alerta enviada en los últimos 30 días
3. Generar mensaje personalizado por cliente
4. Enviar por canal preferido del cliente (email via Resend, push via Web Push)
5. Insertar Registro Técnico de tipo `alerta_mantencion` en la Historia Técnica

### Job: Alertas de garantías próximas a vencer

**Disparador:** Vercel Cron — `0 9 * * *`  
**Lógica:**
1. Consultar garantías donde `fecha_vencimiento BETWEEN now() AND now() + 15 days`
2. Notificar al recepcionista (alerta interna en dashboard)
3. Opcionalmente notificar al cliente (según configuración del taller)

### Job: Seguimiento post-entrega (UC-S02)

**Disparador:** Vercel Cron — `0 10 * * *`  
**Lógica:**
1. Buscar OTs cerradas hace exactamente 7 días sin Registro de Seguimiento
2. Crear Registro de Seguimiento con estado `pendiente`
3. Alertar al recepcionista para contacto manual o disparar mensaje automático

### Job: Detección de vehículos con tiempo excedido

**Disparador:** Vercel Cron — `0 * * * *` (cada hora)  
**Lógica:**
1. Buscar OTs en estado `en_reparacion` donde `tiempo_actual > tiempo_estimado * 1.2`
2. Crear alerta visible para el jefe de taller en su dashboard

### Job: Auditoría de transiciones de estado

**Mecanismo:** Supabase Database Trigger (no Cron)  
Cada cambio de estado en un Registro Técnico dispara automáticamente la inserción de una fila en `transiciones_estado`:
- `estado_anterior`, `estado_nuevo`, `actor_id`, `created_at`, `motivo` (opcional)

Esta tabla es append-only. Ninguna política RLS permite UPDATE ni DELETE sobre ella.

---

## 11. Pipeline de migración desde TallerGP

TallerGP es la fuente de datos históricos. All Motors Cloud es el destino. La migración es un proceso único y trazable.

### Principios de la migración

1. **No destructiva:** los datos de TallerGP nunca se modifican
2. **Trazable:** cada entidad migrada conserva el ID de TallerGP como campo de referencia
3. **Idempotente:** el pipeline puede ejecutarse múltiples veces sin duplicar datos (usar `upsert` con constraint único sobre `tallergp_id`)
4. **Progresiva:** se migra por vehículo, no en batch masivo, para poder validar por unidad

### Etapas del pipeline

```
Etapa 1 — Extracción
  GET /api/tallergp/{recurso}  →  TallerGP API
  Guardar respuesta raw en tabla staging (sin transformar)

Etapa 2 — Transformación
  Mapear entidades TallerGP → entidades All Motors Cloud
  Ver tabla de correspondencias abajo

Etapa 3 — Carga
  Insertar en tablas definitivas
  Preservar tallergp_*_id como campo nullable en cada entidad

Etapa 4 — Migración de archivos
  Para cada tallergp_pdf_url en evidencias migradas:
    Descargar PDF desde CloudFront
    Subir a Supabase Storage en /{org_id}/{vehiculo_id}/{registro_id}/pdfs/
    Actualizar URL en la entidad

Etapa 5 — Validación
  Comparar conteos: clientes, vehículos, OTs, facturas
  Verificar que todos los tallergp_pdf_url tienen archivo en Storage
  Marcar migración como validada
```

### Correspondencia de entidades TallerGP → All Motors Cloud

| TallerGP | All Motors Cloud | Notas |
|---|---|---|
| Customer (`7ps...`) | Cliente | Preservar `tallergp_customer_id` |
| Vehicle (`9g3...`) | Vehículo + Historia Técnica | Historia Técnica se crea al importar |
| Repair Order (`xd0...`) | Orden de Trabajo + Registros Técnicos | Cada ítem de la OT → Registro de Reparación |
| Invoice (`8fu...`) | Factura | Preservar `tallergp_invoice_id` |
| PDF URL (CloudFront) | Evidencia de tipo PDF en Storage propio | Descargar y re-alojar antes de dar de baja TallerGP |

### Route Handler del pipeline

```
POST /api/migration/run
  Headers: Authorization: Bearer {MIGRATION_SECRET}
  Body: { vehiculo_id: string, dry_run: boolean }
  Response: { migrado: number, errores: [], warnings: [] }
```

El endpoint solo acepta un `vehiculo_id` por llamada para mantener la migración trazable y recuperable. El proceso masivo es un loop externo.

---

## 12. Decisiones principales

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Mutaciones desde Browser Client (no Server Actions) | Server Actions para todas las mutaciones | Server Actions fallan silenciosamente en Vercel serverless — cookie context no se transmite |
| Presigned URLs para subida de archivos | Subir archivos pasando por Next.js | Evita límite de 4.5 MB de Vercel en request bodies y elimina latencia adicional |
| Vercel Cron para jobs diarios | Supabase Edge Functions para todos los jobs | Vercel Cron es más simple de monitorear con los logs existentes del proyecto |
| Canal Realtime por `org_id` | Canal por usuario | Reduce número de conexiones; todos los usuarios del taller comparten el mismo canal |
| Migración por vehículo (no masiva) | Migración batch total | Permite validación incremental y recuperación ante errores sin rehacer todo |
| Tabla `transiciones_estado` append-only | Log en el campo `updated_at` | Permite reconstruir cualquier estado pasado y auditar quién hizo cada cambio |

---

## 13. Reglas

1. Toda mutación desde un componente cliente usa el Supabase Browser Client directamente. Nunca un Server Action para operaciones CRUD de la base de datos.
2. Toda mutación verifica `data.length > 0` después del `.select('id')`. Si es cero, lanzar error visible al usuario.
3. `org_id` es obligatorio en toda query. Nunca una query sin filtro de organización.
4. Los Registros Técnicos con estado `cerrado` son inmutables. RLS bloquea UPDATE sobre ellos.
5. Los jobs de alertas insertan Registros Técnicos en la Historia Técnica del vehículo. Las alertas no son solo notificaciones: son parte de la historia del vehículo.
6. El pipeline de migración es idempotente. Puede ejecutarse más de una vez sin duplicar datos.
7. Ningún archivo de evidencia se sirve directamente desde una URL pública permanente. Se usan URLs firmadas con TTL.
8. Los PDFs de TallerGP deben estar descargados y en Storage propio antes de que TallerGP sea dado de baja.
9. La tabla `transiciones_estado` no tiene política DELETE. Es append-only y permanente.
10. El servidor nunca devuelve datos de otra organización, incluso si hay un bug en la lógica. RLS es la garantía final.

---

## 14. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Sesión expirada sin mensaje de error visible | Media | Alto | Verificar `data.length === 0` en toda mutación y mostrar error al usuario |
| Job de alertas duplica recordatorios | Baja | Medio | Filtrar por `last_sent_at` antes de enviar; constraint único en `alertas_enviadas` |
| PDFs de TallerGP se pierden si CloudFront se da de baja antes de la migración | Alta | Alto | Migrar archivos en etapa 4 lo antes posible, validar con checksums |
| Suscripción Realtime pierde conexión sin reintentar | Media | Medio | Implementar reconnect automático con backoff exponencial en el hook |
| Presigned URL vence antes de que el usuario termine de subir | Baja | Bajo | TTL de 60 segundos es suficiente; en caso de error, el cliente solicita nueva URL |
| RLS sin índice en `org_id` → performance degradado | Media | Alto | Verificar en cada migración que existe índice en `org_id` |

---

## 15. Preguntas abiertas

1. **Web Push sin service worker registrado:** si el cliente nunca visitó el sitio, no puede recibir push notifications. ¿Se usa email como fallback siempre, o solo cuando push falla?
2. **Múltiples mecánicos en un Registro de Reparación:** el Domain Model lo deja abierto. La arquitectura Realtime actual asume un único responsable por canal. ¿Cómo se coordinan múltiples mecánicos en el mismo evento?
3. **Retención de PDFs de TallerGP:** ¿se eliminan del Storage propio después de X años, o se conservan indefinidamente como historial legal?
4. **Rate limiting en el pipeline de migración:** TallerGP API puede tener límites de requests. ¿Se implementa backoff exponencial en el Route Handler de migración?
5. **Aprobación remota de presupuesto (UC-P03/P04):** si el cliente aprueba desde el Portal Cliente, ¿esa acción va por Server Action o por Browser Client? El portal usa sesión separada; la regla de mutaciones aplica igual.

---

## 16. Impacto futuro en desarrollo

- **App del mecánico (UC-AM01):** la arquitectura de Realtime por vehículo activo ya está diseñada para soportarla. El hook de suscripción puede reutilizarse directamente.
- **Portal del cliente (UC-PC01):** usará el mismo Supabase Auth con un rol `cliente` y políticas RLS más restrictivas. La arquitectura de presigned URLs para evidencias es compatible.
- **Inteligencia Artificial (UC-IA01):** la tabla `transiciones_estado` y los Registros Técnicos son el corpus de entrenamiento natural. No se requieren cambios arquitectónicos para exponerlos a un modelo.
- **Multi-sucursal:** el filtro por `org_id` ya aísla organizaciones. Añadir `sucursal_id` a la capa de RLS es incremental sin rediseño.
- **Facturación electrónica SII:** si All Motors Cloud se integra con el SII chileno, el Route Handler de entrega (`POST /api/entrega/cerrar`) es el punto de extensión natural para llamar a la API del SII antes de cerrar la OT.

---

*Este documento alimenta directamente el diseño de Route Handlers, hooks de Realtime y el esquema de Supabase Storage.*  
*Toda decisión de implementación en el servidor debe poder trazarse hasta una sección de este documento.*
