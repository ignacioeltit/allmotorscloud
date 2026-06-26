# Use Case Model — All Motors Cloud

**Estado:** Draft  
**Versión:** 1.0  
**Última actualización:** Junio 2026  
**Propósito:** Índice maestro de la especificación funcional del sistema

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Clasificación y enlaces por área](#2-clasificación-y-enlaces-por-área)
3. [Estructura por caso de uso](#3-estructura-por-caso-de-uso)
4. [Dependencias entre casos](#4-dependencias-entre-casos)
5. [Casos automáticos del sistema](#5-casos-automáticos-del-sistema)
6. [Casos de Inteligencia Artificial](#6-casos-de-inteligencia-artificial)
7. [Preguntas abiertas](#7-preguntas-abiertas)

---

## 1. Introducción

Este documento es el índice maestro de la especificación funcional de All Motors Cloud. Describe **qué puede hacer el sistema** antes de diseñar base de datos, API o interfaces.

Los casos de uso están organizados en 15 archivos por área dentro de `docs/application/use-cases/`. Este índice contiene el resumen, las dependencias y las preguntas de negocio abiertas.

**Relación con otros documentos:**

| Documento fuente | Qué aporta a este documento |
|---|---|
| `WORKSHOP_OPERATING_MODEL.md` | El flujo real de operación del taller y los actores involucrados |
| `EVENT_MODEL.md` | El tipo de registro que cada caso genera en la Historia Técnica |
| `DOMAIN_MODEL.md` | Las entidades que cada caso crea, modifica o consulta |

**Prioridades usadas:**

| Prioridad | Significado |
|---|---|
| MVP | Requerido para el primer lanzamiento operacional |
| V1 | Primera versión completa post-lanzamiento |
| V2 | Segunda versión con funcionalidades avanzadas |
| Futuro | En roadmap pero sin fecha definida |

---

## 2. Clasificación y enlaces por área

| # | Área | Archivo | Casos | MVP |
|---|---|---|---|---|
| 01 | Recepción y vehículos | [01-recepcion-y-vehiculos.md](use-cases/01-recepcion-y-vehiculos.md) | UC-R01 a UC-R07 | 7/7 |
| 02 | Diagnóstico | [02-diagnostico.md](use-cases/02-diagnostico.md) | UC-D01, UC-D02 | 2/2 |
| 03 | Presupuesto y autorización | [03-presupuesto-y-autorizacion.md](use-cases/03-presupuesto-y-autorizacion.md) | UC-P01 a UC-P05 | 4/5 |
| 04 | Órdenes de trabajo | [04-ordenes-de-trabajo.md](use-cases/04-ordenes-de-trabajo.md) | UC-OT01, UC-OT02 | 2/2 |
| 05 | Reparación | [05-reparacion.md](use-cases/05-reparacion.md) | UC-E01 a UC-E06 | 4/6 |
| 06 | Evidencias | [06-evidencias.md](use-cases/06-evidencias.md) | UC-EV01 a UC-EV04 | 1/4 |
| 07 | Entrega y cobro | [07-entrega-y-cobro.md](use-cases/07-entrega-y-cobro.md) | UC-ENT01 a UC-ENT03 | 3/3 |
| 08 | Garantías y recomendaciones | [08-garantias-y-recomendaciones.md](use-cases/08-garantias-y-recomendaciones.md) | UC-G01 a UC-G03 | 1/3 |
| 09 | Seguimiento y mantención | [09-seguimiento-y-mantencion.md](use-cases/09-seguimiento-y-mantencion.md) | UC-S01 a UC-S03 | 0/3 |
| 10 | Historia Técnica | [10-historia-tecnica.md](use-cases/10-historia-tecnica.md) | UC-HT01 a UC-HT03 | 2/3 |
| 11 | Administración | [11-administracion.md](use-cases/11-administracion.md) | UC-A01 a UC-A05 | 2/5 |
| 12 | Reportes | [12-reportes.md](use-cases/12-reportes.md) | UC-REP01 | 1/1 |
| 13 | Portal Cliente | [13-portal-cliente.md](use-cases/13-portal-cliente.md) | UC-PC01 | 0/1 |
| 14 | App Mecánico | [14-app-mecanico.md](use-cases/14-app-mecanico.md) | UC-AM01 | 0/1 |
| 15 | Inteligencia Artificial | [15-inteligencia-artificial.md](use-cases/15-inteligencia-artificial.md) | UC-IA01 | 0/1 |
| | **Total** | | **47 casos** | **29 MVP** |

---

## 3. Estructura por caso de uso

Cada caso en los archivos de área documenta los siguientes campos:

| Campo | Descripción |
|---|---|
| Nombre | Identificador único y nombre del caso |
| Objetivo | Qué se logra al completar este caso |
| Actor principal | Quién inicia la acción |
| Actores secundarios | Otros participantes |
| Disparador | Qué evento origina este caso |
| Precondiciones | Qué debe existir o estar en estado correcto para ejecutarse |
| Flujo principal | Pasos del camino feliz |
| Flujos alternativos | Variantes válidas del flujo principal |
| Excepciones | Condiciones de error o bloqueo |
| Información generada | Datos que quedan guardados |
| Registros en Historia Técnica | Tipo de evento que se agrega |
| Evidencias asociadas | Archivos o firmas que pueden adjuntarse |
| Reglas de negocio | Restricciones que el sistema impone |
| Resultado esperado | Estado del sistema al terminar exitosamente |
| Prioridad | MVP / V1 / V2 / Futuro |

---

## 4. Dependencias entre casos

El sistema debe imponer estas dependencias. No son sugerencias.

```
UC-R02 (Crear Vehículo)        → precondición de todo lo demás
UC-R05 (Recibir Vehículo)      → habilita UC-OT01 (Crear OT)
UC-OT01 (Crear OT)             → habilita UC-D01 (Crear Diagnóstico)
UC-D01  (Diagnóstico cerrado)  → habilita UC-P01 (Crear Presupuesto)
UC-P01  (Presupuesto creado)   → habilita UC-P03 (Enviar Presupuesto)
UC-P04  (Aprobación)           → habilita UC-E03 (Registrar Mano de Obra)
UC-E03  (todos los ítems OK)   → habilita UC-E05 (Control de Calidad)
UC-E05  (aprobado)             → dispara notificación automática al cliente
UC-E05  (aprobado)             → habilita UC-ENT01 (Entregar Vehículo)
UC-ENT03 (Pago resuelto)       → condición para cerrar UC-ENT01
UC-ENT01 (OT cerrada)          → habilita UC-G01 (Crear Garantía)
UC-P05  (Rechazo)              → crea automáticamente UC-G03 (Recomendación Pendiente)
```

**Casos sin dependencias (disponibles con vehículo activo en cualquier momento):**
- UC-EV01 a UC-EV04 (Evidencias)
- UC-E06 (Observaciones)
- UC-HT01 (Consultar Historia Técnica)

---

## 5. Casos automáticos del sistema

El sistema ejecuta estos procesos sin intervención humana:

| Proceso | Disparador | Resultado |
|---|---|---|
| Notificación de vehículo listo | UC-E05 aprobado | Mensaje al cliente por canal preferido |
| Alerta de mantención | Fecha o km proyectado alcanzado | Recordatorio al cliente (UC-S03) |
| Alerta de garantía próxima a vencer | X días antes del vencimiento | Aviso al recepcionista y al cliente |
| Alerta de stock crítico | Inventario baja del mínimo | Alerta al administrador |
| Alerta de tiempo en taller excedido | Vehículo supera tiempo estimado | Alerta al jefe de taller |
| Detección de vehículo reincidente | N reingresos en M días | Alerta al jefe de taller antes del diagnóstico |
| Recordatorio de presupuesto sin respuesta | X días sin respuesta del cliente | Alerta al recepcionista |

---

## 6. Casos de Inteligencia Artificial

Ver detalle completo en [15-inteligencia-artificial.md](use-cases/15-inteligencia-artificial.md).

| Caso IA | Valor para el taller |
|---|---|
| Sugerir diagnóstico | Reduce tiempo de diagnóstico con patrones conocidos |
| Detectar reparaciones repetidas | Detecta fallas de calidad o repuesto incorrecto |
| Recomendar mantenciones | Predicción más precisa que solo fecha calendario |
| Analizar tiempos muertos | Identifica cuellos de botella operacionales |
| Alertar garantías con riesgo | Anticipa reclamaciones antes de que ocurran |
| Detectar clientes en riesgo | Identifica clientes que posiblemente cambiaron de taller |
| Analizar productividad por mecánico | Fortalezas y áreas de mejora por tipo de trabajo |

---

## 7. Preguntas abiertas

Deben resolverse antes del diseño de interfaces y base de datos.

1. **Aprobación remota de presupuesto (UC-P03/P04):** ¿el cliente puede aprobar desde el Portal Cliente, o solo puede verlo y debe llamar para confirmar? La aprobación remota requiere evidencia equivalente al mensaje de WhatsApp.

2. **Modificación de presupuesto enviado (UC-P02):** ¿la nueva versión puede enviarse automáticamente al cliente por el canal original, o siempre requiere acción manual de recepción?

3. **Factura antes de entregar (UC-ENT02):** ¿puede emitirse la factura electrónica antes del pago efectivo? La secuencia factura → pago vs. pago → factura varía según taller.

4. **Garantía con múltiples componentes (UC-G01):** ¿una OT puede generar garantías distintas por ítem (con fechas de vencimiento diferentes), o una garantía global por visita?

5. **Recomendaciones pendientes y cambio de propietario (UC-G03):** si el vehículo cambia de dueño, ¿el nuevo propietario hereda las recomendaciones del anterior o empieza con historial limpio?

6. **Dashboard en tiempo real (UC-REP01):** ¿los reportes son en tiempo real o con período de cálculo (diario/semanal)? Los reportes en tiempo real tienen implicaciones de rendimiento importantes.

7. **Visibilidad del historial para nuevo propietario (UC-HT01):** ¿el nuevo propietario ve el historial completo del vehículo en el Portal Cliente, o solo desde su fecha de adquisición?

8. **App Mecánico sin conexión (UC-AM01):** ¿cuál es la política si dos mecánicos registran sobre el mismo vehículo simultáneamente en modo offline? ¿Last-write-wins o merge manual?

9. **Portal Cliente — visibilidad configurable (UC-PC01):** ¿quién decide qué registros son privados (solo taller) y cuáles son visibles al cliente? ¿Es por tipo de evento o por registro individual?

10. **Emisión de factura electrónica (UC-ENT02):** ¿All Motors Cloud se integra con el SII (servicio de impuestos chileno) para emisión de documentos tributarios electrónicos, o solo genera el PDF interno?

---

*Los 47 casos de uso completos están en `docs/application/use-cases/`.*  
*Toda pantalla, endpoint y regla de negocio debe poder trazarse hasta un caso documentado aquí.*
