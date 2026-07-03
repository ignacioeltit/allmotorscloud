-- ============================================================
-- Migration 020 — Folio legible de cotización/presupuesto (PPTxxxx)
--
-- Hasta ahora un presupuesto solo se identificaba por su UUID. El taller necesita
-- un folio corto y correlativo para referirse a una cotización (ej. "PPT3500").
--
-- Decisión (2026-07-02, con Ignacio): numeración correlativa partiendo en PPT3500.
--   - folio_numero: entero correlativo (secuencia presupuestos_folio_seq, START 3500).
--   - folio: texto generado 'PPT' || folio_numero, para mostrar y buscar.
--   - Las filas existentes se numeran en orden de creación (la más antigua = 3500).
--
-- Nota: la secuencia es global al deployment (hoy un solo taller). Si a futuro hay
-- varias organizaciones y se quiere un correlativo por org, habrá que migrar a un
-- contador por org_id.
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS presupuestos_folio_seq START WITH 3500;

ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS folio_numero INTEGER;

-- Backfill de filas existentes en orden de creación (la más antigua = 3500).
WITH ordenadas AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY creado_en) AS rn
  FROM presupuestos
  WHERE folio_numero IS NULL
)
UPDATE presupuestos p
SET folio_numero = 3499 + o.rn
FROM ordenadas o
WHERE p.id = o.id;

-- Avanzar la secuencia al máximo asignado; el próximo nextval continúa desde ahí.
-- Si no había filas, queda en 3499 → el primer nuevo folio será 3500.
SELECT setval(
  'presupuestos_folio_seq',
  GREATEST((SELECT COALESCE(MAX(folio_numero), 3499) FROM presupuestos), 3499),
  true
);

-- Los nuevos presupuestos toman el folio automáticamente (ambos caminos de alta:
-- fn_crear_cotizacion SECURITY DEFINER y el INSERT directo del rol authenticated).
ALTER TABLE presupuestos ALTER COLUMN folio_numero SET DEFAULT nextval('presupuestos_folio_seq');
ALTER SEQUENCE presupuestos_folio_seq OWNED BY presupuestos.folio_numero;

-- El rol authenticated necesita USAGE sobre la secuencia para evaluar el default
-- al insertar directo (presupuestos de OT).
GRANT USAGE, SELECT ON SEQUENCE presupuestos_folio_seq TO authenticated;

-- Columna de texto legible: PPT + número.
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS folio TEXT
  GENERATED ALWAYS AS ('PPT' || folio_numero::text) STORED;

CREATE INDEX IF NOT EXISTS idx_presupuestos_folio
  ON presupuestos (folio)
  WHERE folio IS NOT NULL;

-- ── Exponer el folio en la vista del listado ─────────────────────────────────
CREATE OR REPLACE VIEW v_presupuestos_listado
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.org_id,
  p.orden_trabajo_id,
  p.estado,
  p.total_neto,
  p.creado_en,
  p.eliminado_en,
  ot.numero_ot,
  COALESCE(vp.patente, vo.patente) AS patente,
  COALESCE(vp.marca,   vo.marca)   AS marca,
  COALESCE(vp.modelo,  vo.modelo)  AS modelo,
  COALESCE(cp.nombre,  cot.nombre) AS cliente_nombre,
  p.folio
FROM presupuestos p
LEFT JOIN ordenes_trabajo ot ON ot.id = p.orden_trabajo_id
LEFT JOIN vehiculos       vp ON vp.id = p.vehiculo_id
LEFT JOIN vehiculos       vo ON vo.id = ot.vehiculo_id
LEFT JOIN clientes        cp ON cp.id = p.cliente_id
LEFT JOIN LATERAL (
  SELECT c.nombre
  FROM propietarios_vehiculo pv
  JOIN clientes c ON c.id = pv.cliente_id
  WHERE pv.vehiculo_id = ot.vehiculo_id
    AND pv.fecha_fin IS NULL
  LIMIT 1
) cot ON true;
