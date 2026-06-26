# Use Cases — Evidencias

**Área:** 06 | **Casos:** UC-EV01 a UC-EV04 | **MVP:** 1/4  
← [USE_CASE_MODEL.md — Índice maestro](../USE_CASE_MODEL.md)

---

### UC-EV01 · Agregar Fotografías
**Actor:** Mecánico / Recepcionista | **Disparador:** Cualquier momento que requiera documentación visual.
**Pre:** Evento activo al que adjuntar.
**Flujo:** 1) Abrir cámara del dispositivo 2) Capturar imagen 3) Adjuntar al evento activo 4) Agregar descripción corta opcional
**Alt/Ex:** Foto desde galería → permitido. Mínimo de fotos en recepción: 4 ángulos del vehículo.
**Historia Técnica:** Fotografía adjunta al evento correspondiente.
**Reglas:** Las fotografías son inmutables una vez cerrado el evento al que pertenecen.
**Resultado:** Fotografía guardada en la Historia Técnica como evidencia. · **MVP**

---

### UC-EV02 · Agregar Videos
**Actor:** Mecánico / Recepcionista | **Disparador:** La evidencia requiere mostrar movimiento, sonido o un proceso.
**Pre:** Evento activo al que adjuntar.
**Flujo:** 1) Grabar o seleccionar video desde dispositivo 2) Adjuntar al evento activo 3) Descripción opcional
**Alt/Ex:** Video muy largo → alertar al usuario sobre peso del archivo.
**Historia Técnica:** Video adjunto al evento. Evidencia de alta prioridad en diagnósticos de fallas intermitentes.
**Reglas:** Los videos de diagnóstico de fallas son especialmente valiosos para análisis de IA futuro.
**Resultado:** Video disponible en la Historia Técnica. · **V1**

---

### UC-EV03 · Agregar PDF
**Actor:** Sistema / Recepcionista / Mecánico | **Disparador:** Se genera o recibe un documento formal.
**Pre:** Evento activo al que adjuntar.
**Flujo:** 1) Generar el PDF desde el sistema (presupuesto, factura, etc.) O subir PDF externo 2) Adjuntar al evento correspondiente
**Alt/Ex:** PDFs de TallerGP durante migración → se adjuntan al evento de migración del vehículo correspondiente.
**Historia Técnica:** PDF adjunto al evento (presupuesto, OT, factura, certificado, etc.).
**Reglas:** Los PDFs generados por el sistema se crean automáticamente. No pueden modificarse post-generación.
**Resultado:** Documento disponible para consulta e impresión desde la Historia Técnica. · **V1**

---

### UC-EV04 · Agregar Archivo de Scanner
**Actor:** Mecánico | **Disparador:** Se completa un escaneo electrónico (UC-D02).
**Pre:** Scanner OBD conectado y lectura completada.
**Flujo:** 1) Exportar el archivo del scanner (CSV, PDF o formato propietario) 2) Adjuntar al registro de escaneo 3) El sistema muestra los códigos de falla si el formato es compatible
**Alt/Ex:** Formato no reconocido → adjuntar como archivo genérico. El mecánico puede agregar descripción manual de los códigos.
**Historia Técnica:** Archivo adjunto al Registro de Escaneo. Visible para mecánico y jefe de taller.
**Reglas:** El archivo de scanner es la evidencia técnica más importante en diagnósticos electrónicos.
**Resultado:** Archivo de scanner disponible en Historia Técnica. · **MVP**
