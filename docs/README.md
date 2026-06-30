# All Motors ERP — Documentación Oficial

> Índice maestro del proyecto. Todo desarrollador nuevo debe leer este documento antes de tocar código.

**Última actualización:** 2026-06-30
**Versión del ERP:** 1.0

---

## Cómo leer la documentación (15 minutos)

Si acabas de unirte al proyecto, lee en este orden:

1. **[`erp-master/ERP_MASTER_v1.0.md`](erp-master/ERP_MASTER_v1.0.md)** — La especificación funcional completa. Define qué hace el sistema, quiénes lo usan y cómo opera el taller. Es la referencia definitiva. Si tienes una duda sobre cómo debe comportarse el sistema, la respuesta está aquí.

2. **[`architecture/SYSTEM_ARCHITECTURE.md`](architecture/SYSTEM_ARCHITECTURE.md)** — Visión general de la arquitectura técnica: stack, capas, decisiones estructurales.

3. **[`decisions/ADR-0001-functional-master.md`](decisions/ADR-0001-functional-master.md)** — La primera decisión arquitectónica: por qué ERP_MASTER es la fuente de verdad.

4. **[`decisions/DEVELOPMENT_RULES.md`](decisions/DEVELOPMENT_RULES.md)** — Las reglas del proyecto. Obligatorio antes de hacer cualquier cambio.

5. **[`erp-master/ROADMAP.md`](erp-master/ROADMAP.md)** — Qué está planificado para las próximas versiones.

Con esos cinco documentos tienes el contexto completo para empezar a trabajar.

---

## Documentación Oficial

### 1. ERP Funcional

**Carpeta:** [`erp-master/`](erp-master/)

La especificación funcional oficial del ERP All Motors. Define el comportamiento del sistema desde el punto de vista del negocio: ciclo de vida del vehículo, actores, recepción, OT, catálogo, inventario, presupuestos, facturación, garantías, CRM e indicadores.

| Documento | Descripción |
|---|---|
| [`ERP_MASTER_v1.0.md`](erp-master/ERP_MASTER_v1.0.md) | **Fuente de verdad funcional.** Versión oficial vigente. |
| [`CHANGELOG.md`](erp-master/CHANGELOG.md) | Historial de cambios del documento funcional. |
| [`ROADMAP.md`](erp-master/ROADMAP.md) | Versiones planificadas: núcleo, financiero, automatización, plataforma. |
| [`TODO_v2.md`](erp-master/TODO_v2.md) | Mejoras y funcionalidades identificadas para versiones futuras. |
| [`diagrams/`](erp-master/diagrams/) | Carpeta de diagramas visuales (en preparación). |

---

### 2. Arquitectura Técnica

**Carpeta:** [`architecture/`](architecture/)

Documentación de las decisiones de diseño técnico: sistema general, frontend, backend, base de datos, seguridad, permisos, multi-tenant y arquitectura móvil.

| Documento | Descripción |
|---|---|
| [`SYSTEM_ARCHITECTURE.md`](architecture/SYSTEM_ARCHITECTURE.md) | Arquitectura general del sistema |
| [`BACKEND_ARCHITECTURE.md`](architecture/BACKEND_ARCHITECTURE.md) | Diseño del backend: módulos, server actions, API |
| [`FRONTEND_ARCHITECTURE.md`](architecture/FRONTEND_ARCHITECTURE.md) | Diseño del frontend: App Router, componentes, estado |
| [`DATABASE_MODEL.md`](architecture/DATABASE_MODEL.md) | Modelo de datos conceptual |
| [`PHYSICAL_SCHEMA.md`](architecture/PHYSICAL_SCHEMA.md) | Schema físico de PostgreSQL |
| [`PERSISTENCE_ARCHITECTURE.md`](architecture/PERSISTENCE_ARCHITECTURE.md) | Estrategia de persistencia y acceso a datos |
| [`PERMISSION_MODEL.md`](architecture/PERMISSION_MODEL.md) | Modelo de roles y permisos |
| [`SECURITY_MODEL.md`](architecture/SECURITY_MODEL.md) | Modelo de seguridad, RLS y autenticación |
| [`MULTI_TENANT_MODEL.md`](architecture/MULTI_TENANT_MODEL.md) | Arquitectura multi-tenant (shared DB + org_id) |
| [`MOBILE_ARCHITECTURE.md`](architecture/MOBILE_ARCHITECTURE.md) | Arquitectura de la aplicación móvil (futura) |
| [`API_MODEL.md`](architecture/API_MODEL.md) | Modelo de API pública (futura) |
| [`BUILD_ORDER.md`](architecture/BUILD_ORDER.md) | Orden de construcción de módulos |
| [`ROADMAP_DEVELOPMENT.md`](architecture/ROADMAP_DEVELOPMENT.md) | Roadmap técnico de desarrollo |

---

### 3. Base de Datos

**Carpeta:** [`database/`](database/)

Especificaciones de cada migración aplicada y documentación de las decisiones de schema. La fuente de verdad del schema son los archivos en `supabase/migrations/`.

| Documento | Descripción |
|---|---|
| [`MIGRATION_001_SPEC.md`](database/MIGRATION_001_SPEC.md) | Foundation: extensiones, auth, organizaciones, usuarios |
| [`MIGRATION_001_REVIEW.md`](database/MIGRATION_001_REVIEW.md) | Revisión y validación de migration 001 |
| [`MIGRATION_002_SPEC.md`](database/MIGRATION_002_SPEC.md) | Domain Core: vehículos, clientes, eventos |
| [`MIGRATION_003_SPEC.md`](database/MIGRATION_003_SPEC.md) | Operational Core: OTs, reparaciones, presupuestos, citas |
| [`MIGRATION_004_SPEC.md`](database/MIGRATION_004_SPEC.md) | Inventory: repuestos, movimientos de stock |
| [`MIGRATION_005_SERVICE_CATALOG_SPEC.md`](database/MIGRATION_005_SERVICE_CATALOG_SPEC.md) | Labor & Services: catálogo, plantillas, cargos, v_ot_totales |
| [`MIGRATION_005_STAGING_STATUS.md`](database/MIGRATION_005_STAGING_STATUS.md) | Estado de aplicación de M005 en staging |
| [`CATALOGO_VIVO_STRATEGY.md`](database/CATALOGO_VIVO_STRATEGY.md) | Estrategia del catálogo vivo y progresivo |
| [`CATALOGO_VIVO_FLOW_SPEC.md`](database/CATALOGO_VIVO_FLOW_SPEC.md) | Especificación del flujo del catálogo |

---

### 4. Modelo de Dominio

**Carpeta:** [`domain-model/`](domain-model/)

El modelo conceptual del dominio: entidades, relaciones y reglas de negocio expresadas en términos del dominio, independientemente de la implementación.

| Documento | Descripción |
|---|---|
| [`DOMAIN_MODEL.md`](domain-model/DOMAIN_MODEL.md) | Modelo de dominio completo (entidades, agregados, reglas) |

---

### 5. Casos de Uso

**Carpeta:** [`application/`](application/)

Los casos de uso del sistema organizados por área funcional. Complementan el ERP_MASTER con el detalle operativo de cada flujo.

| Documento | Descripción |
|---|---|
| [`USE_CASE_MODEL.md`](application/USE_CASE_MODEL.md) | Índice y estructura del modelo de casos de uso |
| [`use-cases/01-recepcion-y-vehiculos.md`](application/use-cases/01-recepcion-y-vehiculos.md) | Recepción y vehículos |
| [`use-cases/02-diagnostico.md`](application/use-cases/02-diagnostico.md) | Diagnóstico |
| [`use-cases/03-presupuesto-y-autorizacion.md`](application/use-cases/03-presupuesto-y-autorizacion.md) | Presupuesto y autorización |
| [`use-cases/04-ordenes-de-trabajo.md`](application/use-cases/04-ordenes-de-trabajo.md) | Órdenes de trabajo |
| [`use-cases/05-reparacion.md`](application/use-cases/05-reparacion.md) | Reparación |
| [`use-cases/06-evidencias.md`](application/use-cases/06-evidencias.md) | Evidencias (fotos y videos) |
| [`use-cases/07-entrega-y-cobro.md`](application/use-cases/07-entrega-y-cobro.md) | Entrega y cobro |
| [`use-cases/08-garantias-y-recomendaciones.md`](application/use-cases/08-garantias-y-recomendaciones.md) | Garantías y recomendaciones |
| [`use-cases/09-seguimiento-y-mantencion.md`](application/use-cases/09-seguimiento-y-mantencion.md) | Seguimiento y mantención |
| [`use-cases/10-historia-tecnica.md`](application/use-cases/10-historia-tecnica.md) | Historia técnica |
| [`use-cases/11-administracion.md`](application/use-cases/11-administracion.md) | Administración |
| [`use-cases/12-reportes.md`](application/use-cases/12-reportes.md) | Reportes *(borrador)* |
| [`use-cases/13-portal-cliente.md`](application/use-cases/13-portal-cliente.md) | Portal del cliente *(borrador)* |
| [`use-cases/14-app-mecanico.md`](application/use-cases/14-app-mecanico.md) | App mecánico *(borrador)* |
| [`use-cases/15-inteligencia-artificial.md`](application/use-cases/15-inteligencia-artificial.md) | Inteligencia artificial *(borrador)* |

---

### 6. Modelo de Negocio

**Carpeta:** [`business/`](business/)

Documentación del modelo operativo del taller y del modelo de eventos del sistema.

| Documento | Descripción |
|---|---|
| [`EVENT_MODEL.md`](business/EVENT_MODEL.md) | Modelo event-centric: jerarquía Vehículo → Historia Técnica → Evento → OT |
| [`WORKSHOP_OPERATING_MODEL.md`](business/WORKSHOP_OPERATING_MODEL.md) | Modelo operativo del taller mecánico |

---

### 7. Decisiones Arquitectónicas (ADR)

**Carpeta:** [`decisions/`](decisions/)

Architecture Decision Records: registro permanente de las decisiones importantes tomadas durante el desarrollo. Cada ADR documenta el contexto, la decisión tomada y las alternativas descartadas.

| Documento | Descripción |
|---|---|
| [`ADR-0001-functional-master.md`](decisions/ADR-0001-functional-master.md) | ERP_MASTER como fuente oficial de especificación funcional |
| [`DEVELOPMENT_RULES.md`](decisions/DEVELOPMENT_RULES.md) | Reglas de desarrollo del proyecto |

---

### 8. Infraestructura

**Carpeta:** [`infrastructure/`](infrastructure/)

Guías de configuración y operación de la infraestructura del proyecto.

| Documento | Descripción |
|---|---|
| [`STAGING_SETUP_GUIDE.md`](infrastructure/STAGING_SETUP_GUIDE.md) | Guía de configuración del entorno de staging |

---

### 9. Producto

**Carpeta:** [`product-bible/`](product-bible/)

La biblia del producto: filosofía, visión, principios de diseño y ciclo de vida del vehículo desde la perspectiva de producto.

| Documento | Descripción |
|---|---|
| [`README.md`](product-bible/README.md) | Índice de la product bible |
| [`00-PREAMBULO.md`](product-bible/00-PREAMBULO.md) | Preámbulo y contexto del producto |
| [`01-FILOSOFIA.md`](product-bible/01-FILOSOFIA.md) | Filosofía del ERP |
| [`02-VISION.md`](product-bible/02-VISION.md) | Visión del producto |
| [`03-PRINCIPIOS-DE-DISENO.md`](product-bible/03-PRINCIPIOS-DE-DISENO.md) | Principios de diseño |
| [`04-CICLO-DE-VIDA-DEL-VEHICULO.md`](product-bible/04-CICLO-DE-VIDA-DEL-VEHICULO.md) | Ciclo de vida del vehículo (desde producto) |

---

### 10. Módulos del ERP

**Carpeta:** [`modules/`](modules/)

Documentación específica de cada módulo implementado. Se irá poblando a medida que los módulos se desarrollen.

---

### 11. Referencia externa — API TallerGP

| Documento | Descripción |
|---|---|
| [`TALLERGP_API_NOTES.md`](TALLERGP_API_NOTES.md) | Notas sobre la API de TallerGP usada durante la migración de datos |

---

## Estado de la documentación

| Carpeta | Estado | Notas |
|---|---|---|
| `erp-master/` | ✅ Completo y oficial | Fuente de verdad funcional |
| `architecture/` | ✅ Completo | 13 documentos de arquitectura |
| `database/` | ✅ Completo | Migraciones 001–005 documentadas |
| `domain-model/` | ✅ Completo | Modelo de dominio vigente |
| `business/` | ✅ Completo | Modelo de eventos y operativo |
| `product-bible/` | ⚠️ Parcial | Solo 5 de los capítulos previstos |
| `application/` | ⚠️ Parcial | Casos de uso 12–15 en borrador |
| `decisions/` | ⚠️ En construcción | ADR-0001 inicial |
| `modules/` | 🕐 Pendiente | Se puebla con el desarrollo |
| `infrastructure/` | ⚠️ Parcial | Solo guía de staging |
| `api-discovery/` | 🕐 Vacío | Exploración API TallerGP (histórico) |

---

## Documentos obsoletos / vacíos

Los siguientes archivos están en la raíz de `docs/` y están vacíos. Se mantienen para no romper referencias históricas:

- `ROADMAP.md` — **vacío** · supersedido por [`erp-master/ROADMAP.md`](erp-master/ROADMAP.md)
- `MIGRATION_STRATEGY.md` — **vacío** · ver [`database/`](database/) para el detalle de migraciones
- `PROJECT_CONSTITUTION.md` — **vacío** · ver [`decisions/DEVELOPMENT_RULES.md`](decisions/DEVELOPMENT_RULES.md)

---

## Convenciones de este repositorio de documentación

- Los documentos no se borran; se marcan como obsoletos y se indica el sucesor.
- Toda decisión técnica importante se registra en un nuevo ADR en `decisions/`.
- Las versiones del documento funcional se numeran `ERP_MASTER_v1.0.md`, `ERP_MASTER_v1.1.md`, etc.
- Cada cambio al ERP_MASTER se registra en `erp-master/CHANGELOG.md`.
- Los documentos en borrador se marcan con *(borrador)* en el índice.
