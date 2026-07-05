-- 032 — Código (SKU / código de catálogo) en las líneas de presupuesto y OT.
--
-- Muchos repuestos y servicios del catálogo tienen `codigo`. Guardarlo en cada
-- línea permite (a) identificar el ítem después (en la OT, presupuesto y
-- documentos) y (b) cargarlo rápido buscando por código. Es un dato snapshot:
-- el código con que se cargó, aunque el catálogo cambie.

ALTER TABLE items_presupuesto ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE items_reparacion  ADD COLUMN IF NOT EXISTS codigo TEXT;
