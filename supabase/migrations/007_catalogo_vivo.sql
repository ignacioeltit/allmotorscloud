-- ─────────────────────────────────────────────────────────────────────────
-- Migration 007 — Catálogo Vivo: campo requiere_revision
-- Prerequisito: M005 y M006 aplicadas.
-- Spec:         docs/database/CATALOGO_VIVO_FLOW_SPEC.md
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Campo requiere_revision ──────────────────────────────────────────
-- FALSE = servicio aprobado/oficial (comportamiento histórico)
-- TRUE  = creado desde OT, pendiente de revisión por admin/jefe_taller

ALTER TABLE catalogo_servicios
  ADD COLUMN requiere_revision BOOLEAN NOT NULL DEFAULT FALSE;

-- Los 45 servicios existentes son catálogo base confiable → aprobados
UPDATE catalogo_servicios
  SET requiere_revision = FALSE
  WHERE requiere_revision IS DISTINCT FROM FALSE;

-- ── 2. Índice para cola de revisión ────────────────────────────────────
-- La consulta más frecuente sobre este campo es la lista de pendientes:
--   WHERE org_id = ? AND requiere_revision = TRUE AND eliminado_en IS NULL

CREATE INDEX idx_catalogo_servicios_revision
  ON catalogo_servicios (org_id, requiere_revision)
  WHERE requiere_revision = TRUE AND eliminado_en IS NULL;

-- ── 3. RLS: política de INSERT para recepcionista ───────────────────────
-- La política existente (catalogo_servicios_insert) ya cubre admin y
-- jefe_taller sin restricción en requiere_revision.
-- Se agrega una segunda política para recepcionista que FUERZA
-- requiere_revision = TRUE via WITH CHECK — garantía de integridad en DB,
-- no solo en la UI.

CREATE POLICY "catalogo_servicios_insert_recepcion"
  ON catalogo_servicios FOR INSERT TO authenticated
  WITH CHECK (
    org_id            = mi_org_id()
    AND mi_rol()      = 'recepcionista'
    AND requiere_revision = TRUE
    AND fuente        = 'manual'
    AND activo        = TRUE
  );

-- ── Verificación ─────────────────────────────────────────────────────────

DO $$
DECLARE
  v_col_exists BOOLEAN;
  v_total      INTEGER;
  v_pendientes INTEGER;
  v_policies   INTEGER;
BEGIN
  -- Campo existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'catalogo_servicios'
      AND column_name  = 'requiere_revision'
  ) INTO v_col_exists;
  IF NOT v_col_exists THEN
    RAISE EXCEPTION 'requiere_revision no se creó';
  END IF;

  -- Todos los servicios existentes deben tener requiere_revision = FALSE
  SELECT COUNT(*) INTO v_total     FROM catalogo_servicios;
  SELECT COUNT(*) INTO v_pendientes FROM catalogo_servicios WHERE requiere_revision = TRUE;
  IF v_pendientes > 0 THEN
    RAISE WARNING '% servicios existentes quedaron con requiere_revision=TRUE — revisar', v_pendientes;
  ELSE
    RAISE NOTICE 'OK: % servicios, 0 pendientes — todos aprobados', v_total;
  END IF;

  -- Política nueva existe
  SELECT COUNT(*) INTO v_policies
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'catalogo_servicios'
      AND policyname = 'catalogo_servicios_insert_recepcion';
  IF v_policies = 0 THEN
    RAISE EXCEPTION 'Policy catalogo_servicios_insert_recepcion no se creó';
  ELSE
    RAISE NOTICE 'OK: policy insert_recepcion creada';
  END IF;
END $$;

COMMIT;
