# Changelog

Todos los cambios significativos de la especificación funcional del ERP All Motors se documentan en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [v1.0] — 2026-06-30

### Añadido

- Primera versión oficial del Documento Maestro Funcional (`ERP_MASTER_v1.0.md`).
- Define el ciclo completo de vida de un vehículo en el taller (Etapas 0–13).
- Define todos los actores del sistema: cliente particular, empresa, aseguradora, leasing, recepcionista, jefe de taller, mecánico, bodeguero, administrador, gerente/dueño, contador y proveedor.
- Diseño completo de la pantalla de Recepción: identificación del vehículo, conductor, responsable económico, tipo de financiamiento, motivo de ingreso, estado físico del vehículo, documentos generados y estados.
- Diseño de la Orden de Trabajo (OT) con secciones: encabezado, diagnóstico, trabajos y servicios, repuestos y materiales, trabajo adicional, observaciones, estados (16 estados) y checklist de control de calidad.
- Especificación del Catálogo de Servicios: tipos de entrada (simple, compuesto, paquete, material), atributos, precios y tarifas, servicios sugeridos, flujo de creación desde OT, servicios inactivos.
- Especificación del módulo de Inventario: ciclo de vida del repuesto, información mínima, gestión de proveedores, múltiples precios, alertas de stock, compras, casos especiales.
- Especificación del módulo de Presupuestos: construcción automática, campos congelados post-aprobación, edición post-aprobación, formatos, comunicación al cliente, vencimiento.
- Especificación del módulo de Facturación: contexto chileno (SII, DTE, IVA 19%), tipos de pago (contado, crédito, seguro, mixto, abonos), flujo de facturación, nota de crédito, cuentas por cobrar.
- Especificación del módulo de Garantías: nacimiento automático, estructura, control, proceso de reclamo, anulación, garantía del proveedor.
- Especificación del módulo CRM: ficha de cliente, ficha de vehículo, empresas y flotas, recordatorios y seguimiento, campañas.
- Especificación de KPIs: indicadores de operación diaria, financieros, productividad, catálogo e inventario, calidad y garantías, clientes.
- Manual funcional operativo completo: introducción, principios fundamentales, jornada típica del taller y flujos de los 3 casos de negocio más comunes.
- Revisión crítica del documento: duplicidades resueltas, complejidad eliminada, procesos redundantes removidos, módulos faltantes identificados, flujos inconsistentes corregidos, propuestas simplificadas.
- Priorización en 4 niveles: núcleo (día 1), segundo nivel (3 meses), tercer nivel (6 meses), post-implementación.

---

## [Próximas versiones]

Las versiones futuras se numerarán como v1.1, v1.2, etc. para cambios menores o aclaraciones, y v2.0 para revisiones estructurales que modifiquen decisiones de arquitectura funcional.

Toda nueva funcionalidad implementada que amplíe o modifique este documento deberá registrarse aquí con la versión correspondiente antes de ser implementada en código.
