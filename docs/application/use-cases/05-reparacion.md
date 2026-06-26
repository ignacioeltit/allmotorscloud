# Use Cases — Reparación

**Área:** 05 | **Casos:** UC-E01 a UC-E06 | **MVP:** 4/6  
← [USE_CASE_MODEL.md — Índice maestro](../USE_CASE_MODEL.md)

---

### UC-E01 · Solicitar Repuestos
**Actor:** Mecánico / Jefe de Taller | **Disparador:** Reparación requiere partes no disponibles en inventario.
**Pre:** Diagnóstico cerrado. Trabajo autorizado.
**Flujo:** 1) Identificar partes necesarias 2) Verificar stock disponible 3) Si no hay stock: crear solicitud de compra a proveedor 4) Registrar qué repuesto, cantidad y para qué OT
**Alt/Ex:** Stock disponible → ir directamente a ejecución. Sin proveedor asignado → alerta al administrador.
**Historia Técnica:** Registro de Espera de Repuestos con motivo en la OT.
**Reglas:** El mecánico no contacta al proveedor directamente. La solicitud va al administrador.
**Resultado:** Solicitud de compra creada. OT en estado "En espera de repuestos". · **V1**

---

### UC-E02 · Recepcionar Repuestos
**Actor:** Administrador / Recepcionista | **Disparador:** Proveedor entrega repuestos solicitados.
**Pre:** UC-E01 completado y pendiente.
**Flujo:** 1) Verificar repuestos recibidos contra solicitud 2) Registrar ingreso al inventario 3) Notificar al jefe de taller que los repuestos llegaron 4) OT sale de estado "En espera"
**Alt/Ex:** Repuesto incorrecto → rechazar y registrar discrepancia. Repuesto parcial → actualizar cantidades.
**Historia Técnica:** Registro de recepción de repuestos como Movimiento de Stock.
**Reglas:** Nada puede ingresarse al inventario sin registro de origen (proveedor + OC).
**Resultado:** Repuestos disponibles. Reparación puede continuar. · **V1**

---

### UC-E03 · Registrar Mano de Obra
**Actor:** Mecánico | **Disparador:** Mecánico completa un ítem de trabajo autorizado.
**Pre:** Trabajo autorizado en OT activa. Mecánico asignado.
**Flujo:** 1) Seleccionar el ítem de trabajo de la lista autorizada 2) Registrar inicio (hora automática) 3) Ejecutar el trabajo 4) Registrar finalización (hora automática) 5) Completar observaciones si hay hallazgos 6) Marcar ítem como terminado
**Alt/Ex:** Hallazgo adicional → comunicar al jefe de taller antes de continuar. Repuesto diferente al presupuestado → registrar diferencia.
**Historia Técnica:** Registro de Trabajo Realizado con ítem, tiempo real y mecánico responsable.
**Reglas:** El mecánico no puede registrar trabajo fuera del alcance autorizado. Todo hallazgo adicional se comunica al jefe de taller; no se ejecuta sin nueva autorización.
**Resultado:** Ítem registrado en la OT. Tiempo real disponible para reportes. · **MVP**

---

### UC-E04 · Registrar Prueba de Ruta
**Actor:** Mecánico / Jefe de Taller | **Disparador:** Diagnóstico o verificación post-reparación requiere prueba en circulación.
**Pre:** Vehículo en condiciones seguras para circular.
**Flujo:** 1) Registrar inicio de prueba con km 2) Documentar propósito (reproducir falla / verificar reparación) 3) Registrar hallazgos durante la prueba 4) Registrar km de regreso y resultado
**Alt/Ex:** Falla no reproducible → registrar igualmente con resultado negativo. Falla confirmada → se convierte en insumo para diagnóstico.
**Historia Técnica:** Registro de Prueba de Ruta con km, resultado y responsable.
**Reglas:** La prueba de ruta pre-entrega es el paso final antes del control de calidad si la reparación fue mecánica o de transmisión.
**Resultado:** Resultado de prueba documentado y disponible. · **V1**

---

### UC-E05 · Realizar Control de Calidad
**Actor:** Jefe de Taller | **Disparador:** Todos los ítems autorizados de la OT están marcados como terminados.
**Pre:** UC-E03 completado para todos los ítems. Vehículo en condiciones de revisión.
**Flujo:** 1) Revisar que todos los ítems autorizados están completados 2) Verificar limpieza del vehículo 3) Verificar que no hay herramientas u objetos ajenos 4) Verificar garantías aplicables 5) Aprobar o rechazar el control
**Alt/Ex:** Control rechazado → devolver al mecánico con observaciones específicas. Rechazado vuelve a estado "En reparación".
**Historia Técnica:** Registro de Control de Calidad con resultado, quién aprobó y hora.
**Reglas:** La notificación al cliente es automática SOLO después del control de calidad aprobado. El jefe de taller no puede aprobar su propio trabajo si fue quien reparó.
**Resultado:** Vehículo en estado "Listo para entrega". Notificación automática al cliente. · **MVP**

---

### UC-E06 · Registrar Observaciones
**Actor:** Mecánico / Recepcionista / Jefe de Taller | **Disparador:** Necesidad de registrar información contextual no estructurada.
**Pre:** Vehículo con visita activa.
**Flujo:** 1) Seleccionar el evento activo al que se adjunta la observación 2) Redactar la observación 3) Confirmar guardado
**Alt/Ex:** Observación urgente → marcar como alerta para que aparezca en el panel del jefe de taller.
**Historia Técnica:** Observación adjunta al evento correspondiente.
**Reglas:** Una observación no es un evento. Es texto adjunto a un evento existente. No reemplaza el diagnóstico ni el registro técnico.
**Resultado:** Observación guardada y visible para todos con acceso a esa Historia Técnica. · **MVP**
