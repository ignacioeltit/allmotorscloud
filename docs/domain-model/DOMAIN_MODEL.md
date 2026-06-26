# Domain Model — All Motors Cloud

**Estado:** Draft  
**Versión:** 1.0  
**Última actualización:** Junio 2026  
**Propósito:** Definir las entidades del universo de All Motors Cloud, sus significados, relaciones y reglas de negocio

---

## Tabla de Contenidos

1. [Propósito del Domain Model](#1-propósito-del-domain-model)
2. [Filosofía del dominio](#2-filosofía-del-dominio)
3. [Entidades núcleo](#3-entidades-núcleo)
4. [Entidades operativas](#4-entidades-operativas)
5. [Entidades de evidencia](#5-entidades-de-evidencia)
6. [Entidades comerciales](#6-entidades-comerciales)
7. [Entidades de inventario](#7-entidades-de-inventario)
8. [Entidades de organización](#8-entidades-de-organización)
9. [Entidades de migración](#9-entidades-de-migración)
10. [Relaciones principales](#10-relaciones-principales)
11. [Reglas de negocio](#11-reglas-de-negocio)
12. [Invariantes del dominio](#12-invariantes-del-dominio)
13. [Qué NO debe modelarse como entidad principal](#13-qué-no-debe-modelarse-como-entidad-principal)
14. [Diferencias con TallerGP](#14-diferencias-con-tallergp)
15. [Preguntas abiertas](#15-preguntas-abiertas)
16. [Impacto futuro en la base de datos](#16-impacto-futuro-en-la-base-de-datos)

---

## 1. Propósito del Domain Model

Este documento define qué entidades existen en All Motors Cloud, qué significa cada una, cómo se relacionan y qué reglas deben cumplir.

No contiene código, esquema de base de datos, SQL ni Prisma.

Es la referencia que todos los demás documentos técnicos deben respetar:

| Documento | Qué hereda de este modelo |
|---|---|
| `DATABASE_MODEL.md` | Las entidades, sus atributos y relaciones |
| Backend | Las reglas de negocio e invariantes |
| API | El vocabulario de recursos y operaciones |
| Frontend / App | Los conceptos que el usuario ve y manipula |
| Portal del Cliente | Las entidades visibles al cliente externo |
| IA | Las entidades sobre las que se razona y predice |
| Migración | Las correspondencias entre TallerGP y este modelo |

---

## 2. Filosofía del dominio

All Motors Cloud está organizado alrededor del **Vehículo**, no de la Orden de Trabajo.

La jerarquía conceptual es:

```
Vehículo
  └── Historia Técnica del Vehículo
        └── Registros Técnicos  (= Eventos internamente)
              └── Evidencias / Documentos / Acciones
```

La **Historia Técnica del Vehículo** es el concepto más importante del sistema. Es la biografía del vehículo. Comienza cuando el vehículo se registra por primera vez y no termina nunca. Cambia de propietario, cambia de dueño, pero la Historia Técnica permanece intacta y completa.

Los **Registros Técnicos** son las entradas de esa biografía. El sistema los llama "Eventos" internamente. El usuario los ve como "Registros" o "Entradas de la Historia Técnica". No son formularios. Son momentos que importaron en la vida del vehículo.

La **Orden de Trabajo** no es el centro. Es un documento operativo y legal que agrupa ciertos registros de una visita que tiene consecuencias económicas. Muchos registros existen sin Orden de Trabajo.

---

## 3. Entidades núcleo

### Vehículo

El Vehículo es la entidad principal del sistema. Todo lo demás gira a su alrededor.

Un vehículo se identifica principalmente por su **patente**. El VIN (número de chasis) es un identificador complementario cuando está disponible.

**Propiedades que lo definen:** patente, VIN, marca, modelo, año, color, tipo (auto, camioneta, furgón, moto).

**Regla fundamental:** un Vehículo nunca pierde su Historia Técnica, incluso si cambia de propietario. El historial es del vehículo, no del cliente.

**Ejemplo con SRDV88:** la patente SRDV88 identifica un vehículo específico con 5.449 eventos operacionales acumulados desde su primer ingreso al taller. Ese historial seguirá perteneciendo al vehículo aunque lo compre otra persona.

---

### Historia Técnica del Vehículo

La Historia Técnica del Vehículo es la biografía completa del vehículo dentro del sistema.

Se crea automáticamente cuando un Vehículo se registra por primera vez. Crece con cada Registro Técnico. Nunca se elimina. No puede transferirse ni separarse del vehículo.

La Historia Técnica **no es una lista de Órdenes de Trabajo**. Es la secuencia cronológica de todo lo que ocurrió con el vehículo: consultas, diagnósticos, presupuestos aceptados y rechazados, reparaciones, garantías, alertas de mantención, seguimientos y cualquier otro registro.

Un mecánico que abre la Historia Técnica del vehículo SRDV88 ve inmediatamente: cuándo ingresó por última vez, qué se hizo, qué se recomendó y no se hizo, si hay garantías vigentes, y si hay trabajos rechazados pendientes de revisión.

---

### Registro Técnico (Evento)

Un Registro Técnico es cualquier momento significativo en la vida de un vehículo que merece quedar documentado.

**Nombre para el usuario:** "Registro" o "Entrada de la Historia Técnica".  
**Nombre interno del sistema:** "Evento".

Ambos términos se refieren a lo mismo. En la interfaz visible al usuario se prefiere "Registro". En la arquitectura del sistema se usa "Evento".

Todo Registro Técnico tiene:
- Un **tipo** (Diagnóstico, Reparación, Garantía, Consulta, etc. — ver `EVENT_MODEL.md`)
- Un **estado** (Creado → Pendiente → Asignado → En ejecución → En espera → Finalizado → Cerrado)
- Un **responsable** (persona o sistema que lo gestiona)
- Una **marca de tiempo** en cada cambio de estado
- Cero o más **Evidencias** adjuntas

**Regla crítica:** un Registro Técnico cerrado es **inmutable**. Si existe un error, se crea un nuevo Registro de tipo "Corrección" que referencia al original. El registro original permanece tal como fue cerrado.

---

### Cliente

El Cliente es la persona natural o jurídica que tiene una relación comercial con el taller para un vehículo específico.

En la mayoría de los casos, el Cliente es el propietario legal del vehículo. Pero no siempre:
- Una **empresa** puede ser el Cliente que paga, aunque el vehículo sea de un empleado.
- Una **aseguradora** puede ser el Cliente que autoriza y paga, aunque el propietario sea otra persona.

Un Cliente puede estar asociado a múltiples Vehículos. Un Vehículo puede tener distintos Clientes a lo largo del tiempo (cuando hay cambio de propietario).

**Propiedades que lo definen:** nombre completo o razón social, RUT, teléfono, email, dirección.

---

### Propietario

El Propietario es el rol que ejerce un Cliente cuando es el dueño legal de un Vehículo específico.

La distinción existe porque el propietario legal de un vehículo puede diferir de quien paga la reparación (una aseguradora) o de quien trae el auto (un empleado, familiar o tercero).

El sistema registra quién fue el Propietario en cada momento. Si el vehículo cambia de dueño, el nuevo propietario queda registrado, pero el historial completo anterior permanece visible para el taller.

**Pregunta abierta:** ¿el nuevo propietario accede al historial completo o solo desde su fecha de compra? Ver sección 15.

---

### Conductor

El Conductor es la persona que físicamente trae el vehículo al taller. Puede ser el propietario, un familiar, un empleado o cualquier tercero autorizado.

El sistema registra al Conductor de cada visita porque es la persona de contacto durante esa atención. No es necesariamente quien autoriza el trabajo ni quien paga.

**Propiedades:** nombre, teléfono de contacto durante la visita.

---

### Usuario

Un Usuario es cualquier persona del taller que tiene acceso al sistema All Motors Cloud.

Todo Usuario tiene un **Rol** que determina qué puede ver y hacer. Los roles actuales son: Administrador, Jefe de Taller, Mecánico, Recepcionista.

Un Usuario no es lo mismo que un Cliente. Los clientes acceden al Portal del Cliente con un tipo de acceso diferente y más limitado.

---

### Mecánico

El Mecánico es un Usuario con acceso al trabajo técnico. Puede ver los Registros Técnicos que le están asignados, registrar diagnósticos, registrar reparaciones, reportar hallazgos adicionales y adjuntar evidencias de trabajo.

El Mecánico **no accede** a información financiera, datos del cliente más allá del nombre y patente, ni puede cerrar Órdenes de Trabajo.

---

### Recepcionista

La Recepcionista es un Usuario con acceso a la operación de front-desk. Puede registrar vehículos, abrir y cerrar registros de recepción, presentar presupuestos al cliente, gestionar autorizaciones, notificar al cliente y coordinar entregas.

---

### Jefe de Taller

El Jefe de Taller es un Usuario con permisos de supervisión. Puede asignar vehículos a mecánicos, aprobar diagnósticos, recibir alertas de hallazgos, realizar o supervisar controles de calidad, y autorizar ciertos trabajos adicionales de bajo monto sin necesidad de contactar al cliente (si la política del taller lo permite).

---

## 4. Entidades operativas

Estas entidades representan actividades concretas del flujo de atención del vehículo. Cada una es un tipo de Registro Técnico.

| Entidad | Qué representa | ¿Tiene OT? | Responsable típico |
|---|---|---|---|
| Orden de Trabajo | Documento legal/comercial que agrupa registros de una visita con consecuencia económica | — es la OT | Recepción |
| Diagnóstico | Evaluación técnica del problema. Base del presupuesto. | Sí | Mecánico |
| Presupuesto | Propuesta económica formal. Detalla partes, mano de obra y costos totales. | Sí | Recepción / Jefe |
| Autorización | Decisión del cliente sobre el presupuesto. Registra quién, cómo y qué aprobó. | Sí | Cliente → registra Recepción |
| Reparación | Ejecución de trabajo autorizado. Registra partes usadas, trabajo realizado, hallazgos. | Sí | Mecánico |
| Control de Calidad | Verificación del trabajo antes de notificar al cliente. | Sí | Jefe de Taller |
| Entrega | Devolución formal del vehículo con pago, firma y condiciones de garantía. | Sí | Recepción |
| Seguimiento | Contacto post-entrega: satisfacción, recordatorio de mantención, reclamo. | No | Sistema / Recepción |

**Nota sobre el Presupuesto:** puede tener múltiples versiones si el cliente solicita modificaciones. Cada versión es un Registro Técnico nuevo que referencia al anterior. Solo existe una versión activa a la vez.

**Nota sobre la Autorización:** los ítems rechazados quedan registrados como **Recomendaciones Pendientes** en la Historia Técnica. Aparecerán en la próxima visita del vehículo.

---

## 5. Entidades de evidencia

Toda Evidencia pertenece a un Registro Técnico. No existe evidencia flotante sin registro asociado.

| Entidad | Descripción | Cuándo se usa típicamente |
|---|---|---|
| Fotografía | Imagen del vehículo o de una falla específica | Recepción, Diagnóstico, Reparación, Entrega |
| Video | Grabación que muestra un problema, una prueba de ruta o un proceso | Diagnóstico, Prueba de Ruta |
| Firma | Firma digital o fotografía de firma física del cliente | Autorización, Recepción, Entrega |
| PDF | Documento generado: presupuesto, factura, certificado, OT impresa | Presupuesto, Entrega, Garantía |
| Scanner | Archivo con resultado de diagnóstico electrónico OBD | Escaneo Electrónico, Diagnóstico |
| Archivo | Cualquier archivo adjunto que no encaja en las categorías anteriores | Cualquier registro |
| Mensaje | Captura de mensaje de autorización (WhatsApp, email, SMS) | Autorización remota |

---

## 6. Entidades comerciales

| Entidad | Qué es | Relación con el dominio |
|---|---|---|
| Factura | Documento fiscal (boleta o factura) emitido al cliente | Se genera al cerrar la Entrega. Referencia la OT. |
| Pago | Registro de un cobro efectuado | Un cliente puede pagar en partes. Cada pago es un registro. |
| Cotización | Estimación informal de costos sin diagnóstico completo | No requiere vehículo en el taller. No genera OT por sí sola. |
| Recomendación Pendiente | Trabajo identificado pero no autorizado por el cliente | Persiste en la Historia Técnica indefinidamente. Aparece en cada visita. |
| Garantía | Cobertura sobre un trabajo realizado, con alcance y duración definidos | Referencia obligatoria a la Reparación original. |

**La Recomendación Pendiente es una entidad de primera clase.** No es un comentario. No es una nota. Es un trabajo que el sistema recuerda activamente y muestra al mecánico en la próxima visita del vehículo.

---

## 7. Entidades de inventario

| Entidad | Qué es |
|---|---|
| Repuesto | Una parte o componente que puede instalarse en un vehículo. Tiene código, nombre, fabricante. |
| Material | Un insumo consumible (aceite, líquidos, filtros desechables). Tratado igual que Repuesto en inventario. |
| Inventario | El stock disponible de cada Repuesto/Material en una Sucursal. Incluye cantidad actual y nivel mínimo. |
| Movimiento de Stock | Registro de cada cambio en el inventario: ingreso por compra, egreso por uso en reparación, ajuste manual, devolución. |
| Proveedor | Empresa o persona que suministra Repuestos y Materiales. Tiene condiciones de pago y tiempo de entrega habitual. |
| Compra | Orden de compra emitida a un Proveedor. Puede originarse de una necesidad detectada en una Reparación específica. |

Un **Movimiento de Stock** siempre referencia: qué Repuesto, cuántas unidades, en qué dirección (ingreso/egreso), y opcionalmente cuál Reparación lo originó.

---

## 8. Entidades de organización

| Entidad | Qué es |
|---|---|
| Empresa / Taller | La organización que opera All Motors Cloud. Tiene nombre, RUT, logo, información legal. |
| Sucursal | Una ubicación física del taller. Una Empresa puede tener varias Sucursales. Cada una tiene su propio inventario y equipo. |
| Rol | Un conjunto de permisos asociados a un tipo de Usuario. Roles actuales: Administrador, Jefe de Taller, Mecánico, Recepcionista. |
| Permiso | Una capacidad específica que un Rol puede o no tener. Ejemplo: "puede cerrar OT", "puede ver reportes financieros". |

**Nota sobre multi-taller:** All Motors SPA opera actualmente con una sola sucursal. El modelo soporta múltiples sucursales desde el inicio para no limitar el crecimiento futuro.

---

## 9. Entidades de migración

Estas entidades son temporales. Existen para preservar la trazabilidad entre los datos importados de TallerGP y su equivalente en All Motors Cloud.

| Entidad de migración | Qué preserva | Ejemplo real |
|---|---|---|
| TallerGP Customer ID | ID opaco del cliente en TallerGP | `7ps...` |
| TallerGP Vehicle ID | ID opaco del vehículo en TallerGP | `9g3...` |
| TallerGP Repair Order ID | ID opaco de la orden de trabajo en TallerGP | `xd0...` |
| TallerGP Invoice ID | ID opaco de la factura en TallerGP | `8fu...` |
| TallerGP PDF URL | URL del documento PDF en CDN de TallerGP | `d31bmy06rjbdnm.cloudfront.net/56142/pdfs/...` |

**Por qué son necesarias:** si durante o después de la migración surge una discrepancia, el equipo debe poder rastrear cualquier entidad de All Motors Cloud hasta su origen en TallerGP. Sin estos IDs, la migración sería una caja negra.

**Cuándo se eliminan:** estos campos pueden archivarse (no eliminarse) una vez que la migración esté completamente validada y el taller deje de usar TallerGP.

Los **PDF URLs de TallerGP** son especiales: los archivos físicos deben descargarse y almacenarse en el sistema propio de All Motors Cloud antes de que TallerGP sea dado de baja, para que no se pierdan como evidencia histórica.

---

## 10. Relaciones principales

```
Vehículo  1 ──── 1  Historia Técnica del Vehículo
                        │
                        ├── N  Registros Técnicos (Eventos)
                        │         │
                        │         ├── 1  Tipo de Evento
                        │         ├── 1  Responsable (Usuario)
                        │         ├── N  Cambios de Estado (con timestamp)
                        │         ├── N  Evidencias
                        │         └── N  Referencias a otros Registros Técnicos
                        │
                        └── (derivado) Orden de Trabajo  ──── N  Registros Técnicos agrupados

Vehículo  N ──── N  Cliente    (un cliente puede tener varios vehículos; un vehículo puede cambiar de dueño)
Vehículo  N ──── 1  Propietario actual
Visita    1 ──── 1  Conductor

Cliente    1 ──── N  Pagos
Orden de Trabajo  1 ──── 1  Factura

Registro Reparación  N ──── N  Repuesto Utilizado ──── 1  Inventario
Registro Reparación  1 ──── N  Garantía  (una reparación puede generar varias garantías por componente)
Registro Garantía    N ──── 1  Registro Reparación original

Empresa   1 ──── N  Sucursal
Empresa   1 ──── N  Usuarios
Sucursal  1 ──── N  Inventario (stock de esa sucursal)
```

---

## 11. Reglas de negocio

Estas reglas son invariables. El sistema las impone, no solo las recomienda.

1. **Sin Autorización, no comienza ninguna Reparación.** El sistema bloquea el inicio de trabajo sin un Registro de Autorización cerrado que lo respalde.
2. **Cualquier trabajo adicional requiere nueva Autorización.** No importa el monto.
3. **El Control de Calidad debe cerrarse antes de notificar al cliente.** La notificación de "listo para retirar" es automática solo después.
4. **El Pago debe estar resuelto antes de la Entrega.** El Registro de Entrega no puede cerrarse sin referencia a Pago o acuerdo documentado.
5. **Un Registro Técnico cerrado no puede modificarse.** Las correcciones se realizan mediante un nuevo Registro que referencia al original.
6. **Los trabajos rechazados permanecen como Recomendaciones Pendientes.** Son visibles en cada visita futura del vehículo.
7. **Una Garantía siempre referencia su Reparación original.** No existe Garantía sin padre.
8. **Una Orden de Trabajo activa por vehículo a la vez.** El sistema no permite dos OTs abiertas simultáneamente para el mismo vehículo.
9. **Una autorización verbal tiene el mismo valor legal que una firma, si queda registrada.** El receptor registra: su nombre, nombre del cliente, canal y hora.
10. **El historial del vehículo no se borra aunque el cliente lo solicite.** Si el cliente pide eliminar sus datos personales, se anonimiza la información del Cliente, pero los Registros Técnicos del Vehículo permanecen.

---

## 12. Invariantes del dominio

Los invariantes son condiciones que **siempre** son verdaderas en el sistema.

- Todo Vehículo tiene exactamente una Historia Técnica del Vehículo.
- Todo Registro Técnico pertenece a exactamente un Vehículo (a través de su Historia Técnica).
- Todo Registro Técnico tiene al menos: tipo, estado, responsable y timestamp de creación.
- Todo Registro Técnico de tipo Reparación tiene al menos un Registro de Autorización cerrado y aprobado que lo precede.
- Una Garantía nunca existe sin un Registro de Reparación padre.
- Una Factura nunca existe sin una Orden de Trabajo asociada.
- Un Movimiento de Stock que reduce inventario siempre referencia la causa (qué Reparación lo originó, o ajuste manual con responsable).
- La patente de un Vehículo es única dentro del sistema.

---

## 13. Qué NO debe modelarse como entidad principal

| Concepto | Por qué no es entidad principal |
|---|---|
| Orden de Trabajo | Es un documento operativo. El eje es el Vehículo y sus Registros. |
| Factura | Es un documento comercial derivado. Emerge de la Entrega, no la precede. |
| "Historial técnico" (como concepto genérico) | Debe llamarse siempre **Historia Técnica del Vehículo** y es inseparable del Vehículo. |
| Tarea o Actividad | Demasiado granular. El sistema opera en términos de Registros Técnicos, no de tareas individuales. |
| Notificación | Es una acción del sistema, no una entidad de negocio. Se genera como efecto de un cambio de estado. |

---

## 14. Diferencias con TallerGP

| Aspecto | TallerGP | All Motors Cloud |
|---|---|---|
| Entidad central | Orden de Trabajo (`xd0...`) | Vehículo |
| Historial del vehículo | Lista de OTs donde el vehículo aparece como campo | Historia Técnica del Vehículo (entidad propia, permanente) |
| Registros sin OT | No existen — todo requiere una OT | Existen: consultas, cotizaciones, alertas, seguimientos |
| Evidencia | Solo texto en campos de la OT | Fotos, videos, firmas, scanner, PDF, mensajes |
| Trabajos rechazados | Se pierden al cerrar la OT | Persisten como Recomendaciones Pendientes |
| Correcciones | Se edita el registro existente | Nuevo Registro que referencia al original |
| Propietario vs. Cliente | Sin distinción — un campo de la OT | Modelo con Cliente, Propietario y Conductor como conceptos separados |
| IDs de entidades | Hashes opacos (`7ps...`, `9g3...`) | Identificadores propios estructurados |
| Cambio de propietario | Pérdida de contexto histórico | Historia Técnica se mantiene; se registra el nuevo propietario |

---

## 15. Preguntas abiertas

Estas preguntas deben resolverse antes de diseñar la base de datos.

1. **Acceso al historial tras cambio de propietario:** ¿el nuevo propietario ve todo el historial anterior cuando accede al Portal del Cliente, o solo desde su fecha de adquisición? ¿El taller siempre ve todo?
2. **Vehículo con patente duplicada:** si el mismo número de patente existiera en dos sucursales distintas de una empresa multi-sucursal, ¿cómo se resuelve?
3. **Cotización sin vehículo en el taller:** ¿puede abrirse un Registro de Cotización sin que el vehículo esté físicamente presente? ¿Cómo se identifica al vehículo en ese caso?
4. **Empresa como Cliente:** cuando una empresa es el cliente que paga, ¿el RUT de la empresa es el identificador del Cliente? ¿Cómo se relaciona con el empleado que trae el auto?
5. **Autorización por tercero:** ¿puede una persona distinta del propietario autorizar un trabajo? ¿Qué registro queda?
6. **OT para Peritaje:** ¿los Peritajes para aseguradoras requieren una OT aunque no generen reparación? ¿O solo un Registro Técnico?
7. **Garantías en kilómetros vs. tiempo:** ¿las Garantías tienen vencimiento por fecha, por kilometraje, o ambos?
8. **Vehículo que cambia de patente:** ¿puede la patente de un vehículo cambiar en el sistema? ¿Cómo se preserva el historial?
9. **Visibilidad de la Historia Técnica para el cliente:** ¿el cliente del Portal ve todos los Registros Técnicos o solo los que el taller decide mostrar (por ejemplo, ocultar diagnósticos internos)?
10. **Múltiples mecánicos en una Reparación:** ¿una Reparación puede tener múltiples mecánicos responsables? ¿Cómo se registra la contribución de cada uno?

---

## 16. Impacto futuro en la base de datos

Este apartado no diseña la base de datos. Solo documenta las implicaciones que este modelo tendrá.

**El modelo de eventos es naturalmente apto para event sourcing.** Los Registros Técnicos son la fuente de verdad. La Historia Técnica es una vista derivada de todos esos registros. La Orden de Trabajo es otra vista derivada que agrupa registros específicos.

**La evidencia se almacena externamente.** Las fotografías, videos y PDFs no viven en la base de datos relacional. Viven en un servicio de almacenamiento (CDN/object storage). La base de datos guarda la referencia (URL) y los metadatos.

**Las entidades de migración son temporales.** Los IDs de TallerGP pueden guardarse como campos opcionales en las entidades correspondientes. Una vez validada la migración, esos campos pueden archivarse.

**El modelo de estados de Registros Técnicos implica una tabla de transiciones.** Cada cambio de estado es un registro con: estado anterior, estado nuevo, actor, timestamp, y razón opcional. Esta tabla es inmutable.

**La Recomendación Pendiente no es una vista calculada.** Es una entidad persistida, para que pueda seguir siendo válida incluso si el Registro que la originó cambia de estado.

---

*Este documento alimenta directamente `DATABASE_MODEL.md`.*  
*Toda decisión técnica de la base de datos debe poder trazarse hasta una entidad, relación o regla definida aquí.*
