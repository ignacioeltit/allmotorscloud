# Database Model — All Motors Cloud

**Estado:** Cerrado (DDR-001 aprobado + Final Consolidation Architecture Board — Junio 2026)  
**Versión:** 1.2  
**Última actualización:** Junio 2026  
**Propósito:** Definir la arquitectura lógica de la base de datos en lenguaje de negocio, como guía para la creación del esquema físico

---

## 1. Propósito

Este documento define la arquitectura lógica de la base de datos de All Motors Cloud. Describe qué tablas existen, para qué sirven, cómo se relacionan y qué patrones transversales gobiernan el modelo. No contiene SQL, Prisma ni definiciones de columnas.

Es la referencia que todo desarrollador debe leer antes de crear o modificar una tabla.

---

## 2. Alcance

Cubre el modelo completo del sistema, incluyendo:

- La capa núcleo: vehículos, historia técnica y eventos
- La capa operativa: órdenes de trabajo, diagnósticos, presupuestos, reparaciones
- La capa de evidencia: archivos, fotos, firmas
- La capa comercial: facturas, pagos, garantías
- La capa de inventario: repuestos, stock, proveedores
- La capa organizacional: organizaciones, sucursales, usuarios, roles
- La capa de migración: trazabilidad hacia TallerGP

No cubre el esquema físico (tipos de columna, índices exactos) ni la lógica de aplicación.

---

## 3. Relación con el Domain Model

Toda tabla de este modelo tiene correspondencia directa con una entidad o relación definida en `DOMAIN_MODEL.md`. Las reglas de negocio de ese documento se implementan aquí mediante:

- Restricciones de integridad referencial
- Políticas RLS (Row Level Security) por rol
- Constraints de unicidad y no nulidad
- Tablas de transición de estados (inmutables)
- Separación de visibilidad financiera por rol
- Vistas con `security_barrier` para restricciones a nivel de columna

Si existe conflicto entre este documento y el Domain Model, el Domain Model tiene precedencia.

---

## 4. Grupos de tablas

### 4.1 Núcleo — Vehículos e Historia Técnica

Estas tablas son el eje del sistema. Todo lo demás hace referencia a ellas, nunca al revés.

| Tabla | Propósito |
|---|---|
| `vehiculos` | Registro maestro de cada vehículo. La patente es el identificador único dentro de la organización. Incluye marca, modelo, año, color, tipo (auto, camioneta, moto, furgón) y VIN cuando disponible. |
| `historias_tecnicas` | Creada automáticamente al registrar un vehículo. Relación 1:1 con `vehiculos`. Nunca se elimina. Es el contenedor de todos los eventos del vehículo. Existe como tabla separada para garantizar que el historial técnico sobrevive si el vehículo es soft-deleted. |
| `propietarios_vehiculo` | Tabla temporal de la relación entre un cliente y un vehículo en el tiempo. Permite registrar cambios de propietario sin alterar el historial técnico. Tiene fecha de inicio y opcionalmente fecha de fin. |

**Invariantes:**
- Un vehículo tiene exactamente una historia técnica.
- La historia técnica no puede transferirse ni eliminarse.
- La patente es única por `org_id`.
- Existe máximo un propietario activo por vehículo en un momento dado (`fecha_fin IS NULL` es único por `vehiculo_id`).

---

### 4.2 Núcleo — Eventos (Registros Técnicos)

El evento es la unidad mínima de información del sistema. Toda actividad genera eventos.

| Tabla | Propósito |
|---|---|
| `eventos` | Tabla central de todos los registros técnicos. Tiene tipo de evento, estado actual, responsable, referencia a la historia técnica del vehículo, y opcionalmente referencia a la orden de trabajo. Inmutable una vez cerrado. |
| `tipos_evento` | Catálogo de tipos de evento (Diagnóstico, Reparación, Garantía, Consulta, etc.). Catálogo por tenant: cada organización tiene su propia copia, sembrada desde el catálogo base global cuando la organización es activada. Permite personalización por taller. |
| `transiciones_evento` | Log inmutable de cada cambio de estado de un evento. Registra estado anterior, estado nuevo, actor, tipo de actor (`actor_tipo`: `humano` o `sistema`), timestamp y razón. La razón es obligatoria cuando el estado destino es `cancelado`. Esta tabla nunca se actualiza: solo se inserta. |
| `referencias_evento` | Relación entre eventos: un evento puede referenciar a otro como origen, contexto o corrección. Permite construir el grafo de dependencias de la Historia Técnica. El grafo es un DAG (grafo acíclico dirigido): un trigger de base de datos rechaza cualquier inserción que crearía un ciclo. Tiene columna `eliminado_en` (soft-delete estándar): anular un arco del DAG es una operación válida que debe quedar en historial. |

**Columnas clave de `eventos` (conceptuales):**
- Identificador propio, `historia_tecnica_id`, `tipo_evento_id`
- Estado actual: `creado | pendiente | asignado | en_ejecucion | en_espera | finalizado | cerrado | cancelado`
- Responsable: `usuario_id` o indicador de actor sistema
- `orden_trabajo_id` (opcional: solo cuando el evento forma parte de una OT)
- `cerrado_en`: timestamp de cierre (nulo mientras abierto)
- `visible_cliente`: booleano (default `false`). Indica si el evento es visible en el Portal del Cliente. Controlado por el taller por registro.
- `org_id`, `sucursal_id`, `eliminado_en` (soft-delete)

**Regla crítica:** una vez que `cerrado_en` tiene valor, ningún campo técnico del registro puede modificarse. **Excepción explícita:** `visible_cliente` es un flag de presentación (no dato técnico) y puede modificarse en cualquier estado, incluyendo eventos cerrados. El taller debe poder controlar la visibilidad al cliente independientemente del ciclo de vida del evento. Cualquier corrección al contenido se materializa como un nuevo evento de tipo Corrección que referencia al evento original.

---

### 4.3 Operativas — Órdenes de Trabajo, Diagnósticos, Presupuestos

Las tablas satélite de esta sección referencian `evento_id`, no directamente `orden_trabajo_id`. La OT es el documento que agrupa eventos; los detalles técnicos pertenecen al evento específico.

| Tabla | Propósito |
|---|---|
| `ordenes_trabajo` | Documento legal y financiero que agrupa eventos de una visita con consecuencia económica. Su estado sigue el flujo definido en el Domain Model. Solo puede haber una OT activa por vehículo a la vez. |
| `diagnosticos` | Registro del trabajo técnico de evaluación. Detalla hallazgos, causa raíz, hallazgos adicionales y tiempo estimado de reparación. Pertenece a un evento de tipo Diagnóstico. |
| `presupuestos` | Propuesta económica formal. Tiene versión: cada modificación crea un nuevo registro vinculado al anterior mediante `presupuesto_anterior_id`. El campo `presupuesto_anterior_id` tiene constraint UNIQUE (un presupuesto solo puede ser reemplazado una vez). Solo una versión activa por OT a la vez. |
| `items_presupuesto` | Líneas del presupuesto: repuestos, mano de obra, insumos. Cada línea tiene tipo, descripción, cantidad, precio unitario, descuento aplicado y porcentaje de descuento. Cambios de descuento mayores al umbral configurado requieren `autorizador_id` (usuario que autorizó). |
| `autorizaciones` | Decisión del cliente sobre un presupuesto. Registra canal de autorización, quién la recibió, cuándo y qué ítems fueron aprobados o rechazados. Inmutable una vez registrada. |
| `reparaciones` | Registro de trabajo técnico ejecutado. Incluye descripción del trabajo realizado por ítem, partes efectivamente usadas (puede diferir del presupuesto) y hallazgos detectados durante la ejecución. MVP: un `mecanico_id` único por reparación. V1 en adelante: tabla `asignaciones_mecanico` para múltiples mecánicos. |
| `items_reparacion` | Líneas de trabajo realizado dentro de una reparación. Referencia a ítem del presupuesto autorizado. Incluye `inicio_en` y `fin_en` para registrar el tiempo real de ejecución de cada ítem. |
| `controles_calidad` | Verificación del trabajo antes de notificar al cliente. Registra quién aprobó, cuándo, y observaciones. La aprobación habilita la notificación automática. |
| `entregas` | Registro formal de devolución del vehículo. Captura kilometraje de salida, forma de pago y referencia al pago y factura. Incluye `conductor_retiro_id` para registrar quién retira físicamente el vehículo (puede ser diferente al propietario o cliente). |
| `recomendaciones_pendientes` | Trabajos identificados pero no autorizados por el cliente. Persisten indefinidamente en la Historia Técnica y se muestran en cada visita futura del vehículo. No son vistas calculadas: son registros persistidos. |

**Nota — tabla `citas`:** La gestión de agenda del taller (citas previas, primer contacto del cliente) es una entidad faltante en este modelo. Ver PA9 en §12.

---

### 4.4 Evidencias — Archivos y Firmas

La evidencia vive en Supabase Storage. La base de datos guarda únicamente la referencia y los metadatos.

| Tabla | Propósito |
|---|---|
| `evidencias` | Metadatos de cada archivo asociado a un evento. Contiene tipo (foto, video, pdf, scanner, firma, mensaje, archivo), URL de almacenamiento, nombre original, peso en bytes, y quién lo adjuntó. El campo `evento_id` es NOT NULL: no existe evidencia sin Registro Técnico. |
| `firmas` | Evidencia especializada para firmas del cliente. Incluye tipo de firma (digital nativa o foto de firma física), el evento al que pertenece, y referencia a la evidencia genérica. |

**Principio:** la URL del archivo apunta a Supabase Storage. Si el archivo se mueve, solo se actualiza la URL en `evidencias`, no en ninguna otra tabla.

**Evidencia de migración:** los PDFs importados desde el CDN de TallerGP (`d31bmy06rjbdnm.cloudfront.net`) se descargan y almacenan en Supabase Storage antes de dar de baja TallerGP. Su registro en `evidencias` preserva la URL original de TallerGP como metadato de trazabilidad.

---

### 4.5 Comerciales — Facturas, Pagos y Garantías

Estas tablas son visibles solo para roles con acceso financiero (Administrador, Recepcionista). El Mecánico no tiene política RLS que le permita leerlas.

| Tabla | Propósito |
|---|---|
| `facturas` | Documento fiscal emitido al cierre de la entrega. Referencia obligatoria a una OT. Un cliente puede tener múltiples facturas históricas. |
| `pagos` | Registro de cada cobro efectuado. Un pago referencia a una factura. Un cliente puede pagar en múltiples transacciones. Registra monto, fecha, medio de pago y actor que lo recibió. |
| `garantias` | Cobertura sobre trabajo realizado. Referencia obligatoria a la reparación original. Tiene alcance textual, `fecha_vencimiento` y `km_vencimiento` (opcional, para garantías con límite de kilometraje). Estado: `vigente | reclamada | vencida | rechazada`. |
| `reclamaciones_garantia` | Cada vez que un cliente ejerce una garantía se genera un registro. Referencia la garantía original y puede dar origen a una nueva OT de garantía. |

---

### 4.6 Inventario — Repuestos, Stock y Proveedores

| Tabla | Propósito |
|---|---|
| `repuestos` | Catálogo maestro de partes e insumos por tenant. Tiene código, nombre, fabricante, categoría y `org_id` obligatorio. Un mismo repuesto puede estar en stock en múltiples sucursales. |
| `inventario` | Stock disponible por repuesto y sucursal. Registra cantidad actual y nivel mínimo que dispara alerta. Relación `repuesto_id + sucursal_id` es única. |
| `movimientos_stock` | Log inmutable de cada cambio en inventario. Registra tipo (ingreso por compra, egreso por reparación, ajuste manual, devolución), cantidad, actor y referencia a la reparación que lo originó (cuando aplica). Solo se inserta, nunca se actualiza. |
| `proveedores` | Empresas o personas que suministran repuestos. Per-tenant (`org_id` obligatorio). Tiene nombre, RUT, contacto, condiciones de pago habituales y tiempo de entrega referencial. |
| `compras` | Órdenes de compra emitidas a proveedores. Puede originarse de una reparación específica o de una alerta de stock. Tiene estado (pendiente, enviada, recibida, cancelada). |
| `items_compra` | Líneas de una orden de compra: repuesto, cantidad solicitada, precio acordado. |

---

### 4.7 Organización — Tenants, Usuarios y Roles

| Tabla | Propósito |
|---|---|
| `organizaciones` | La empresa o taller que opera All Motors Cloud. Es el tenant raíz. Cada fila corresponde a un taller independiente. Tiene nombre, RUT, logo y configuración global. |
| `sucursales` | Ubicaciones físicas del taller. Una organización puede tener varias sucursales. Cada sucursal tiene su propio inventario. |
| `usuarios` | Personas con acceso al sistema. Tiene nombre, email, `org_id`, `sucursal_id` principal y `rol_id`. Un usuario pertenece a una organización. |
| `roles` | Catálogo base global de roles del sistema: Administrador, Jefe de Taller, Mecánico, Recepcionista. No tiene `org_id`. La personalización de permisos por tenant vive en `permisos_rol`. |
| `permisos_rol` | Asociación entre roles y capacidades específicas, por tenant. `org_id` obligatorio. Ejemplos de capacidades: `cerrar_ot`, `ver_reportes_financieros`, `aprobar_descuento`, `editar_presupuesto`. |
| `clientes` | Personas o empresas con relación comercial con el taller. Tiene nombre, RUT, teléfono, email, tipo (`persona_natural | empresa | aseguradora`). Pertenece a una organización. |
| `conductores` | Personas que traen físicamente el vehículo. Pueden repetirse. Se asocian a una visita (evento de recepción) específica, no al vehículo ni al cliente permanentemente. `org_id` obligatorio. |

---

### 4.8 Migración — Trazabilidad TallerGP

Estas tablas son temporales. Existen exclusivamente para garantizar trazabilidad durante y después de la migración de datos desde TallerGP. Todas las tablas de migración tienen `org_id` obligatorio para mantener aislamiento multi-tenant durante el proceso.

| Tabla | Propósito |
|---|---|
| `migracion_clientes` | Mapea el ID opaco de cliente en TallerGP (`7ps...`) al `cliente_id` de All Motors Cloud. |
| `migracion_vehiculos` | Mapea el ID opaco de vehículo en TallerGP (`9g3...`) al `vehiculo_id` de All Motors Cloud. |
| `migracion_ordenes` | Mapea el ID opaco de OT en TallerGP (`xd0...`) al `orden_trabajo_id` de All Motors Cloud. |
| `migracion_facturas` | Mapea el ID opaco de factura en TallerGP (`8fu...`) al `factura_id` de All Motors Cloud. |
| `migracion_archivos` | Preserva la URL original del CDN de TallerGP (`d31bmy06rjbdnm.cloudfront.net/...`) junto al `evidencia_id` resultante en All Motors Cloud y el estado de descarga del archivo. |

**Política de ciclo de vida:** estas tablas se archivan (no eliminan) una vez que la migración esté completamente validada y TallerGP sea dado de baja. El archivado consiste en mover las filas a tablas con sufijo `_archivo` o marcarlas con un flag `archivado = true`.

---

## 5. Convenciones de nomenclatura

| Elemento | Convención | Ejemplo |
|---|---|---|
| Tablas | Sustantivo plural en español, snake_case | `ordenes_trabajo`, `items_presupuesto` |
| Claves primarias | `id` (UUID v4 por defecto) | `id uuid` |
| Claves foráneas | `{tabla_singular}_id` | `vehiculo_id`, `usuario_id` |
| Campos de fecha/hora | Sufijo `_en` para timestamps, `_fecha` para fechas sin hora | `creado_en`, `apertura_fecha` |
| Soft-delete | `eliminado_en` (timestamp, nulo si activo) | — |
| Multi-tenancy | `org_id` en todas las tablas per-tenant | — |
| Estados | Columna `estado` con valores en snake_case | `en_ejecucion`, `cerrado` |
| Flags booleanos | Prefijo `es_` o `tiene_` | `es_activo`, `tiene_iva` |
| Campos de migración | Prefijo `tgp_` dentro de tablas de migración | `tgp_cliente_id`, `tgp_url_pdf` |

**Nota sobre `org_id` vs `empresa_id`:** este documento usa `org_id` como convención estándar. Algunos documentos del proyecto (en particular `SECURITY_MODEL.md`) usan `empresa_id` para referirse al mismo concepto. Ambos nombres refieren al identificador del tenant. La implementación física usará `org_id`.

---

## 6. Estrategia de multi-tenancy

Las tablas per-tenant incluyen `org_id` como columna obligatoria no nula. Este campo es la clave de aislamiento entre talleres. Las excepciones documentadas son catálogos base globales que se comparten entre todos los tenants (`roles`, catálogo semilla de `tipos_evento`).

**Implementación:**
- RLS (Row Level Security) de Supabase filtra por `org_id` en cada operación SELECT, INSERT, UPDATE y DELETE sobre tablas per-tenant.
- La función `mi_org_id()` (SECURITY DEFINER, con `SET search_path = public` para prevenir hijacking de search_path) devuelve el `org_id` del usuario autenticado leyendo la tabla `usuarios`. Esta función es la única fuente de verdad para RLS.
- Ninguna consulta desde la aplicación necesita incluir `WHERE org_id = ?` explícitamente: RLS lo aplica transparentemente.
- El campo `org_id` no es editable desde la aplicación. Se asigna en el momento de creación y nunca cambia.

**Catálogos globales:** las tablas que son catálogos base compartidos (`roles`, catálogo semilla de `tipos_evento`) no tienen `org_id` y no están bajo RLS de tenant. Al activar una organización, se copian los registros base necesarios hacia las tablas per-tenant correspondientes.

**Multi-sucursal:** además de `org_id`, las tablas con alcance de sucursal incluyen `sucursal_id`. El inventario es el caso más claro: un mismo repuesto puede tener stock diferente en cada sucursal de la misma organización.

---

## 7. Patrones transversales

### Soft-delete

Ningún registro se elimina físicamente. Todo registro per-tenant tiene una columna `eliminado_en` (timestamp).

- Valor nulo: registro activo.
- Valor no nulo: registro eliminado lógicamente. La aplicación no lo muestra. RLS puede filtrarlo automáticamente.
- Los registros eliminados son auditables. Se conservan indefinidamente.
- **Excepción explícita:** las tablas `transiciones_evento` y `movimientos_stock` son append-only y **no tienen columna `eliminado_en`**. Un registro incorrecto en estas tablas se anula insertando una nueva fila de tipo `anulacion` que referencia a la fila original.

### Audit trail

Toda tabla incluye `creado_en`, `creado_por` (usuario_id) y `actualizado_en`. Las tablas de alta criticidad (eventos, autorizaciones, pagos, transiciones) tienen también `actualizado_por`.

Para cambios significativos (estado de OT, aprobación de presupuesto, cierre de evento), la trazabilidad completa vive en la tabla `transiciones_evento` o en tablas equivalentes de log inmutable.

### Inmutabilidad de Eventos

Un evento con `cerrado_en` no nulo es inmutable. La estrategia de implementación:

1. La columna `cerrado_en` se asigna una sola vez. Nunca se actualiza.
2. Un trigger **y** una política RLS rechazan cualquier UPDATE sobre eventos donde `cerrado_en IS NOT NULL` (ambas capas de protección son necesarias: el trigger actúa en DB, la política actúa en la sesión del cliente).
3. Los errores en eventos cerrados se corrigen creando un nuevo evento de tipo `correccion` que referencia al evento original mediante `referencias_evento`.
4. El evento original permanece exactamente como fue cerrado.

### Inmutabilidad de transiciones y movimientos de stock

Las tablas `transiciones_evento` y `movimientos_stock` son de solo inserción (append-only). No tienen columna `eliminado_en`. Un registro incorrecto se anula con una nueva fila de tipo `anulacion` que referencia a la fila original.

### Sincronización de estados OT-Evento

La OT y los eventos tienen máquinas de estado independientes (9 estados en OT, 8 en Evento). La sincronización entre ambas sigue estas reglas:

- El avance del estado de la OT puede disparar transiciones en sus eventos asociados (ejemplo: cerrar la OT cierra los eventos en estado `finalizado`).
- El avance de un evento puede actualizar el estado de la OT (ejemplo: todos los eventos `cerrado` → OT pasa a `lista_entrega`).
- El mecanismo de implementación es un trigger de base de datos sobre `transiciones_evento` que evalúa el estado agregado de los eventos de la OT y actualiza `ordenes_trabajo.estado` si corresponde.
- Este mecanismo debe diseñarse e implementarse antes del primer sprint que involucre `ordenes_trabajo`.

### Acyclicidad de referencias_evento

El grafo `referencias_evento` es un DAG (Directed Acyclic Graph). Un trigger `BEFORE INSERT` sobre esta tabla verifica que el nuevo arco no crearía un ciclo mediante una consulta recursiva. Si detecta un ciclo, rechaza la inserción con un error descriptivo. Sin este trigger, una referencia circular hace que las consultas recursivas de la Historia Técnica entren en bucle infinito.

---

## 8. Estrategia de índices

Los índices se definen por patrón de uso, no por convención genérica.

| Patrón de uso | Índice recomendado |
|---|---|
| Búsqueda de vehículo por patente | Índice único sobre `(org_id, patente)` en `vehiculos` |
| Consulta de Historia Técnica | Índice sobre `(historia_tecnica_id, creado_en DESC)` en `eventos` |
| Filtro de eventos por tipo y estado | Índice compuesto sobre `(historia_tecnica_id, tipo_evento_id, estado)` |
| Órdenes de trabajo activas por vehículo | Índice parcial sobre `(vehiculo_id)` WHERE `estado NOT IN ('cerrada', 'cancelada')` |
| Dashboard de OTs por organización | Índice compuesto sobre `(org_id, estado)` en `ordenes_trabajo` |
| Recomendaciones pendientes por vehículo | Índice sobre `(vehiculo_id, eliminado_en)` en `recomendaciones_pendientes` |
| Inventario bajo mínimo | Índice parcial sobre `sucursal_id` WHERE `cantidad_actual <= nivel_minimo` |
| Garantías próximas a vencer | Índice sobre `(org_id, fecha_vencimiento)` en `garantias` WHERE `estado = 'vigente'` |
| Búsqueda de cliente por RUT | Índice único sobre `(org_id, rut)` en `clientes` |
| Log de transiciones por evento | Índice sobre `(evento_id, creado_en)` en `transiciones_evento` |
| Supabase Realtime | Índices sobre columnas filtradas en canales activos (`org_id`, `sucursal_id`) |

**Particionamiento:** `transiciones_evento` debe particionarse por rango de `creado_en` (mensual o anual) desde la primera migración. A 10K talleres con 200 OTs/mes, esta tabla acumula ~1.8B filas/año. El particionamiento no es opcional: debe definirse antes de crear la tabla físicamente.

Los índices de texto libre (búsqueda por nombre de cliente, descripción de trabajo) usarán índices de tipo GIN con `pg_trgm` o búsqueda full-text de PostgreSQL, evaluados en fase de implementación.

---

## 9. Decisiones principales

| Decisión | Justificación |
|---|---|
| El evento es la unidad central, no la OT | Permite registrar consultas, cotizaciones, alertas y garantías rechazadas sin OT, alineado con EVENT_MODEL.md |
| UUID v4 como clave primaria universal | Permite generación del lado cliente, compatible con modo offline, sin colisiones en multi-tenant |
| Soft-delete universal | Los registros nunca se pierden. Cumple la regla del Domain Model de no eliminar historial aunque el cliente lo solicite |
| Tabla `transiciones_evento` append-only | Es la fuente de verdad para auditoria. Reconstruir el estado de un evento en cualquier momento pasado es posible leyendo sus transiciones |
| `recomendaciones_pendientes` como tabla propia | No son vistas calculadas. Son entidades persistidas para sobrevivir cambios de estado del evento original |
| Evidencia fuera del modelo relacional | Los archivos binarios viven en Supabase Storage. La DB guarda solo URL y metadatos. Evita blobs en PostgreSQL |
| Migración como tablas separadas (no columnas inline) | Mantiene el modelo limpio. Las tablas de migración se archivan sin tocar el modelo principal |
| Dirección OT↔Evento: Alternativa B | `eventos.orden_trabajo_id` (FK desde evento hacia OT). Implementación directa y sin tabla intermedia. Nota: EVENT_MODEL §5 define la dirección inversa (OT→eventos mediante tabla intermedia). Esta decisión anula esa sección del EVENT_MODEL para el esquema físico. Aceptado formalmente en DDR-001. |
| Separación financiera del Mecánico via vistas | El Mecánico no accede a datos financieros ni PII de clientes mediante vistas con `security_barrier`, no mediante RLS puro. RLS es row-level; la restricción de columnas requiere vistas. Ver §13. |
| Múltiples mecánicos: MVP usa `mecanico_id` único | En el MVP, `reparaciones.mecanico_id` es un único responsable. La tabla `asignaciones_mecanico` para múltiples mecánicos se diseña en V1, no MVP, para no bloquear el primer sprint. |

---

## 10. Reglas

Estas reglas se implementan en la base de datos, no solo en la aplicación.

1. Toda tabla per-tenant tiene `org_id` no nulo. Excepción documentada: catálogos base globales como `roles` y el catálogo semilla de `tipos_evento` no tienen `org_id`.
2. Ningún registro per-tenant se elimina físicamente. Toda tabla per-tenant tiene `eliminado_en`. Excepción documentada: `transiciones_evento` y `movimientos_stock` son append-only y no tienen `eliminado_en`.
3. Un evento con `cerrado_en` no nulo no puede modificarse en sus campos técnicos. Excepción: `visible_cliente` puede actualizarse en cualquier estado (es un flag de presentación, no dato del Registro Técnico).
4. Las tablas `transiciones_evento` y `movimientos_stock` son de solo inserción.
5. Una OT activa bloquea la apertura de una segunda OT para el mismo vehículo. Se consideran "activos" todos los estados excepto `cerrada` y `cancelada` (es decir: `pendiente_diagnostico`, `diagnosticada`, `presupuesto_pendiente`, `presupuesto_enviado`, `autorizada`, `en_reparacion`, `control_calidad`, `lista_para_entrega`, `entregada`).
6. Una reparación no puede existir sin un evento de autorización cerrado y aprobado que la preceda.
7. Una garantía no puede existir sin referencia a la reparación original.
8. Una factura no puede existir sin referencia a una OT.
9. El `org_id` de un registro es inmutable después de su creación.
10. El Mecánico no accede a `facturas`, `pagos`, precios en `items_presupuesto`, ni datos de RUT o email de clientes. Esta restricción se implementa via vistas con `security_barrier` (`v_clientes_mecanico`, `v_items_presupuesto_mecanico`), no mediante RLS puro (que es row-level, no column-level).
11. El grafo `referencias_evento` es acíclico. Un trigger `BEFORE INSERT` rechaza cualquier inserción que crearía un ciclo. Implementación mínima: CTE recursiva (`WITH RECURSIVE`) que sigue la cadena de `referenciado_id` desde el nuevo arco propuesto; si alcanza el `evento_id` de origen, es un ciclo — se lanza un error con el path del ciclo como contexto. La CTE debe tener límite de profundidad (ej. 50 niveles) para acotar el costo en grafos grandes.

---

## 11. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Crecimiento ilimitado de `transiciones_evento` (Escenario B: 10K talleres × 200 OTs/mes → 1.8B filas/año) | Alto en volumen y en latencia de queries sin particionamiento | Particionamiento por rango de `creado_en` **desde la primera migración** — no es opcional |
| Latencia en consulta de Historia Técnica completa | Alto si vehículo tiene miles de eventos (SRDV88 tiene 5.449) | Índice compuesto `(historia_tecnica_id, creado_en DESC)` + paginación. Cargar eventos recientes primero |
| Evidencias con URL rota si Supabase Storage falla | Pérdida de evidencia | Backup periódico del bucket + preservar URL original de TallerGP en migración |
| Conflicto de OT al modo offline | Dos usuarios crean OT simultáneas para el mismo vehículo | Constraint de unicidad sobre `(vehiculo_id, estado activo)` + manejo de conflicto en sync |
| Patente duplicada en migración TallerGP | Historial mezclado de vehículos distintos | Validación previa de duplicados antes de migrar. Registro de advertencia en lugar de sobreescritura |
| PII en logs inmutables — `transiciones_evento` y futuros audit logs (Ley 19.628 / GDPR) | Irrecuperable si `transiciones_evento` o cualquier tabla append-only almacena valores de nombre, RUT o email directamente en campos de estado. No se puede anonimizar sin romper la inmutabilidad. | `transiciones_evento` debe almacenar solo IDs (nunca valores PII) en todos sus campos. Si se implementa una tabla `audit_log` adicional en el futuro, aplica la misma restricción. Definir y verificar esta política antes del primer sprint que inserte datos de cliente. |
| Escala de Supabase Realtime | Los canales filtrados por `org_id` generan una conexión por tenant activo. A 1K talleres simultáneos, esto puede exceder los límites del plan | Evaluar plan de Supabase Pro o Enterprise antes del lanzamiento. Monitorear conexiones activas en staging. |
| Offboarding de tenant | Borrar datos de un taller implica eliminar filas en decenas de tablas con `org_id`. Sin procedimiento, puede dejar datos huérfanos o violar acuerdos de eliminación | Diseñar procedimiento de offboarding (script o función DB) antes del primer cliente de producción |
| Datos de cliente tras solicitud de anonimización (GDPR/ley chilena) | Legal | `clientes` tiene campos anonimizables. Los eventos del vehículo se conservan, pero los campos de identificación del cliente se reemplazan por valores anónimos. `transiciones_evento` y cualquier log append-only no deben guardar PII para que esta estrategia sea efectiva. |

---

## 12. Preguntas abiertas

Heredadas del Domain Model y del Use Case Model. Las marcadas como **Resueltas (DDR-001)** se cerraron en el Design Decision Review de Junio 2026.

1. **PA1 — Acceso del nuevo propietario al historial anterior:** ¿la tabla `propietarios_vehiculo` controla la visibilidad en el Portal del Cliente por rango de fechas?
2. ~~**PA2 — Garantía por kilómetros**~~ — **Resuelta (DDR-001):** `garantias` tiene `km_vencimiento` opcional. Evaluación de vigencia por km es responsabilidad de la capa de aplicación, que leerá la lectura de odómetro más reciente del vehículo.
3. ~~**PA3 — Múltiples mecánicos por reparación**~~ — **Resuelta (DDR-001):** MVP usa `mecanico_id` único en `reparaciones`. Tabla `asignaciones_mecanico` se diseña en V1.
4. **PA4 — Empresa como cliente:** ¿`clientes` tiene relaciones opcionales a empleados? ¿Cómo se modela el empleado que trae el auto de una empresa? (El tipo `aseguradora` ya se agregó en §4.7.)
5. **PA5 — Patente que cambia:** ¿se registra un historial de patentes en `vehiculos` o se crea un registro de tipo evento Cambio de Patente?
6. **PA6 — Peritaje sin reparación:** ¿genera OT o solo un evento sin OT? Esto afecta si `evidencias` puede existir sin `orden_trabajo_id`.
7. **PA7 — Archivado de tablas de migración:** ¿se mueven a un schema separado (`migration.`) o se marcan con flag en el mismo schema?
8. ~~**PA8 — Visibilidad configurable de la Historia Técnica**~~ — **Resuelta (DDR-001):** campo `visible_cliente BOOLEAN DEFAULT false` en `eventos`. Ver §4.2.
9. **PA9 — Tabla `citas`:** La agenda de citas previas (primer contacto del cliente, antes de la visita) es una entidad ausente en el modelo actual. ¿Es una tabla `citas` con FK a `cliente_id` y `vehiculo_id`? ¿Genera un evento automáticamente al confirmarse? ¿Está en el MVP o en V1? Debe resolverse antes de implementar el módulo de recepción.
10. **PA10 — Tabla `lecturas_odometro`:** Los modelos de analítica y predicción de mantención requieren una serie temporal de kilometraje por vehículo (no solo el km de entrada y salida en `entregas`). Sin esta tabla, es imposible calcular mantenciones basadas en km acumulados ni validar garantías por km en tiempo real. ¿Tabla propia `lecturas_odometro` con `vehiculo_id`, `km`, `registrado_en`, `fuente (recepcion/entrega/manual)`? Resolver antes del módulo de seguimiento y de la capa IA.
11. **PA11 — Sincronización del catálogo de `tipos_evento`:** Los tipos de evento se copian del catálogo global al activar un tenant. El documento no define qué ocurre cuando el catálogo base global recibe un nuevo tipo estándar después de la activación. ¿Los tenants existentes reciben la actualización automáticamente? ¿Manualmente? ¿O solo tenants nuevos la obtienen? Sin definir, los tenants viejos y nuevos divergen silenciosamente.

---

## 13. Impacto futuro en desarrollo

- **Esquema físico:** el siguiente paso es definir las columnas exactas de cada tabla, tipos de dato y constraints. Este documento es su insumo directo.
- **Migraciones:** cada tabla se crea mediante archivos de migración numerados en `supabase/migrations/`. El orden importa por las claves foráneas.
- **RLS policies:** cada tabla necesita al menos una policy por rol. La separación financiera del Mecánico es la más crítica y debe validarse en staging antes de producción.
- **Vistas con `security_barrier` (implementar antes del primer sprint con Mecánico):**
  - `v_clientes_mecanico`: expone `clientes` excluyendo columnas `rut`, `email`, `telefono`. Tiene `security_barrier = true`.
  - `v_items_presupuesto_mecanico`: expone `items_presupuesto` excluyendo columnas `precio_unitario`, `descuento`, `descuento_porcentaje`, `total`. Tiene `security_barrier = true`.
  - El Mecánico recibe permisos SELECT sobre estas vistas y no sobre las tablas base.
- **Sincronización OT-Evento:** el trigger de sincronización de estados entre `ordenes_trabajo` y `eventos` (ver §7) debe diseñarse e implementarse antes del primer sprint que involucre la tabla `ordenes_trabajo`.
- **Tabla `citas`:** revisar PA9 antes de implementar el módulo de recepción de vehículos. La tabla `citas` puede ser el punto de entrada del flujo de trabajo del taller.
- **Supabase Realtime:** los canales de tiempo real escucharán principalmente `eventos` y `ordenes_trabajo` filtrados por `org_id`. El diseño de índices debe considerar los filtros de los canales activos.
- **Event sourcing parcial:** la tabla `transiciones_evento` implementa el patrón de event sourcing para el ciclo de vida de eventos. En el futuro, si se requiere reconstrucción de estado histórico, esta tabla es la fuente.
- **Extensión IA:** los modelos de ML necesitarán acceso de lectura a `eventos`, `tipos_evento`, `reparaciones`, `diagnosticos` y `movimientos_stock`. Diseñar una capa de acceso de solo lectura para ese servicio desde el inicio.
- **Portal del Cliente:** requiere políticas RLS específicas para el tipo de usuario `cliente_portal`, con visibilidad limitada a los eventos de sus vehículos y controlada por `eventos.visible_cliente`.

---

## 14. Cambios pendientes de propagación

Este documento fue cerrado en DDR-001 (Junio 2026). Los siguientes documentos del proyecto contienen secciones que contradicen o no reflejan las decisiones tomadas aquí. Deben actualizarse antes de comenzar el diseño físico.

| Documento | Sección | Cambio requerido |
|---|---|---|
| `EVENT_MODEL.md` | §5 — Relación OT-Evento | El documento define OT→eventos (tabla intermedia `ot_eventos`). Este modelo adopta la Alternativa B: `eventos.orden_trabajo_id`. La sección §5 debe actualizarse para reflejar la dirección FK elegida y documentar el cambio respecto al modelo original. |
| `DOMAIN_MODEL.md` | §3 — Entidades del dominio | Agregar `visible_cliente` como atributo de Registro Técnico. Actualizar descripción de Historia Técnica para indicar que sobrevive soft-delete del vehículo. |
| `DOMAIN_MODEL.md` | §5 — Reglas de negocio | Agregar: máximo un propietario activo por vehículo (`fecha_fin IS NULL` único). Agregar: `referencias_evento` es DAG, prohibición de ciclos. Agregar: razón obligatoria en cancelación de evento. |
| `SECURITY_MODEL.md` | §6 — RLS y acceso por rol | La restricción del Mecánico a datos financieros y PII no se implementa con RLS puro (que es row-level). Se implementa con vistas `security_barrier`. Actualizar la descripción técnica del mecanismo. |
| `SECURITY_MODEL.md` | §9 — Nomenclatura `empresa_id` | El documento usa `empresa_id` para el identificador de tenant. La implementación usa `org_id`. Normalizar el documento para usar `org_id` o documentar explícitamente que ambos nombres son sinónimos. |

---

*Este documento es la referencia arquitectónica para la creación del esquema físico de base de datos.*  
*Toda decisión de columna, índice o constraint debe poder trazarse hasta una regla, patrón o entidad documentada aquí.*  
*Versión cerrada mediante DDR-001. Modificaciones requieren un nuevo proceso DDR.*
