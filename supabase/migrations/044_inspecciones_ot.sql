-- 044 — Inspección integral de la OT (checklist de 14 puntos).
-- Una inspección por OT. Cada punto guarda estado (ok / observación / requiere
-- atención / no aplica) y una nota libre. El checklist (códigos R1..R14 y sus
-- etiquetas) vive en el frontend; la DB solo persiste el arreglo JSONB.
-- La completa el mecánico; gestión también puede editarla.

CREATE TABLE IF NOT EXISTS inspecciones_ot (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizaciones(id),
  orden_trabajo_id UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  vehiculo_id      UUID NOT NULL REFERENCES vehiculos(id) ON DELETE RESTRICT,
  -- [{ codigo: 'R1', estado: 'ok'|'observacion'|'atencion'|'na', nota: '' }]
  puntos           JSONB NOT NULL DEFAULT '[]'::jsonb,
  creado_por       UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_inspeccion_ot UNIQUE (orden_trabajo_id)
);

CREATE INDEX IF NOT EXISTS idx_inspeccion_ot
  ON inspecciones_ot (org_id, orden_trabajo_id);

-- updated_at automático (misma función que el resto del esquema).
DROP TRIGGER IF EXISTS trg_50_inspeccion_set_updated_at ON inspecciones_ot;
CREATE TRIGGER trg_50_inspeccion_set_updated_at
  BEFORE UPDATE ON inspecciones_ot
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE inspecciones_ot ENABLE ROW LEVEL SECURITY;

-- Lectura: todo el tenant.
CREATE POLICY inspeccion_select ON inspecciones_ot
  FOR SELECT TO authenticated
  USING (org_id = mi_org_id());

-- Crea y edita: el mecánico (la ejecuta) + gestión.
-- Las FKs (orden_trabajo_id + vehiculo_id) deben pertenecer al MISMO tenant del
-- usuario y ser consistentes entre sí: impide referenciar la OT de otro taller
-- (y, con el UNIQUE global por OT, el squatting de la inspección ajena).
CREATE POLICY inspeccion_insert ON inspecciones_ot
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
    AND EXISTS (
      SELECT 1 FROM ordenes_trabajo o
      WHERE o.id = orden_trabajo_id
        AND o.org_id = mi_org_id()
        AND o.vehiculo_id = inspecciones_ot.vehiculo_id
    )
  );

CREATE POLICY inspeccion_update ON inspecciones_ot
  FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND EXISTS (
      SELECT 1 FROM ordenes_trabajo o
      WHERE o.id = orden_trabajo_id
        AND o.org_id = mi_org_id()
        AND o.vehiculo_id = inspecciones_ot.vehiculo_id
    )
  );

GRANT SELECT, INSERT, UPDATE ON inspecciones_ot TO authenticated;
