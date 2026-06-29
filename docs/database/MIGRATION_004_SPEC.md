# Migration 004 — Inventory Core

**Estado:** SPEC — pendiente de aprobación  
**Dependencias:** 001, 002, 003  
**Spec autor:** Sprint 7 / Junio 2026  

---

## Contexto

Migration 003 dejó dos FK diferidas sin tabla de destino:

- `items_presupuesto.repuesto_id UUID` — sin FK activa
- `items_reparacion.repuesto_id UUID` — sin FK activa

El comentario explícito en ambas columnas: `-- FK diferida → repuestos.id (Migration 004)`

Esta migración crea las tablas de inventario y activa esas FK.

---

## Tablas a crear

### 1. `repuestos` — Catálogo de repuestos / materiales

Per-tenant. Soft-delete. Audit trigger. set_updated_at.

```sql
CREATE TABLE repuestos (
  id              UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID          NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  sucursal_id     UUID                   REFERENCES sucursales(id)     ON DELETE SET NULL,
  codigo          TEXT          NOT NULL,
  nombre          TEXT          NOT NULL,
  descripcion     TEXT,
  unidad          TEXT          NOT NULL DEFAULT 'unidad',
  precio_costo    NUMERIC(12,2),
  precio_venta    NUMERIC(12,2),
  stock_actual    NUMERIC(10,3) NOT NULL DEFAULT 0,
  stock_minimo    NUMERIC(10,3) NOT NULL DEFAULT 0,
  ubicacion       TEXT,
  proveedor       TEXT,
  activo          BOOLEAN       NOT NULL DEFAULT true,
  creado_en       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  creado_por      UUID          NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  eliminado_en    TIMESTAMPTZ,
  eliminado_por   UUID                   REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT uq_repuestos_org_codigo UNIQUE (org_id, codigo)
);
```

**Campos clave:**
- `codigo` — SKU / código interno del taller (UNIQUE por tenant)
- `unidad` — 'unidad', 'litro', 'metro', 'kg', 'par', etc.
- `stock_actual` — cantidad disponible (actualizado por `movimientos_stock`)
- `stock_minimo` — alerta de reposición si `stock_actual < stock_minimo`
- `precio_costo` — precio de compra (puede ser null si no se gestiona)
- `precio_venta` — precio sugerido para presupuestos

**Índices:**
- `(org_id, activo)` WHERE eliminado_en IS NULL — listado de catálogo
- `(org_id, nombre gin_trgm)` — búsqueda por nombre
- GIN sobre `codigo` — búsqueda exacta por código

**RLS:**
- SELECT: todos los roles autenticados del tenant
- INSERT/UPDATE: admin, jefe_taller, recepcionista
- (mecanico puede SELECT para usar en ítems, pero no modificar el catálogo)

---

### 2. `movimientos_stock` — Historial de entradas y salidas de inventario

Per-tenant. SIN eliminado_en (historial contable inmutable). SIN actualizado_en.

```sql
CREATE TABLE movimientos_stock (
  id              UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID          NOT NULL REFERENCES organizaciones(id)  ON DELETE RESTRICT,
  repuesto_id     UUID          NOT NULL REFERENCES repuestos(id)        ON DELETE RESTRICT,
  tipo            TEXT          NOT NULL,
  cantidad        NUMERIC(10,3) NOT NULL,
  stock_antes     NUMERIC(10,3) NOT NULL,
  stock_despues   NUMERIC(10,3) NOT NULL,
  referencia_tipo TEXT,
  referencia_id   UUID,
  notas           TEXT,
  creado_en       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  creado_por      UUID          NOT NULL REFERENCES usuarios(id)         ON DELETE RESTRICT,
  CONSTRAINT chk_mov_tipo
    CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'devolucion')),
  CONSTRAINT chk_mov_cantidad
    CHECK (cantidad > 0)
);
```

**Campos clave:**
- `tipo`: 'entrada' (compra), 'salida' (uso en reparación), 'ajuste' (inventario), 'devolucion'
- `cantidad` — siempre positivo (el tipo determina si suma o resta)
- `stock_antes` / `stock_despues` — snapshot de stock para auditoría
- `referencia_tipo` + `referencia_id` — ej: ('items_reparacion', item_id) para trazabilidad
- La actualización de `repuestos.stock_actual` se hace via trigger AFTER INSERT

**Trigger propuesto:** `fn_actualizar_stock_repuesto`
```sql
-- AFTER INSERT en movimientos_stock
-- Actualiza repuestos.stock_actual según tipo:
--   entrada/devolucion → stock_actual + cantidad
--   salida/ajuste      → stock_actual - cantidad (no puede quedar negativo)
```

**Índices:**
- `(repuesto_id, creado_en DESC)` — historial de movimientos por repuesto
- `(org_id, creado_en DESC)` — feed de actividad del almacén
- `(referencia_tipo, referencia_id)` WHERE referencia_id IS NOT NULL — trazabilidad

**RLS:**
- SELECT: todos los roles del tenant
- INSERT: admin, jefe_taller, recepcionista (mecanico solo si genera salida desde ítem)

---

## FK diferidas a activar

```sql
-- items_presupuesto
ALTER TABLE items_presupuesto
  ADD CONSTRAINT fk_items_presupuesto_repuesto_id
    FOREIGN KEY (repuesto_id) REFERENCES repuestos(id) ON DELETE SET NULL;

-- items_reparacion
ALTER TABLE items_reparacion
  ADD CONSTRAINT fk_items_reparacion_repuesto_id
    FOREIGN KEY (repuesto_id) REFERENCES repuestos(id) ON DELETE SET NULL;
```

---

## Notas de implementación

- El índice FK diferido `idx_items_presupuesto_repuesto` y `idx_items_reparacion_repuesto` ya existen en Migration 003 (previstos para esta migración).
- `ON DELETE SET NULL` en las FK es deliberado: si se elimina un repuesto del catálogo, los ítems históricos conservan su descripción de texto pero pierden la referencia al catálogo.
- `movimientos_stock.stock_antes/despues` son DENORMALIZADOS (snapshot): permiten reconstruir el historial sin recorrer toda la tabla.
- La actualización de stock en `repuestos.stock_actual` DEBE ir en un trigger AFTER INSERT (no en la aplicación) para garantizar consistencia bajo concurrencia.
- La vista `v_repuestos_bajo_stock` (sugerida para alertas) = SELECT WHERE stock_actual < stock_minimo AND activo = true.

---

## Verificaciones post-migración

```sql
-- 1. Las FK están activas
SELECT conname FROM pg_constraint WHERE conrelid = 'items_reparacion'::regclass AND contype = 'f';
-- debe incluir fk_items_reparacion_repuesto_id

-- 2. El trigger de stock existe
SELECT tgname FROM pg_trigger WHERE tgrelid = 'movimientos_stock'::regclass;

-- 3. RLS habilitado
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('repuestos', 'movimientos_stock');
```

---

## Deferred to Migration 005+

- `proveedores` / `ordenes_compra` — gestión de compras a proveedores
- `precios_especiales` — descuentos por cliente o vehículo
- `v_items_reparacion_mecanico` — vista sin columnas financieras (NOTA DT-1 de Migration 003)
