-- 041 — Recomendaciones para la próxima visita del vehículo.
-- El mecánico deja una nota (ej. "revisar frenos próxima mantención"); el asesor
-- de servicio la edita/afina. Quedan ligadas al VEHÍCULO (no a una sola OT) y
-- saltan cuando el vehículo vuelve a entrar, hasta que se marcan resueltas.

CREATE TABLE IF NOT EXISTS recomendaciones_vehiculo (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizaciones(id),
  vehiculo_id      UUID NOT NULL REFERENCES vehiculos(id) ON DELETE RESTRICT,
  orden_trabajo_id UUID REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,  -- OT de origen
  descripcion      TEXT NOT NULL,
  prioridad        TEXT NOT NULL DEFAULT 'normal',   -- 'alta' | 'normal'
  estado           TEXT NOT NULL DEFAULT 'pendiente',-- 'pendiente' | 'resuelta'
  creado_por       UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelta_por     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  resuelta_en      TIMESTAMPTZ,
  resuelta_ot_id   UUID REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  CONSTRAINT chk_recom_prioridad CHECK (prioridad IN ('alta','normal')),
  CONSTRAINT chk_recom_estado    CHECK (estado IN ('pendiente','resuelta'))
);

CREATE INDEX IF NOT EXISTS idx_recom_veh_estado
  ON recomendaciones_vehiculo (org_id, vehiculo_id, estado);

-- updated_at automático (misma función que el resto del esquema).
DROP TRIGGER IF EXISTS trg_50_recom_set_updated_at ON recomendaciones_vehiculo;
CREATE TRIGGER trg_50_recom_set_updated_at
  BEFORE UPDATE ON recomendaciones_vehiculo
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE recomendaciones_vehiculo ENABLE ROW LEVEL SECURITY;

-- Lectura: todo el tenant.
CREATE POLICY recom_select ON recomendaciones_vehiculo
  FOR SELECT TO authenticated
  USING (org_id = mi_org_id());

-- Crea: el mecánico también puede (deja la nota); + gestión.
CREATE POLICY recom_insert ON recomendaciones_vehiculo
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  );

-- Edita / resuelve: solo gestión (asesor de servicio).
CREATE POLICY recom_update ON recomendaciones_vehiculo
  FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id());

GRANT SELECT, INSERT, UPDATE ON recomendaciones_vehiculo TO authenticated;
