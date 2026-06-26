# Use Cases — Historia Técnica

**Área:** 10 | **Casos:** UC-HT01 a UC-HT03 | **MVP:** 2/3  
← [USE_CASE_MODEL.md — Índice maestro](../USE_CASE_MODEL.md)

---

### UC-HT01 · Consultar Historia Técnica
**Actor:** Mecánico / Recepcionista / Jefe de Taller | **Disparador:** Ingresa patente al sistema.
**Pre:** Vehículo existente en el sistema.
**Flujo:** 1) Ingresar patente 2) El sistema muestra cronología completa de eventos 3) Ver recomendaciones pendientes destacadas al inicio 4) Navegar por tipo de evento, fecha o búsqueda libre
**Alt/Ex:** Patente no existe → ofrecer crear vehículo. Historial con eventos migrados de TallerGP → mostrar con etiqueta "Historial importado".
**Historia Técnica:** La consulta no genera un registro. Es lectura pura.
**Reglas:** Todo usuario con acceso al sistema puede consultar la Historia Técnica de cualquier vehículo de su organización.
**Resultado:** Información completa del vehículo disponible antes de tocar la llave. · **MVP**

---

### UC-HT02 · Generar Certificado de Historia Técnica
**Actor:** Recepcionista / Sistema | **Disparador:** Cliente solicita comprobante de historial técnico (para venta del vehículo u otro fin).
**Pre:** Vehículo con historial en el sistema.
**Flujo:** 1) Seleccionar vehículo 2) Definir rango de fechas o emitir historial completo 3) El sistema genera PDF con resumen de eventos, trabajos realizados, garantías y recomendaciones 4) Adjuntar a la Historia Técnica y entregar al cliente
**Alt/Ex:** Historial con información sensible del cliente anterior → opción de emitir versión anónima del propietario anterior.
**Historia Técnica:** Registro de emisión del certificado como evento del sistema.
**Reglas:** El certificado es de lectura. No puede modificarse una vez generado. Tiene número único.
**Resultado:** Documento oficial que acredita el historial técnico del vehículo. · **V2**

---

### UC-HT03 · Migrar Historial desde TallerGP
**Actor:** Administrador del sistema | **Disparador:** Inicio de la migración de datos desde TallerGP.
**Pre:** Acceso autenticado a la API de TallerGP. Vehículo identificado por patente.
**Flujo:** 1) Ejecutar script de migración para el vehículo (por patente) 2) Crear cliente, vehículo e Historia Técnica si no existen 3) Por cada OT de TallerGP: crear Registro Técnico con tipo "Importado" 4) Adjuntar PDFs descargados del CDN de TallerGP 5) Registrar IDs originales de TallerGP en cada entidad
**Alt/Ex:** Conflicto de datos → no sobrescribir registros existentes; crear registro de advertencia. PDF no disponible en CDN → registrar URL como evidencia aunque el archivo no esté accesible.
**Historia Técnica:** Eventos importados de TallerGP etiquetados como "Historial importado". IDs de origen preservados.
**Reglas:** La migración es de solo lectura sobre TallerGP. Los IDs de TallerGP se preservan indefinidamente para trazabilidad.
**Resultado:** Historial histórico del vehículo disponible en All Motors Cloud. · **MVP**
