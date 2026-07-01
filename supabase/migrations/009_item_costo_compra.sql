-- 009_item_costo_compra.sql
-- Agrega costo de compra unitario a items_reparacion para calcular utilidad por OT.
-- Solo aplica a tipo='repuesto'. Para mano_obra se puede derivar del valor_hora_snapshot.
-- Nullable: retrocompatible con ítems existentes (pre-M009).

ALTER TABLE items_reparacion
  ADD COLUMN IF NOT EXISTS costo_compra_unitario NUMERIC(12,2)
    CONSTRAINT chk_items_costo_compra CHECK (costo_compra_unitario IS NULL OR costo_compra_unitario >= 0);
