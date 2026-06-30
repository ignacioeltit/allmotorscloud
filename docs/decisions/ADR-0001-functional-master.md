# ADR-0001 — ERP_MASTER como fuente oficial de especificación funcional

**Estado:** Accepted
**Fecha:** 2026-06-30
**Autor:** Ignacio Eltit (propietario del producto)
**Revisores:** equipo de desarrollo All Motors

---

## Contexto

Durante el Sprint 10 (junio 2026), el proyecto acumuló múltiples documentos con superposición funcional:

- `docs/business/WORKSHOP_OPERATING_MODEL.md` — modelo operativo del taller
- `docs/product-bible/04-CICLO-DE-VIDA-DEL-VEHICULO.md` — ciclo de vida del vehículo
- `docs/application/use-cases/` — 15 archivos de casos de uso, varios incompletos
- `docs/architecture/` — documentos de arquitectura con secciones funcionales intercaladas

Esta dispersión generaba ambigüedad: ante una duda sobre cómo debe comportarse el sistema, no había un lugar único y autoritativo donde buscar la respuesta.

Además, el proyecto alcanzó un nivel de madurez suficiente como para necesitar una especificación funcional completa que:

1. Cubra todos los módulos del ERP (ciclo completo, actores, recepción, OT, catálogo, inventario, presupuestos, facturación, garantías, CRM, KPIs)
2. Esté escrita desde la perspectiva del negocio, no de la implementación
3. Sirva como base para incorporar nuevos desarrolladores sin necesidad de onboarding prolongado
4. Permita detectar desviaciones entre la implementación y el modelo de negocio acordado

---

## Problema

**Sin una fuente de verdad única para la especificación funcional, el desarrollo avanza en direcciones inconsistentes.**

Síntomas observados:
- La OT no tenía `responsable_id` porque el modelo de datos no estaba conectado con la necesidad funcional de saber quién paga
- El módulo de recepción fue implementado sin la distinción propietario / conductor / responsable económico
- Existían rutas que permitían crear OTs sin pasar por el flujo de recepción (bypass operativo)
- Los casos de uso documentados eran incompletos o inconsistentes entre sí

---

## Decisión

Se establece el archivo `docs/erp-master/ERP_MASTER_v1.0.md` como la **fuente oficial y autoritativa de la especificación funcional del ERP All Motors**.

Este documento:

- Define el ciclo completo de vida de un vehículo en el taller (13 etapas)
- Define todos los actores del sistema con sus capacidades y restricciones
- Define el comportamiento esperado de cada módulo: Recepción, OT, Catálogo, Inventario, Presupuestos, Facturación, Garantías, CRM
- Define los KPIs e indicadores del dashboard
- Incluye los casos de negocio más comunes con flujos detallados
- Incluye una revisión crítica del propio documento con simplificaciones y priorización

**Regla de oro:** si la implementación en código contradice lo que dice ERP_MASTER, el código debe corregirse. Si ERP_MASTER debe actualizarse, se hace mediante una nueva versión (v1.1, v1.2, v2.0) con entrada en CHANGELOG.md.

---

## Consecuencias

**Positivas:**
- Cualquier desarrollador puede entender qué debe hacer el sistema leyendo un solo documento
- Las decisiones de implementación tienen una referencia clara para validarse
- Los conflictos entre implementación y expectativas del negocio se detectan temprano
- Facilita el onboarding: ERP_MASTER + ADR-0001 + DEVELOPMENT_RULES = contexto completo en 30 minutos
- El producto owner (Ignacio) tiene un artefacto que puede revisar y aprobar sin necesidad de entender código

**Negativas / compensaciones:**
- El ERP_MASTER debe mantenerse actualizado cuando el negocio evoluciona. Si se deja desactualizar, pierde su valor como referencia.
- Agregar una nueva funcionalidad requiere primero actualizar el documento y luego implementar. Este overhead es intencional: fuerza claridad antes que código.
- Puede haber tensión entre "lo que dice el documento" y "lo que el cliente quiere mañana". La mitigación es versionar rápido cuando los cambios son reales.

---

## Alternativas descartadas

**Alternativa A — Mantener los documentos existentes dispersos sin un maestro**

Descartada porque la dispersión ya estaba causando problemas concretos en la implementación (ver sección Problema). Con más desarrolladores o más tiempo entre sesiones de trabajo, el problema escalaría.

**Alternativa B — Usar los casos de uso en `application/use-cases/` como fuente de verdad**

Descartada porque los casos de uso estaban incompletos (varios archivos con 15-26 líneas), estaban escritos en formato técnico, y no cubrían la perspectiva de negocio completa. Son un complemento válido del ERP_MASTER, no un sustituto.

**Alternativa C — Usar el `product-bible/` como fuente de verdad**

Descartada porque la product-bible está incompleta (solo 5 capítulos) y no cubre el detalle operativo necesario (flujos específicos, estados de OT, tipos de financiamiento, procesos de garantía, etc.).

**Alternativa D — Escribir especificaciones por módulo en `docs/modules/`**

Descartada como fuente de verdad única porque fragmenta la visión. Los módulos individuales son útiles como documentación de implementación, pero el ERP_MASTER provee la visión integrada que los módulos necesitan para ser coherentes entre sí. Ambos pueden coexistir: ERP_MASTER para la visión, `modules/` para el detalle de implementación.

---

## Relación con otros documentos

- **Supersede:** ningún documento se elimina, pero ERP_MASTER tiene prioridad ante conflicto con cualquier otro documento funcional.
- **Complementado por:** `application/use-cases/` (detalle de flujos), `architecture/` (cómo se implementa), `domain-model/DOMAIN_MODEL.md` (modelo de entidades).
- **Gobernado por:** `decisions/DEVELOPMENT_RULES.md` (reglas de mantenimiento).

---

## Historial de este ADR

| Fecha | Cambio |
|---|---|
| 2026-06-30 | Creación inicial — estado Accepted |
