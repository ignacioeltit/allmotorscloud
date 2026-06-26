# Use Cases — Entrega y Cobro

**Área:** 07 | **Casos:** UC-ENT01 a UC-ENT03 | **MVP:** 3/3  
← [USE_CASE_MODEL.md — Índice maestro](../USE_CASE_MODEL.md)

---

### UC-ENT01 · Entregar Vehículo
**Actor:** Recepcionista | **Disparador:** Control de calidad aprobado y cliente notificado.
**Pre:** UC-E05 aprobado. Pago resuelto o acuerdo documentado. Cliente presente.
**Flujo:** 1) Verificar identidad del cliente o conductor autorizado 2) Registrar km de salida 3) Entregar documento de garantía 4) Indicar recomendaciones de próxima mantención 5) Obtener firma del cliente en documento de entrega 6) Cerrar la OT
**Alt/Ex:** Conductor diferente al propietario recoge → verificar autorización del propietario. Acuerdo de pago pendiente → debe estar firmado y registrado antes de entregar.
**Historia Técnica:** Registro de Entrega con km de salida, garantías entregadas y firma.
**Reglas:** Sin pago resuelto o sin acuerdo documentado, el vehículo no se entrega. El cierre de la OT es irreversible.
**Resultado:** OT cerrada. Vehículo entregado. Historia Técnica completa con esta visita. · **MVP**

---

### UC-ENT02 · Emitir Factura
**Actor:** Administrador / Recepcionista | **Disparador:** Trabajo completado y aprobado por control de calidad.
**Pre:** OT en estado "Lista para entrega". Datos tributarios del cliente disponibles.
**Flujo:** 1) Seleccionar tipo de documento (boleta / factura según tipo de cliente) 2) Verificar ítems de la OT 3) Generar documento 4) El sistema adjunta el PDF a la OT y al Registro de Entrega
**Alt/Ex:** Cliente empresa → emitir factura. Persona natural → boleta. Ajuste de precio → registrar motivo y quién autorizó.
**Historia Técnica:** PDF de factura adjunto al Registro de Entrega.
**Reglas:** El número de factura/boleta es único. No puede emitirse sin OT cerrada.
**Resultado:** Documento tributario emitido y guardado en Historia Técnica. · **MVP**

---

### UC-ENT03 · Registrar Pago
**Actor:** Administrador / Recepcionista | **Disparador:** Cliente realiza el pago.
**Pre:** Factura emitida.
**Flujo:** 1) Seleccionar forma de pago (efectivo, transferencia, tarjeta, cheque) 2) Registrar monto y referencia (número de transferencia, voucher, etc.) 3) Confirmar pago 4) Emitir comprobante si corresponde
**Alt/Ex:** Pago parcial → registrar cuánto se pagó y el saldo pendiente con fecha compromiso. Pago con múltiples medios → registrar cada uno.
**Historia Técnica:** Registro de Pago en la OT.
**Reglas:** El vehículo no puede entregarse sin al menos un registro de pago o un acuerdo de pago firmado.
**Resultado:** Pago registrado. Saldo actualizado. · **MVP**
