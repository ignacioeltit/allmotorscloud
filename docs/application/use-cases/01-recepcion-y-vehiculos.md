# Use Cases — Recepción y Vehículos

**Área:** 01 | **Casos:** UC-R01 a UC-R07 | **MVP:** 7/7  
← [USE_CASE_MODEL.md — Índice maestro](../USE_CASE_MODEL.md)

---

### UC-R01 · Crear Cliente
**Actor:** Recepcionista | **Disparador:** Se recibe un vehículo cuyo cliente no existe en el sistema.
**Pre:** Ninguna.
**Flujo:** 1) Ingresar nombre o RUT para verificar duplicado 2) Completar datos (nombre, RUT, teléfono, email) 3) Confirmar creación
**Alt/Ex:** RUT ya existe → mostrar cliente existente para verificar. Empresa como cliente → capturar razón social y RUT empresa.
**Historia Técnica:** No genera registro. Crea la entidad Cliente disponible para asociar vehículos.
**Reglas:** No crear duplicados por RUT. El RUT es único por empresa/taller.
**Resultado:** Cliente disponible en el sistema. · **MVP**

---

### UC-R02 · Crear Vehículo
**Actor:** Recepcionista | **Disparador:** Se recibe un vehículo que no existe en el sistema.
**Pre:** Cliente existente o creación simultánea.
**Flujo:** 1) Verificar que la patente no existe 2) Ingresar patente, VIN, marca, modelo, año, color, tipo 3) Asociar al propietario actual
**Alt/Ex:** Patente ya existe → mostrar vehículo existente para verificar. VIN no disponible → campo opcional.
**Historia Técnica:** Se crea la Historia Técnica del Vehículo (vacía, lista para recibir registros).
**Reglas:** La patente es el identificador único del vehículo. Una Historia Técnica se crea una sola vez.
**Resultado:** Vehículo registrado. Historia Técnica iniciada. · **MVP**

---

### UC-R03 · Registrar Propietario
**Actor:** Recepcionista | **Disparador:** Se confirma o cambia el dueño legal de un vehículo.
**Pre:** Vehículo y cliente existentes.
**Flujo:** 1) Seleccionar vehículo 2) Seleccionar cliente como nuevo propietario 3) Registrar fecha de inicio de propiedad
**Alt/Ex:** Propietario anterior diferente → el historial previo permanece intacto y visible para el taller.
**Historia Técnica:** Registro de cambio de propietario (sin alterar registros anteriores).
**Reglas:** La Historia Técnica del vehículo nunca se transfiere ni se borra al cambiar de propietario.
**Resultado:** Propietario actual actualizado. Historial previo preservado. · **MVP**

---

### UC-R04 · Registrar Conductor
**Actor:** Recepcionista | **Disparador:** La persona que trae el vehículo es distinta del propietario.
**Pre:** Vehículo existente y visita activa (recepción abierta).
**Flujo:** 1) Indicar que el conductor es diferente al propietario 2) Ingresar nombre y teléfono del conductor 3) Asociar al registro de la visita actual
**Alt/Ex:** Conductor ya visitó antes → búsqueda por teléfono para evitar reingreso de datos.
**Historia Técnica:** El conductor queda registrado en el evento de Recepción de esta visita.
**Reglas:** El conductor no reemplaza al propietario. Su rol es solo de contacto durante la visita.
**Resultado:** Conductor registrado como contacto de la visita. · **MVP**

---

### UC-R05 · Recibir Vehículo
**Actor:** Recepcionista | **Disparador:** El vehículo llega físicamente al taller.
**Pre:** Cliente y vehículo pueden ser nuevos (se crean en este mismo flujo).
**Flujo:** 1) Buscar patente 2) Crear vehículo/cliente si son nuevos 3) Registrar km y nivel de combustible 4) Fotografiar vehículo (mínimo 4 ángulos) 5) Capturar descripción del problema en palabras del cliente 6) Obtener firma del cliente en documento de recepción
**Alt/Ex:** Conductor ≠ propietario → UC-R04. Sin firma digital → capturar foto de firma física.
**Historia Técnica:** Registro de Recepción. Evidencias: fotos de ingreso + firma. Abre Orden de Trabajo.
**Reglas:** Patente es la llave de entrada al sistema. Sin firma, OT queda en estado "Pendiente validación".
**Resultado:** Vehículo ingresado. OT abierta. Historia Técnica actualizada. · **MVP**

---

### UC-R06 · Realizar Check-In
**Actor:** Recepcionista / Jefe de Taller | **Disparador:** El vehículo pasa del área de recepción al área de trabajo del taller.
**Pre:** UC-R05 completado. OT abierta.
**Flujo:** 1) Confirmar ingreso físico al taller 2) Registrar hora exacta de entrada 3) Indicar mecánico asignado o dejarlo pendiente 4) Definir prioridad de atención
**Alt/Ex:** Sin mecánico disponible → vehículo queda en estado "En espera de asignación".
**Historia Técnica:** Registro de Check-In con hora exacta y responsable.
**Reglas:** El check-in es el punto de inicio del tiempo de permanencia del vehículo en el taller. Afecta los reportes de tiempo.
**Resultado:** Vehículo dentro del taller. Hora de ingreso registrada. · **MVP**

---

### UC-R07 · Realizar Triaging
**Actor:** Jefe de Taller / Mecánico designado | **Disparador:** Vehículo con problema complejo o múltiples síntomas requiere evaluación previa antes de diagnóstico formal.
**Pre:** UC-R06 completado.
**Flujo:** 1) Evaluación rápida visual/auditiva del vehículo 2) Determinar si procede diagnóstico completo, escaneo, o derivación 3) Registrar observaciones del triaging 4) Asignar tipo de diagnóstico que corresponde
**Alt/Ex:** Problema evidente sin triaging necesario → registrar directamente diagnóstico (UC-D01).
**Historia Técnica:** Registro de Triaging con observaciones y decisión tomada.
**Reglas:** El triaging no reemplaza el diagnóstico. Solo define la ruta de atención.
**Resultado:** Vehículo con ruta de diagnóstico definida y registrada. · **MVP**
