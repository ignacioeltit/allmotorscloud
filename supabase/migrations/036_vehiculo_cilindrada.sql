-- 036 — Cilindrada / motor del vehículo.
-- Texto libre para admitir cualquier notación: "2.0", "1600cc", "V8 5.3L".
-- Decisivo para elegir repuestos y tomar decisiones; se muestra en la ficha,
-- la OT y los presupuestos.

ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS cilindrada TEXT;
