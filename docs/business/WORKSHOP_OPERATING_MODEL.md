# Workshop Operating Model — All Motors SPA

**Estado:** Draft  
**Versión:** 1.0  
**Última actualización:** Junio 2026  
**Propósito:** Descripción operacional del taller como insumo para el modelo de dominio

---

## Tabla de Contenidos

1. [Propósito del documento](#1-propósito-del-documento)
2. [Filosofía operacional](#2-filosofía-operacional)
3. [Actores del taller](#3-actores-del-taller)
4. [Flujo principal del vehículo](#4-flujo-principal-del-vehículo)
5. [Eventos operativos importantes](#5-eventos-operativos-importantes)
6. [Reglas críticas del negocio](#6-reglas-críticas-del-negocio)
7. [Principios de productividad](#7-principios-de-productividad)
8. [Información a capturar en cada etapa](#8-información-a-capturar-en-cada-etapa)
9. [Información que NO debe exigirse al mecánico](#9-información-que-no-debe-exigirse-al-mecánico)
10. [Cómo este documento alimenta DOMAIN_MODEL.md](#10-cómo-este-documento-alimenta-domain_modelmd)

---

## 1. Propósito del documento

Este documento describe cómo funciona All Motors SPA como taller mecánico operacional, antes de diseñar cualquier modelo de datos, pantalla o módulo técnico.

Su objetivo es responder: **¿qué ocurre exactamente en el taller, quién lo hace, cuándo ocurre, y qué información se genera en cada paso?**

Es el insumo directo para `docs/business/DOMAIN_MODEL.md`.

**No contiene:** diseño de base de datos, diseño de pantallas, ni código.

**Sí contiene:** la realidad operacional del taller, las reglas de negocio, la información que debe capturarse en cada etapa, y las restricciones que el sistema debe imponer.

---

## 2. Filosofía operacional

El taller existe para reparar vehículos. Todo lo demás es soporte.

**1. El vehículo es el eje.**
No el cliente. No la factura. No la orden de trabajo. Cada proceso gira en torno al vehículo que está en el taller. El historial del vehículo es el activo más valioso que el sistema custodia.

**2. El tiempo del mecánico no puede desperdiciarse.**
El taller factura por horas de trabajo técnico. Cada minuto que el mecánico pasa en tareas administrativas es dinero que el taller no recupera.

**3. La confianza se construye con evidencia.**
Un cliente que recibe fotografías del estado de su vehículo al ingreso y al egreso confía más que uno que recibe solo explicaciones verbales. La evidencia protege al taller y tranquiliza al cliente.

**4. Sin autorización, no hay trabajo.**
Ninguna persona del taller puede comenzar o modificar una reparación sin que el cliente haya autorizado explícitamente el presupuesto. Esta regla protege al cliente y al taller.

---

## 3. Actores del taller

### Cliente

Propietario o responsable legal del vehículo. Puede ser persona natural, empresa o aseguradora. Puede ser distinto del conductor que trae el auto.

**Rol en el flujo:**
- Describe el problema al ingresar el vehículo.
- Autoriza el presupuesto antes de que comience cualquier trabajo.
- Paga antes de retirar el vehículo.
- Firma los documentos de recepción y entrega.

**Regla clave:** el mismo cliente puede tener múltiples vehículos. Un vehículo puede cambiar de propietario. El historial técnico del vehículo se conserva con independencia del propietario actual.

---

### Recepción

Primer y último contacto humano del taller con el cliente.

**Rol en el flujo:**
- Registra la llegada del vehículo y documenta su estado inicial.
- Captura el problema descrito por el cliente (en sus palabras exactas).
- Abre la orden de trabajo.
- Presenta el presupuesto al cliente y gestiona la autorización.
- Notifica al cliente cuando el vehículo está listo.
- Coordina la entrega y el cobro.

**Lo que el sistema debe facilitarle:** al ingresar la patente, el historial completo del vehículo aparece de inmediato. La apertura de una nueva orden debe ser rápida y sin pasos redundantes.

---

### Mecánico

Actor técnico central. Su tiempo es el recurso más valioso del taller.

**Rol en el flujo:**
- Diagnostica el problema técnico.
- Ejecuta los trabajos autorizados.
- Registra qué hizo y qué partes utilizó.
- Comunica hallazgos adicionales que requieran nueva autorización.

**El sistema nunca le pide:** datos del cliente, generación de facturas, contacto con proveedores, precios de repuestos, comunicación sobre costos o plazos, ni agendamiento.

**Su interfaz ideal:** mostrar qué debe hacer, permitir registrar qué hizo y qué usó. Nada más.

---

### Jefe de Taller

Supervisa la operación técnica. Coordina y controla calidad.

**Rol en el flujo:**
- Asigna vehículos a mecánicos según carga y especialidad.
- Aprueba diagnósticos cuando el mecánico tiene dudas.
- Recibe alertas de hallazgos adicionales durante la reparación.
- Realiza o supervisa el control de calidad antes de cada entrega.
- Puede autorizar trabajos adicionales de bajo monto sin consultar al cliente (según política del taller).

---

### Administrador

Gestiona la parte financiera y comercial.

**Rol en el flujo:**
- Genera facturas y boletas.
- Registra pagos y formas de pago.
- Gestiona cuentas por cobrar y proveedores.
- Emite reportes financieros.

No interviene en decisiones técnicas.

---

### Proveedor

Actor externo que suministra repuestos e insumos.

**Características relevantes:**
- Un mismo repuesto puede obtenerse de distintos proveedores.
- Los tiempos de entrega afectan el plazo de devolución al cliente.
- Una orden de compra puede originarse desde una orden de trabajo específica.
- Los precios varían y deben quedar registrados al momento de la compra.

---

### Sistema

El sistema opera como un actor que ejecuta acciones automáticas sin intervención humana.

**Acciones automáticas:**
- Notifica al cliente cuando el vehículo está listo (solo después del control de calidad aprobado).
- Envía recordatorios de mantención según el historial del vehículo.
- Alerta cuando un vehículo lleva más tiempo del estimado en taller.
- Registra actor, fecha y hora en cada cambio de estado.
- Bloquea el inicio de trabajos sin presupuesto autorizado.
- Genera reminders de garantías próximas a vencer.

---

## 4. Flujo principal del vehículo

```
Primer contacto
      ↓
  Recepción
      ↓
  Check-In
      ↓
 Diagnóstico
      ↓
 Presupuesto
      ↓
Autorización del cliente ──→ Rechaza ──→ Devolución del vehículo
      ↓ (aprueba)
  Reparación ──→ Hallazgo adicional ──→ Nuevo presupuesto ──→ Nueva autorización
      ↓
Control de calidad
      ↓
   Entrega
      ↓
 Seguimiento
```

---

### 4.1 Primer contacto

El cliente comunica que necesita atención. Puede ser por llamada, WhatsApp, visita sin cita o agenda online.

**Se registra:** nombre, teléfono, patente (activa búsqueda en historial), motivo, fecha de cita si se agenda.

**Resultado:** cliente con cita o ingreso directo a recepción.

---

### 4.2 Recepción

El vehículo llega físicamente. Recepción formaliza el ingreso.

**Se registra:**
- Cliente: datos completos si es nuevo (nombre, RUT, teléfono, email).
- Vehículo: datos completos si es nuevo (patente, VIN, marca, modelo, año, color).
- Kilometraje al ingreso.
- Nivel de combustible.
- Fotografías del estado exterior (mínimo cuatro ángulos).
- Problema descrito por el cliente en sus propias palabras.
- Firma del cliente en el documento de recepción.

**Resultado:** orden de trabajo abierta. Vehículo registrado como ingresado.

---

### 4.3 Check-In

Formalización del ingreso físico dentro del taller.

**Se registra:** hora exacta de entrada al taller, mecánico asignado (o pendiente), prioridad de atención.

**Resultado:** vehículo dentro del taller, en espera de diagnóstico.

---

### 4.4 Diagnóstico

El mecánico evalúa técnicamente el vehículo.

**Se registra:**
- Hallazgos técnicos del mecánico.
- Causa raíz identificada.
- Hallazgos adicionales no reportados por el cliente.
- Resultado del scanner adjunto como archivo (si se realizó).
- Fotografías de las fallas detectadas.
- Estimación del tiempo de reparación.

**Regla:** el diagnóstico es un paso puramente técnico. No genera compromisos de costo.

**Resultado:** descripción técnica del estado del vehículo, base para el presupuesto.

---

### 4.5 Presupuesto

Con base en el diagnóstico, se construye la propuesta económica.

**Contiene:**
- Repuestos: código, descripción, cantidad, precio unitario.
- Mano de obra: descripción, horas estimadas, precio por hora.
- Otros costos: aceites, insumos, subcontratos.
- Total con impuestos desglosados.
- Vigencia del presupuesto.
- Opciones alternativas cuando corresponda (ej.: repuesto original vs. alternativo).

**Regla:** el presupuesto debe existir y estar completo antes de presentarse al cliente.

**Resultado:** presupuesto listo para presentar.

---

### 4.6 Autorización del cliente

El presupuesto se presenta al cliente. El cliente decide.

**Métodos válidos de autorización:**
- Firma presencial en el documento del presupuesto.
- Confirmación escrita por WhatsApp o email (el mensaje queda adjunto como evidencia).
- Autorización verbal presencial (quien la recibe registra su nombre, el del cliente, la hora y el canal).

| Resultado del cliente | Acción siguiente |
|---|---|
| Aprueba todo | Comienza la reparación |
| Aprueba parcialmente | Solo se realiza lo aprobado; lo rechazado queda en historial |
| Rechaza todo | Vehículo preparado para devolución; motivo registrado |
| Solicita modificación | Se ajusta el presupuesto y se repite este paso |

**Regla crítica:** ningún trabajo comienza sin autorización documentada, sin excepción.

**Resultado:** registro claro de qué fue autorizado, por quién, cuándo y por qué canal.

---

### 4.7 Reparación

El mecánico ejecuta los trabajos autorizados.

**Se registra:**
- Repuestos efectivamente utilizados (pueden diferir del presupuesto si hubo cambio de parte).
- Trabajo realizado por ítem.
- Hallazgos durante la reparación no contemplados en el diagnóstico original.
- Fotografías del trabajo realizado en reparaciones de alta complejidad.

**Regla crítica:** si se descubre trabajo adicional, el mecánico lo comunica al jefe de taller. Se genera un nuevo presupuesto y se obtiene nueva autorización antes de continuar. No importa el monto.

**Resultado:** trabajos autorizados completados. Vehículo listo para control de calidad.

---

### 4.8 Control de calidad

Verificación del trabajo antes de notificar al cliente.

**Quién lo realiza:** jefe de taller o mecánico designado distinto al que realizó el trabajo.

**Se verifica:**
- Todos los ítems autorizados fueron realizados.
- No quedan herramientas ni materiales en el vehículo.
- El vehículo está en condiciones de entrega (limpio y funcional).
- Las garantías aplicables están identificadas.

**Regla:** la notificación al cliente es automática solo después de la aprobación del control de calidad.

**Resultado:** vehículo aprobado para entrega, con registro de quién aprobó y a qué hora.

---

### 4.9 Entrega

El cliente retira su vehículo.

**Se registra:**
- Kilometraje al momento de entrega.
- Factura o boleta emitida.
- Forma de pago y monto.
- Condiciones de garantía (alcance, duración, exclusiones).
- Recomendaciones de próxima mantención.
- Firma del cliente en el documento de entrega.

**Regla:** el vehículo no se entrega sin que el pago esté resuelto (pagado o con acuerdo documentado y firmado).

**Resultado:** vehículo entregado. Orden de trabajo cerrada.

---

### 4.10 Seguimiento

La relación con el vehículo no termina en la entrega.

**Qué ocurre:**
- Los trabajos rechazados durante la visita permanecen como recomendaciones pendientes, visibles en la próxima visita.
- El sistema envía recordatorios de mantención según el historial del vehículo.
- Si el cliente regresa por garantía, la nueva orden referencia la orden de trabajo original.
- Los reclamos de garantía quedan en el historial técnico del vehículo.

**Resultado:** el historial del vehículo crece con cada visita y anticipa necesidades futuras.

---

## 5. Eventos operativos importantes

Todo evento se registra con actor, fecha y hora. Este registro es inmutable.

| Evento | Actor responsable |
|---|---|
| Vehículo ingresa al taller | Recepción |
| Orden de trabajo abierta | Recepción |
| Vehículo asignado a mecánico | Jefe de taller |
| Diagnóstico registrado | Mecánico |
| Presupuesto creado | Recepción / Jefe de taller |
| Presupuesto enviado al cliente | Recepción / Sistema |
| Cliente autoriza | Cliente — registra Recepción |
| Cliente rechaza (total o parcial) | Cliente — registra Recepción |
| Trabajo iniciado | Mecánico |
| Hallazgo adicional reportado | Mecánico |
| Repuesto pedido a proveedor | Administrador |
| Repuesto recibido | Administrador |
| Trabajo completado | Mecánico |
| Control de calidad aprobado | Jefe de taller |
| Cliente notificado para retiro | Sistema / Recepción |
| Pago recibido | Administrador / Recepción |
| Vehículo entregado | Recepción |
| Garantía reclamada | Recepción |

---

## 6. Reglas críticas del negocio

Estas reglas no son sugerencias. El sistema debe hacerlas cumplir, no solo advertir sobre ellas.

1. **Sin presupuesto autorizado, no hay trabajo.** El sistema bloquea el inicio de cualquier trabajo sin autorización documentada.
2. **El trabajo adicional requiere nueva autorización.** Cualquier trabajo no contemplado en el presupuesto aprobado requiere un nuevo presupuesto y aprobación explícita, sin importar el monto.
3. **Sin control de calidad aprobado, no hay notificación al cliente.** La notificación de "vehículo listo" es automática solo después del cierre del control de calidad.
4. **Sin pago resuelto, no hay entrega.** El sistema bloquea el cierre de la orden sin registro de pago o acuerdo documentado.
5. **El historial técnico es inmutable.** Trabajos realizados, presupuestos rechazados, garantías entregadas: ninguno puede eliminarse. Solo pueden anotarse o cancelarse con observación.
6. **Una sola orden activa por vehículo a la vez.** El sistema no permite abrir una segunda orden si hay una abierta para el mismo vehículo.
7. **Los trabajos rechazados quedan en el historial.** Son recomendaciones pendientes que deben aparecer en la próxima visita del vehículo.
8. **Toda autorización es trazable.** La autorización verbal tiene el mismo valor que la escrita, pero quien la recibe debe registrarla de inmediato con su nombre, el nombre del cliente y la hora.
9. **Descuentos y modificaciones al presupuesto requieren registro.** Quién autorizó el descuento y el motivo quedan registrados.
10. **Una garantía siempre referencia la orden de trabajo original.** No puede existir una orden de garantía sin orden de trabajo padre.

---

## 7. Principios de productividad

El mecánico no debe necesitar más de tres interacciones para registrar su trabajo.

**Reglas concretas:**

- Toda tarea frecuente del mecánico debe completarse en **máximo 3 clics o 10 segundos**.
- Los repuestos se seleccionan de una lista — no se escriben desde cero.
- La cámara del dispositivo es el método preferido de captura de evidencia.
- Si el mecánico detecta un hallazgo adicional, lo comunica en una sola acción. El sistema genera la alerta para el jefe de taller.
- El sistema registra automáticamente la hora de inicio y fin de cada trabajo al marcarlo.
- El mecánico nunca ingresa datos del cliente, del vehículo, ni información financiera.

**Lo que el sistema pre-completa para el mecánico:**
- Datos del vehículo y su historial.
- Trabajos autorizados en la orden activa.
- Lista de repuestos previamente utilizados en ese modelo de vehículo.

---

## 8. Información a capturar en cada etapa

| Etapa | Obligatorio | Complementario |
|---|---|---|
| Primer contacto | Nombre, teléfono, patente, motivo | Email, fecha de cita |
| Recepción | Datos cliente, datos vehículo, km, fotos, descripción, firma | Nivel combustible, accesorios declarados |
| Check-In | Hora exacta, mecánico asignado | Prioridad, notas adicionales |
| Diagnóstico | Hallazgos, causa raíz, tiempo estimado | Fotos de falla, resultado scanner |
| Presupuesto | Repuestos, mano de obra, total, vigencia | Alternativas |
| Autorización | Quién, método, qué aprobó, fecha y hora | Ítems rechazados con motivo |
| Reparación | Partes usadas, trabajo realizado | Tiempo real, fotos |
| Control de calidad | Quién aprobó, hora | Observaciones |
| Entrega | Km salida, factura, pago, garantías, firma | Recomendaciones de mantención |
| Seguimiento | (automático por sistema) | Recordatorios, reclamos de garantía |

---

## 9. Información que NO debe exigirse al mecánico

El mecánico es un técnico. No es un operador administrativo.

**Nunca pedirle:**
- Datos del cliente (nombre, RUT, teléfono, email).
- Generación o revisión de facturas.
- Contacto con proveedores para cotizar o solicitar repuestos.
- Ingreso de precios de repuestos.
- Comunicación con el cliente sobre costos, plazos o pagos.
- Explicación del presupuesto o la factura al cliente.
- Agendamiento de próximas citas.
- Cualquier campo que no sea estrictamente técnico.

**Por qué importa:** cada campo adicional que el mecánico debe completar es tiempo de reparación perdido. El sistema se diseña asumiendo que el mecánico ya tiene suficiente con diagnosticar y reparar correctamente.

---

## 10. Cómo este documento alimenta DOMAIN_MODEL.md

Este documento establece los insumos concretos para el modelo de dominio técnico.

**Entidades identificadas en el flujo:**

| Entidad | Detectada en |
|---|---|
| Vehículo | Todas las etapas |
| Cliente | Primer contacto, Recepción, Autorización, Entrega |
| Orden de Trabajo | Recepción → Entrega |
| Diagnóstico | Diagnóstico |
| Presupuesto | Presupuesto, Autorización |
| Ítem de Presupuesto | Presupuesto |
| Autorización | Autorización |
| Ítem de Trabajo Realizado | Reparación |
| Repuesto Utilizado | Reparación |
| Control de Calidad | Control de calidad |
| Pago | Entrega |
| Garantía | Entrega, Seguimiento |
| Cita | Primer contacto |
| Evento de Auditoría | Todas las etapas |
| Proveedor | Compras |
| Orden de Compra | Compras |

**Estados de la Orden de Trabajo:**

```
pendiente_diagnostico
  → diagnosticada
  → presupuesto_pendiente
  → presupuesto_enviado
  → autorizada
  → en_reparacion
  → control_calidad
  → lista_para_entrega
  → entregada
  → cerrada

Estados de cierre sin trabajo: rechazada · cancelada
```

**Reglas de negocio que el modelo debe imponer:** todas las de la sección 6.

**Eventos que deben persistir como log inmutable:** todos los de la sección 5.

---

*Este documento no reemplaza la Product Bible. La complementa con el detalle operacional necesario para diseñar el dominio técnico.*

*Toda decisión del modelo de datos debe poder trazarse hasta una regla o flujo documentado aquí.*
