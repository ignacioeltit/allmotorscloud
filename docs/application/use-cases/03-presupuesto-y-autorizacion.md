# Use Cases — Presupuesto y Autorización

**Área:** 03 | **Casos:** UC-P01 a UC-P05 | **MVP:** 4/5  
← [USE_CASE_MODEL.md — Índice maestro](../USE_CASE_MODEL.md)

---

### UC-P01 · Crear Presupuesto
**Actor:** Recepcionista / Jefe de Taller | **Disparador:** Diagnóstico cerrado.
**Pre:** UC-D01 completado y cerrado.
**Flujo:** 1) Seleccionar diagnóstico base 2) Agregar ítems: repuestos (código, cant., precio), mano de obra (descripción, horas, precio/hora), insumos 3) Aplicar IVA y calcular total 4) Definir vigencia del presupuesto 5) Cerrar presupuesto para envío
**Alt/Ex:** Opción alternativa (repuesto original vs. genérico) → crear dos líneas con nota diferenciadora. El mecánico no accede a esta vista.
**Historia Técnica:** Registro de Presupuesto con todos los ítems y totales.
**Reglas:** El presupuesto debe estar completo antes de presentarse al cliente. No se puede editar después de enviado; se modifica con UC-P02.
**Resultado:** Presupuesto listo para enviar al cliente. · **MVP**

---

### UC-P02 · Modificar Presupuesto
**Actor:** Recepcionista / Jefe de Taller | **Disparador:** Cliente solicita cambios o se detecta error antes del envío, o se descubren trabajos adicionales durante la reparación.
**Pre:** Presupuesto existente. Si ya fue enviado, requiere nueva versión.
**Flujo:** 1) Indicar motivo de la modificación 2) Crear nueva versión del presupuesto (no editar el anterior) 3) Registrar qué cambió y por qué 4) Nueva versión queda lista para envío
**Alt/Ex:** Modificación por hallazgo durante reparación → pausar reparación hasta nueva autorización.
**Historia Técnica:** Nueva versión de Registro de Presupuesto referenciando la versión anterior.
**Reglas:** Las versiones anteriores permanecen en la Historia Técnica. El motivo de modificación siempre se registra.
**Resultado:** Nueva versión del presupuesto lista. Historial de versiones preservado. · **V1**

---

### UC-P03 · Enviar Presupuesto
**Actor:** Recepcionista / Sistema | **Disparador:** Presupuesto cerrado y listo para presentación.
**Pre:** UC-P01 completado.
**Flujo:** 1) Seleccionar canal de envío (WhatsApp, email, presencial) 2) Enviar o presentar el documento 3) Registrar canal, fecha y hora de envío
**Alt/Ex:** Presentación presencial → imprimir o mostrar en pantalla. En todos los casos, el envío queda registrado.
**Historia Técnica:** Registro de envío del presupuesto con canal y timestamp.
**Reglas:** OT avanza a estado "Presupuesto enviado". El presupuesto no puede modificarse mientras está en estado enviado.
**Resultado:** Cliente tiene el presupuesto. OT en estado "Presupuesto enviado". · **MVP**

---

### UC-P04 · Registrar Aprobación
**Actor:** Recepcionista (registra la decisión del cliente) | **Disparador:** Cliente aprueba el presupuesto.
**Pre:** UC-P03 completado.
**Flujo:** 1) Seleccionar qué ítems aprobó (total o parcial) 2) Registrar método de autorización (firma / WhatsApp / verbal presencial) 3) Adjuntar evidencia si es mensaje escrito 4) Si verbal: registrar nombre de quien recibió, nombre del cliente, hora y canal
**Alt/Ex:** Aprobación parcial → los ítems rechazados pasan a UC-G03 como recomendaciones pendientes.
**Historia Técnica:** Registro de Autorización. Evidencias: firma o captura del mensaje de aprobación.
**Reglas:** Sin aprobación registrada, ningún trabajo puede comenzar. La aprobación verbal es válida si queda documentada.
**Resultado:** OT en estado "Autorizada". Reparación habilitada. · **MVP**

---

### UC-P05 · Registrar Rechazo
**Actor:** Recepcionista | **Disparador:** Cliente rechaza el presupuesto total o parcialmente.
**Pre:** UC-P03 completado.
**Flujo:** 1) Registrar decisión del cliente con motivo 2) Si rechazo total: preparar devolución del vehículo 3) Si rechazo parcial: los ítems rechazados se convierten en Recomendaciones Pendientes (UC-G03)
**Alt/Ex:** Cliente pide tiempo para decidir → OT queda en "Pendiente respuesta" con fecha límite.
**Historia Técnica:** Registro de Rechazo con motivo. Los ítems rechazados quedan como Recomendaciones Pendientes.
**Reglas:** El rechazo nunca elimina el presupuesto del historial. Los trabajos rechazados deben aparecer en la próxima visita.
**Resultado:** Vehículo preparado para devolución o OT ajustada a los ítems aprobados. · **MVP**
