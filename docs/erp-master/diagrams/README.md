# Diagramas — All Motors ERP

Esta carpeta contiene los diagramas visuales del ERP All Motors.

Los diagramas complementan el Documento Maestro Funcional (`../ERP_MASTER_v1.0.md`) con representaciones visuales de los flujos, estados y modelos del sistema.

---

## Contenido planificado

### Arquitectura
- Diagrama de arquitectura general del sistema (frontend, backend, base de datos, integraciones externas)
- Diagrama de componentes por módulo

### Flujos de negocio
- Flujo completo del ciclo de vida de un vehículo (Etapas 0–13)
- Flujo de Recepción
- Flujo de Presupuesto → Aprobación → Trabajo
- Flujo de Entrega → Cobro → Factura
- Flujo de Reclamo de Garantía
- Flujo de Compra de Repuestos

### Diagramas de estados
- Estados de la OT (16 estados con transiciones válidas)
- Estados del Presupuesto
- Estados del Repuesto en Inventario
- Estados de la Garantía

### Modelo de datos
- Diagrama entidad-relación del esquema principal
- Modelo de dominio (vehículo → historia técnica → evento → OT)

### Diagramas de procesos
- Proceso de diagnóstico y trabajo adicional
- Proceso de compra y reserva de materiales
- Proceso de facturación según tipo de financiamiento

---

## Convenciones

- Formato preferido: Mermaid (integrado en Markdown) o SVG exportado de herramienta de diseño
- Cada diagrama incluye su fecha de última actualización
- Los diagramas se actualizan cuando cambia el Documento Maestro Funcional
