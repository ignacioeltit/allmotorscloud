# Modelo de Seguridad — All Motors Cloud

**Estado:** Draft  
**Versión:** 1.0  
**Última actualización:** Junio 2026  
**Propósito:** Definir la arquitectura de seguridad del ERP. No contiene código, SQL ni esquemas.

---

## 1. Propósito

Este documento establece las decisiones de seguridad para All Motors Cloud como SaaS multi-tenant chileno. Define cómo se protegen los datos de clientes del taller, vehículos, finanzas e información técnica frente a accesos no autorizados, filtraciones y fraude.

Es la referencia que debe respetar toda decisión de arquitectura técnica, diseño de base de datos y diseño de API.

---

## 2. Alcance

Cubre los tres contextos de acceso del sistema:

| Contexto | Actores | Superficie |
|---|---|---|
| ERP del Taller | Administrador, Jefe de Taller, Recepcionista, Mecánico | Web app Next.js + Supabase |
| Portal del Cliente | Clientes externos (personas naturales o jurídicas) | Web app Next.js (subdominio o ruta separada) |
| App del Mecánico | Mecánicos en terreno | App móvil (PWA u app nativa, fase V1) |

No cubre: integración SII (facturación electrónica), API pública para terceros. Ambas se documentarán por separado cuando se diseñen.

---

## 3. Relación con el Domain Model

El modelo de seguridad es consecuencia directa de las entidades y reglas de negocio del `DOMAIN_MODEL.md`:

- **RUT del Cliente** — dato de identificación nacional. Corresponde a PII bajo Ley 19.628.
- **Patente del Vehículo** — dato público en aislamiento, pero PII cuando está vinculado a un propietario.
- **Historia Técnica del Vehículo** — registro inmutable por diseño de dominio. La seguridad refuerza esa inmutabilidad.
- **Registros Técnicos cerrados** — el dominio los declara inmutables. La arquitectura técnica debe impedirlo a nivel de base de datos, no solo de aplicación.
- **Rol del Mecánico** — el dominio establece que el mecánico no accede a datos financieros ni del cliente. RLS debe hacer cumplir esto, no solo la UI.
- **Organización multi-sucursal** — el tenant es la Empresa (taller), no la Sucursal. El aislamiento opera a nivel de `empresa_id`.

---

## 4. Modelo de amenazas

### Actores de amenaza identificados

| Actor | Motivación | Vector de ataque probable |
|---|---|---|
| Competidor directo | Robar la base de clientes y vehículos de un taller | Ingeniería social hacia usuario interno, phishing al administrador |
| Ex-empleado del taller | Exportar historiales de clientes antes de salir | Sesión activa no revocada, acceso masivo a la API |
| Cliente malintencionado | Acceder a historia técnica de otro vehículo o cliente | Manipulación de parámetros en URLs del Portal Cliente |
| Tercero que intercepta tráfico | Leer datos en tránsito | Red WiFi pública del taller sin HTTPS obligatorio |
| Bot externo | Scraping masivo de datos del taller | API sin rate limiting, endpoints sin autenticación |
| Interno negligente | Accidente con datos reales (borrar, exportar) | Falta de confirmación en acciones destructivas |

### Activos a proteger (por criticidad)

1. RUT y datos personales de clientes (PII legal)
2. Historia Técnica completa de vehículos (confidencialidad comercial)
3. Datos financieros: facturas, pagos, costos de mano de obra y repuestos
4. Credenciales de acceso al sistema
5. Datos de configuración del taller (márgenes, precios, proveedores)
6. Evidencias multimedia (fotos, videos, firmas)

---

## 5. Autenticación

### Flujos por tipo de usuario

#### Usuarios internos del taller (Administrador, Jefe de Taller, Recepcionista, Mecánico)

- Autenticación mediante **magic link** enviado por email (Supabase Auth).
- No se usan contraseñas para usuarios internos. Elimina el vector de contraseñas débiles o reutilizadas.
- El email de invitación lo genera el Administrador desde UC-A01. El usuario no puede auto-registrarse.
- Un usuario desactivado en UC-A01 tiene su registro en Supabase Auth deshabilitado inmediatamente. No solo marcado en la tabla de usuarios.
- El Mecánico en la App accede con el mismo mecanismo. El magic link puede enviarse a email o implementarse como OTP por SMS en V1.

#### Clientes del Portal (UC-PC01)

- Autenticación mediante **email + OTP de 6 dígitos** (Supabase Auth `signInWithOtp`).
- No se crean contraseñas. El cliente no elige usuario ni contraseña.
- El acceso del cliente al Portal solo se habilita cuando el taller lo activa explícitamente. Un cliente sin activación no puede acceder aunque su RUT esté en la base de datos.
- Un cliente del Portal **nunca** tiene acceso a ningún dato de otro cliente.

### Gestión de sesiones

| Parámetro | Valor | Razón |
|---|---|---|
| JWT access token TTL | 1 hora | Balance entre seguridad y UX en uso activo |
| Refresh token TTL | 7 días | Evita reautenticación diaria en uso normal |
| Refresh token TTL — Mecánico app | 30 días | Uso en taller sin teclado, reautenticación disruptiva |
| Revocación de refresh token | Inmediata al desactivar usuario en UC-A01 | No esperar expiración natural |
| Sesión concurrente | Permitida (misma cuenta en múltiples dispositivos) | Recepcionista puede estar en escritorio y tablet |

El refresh token se rota en cada uso (Supabase Rotation habilitado). Un token de refresh usado más de una vez invalida toda la familia de tokens de esa sesión, protegiendo contra robo de token.

---

## 6. Autorización (capas de defensa)

La autorización opera en tres capas. Cada capa es independiente. Un fallo en la capa superior no compromete las capas inferiores.

### Capa 1 — Aplicación (middleware y route guards)

- El middleware de Next.js verifica la sesión de Supabase antes de servir cualquier ruta protegida.
- Las rutas del ERP del Taller y del Portal del Cliente son físicamente separadas (prefijos de ruta o subdominios distintos). Un cliente del Portal nunca ejecuta código del ERP.
- El rol del usuario se lee del JWT claim al cargar la sesión. La UI oculta secciones según el rol, pero la ocultación en UI **no es la defensa real** — es solo UX.
- El Mecánico no ve precios, datos del cliente ni finanzas. Esto se implementa tanto en la UI (no se renderiza) como en los endpoints (no se devuelve).

### Capa 2 — API (validación de org_id en cada request)

- Todo endpoint valido que `org_id` del usuario coincide con el `empresa_id` del recurso solicitado, antes de consultar la base de datos.
- Ningún endpoint acepta `org_id` como parámetro del request. Se extrae siempre del JWT del usuario autenticado.
- Los Supabase Edge Functions aplican esta validación antes de cualquier escritura en la DB, como barrera adicional entre la aplicación y la base de datos.
- Rate limiting por IP y por usuario en todos los endpoints sensibles (búsqueda de clientes, exportación de datos, login).

### Capa 3 — Base de datos (RLS como última defensa)

RLS es la defensa que no puede eludirse, incluso si hay un bug en la aplicación o el middleware.

**Política de aislamiento de tenant:**

Todo registro que pertenece a un tenant tiene una columna `empresa_id`. Las políticas RLS en todas las tablas de datos verifican que `empresa_id = auth.jwt() -> 'empresa_id'`. Un usuario autenticado con el JWT correcto solo puede leer y escribir registros de su propio tenant.

**Políticas por rol (ejemplos representativos):**

| Tabla | Rol Mecánico | Rol Recepcionista | Rol Jefe de Taller | Rol Admin |
|---|---|---|---|---|
| `registros_tecnicos` | SELECT (asignados) / INSERT | SELECT / INSERT / UPDATE | SELECT / UPDATE / DELETE* | Full |
| `clientes` | SELECT (nombre y patente únicamente — via view) | SELECT / INSERT / UPDATE | SELECT | Full |
| `facturas` | Sin acceso | SELECT / INSERT | SELECT | Full |
| `inventario` | SELECT (existencia) | SELECT | SELECT / UPDATE | Full |
| `usuarios` | Sin acceso | Sin acceso | SELECT | Full |

*DELETE en registros técnicos solo aplica a borrado lógico (campo `archivado = true`). Los registros no se eliminan físicamente.

**Inmutabilidad de registros cerrados:**

Un Registro Técnico con `estado = 'cerrado'` no puede actualizarse por ningún rol. Se implementa con un trigger PostgreSQL que rechaza UPDATE cuando `estado_anterior = 'cerrado'`, independientemente del rol. Esto es una invariante del dominio y la DB la hace cumplir.

---

## 7. Manejo de PII y datos sensibles

### Datos PII identificados en el sistema

| Dato | Entidad | Clasificación | Tratamiento |
|---|---|---|---|
| RUT | Cliente, Proveedor, Empresa | PII directo — identifica a una persona natural | Almacenado sin cifrar en DB, pero acceso restringido por RLS. No se expone en logs. |
| Nombre completo | Cliente, Conductor | PII directo | Igual que RUT |
| Teléfono | Cliente, Conductor | PII directo | Igual que RUT |
| Email | Cliente, Usuario | PII directo + credencial de acceso | No se expone en logs de error |
| Dirección | Cliente | PII directo | Igual que RUT |
| Patente del Vehículo | Vehículo | PII contextual (público + propietario = PII) | Tratado como PII cuando está unido a datos del propietario |
| VIN | Vehículo | PII contextual | Igual que patente |

### Regla de minimización

Los endpoints del Mecánico devuelven solo los campos necesarios para la tarea técnica. El nombre del cliente y el RUT no se incluyen en las respuestas de la App del Mecánico. Solo la patente del vehículo y los datos técnicos.

### Anonimización por derecho de supresión

Cuando un cliente solicita la eliminación de sus datos personales (derecho reconocido por Ley 19.628), el sistema anonimiza los campos PII del registro `clientes` pero **no elimina** los Registros Técnicos del Vehículo. El historial técnico es de interés legítimo del taller (garantías, responsabilidad civil). Los Registros Técnicos quedan desvinculados del cliente y atribuidos a "Cliente anonimizado".

---

## 8. Seguridad de archivos y evidencias

Las evidencias (fotos, videos, firmas, PDFs, archivos de scanner OBD) se almacenan en **Supabase Storage con buckets privados**. No existe URL pública permanente para ningún archivo del sistema.

### Acceso a archivos

- El acceso se realiza mediante **signed URLs** con TTL máximo de 1 hora.
- Las signed URLs se generan solo cuando el usuario autenticado tiene permiso sobre el Registro Técnico al que pertenece la evidencia.
- Un cliente del Portal recibe signed URLs solo para los documentos que el taller ha marcado como visibles para el cliente.

### Validación de uploads

Antes de aceptar cualquier archivo se valida:

| Validación | Dónde | Descripción |
|---|---|---|
| MIME type | Cliente + Edge Function | El tipo declarado y el tipo real del contenido deben coincidir (magic bytes) |
| Tamaño máximo | Edge Function | Fotos: 20 MB. Videos: 500 MB. PDFs: 50 MB. Scanner: 10 MB. |
| Extensión permitida | Edge Function | Lista blanca estricta: `.jpg`, `.jpeg`, `.png`, `.webp`, `.mp4`, `.mov`, `.pdf`, `.sig`, `.obdc` |
| Nombre del archivo | Edge Function | Se reemplaza por UUID generado por el sistema. El nombre original se guarda como metadato pero no se usa como path. |

### Consideración sobre virus scanning

En MVP no se implementa antivirus. Los archivos aceptados son de tipos estrictamente controlados (imágenes, video, PDF, archivos de diagnóstico OBD). Se documenta como deuda técnica a resolver en V1, especialmente antes de habilitar la subida de archivos desde el Portal del Cliente.

---

## 9. Auditoría e inmutabilidad

### Arquitectura del log de auditoría

El sistema mantiene una tabla `audit_log` inmutable con la siguiente estructura conceptual:

| Campo | Descripción |
|---|---|
| `id` | UUID generado por el sistema |
| `timestamp` | Timestamp con timezone — nunca se modifica |
| `actor_id` | ID del usuario que realizó la acción (nunca nulo) |
| `actor_rol` | Rol del actor en el momento de la acción |
| `empresa_id` | Tenant al que pertenece el evento |
| `accion` | Código de acción (`CREAR_CLIENTE`, `CERRAR_OT`, `DESACTIVAR_USUARIO`, etc.) |
| `entidad` | Nombre de la tabla o entidad afectada |
| `entidad_id` | ID del registro afectado |
| `estado_anterior` | JSON con valores antes del cambio (para UPDATE) |
| `estado_nuevo` | JSON con valores después del cambio |
| `ip_origen` | IP del request que originó la acción |
| `canal` | `web_erp`, `portal_cliente`, `app_mecanico`, `sistema` |

### Qué se registra obligatoriamente

- Toda creación, modificación y borrado lógico de entidades del dominio.
- Activación y desactivación de usuarios (UC-A01).
- Cambios de rol o permisos (UC-A03).
- Todo acceso a datos financieros (facturas, pagos).
- Exportación de datos (reportes, PDFs).
- Cambios de estado en Registros Técnicos.
- Autorizaciones de clientes (UC-P04).

### Inmutabilidad técnica

La tabla `audit_log` no tiene política RLS de UPDATE ni DELETE para ningún rol, incluido el Administrador. Solo tiene INSERT. Los registros de auditoría no pueden modificarse ni eliminarse desde la aplicación.

---

## 10. Cumplimiento normativo (Ley 19.628)

Chile regula el tratamiento de datos personales mediante la **Ley 19.628 sobre Protección de la Vida Privada** (en proceso de actualización al momento de este documento con el proyecto de ley que crea la Agencia de Protección de Datos Personales).

### Principios aplicados

| Principio | Implementación en All Motors Cloud |
|---|---|
| **Finalidad** | Los datos del cliente se recopilan para la gestión del vehículo. No se usan para marketing de terceros sin consentimiento explícito. |
| **Proporcionalidad** | Solo se recopila lo necesario para operar el taller. No se solicita fecha de nacimiento ni datos bancarios directos. |
| **Consentimiento informado** | Al crear la cuenta en el Portal, el cliente acepta la política de privacidad del taller. El taller es el responsable del tratamiento; All Motors Cloud actúa como encargado. |
| **Derecho de acceso** | El Portal del Cliente permite al cliente ver todos sus datos personales y registros visibles. |
| **Derecho de rectificación** | Un cliente puede solicitar correcciones a sus datos de contacto. Se canaliza por el taller (recepción), no directamente desde el Portal en MVP. |
| **Derecho de supresión** | Ver sección 7 — anonimización. El historial técnico del vehículo es legítimamente retenido por el taller. |
| **Retención de datos** | Los datos PII de clientes inactivos (sin visitas en los últimos 5 años) se marcan para revisión de retención. La decisión final es del Administrador del taller. |

### Responsabilidades

- **All Motors Cloud (plataforma)**: encargado del tratamiento. Implementa las medidas técnicas. Firma acuerdo de procesamiento de datos con el taller.
- **Taller (cliente de la plataforma)**: responsable del tratamiento ante sus clientes. Define qué datos recopila y para qué.

---

## 11. Decisiones principales

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Magic links para usuarios internos, no contraseñas | Contraseñas propias | Contraseñas débiles y reutilizadas son el vector de ataque más común. Magic links eliminan este vector. |
| RLS como defensa de base de datos obligatoria | Solo validación en aplicación | La aplicación puede tener bugs. RLS es la defensa que no puede eludirse. |
| `org_id` extraído del JWT, nunca del request | Pasar `org_id` como parámetro | Parámetros del cliente pueden manipularse. JWT viene del servidor de auth. |
| Buckets privados con signed URLs | URLs públicas con token en query string | Las URLs públicas se filtran en logs, referrer headers y historial del browser. |
| Inmutabilidad del audit_log vía ausencia de políticas UPDATE/DELETE | Soft delete o flags de estado | Un administrador malicioso podría borrar su rastro si existieran esas políticas. |
| Anonimización en lugar de eliminación de datos técnicos | Borrado completo | El historial técnico tiene valor para garantías y responsabilidad civil del taller. |
| Cliente no puede auto-registrarse en el Portal | Auto-registro abierto | Evita cuentas fantasmas y garantiza que solo clientes conocidos accedan. |

---

## 12. Reglas

1. Ningún endpoint devuelve más datos de los que el rol del actor está autorizado a ver, independientemente de los parámetros del request.
2. El `empresa_id` de un usuario nunca se acepta como parámetro de entrada. Siempre se extrae del JWT.
3. Todo archivo subido al sistema recibe un nombre de sistema (UUID). El nombre original nunca es el path de almacenamiento.
4. Las signed URLs de archivos tienen TTL máximo de 1 hora.
5. Un usuario desactivado pierde el acceso en la próxima request. No espera a que expire su JWT.
6. Los Registros Técnicos cerrados no pueden modificarse por ningún mecanismo, incluido el acceso directo a la DB por parte del Administrador desde la aplicación.
7. El log de auditoría no puede modificarse ni eliminarse desde ningún rol de la aplicación.
8. Los datos PII nunca aparecen en logs de error, trazas de stack ni mensajes de respuesta de error a clientes.
9. El Mecánico no recibe datos del cliente ni datos financieros en ninguna respuesta de API.
10. La sesión del Portal del Cliente no tiene acceso a ninguna ruta del ERP interno, ni siquiera de lectura.

---

## 13. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Robo de base de clientes por ex-empleado | Media | Alto | Revocación inmediata de sesión al desactivar usuario. Log de auditoría de accesos masivos. |
| Phishing al Administrador del taller | Media | Crítico | Magic links en lugar de contraseñas. 2FA para el rol Administrador (V1). |
| Acceso del cliente del Portal a datos de otro cliente | Baja | Alto | RLS por `empresa_id` y `cliente_id`. Test automatizado de aislamiento de tenant. |
| Subida de archivo malicioso disfrazado como imagen | Baja | Medio | Validación de magic bytes en Edge Function. Antivirus en V1. |
| Filtración de RUT en logs de error | Media | Medio | Política de sanitización de logs. Variables de entorno para datos sensibles de config. |
| Fuga de datos por integración futura con SII | Desconocida | Alto | La integración SII se diseñará con documento de seguridad propio. |
| Acceso sin conexión del Mecánico con datos en caché | Baja | Medio | El modo offline almacena solo los datos asignados al mecánico. No datos de cliente. |

---

## 14. Preguntas abiertas

1. **2FA para Administrador:** ¿se implementa TOTP (Google Authenticator) o se acepta que el magic link es suficiente para MVP? Supabase Auth soporta TOTP desde la caja.
2. **Aprobación remota de presupuesto (UC-P04):** si el cliente aprueba desde el Portal, ¿esa acción es jurídicamente equivalente a una firma? ¿Se requiere un registro específico en el audit_log con valor probatorio?
3. **Retención de datos:** ¿cuántos años de inactividad antes de proponer al Administrador archivar los datos de un cliente? La Ley 19.628 no define plazos genéricos — depende de la finalidad.
4. **Antivirus en uploads:** ¿se integra ClamAV (open source), un servicio externo (VirusTotal API) o se pospone a V1? El Portal del Cliente sube documentos desde dispositivos que el taller no controla.
5. **Logs de auditoría — retención:** ¿cuánto tiempo se retienen los registros de audit_log? ¿Existe compresión o archivo a cold storage después de N años?
6. **Separación de entorno del Portal y ERP:** ¿subdominio separado (`portal.allmoters.cl` vs `app.allmoters.cl`) o rutas separadas dentro del mismo dominio? Los subdominios permiten políticas de cookies más restrictivas.
7. **Cifrado de PII en reposo:** ¿se cifran columnas sensibles (RUT, teléfono) a nivel de columna PostgreSQL, o se confía en el cifrado del volumen de Supabase (AES-256 en reposo)?

---

## 15. Impacto futuro en desarrollo

- **Todo nuevo endpoint debe incluir validación de `empresa_id` desde el JWT** antes de consultar la DB. Este es el patrón base que no puede omitirse.
- **Toda nueva tabla de datos de dominio requiere una política RLS de aislamiento de tenant** antes de salir a producción. No es opcional post-lanzamiento.
- **La integración con SII para facturación electrónica** requerirá manejo de certificados digitales del taller. Esto implica un gestor de secretos (no variables de entorno planas) y un documento de seguridad propio.
- **La API pública futura** requiere API keys por cliente, con scopes granulares, rate limiting por key y log de uso. No se comparte la autenticación interna con la API pública.
- **El modo offline de la App del Mecánico** debe definir qué datos se almacenan localmente en el dispositivo, con qué cifrado y por cuánto tiempo. Los datos técnicos del vehículo son sensibles incluso sin datos del cliente.
- **Multi-sucursal (UC-A02):** cuando se active, la política RLS de aislamiento de tenant debe decidir si opera a nivel `empresa_id` (acceso cruzado entre sucursales por usuarios con ese permiso) o a nivel `sucursal_id`. Esta decisión tiene impacto en todas las políticas existentes.

---

*Este documento alimenta directamente `DATABASE_MODEL.md`, el diseño de la API y las decisiones de infraestructura en Supabase.*  
*Toda regla de seguridad implementada en código debe poder trazarse hasta una sección de este documento.*
