# Event Model — All Motors Cloud

**Estado:** Draft  
**Versión:** 1.0  
**Última actualización:** Junio 2026  
**Propósito:** Definir el lenguaje operativo oficial del sistema

---

## Tabla de Contenidos

1. [¿Qué es un Evento?](#1-qué-es-un-evento)
2. [La decisión arquitectónica central](#2-la-decisión-arquitectónica-central)
3. [Ciclo de vida del Evento](#3-ciclo-de-vida-del-evento)
4. [Clasificación de Eventos](#4-clasificación-de-eventos)
5. [Relaciones: Vehículo → Historia Técnica → Eventos → Evidencias](#5-relaciones)
6. [Eventos que NO generan Orden de Trabajo](#6-eventos-que-no-generan-orden-de-trabajo)
7. [Principios del Modelo de Eventos](#7-principios-del-modelo-de-eventos)
8. [Eventos Inteligentes — Potencial de IA](#8-eventos-inteligentes--potencial-de-ia)
9. [Cómo este documento alimenta los siguientes](#9-cómo-este-documento-alimenta-los-siguientes)

---

## 1. ¿Qué es un Evento?

Un evento es **cualquier momento que importa en la vida de un vehículo**.

No es un formulario. No es un registro de base de datos. No es una transacción.

Es algo que pasó, algo que se decidió, algo que se descubrió, o algo que se hizo — y que merece quedar registrado porque tiene relevancia para el futuro de ese vehículo.

Si mañana llega ese mismo vehículo con un problema nuevo, y el mecánico necesita saber qué le ocurrió en el pasado, cada evento responde una pregunta distinta:

- ¿Cuándo fue la última vez que entró?
- ¿Qué se le diagnosticó?
- ¿Qué autorizó el cliente y qué rechazó?
- ¿Qué partes se usaron?
- ¿Hay garantía vigente sobre algún trabajo?
- ¿Alguien llamó preguntando por ese auto hace dos semanas?

Cada respuesta es un evento.

**En términos simples:** si vale la pena recordarlo, es un evento.

---

## 2. La decisión arquitectónica central

Los sistemas de gestión de talleres tradicionales organizan la información alrededor de la **Orden de Trabajo**.

All Motors Cloud la organiza alrededor del **Evento**.

Esta diferencia no es cosmética. Es estructural.

| Modelo tradicional (OT-centrado) | All Motors Cloud (Evento-centrado) |
|---|---|
| La OT es la unidad de información | El Evento es la unidad de información |
| Fuera de una OT, nada queda registrado | Todo queda registrado, haya OT o no |
| El historial son las OTs pasadas | El historial es la secuencia de todos los eventos |
| Una consulta telefónica no existe en el sistema | Una consulta telefónica es un evento |
| Una garantía rechazada no existe si no se abre una OT | Una garantía rechazada es un evento en el historial |
| El vehículo es un campo de la OT | La OT es un documento de ciertos eventos del vehículo |

La Orden de Trabajo no desaparece. Sigue existiendo porque es un documento legal y financiero necesario. Pero deja de ser el centro del sistema. Se convierte en un **documento asociado a un conjunto de eventos**.

---

## 3. Ciclo de vida del Evento

Todo evento recorre un ciclo. No todos los eventos pasan por todos los estados, pero el framework es el mismo para todos.

```
Creado
  ↓
Pendiente
  ↓
Asignado
  ↓
En ejecución ←→ En espera (puede ir y volver)
  ↓
Finalizado
  ↓
Cerrado  ←── inmutable a partir de aquí
```

Estados alternativos de cierre:

```
Cancelado  ←── el evento fue abierto pero no se completará
```

---

### Descripción de cada estado

**Creado**
El evento existe en el sistema. Todavía no hay nadie asignado ni ninguna acción tomada.
*Quién lo crea:* recepción, sistema (eventos automáticos), mecánico (hallazgos).

**Pendiente**
El evento espera que alguien lo tome. Puede estar esperando asignación o una condición previa que aún no se cumplió.
*Quién puede actuar:* jefe de taller (para asignar), recepción (para gestionar).

**Asignado**
Se designó un responsable para este evento. El evento todavía no ha comenzado.
*Quién lo asigna:* jefe de taller, recepción.
*Qué se registra:* nombre del responsable asignado, fecha y hora de asignación.

**En ejecución**
El trabajo activo está ocurriendo.
*Quién puede cambiarlo:* el responsable asignado.
*Qué se registra:* hora de inicio (automática al marcar inicio).

**En espera**
El evento está pausado por una causa externa. No se puede avanzar hasta que esa causa se resuelva.
*Razones válidas de espera:*
- Esperando repuestos
- Esperando autorización del cliente
- Esperando instrucciones del jefe de taller
- Esperando equipo o herramienta
- Esperando resultado de scanner externo

*Qué se registra:* razón de la espera, quién registró la pausa, fecha y hora. La duración total en espera queda disponible como métrica.

**Finalizado**
El trabajo del evento está completo. El evento espera revisión o cierre formal.
*Quién puede cambiarlo:* el responsable asignado o el jefe de taller.
*Qué se registra:* hora de finalización (automática), resumen de lo realizado.

**Cerrado**
El evento está permanentemente cerrado. **Nada puede modificarse.** Solo puede leerse.
*Quién puede cerrarlo:* jefe de taller, recepción, sistema (en eventos automáticos).
*Qué se registra:* quién cerró, fecha y hora de cierre.

**Cancelado**
El evento fue abierto pero no se completará. Se registra el motivo.
*Ejemplos:* cliente desistió, evento duplicado, condición previa nunca se cumplió.
*Regla:* un evento cancelado sigue siendo parte del historial. No se elimina.

---

### ¿Quién puede cambiar cada estado?

| Transición | Actor habilitado |
|---|---|
| Creado → Pendiente | Sistema / Recepción |
| Pendiente → Asignado | Jefe de taller / Recepción |
| Asignado → En ejecución | Responsable asignado |
| En ejecución → En espera | Responsable asignado |
| En espera → En ejecución | Responsable asignado / Jefe de taller |
| En ejecución → Finalizado | Responsable asignado |
| Finalizado → Cerrado | Jefe de taller / Recepción |
| Cualquier estado → Cancelado | Jefe de taller / Recepción (con motivo) |

---

## 4. Clasificación de Eventos

Los eventos se agrupan en categorías operativas. Esta clasificación define cómo el sistema los trata y qué evidencia puede asociarse a cada uno.

### Contacto y Programación

| Evento | Descripción | Genera OT |
|---|---|---|
| Consulta | Cliente contacta al taller sin traer el vehículo. Puede ser telefónica, WhatsApp, presencial rápida. | No |
| Cita | Se agenda una fecha y hora para atención. Puede originarse de una consulta. | No |

### Ingreso del Vehículo

| Evento | Descripción | Genera OT |
|---|---|---|
| Recepción | Ingreso formal del vehículo. Registro de cliente, estado del vehículo, fotos, firma. | Sí |
| Check-In | El vehículo entra físicamente al área de trabajo del taller. | No — es parte de Recepción |

### Evaluación Técnica

| Evento | Descripción | Genera OT |
|---|---|---|
| Diagnóstico | Evaluación técnica completa del problema. Base para el presupuesto. | Sí |
| Escaneo Electrónico | Lectura de códigos de falla con scanner. Puede ser independiente o parte del diagnóstico. | Opcional |
| Inspección Visual | Revisión visual detallada de un área específica del vehículo. | Opcional |
| Prueba de Ruta | Test de conducción para reproducir o verificar un problema. Pre o post reparación. | No |
| Revisión Preventiva | Revisión de mantención programada para detectar desgastes. | Sí |
| Revisión Precompra | Inspección técnica para cliente que evalúa comprar un vehículo. | No |
| Peritaje | Inspección técnica para aseguradora o proceso legal. | Opcional |

### Presupuesto y Autorización

| Evento | Descripción | Genera OT |
|---|---|---|
| Cotización | Estimación de costos rápida, sin diagnóstico completo. | No |
| Presupuesto | Propuesta económica formal basada en diagnóstico. | Sí |
| Autorización | Decisión del cliente sobre el presupuesto (aprueba / rechaza / parcial). | Sí |
| Modificación de Presupuesto | Cambio al presupuesto original. Requiere nueva autorización del cliente. | Sí |

### Ejecución del Trabajo

| Evento | Descripción | Genera OT |
|---|---|---|
| Reparación | Trabajo de corrección mecánica, eléctrica o de carrocería. | Sí |
| Mantención | Trabajo preventivo programado (cambio de aceite, filtros, correas, etc.). | Sí |
| Instalación | Incorporación de un accesorio o repuesto sin reparación asociada. | Opcional |
| Solicitud de Repuestos | Pedido de partes a proveedor originado por una reparación. | No |
| Espera de Repuestos | Período en que el vehículo espera partes para continuar la reparación. | No |
| Lavado | Lavado del vehículo antes de entrega u otro servicio. | Opcional |

### Calidad y Entrega

| Evento | Descripción | Genera OT |
|---|---|---|
| Control de Calidad | Verificación del trabajo antes de notificar al cliente. | Sí |
| Entrega | Devolución formal del vehículo al cliente con firma y pago. | Sí |

### Post-Venta y Garantía

| Evento | Descripción | Genera OT |
|---|---|---|
| Seguimiento | Contacto post-entrega para verificar satisfacción o recordar mantención. | No |
| Reclamo del Cliente | El cliente reporta disconformidad con un trabajo realizado. | No |
| Garantía | Evaluación y ejecución de un trabajo cubierto por garantía de una reparación anterior. | Sí (referencia OT original) |
| Reingreso | El vehículo regresa por un problema relacionado a la visita anterior. | Sí (referencia visita anterior) |

### Generados por el Sistema

| Evento | Descripción | Genera OT |
|---|---|---|
| Alerta de Mantención | Recordatorio automático basado en km o fecha del historial. | No |
| Recordatorio de Cita | Notificación automática enviada al cliente antes de una cita. | No |
| Alerta de Vencimiento de Garantía | Aviso de que una garantía entregada está próxima a vencer. | No |

---

## 5. Relaciones

La jerarquía de información es:

```
Vehículo
  └── Historia Técnica  (inmutable, crece con cada visita)
        └── Eventos  (ordenados cronológicamente)
              ├── Metadatos del evento
              │     ├── Tipo
              │     ├── Estado
              │     ├── Actor responsable
              │     ├── Fecha y hora de cada transición
              │     └── Referencias a otros eventos
              └── Evidencias
                    ├── Fotografías
                    ├── Videos
                    ├── Resultado de scanner (archivo)
                    ├── PDF (presupuesto, factura, certificado)
                    ├── Firma digital del cliente
                    ├── Mensaje de autorización (WhatsApp / email)
                    ├── Comentarios y notas
                    ├── Repuestos utilizados
                    └── Mano de obra registrada
```

**La Orden de Trabajo** no está en la cima de esta jerarquía. Cuando existe, es un documento que agrupa los eventos de una visita con consecuencias financieras:

```
Orden de Trabajo (cuando aplica)
  ├── Referencia al evento Recepción
  ├── Referencia al evento Diagnóstico
  ├── Referencia al evento Presupuesto
  ├── Referencia al evento Autorización
  ├── Referencia al/los evento/s Reparación
  ├── Referencia al evento Control de Calidad
  └── Referencia al evento Entrega
```

**Relaciones entre eventos:**

- Un evento puede referenciar a otro evento como su origen (Garantía → Reparación original).
- Un evento puede referenciar a otro como su contexto (Reingreso → Visita anterior).
- Un evento puede bloquear a otro (Autorización debe estar cerrada para que Reparación pueda iniciarse).

---

## 6. Eventos que NO generan Orden de Trabajo

Estos eventos forman parte de la Historia Técnica aunque no tengan consecuencias económicas directas:

| Evento | Por qué importa en el historial |
|---|---|
| Consulta | Si el cliente describió un problema por teléfono y luego llegó al taller, el mecánico ve el contexto completo. |
| Cotización | Si se dio un precio hace 3 meses y ahora el cliente viene a aceptarlo, el contexto está disponible. |
| Escaneo rápido de cortesía | Los códigos de falla leídos forman parte del diagnóstico técnico del vehículo. |
| Revisión Precompra | El nuevo propietario puede ver que el vehículo fue inspeccionado antes de la compra. |
| Garantía evaluada y rechazada | El rechazo de una garantía con su justificación protege al taller ante futuras disputas. |
| Seguimiento | El historial muestra si el taller hizo seguimiento post-entrega y cuál fue la respuesta del cliente. |
| Reclamo del Cliente | Un reclamo no resuelto debe ser visible para cualquier persona que atienda al cliente en el futuro. |
| Alerta de Mantención | Indica que el sistema detectó que el vehículo estaba vencido. Si el cliente no respondió, eso también es información. |
| Peritaje sin reparación | La inspección para una aseguradora, aunque no derivó en reparación, es parte de la vida técnica del vehículo. |

**Principio:** la Historia Técnica registra la vida completa del vehículo en el taller, no solo los trabajos que generaron factura.

---

## 7. Principios del Modelo de Eventos

Estos principios no pueden violarse bajo ninguna circunstancia:

**1. Todo evento pertenece a un vehículo.**
Un evento sin vehículo no existe. La patente es el identificador de entrada al sistema.

**2. Un vehículo nunca pierde su Historia Técnica.**
Aunque cambie de propietario, la historia permanece. El historial técnico es del vehículo, no del cliente.

**3. Los eventos nunca se eliminan.**
Solo cambian de estado. Un evento cancelado sigue en el historial. Un evento cerrado es inmutable.

**4. Todo evento es inmutable una vez cerrado.**
Nada puede modificarse en un evento cerrado. Si existe un error, se abre un nuevo evento de corrección que referencia al anterior.

**5. Todo evento tiene un responsable.**
Ningún evento existe sin un actor asignado: una persona o el sistema.

**6. Todo evento tiene fecha y hora.**
Cada transición de estado registra automáticamente el momento en que ocurrió.

**7. Todo evento puede tener evidencia.**
No se fuerza evidencia en todos los casos, pero el modelo siempre la acepta.

**8. Todo evento puede relacionarse con otros eventos.**
Las referencias entre eventos construyen el contexto completo de una visita y de la historia del vehículo.

**9. La Orden de Trabajo es un documento, no la unidad central.**
Es el documento financiero y legal que agrupa ciertos eventos. No todos los eventos pertenecen a una OT.

**10. La duración del estado "En espera" es una métrica operacional.**
El tiempo que un vehículo pasa en espera (por partes, por autorización, por cualquier causa) debe ser medible para detectar ineficiencias.

---

## 8. Eventos Inteligentes — Potencial de IA

El modelo de eventos crea una estructura de datos que la inteligencia artificial puede aprovechar directamente. No se diseñan algoritmos aquí. Se documenta el potencial.

**Detección de reparaciones repetidas**
Si el mismo tipo de evento de Reparación ocurre dos veces sobre el mismo componente dentro de un período corto, el sistema puede detectarlo como posible falla de calidad o garantía implícita.

**Sugerencia de diagnóstico**
Si varios vehículos del mismo modelo y año presentaron un evento de Diagnóstico con el mismo hallazgo, el sistema puede sugerirlo como candidato cuando ingresa un vehículo similar con síntomas parecidos.

**Predicción de mantenciones**
Con la secuencia histórica de eventos de Mantención y los kilometrajes registrados, el sistema puede proyectar cuándo corresponde la próxima intervención para cada vehículo.

**Detección de vehículos reincidentes**
Si un vehículo genera múltiples eventos de Garantía o Reingreso en un período corto, puede marcarse para revisión técnica especial en el próximo ingreso.

**Alerta de garantías próximas a vencer**
El sistema puede anticipar garantías que vencen pronto y notificar al cliente o al taller para un seguimiento proactivo.

**Análisis de ineficiencias operacionales**
Los eventos en estado "En espera" con razón "Esperando repuestos" que se repiten frecuentemente en el mismo tipo de trabajo indican un problema de inventario o de relación con proveedores.

**Identificación de clientes en riesgo de abandono**
Si un vehículo no registra ningún evento en un período largo después de una mantención esperada, es una señal de que el cliente puede haber ido a otro taller.

**Valoración del historial técnico**
Un vehículo con una Historia Técnica completa y documentada en All Motors Cloud tiene mayor valor de reventa que uno sin historial. El sistema puede generar un certificado de historial técnico para el cliente.

---

## 9. Cómo este documento alimenta los siguientes

Este documento establece el lenguaje oficial del sistema. Todo lo que se construya después debe hablar en términos de eventos.

| Documento / Componente | Qué hereda de EVENT_MODEL.md |
|---|---|
| `DOMAIN_MODEL.md` | Las entidades Evento, Historia Técnica, Evidencia y sus relaciones |
| `DATABASE_MODEL.md` | El esquema de tablas para eventos, estados, transiciones y evidencias |
| Backend | Los endpoints y reglas de negocio que controlan las transiciones de estado |
| API | El vocabulario de recursos: `/vehicles/:id/events`, `/events/:id/evidence` |
| Aplicación móvil del mecánico | La vista centrada en eventos asignados, no en OTs |
| Portal del cliente | La Historia Técnica como línea de tiempo de eventos visibles al cliente |
| Inteligencia Artificial | El corpus de eventos históricos como fuente de entrenamiento y análisis |

**El glosario mínimo que toda la plataforma debe compartir:**

| Término | Significado |
|---|---|
| Evento | Cualquier momento significativo en la vida de un vehículo |
| Historia Técnica | La secuencia inmutable de todos los eventos de un vehículo |
| Evidencia | Cualquier archivo o dato adjunto a un evento |
| Orden de Trabajo | Documento financiero-legal que agrupa eventos de una visita con consecuencia económica |
| Estado del Evento | La etapa actual del ciclo de vida de un evento |
| Responsable | El actor humano o sistema asignado a un evento |

---

*Este documento es la base conceptual de All Motors Cloud.*  
*Cuando exista duda sobre cómo modelar algo, la primera pregunta es: ¿qué evento representa esto?*
