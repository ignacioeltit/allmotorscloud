# Arquitectura de la App Mecánico — All Motors Cloud

**Estado:** Draft  
**Versión:** 1.0  
**Última actualización:** Junio 2026  
**Propósito:** Definir la arquitectura técnica de la aplicación móvil exclusiva para mecánicos

---

## 1. Propósito

La App Mecánico es la interfaz operacional del taller para el actor técnico central: el mecánico. Su único propósito es reducir la fricción administrativa durante el trabajo técnico al mínimo posible.

El mecánico no es un operador de sistema. Es un técnico cuyo tiempo vale dinero al taller. Cada segundo de interacción con un dispositivo es tiempo de reparación perdido.

Esta app no es una versión reducida del sistema web. Es una aplicación dedicada, diseñada desde cero con la realidad del piso del taller como restricción central.

---

## 2. Alcance

**La app hace:**
- Mostrar la lista de vehículos asignados al mecánico con estado y prioridad
- Mostrar los trabajos autorizados de cada vehículo (solo lo que puede ejecutar)
- Permitir marcar inicio y fin de cada ítem de trabajo (cronometro automático)
- Registrar partes utilizadas desde lista precargada
- Capturar y subir evidencia fotográfica y de video
- Reportar hallazgos adicionales al jefe de taller (un tap)
- Consultar historial técnico del vehículo (sin datos de cliente ni financieros)
- Operar en modo offline cuando no hay WiFi

**La app NO hace:**
- Mostrar precios, costos ni información financiera de ningún tipo
- Mostrar datos personales del cliente (nombre, RUT, teléfono, email)
- Generar facturas, presupuestos ni documentos comerciales
- Gestionar proveedores, compras ni stock
- Comunicarse con el cliente
- Agendar citas ni coordinar entregas
- Mostrar información de otras órdenes de trabajo ajenas al mecánico asignado

---

## 3. Relación con el Domain Model

La app opera sobre un subconjunto restringido del dominio:

| Entidad de dominio | Visibilidad en app | Restricción |
|---|---|---|
| Vehículo | Sí — patente, marca, modelo, año, km | Sin VIN ni datos de propietario |
| Historia Técnica | Sí — eventos técnicos pasados | Sin eventos financieros ni de cliente |
| Evento (asignado) | Sí — trabajos autorizados activos | Solo los asignados al mecánico autenticado |
| Evidencia (foto/video) | Sí — captura y visualización | Solo del vehículo activo |
| Repuesto | Sí — lista limitada para registro | Sin precios |
| Hallazgo Adicional | Sí — crear y enviar al jefe | No puede aprobar ni autorizar |
| Orden de Trabajo | No | Entidad invisible para el mecánico |
| Presupuesto | No | Entidad invisible para el mecánico |
| Cliente | No | Entidad invisible para el mecánico |
| Pago / Factura | No | Entidad invisible para el mecánico |

El mecánico ve **qué debe hacer** y registra **qué hizo**. El porqué económico no es su responsabilidad.

---

## 4. Arquitectura offline-first

### 4.1 Qué se almacena localmente

La app usa SQLite vía Expo SQLite como base de datos local. Al iniciar sesión o al entrar en zona con conexión, se sincroniza un subconjunto del servidor.

**Tablas locales (solo lo necesario para trabajar offline):**

| Tabla local | Contenido | TTL sugerido |
|---|---|---|
| `assigned_vehicles` | Patente, marca, modelo, año, km ingreso | Hasta cierre de turno |
| `work_items` | Ítems autorizados por vehículo | Hasta cierre de turno |
| `parts_catalog` | Lista de repuestos disponibles (sin precios) | 24 horas |
| `technical_history` | Últimos N eventos del vehículo (solo técnicos) | Hasta cierre de turno |
| `pending_uploads` | Cola de acciones offline no sincronizadas | Hasta sync exitoso |
| `mechanic_session` | Token, perfil del mecánico, turno activo | Duración del token |

**Nunca se almacena localmente:** precios, datos de cliente, información financiera, datos de otros mecánicos.

### 4.2 Estrategia de sincronización

```
App inicia / WiFi detectado
        ↓
1. Pull: descarga asignaciones activas del servidor
        ↓
2. Pull: descarga historial técnico de vehículos asignados
        ↓
3. Push: envía cola pending_uploads al servidor
        ↓
4. Confirma: marca como sincronizados los items enviados
        ↓
App lista para uso offline hasta próxima conexión
```

**Frecuencia de sync:**
- Al iniciar la app (siempre, si hay conexión)
- Al detectar reconexión WiFi tras período offline
- Al completar un ítem de trabajo (intento inmediato; si falla, va a cola)
- Al cerrar la app (intento de vaciar la cola pendiente)
- Background sync cada 5 minutos si hay conexión activa

**Indicador visual:** la app siempre muestra el estado de conexión y la cantidad de acciones pendientes de sync en la barra de estado.

### 4.3 Resolución de conflictos

El servidor es la fuente de verdad. Las reglas de merge son simples por diseño.

| Tipo de conflicto | Resolución |
|---|---|
| Dos mecánicos marcan inicio en el mismo ítem | El servidor acepta el primero; el segundo recibe error explicativo al sincronizar |
| Mecánico edita ítem en offline; jefe lo reasigna en ese lapso | Al sincronizar, la app informa al mecánico que el ítem fue reasignado; sus datos se conservan como observación |
| Foto tomada offline con evento ya cerrado en servidor | La foto se adjunta igualmente; el servidor la acepta fuera de ventana con flag `uploaded_offline` |
| Tiempo de trabajo registrado offline con desfase de reloj | Se conserva el timestamp del dispositivo; el servidor registra también el timestamp de recepción |

**Principio:** nunca se descarta trabajo del mecánico silenciosamente. Si hay conflicto, se notifica y se conservan los datos.

**Respuesta a pregunta abierta UC-AM01:** si dos mecánicos registran sobre el mismo vehículo simultáneamente en offline, el servidor aplica "primero en llegar, primero en procesar" para el inicio del ítem. El segundo recibe error con mensaje claro. Sus observaciones y evidencias se conservan como pendientes de revisión del jefe de taller.

---

## 5. Pipeline de captura de evidencias

La cámara es el método de entrada principal. El flujo debe ser: abrir, capturar, adjuntar — sin pasos intermedios.

```
Tap en "Agregar evidencia"
        ↓
Expo Camera se abre directamente (sin galería intermedia)
        ↓
Mecánico captura foto o inicia video
        ↓
Vista previa inmediata (2 segundos) con opción "Usar" / "Repetir"
        ↓
"Usar" → compresión local (JPEG 85%, max 2MB foto / max 30MB video)
        ↓
Si hay conexión → upload directo a Supabase Storage
Si no hay conexión → archivo en Expo FileSystem + registro en pending_uploads
        ↓
Evento de dominio registrado como evidencia adjunta al ítem activo
```

**Reglas del pipeline:**
- La compresión ocurre en el dispositivo antes de cualquier upload
- El archivo original no se guarda en la galería del teléfono (privacidad del cliente)
- Si el upload falla después de 3 intentos, el archivo queda en FileSystem y se reintenta en el próximo sync
- Los videos se comprimen a 720p antes de subir; si superan 30MB comprimidos, se alerta al mecánico
- Cada evidencia lleva metadata: `mechanic_id`, `vehicle_plate`, `event_id`, `captured_at` (timestamp del dispositivo), `uploaded_at`
- Las fotos de vehículos de recepción (4 ángulos mínimo) tienen un flujo guiado: la app indica ángulo a capturar y no avanza hasta completar los cuatro

**Estructura en Supabase Storage:**
```
evidence/
  {org_id}/
    {vehicle_plate}/
      {event_id}/
        {uuid}.jpg
        {uuid}.mp4
```

---

## 6. Notificaciones push

La app usa Expo Notifications con tokens gestionados en el servidor.

**Eventos que generan push al mecánico:**

| Evento | Origen | Contenido del push |
|---|---|---|
| Nueva asignación de vehículo | Jefe de taller | Patente + trabajo principal asignado |
| Repuestos disponibles | Sistema (al recepcionar OC) | Patente + "Repuestos listos para continuar" |
| Hallazgo aprobado por jefe | Jefe de taller | Patente + "Hallazgo autorizado — puedes continuar" |
| Hallazgo rechazado por jefe | Jefe de taller | Patente + "Hallazgo no autorizado — no ejecutar" |
| Alerta de QC rechazado | Jefe de taller | Patente + ítem a corregir |

**Eventos que NO generan push al mecánico:** cambios de precio, comunicaciones con el cliente, eventos financieros.

**Implementación:**
- Token Expo Push registrado en el servidor al hacer login en la app
- El servidor usa la API de Expo Push Notifications para el envío (no FCM/APNs directamente)
- Los tokens se invalidan al hacer logout o al detectar error `DeviceNotRegistered`
- Máximo 1 push por evento; no se acumulan ni se agrupan por defecto

---

## 7. Estructura de navegación

El mecánico no es un usuario técnico. La navegación debe ser obvia, sin jerarquías profundas.

```
Pantalla de inicio (stack raíz)
│
├── Tab 1: Mis Vehículos  ← pantalla de inicio por defecto
│     └── [Tap en vehículo] → Detalle de Vehículo
│           ├── Lista de trabajos autorizados
│           │     └── [Tap en trabajo] → Pantalla de Trabajo
│           │           ├── Botón "Iniciar" / "Finalizar"
│           │           ├── Lista de partes usadas
│           │           └── Adjuntar evidencia (cámara directa)
│           ├── Historial técnico (solo lectura)
│           └── Botón "Reportar hallazgo" (siempre visible)
│
├── Tab 2: Notificaciones  ← badge con número
│
└── Tab 3: Mi Perfil  ← solo foto y datos técnicos del mecánico
```

**Regla de 3 clics — verificación por acción frecuente:**

| Acción | Clics | Ruta |
|---|---|---|
| Iniciar un trabajo | 2 | Tap vehículo → tap "Iniciar" |
| Finalizar un trabajo | 2 | Tap vehículo → tap "Finalizar" |
| Tomar una foto | 3 | Tap vehículo → tap "Evidencia" → capturar |
| Registrar una parte usada | 3 | Tap vehículo → tap trabajo → seleccionar parte |
| Reportar hallazgo | 2 | Tap vehículo → tap "Reportar hallazgo" |

La regla de 3 clics se valida en cada review de diseño de pantalla. Si una acción frecuente supera 3 clics, el diseño debe rediseñarse antes de implementarse.

---

## 8. Restricciones de visibilidad

### El mecánico VE:
- Patente del vehículo
- Marca, modelo, año y color
- Kilometraje al ingreso
- Trabajos autorizados (descripción técnica, sin precios)
- Historial técnico del vehículo (diagnósticos pasados, partes usadas, observaciones técnicas)
- Fotos de recepción del vehículo actual
- Evidencias técnicas de visitas anteriores
- Notificaciones de asignación, repuestos y aprobaciones

### El mecánico NO VE (bloqueado por arquitectura, no por UI):
- Nombre, RUT, teléfono ni email del cliente
- Precios de repuestos ni de mano de obra
- Total del presupuesto ni de la factura
- Descuentos aplicados
- Método o estado de pago
- Margen de ganancia ni costos del taller
- Información de otros vehículos no asignados a él
- Comunicaciones del taller con el cliente

**Implementación:** la restricción no es solo visual. El endpoint de la API que alimenta la app solo devuelve campos explícitamente permitidos. El servidor filtra en la query; el cliente nunca recibe datos que no debe ver. No hay lógica de ocultamiento en el frontend.

---

## 9. Autenticación en móvil

- Supabase Auth con JWT de corta duración (1 hora) + refresh token de larga duración (30 días)
- El refresh token se almacena en Expo SecureStore (keychain en iOS, Keystore en Android)
- El mecánico inicia sesión con email y contraseña (no magic link — el taller necesita credenciales estables)
- La sesión persiste entre aperturas de la app; no se requiere login diario
- Si el token expira mientras la app está offline, se conserva la sesión local hasta que haya conexión para renovar
- En caso de cambio de contraseña o revocación de sesión por el administrador, la app detecta el error 401 al sincronizar y fuerza nuevo login
- La app no implementa biometría en MVP — puede agregarse en V1 como mejora de UX

---

## 10. Decisiones principales

| Decisión | Alternativa considerada | Razón de la elección |
|---|---|---|
| React Native + Expo | Flutter / PWA | El equipo conoce React. Expo simplifica Camera, FileSystem y Notifications. PWA no tiene acceso confiable a cámara en todos los dispositivos. |
| SQLite local (Expo SQLite) | AsyncStorage / MMKV | SQLite permite consultas relacionales offline. La cola de sync y el historial técnico requieren estructura, no solo clave-valor. |
| Supabase Storage para evidencias | S3 / Cloudinary | Consistencia con el stack del resto de la plataforma. RLS de Supabase aplica también a Storage. |
| Expo Push Notifications | FCM/APNs directos | Expo abstrae la complejidad de tokens multi-plataforma. Suficiente para el volumen del taller. |
| Tabs + Stack simple | Drawer navigation | El drawer oculta opciones. El mecánico necesita todo a la vista, sin explorar menús. |
| API filtra en servidor | Filtrar en cliente | La restricción de visibilidad debe ser arquitectónica. Filtrar en cliente es solo cosmética. |
| Compresión en dispositivo | Subir original y comprimir en servidor | Reduce consumo de datos en el taller. WiFi del área de trabajo puede ser limitado. |

---

## 11. Reglas

Estas reglas no pueden violarse en ninguna iteración del diseño o la implementación:

1. Ninguna pantalla de la app muestra precios, costos ni información financiera, sin excepción.
2. Ninguna pantalla muestra el nombre, RUT, teléfono ni email del cliente.
3. Toda acción frecuente se completa en máximo 3 clics desde la pantalla principal.
4. El mecánico solo ve los vehículos que le han sido asignados explícitamente.
5. La app funciona sin conexión; las acciones tomadas offline se sincronizan al recuperar señal.
6. Ninguna acción del mecánico ejecuta trabajo no autorizado. Un hallazgo reportado solo genera una alerta; no desbloquea trabajo.
7. Las evidencias no se guardan en la galería del dispositivo.
8. El servidor nunca envía al cliente de la app un campo que el mecánico no tiene permitido ver.
9. La restricción de visibilidad se implementa en la API, no en el frontend.
10. Ningún trabajo puede marcarse como iniciado si la OT no tiene estado `autorizada` en el servidor.

---

## 12. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| WiFi del taller deficiente o inexistente en área de trabajo | Alta | Alto | Arquitectura offline-first es el diseño base, no un caso de borde |
| Mecánico olvida sincronizar al final del turno | Media | Medio | Sync automático al conectarse; reminder al cerrar app con acciones pendientes |
| Conflicto de asignaciones simultáneas en offline | Baja | Medio | Regla "primero en servidor gana"; notificación clara al afectado |
| Token JWT vencido con app offline por días | Media | Bajo | Sesión local se mantiene; se renueva al reconectar sin perder trabajo |
| Video muy grande bloquea la cola de sync | Media | Medio | Compresión local obligatoria; límite de 30MB por video antes de encolar |
| Dispositivo del mecánico con poca memoria | Media | Medio | TTL en cache local; limpieza de evidencias ya sincronizadas |
| Pérdida del dispositivo con datos no sincronizados | Baja | Alto | Expo SecureStore para auth; datos de trabajo en SQLite local. Sin datos de cliente en el dispositivo, el impacto de seguridad es bajo |

---

## 13. Preguntas abiertas

1. **Dispositivos:** ¿el taller provee los dispositivos a los mecánicos o usan sus teléfonos personales? Si son personales, la política de instalación y actualización es diferente.
2. **Múltiples mecánicos por vehículo:** ¿puede un vehículo tener más de un mecánico asignado simultáneamente (trabajo en paralelo)? El modelo de asignación actual asume uno a la vez.
3. **Registro de tiempo:** ¿el tiempo registrado (inicio/fin de ítem) se usa para calcular costo de mano de obra, o es solo métrica interna? Si afecta facturación, la precisión del timestamp cobra mayor importancia.
4. **Idioma del catálogo de partes:** ¿los repuestos están en español técnico, en inglés (como en muchos catálogos OEM), o mixto? Afecta la usabilidad de la búsqueda en la app.
5. **Fotos mínimas en reparación:** el modelo operacional define fotos mínimas en recepción (4 ángulos). ¿Existe un mínimo definido para reparaciones de alta complejidad?
6. **Hallazgo rechazado:** si el jefe rechaza un hallazgo adicional, ¿el mecánico recibe el motivo del rechazo en la app, o solo la notificación de rechazo?
7. **Offline prolongado:** ¿cuál es el límite aceptable de tiempo offline antes de que los datos locales se consideren obsoletos y se fuerce un pull completo?

---

## 14. Impacto futuro en desarrollo

| Área | Impacto de esta arquitectura |
|---|---|
| **Backend / API** | Debe exponer endpoints dedicados para la app del mecánico con filtros de visibilidad aplicados en servidor. No puede reutilizar los endpoints del panel web sin modificación. |
| **Supabase RLS** | Las políticas de Row Level Security deben incluir una condición por `mechanic_id` y `assigned_vehicle` para que la API no pueda devolver datos fuera de scope aunque el token sea válido. |
| **Modelo de dominio** | La entidad `Hallazgo Adicional` debe existir formalmente en el dominio como tipo de evento que el mecánico puede crear pero no puede ejecutar. |
| **Portal web (jefe de taller)** | Debe mostrar en tiempo real (Supabase Realtime) los hallazgos reportados desde la app y permitir aprobar/rechazar con respuesta que llega como push al mecánico. |
| **IA futura** | Las evidencias con metadata `mechanic_id`, `vehicle_plate` y `event_id` son el corpus de entrenamiento para detección de patrones técnicos. La calidad del pipeline de captura determina la calidad futura del modelo. |
| **Escalabilidad** | El diseño actual soporta un taller con un equipo pequeño de mecánicos. Si All Motors escala a múltiples sucursales, la sincronización debe incluir `org_id` como partición de datos. |
| **Auditoría** | Toda acción del mecánico desde la app queda registrada con timestamp del dispositivo y timestamp del servidor. Esto es el log de auditoría técnica del trabajo realizado. |

---

*Este documento define la arquitectura de la App Mecánico. No describe pantallas ni componentes — eso corresponde al documento de diseño de UI. Toda decisión de implementación debe poder trazarse hasta una regla de negocio en WORKSHOP_OPERATING_MODEL.md o un caso de uso en 14-app-mecanico.md.*
