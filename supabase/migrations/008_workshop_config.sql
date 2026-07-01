-- 008_workshop_config.sql
-- Agrega categorías de mano de obra faltantes a configuracion_mano_obra.
-- Detectadas en auditoría de TallerGP: diagnóstico, electricidad, diesel.
-- Se usan para calcular precio = horas_estandar × valor_hora_categoria.

ALTER TABLE configuracion_mano_obra
  ADD COLUMN IF NOT EXISTS valor_hora_diagnostico  INTEGER DEFAULT 29412,
  ADD COLUMN IF NOT EXISTS valor_hora_electricidad INTEGER DEFAULT 29412,
  ADD COLUMN IF NOT EXISTS valor_hora_diesel       INTEGER DEFAULT 29412;
