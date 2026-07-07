-- 040 — Presupuestos históricos importados de TallerGP (solo referencia).
-- No son presupuestos formales (no entran al flujo de cotización/folio/estado):
-- son datos de consulta para poder cargar sus líneas a una OT con un clic.
-- Se llenan una sola vez con un script (service_role); la app solo los lee.

CREATE TABLE IF NOT EXISTS presupuestos_tallergp (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organizaciones(id),
  tallergp_budget_id TEXT NOT NULL,
  vehiculo_id        UUID REFERENCES vehiculos(id),
  patente            TEXT,
  numero             TEXT,               -- ej: PPT3081
  estado             TEXT,               -- status_name de TallerGP
  fecha              DATE,
  cliente_nombre     TEXT,
  total_neto         NUMERIC(14,2) DEFAULT 0,
  total_con_iva      NUMERIC(14,2) DEFAULT 0,
  -- [{ tipo, codigo, descripcion, cantidad, precio_unitario, total }]
  lineas             JSONB NOT NULL DEFAULT '[]'::jsonb,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_presupuestos_tallergp UNIQUE (org_id, tallergp_budget_id)
);

CREATE INDEX IF NOT EXISTS idx_presupuestos_tallergp_veh
  ON presupuestos_tallergp (org_id, vehiculo_id);

ALTER TABLE presupuestos_tallergp ENABLE ROW LEVEL SECURITY;

-- Lectura para miembros del tenant; escritura solo vía service_role (el import).
DROP POLICY IF EXISTS sel_presupuestos_tallergp ON presupuestos_tallergp;
CREATE POLICY sel_presupuestos_tallergp ON presupuestos_tallergp
  FOR SELECT USING (org_id = mi_org_id());

GRANT SELECT ON presupuestos_tallergp TO authenticated;
