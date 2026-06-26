# Use Cases — Seguimiento y Mantención

**Área:** 09 | **Casos:** UC-S01 a UC-S03 | **MVP:** 0/3  
← [USE_CASE_MODEL.md — Índice maestro](../USE_CASE_MODEL.md)

---

### UC-S01 · Programar Mantención
**Actor:** Recepcionista / Sistema | **Disparador:** OT cerrada incluye recomendación de próxima mantención, o el sistema detecta que corresponde una por km o fecha.
**Pre:** Vehículo con historial de mantenciones registradas.
**Flujo:** 1) Definir el tipo de mantención programada 2) Establecer condición de disparo (fecha estimada o km estimado) 3) Asociar a la Historia Técnica del vehículo
**Alt/Ex:** Cliente ya tiene fecha → registrar como cita confirmada.
**Historia Técnica:** Registro de Mantención Programada con condición y fecha/km estimados.
**Reglas:** Una mantención programada genera una Alerta de Mantención automática cuando se aproxima la fecha o el km proyectado.
**Resultado:** Mantención en calendario. Alerta programada para el sistema. · **V1**

---

### UC-S02 · Ejecutar Seguimiento
**Actor:** Recepcionista / Sistema | **Disparador:** Plazo de seguimiento post-entrega alcanzado (por defecto 7 días).
**Pre:** OT cerrada y entregada hace N días.
**Flujo:** 1) Contactar al cliente por canal preferido 2) Registrar respuesta (satisfecho / con problema / sin respuesta) 3) Si hay problema → crear nuevo evento en Historia Técnica
**Alt/Ex:** Sin respuesta → registrar intento y reprogramar. Cliente con problema → evaluar si corresponde garantía (UC-G02).
**Historia Técnica:** Registro de Seguimiento con resultado de contacto.
**Reglas:** El seguimiento es parte de la Historia Técnica aunque no derive en trabajo. Un cliente que no responde a tres intentos se registra como "sin contacto".
**Resultado:** Seguimiento documentado. Relación post-venta trazable. · **V1**

---

### UC-S03 · Enviar Recordatorio Automático
**Actor:** Sistema | **Disparador:** Condición programada alcanzada (fecha/km de mantención).
**Pre:** UC-S01 completado con condición de disparo definida.
**Flujo:** 1) Sistema detecta condición cumplida 2) Genera mensaje personalizado 3) Envía por canal preferido del cliente (WhatsApp/email/SMS) 4) Registra envío y espera respuesta
**Alt/Ex:** Sin canal configurado → alertar al recepcionista para contacto manual. Si el cliente responde para agendar → crear cita.
**Historia Técnica:** Registro de Alerta de Mantención enviada con resultado.
**Reglas:** El sistema no envía más de un recordatorio por la misma mantención cada 30 días.
**Resultado:** Cliente informado. Recordatorio registrado en Historia Técnica. · **V1**
