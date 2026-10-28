-- 043 — Recordatorios de revisión técnica y mantención del vehículo.
-- fecha_revision_tecnica: vencimiento de la RT. proxima_mantencion_fecha / _km:
-- cuándo toca la próxima mantención (por fecha o por kilometraje).

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS fecha_revision_tecnica   DATE,
  ADD COLUMN IF NOT EXISTS proxima_mantencion_fecha DATE,
  ADD COLUMN IF NOT EXISTS proxima_mantencion_km    INTEGER;
