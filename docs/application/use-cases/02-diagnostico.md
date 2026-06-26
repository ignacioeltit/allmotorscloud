# Use Cases — Diagnóstico

**Área:** 02 | **Casos:** UC-D01, UC-D02 | **MVP:** 2/2  
← [USE_CASE_MODEL.md — Índice maestro](../USE_CASE_MODEL.md)

---

### UC-D01 · Crear Diagnóstico
**Actor:** Mecánico | **Disparador:** Vehículo asignado para diagnóstico.
**Pre:** UC-R06 completado. Vehículo en estado "Asignado".
**Flujo:** 1) Revisar Historia Técnica del vehículo (recomendaciones pendientes de visitas anteriores) 2) Evaluar el vehículo técnicamente 3) Registrar hallazgos, causa raíz y hallazgos adicionales 4) Estimar tiempo de reparación 5) Marcar diagnóstico como finalizado
**Alt/Ex:** Hallazgos adicionales graves → alertar al jefe de taller antes de finalizar. El mecánico nunca contacta al cliente directamente.
**Historia Técnica:** Registro de Diagnóstico. Evidencias: fotos de fallas, archivo de scanner si se realizó.
**Reglas:** El diagnóstico es la base del presupuesto. Sin diagnóstico cerrado, no puede crearse presupuesto. El mecánico no ingresa precios.
**Resultado:** Diagnóstico cerrado. OT avanza a estado "Diagnósticada". · **MVP**

---

### UC-D02 · Registrar Escaneo Electrónico
**Actor:** Mecánico | **Disparador:** Se realiza lectura de códigos de falla con scanner OBD.
**Pre:** Vehículo en diagnóstico o recepción.
**Flujo:** 1) Conectar scanner al puerto OBD del vehículo 2) Ejecutar lectura 3) Exportar archivo de resultado 4) Adjuntar archivo al registro activo 5) Registrar observación sobre los códigos detectados
**Alt/Ex:** Scanner sin exportación digital → fotografiar pantalla del scanner. Escaneo sin hallazgos → registrar como resultado negativo (también es información).
**Historia Técnica:** Registro de Escaneo Electrónico. Evidencias: archivo de scanner o fotografía de pantalla.
**Reglas:** Un resultado negativo de scanner es válido y debe quedar registrado.
**Resultado:** Resultado de escaneo en Historia Técnica disponible para el mecánico y el jefe de taller. · **MVP**
