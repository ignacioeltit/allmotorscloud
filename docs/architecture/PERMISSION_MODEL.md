# Modelo de Permisos (RBAC) — All Motors Cloud

**Estado:** Draft  
**Versión:** 1.0  
**Última actualización:** Junio 2026  
**Propósito:** Definir los roles, permisos y restricciones absolutas de acceso del sistema

---

## 1. Propósito

Este documento define el modelo completo de Control de Acceso Basado en Roles (RBAC) para All Motors Cloud. Responde: quién puede ver qué, quién puede hacer qué, qué restricciones son absolutas y cómo se implementan en cada capa del sistema.

El modelo de permisos es una restricción de primer nivel. Ninguna decisión de diseño de base de datos, API o interfaz puede violarla.

---

## 2. Alcance

Aplica a todos los actores con acceso al sistema:
- Los cinco roles internos del taller (admin, jefe_taller, recepcionista, mecanico, cliente_portal).
- Toda entidad definida en `DOMAIN_MODEL.md`.
- Toda acción definida en `USE_CASE_MODEL.md`.
- Toda capa técnica: base de datos, API, interfaz de usuario.

No aplica a actores externos sin sesión (acceso público) ni a integraciones automáticas de sistema (cron jobs, webhooks), que operan con un token de servicio separado con permisos explícitos mínimos.

---

## 3. Relación con el Domain Model

| Entidad del Domain Model | Recurso en este modelo |
|---|---|
| Vehículo | `vehiculo` |
| Historia Técnica / Evento | `historia_tecnica`, `evento` |
| Orden de Trabajo | `ot` |
| Diagnóstico, Presupuesto, Autorización, Reparación | `evento` (subtipo) |
| Control de Calidad | `control_calidad` |
| Factura, Pago | `factura`, `pago` |
| Garantía, Recomendación Pendiente | `garantia`, `recomendacion` |
| Cliente, Conductor, Propietario | `cliente` |
| Usuario, Rol | `usuario`, `configuracion` |
| Inventario, Repuesto, Proveedor, Compra | `inventario`, `proveedor` |
| Empresa / Taller, Sucursal | `organizacion` |

---

## 4. Roles del sistema

### 4.1 Descripción de cada rol

**admin**
Administrador de la organización. Gestiona usuarios, facturación, configuración del taller y reportes financieros. Tiene acceso completo dentro de su organización. No puede acceder a datos de otras organizaciones bajo ninguna circunstancia.

**jefe_taller**
Supervisión técnica y operativa. Asigna mecánicos, aprueba controles de calidad, accede a toda la información financiera y técnica. Es el único rol que puede aprobar el control de calidad y no puede aprobar su propio trabajo.

**recepcionista**
Operación de front-desk. Gestiona el flujo completo del cliente: recepción, presupuestos, autorizaciones, entregas y cobros. Ve datos financieros y del cliente. No puede aprobar el control de calidad ni gestionar usuarios.

**mecanico**
Trabajo técnico exclusivo. Ve solo los vehículos y trabajos que le están asignados. No tiene acceso a precios, facturas, datos del cliente ni información de pago bajo ninguna circunstancia.

**cliente_portal**
Acceso externo de solo lectura. Ve únicamente los vehículos asociados a su cuenta, el estado de las OTs activas, y el historial filtrado que el taller ha decidido mostrar. No puede ver datos de otros clientes ni información interna del taller.

### 4.2 Jerarquía y herencia

No existe herencia automática entre roles. Cada rol tiene permisos explícitos. La jerarquía es conceptual, no técnica:

```
admin
  └── acceso completo a la organización (excepto datos de otras organizaciones)
jefe_taller
  └── todo lo técnico + todo lo financiero + control de calidad
recepcionista
  └── todo el flujo de atención + datos del cliente + datos financieros
mecanico
  └── solo trabajo técnico asignado, sin datos del cliente ni financieros
cliente_portal
  └── solo lectura de sus propios vehículos, filtrada
```

---

## 5. Matriz de permisos por recurso

Leyenda: **R** = leer | **W** = crear/modificar | **D** = eliminar/cancelar | **—** = sin acceso

"Eliminar" en este sistema significa siempre **cancelar con registro**, nunca borrado físico (ver reglas de inmutabilidad).

| Recurso | admin | jefe_taller | recepcionista | mecanico | cliente_portal |
|---|:---:|:---:|:---:|:---:|:---:|
| **vehiculo** — datos del vehículo (patente, VIN, marca, modelo, año) | RW | RW | RW | R (solo asignados) | R (solo propios) |
| **historia_tecnica** — vista de todos los registros del vehículo | RWD | RW | RW | R (solo asignados, filtrada) | R (solo propios, filtrada) |
| **evento** — registro técnico (diagnóstico, reparación, observación) | RWD | RW | R | RW (solo asignados, no cerrar) | R (filtrado por taller) |
| **ot** — orden de trabajo (apertura, estado, cierre) | RWD | RW | RW | R | R (solo estado) |
| **presupuesto** — contenido económico del presupuesto | RW | RW | RW | — | R (versión enviada) |
| **autorizacion** — registro de decisión del cliente | RW | RW | RW | — | R (la propia) |
| **control_calidad** — aprobación antes de notificar al cliente | RW | RW (aprobar) | R | R (ver estado) | — |
| **cliente** — datos completos (nombre, RUT, teléfono, email, dirección) | RW | RW | RW | — | R (solo los propios) |
| **factura** — documento fiscal emitido | RW | R | RW | — | R (las propias) |
| **pago** — registro de cobro y forma de pago | RW | R | RW | — | R (los propios) |
| **garantia** — cobertura sobre trabajo realizado | RW | RW | RW | R (solo informativa) | R (las propias) |
| **recomendacion** — trabajo rechazado pendiente | RW | RW | RW | R (en vista del vehículo) | R (las propias) |
| **inventario** — stock de repuestos y materiales | RW | R | R | R (nombre/código, sin precios) | — |
| **proveedor** — datos de proveedor y condiciones de pago | RW | R | R | — | — |
| **compra** — órdenes de compra a proveedores | RW | R | R | — | — |
| **usuario** — gestión de cuentas y roles | RW | R | — | — | — |
| **organizacion** — configuración del taller, sucursales, billing | RW | R | — | — | — |
| **reportes_financieros** — ingresos, cuentas por cobrar, márgenes | RW | R | R (parcial, ver §7) | — | — |
| **reportes_tecnicos** — tiempos, productividad, garantías reclamadas | RW | RW | R | — | — |
| **audit_log** — registro de eventos del sistema | R | R | — | — | — |

---

## 6. Restricciones absolutas por rol

Estas restricciones no se configuran ni se negocian. Son invariantes del sistema.

### mecanico — lo que NUNCA puede ver ni hacer

- Precios de cualquier repuesto o material.
- Totales, subtotales o cualquier cifra económica del presupuesto.
- Facturas o boletas, emitidas o no.
- Registros de pago o información sobre forma de pago.
- RUT del cliente.
- Nombre completo del cliente (solo se le muestra la patente del vehículo y el alias del trabajo).
- Teléfono, email o dirección del cliente.
- Información de proveedores o precios de compra.
- Cerrar una Orden de Trabajo.
- Aprobar un Control de Calidad (ni siquiera el propio trabajo).
- Crear o modificar un presupuesto.
- Registrar una autorización del cliente.

### jefe_taller — restricciones específicas

- No puede aprobar el Control de Calidad de un trabajo que él mismo realizó (regla del `WORKSHOP_OPERATING_MODEL.md`, sección 4.8).
- No puede gestionar usuarios ni cambiar configuración de la organización.

### recepcionista — restricciones específicas

- No puede aprobar el Control de Calidad.
- No puede gestionar usuarios ni cambiar configuración de la organización.
- No puede ver reportes de productividad por mecánico (dato sensible de RRHH, reservado a admin y jefe_taller).

### cliente_portal — restricciones absolutas

- Solo ve sus propios vehículos. La consulta de un vehículo ajeno retorna 404, no 403.
- No ve datos de otros clientes bajo ninguna circunstancia.
- No ve precios ni condiciones del presupuesto más allá del total aprobado.
- No ve diagnósticos internos (marcados como privados por el taller).
- No puede modificar ningún dato.

### Todos los roles — restricción de organización

- Un usuario de la organización A nunca accede a datos de la organización B.
- Esta restricción se aplica en la capa de base de datos (RLS) y no puede ser superada por ningún rol, incluido `admin`.

---

## 7. Permisos a nivel de campo (field-level visibility)

Algunos recursos tienen campos con visibilidad diferenciada por rol.

### Entidad `cliente`

| Campo | admin | jefe_taller | recepcionista | mecanico | cliente_portal |
|---|:---:|:---:|:---:|:---:|:---:|
| nombre_completo | visible | visible | visible | **oculto** | propio |
| rut | visible | visible | visible | **oculto** | propio |
| telefono | visible | visible | visible | **oculto** | propio |
| email | visible | visible | visible | **oculto** | propio |
| direccion | visible | visible | visible | **oculto** | propio |

Al mecánico se le muestra la patente del vehículo y el alias del trabajo ("Mantención mayor — ABCD12"), nunca el nombre del cliente.

### Entidad `presupuesto` / `evento` tipo presupuesto

| Campo | admin | jefe_taller | recepcionista | mecanico | cliente_portal |
|---|:---:|:---:|:---:|:---:|:---:|
| lista de ítems (descripción) | visible | visible | visible | visible (sin precios) | visible (versión cliente) |
| precio_unitario por ítem | visible | visible | visible | **oculto** | **oculto** |
| subtotal, total, impuestos | visible | visible | visible | **oculto** | total aprobado |
| descuentos y motivo | visible | visible | visible | **oculto** | **oculto** |
| márgenes internos | visible | **oculto** | **oculto** | **oculto** | **oculto** |

### Entidad `inventario` / `repuesto`

| Campo | admin | jefe_taller | recepcionista | mecanico | cliente_portal |
|---|:---:|:---:|:---:|:---:|:---:|
| código y descripción | visible | visible | visible | visible | — |
| precio_costo | visible | **oculto** | **oculto** | **oculto** | — |
| precio_venta | visible | visible | visible | **oculto** | — |
| stock_actual | visible | visible | visible | visible (cantidad) | — |

### Entidad `reportes_financieros`

El rol `recepcionista` accede a: ingresos del día, OTs pendientes de cobro y facturas emitidas.  
No accede a: márgenes por trabajo, costo de repuestos, rentabilidad por mecánico.

---

## 8. Cómo se implementan los permisos (capas)

Los permisos se implementan en cuatro capas. Todas son necesarias; ninguna es suficiente sola.

### 8.1 RLS en PostgreSQL (Row-Level Security)

Primera línea de defensa. Opera en la base de datos antes de que el código de aplicación vea los datos.

- Toda tabla tiene políticas RLS que filtran por `org_id` del usuario autenticado.
- Las tablas con datos sensibles (cliente, pago, factura) tienen políticas adicionales que bloquean al rol `mecanico` a nivel de fila.
- El campo `mecanico_asignado_id` en la tabla `ot` determina qué OTs son visibles para un mecánico.
- Los campos financieros no se seleccionan en las queries autorizadas al rol `mecanico`; la política RLS usa columnas de retorno, no solo filas.
- El rol `cliente_portal` tiene políticas que filtran por `cliente_id` del usuario autenticado.

### 8.2 Middleware en Next.js

Segunda capa. Verifica la sesión y el rol antes de ejecutar cualquier Server Action o Route Handler.

- Todo endpoint de API verifica el JWT y extrae el rol.
- Las rutas de API se protegen por rol con un guard explícito (`requireRole(['admin', 'jefe_taller'])`).
- Las rutas del Portal Cliente están en un layout separado con guard `requireRole(['cliente_portal'])`.
- Ninguna ruta de API devuelve datos si el middleware rechaza la sesión; retorna 401 o 403 según el caso.

### 8.3 Filtrado en respuestas de API

Tercera capa. Aunque RLS filtre filas, los campos sensibles se eliminan del payload de respuesta según el rol.

- Los serializers del API tienen variantes por rol: `clienteParaMecanico()` omite RUT, nombre, teléfono.
- `presupuestoParaMecanico()` omite todos los campos de precio.
- `inventarioParaMecanico()` omite `precio_costo` y `precio_venta`.
- Esta capa protege contra errores en RLS y evita fugas accidentales por joins o views.

### 8.4 Ocultamiento en UI

Cuarta capa. No es seguridad (un usuario técnico podría inspeccionar el HTML), pero es la que el usuario experimenta. La UI no muestra componentes, secciones ni botones para acciones que el rol no puede ejecutar.

- El mecánico no ve el tab "Presupuesto" ni la sección "Cliente" en la ficha de la OT.
- El botón "Aprobar Control de Calidad" no aparece para mecánicos ni recepcionistas.
- El menú de navegación muestra solo los módulos accesibles para el rol activo.
- Los campos de precio se reemplazan por un guion (—) en lugar de estar vacíos, para no insinuar que el dato existe.

---

## 9. Casos especiales

**Jefe de taller que también repara:** si el jefe_taller registra trabajo en una OT (actúa como mecánico), no puede aprobar el Control de Calidad de esa misma OT. El sistema bloquea la acción con mensaje explícito: "No puedes aprobar el control de calidad de un trabajo que realizaste". Requiere que otro usuario con permiso lo apruebe.

**Recepcionista que registra autorización verbal:** la recepcionista puede registrar una autorización verbal del cliente. El sistema exige que quede registrado: nombre de quien recibe, nombre del cliente, canal y hora. No es posible omitir estos campos.

**Mecánico que reporta hallazgo adicional:** el mecánico puede crear un registro de hallazgo adicional (acción de escritura limitada), pero no puede crear ni modificar el presupuesto ni registrar la autorización. El hallazgo genera una alerta para el jefe_taller, quien gestiona el resto.

**Descuentos en presupuesto:** requieren que quien los aplica sea `recepcionista` o `jefe_taller`. La acción registra automáticamente: quién aplicó el descuento, el motivo y el monto. Sin estos datos, la acción es bloqueada.

**Cancelación de evento inmutable:** un Registro Técnico cerrado no puede editarse. La cancelación (con anotación de motivo) solo puede realizarla `jefe_taller` o `recepcionista`, nunca `mecanico`. Se crea un nuevo Registro de Corrección que referencia al original.

**Portal del cliente y cambio de propietario:** el nuevo propietario del vehículo accede al historial técnico desde su fecha de vinculación. El historial anterior es visible para el taller pero no para el cliente_portal hasta que se defina la política (ver Preguntas abiertas).

---

## 10. Decisiones principales

1. **No hay herencia de roles.** Cada rol es explícito. Facilita auditoría y reduce errores por herencia no intencional.

2. **El mecánico no ve el nombre del cliente, solo la patente.** Decisión del `WORKSHOP_OPERATING_MODEL.md`, sección 9. El sistema refuerza esto técnicamente, no solo con política interna.

3. **Los campos financieros se filtran en tres capas independientes** (RLS, API, UI) porque una fuga en precios de costo o márgenes es un riesgo de negocio crítico.

4. **El cliente_portal retorna 404 para vehículos ajenos, no 403.** Evita enumerar qué vehículos existen en el sistema.

5. **Los permisos a nivel de campo son explícitos en los serializers de API**, no inferidos dinámicamente. Esto hace el comportamiento predecible y auditabe.

6. **La restricción de organización (org_id) es la más prioritaria.** Se aplica en RLS antes que cualquier permiso de rol. Un admin de la organización A es un usuario sin acceso en la organización B.

---

## 11. Reglas

1. El mecánico nunca accede a precios, facturas, pagos ni datos personales del cliente. Sin excepciones.
2. El Control de Calidad de una OT no puede ser aprobado por quien realizó los trabajos de esa OT.
3. La entrega del vehículo está bloqueada mientras el pago no esté resuelto. El sistema lo impone, no lo advierte.
4. Ningún trabajo puede iniciarse sin autorización documentada. El sistema bloquea la creación del Registro de Reparación sin Registro de Autorización cerrado y aprobado.
5. Los Registros Técnicos cerrados son inmutables. Solo se cancelan con nuevo Registro de Corrección.
6. Un usuario no puede acceder a datos de otra organización. Esta restricción prevalece sobre cualquier permiso de rol.
7. Los descuentos en presupuesto requieren actor identificado y motivo registrado.
8. La notificación de "vehículo listo" al cliente es automática solo tras Control de Calidad aprobado. No puede dispararse manualmente.

---

## 12. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|:---:|:---:|---|
| Un bug en el serializer expone precio al mecánico | Media | Alto | Tres capas independientes; RLS como red de seguridad final |
| Jefe_taller aprueba su propio trabajo por error de código | Baja | Alto | Validación en DB (trigger), API (guard) y UI (botón deshabilitado con razón) |
| Cliente_portal accede a vehículo ajeno por error de sesión | Baja | Muy alto | RLS por cliente_id; 404 en lugar de 403; test de aislamiento en CI |
| Admin desactiva RLS por error de migración | Baja | Crítico | Las migraciones requieren revisión explícita de políticas RLS; no se deshabilita RLS en tablas de datos |
| Token de servicio (cron/webhook) con permisos excesivos | Media | Alto | Token de servicio con permisos mínimos explícitos, revisados en cada uso |

---

## 13. Preguntas abiertas

1. **Historial del vehículo para nuevo propietario (cliente_portal):** ¿ve todo el historial anterior o solo desde su fecha de adquisición? Decisión pendiente (ver `DOMAIN_MODEL.md`, pregunta 1).

2. **Visibilidad de registros internos en el Portal Cliente:** ¿quién decide qué Registros Técnicos son visibles al cliente? ¿El taller configura por tipo de evento o por registro individual? Decisión pendiente (ver `USE_CASE_MODEL.md`, pregunta 9).

3. **Jefe_taller con restricción de aprobación propia:** si el jefe_taller realizó solo una parte del trabajo y otra la realizó un mecánico, ¿puede aprobar el control de calidad de los ítems que no realizó? Requiere granularidad por ítem en el registro de trabajo.

4. **Rol configurable por taller:** el `USE_CASE_MODEL.md` (UC-A03) prevé que el admin pueda ajustar permisos de un rol. ¿Qué restricciones absolutas no son configurables? Las restricciones de la sección 6 de este documento son no configurables. El resto puede ser materia de configuración futura.

5. **Recepcionista y acceso a márgenes:** hoy la recepcionista accede a ingresos e historial de cobros. Si el taller tiene una recepcionista que también cumple rol de administradora de facto, ¿se crea un rol intermedio o se amplían los permisos del rol `recepcionista`?

---

## 14. Impacto futuro en desarrollo

**Base de datos:** toda tabla nueva debe incluir `org_id` y políticas RLS que filtren por organización desde su creación. Las tablas con datos financieros o de cliente deben incluir políticas por rol desde el primer commit.

**API:** cada endpoint nuevo debe declarar explícitamente qué roles lo pueden invocar. No existe endpoint sin guardia de rol. Los serializers de respuesta deben tener variantes por rol para todos los campos sensibles.

**UI:** los componentes que muestran datos financieros o del cliente deben recibir el rol como prop y aplicar el filtrado en su interior. No se usan condicionales `if (rol === 'mecanico')` dispersos; se encapsulan en helpers de visibilidad.

**Tests:** el modelo de permisos requiere tests de aislamiento: verificar que un token de mecánico no puede obtener datos de precio ni de cliente, aunque use endpoints no documentados. Estos tests son parte del CI y no son opcionales.

**Migración desde TallerGP:** los datos migrados deben asignarse a `org_id` y a `cliente_id` correctos antes de activar RLS. Un dato sin `org_id` es inasequible para cualquier usuario tras la activación.

---

*Este documento se actualiza cuando se agrega un rol, un recurso nuevo o una restricción de negocio.*  
*Toda decisión de base de datos, API o UI que involucre acceso a datos debe poder trazarse hasta una regla documentada aquí.*
