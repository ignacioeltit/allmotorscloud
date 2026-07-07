-- 038 — Búsqueda de clientes por RUT tolerante al formato.
-- Columna generada `rut_norm` = RUT sin puntos ni guion, en mayúsculas (dígitos + K).
-- Así "16.218.807-0" y "16218807-0" quedan como "162188070" y se encuentran igual.
-- No es destructiva: el `rut` original se conserva para mostrar con su formato.

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS rut_norm TEXT
  GENERATED ALWAYS AS (
    NULLIF(upper(regexp_replace(coalesce(rut, ''), '[^0-9kK]', '', 'g')), '')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_clientes_org_rut_norm ON clientes (org_id, rut_norm);
