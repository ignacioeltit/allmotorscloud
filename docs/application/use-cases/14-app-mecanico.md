# Use Cases — App Mecánico

**Área:** 14 | **Casos:** UC-AM01 | **MVP:** 0/1  
← [USE_CASE_MODEL.md — Índice maestro](../USE_CASE_MODEL.md)

---

### UC-AM01 · Usar App Mecánico
**Actor:** Mecánico | **Disparador:** El mecánico inicia turno o recibe asignación.
**Pre:** Mecánico con cuenta activa. Vehículo asignado.
**Flujo:** 1) Ver lista de vehículos asignados con prioridad 2) Abrir el vehículo → ver trabajos autorizados y recomendaciones 3) Marcar inicio de trabajo 4) Registrar lo que hizo, partes usadas y tiempo 5) Adjuntar fotos 6) Reportar hallazgos adicionales al jefe de taller con un tap
**Alt/Ex:** Sin conexión → modo offline. Sincroniza al recuperar señal.
**Historia Técnica:** Todo lo registrado desde la app va a la Historia Técnica en tiempo real.
**Reglas:** La app no muestra precios, datos del cliente ni información financiera. Solo información técnica del vehículo y los trabajos asignados. Máximo 3 clics para cualquier acción frecuente.
**Resultado:** Mecánico operando con mínima fricción administrativa. · **V1**
