# Use Cases — Administración

**Área:** 11 | **Casos:** UC-A01 a UC-A05 | **MVP:** 2/5  
← [USE_CASE_MODEL.md — Índice maestro](../USE_CASE_MODEL.md)

---

### UC-A01 · Administrar Usuarios
**Actor:** Administrador | **Disparador:** Alta, modificación o baja de una persona con acceso al sistema.
**Pre:** Empresa/taller configurado.
**Flujo:** 1) Crear usuario con email y rol 2) Asignar sucursal(es) accesibles 3) El sistema envía invitación 4) Usuario activa su cuenta
**Alt/Ex:** Suspender usuario → acceso bloqueado, registros históricos intactos. No se elimina a un usuario, se desactiva.
**Historia Técnica:** No aplica directamente. Los registros del usuario en Historias Técnicas previas permanecen.
**Reglas:** Un usuario desactivado no puede acceder, pero sus acciones históricas permanecen intactas y atribuidas.
**Resultado:** Usuario activo o inactivo con rol correcto. · **MVP**

---

### UC-A02 · Administrar Sucursales
**Actor:** Administrador | **Disparador:** Apertura, modificación o cierre de una sucursal.
**Pre:** Empresa registrada.
**Flujo:** 1) Crear sucursal con nombre, dirección y datos de contacto 2) Asignar usuarios a la sucursal 3) Configurar inventario inicial
**Alt/Ex:** Cierre de sucursal → vehículos e historiales de esa sucursal permanecen accesibles.
**Historia Técnica:** No aplica directamente.
**Reglas:** Cada sucursal tiene su propio inventario y equipo.
**Resultado:** Sucursal operativa y con usuarios asignados. · **V1**

---

### UC-A03 · Administrar Permisos
**Actor:** Administrador | **Disparador:** Necesidad de ajustar qué puede hacer un rol.
**Pre:** Roles configurados.
**Flujo:** 1) Seleccionar rol 2) Activar o desactivar permisos específicos 3) Guardar y aplicar inmediatamente
**Alt/Ex:** Cambio individual (no de todo el rol) → crear un rol nuevo específico para ese usuario.
**Historia Técnica:** No aplica.
**Reglas:** Cambios de permisos aplican a todos los usuarios del rol. Para cambios individuales, crear un rol nuevo.
**Resultado:** Permisos del rol actualizados. · **V1**

---

### UC-A04 · Administrar Inventario
**Actor:** Administrador | **Disparador:** Ingreso, ajuste o baja de repuestos o materiales.
**Pre:** Sucursal configurada.
**Flujo:** 1) Agregar o buscar el repuesto 2) Registrar cantidad actual y stock mínimo 3) Cualquier cambio genera un Movimiento de Stock con responsable y motivo
**Alt/Ex:** Stock bajo el mínimo → alerta automática al administrador.
**Historia Técnica:** Los repuestos usados en reparaciones se descontarán del inventario automáticamente al registrar la mano de obra.
**Reglas:** Todo movimiento de inventario tiene un responsable y un motivo. No existen ajustes anónimos.
**Resultado:** Inventario actualizado con trazabilidad completa. · **V1**

---

### UC-A05 · Administrar Proveedores
**Actor:** Administrador | **Disparador:** Alta o modificación de proveedor.
**Pre:** Ninguna.
**Flujo:** 1) Registrar nombre, RUT, contacto y condiciones de pago 2) Asociar qué repuestos suministra 3) Registrar tiempo de entrega habitual
**Alt/Ex:** Proveedor sin RUT (informal) → registrar con identificador interno.
**Historia Técnica:** No aplica.
**Reglas:** Un repuesto puede tener múltiples proveedores. El precio se registra por compra, no como precio fijo del proveedor.
**Resultado:** Proveedor disponible para órdenes de compra. · **V1**
