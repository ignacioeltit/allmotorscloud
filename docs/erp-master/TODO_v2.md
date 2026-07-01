# TODO v2 — Mejoras y funcionalidades pendientes

Lista de mejoras identificadas durante la revisión crítica del Documento Maestro Funcional v1.0.
Estas funcionalidades no forman parte del alcance actual (Versión 1) pero deben ser consideradas en el diseño base para no bloquear su implementación futura.

---

## Arquitectura y plataforma

- [ ] **Multiempresa completa** — soporte para múltiples talleres bajo una sola cuenta, con reportes consolidados y gestión centralizada de catálogo y convenios
- [ ] **Organización y sucursales** — una empresa puede tener múltiples locales; cada sucursal tiene su propio inventario, sus propios mecánicos, su propio calendario, pero comparten el catálogo central
- [ ] **Auditoría completa** — log inmutable de todas las acciones del sistema: quién hizo qué, cuándo, en qué registro, con qué valor anterior y nuevo

---

## Roles y permisos

- [ ] **Roles avanzados** — sistema de roles granulares donde cada permiso (ver, crear, editar, aprobar, eliminar) puede activarse por módulo y por rol, sin depender de roles predefinidos
- [ ] **Delegación de aprobaciones** — cuando el administrador está ausente, puede delegar aprobaciones a otra persona por un período definido

---

## Automatización y configuración

- [ ] **Motor de reglas** — sistema para definir reglas de negocio sin código: "si el vehículo lleva más de 3 días listo sin retiro, enviar mensaje al cliente y cobrar estadía"; "si la factura lleva 5 días vencida, bloquear nuevas OTs para ese cliente"
- [ ] **Workflow configurable** — flujos de aprobación definibles por el administrador: quién aprueba qué, con qué umbrales, en qué orden
- [ ] **Automatizaciones** — disparadores configurables para eventos: al crear OT, al cambiar de estado, al vencer presupuesto, al llegar stock a mínimo, etc.
- [ ] **Parametrización de estados** — los estados de la OT y de la Recepción deben ser configurables por el administrador: agregar estados propios, renombrar estados existentes, definir transiciones válidas
- [ ] **Parametrización de tarifas** — múltiples tarifas hora por tipo de trabajo (diagnóstico, mecánica general, electricidad, ADAS); tarifas diferenciadas por mecánico senior/junior

---

## Experiencia de usuario

- [ ] **Portal Cliente** — interfaz web/móvil para que el cliente vea el estado de su vehículo, apruebe presupuestos, consulte historial y descargue documentos sin necesidad de llamar al taller
- [ ] **Interfaz mecánico en tablet** — vista simplificada con botones grandes, apta para uso con manos sucias; muestra solo los trabajos asignados, sin información de precios ni administración
- [ ] **Firma digital del cliente** — captura de firma en tablet al momento de la recepción y entrega, eliminando completamente el papel

---

## Módulos funcionales pendientes

- [ ] **Estadía de vehículos** — cobro automático configurable por día de estadía cuando el vehículo está listo pero no retirado; alerta al cliente; reporte de vehículos en estadía
- [ ] **Subcontratos** — módulo para gestionar trabajos enviados a terceros: vinculación de factura del tercero con ítem de la OT, control de margen, seguimiento de entrega
- [ ] **Compras avanzadas** — cotización automática a múltiples proveedores, comparador de precios, historial de precios por proveedor, negociación de condiciones
- [ ] **Comisiones para mecánicos** — cálculo automático de comisiones por producción (horas facturadas, trabajos completados); liquidación mensual; historial por mecánico

---

## Integraciones externas

- [ ] **API pública** — API REST documentada para integraciones con plataformas externas: aseguradoras, proveedores, sistemas contables, marketplaces
- [ ] **Integración SII directa** — emisión y recepción de DTE sin intermediario; acceso al libro de ventas y compras en tiempo real; alertas de vencimiento de folios
- [ ] **Integración WhatsApp Business API** — notificaciones automáticas con respuesta bidireccional; aprobación de presupuestos por WhatsApp; recordatorios de mantención
- [ ] **Marketplace** — plataforma para que talleres de la red puedan compartir stock de repuestos, derivar trabajos especializados, o acceder a precios mayoristas

---

## Inteligencia y analítica

- [ ] **IA integrada** — sugerencias automáticas de servicios basadas en el historial del vehículo y en patrones de otros vehículos similares; estimación de tiempo de trabajo; detección de anomalías en inventario
- [ ] **Reportes avanzados** — rentabilidad por tipo de trabajo, por mecánico, por tipo de cliente, por marca de vehículo; comparativos históricos; proyecciones
- [ ] **Alertas predictivas** — detección anticipada de problemas: mecánico con baja productividad sostenida, servicio con costo de garantía elevado, repuesto con alta tasa de devolución

---

## Notas

Este listado es abierto y acumulativo. Toda funcionalidad identificada durante el desarrollo que no sea parte de la versión en curso debe agregarse aquí en lugar de implementarse sin planificación.

Cada ítem, al ser planificado para una versión específica, debe moverse al ROADMAP.md correspondiente y eliminarse de esta lista.
