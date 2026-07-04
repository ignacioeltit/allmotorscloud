-- ============================================================
-- Migration 029 — Estado de compra de los repuestos de una OT
--
-- Flujo de abastecimiento (2026-07-04, Ignacio): un repuesto de la OT puede
-- estar en el taller o haber que conseguirlo (por comprar, a pedido, comprado y
-- en camino desde Mercado Libre / proveedor / importación, o ya recibido). Se
-- envía al encargado de compras una "orden de compra" con el vehículo + los
-- repuestos a comprar; al volver, se ingresa el costo de cada uno.
--
-- estado_compra: solo aplica a items_reparacion.tipo='repuesto'.
--   disponible  → está en el taller / stock (default)
--   por_comprar → hay que conseguirlo (va a la orden de compra)
--   comprado    → comprado, en camino (el detalle va en nota_compra)
--   recibido    → llegó al taller
-- nota_compra: texto libre (Mercado Libre, importación, proveedor, N° pedido…).
-- El costo de compra ya existe: items_reparacion.costo_compra_unitario (M009).
-- ============================================================

ALTER TABLE items_reparacion
  ADD COLUMN IF NOT EXISTS estado_compra TEXT NOT NULL DEFAULT 'disponible',
  ADD COLUMN IF NOT EXISTS nota_compra   TEXT;

ALTER TABLE items_reparacion
  ADD CONSTRAINT chk_items_reparacion_estado_compra
    CHECK (estado_compra IN ('disponible', 'por_comprar', 'comprado', 'recibido'));

CREATE INDEX IF NOT EXISTS idx_items_reparacion_por_comprar
  ON items_reparacion (reparacion_id)
  WHERE estado_compra IN ('por_comprar', 'comprado') AND eliminado_en IS NULL;
