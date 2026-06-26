# Use Cases — Portal Cliente

**Área:** 13 | **Casos:** UC-PC01 | **MVP:** 0/1  
← [USE_CASE_MODEL.md — Índice maestro](../USE_CASE_MODEL.md)

---

### UC-PC01 · Usar Portal Cliente
**Actor:** Cliente (externo) | **Disparador:** Cliente accede al portal web/app del taller.
**Pre:** El taller tiene habilitado el Portal. Cliente tiene cuenta.
**Flujo:** 1) Autenticarse con email o teléfono 2) Ver sus vehículos registrados 3) Consultar estado actual de OT activa 4) Ver Historia Técnica del vehículo (vista filtrada) 5) Recibir y aprobar presupuestos 6) Ver garantías vigentes y documentos generados
**Alt/Ex:** Sin OT activa → ver historial pasado y recomendaciones pendientes.
**Historia Técnica:** No genera registros propios. El cliente ve una vista de lectura de su historia.
**Reglas:** El cliente ve solo lo que el taller decide mostrar. Diagnósticos internos y notas técnicas pueden ser privados.
**Resultado:** Cliente informado y con acceso a sus documentos sin llamar al taller. · **V1**
