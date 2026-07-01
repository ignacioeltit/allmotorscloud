# ALL MOTORS ERP
## Documento Maestro Funcional
Versión: 1.0
Estado: Oficial
Última actualización: 2026-06-30

---

# ESPECIFICACIÓN FUNCIONAL — ALL MOTORS ERP
## Manual Operativo Maestro · Versión 1.0 · 2026-06-30

---

# PARTE 1
## CICLO DE VIDA · ACTORES · RECEPCIÓN

---

## FASE 1 — MAPA COMPLETO DEL NEGOCIO

### El ciclo de vida de un vehículo en el taller

Un vehículo no tiene una historia única. Tiene docenas de visitas a lo largo de años. Cada visita es un episodio completo dentro de una historia más larga. El ERP debe reflejar esto: no hay un "cliente" ni una "OT" como centro del sistema. El centro es el vehículo y su historia técnica.

---

### ETAPA 0 — ANTES QUE LLEGUE EL VEHÍCULO

#### Pre-contacto
El cliente puede contactar al taller de varias formas antes de llegar físicamente:
- Llama por teléfono y pide hora
- Manda un mensaje por WhatsApp
- Completa un formulario web
- Simplemente llega sin aviso

Para los casos con aviso previo, existe la **Cita**. Una cita es una reserva de tiempo en el taller. No es una OT todavía. No es una recepción todavía. Es solo un bloqueo de tiempo con información mínima: fecha, hora aproximada, patente o nombre del cliente, motivo general ("cambio de aceite", "revisión antes del viaje", "problema con frenos").

Las citas sirven para:
- Distribuir la carga de trabajo del día
- Preparar materiales con anticipación si el trabajo es conocido
- Evitar cuellos de botella en recepción

Una cita **no obliga** a nada. El cliente puede no llegar. La cita puede cancelarse. Si llega sin cita, el taller igual lo puede atender.

Cuando el cliente llega, la cita se convierte en una recepción. Si no llega, la cita queda marcada como no presentado y puede contactarse al cliente.

---

#### ETAPA 1 — INGRESO FÍSICO

El vehículo llega al taller. Entra al recinto. En este momento existe un estado que muchos talleres no gestionan bien: el vehículo está en el taller pero todavía no ha sido formalmente recibido.

Este estado importa porque:
- El taller es responsable del vehículo desde que entra al recinto
- Si algo le pasa al vehículo antes de la recepción formal (un arañazo en el patio, por ejemplo), el taller debe poder demostrar cuándo entró y en qué estado estaba
- El recepcionista puede estar ocupado con otro cliente

**Comportamiento del ERP:** el ingreso puede registrarse de forma mínima (patente, hora de llegada) incluso antes de completar la recepción formal. Esto marca el momento exacto en que el taller tomó custodia del vehículo.

---

#### ETAPA 2 — RECEPCIÓN FORMAL

Esta es la etapa más importante del ciclo. Aquí se captura todo lo que importa. Una recepción bien hecha previene el 80% de los conflictos futuros.

La recepción tiene tres propósitos:
1. **Documentar el estado actual del vehículo** (daños preexistentes, nivel de combustible, kilometraje)
2. **Capturar la solicitud del cliente** (qué quiere que se revise o arregle)
3. **Establecer quién es el responsable económico** (quién pagará y cómo)

Una recepción bien ejecutada genera automáticamente:
- Una Orden de Recepción (documento que el cliente firma o aprueba digitalmente)
- Una Orden de Trabajo en estado borrador
- Un registro en la historia técnica del vehículo
- Una comunicación automática al cliente confirmando el ingreso

Esta etapa se describe en detalle en la FASE 3.

---

#### ETAPA 3 — DIAGNÓSTICO INICIAL

Después de la recepción, el jefe de taller asigna el vehículo a un mecánico para diagnóstico. El diagnóstico puede ser:

**Diagnóstico rápido (5-15 minutos):** para trabajos conocidos donde la recepción ya capturó suficiente información. Ejemplo: el cliente pide cambio de aceite y el mecánico confirma que corresponde. El diagnóstico es simplemente "confirmado, procedemos".

**Diagnóstico profundo (30 minutos a varias horas):** para fallas desconocidas, ruidos, problemas intermitentes. El mecánico hace una inspección completa, puede enchufar el escáner de diagnóstico, prueba de manejo, etc.

El diagnóstico puede revelar:
- Exactamente lo que el cliente pidió → presupuesto directo
- Lo que pidió más trabajo adicional encontrado → presupuesto ampliado con notificación al cliente
- Algo completamente diferente a lo que el cliente creía → nueva conversación con el cliente antes de continuar

**El diagnóstico vive dentro de la OT.** No es una OT separada. Es la primera sección técnica de la misma OT. Si el diagnóstico requiere cobro (inspección con cargo), ese cargo está en la OT.

**El ERP registra:**
- Quién hizo el diagnóstico
- Cuánto tiempo tomó
- Qué encontró (texto libre + códigos OBD si corresponde)
- Qué fotos o videos tomó
- Qué recomienda hacer

---

#### ETAPA 4 — PRESUPUESTO

Con el diagnóstico completo, el sistema puede generar automáticamente un presupuesto preliminar usando el catálogo de servicios. El recepcionista o jefe de taller revisa, ajusta si es necesario, y lo envía al cliente para aprobación.

El presupuesto tiene una vigencia. Si el cliente demora mucho en responder, el presupuesto vence y debe revisarse (los precios de repuestos pueden cambiar).

El cliente puede:
- **Aprobar todo:** se procede con todo el trabajo
- **Aprobar parcialmente:** aprueba algunos ítems, rechaza otros. El mecánico solo hace lo aprobado.
- **Rechazar todo:** el vehículo se prepara para devolución
- **Pedir tiempo:** el vehículo puede quedarse en el taller (con o sin cargo por estadía) mientras el cliente decide

Esta etapa se describe en detalle en la FASE 7.

---

#### ETAPA 5 — COMPRA Y RESERVA DE MATERIALES

Una vez aprobado el presupuesto, el sistema sabe exactamente qué repuestos y materiales se necesitan. Ahora ocurren dos procesos en paralelo:

**Desde inventario propio:** el sistema reserva los repuestos disponibles en bodega. Los "reserva" (no los descuenta todavía) para que no queden disponibles para otra OT mientras esta OT los necesita. El descuento real de stock ocurre cuando el mecánico los usa.

**Para repuestos sin stock:** el sistema genera una solicitud de compra. La solicitud puede ir al proveedor preferido automáticamente o puede requerir cotización. El bodeguero o administrador aprueba la compra. El proveedor entrega. Los repuestos se reciben en bodega y quedan automáticamente asignados a la OT que los pidió.

**Caso especial — repuesto de emergencia:** a veces el mecánico necesita un repuesto que no estaba en el presupuesto original. Sale a comprarlo (o lo pide urgente al proveedor). Este repuesto necesita una aprobación exprés del cliente antes de comprarse, o se registra como cargo adicional con notificación posterior.

---

#### ETAPA 6 — TRABAJO MECÁNICO

El mecánico ejecuta los trabajos aprobados. El ERP debe ser su herramienta de trabajo, no un obstáculo.

El mecánico puede, desde su vista:
- Ver qué trabajos tiene asignados
- Marcar el inicio y fin de cada trabajo
- Registrar observaciones técnicas mientras trabaja
- Agregar fotografías de situaciones encontradas (pieza dañada, componente desgastado)
- Marcar consumo de repuestos desde bodega
- Pedir materiales adicionales a bodega
- Registrar trabajo adicional encontrado y solicitar nueva aprobación al cliente

**Las horas registradas tienen doble propósito:**
- Cálculo de rentabilidad real del trabajo (horas estándar vs horas reales)
- Base para el pago del mecánico si trabaja por comisión de producción

---

#### ETAPA 7 — TRABAJO ADICIONAL

Casi siempre el mecánico encuentra algo que no estaba en el presupuesto original. Esto es normal y el taller lo debe manejar con un proceso claro.

**Proceso ideal:**
1. Mecánico registra hallazgo en la OT con descripción y foto
2. Sistema genera presupuesto adicional automáticamente
3. Sistema notifica al cliente (SMS, WhatsApp, correo, llamada según preferencia)
4. Cliente aprueba o rechaza el trabajo adicional
5. Si aprueba: el mecánico procede. Si rechaza: se anota en la OT que el cliente rechazó la recomendación.

**Este registro protege al taller.** Si seis meses después el cliente tiene un problema relacionado con algo que el taller encontró y el cliente rechazó, el taller puede mostrar que lo informó y que el cliente tomó la decisión.

---

#### ETAPA 8 — CONTROL DE CALIDAD

Antes de llamar al cliente, el jefe de taller (o una persona designada) hace una revisión final:
- Verificar que todos los trabajos aprobados estén completados
- Prueba de manejo si el trabajo lo requiere
- Revisión visual general del vehículo
- Verificar que no haya herramientas olvidadas, que el interior esté limpio
- Confirmar que el nivel de fluidos y la presión de neumáticos estén correctos

Si la revisión encuentra un problema, el vehículo vuelve al mecánico (estado "en revisión").

Si todo está bien, el estado cambia a "listo para entrega" y el sistema notifica automáticamente al cliente.

---

#### ETAPA 9 — NOTIFICACIÓN Y COORDINACIÓN DE ENTREGA

El sistema envía una notificación al cliente: "Tu vehículo [patente] está listo para retiro. Valor a cancelar: $X. Horario de atención: lunes a viernes 8:30-18:30, sábado 9:00-13:00."

El cliente puede:
- Confirmar que pasará ese día
- Pedir más tiempo (el vehículo queda en custodia, puede generar cargo de estacionamiento)
- Enviar a alguien en su nombre (debe registrarse quién retira)

---

#### ETAPA 10 — ENTREGA Y COBRO

El cliente llega a retirar. El recepcionista:
1. Muestra el resumen de trabajos realizados
2. Presenta el documento de entrega
3. Explica los trabajos realizados y los rechazados
4. Cobra el monto pendiente
5. Entrega la factura o boleta
6. Explica las garantías de los trabajos realizados
7. El cliente firma o aprueba digitalmente la recepción conforme

**El cobro puede ser:**
- Contado (efectivo, tarjeta, transferencia)
- Crédito (plazo acordado, empresa que paga mensual)
- Seguro (el seguro paga directamente al taller, el cliente paga solo el deducible)
- Mixto (parte seguro, parte cliente)

Cuando el cobro está confirmado, el sistema genera la factura o boleta electrónica y la envía al cliente por correo electrónico automáticamente.

---

#### ETAPA 11 — GARANTÍA

Todo trabajo tiene una garantía. La garantía nace automáticamente cuando se completa la OT y se registra el cobro.

La garantía tiene:
- Qué servicio cubre (mano de obra del trabajo X)
- Qué repuesto cubre (pieza Y instalada)
- Desde cuándo (fecha de entrega)
- Hasta cuándo (fecha de vencimiento calculada según el tipo de trabajo)
- Condiciones (la garantía no aplica si el cliente modifica el sistema)

Esta etapa se describe en detalle en la FASE 9.

---

#### ETAPA 12 — SEGUIMIENTO POST-ENTREGA

Dos días después de la entrega, el sistema envía automáticamente un mensaje al cliente: "¿Cómo está funcionando tu [marca modelo]? ¿Tienes alguna consulta sobre el trabajo realizado?"

Este seguimiento sirve para:
- Detectar problemas temprano (antes de que el cliente se enoje)
- Generar una reseña positiva si el cliente está satisfecho
- Construir fidelidad

Si el cliente reporta un problema, se abre un proceso de garantía.

---

#### ETAPA 13 — HISTORIAL PERMANENTE

Todo lo anterior queda registrado permanentemente en la historia técnica del vehículo. No se puede borrar. No se puede editar retroactivamente. Solo se puede agregar correcciones documentadas.

La historia técnica incluye:
- Todas las OTs del vehículo (en este taller)
- Todos los diagnósticos
- Todos los trabajos realizados
- Todos los repuestos instalados con fechas y kilometraje
- Todas las garantías
- Todos los rechazos del cliente (trabajo recomendado que no se hizo)
- Cambios de propietario

**Este historial tiene valor comercial.** Un vehículo con historial completo en un taller de confianza vale más al momento de venderlo. El taller puede ofrecer un "certificado de historial" como ventaja competitiva.

---

### EL CICLO COMPLETO — DIAGRAMA NARRATIVO

```
CITA (opcional)
    ↓
INGRESO FÍSICO (custodia del vehículo)
    ↓
RECEPCIÓN FORMAL (documento firmado)
    ↓
DIAGNÓSTICO INICIAL
    ↓ ← Si hay trabajo adicional encontrado: notificar cliente aquí
PRESUPUESTO (versión 1)
    ↓
COMUNICACIÓN AL CLIENTE
    ↓
APROBACIÓN (total / parcial / rechazo)
    ↓
RESERVA DE MATERIALES (stock propio) + COMPRA DE REPUESTOS (si falta stock)
    ↓
ASIGNACIÓN A MECÁNICO
    ↓
TRABAJO MECÁNICO ← puede volver aquí si hay trabajo adicional aprobado
    ↓
CONTROL DE CALIDAD
    ↓ ← si falla, vuelve al mecánico
NOTIFICACIÓN "VEHÍCULO LISTO"
    ↓
ENTREGA + COBRO
    ↓
FACTURA / BOLETA ELECTRÓNICA
    ↓
GARANTÍA ACTIVA
    ↓
SEGUIMIENTO POST-ENTREGA
    ↓
HISTORIAL PERMANENTE
```

---

## FASE 2 — ACTORES

### 1. CLIENTE PARTICULAR

**Quién es:** persona natural que trae su vehículo personal. Es el caso más común. Paga con su propio dinero.

**Qué puede hacer en el ERP (portal cliente, si existe):**
- Ver el estado de su vehículo en tiempo real ("En diagnóstico", "Esperando repuesto", "Listo para retiro")
- Ver el presupuesto y aprobarlo o rechazarlo desde su teléfono
- Ver el historial completo de su vehículo
- Ver sus facturas y boletas
- Pagar en línea (si el taller habilita esta opción)
- Agendar una cita
- Ver las garantías activas
- Reportar un problema de garantía

**Qué no puede hacer:**
- Ver OTs de otros clientes
- Modificar datos técnicos del vehículo
- Cambiar precios de servicios
- Acceder a costos internos del taller

**Qué información necesita:**
- Estado actualizado de su vehículo
- Descripción clara de qué trabajo se hará y cuánto costará
- Tiempo estimado de entrega
- Qué se encontró durante el diagnóstico (en lenguaje simple, no técnico)
- Total a pagar

**Qué información genera:**
- Solicitud de trabajo (motivo de ingreso)
- Aprobación o rechazo de presupuesto
- Historial de visitas al taller
- Información de contacto

---

### 2. EMPRESA (cliente con RUT comercial)

**Quién es:** empresa que trae vehículos de su flota para servicio. Puede ser una empresa local, una constructora, una empresa de delivery, etc.

**Diferencia con el cliente particular:** la empresa necesita factura con su RUT, puede tener condiciones de pago especiales (crédito 30 días), puede tener varios vehículos y varios conductores diferentes, y el que autoriza el trabajo no siempre es el que trae el vehículo.

**Estructura típica:**
- La empresa tiene una persona de contacto designada (el encargado de flota o administración)
- Los conductores traen los vehículos pero no siempre tienen poder de decisión sobre el presupuesto
- El encargado de flota aprueba el presupuesto
- La empresa paga mensual con factura

**Qué puede hacer en el ERP:**
- Ver todos los vehículos de su flota y el estado de cada OT
- Ver el historial de gasto mensual por vehículo
- Aprobar presupuestos (el encargado de flota)
- Descargar facturas consolidadas del mes
- Ver el resumen de mantenimiento pendiente de cada vehículo

**Qué no puede hacer:**
- Cambiar precios acordados en el convenio
- Acceder a información de otros clientes

**Qué información necesita:**
- Estado de todos sus vehículos simultáneamente
- Gasto acumulado del mes por vehículo y total de flota
- Próximas mantenciones programadas de toda la flota
- Documentos para contabilidad (facturas en formato correcto)

**Qué información genera:**
- Historial de todos los vehículos de la flota
- Estadísticas de gasto por tipo de servicio
- Documentos tributarios

---

### 3. ASEGURADORA

**Quién es:** compañía de seguros que cubre el costo de la reparación. El vehículo llegó con un siniestro (choque, daño por piedra, etc.). La aseguradora paga directamente al taller o le reembolsa al cliente.

**Casos frecuentes en Chile:** MAPFRE, HDI, Sura, Liberty, Allianz, BCI Seguros.

**Diferencia con otros clientes:** la aseguradora no es el dueño del vehículo ni el conductor. Es el que paga. Tiene sus propios formularios, sus propios peritajes, sus propios protocolos. El taller necesita ser taller afiliado a cada aseguradora para poder trabajar directamente con ellas.

**Proceso especial:**
- El cliente llega con el número de siniestro
- La aseguradora manda un perito a evaluar el daño
- El perito define qué se puede reparar y cuánto se paga por cada ítem
- El taller trabaja dentro de ese presupuesto aprobado por el perito
- Si el taller encuentra trabajo adicional que el perito no incluyó, debe solicitar una ampliación
- La aseguradora paga directamente al taller (o al cliente quien luego paga al taller)
- El deducible lo paga el cliente al taller

**Qué necesita el ERP para este caso:**
- Campo "número de siniestro" o "número de autorización" en la OT
- Campo "tipo de financiamiento = seguro"
- Poder registrar el nombre de la aseguradora como responsable económico
- Poder emitir factura a la aseguradora (con su RUT) y cobro separado del deducible al cliente
- Historial de trabajos por aseguradora (útil para negociar convenios)

---

### 4. LEASING / ARRENDATARIA

**Quién es:** empresa de leasing que es propietaria legal del vehículo. El conductor lo usa pero no lo posee. La empresa de leasing a veces paga el mantenimiento, a veces ese costo lo paga la empresa que arrienda el vehículo.

**Complejidad:** hay tres partes involucradas:
- La empresa de leasing (dueña legal)
- La empresa que arrienda (responsable económico puede ser ella)
- El conductor (quien trae el vehículo)

**Lo que el taller necesita saber:** quién paga. Una vez definido eso, el proceso es igual a empresa.

---

### 5. RECEPCIONISTA

**Quién es:** la persona en el mostrador. Es el primer contacto del cliente con el taller. Es quien captura la información en el sistema.

**Qué puede hacer en el ERP:**
- Crear y gestionar citas
- Hacer la recepción completa de un vehículo
- Crear y editar presupuestos
- Comunicarse con el cliente (registrar llamadas, enviar mensajes automáticos)
- Ver el estado de todas las OTs activas
- Registrar cobros
- Emitir boletas
- Gestionar la cola de espera del día
- Marcar un vehículo como listo para entrega
- Ver el stock disponible de repuestos frecuentes
- Solicitar repuestos a bodega
- Crear clientes y vehículos nuevos

**Qué no puede hacer:**
- Cambiar el estado de una OT que está en manos del mecánico (solo puede verla)
- Modificar el catálogo de servicios (puede sugerir uno nuevo, pero no aprobarlo)
- Acceder a reportes de rentabilidad interna
- Cambiar precios ya cotizados en un presupuesto aprobado
- Acceder a la nómina o costos del personal
- Emitir facturas (solo boletas, a menos que tenga permiso ampliado)

**Qué información necesita ver siempre:**
- Lista de OTs activas del día con su estado actual
- Citas del día y de los próximos días
- Vehículos esperando respuesta de presupuesto (tiempo pendiente de aprobación)
- Vehículos listos para entrega (hace cuánto están listos)
- Vehículos con estadía prolongada (llevan más de X días)
- Alertas de vencimiento de presupuesto

**Qué información genera:**
- Recepciones
- Presupuestos
- Comunicaciones con el cliente
- Cobros y emisión de documentos tributarios

---

### 6. JEFE DE TALLER

**Quién es:** el responsable técnico. Coordina a los mecánicos, controla la calidad, resuelve los casos difíciles.

**Qué puede hacer en el ERP:**
- Todo lo que puede el recepcionista
- Asignar y reasignar OTs a mecánicos
- Ver la carga de trabajo de cada mecánico en tiempo real
- Aprobar presupuestos de trabajo adicional
- Hacer el control de calidad y aprobar la entrega
- Ver el catálogo de servicios completo y sugerir modificaciones
- Ver reportes de productividad por mecánico
- Ver reportes de eficiencia (horas estándar vs horas reales por trabajo)
- Gestionar el inventario de bodega
- Ver qué repuestos están en pedido
- Acceder al historial técnico completo de cualquier vehículo
- Registrar diagnósticos y observaciones técnicas

**Qué no puede hacer (por defecto):**
- Cambiar precios del catálogo sin aprobación del administrador
- Ver reportes de margen bruto y rentabilidad neta
- Cambiar condiciones de pago de clientes

**Qué información necesita ver siempre:**
- Panel del taller: qué vehículo está en qué bahía y en qué estado
- Carga de trabajo de cada mecánico (horas asignadas vs disponibles)
- OTs bloqueadas esperando repuesto
- OTs con trabajo adicional esperando aprobación del cliente
- Tiempo promedio de cada trabajo para estimar entregas correctamente

---

### 7. MECÁNICO

**Quién es:** quien ejecuta el trabajo técnico. Su relación con el sistema es diferente: él no administra, él trabaja. El sistema debe servirle a él, no complicarle la vida.

**Qué puede hacer en el ERP:**
- Ver sus OTs asignadas con toda la información necesaria
- Ver el historial técnico del vehículo antes de empezar
- Marcar inicio y fin de cada trabajo
- Registrar observaciones técnicas (texto, foto, video)
- Solicitar materiales a bodega
- Registrar trabajo adicional encontrado (para que el jefe o recepcionista lo comunique al cliente)
- Ver si el repuesto que necesita está en stock o en pedido
- Marcar un trabajo como completado

**Qué no puede hacer:**
- Ver información de precios ni de cobro
- Modificar el estado global de la OT (eso lo hace el jefe de taller)
- Comunicarse directamente con el cliente (a través del sistema)
- Crear nuevas OTs
- Acceder a información de otros mecánicos (productividad, salario)

**Qué información necesita ver siempre:**
- Su lista de trabajos del día, en orden de prioridad
- La OT de cada vehículo: qué hacer, qué repuestos están disponibles
- Instrucciones especiales (el cliente indicó que hay un ruido solo a 80 km/h, por ejemplo)
- Historial técnico del vehículo (qué se hizo antes, qué problemas tuvo)
- Estado del pedido de repuestos que está esperando

**El sistema debe funcionar en el taller real:**
La interfaz del mecánico debe poder usarse con manos sucias. Debe ser posible en una tablet con botones grandes. Mínimo texto, máximo visual.

---

### 8. BODEGUERO

**Quién es:** la persona que controla el inventario físico. Puede ser el mismo jefe de taller en talleres pequeños.

**Qué puede hacer en el ERP:**
- Ver el stock actual de todos los repuestos
- Recibir mercadería de proveedores (marcar la llegada de un pedido)
- Despachar repuestos a mecánicos (marcar la salida de stock)
- Registrar devoluciones de repuestos no usados (el mecánico devuelve algo que sobró)
- Crear solicitudes de compra
- Recibir solicitudes de compra de otros mecánicos y recepcionistas
- Ver el historial de movimientos de stock
- Hacer inventario (recuento físico y ajuste de diferencias)
- Registrar repuestos dañados o vencidos
- Ver el pedido mínimo de cada repuesto

**Qué no puede hacer:**
- Cambiar precios sin aprobación
- Aprobar órdenes de compra (solo puede solicitar)
- Acceder a información de cobros o facturas

**Qué información necesita ver siempre:**
- Alertas de stock mínimo (qué está por agotarse)
- Pedidos en camino (qué viene llegando y cuándo)
- Repuestos reservados para OTs activas
- Pedidos urgentes de mecánicos

---

### 9. ADMINISTRADOR

**Quién es:** quien maneja la operación del negocio. Puede ser el mismo dueño o un administrador contratado. Tiene visión completa del negocio.

**Qué puede hacer en el ERP:**
- Acceso completo a todas las funciones
- Configurar el sistema (usuarios, permisos, precios, condiciones)
- Aprobar el catálogo de servicios (alta, modificación, desactivación)
- Gestionar proveedores y condiciones de compra
- Aprobar órdenes de compra
- Configurar alertas y notificaciones
- Ver todos los reportes
- Gestionar clientes empresariales y convenios
- Configurar formas de pago y condiciones de crédito
- Ver la caja del día
- Gestionar la facturación pendiente
- Exportar datos contables

**Qué información necesita ver siempre:**
- Resumen financiero del día / semana / mes
- OTs pendientes de cobro
- Deudores (cuentas por cobrar)
- Órdenes de compra pendientes de aprobación
- Catálogo de servicios pendiente de revisión

---

### 10. GERENTE / DUEÑO

**Quién es:** la persona que toma las decisiones estratégicas y necesita ver el negocio completo.

**Qué necesita del ERP:**
- Dashboard ejecutivo: rentabilidad, volumen, eficiencia, tendencias
- No necesita entrar al detalle de cada OT
- Necesita saber si el negocio está creciendo o decreciendo
- Necesita identificar oportunidades (¿qué servicio es más rentable?)
- Necesita identificar problemas (¿qué mecánico está menos productivo?)
- Necesita benchmarks propios (¿este mes fue mejor o peor que el mismo mes del año pasado?)

**Lo más importante:** el ERP no debe requerir que el dueño entre todos los días para que funcione. Debe funcionar solo. El dueño entra cuando quiere revisar, no cuando el sistema lo obliga.

---

### 11. CONTADOR

**Quién es:** el profesional que lleva la contabilidad del taller. Puede ser externo.

**Qué necesita del ERP:**
- Exportar todos los documentos tributarios emitidos del período (facturas, boletas, notas de crédito)
- Exportar el libro de ventas del mes
- Ver el detalle de cada documento (fecha, RUT receptor, monto, IVA)
- Ver las cuentas por cobrar pendientes
- Ver el detalle de compras (facturas de proveedores registradas)
- Exportar en formato compatible con el SII o con su software contable

**Qué no necesita:**
- Acceder al detalle técnico de las OTs
- Ver los presupuestos o historiales de clientes

---

### 12. PROVEEDOR

**Quién es:** la empresa que vende repuestos y materiales al taller. No tiene acceso directo al ERP del taller (no es un usuario del sistema), pero el ERP gestiona toda la relación con ellos.

**El ERP registra por proveedor:**
- Catálogo de productos con código, descripción y precio actual
- Condiciones de pago (contado, crédito 30 días, etc.)
- Tiempo de entrega habitual
- Historial de pedidos
- Historial de devoluciones
- Calidad del servicio (entregas a tiempo, piezas correctas)

**El ERP genera para el proveedor:**
- Órdenes de compra formales
- Solicitudes de devolución o garantía de proveedor

---

## FASE 3 — RECEPCIÓN

### La pantalla perfecta de recepción

La recepción es el proceso más importante del taller. Es donde se establece el contrato implícito con el cliente. Una recepción mal hecha genera conflictos, malos entendidos y clientes insatisfechos. Una recepción perfecta genera confianza y protege al taller.

**Principio rector:** la recepcionista no debería tener que escribir más del 30% de la información. El 70% restante debería venir automáticamente del sistema.

---

### SECCIÓN 1 — IDENTIFICACIÓN DEL VEHÍCULO

**Campo principal:** Patente

La patente es la llave de entrada al sistema. Cuando el recepcionista escribe la patente:

**Si el vehículo ya existe en el sistema:**
- Se carga automáticamente toda la información del vehículo: marca, modelo, año, color, número de motor, número de chasis
- Se muestra el historial resumido: cuántas veces ha venido, cuándo fue la última vez, qué se hizo, con cuántos kilómetros llegó
- Se muestra quién es el propietario actual registrado
- Se muestran alertas relevantes: "última vez que vino reportó ruido en frenos y no quiso arreglarlo", "OT abierta sin terminar", "tiene garantía vigente por trabajo del 15 de mayo"
- Se muestran las mantenciones programadas próximas: "le corresponde cambio de correa de distribución en los próximos 10.000 km"

**Si el vehículo es nuevo (primera vez):**
- El sistema ofrece dos opciones:
  - Crear el vehículo manualmente (ingresar todos los datos)
  - En el futuro: buscar en el Registro Civil por patente para traer datos automáticamente
- Campos requeridos para crear: marca, modelo, año, color
- Campos opcionales pero recomendados: número de motor, número de chasis (importante para trazabilidad de garantías)

**Lo que nunca debería pedir el sistema en este momento:**
- Número de contrato de seguro
- Información financiera
- Datos que se pueden obtener automáticamente

---

### SECCIÓN 2 — IDENTIFICACIÓN DEL CONDUCTOR

**Quién trae el vehículo:**

El conductor puede ser o no el dueño del vehículo. El sistema debe manejarlo por separado.

**Si el vehículo es conocido:** se muestra el propietario registrado. El recepcionista confirma: "¿Usted es [nombre]?" Si no, registra quién está trayendo el vehículo hoy.

**Datos del conductor:**
- Nombre completo
- RUT (para identificación)
- Teléfono de contacto (para este ingreso)
- Correo electrónico (opcional, para notificaciones)

El conductor puede ser diferente del responsable económico (quien paga). El sistema distingue entre los tres:
- Propietario del vehículo (registrado en el historial)
- Conductor en esta visita (quien lo trajo hoy)
- Responsable económico (quien paga)

---

### SECCIÓN 3 — RESPONSABLE ECONÓMICO Y TIPO DE FINANCIAMIENTO

Esta sección determina cómo se va a pagar y a quién se le emitirán los documentos.

**Opciones de tipo de financiamiento:**

**PARTICULAR:** El conductor o propietario paga de su bolsillo.
- Datos necesarios: RUT para boleta (opcional) o sin documento (ticket)
- Si quiere factura: RUT empresa o RUT personal + razón social o nombre

**EMPRESA:** Una empresa paga el trabajo.
- Datos necesarios: RUT empresa + razón social + datos de contacto del encargado
- El conductor puede ser el empleado de la empresa
- La empresa puede tener condiciones especiales de pago

**SEGURO:** Una aseguradora cubre el costo.
- Datos necesarios: nombre de la aseguradora + número de siniestro + nombre del perito asignado (si se conoce)
- El cliente puede pagar el deducible en caja

**GARANTÍA:** El trabajo es parte de una garantía de un trabajo anterior.
- El sistema debería mostrar automáticamente las garantías vigentes del vehículo
- El recepcionista selecciona qué garantía cubre este ingreso
- No hay cobro (o hay un cobro de inspección)

**CONVENIO:** El taller tiene un acuerdo comercial especial con esta empresa o flota.
- El sistema muestra las condiciones del convenio: descuentos, forma de pago, límite de crédito
- Los precios pueden ser diferentes al catálogo general

**INTERNO:** El vehículo es del propio taller o de alguien del equipo.
- Sin cobro o a precio de costo
- No genera ingreso al libro de ventas

---

### SECCIÓN 4 — MOTIVO DE INGRESO

**¿Por qué viene el vehículo?**

El recepcionista captura en palabras del cliente qué está pasando. Esto es fundamental y debe hacerse bien.

**Lo que se captura:**
- Descripción del problema en palabras del cliente (texto libre): "hace un ruido al frenar", "no parte en las mañanas", "el aceite está muy negro según el mecánico del vecino"
- Kilometraje actual (obligatorio — el recepcionista lo lee del tablero)
- Fecha y hora de ingreso (automática del sistema)
- Número de cita si existe

**Lo que NO se captura todavía aquí:**
- El diagnóstico técnico (eso lo hace el mecánico)
- El presupuesto
- Los repuestos

**Solicitudes específicas adicionales:**
Además del problema principal, el cliente puede solicitar trabajos adicionales conocidos: "mientras está ahí, cámbiame el aceite también". Estos se registran como solicitudes secundarias en la OT.

**Tiempo estimado de entrega (preliminar):**
El recepcionista puede indicar un tiempo estimado de entrega basado en la solicitud. No es vinculante todavía, pero le da al cliente una expectativa. "Para un cambio de aceite y revisión de frenos, estimamos entregarlo hoy en la tarde." El sistema puede sugerir un tiempo basado en los trabajos solicitados y la carga actual del taller.

---

### SECCIÓN 5 — ESTADO FÍSICO DEL VEHÍCULO

Esta sección protege al taller de reclamaciones por daños preexistentes.

**Lo que se registra:**
- Kilometraje (ya capturado antes)
- Nivel de combustible (indicador visual: vacío / 1/4 / 1/2 / 3/4 / lleno)
- Daños visibles exteriores (se puede dibujar sobre un diagrama del vehículo o simplemente listar: "arañazo en puerta trasera izquierda", "abolladuras en parachoque delantero")
- Objetos de valor dentro del vehículo que el cliente declaró (el taller no se hace responsable de objetos de valor dejados en el vehículo, pero si el cliente declara que los dejó, queda registrado)
- Accesorios especiales: llantas de lujo, stereo aftermarket, etc. (si el cliente los menciona)

**Fotografías de ingreso (ideal):**
El recepcionista o un asistente da una vuelta al vehículo tomando fotos con el teléfono. Las fotos se adjuntan automáticamente a la OT con timestamp. Esto es el mejor protector posible ante reclamaciones.

**Checklist de entrega de llaves:**
- Llave principal ✓
- Llave de repuesto ✓
- Llave de cerradura de ruedas ✓
- Control de garage ✓

---

### SECCIÓN 6 — DOCUMENTOS QUE GENERA LA RECEPCIÓN

Al completar la recepción, el sistema genera automáticamente:

**Orden de Recepción:** documento formal que resume todo lo anterior. El cliente lo firma (físicamente o digitalmente). Contiene:
- Datos del vehículo
- Estado físico registrado
- Motivo de ingreso con palabras del cliente
- Datos de contacto del cliente
- Quién es el responsable económico
- Condiciones del servicio (plazos de entrega aproximados, política de abandono de vehículos, condiciones de garantía)
- Número de OT asignado

**Mensaje automático al cliente:** "Hemos recibido tu [marca modelo] con patente [XXXX]. Tu número de OT es [número]. Te avisaremos cuando tengamos el diagnóstico listo."

---

### ESTADOS DE LA RECEPCIÓN

Una recepción no es binaria (completada / no completada). Tiene estados intermedios:

1. **Borrador:** el recepcionista está ingresando datos, no ha terminado
2. **Completada:** todos los datos obligatorios ingresados, documento generado, cliente informado
3. **En diagnóstico:** el mecánico ya tomó el vehículo
4. **Esperando presupuesto:** diagnóstico listo, presupuesto no enviado aún
5. **Esperando aprobación:** presupuesto enviado al cliente
6. **Aprobada:** cliente aprobó, se puede iniciar el trabajo
7. **En trabajo:** mecánico ejecutando
8. **Lista para entrega:** trabajo terminado, control de calidad aprobado
9. **Entregada:** vehículo retirado, cobrado

---

# PARTE 2
## ORDEN DE TRABAJO · CATÁLOGO · INVENTARIO

---

## FASE 4 — ORDEN DE TRABAJO

### El documento central de operación

La Orden de Trabajo (OT) es el documento operativo que acompaña al vehículo desde que entra hasta que sale. No es solo un formulario. Es el expediente completo del trabajo a realizar.

La OT debe poder ser leída e interpretada por cualquier persona del equipo en cualquier momento: el recepcionista que la creó, el mecánico que trabaja el vehículo, el jefe de taller que supervisa, el administrador que cobra, y el cliente que quiere saber en qué está su auto.

---

### SECCIÓN A — DATOS DE ENCABEZADO (congelados en la recepción)

Estos datos se capturan en la recepción y NO deben modificarse después. Son el contrato inicial.

**Datos que pertenecen a la Recepción:**
- Número de OT (único, asignado automáticamente)
- Fecha y hora de ingreso
- Fecha y hora prometida de entrega (si se comprometió)
- Nombre del recepcionista que realizó la recepción
- Motivo de ingreso (palabras del cliente, verbatim)
- Solicitudes adicionales del cliente
- Kilometraje de ingreso
- Nivel de combustible
- Daños declarados al ingreso
- Fotos de ingreso (galería adjunta)
- Número de cita vinculada (si aplica)

**Datos que pertenecen al Vehículo:**
- Patente
- Marca, modelo, año
- Color
- VIN / número de chasis
- Número de motor
- Tipo de combustible
- Capacidad de aceite
- Tipo de aceite recomendado por fabricante
- Último servicio registrado (desde el historial)
- Próximas mantenciones según fabricante

**Datos que pertenecen al Responsable Económico:**
- Nombre del responsable
- RUT (si aplica)
- Tipo de financiamiento (particular / empresa / seguro / garantía / convenio / interno)
- Datos de contacto para notificaciones
- Referencia externa (número de siniestro, número de OC, código de convenio)

**Datos que pertenecen al Conductor:**
- Nombre de quien trajo el vehículo hoy
- Teléfono de contacto directo

---

### SECCIÓN B — DIAGNÓSTICO

Esta sección la completa el mecánico. Es el registro técnico de qué encontró al inspeccionar el vehículo.

**Estructura:**
- Síntomas confirmados (lo que el mecánico verificó de lo que dijo el cliente)
- Síntomas no confirmados (el cliente dijo que hace ruido pero el mecánico no lo pudo reproducir)
- Hallazgos adicionales (qué más encontró que el cliente no mencionó)
- Código OBD si corresponde (errores del computador del vehículo)
- Recomendaciones: qué se debe hacer, qué se puede esperar, qué no aplica

**Medios adjuntos:**
- Fotos tomadas durante el diagnóstico (la pieza desgastada, el nivel de líquido, el componente dañado)
- Videos si la falla es mejor explicada en movimiento
- Captura de pantalla del scanner OBD

**El diagnóstico se puede hacer en dos partes:**
1. Diagnóstico previo al presupuesto (rápido, orienta el presupuesto)
2. Diagnóstico profundo durante el trabajo (para casos complejos)

---

### SECCIÓN C — TRABAJOS Y SERVICIOS

Aquí se registra qué trabajo se va a realizar (o se realizó). Es la sección que genera el presupuesto y finalmente la factura.

**Estructura de un trabajo:**
- Nombre del servicio (del catálogo o ingresado manualmente)
- Descripción detallada (opcional, solo si es diferente al estándar)
- Horas estándar (del catálogo)
- Horas reales (registradas por el mecánico al ejecutar)
- Precio unitario (del catálogo, puede modificarse con justificación)
- Descuento (si aplica)
- Total
- Estado: pendiente / aprobado / en progreso / completado / rechazado por cliente
- Mecánico asignado
- Fecha de inicio y fin real

**Tipos de trabajo:**
1. **Mano de obra simple:** el mecánico hace el trabajo con herramientas del taller. Sin materiales.
2. **Mano de obra con materiales:** el mecánico usa repuestos del inventario del taller.
3. **Paquete:** un conjunto de trabajos y repuestos que se facturan juntos (ej: "Mantención 10.000 km" = aceite + filtro aceite + filtro aire + revisión 30 puntos).
4. **Diagnóstico con cargo:** algunas inspecciones tienen un costo aunque no se realice el trabajo.
5. **Subcontrato:** trabajo que el taller encarga a un tercero y factura con margen (ej: pintado de carrocería, tapizado, diagnóstico especializado).

---

### SECCIÓN D — REPUESTOS Y MATERIALES

Esta sección se vincula directamente con el inventario. Cada repuesto tiene trazabilidad completa.

**Estructura de un repuesto:**
- Nombre y descripción
- Código interno del taller
- Número de parte del fabricante (si se conoce)
- Proveedor de donde se obtuvo
- Cantidad usada
- Precio de costo (lo que pagó el taller)
- Precio de venta al cliente
- Margen
- Lote o número de serie (si aplica para trazabilidad de garantía)
- Estado: reservado / recibido / instalado / devuelto

**Repuestos del propio inventario vs compra especial:**
- Repuesto de stock: se descuenta automáticamente del inventario cuando se marca como instalado
- Repuesto comprado especialmente para esta OT: queda vinculado a la OT desde que se compra

---

### SECCIÓN E — TRABAJO ADICIONAL

Cuando el mecánico encuentra algo que no estaba en el presupuesto original, se registra aquí como un ítem separado con estado "pendiente de aprobación".

**Proceso:**
1. Mecánico registra el hallazgo con descripción, foto, y precio estimado
2. El sistema notifica automáticamente al recepcionista
3. El recepcionista contacta al cliente (o el sistema lo hace automáticamente)
4. El cliente aprueba o rechaza
5. Si rechaza, el rechazo queda registrado ("El cliente fue informado y rechazó la reparación de la correa de distribución desgastada")

---

### SECCIÓN F — OBSERVACIONES Y COMUNICACIONES

**Notas internas:** comentarios que solo ve el equipo del taller. "Este cliente es muy detallista, explicarle bien." "El vehículo tiene modificaciones que pueden anular garantía de algunas piezas."

**Comunicaciones con el cliente:** registro cronológico de cada contacto con el cliente durante esta OT. Quién llamó, qué se dijo, en qué hora. Esto es fundamental para resolver disputas.

**Instrucciones para el mecánico:** si el recepcionista o jefe de taller tiene indicaciones específicas. "El cliente dice que el ruido solo aparece cuando está frío." "No mover el vehículo hasta que llegue el repuesto."

---

### SECCIÓN G — ESTADOS DE LA OT

Una OT atraviesa estados definidos. Los estados son visibles para todo el equipo y para el cliente.

**Estados principales:**
1. **Borrador:** la recepción está siendo completada
2. **Recibida:** recepción completada, esperando asignación
3. **En diagnóstico:** mecánico haciendo diagnóstico inicial
4. **Esperando presupuesto:** diagnóstico hecho, presupuesto siendo preparado
5. **Esperando aprobación:** presupuesto enviado al cliente
6. **Aprobada parcialmente:** cliente aprobó algunos ítems
7. **Aprobada:** cliente aprobó todo
8. **Esperando repuesto:** trabajo aprobado pero falta material
9. **En trabajo:** mecánico ejecutando
10. **Pausada:** trabajo detenido por alguna razón (espera información, espera repuesto urgente)
11. **En control de calidad:** trabajo terminado, revisando
12. **Lista para entrega:** aprobada por jefe de taller
13. **Entregada:** vehículo retirado
14. **Cerrada:** cobrada y facturada
15. **Cancelada:** por alguna razón no se realizó el trabajo
16. **Garantía activa:** se reabrió por reclamación de garantía

---

### SECCIÓN H — CHECKLIST DE CONTROL

Antes de entregar el vehículo, se completa un checklist de control de calidad. Puede estar preconfigurado por tipo de trabajo.

**Checklist de ejemplo para mantención general:**
- Nivel de aceite motor ✓
- Nivel de líquido de frenos ✓
- Nivel de líquido refrigerante ✓
- Presión de neumáticos (4 ruedas) ✓
- Luces delanteras y traseras ✓
- Funcionamiento de frenos ✓
- Sin ruidos anormales ✓
- Interior limpio ✓
- No quedan herramientas en el vehículo ✓

---

## FASE 5 — CATÁLOGO DE SERVICIOS

### El catálogo ideal

El catálogo es el corazón del sistema de precios. Debe ser un reflejo fiel de lo que el taller hace y cuánto cobra. Debe ser fácil de mantener, difícil de usar mal, y útil tanto para el recepcionista al presupuestar como para el mecánico al ejecutar.

---

### TIPOS DE ENTRADA EN EL CATÁLOGO

**Servicio simple:** una sola operación. Tiene un nombre, una descripción, un tiempo estándar en horas, y un precio.

Ejemplo: "Cambio de aceite motor (incluye filtro)" — 0,5 horas — $25.000

**Servicio compuesto:** una operación que internamente tiene varias sub-operaciones, pero se vende como un solo ítem al cliente.

Ejemplo: "Revisión de frenos completa" = inspección de pastillas + medición de discos + revisión de líquido + purga si necesario. Para el cliente es un precio único. Para el mecánico es una lista de pasos.

**Paquete:** un conjunto de servicios y materiales vendidos juntos con precio especial. El precio del paquete es menor que la suma de sus partes.

Ejemplo: "Mantención 10.000 km" = cambio de aceite + filtro aceite + filtro aire + revisión de 30 puntos + lavado. Los materiales incluidos están predefinidos en el paquete.

**Material / Repuesto:** los ítems del inventario también están en el catálogo con su precio de venta sugerido. El precio en el catálogo es el precio de referencia; el precio real puede variar según el repuesto específico que se instale.

---

### ATRIBUTOS DE CADA SERVICIO EN EL CATÁLOGO

**Identificación:**
- Código único (ej: SSMANT01, FRENOS02)
- Nombre comercial (el que ve el cliente)
- Nombre técnico (el que usa el mecánico)
- Descripción para el cliente (lenguaje simple)
- Descripción técnica (para el mecánico, qué incluye exactamente)

**Precios:**
- Precio de lista (precio base sin descuento)
- Precio mínimo (no se puede vender por menos sin autorización especial)
- Tarifa de hora estándar aplicable (si es servicio de mano de obra)
- Horas estándar (tiempo teórico para completar el trabajo)
- Si el precio es fijo o calculado por horas × tarifa

**Organización:**
- Categoría (frenos, motor, suspensión, eléctrico, mantenimiento preventivo, etc.)
- Sub-categoría
- Etiquetas o tags libres (para búsqueda)
- Servicios relacionados sugeridos (si estás haciendo esto, también conviene hacer aquello)
- Compatible con: tipos de vehículo, marcas, etc. (opcional pero útil)

**Control:**
- Estado: activo / inactivo / requiere revisión
- Fecha de creación y de última modificación
- Quién lo creó y quién lo modificó
- Veces utilizado (para detectar servicios sin uso o muy populares)
- Versión (si se modificó el precio, cuál era antes)

**Servicios sugeridos:**
El catálogo puede sugerir servicios relacionados cuando se agrega un servicio a una OT. Ejemplo: si agregas "cambio de pastillas de freno", el sistema sugiere "medición de discos de freno" y "purga de líquido de frenos". El recepcionista o mecánico puede agregar las sugerencias con un clic.

**Favoritos por mecánico:**
Cada mecánico puede tener sus servicios favoritos al principio de la lista para agilizar el registro.

---

### PRECIOS Y TARIFAS

**Tarifa base de mano de obra:**
El taller tiene una tarifa hora base. Todos los servicios calculados por tiempo usan esta tarifa como referencia. La tarifa puede ser diferente para trabajos especializados (diagnóstico electrónico, ADAS, etc.).

**Precios por tipo de cliente:**
- Precio particular (precio de lista)
- Precio empresa (puede tener descuento porcentual general o precio especial por ítem)
- Precio convenio (negociado, puede ser diferente por convenio)

El catálogo guarda todos los precios. El sistema aplica el correcto automáticamente según el tipo de cliente de la OT.

**Descuentos:**
- Por volumen (si llevas X servicios, descuento Y%)
- Por cliente frecuente
- Promocional (vigente hasta cierta fecha)
- Manual (el recepcionista puede aplicar un descuento con una justificación, sujeto a autorización según el monto)

---

### SERVICIOS NUEVOS CREADOS DESDE LA OT

Cuando el mecánico o recepcionista necesita agregar un servicio que no está en el catálogo, puede crearlo directamente desde la OT. Ese servicio nuevo:
- Se agrega a la OT con el precio que se ingresó
- Queda marcado como "pendiente de revisión" en el catálogo
- El administrador o jefe de taller lo revisa: lo aprueba con precio definitivo, lo fusiona con uno existente, o lo elimina si fue un error
- Una vez aprobado, queda disponible para todas las OTs futuras

Este flujo evita duplicados y mantiene el catálogo limpio.

---

### SERVICIOS INACTIVOS

Un servicio inactivo no aparece en búsquedas ni se puede agregar a nuevas OTs. Pero sigue existiendo para que las OTs históricas donde se usó sigan siendo legibles. Nunca se borra un servicio del catálogo que haya sido usado.

---

## FASE 6 — INVENTARIO

### Principios del inventario de un taller mecánico

El inventario de un taller es diferente al de un comercio. Los repuestos no se venden solos: se venden instalados en un vehículo específico dentro de una OT. Esto cambia completamente cómo debe funcionar el sistema.

**El inventario de un taller tiene dos categorías:**

**Repuestos de stock permanente:** ítems que el taller siempre tiene en bodega porque se usan frecuentemente. Aceites, filtros comunes, pastillas de freno populares, bujías, correas. Se compran en cantidad y se van consumiendo.

**Repuestos comprados por pedido:** cuando llega un vehículo específico y necesita una pieza especial que no se mantiene en stock. Se compra para esa OT específicamente. Una vez usada, no queda en inventario.

---

### CICLO DE VIDA DE UN REPUESTO EN EL SISTEMA

**1. Compra al proveedor:**
Se genera una orden de compra. El proveedor entrega. El bodeguero recibe la mercadería y la registra en el sistema: cantidad, precio de costo, proveedor, número de factura del proveedor, fecha. El stock aumenta.

**2. Reserva para OT:**
Cuando se aprueba una OT y se sabe qué repuestos se van a usar, el sistema los reserva. Los repuestos reservados siguen en stock pero ya no están disponibles para otras OTs. Esto evita el problema de usar un repuesto en un vehículo que llegó después cuando ya estaba comprometido para el primero.

**3. Consumo real:**
Cuando el mecánico instala el repuesto, lo marca como consumido. El stock disminuye. El repuesto queda vinculado a esa OT, ese vehículo, y esa fecha.

**4. Devolución:**
Si el mecánico sacó un repuesto y por alguna razón no lo usó (el diagnóstico cambió, el cliente rechazó el trabajo), lo devuelve a bodega. El stock sube de nuevo. La reserva se cancela.

**5. Ajuste de inventario:**
Periódicamente, el bodeguero hace un recuento físico. Si hay diferencias con el sistema (puede haber merma, errores de registro, pérdida), se hace un ajuste con nota justificatoria.

---

### INFORMACIÓN MÍNIMA POR REPUESTO

- Nombre descriptivo
- Código interno del taller
- Código del fabricante (número de parte)
- Categoría (aceites / filtros / frenos / motor / eléctrico / etc.)
- Proveedor(es) donde se consigue
- Precio de costo actual (el último que se pagó)
- Precio de venta sugerido (margen sobre costo)
- Stock actual
- Stock mínimo (si baja de este nivel, alerta para reposición)
- Punto de reorden (cuándo hacer el pedido antes de que se agote)
- Cantidad sugerida de compra (cuánto pedir cada vez)
- Ubicación en bodega (estante, cajón, código de posición)
- Tiempo de entrega habitual del proveedor

---

### GESTIÓN DE PROVEEDORES POR REPUESTO

Un repuesto puede tener varios proveedores. Para cada proveedor se registra:
- Precio actual de ese proveedor
- Tiempo de entrega habitual
- Calidad (si hay historial de piezas malas de ese proveedor)
- Si es proveedor preferido o proveedor de respaldo

Cuando se genera una solicitud de compra, el sistema sugiere el proveedor preferido. El comprador puede cambiarlo si tiene razones (mejor precio, entrega más rápida, proveedor preferido no tiene stock).

---

### MÚLTIPLES PRECIOS

Un mismo repuesto puede tener precios diferentes según:
- El proveedor donde se compra (precio de costo variable)
- El tipo de cliente al que se le vende (particular / empresa / convenio)
- Descuentos por volumen

El sistema gestiona estas variaciones sin confundir el precio de costo con el precio de venta.

---

### ALERTAS DE STOCK

El sistema genera alertas automáticas cuando:
- Un repuesto cae bajo el stock mínimo ("Quedan solo 2 unidades de Filtro aceite 5L Castrol 5W-30. Pedido mínimo sugerido: 6 unidades.")
- Un repuesto reservado para una OT no ha llegado y la OT está atrasada
- Un pedido al proveedor lleva más de tiempo del habitual sin confirmación de entrega

---

### COMPRAS

**Solicitud de compra:** generada automáticamente cuando el stock cae bajo mínimos, o manualmente por el bodeguero o jefe de taller.

**Orden de compra:** documento formal enviado al proveedor. El administrador la aprueba si supera cierto monto.

**Recepción de mercadería:** el bodeguero registra la llegada, verifica que coincida con lo pedido, registra el precio real (puede diferir del cotizado), y actualiza el stock.

**Factura del proveedor:** queda vinculada a la orden de compra para que el contador pueda registrar el gasto.

---

### CASOS ESPECIALES

**Repuesto con número de serie:** para repuestos caros o de garantía extendida, se puede registrar el número de serie individual. Esto permite saber exactamente qué pieza se instaló en qué vehículo, lo que es clave para garantías del fabricante.

**Repuesto retornable al cliente:** si se saca una pieza del vehículo que el cliente quiere llevarse (el motor viejo que le regaló al vecino, las llantas originales cuando pone las de invierno), se registra como ítem entregado con la OT, no como repuesto en inventario.

**Repuesto con garantía del proveedor:** si el proveedor garantiza la pieza por X meses, eso se registra. Si la pieza falla y el taller la reemplaza en garantía, puede reclamarle al proveedor.

---

# PARTE 3
## PRESUPUESTOS · FACTURACIÓN · GARANTÍAS · CRM

---

## FASE 7 — PRESUPUESTOS

### El presupuesto como documento de confianza

El presupuesto no es solo una lista de precios. Es el contrato entre el taller y el cliente. Es el documento que define qué trabajo se va a hacer, cuánto va a costar, y qué queda excluido.

Un buen presupuesto:
- Es claro y comprensible para alguien sin conocimientos mecánicos
- Distingue entre lo que es urgente y lo que puede esperar
- Explica en lenguaje simple qué pasará si no se hace el trabajo
- Da seguridad al cliente de que no habrá sorpresas

---

### CONSTRUCCIÓN AUTOMÁTICA DEL PRESUPUESTO

El presupuesto se construye en gran medida automáticamente a partir de la OT:

**Cuando el mecánico registra un trabajo en la OT**, el sistema lo agrega al presupuesto con:
- El precio del catálogo (o el precio calculado por horas × tarifa si es variable)
- Los materiales asociados a ese trabajo con sus precios de venta
- La descripción del servicio en lenguaje para el cliente

**El recepcionista o jefe de taller puede:**
- Revisar el presupuesto antes de enviarlo
- Ajustar precios dentro de los rangos permitidos
- Agregar o quitar ítems
- Agregar una nota o comentario especial para el cliente
- Cambiar la forma de presentación (mostrar u ocultar el detalle de materiales)

---

### CAMPOS QUE QUEDAN CONGELADOS DESPUÉS DE LA APROBACIÓN

Una vez que el cliente aprueba el presupuesto, ciertos campos no pueden modificarse:

**Congelados:**
- Precio unitario de cada ítem aprobado
- Descripción de cada ítem aprobado
- Total aprobado por el cliente
- Fecha y hora de la aprobación
- Cómo se aprobó (llamada telefónica registrada, firma, WhatsApp, en persona)

**No congelados (pueden cambiar):**
- Horas reales (pueden diferir de las estándar, pero el precio no cambia si se aprobó precio fijo)
- Mecánico asignado
- Notas internas del equipo

**Trabajo adicional:** si el mecánico encuentra algo nuevo que no estaba en el presupuesto original, se crea un presupuesto adicional separado (versión 2 de la misma OT), con su propio proceso de aprobación.

---

### EDICIÓN POST-APROBACIÓN

La edición post-aprobación requiere autorización. No cualquiera puede modificar un presupuesto ya aprobado.

**Situaciones que pueden requerir edición:**
- El repuesto específico no estaba disponible y hubo que usar uno equivalente con precio diferente → requiere aprobación del cliente
- El trabajo fue más complejo de lo previsto y tomó más horas → si el precio era por hora, requiere aprobación; si era precio fijo, el taller absorbe la diferencia
- El cliente quiere agregar algo más → presupuesto adicional

---

### FORMATOS DEL PRESUPUESTO

**Presupuesto detallado:** muestra cada ítem, cada repuesto, cada hora. Preferido por clientes empresariales y aseguradoras.

**Presupuesto resumido:** muestra solo los grandes trabajos con precio total. Preferido por clientes particulares que no quieren ver el desglose.

**Comparativo:** si hay varias alternativas (reparar vs reemplazar, pieza original vs equivalente), el presupuesto puede mostrar dos columnas con las opciones.

---

### COMUNICACIÓN AL CLIENTE

El presupuesto puede enviarse al cliente por:
- WhatsApp (link al portal del cliente o PDF)
- Correo electrónico con PDF adjunto
- SMS con link
- Mostrado en pantalla en el mostrador (para cuando el cliente está presente)

**El cliente puede responder:**
- Llamando al taller
- Respondiendo el mensaje (si hay integración de WhatsApp Business)
- A través del portal del cliente (portal web, opción futura)

**Registro de la aprobación:**
Toda aprobación queda registrada. Si fue por teléfono, el recepcionista registra "aprobado por teléfono el [fecha] a las [hora] por [nombre]". Si fue digital, queda el timestamp de la acción.

---

### VENCIMIENTO DEL PRESUPUESTO

Un presupuesto tiene una fecha de vencimiento (configurable por el administrador, por defecto 72 horas o 3 días hábiles). Pasado ese tiempo, los precios de repuestos pueden haber cambiado y el taller no está obligado a respetar el precio.

El sistema envía recordatorio automático al cliente antes del vencimiento: "Tu presupuesto vence mañana. Para confirmar el trabajo, contáctanos."

Si el presupuesto vence, el estado cambia a "vencido" y se puede reactivar con revisión de precios.

---

## FASE 8 — FACTURACIÓN

### Contexto chileno

En Chile, toda transacción comercial requiere un documento tributario electrónico (DTE) emitido a través del Servicio de Impuestos Internos (SII). El taller debe estar certificado como emisor de DTE. Los documentos más relevantes para un taller son:

- **Boleta electrónica:** para ventas a personas naturales sin RUT empresarial o que no necesitan descontar IVA. No requiere RUT del comprador (o se puede emitir a RUT de persona natural).
- **Factura electrónica:** para ventas a empresas o personas naturales con actividad económica que necesitan descontar el IVA. Requiere RUT del receptor, razón social, giro.
- **Nota de crédito electrónica:** para anular o corregir una factura o boleta ya emitida. No se puede modificar un DTE emitido, solo anular con nota de crédito.

El IVA en Chile es 19%. El taller cobra el 19% al cliente y lo traslada al SII.

---

### TIPOS DE PAGO

**Contado:**
El cliente paga el total en el momento de retirar el vehículo. Puede ser en efectivo, tarjeta de crédito/débito, transferencia bancaria, o combinación.

Para cada forma de pago se registra:
- Efectivo: monto exacto
- Tarjeta: últimos 4 dígitos, tipo (crédito/débito), número de voucher
- Transferencia: número de operación, banco, fecha

**Crédito a empresa:**
La empresa tiene condiciones de crédito acordadas (ejemplo: pago a 30 días). El vehículo se entrega, la factura se emite, pero el pago llega después. El sistema registra la cuenta por cobrar y genera alertas cuando se acerca el vencimiento.

**Seguro:**
La aseguradora paga directamente al taller. El proceso es:
1. El taller envía la factura a la aseguradora con el número de siniestro
2. La aseguradora paga dentro de su plazo (puede ser 15-30 días)
3. El cliente paga solo el deducible en el momento de retirar
4. El sistema registra la factura como pendiente hasta que llega el pago de la aseguradora

**Pago mixto:**
El caso más común en seguro: la aseguradora cubre el trabajo de carrocería pero no la mantención aprovechando que el vehículo está en el taller. El cliente paga la mantención contado y la aseguradora paga la carrocería después.

También puede haber pago mixto cliente-empresa: parte lo paga el empleado, parte la empresa (por ejemplo, la empresa cubre los gastos de mantención pero el empleado pagó un daño propio).

**Abonos:**
Para trabajos de mayor valor, el cliente puede dejar un abono al momento de aprobar el presupuesto. El sistema registra el abono y descuenta del total al momento de la entrega.

---

### FLUJO DE FACTURACIÓN

1. **El trabajo está completado** y la OT está en estado "Lista para entrega"
2. **El recepcionista genera el borrador de factura/boleta** directamente desde la OT (el sistema lo construye con todos los ítems aprobados y ejecutados)
3. **Revisión:** el recepcionista confirma que todos los ítems estén correctos
4. **Datos del receptor:** para boleta, no requiere datos (o son del cliente). Para factura, confirmar RUT y razón social.
5. **Emisión:** el sistema envía el DTE al SII y obtiene el folio y el timbre electrónico. El documento queda válido tributariamente.
6. **Cobro:** se registra el pago
7. **Entrega del documento:** el sistema envía el PDF de la factura o boleta al correo del cliente automáticamente

---

### NOTA DE CRÉDITO

Si el cliente reclama algo después de la factura emitida:
- No se puede modificar la factura emitida
- Si el reclamo es válido, se emite una nota de crédito que anula total o parcialmente la factura
- Si hubo un trabajo bajo garantía, la nota de crédito puede cubrir el monto del repuesto y la mano de obra garantizado

---

### CUENTAS POR COBRAR

El administrador tiene una vista de todas las deudas pendientes:
- Cliente o empresa que debe
- Monto pendiente
- Fecha de la factura
- Fecha de vencimiento de pago
- Días de mora (si ya venció)
- Historial de cobros y recordatorios enviados

El sistema puede enviar recordatorios automáticos antes del vencimiento y alertas al administrador cuando hay facturas vencidas sin pago.

---

### SALDO PENDIENTE POR OT

Algunas OTs pueden quedar con saldo pendiente (el cliente dejó abono pero no pagó el total). El sistema no cierra la OT hasta que el saldo esté en cero, o hasta que el administrador lo marque explícitamente como incobrable.

---

## FASE 9 — GARANTÍAS

### Cómo nace una garantía

Toda garantía nace automáticamente cuando se cierra una OT. No requiere que nadie la cree manualmente. El sistema sabe qué trabajos se realizaron y aplica las condiciones de garantía correspondientes del catálogo.

**Cada trabajo del catálogo tiene definidas sus condiciones de garantía:**
- Mano de obra: X meses desde la fecha de entrega
- Repuesto instalado: X meses o X kilómetros (lo que ocurra primero), según la garantía del fabricante del repuesto
- Garantías especiales: algunos trabajos tienen garantías de por vida (si se usa la pieza del fabricante original)

---

### ESTRUCTURA DE UNA GARANTÍA

- OT de origen (número de OT donde se realizó el trabajo)
- Trabajo o repuesto cubierto (referencia al ítem específico de la OT)
- Fecha de inicio (fecha de entrega del vehículo)
- Fecha de vencimiento
- Kilometraje de inicio (el que tenía el vehículo al momento de la entrega)
- Kilometraje máximo garantizado (si aplica)
- Condiciones específicas (qué cubre y qué no cubre)
- Estado: vigente / vencida / utilizada / anulada

---

### CONTROL DE GARANTÍAS

**Para el recepcionista:** cuando un vehículo llega, el sistema muestra automáticamente si tiene garantías vigentes. Antes de cobrar cualquier trabajo, el recepcionista debería revisar si lo que el cliente reclama está cubierto.

**Para el cliente:** puede ver sus garantías vigentes en el portal (si existe) y saber exactamente hasta cuándo aplican.

**Para el administrador:** reporte de garantías activas, garantías usadas, costo de garantías (cuánto ha costado resolver garantías en el período).

---

### PROCESO DE RECLAMO DE GARANTÍA

1. El cliente llega con un reclamo (o llama)
2. El recepcionista identifica el vehículo y revisa las garantías vigentes
3. Si el reclamo está dentro de la garantía:
   - Se abre una nueva OT vinculada a la OT original
   - Se marca como "garantía" → el trabajo no genera cobro al cliente
   - El mecánico repara o reemplaza según corresponda
   - Si el problema fue el repuesto → el taller puede reclamarle al proveedor
   - Si el problema fue la mano de obra → el taller absorbe el costo
4. Si el reclamo está fuera de la garantía (vencida, o por uso indebido):
   - El recepcionista explica claramente por qué no aplica la garantía
   - El sistema muestra la garantía con su fecha de vencimiento para respaldo
   - Se ofrece el trabajo como OT normal con presupuesto

---

### ANULACIÓN DE GARANTÍA

Una garantía puede anularse si:
- El vehículo fue intervenido por otro taller o por el propio cliente después del trabajo
- El uso fue claramente indebido (el cliente llevó el vehículo a off-road después de una reparación de suspensión de ciudad)
- Hubo un accidente que provocó el daño

La anulación debe estar documentada con una justificación. No es una decisión que toma el mecánico solo; debe ser validada por el jefe de taller o administrador.

---

### GARANTÍA DEL PROVEEDOR

Si el repuesto instalado falla y el proveedor tiene garantía sobre esa pieza, el taller puede reclamarle al proveedor. El sistema vincula el repuesto instalado con:
- La factura de compra al proveedor
- El lote o número de serie del repuesto (si se registró)
- La garantía del proveedor sobre ese ítem

Esta vinculación permite al taller gestionar la devolución al proveedor y minimizar el costo de la garantía al cliente.

---

## FASE 10 — CRM

### La relación con el cliente como activo del taller

El CRM del taller no es un sistema de marketing masivo. Es un sistema de gestión de relaciones que ayuda al taller a dar un servicio personalizado y a mantener el vínculo con el cliente entre visitas.

**El principio central:** el taller debe saber todo lo relevante sobre el cliente y su vehículo antes de que el cliente tenga que repetirlo. "Bienvenido de nuevo, don Rodrigo. El Hilux, ¿verdad? La última vez quedó pendiente la revisión de la correa de distribución."

---

### FICHA DE CLIENTE

**Datos básicos:**
- Nombre completo (o razón social si es empresa)
- RUT
- Teléfono(s) de contacto y preferencia de contacto (WhatsApp / llamada / correo)
- Correo electrónico
- Dirección (opcional, útil para clientes de flota)
- Notas especiales ("prefiere ser contactado solo en la tarde", "muy detallista con la limpieza del auto")

**Historial completo:**
- Todos los vehículos que ha traído al taller (propios o de terceros)
- Todas las OTs de cada vehículo
- Total gastado en el taller (valor del cliente)
- Primera visita y última visita
- Frecuencia de visitas
- Trabajos rechazados (y cuándo)

**Documentos:**
- Facturas y boletas históricas
- Presupuestos (aprobados y rechazados)

---

### FICHA DE VEHÍCULO

La ficha del vehículo es la historia técnica completa. Es más importante que la ficha del cliente porque el vehículo puede cambiar de dueño pero su historial permanece.

**Contenido:**
- Datos técnicos del vehículo
- Historial completo de visitas al taller
- Todos los trabajos realizados con fecha y kilometraje
- Todos los repuestos instalados con fecha y kilometraje
- Todos los diagnósticos
- Todos los trabajos rechazados por el cliente
- Garantías activas e históricas
- Cambios de propietario registrados
- Mantenciones próximas según calendario del fabricante

---

### EMPRESAS Y FLOTAS

Para empresas con múltiples vehículos, el CRM tiene una vista de empresa:
- Datos de la empresa (RUT, razón social, giro, condiciones de pago)
- Contactos de la empresa (encargado de flota, administración, gerencia)
- Lista de todos los vehículos de la flota
- Estado actual de cada vehículo
- Gasto del mes actual y comparativo con meses anteriores
- Próximas mantenciones de todos los vehículos (vista de calendario)
- Crédito disponible y facturación pendiente de pago

---

### RECORDATORIOS Y SEGUIMIENTO

**Recordatorio de mantención próxima:**
El sistema calcula cuándo le corresponde la próxima mantención a cada vehículo basándose en el kilometraje de la última visita y el kilometraje anual promedio estimado. Cuando se acerca la fecha, envía un mensaje automático al cliente: "Tu [marca modelo] patente [XXXX] estará pronto para la mantención de los 50.000 km. ¿Quieres agendar?"

**Seguimiento post-entrega:**
2 días después de cada entrega, mensaje automático al cliente preguntando si todo está bien.

**Cumpleaños:**
Opcional, pero si el taller quiere, puede enviar un mensaje de felicitación el día del cumpleaños del cliente.

**Aniversario del cliente:**
"Hace 1 año te atendimos por primera vez. ¡Gracias por tu confianza!"

**Repuesto con garantía próxima a vencer:**
Si el repuesto instalado tiene garantía de fábrica por 12 meses, antes de que venza, puede ser útil avisar al cliente: "Recuerda que la batería que instalamos en tu vehículo tiene garantía hasta [fecha]. Si tienes algún problema, contáctanos."

---

### CAMPAÑAS

Para el taller pequeño, las campañas son simples:
- Seleccionar un segmento de clientes (todos los que no han venido en más de 6 meses, todos los que tienen un modelo específico de vehículo, todos los que tienen mantención próxima)
- Enviar un mensaje por WhatsApp o correo

No es necesario un CRM complejo para esto. Una selección de clientes + un botón de "enviar mensaje" es suficiente.

---

# PARTE 4
## KPIs · DOCUMENTO MAESTRO · REVISIÓN CRÍTICA

---

## FASE 11 — INDICADORES

### Dashboard del dueño

El dashboard del dueño debe responder en 30 segundos la pregunta: "¿Cómo está el negocio hoy?"

---

### INDICADORES DE OPERACIÓN DIARIA

**OTs activas:** cuántas órdenes están abiertas en este momento. Desglosadas por estado: cuántas en diagnóstico, cuántas esperando aprobación, cuántas en trabajo, cuántas listas para entrega.

**OTs entregadas hoy:** cuántas se cerraron y entregaron hoy.

**OTs ingresadas hoy:** flujo de entrada.

**Vehículos esperando más de X días:** alerta inmediata de OTs que se están alargando. Un vehículo que lleva 5 días en el taller siendo que debía estar en 1 día necesita atención urgente.

**Presupuestos pendientes de aprobación:** cuántos presupuestos enviados al cliente no tienen respuesta. Con tiempo de espera: "3 presupuestos llevan más de 48 horas sin respuesta."

---

### INDICADORES FINANCIEROS

**Ingresos del día:** suma de todas las OTs cobradas hoy.

**Ingresos del mes vs mes anterior vs mismo mes año anterior:** tendencia.

**Ticket promedio:** ingreso promedio por OT del mes.

**Desglose por tipo de servicio:** qué porcentaje de los ingresos viene de mantención preventiva, cuánto de reparación, cuánto de diagnóstico, etc.

**Desglose por tipo de financiamiento:** cuánto es efectivo contado, cuánto es empresa, cuánto es seguro.

**Cuentas por cobrar:** total adeudado por clientes con crédito. Desglosado por antigüedad: menos de 30 días / entre 30 y 60 días / más de 60 días (urgente).

---

### INDICADORES DE PRODUCTIVIDAD

**Eficiencia de mano de obra:** horas facturadas vs horas disponibles. Si el taller tiene 3 mecánicos y cada uno trabaja 8 horas, hay 24 horas disponibles por día. Si se facturaron 18 horas, la eficiencia es 75%.

**Eficiencia por mecánico:** mismo indicador pero individual. Identifica a los más y menos productivos.

**Horas estándar vs horas reales por trabajo:** si un trabajo que debería tomar 2 horas está tomando sistemáticamente 3, hay un problema de entrenamiento, de herramientas, o el estándar está mal definido.

**OTs completadas a tiempo:** porcentaje de OTs entregadas en o antes de la fecha prometida.

---

### INDICADORES DE CATÁLOGO E INVENTARIO

**Servicios más realizados del mes:** top 10 de servicios por frecuencia.

**Servicios más rentables del mes:** top 10 por margen.

**Repuestos con stock bajo mínimo:** alerta inmediata.

**Repuestos con movimiento cero en los últimos 90 días:** inventario parado, posible obsolescencia.

**Rotación de inventario:** qué tan rápido se convierte el inventario en dinero.

---

### INDICADORES DE CALIDAD Y GARANTÍAS

**Garantías activadas en el mes:** cuántos clientes volvieron con un reclamo. Si este número sube, hay un problema de calidad.

**Costo de garantías:** cuánto le costó al taller resolver garantías este mes.

**Reclamaciones resueltas en la primera visita:** indicador de efectividad de la respuesta de garantía.

---

### INDICADORES DE CLIENTES

**Nuevos clientes del mes:** cuántos vehículos llegaron por primera vez.

**Clientes recurrentes del mes:** cuántos son clientes que ya habían venido antes.

**Tasa de retención:** porcentaje de clientes que vuelven al año.

**NPS (Net Promoter Score):** si se implementa una encuesta post-entrega, ¿cuántos clientes recomendarían el taller?

---

## FASE 12 — DOCUMENTO MAESTRO

### Manual funcional operativo del ERP All Motors

---

#### INTRODUCCIÓN

All Motors ERP es el sistema de gestión del Taller Mecánico All Motors en Chillán Viejo. Su propósito es digitalizar y sistematizar todas las operaciones del taller, desde que un vehículo entra al recinto hasta que sale con el trabajo completo y el cliente satisfecho.

El sistema está diseñado para funcionar en el contexto real de un taller mecánico chileno: facturación electrónica vía SII, clientes particulares y empresariales, seguros, garantías, y la cultura del servicio al cliente del sur de Chile.

El ERP no reemplaza al equipo humano. Lo potencia. La recepcionista sigue siendo quien recibe al cliente. El mecánico sigue siendo quien hace el trabajo. El sistema elimina el papel, los cuadernos, las planillas de Excel y los "a ver cómo quedó el vehículo de don Mario". Todo está en un lugar, accesible para quien lo necesita, en tiempo real.

---

#### PRINCIPIOS FUNDAMENTALES

**1. El vehículo como unidad de historia**
Todo gira alrededor del vehículo y su historia técnica. Un cliente puede cambiar de teléfono, de nombre, de empresa. El vehículo siempre tiene la misma patente. Su historia no se pierde nunca.

**2. El registro protege**
Todo lo que ocurre queda registrado: cada diagnóstico, cada trabajo aprobado y rechazado, cada comunicación con el cliente, cada repuesto instalado. Este registro protege al taller ante reclamaciones y le da al cliente la tranquilidad de que hay profesionalismo detrás.

**3. La información llega al que la necesita**
El mecánico no necesita ver los precios. El cliente no necesita ver los costos internos. El contador no necesita ver los diagnósticos técnicos. Cada rol tiene su vista, con la información relevante para ese rol.

**4. Sin papel**
Todo documento (presupuesto, orden de recepción, garantía, factura) existe en el sistema y puede enviarse digitalmente. El cliente no necesita guardar un papel. El taller no necesita archivar carpetas.

**5. El cliente siempre informado**
El cliente nunca debería tener que llamar para saber en qué está su vehículo. El sistema lo informa automáticamente en los momentos clave: ingreso confirmado, diagnóstico listo, presupuesto enviado, trabajo aprobado, vehículo listo para retiro.

---

#### LA JORNADA TÍPICA DEL TALLER

**7:30 — Apertura**
El jefe de taller revisa el panel del día: qué OTs están activas, qué vehículos siguen del día anterior, qué citas están programadas. Asigna los trabajos a los mecánicos según prioridad y complejidad.

El bodeguero verifica las alertas de stock y revisa si hay pedidos que debían llegar hoy.

**8:00 — Primera recepción**
La recepcionista atiende al primer cliente. Escribe la patente. El sistema carga el historial del vehículo. Confirma el propietario. Captura el motivo. Revisa el estado del vehículo, toma fotos. El cliente firma la orden de recepción en el tablet. Recibe un mensaje automático confirmando el ingreso.

**10:00 — Diagnóstico en paralelo**
Los mecánicos están trabajando en varios vehículos. Para cada uno, registran sus hallazgos en el tablet del taller. Para el que necesita trabajo adicional, el sistema notifica al recepcionista que hay un presupuesto complementario para enviar al cliente.

**11:30 — Aprobaciones**
El recepcionista llama a los clientes cuyos presupuestos llevan más de 24 horas sin respuesta. El sistema le muestra la lista con el tiempo de espera. Si no hay respuesta, envía un recordatorio automático.

**14:00 — Compra de repuesto urgente**
Un mecánico necesita una correa que no hay en stock. El bodeguero genera una solicitud de compra urgente. El administrador la aprueba con un clic. Se llama al proveedor. El repuesto llega a las 16:00.

**17:00 — Entregas de la tarde**
Tres vehículos están listos. El jefe de taller completó el control de calidad. El sistema notificó a los clientes a las 15:00. Dos ya están en camino. El recepcionista prepara los documentos de entrega, genera las boletas, cobra. Los clientes reciben el PDF de la boleta por correo antes de salir del taller.

**18:00 — Cierre**
El administrador revisa el resumen del día: 8 OTs cerradas, ingreso de $1.240.000, 2 cuentas por cobrar a empresa, 1 garantía gestionada sin costo. Compara con el miércoles de la semana anterior. Todo bien.

---

#### FLUJOS DE LOS CASOS DE NEGOCIO MÁS COMUNES

**Caso 1 — Mantención preventiva (el pan de cada día)**

Don Jorge llega con su Toyota Corolla para el cambio de aceite de los 30.000 km.

1. Recepcionista escribe la patente. El sistema muestra que es la segunda vez que viene, el último trabajo fue hace 8 meses (15.000 km).
2. Don Jorge es particular. Paga en efectivo. Sin empresa, sin seguro.
3. Motivo: "cambio de aceite y revisión general".
4. El sistema sugiere automáticamente la plantilla "Mantención 30.000 km" que incluye: aceite 5W-30 4L, filtro aceite, filtro aire, inspección 30 puntos.
5. El recepcionista confirma con don Jorge los ítems del paquete. Don Jorge pregunta si le pueden revisar los frenos también. Se agrega "revisión de frenos" al listado.
6. El sistema genera un presupuesto estimado: $95.000. Don Jorge aprueba en el mostrador.
7. La OT queda asignada al mecánico Pedro.
8. Pedro trabaja el vehículo. Encuentra que las pastillas traseras están al límite. Registra el hallazgo con foto. El sistema notifica al recepcionista.
9. El recepcionista llama a don Jorge: "Don Jorge, le encontramos las pastillas traseras casi al límite. Le conviene cambiarlas ahora que está el vehículo aquí. Son $45.000 adicionales." Don Jorge acepta.
10. El presupuesto adicional queda aprobado. Pedro instala las pastillas.
11. Control de calidad: jefe de taller revisa. Todo OK.
12. Sistema envía mensaje a don Jorge: "Tu vehículo está listo para retiro. Total a pagar: $140.000."
13. Don Jorge llega, recepcionista explica los trabajos. Paga en efectivo. Se emite boleta electrónica. Don Jorge recibe el PDF.
14. Garantía creada automáticamente: mano de obra 3 meses, pastillas de freno 6 meses.

**Caso 2 — Reparación con seguro**

Doña Carmen trae su Nissan March que chocó con una berma. Tiene seguro con HDI.

1. Recepcionista escribe la patente. Primera vez en el taller.
2. Tipo de financiamiento: seguro. Aseguradora: HDI. Número de siniestro: HDI-2026-88321.
3. Motivo: "choque de frente con berma, daño en frente y sistema de dirección".
4. OT creada. El taller coordina con HDI para que manden al perito.
5. El perito visita al día siguiente. Aprueba: reparación de parachoque, capó y revisión de dirección. Monto aprobado por el perito: $850.000.
6. El taller trabaja dentro del presupuesto aprobado por el perito.
7. Durante el trabajo encuentran que el radiador tiene una pequeña fisura producto del impacto. No estaba en el presupuesto del perito. El taller solicita ampliación a HDI. HDI aprueba $120.000 adicional.
8. Trabajo completado. Vehículo listo.
9. Doña Carmen retira, paga el deducible de $50.000 en efectivo.
10. El taller emite factura a HDI por $920.000 con el número de siniestro. Queda como cuenta por cobrar.
11. HDI paga en 20 días. El sistema marca la factura como cobrada.

**Caso 3 — Reclamo de garantía**

Don Rodrigo vuelve 2 meses después. Le cambió la batería hace 2 meses y el auto no parte.

1. Recepcionista escribe la patente. El sistema muestra inmediatamente: "Tiene garantía vigente: Batería instalada el 15-04-2026, garantía hasta 15-04-2027."
2. Se abre una OT de garantía vinculada a la OT original.
3. El mecánico revisa. Confirma que la batería está defectuosa (no debería estar así en solo 2 meses).
4. Se reemplaza la batería. Sin cobro a don Rodrigo.
5. El sistema vincula la batería defectuosa con el proveedor y la factura de compra. El bodeguero gestiona la devolución al proveedor (la batería tenía garantía del fabricante).
6. La OT de garantía se cierra. El costo fue recuperado del proveedor.

---

## FASE 13 — REVISIÓN CRÍTICA

### Análisis del documento: ¿qué simplificar?

---

### DUPLICIDADES ENCONTRADAS Y RESUELTAS

**Diagnóstico en dos momentos:** el documento describe un "diagnóstico inicial" y un "diagnóstico profundo durante el trabajo" como si fueran cosas distintas. En realidad, son la misma sección de la OT que se va completando. No hay dos secciones de diagnóstico; hay una sola que el mecánico va enriqueciendo. Simplificado en el modelo final.

**Responsable económico vs conductor vs propietario:** estos tres conceptos aparecen en múltiples secciones. La distinción es real y necesaria, pero debe explicarse una vez y referenciarse después. En el documento quedó explicado en la sección de Actores y en la Recepción, sin repetirse en detalle en cada sección posterior.

**Catálogo de servicios y plantillas de trabajo:** en la FASE 5 se mencionan "paquetes" como una categoría del catálogo. Un paquete es esencialmente una plantilla con precio fijo. No necesitan ser dos conceptos separados en la interfaz del usuario; el recepcionista ve "paquetes" y el sistema internamente los gestiona como plantillas.

---

### COMPLEJIDAD INNECESARIA ELIMINADA

**Lotes y series en inventario:** se mencionó como característica del inventario. Para el 99% de los repuestos de un taller mecánico, el número de lote no importa. Solo importa para piezas de seguridad crítica en talleres certificados (airbags, frenos ABS en garantías de fábrica). Para el estado actual de All Motors, esta funcionalidad es post-implementación.

**Múltiples almacenes:** si el taller tiene una sola bodega (lo más común en un taller pequeño), no necesita gestión de múltiples ubicaciones de bodega. La funcionalidad de "ubicación en bodega" (estante, cajón) es un campo libre descriptivo, no una entidad del sistema.

**NPS y encuestas:** la funcionalidad de NPS (encuesta de satisfacción) es valiosa a largo plazo pero no debe estar en la primera versión del ERP. El seguimiento post-entrega puede ser simplemente un mensaje de WhatsApp automático; no necesita ser un sistema de encuestas complejo.

**Campañas de CRM:** para la fase actual del negocio, las "campañas" son simplemente filtrar clientes y enviar un mensaje. No se necesita un módulo de marketing automation completo. Un botón "enviar recordatorio a estos clientes" es suficiente.

**Portal del cliente:** la funcionalidad de portal donde el cliente ve su estado, aprueba digitalmente y paga online es deseable pero no es bloqueante. La versión mínima viable es que el recepcionista le muestra el presupuesto en pantalla y el cliente aprueba de palabra, o recibe un link simple por WhatsApp.

---

### PROCESOS REDUNDANTES ELIMINADOS

**Doble aprobación de compras:** se mencionó que el administrador aprueba órdenes de compra y también que el bodeguero genera solicitudes. En un taller pequeño, no necesita haber dos pasos de aprobación para compras menores. Propuesta simplificada: compras menores a cierto monto se aprueban automáticamente; solo las compras grandes requieren aprobación explícita del administrador.

**Control de calidad como etapa separada vs como checklist en la OT:** no necesita ser una pantalla o módulo separado. Es simplemente el último paso de la OT antes de marcarla como "lista para entrega": completar el checklist y confirmar.

---

### MÓDULOS FALTANTES QUE SE DEBEN AGREGAR

**Estadía de vehículos:** si un vehículo está listo pero el cliente no pasa a buscarlo en X días, el taller puede cobrar estadía. Este proceso no fue descrito. Necesita: alerta cuando un vehículo lleva más de 3 días listo sin retiro, un cargo configurable por día, y comunicación al cliente.

**Subcontratos y terceros:** cuando el taller envía un trabajo a otro especialista (sandblasting, pintado, torno, etc.), ese tercero emite una factura al taller. El taller cobra ese costo al cliente con su margen. Este proceso debe ser explícito en la OT: un ítem de tipo "subcontrato" que vincula la factura del tercero con el cargo al cliente.

**Checklist de recepción configurable:** el checklist de 30 puntos que se revisa al ingresar un vehículo (luces, presión, niveles, frenos) debe ser configurable por el jefe de taller, no fijo en el sistema.

**Siniestros sin perito previo:** en algunos casos de seguro, el taller trabaja sin perito y luego la aseguradora reembolsa. El proceso de "sin perito previo" debe estar documentado como variante del flujo de seguro.

---

### FLUJOS INCONSISTENTES CORREGIDOS

**"El mecánico no puede comunicarse con el cliente":** se estableció que el mecánico no se comunica directamente con el cliente a través del sistema (eso lo hace el recepcionista). Sin embargo, en la práctica, el mecánico a veces necesita hablar con el cliente para describir una falla técnica compleja. La regla correcta es: el mecánico no inicia comunicaciones, pero puede participar en ellas cuando el recepcionista o jefe de taller lo considera necesario.

**Aprobación de trabajo adicional:** se describió el proceso pero no se aclaró quién puede aprobar un trabajo adicional cuando el monto es mayor que un umbral. Propuesta: bajo $50.000 puede aprobarlo el recepcionista; sobre $50.000 requiere que el jefe de taller revise el diagnóstico antes de enviarlo al cliente.

**Cierre de OT vs cierre de factura:** una OT puede estar "entregada" pero la factura puede estar pendiente (en el caso de empresa con crédito). El estado "cerrada" de una OT debería ser independiente del estado del pago. La OT se cierra cuando el trabajo está entregado; el cobro tiene su propio ciclo.

---

### PROPUESTAS DEMASIADO COMPLEJAS — SIMPLIFICADAS

**Sistema de versiones del catálogo:** se mencionó "versionado" del catálogo. Mantener un historial de versiones de cada precio en el catálogo es complejo de implementar y de bajo valor operativo. Suficiente con registrar fecha de última modificación y precio anterior para comparar.

**Comparativo de presupuesto (reparar vs reemplazar):** el presupuesto con dos columnas de alternativas es deseable pero complejo de implementar bien en la interfaz. Por ahora: el recepcionista puede incluir una nota textual explicando las alternativas y el cliente decide antes de que se genere el presupuesto formal.

**Garantía diferenciada por kilómetro:** la garantía que vence "por meses o por kilómetros, lo que ocurra primero" requiere que el sistema rastree el kilometraje del vehículo en cada visita. Esto es posible (el kilometraje se captura en cada recepción) pero el cálculo proyectivo de kilómetros a futuro es complejo. Versión simplificada: la garantía vence por meses solamente. Si el cliente ha hecho un uso extraordinario del vehículo (corredor de rally, chofer de taxi), el taller evalúa caso a caso.

---

### PRIORIZACIÓN — QUÉ VIENE PRIMERO

**Núcleo que debe funcionar en el primer día de operación:**
1. Recepción de vehículos (crear OT con datos básicos)
2. Gestión de estados de OT
3. Presupuesto básico con catálogo
4. Registro de cobro y emisión de boleta/factura electrónica
5. Historial del vehículo

**Segundo nivel (primeros 3 meses):**
6. Catálogo completo con paquetes
7. Inventario básico con alertas de stock
8. Gestión de garantías
9. Comunicaciones automáticas al cliente (mensajes de estado)
10. Dashboard básico con KPIs del día

**Tercer nivel (después de los 6 meses):**
11. Portal del cliente
12. CRM completo con recordatorios automáticos
13. Reportes de rentabilidad avanzados
14. Integración con WhatsApp Business API
15. Módulo de subcontratos

**Post-implementación:**
16. Aplicación móvil para mecánicos (tablet en el taller)
17. Integración directa con SII para DTE
18. Compras automatizadas a proveedores
19. Sistema de comisiones para mecánicos
20. Gestión de múltiples sucursales

---

### RESUMEN EJECUTIVO DEL DOCUMENTO

All Motors ERP es el sistema que convierte al taller en una operación digital, trazable y profesional. Cada vehículo que entra tiene una historia que se escribe en tiempo real: quién lo trajo, qué tenía, qué se hizo, cuánto costó, qué garantía tiene.

El sistema sirve a ocho tipos de usuarios distintos: el dueño que necesita ver el negocio completo, el recepcionista que necesita ser rápido y preciso, el mecánico que necesita instrucciones claras sin burocracia, el cliente que necesita estar informado sin tener que llamar.

El modelo de datos central es simple: un **vehículo** tiene una **historia técnica** que acumula **eventos**, el más importante de los cuales es la **OT** (Orden de Trabajo). La OT tiene un **responsable económico** (quien paga) y ejecuta **trabajos** del **catálogo** usando **repuestos** del **inventario**.

Todo lo demás — presupuestos, facturas, garantías, CRM, dashboard — son extensiones de este núcleo simple.

El taller más organizado no es necesariamente el más grande. Es el que puede responder en cualquier momento: "¿En qué está el vehículo del señor Rodríguez?" "¿Cuánto hemos facturado este mes?" "¿Qué le hicimos al Hilux patente BJKW45 hace dos años?" — y obtener la respuesta en 5 segundos.

Ese es el ERP que estamos construyendo.

---

*Fin del Documento Maestro Funcional — All Motors ERP v1.0*
*Preparado para revisión por el equipo All Motors — 2026-06-30*
