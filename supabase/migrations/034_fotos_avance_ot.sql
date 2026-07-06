-- 034 — Fotos de avance de la OT + link público de seguimiento.
--
-- Reutiliza la tabla `evidencias` (ya trae visible_cliente): la ligamos
-- directamente a la OT (orden_trabajo_id) y hacemos evento_id opcional. Las
-- fotos van al bucket público `evidencias` (paths con UUID inadivinable). El
-- cliente ve las marcadas visible_cliente en un link de avance por token.

-- ── 1. evidencias ligadas a la OT ────────────────────────────────────────────
ALTER TABLE evidencias ALTER COLUMN evento_id DROP NOT NULL;
ALTER TABLE evidencias ADD COLUMN IF NOT EXISTS orden_trabajo_id UUID
  REFERENCES ordenes_trabajo(id) ON DELETE CASCADE;
ALTER TABLE evidencias ADD COLUMN IF NOT EXISTS descripcion TEXT;
CREATE INDEX IF NOT EXISTS idx_evidencias_ot
  ON evidencias (orden_trabajo_id, creado_en DESC)
  WHERE orden_trabajo_id IS NOT NULL;

-- Borrar fotos: admin / jefe_taller (no había policy de DELETE).
DROP POLICY IF EXISTS "evidencias_delete" ON evidencias;
CREATE POLICY "evidencias_delete" ON evidencias FOR DELETE TO authenticated
  USING (org_id = mi_org_id() AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista'));

-- ── 2. token de avance en la OT ──────────────────────────────────────────────
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS token_avance UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ot_token_avance
  ON ordenes_trabajo (token_avance) WHERE token_avance IS NOT NULL;

-- ── 3. Storage: bucket evidencias (público) ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('evidencias', 'evidencias', true, 10485760,
        ARRAY['image/png','image/jpeg','image/webp','image/heic','image/heif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "evidencias_bucket_read" ON storage.objects;
CREATE POLICY "evidencias_bucket_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'evidencias');
DROP POLICY IF EXISTS "evidencias_bucket_insert" ON storage.objects;
CREATE POLICY "evidencias_bucket_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'evidencias');
DROP POLICY IF EXISTS "evidencias_bucket_delete" ON storage.objects;
CREATE POLICY "evidencias_bucket_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'evidencias');

-- ── 4. Vista pública de avance (por token, sin login) ────────────────────────
CREATE OR REPLACE FUNCTION fn_avance_ot(p_token UUID)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_ot   ordenes_trabajo%ROWTYPE;
  v_veh  RECORD;
  v_tal  RECORD;
  v_fotos JSONB;
BEGIN
  SELECT * INTO v_ot FROM ordenes_trabajo
  WHERE token_avance = p_token AND eliminado_en IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_encontrada');
  END IF;

  SELECT patente, marca, modelo, anio INTO v_veh FROM vehiculos WHERE id = v_ot.vehiculo_id;
  SELECT nombre, telefono, logo_url INTO v_tal FROM organizaciones WHERE id = v_ot.org_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('path', bucket_path, 'descripcion', descripcion, 'creado_en', creado_en)
    ORDER BY creado_en DESC), '[]'::jsonb)
  INTO v_fotos
  FROM evidencias
  WHERE orden_trabajo_id = v_ot.id AND visible_cliente = true AND tipo = 'foto';

  RETURN jsonb_build_object(
    'numero_ot', v_ot.numero_ot,
    'estado', v_ot.estado,
    'creado_en', v_ot.creado_en,
    'taller', jsonb_build_object('nombre', v_tal.nombre, 'telefono', v_tal.telefono, 'logo_url', v_tal.logo_url),
    'vehiculo', jsonb_build_object('patente', v_veh.patente, 'marca', v_veh.marca, 'modelo', v_veh.modelo, 'anio', v_veh.anio),
    'fotos', v_fotos
  );
END;
$$;

REVOKE ALL ON FUNCTION fn_avance_ot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_avance_ot(UUID) TO anon, authenticated;
