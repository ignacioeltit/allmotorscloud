-- ============================================================
-- Migration 014 — vehiculos.anio_por_confirmar
--
-- El año de los vehículos importados de TallerGP se estima decodificando
-- el VIN (TallerGP no expone el año por API). Esta bandera marca esos años
-- como "por confirmar" para que el taller los valide en la próxima recepción.
-- Se limpia (false) cuando alguien confirma o corrige el año.
-- ============================================================

ALTER TABLE vehiculos
  ADD COLUMN anio_por_confirmar BOOLEAN NOT NULL DEFAULT false;

-- Índice parcial: consultar rápido cuáles faltan por confirmar (badge/reporte).
CREATE INDEX idx_vehiculos_anio_por_confirmar
  ON vehiculos (org_id)
  WHERE anio_por_confirmar = true AND eliminado_en IS NULL;
