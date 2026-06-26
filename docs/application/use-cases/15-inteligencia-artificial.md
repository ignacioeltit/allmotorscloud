# Use Cases — Inteligencia Artificial

**Área:** 15 | **Casos:** UC-IA01 | **MVP:** 0/1  
← [USE_CASE_MODEL.md — Índice maestro](../USE_CASE_MODEL.md)

---

### UC-IA01 · Usar Asistente IA
**Actor:** Mecánico / Jefe de Taller / Administrador | **Disparador:** Usuario activa el asistente en cualquier contexto de la plataforma.
**Pre:** Historia Técnica con datos suficientes para análisis.
**Flujo:** 1) Seleccionar vehículo o contexto 2) Consultar en lenguaje natural ("¿cuándo fue la última vez que se cambió el aceite?", "¿hay algún patrón en las fallas?") 3) El asistente responde con base en la Historia Técnica del vehículo y datos del taller
**Alt/Ex:** Datos insuficientes → responder indicando qué información falta. El asistente no inventa datos.
**Historia Técnica:** Las consultas al asistente no generan registros en la Historia Técnica.
**Reglas:** El asistente sugiere. No ejecuta acciones. No modifica datos. El usuario siempre tiene la última palabra.
**Resultado:** Respuesta basada en datos reales del vehículo disponible en segundos. · **Futuro**

---

## Oportunidades de IA — Casos futuros documentados

No se diseñan algoritmos aquí. Se documentan las oportunidades que la Historia Técnica hace posibles.

| Caso IA | Datos requeridos | Valor para el taller |
|---|---|---|
| Sugerir diagnóstico | Síntomas + modelo + año + historial de fallas similares | Reduce tiempo de diagnóstico en vehículos con patrones conocidos |
| Detectar reparaciones repetidas | Registros de reparación del mismo componente en < N meses | Detecta fallas de calidad o uso de repuesto incorrecto |
| Recomendar mantenciones | Historial de mantenciones + km registrados por visita | Predice próximas mantenciones con mayor precisión que solo la fecha |
| Analizar tiempos muertos | Eventos en estado "En espera" por motivo y duración | Identifica cuellos de botella en proveedores, autorización o equipos |
| Alertar garantías con riesgo | Reingresos frecuentes de cierto tipo de reparación | Detecta garantías que probablemente serán reclamadas antes de que lleguen |
| Detectar clientes en riesgo | Última visita + mantención esperada no realizada | Identifica clientes que posiblemente cambiaron de taller |
| Analizar productividad por mecánico | Tiempos reales vs. estimados por tipo de trabajo | Identifica fortalezas y áreas de mejora por mecánico y tipo de reparación |
