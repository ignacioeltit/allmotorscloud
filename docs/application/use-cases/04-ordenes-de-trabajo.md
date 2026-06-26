# Use Cases — Órdenes de Trabajo

**Área:** 04 | **Casos:** UC-OT01, UC-OT02 | **MVP:** 2/2  
← [USE_CASE_MODEL.md — Índice maestro](../USE_CASE_MODEL.md)

---

### UC-OT01 · Crear Orden de Trabajo
**Actor:** Sistema (automático) / Recepcionista | **Disparador:** Recepción formal completada (UC-R05) en visita con consecuencia económica.
**Pre:** UC-R05 completado.
**Flujo:** 1) El sistema crea la OT automáticamente al cerrar la recepción 2) Asignar número único de OT 3) Vincular eventos de la visita (recepción, diagnóstico, presupuesto, etc.)
**Alt/Ex:** Visita sin consecuencia económica (consulta, cotización) → no genera OT.
**Historia Técnica:** La OT no es un evento en sí mismo, es un documento que agrupa los eventos de la visita.
**Reglas:** Solo una OT activa por vehículo a la vez. El número de OT es irrepetible.
**Resultado:** OT creada y numerada. Listo para diagnóstico. · **MVP**

---

### UC-OT02 · Asignar Mecánico
**Actor:** Jefe de Taller | **Disparador:** Vehículo en estado "Check-In completado" o evento de reparación sin responsable.
**Pre:** Vehículo en taller. Mecánico disponible.
**Flujo:** 1) Ver carga de trabajo actual de mecánicos disponibles 2) Asignar mecánico según especialidad y disponibilidad 3) Mecánico recibe notificación del vehículo asignado
**Alt/Ex:** Sin mecánico disponible → vehículo en lista de espera con prioridad.
**Historia Técnica:** Registro de asignación con nombre del mecánico y timestamp.
**Reglas:** Un mecánico puede tener múltiples vehículos asignados. El sistema muestra su carga actual.
**Resultado:** Mecánico asignado. Evento visible en App Mecánico. · **MVP**
