# Use Cases — Garantías y Recomendaciones

**Área:** 08 | **Casos:** UC-G01 a UC-G03 | **MVP:** 1/3  
← [USE_CASE_MODEL.md — Índice maestro](../USE_CASE_MODEL.md)

---

### UC-G01 · Crear Garantía
**Actor:** Recepcionista / Sistema | **Disparador:** Trabajo completado que incluye cobertura de garantía.
**Pre:** OT cerrada con trabajo realizado.
**Flujo:** 1) Seleccionar el ítem de trabajo al que aplica la garantía 2) Definir alcance, duración (tiempo y/o km) y exclusiones 3) Generar documento de garantía 4) Adjuntar a la OT y al Registro de Entrega
**Alt/Ex:** Múltiples ítems con garantías distintas → una garantía por ítem.
**Historia Técnica:** Registro de Garantía referenciando el Registro de Reparación original.
**Reglas:** Una Garantía siempre referencia su Reparación padre. Sin Reparación registrada, no existe Garantía.
**Resultado:** Garantía activa en la Historia Técnica del vehículo. · **V1**

---

### UC-G02 · Registrar Reingreso por Garantía
**Actor:** Recepcionista | **Disparador:** Cliente regresa por problema cubierto por garantía.
**Pre:** Garantía activa en el sistema para ese vehículo.
**Flujo:** 1) Buscar patente 2) El sistema muestra garantías vigentes automáticamente 3) Crear nueva OT de tipo "Garantía" 4) Vincular a la OT original y a la Garantía correspondiente 5) Seguir flujo normal desde diagnóstico
**Alt/Ex:** Garantía vencida → registrar igualmente el reingreso. Evaluación si aplica cobertura parcial o cortesía.
**Historia Técnica:** Registro de Reingreso por Garantía referenciando OT original y Garantía.
**Reglas:** Un reingreso por garantía no puede cobrar los ítems cubiertos por la garantía original.
**Resultado:** Nueva OT vinculada a visita original. Historial completo del problema. · **V1**

---

### UC-G03 · Crear Recomendación Pendiente
**Actor:** Sistema (automático desde UC-P05) / Mecánico / Jefe de Taller | **Disparador:** Ítem rechazado por el cliente o trabajo detectado pero no autorizado.
**Pre:** Ítem identificado durante diagnóstico o presupuesto.
**Flujo:** 1) Identificar el trabajo detectado o rechazado 2) Registrar descripción técnica y nivel de urgencia 3) Quedar asociado a la Historia Técnica del vehículo
**Alt/Ex:** Recomendación de mantención preventiva → nivel de urgencia "preventivo". Riesgo de seguridad → nivel "urgente" con alerta visible en próxima visita.
**Historia Técnica:** Registro de Recomendación Pendiente. Permanente hasta ser ejecutado o descartado explícitamente.
**Reglas:** Las recomendaciones pendientes NUNCA desaparecen solas. Aparecen automáticamente en cada nueva visita del vehículo. Solo se cierran cuando se ejecutan o el propietario las descarta explícitamente.
**Resultado:** Trabajo pendiente visible para mecánico y recepcionista en próximas visitas. · **MVP**
