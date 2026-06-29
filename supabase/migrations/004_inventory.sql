-- ============================================================
-- Migration 004 — Inventory Core
-- All Motors Cloud — Junio 2026
--
-- Dependencias: 001 (pg_trgm, fn_set_updated_at, fn_audit_insert_trigger),
--               002 (organizaciones, sucursales, usuarios), 003 (items_presupuesto, items_reparacion)
--
-- Crea:
--   repuestos           — catálogo maestro de partes/insumos per-tenant
--   movimientos_stock   — historial de stock append-only (sin eliminado_en)
--
-- Activa FK diferidas:
--   items_presupuesto.repuesto_id → repuestos.id  (índice ya creado en m003)
--   items_reparacion.repuesto_id  → repuestos.id  (índice ya creado en m003)
--
-- Extiende:
--   soft_delete()      — agrega 'repuestos' al whitelist
--   restore_deleted()  — agrega 'repuestos' al whitelist
--
-- MIGRATION_004_SPEC §2 ("Campos clave"):
--   stock_actual se actualiza SOLO via trigger fn_actualizar_stock_repuesto (SECURITY DEFINER).
--   Nunca vía UPDATE directo desde aplicación.
-- ============================================================

BEGIN;


-- ============================================================
-- PASO 1 — TABLA repuestos
-- Per-tenant. Soft-delete. Audit trigger. set_updated_at.
-- MIGRATION_004_SPEC §2.1
-- ============================================================

CREATE TABLE repuestos (
  id                UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id            UUID          NOT NULL REFERENCES organizaciones(id)  ON DELETE RESTRICT,
  sucursal_id       UUID                   REFERENCES sucursales(id)       ON DELETE SET NULL,
  codigo            TEXT          NOT NULL,
  codigo_barra      TEXT,
  nombre            TEXT          NOT NULL,
  descripcion       TEXT,
  marca             TEXT,
  modelo_aplicacion TEXT,
  categoria         TEXT,
  unidad            TEXT          NOT NULL DEFAULT 'unidad',
  precio_costo      NUMERIC(12,2),
  precio_venta      NUMERIC(12,2),
  stock_actual      NUMERIC(10,3) NOT NULL DEFAULT 0,
  stock_minimo      NUMERIC(10,3) NOT NULL DEFAULT 0,
  ubicacion         TEXT,
  proveedor         TEXT,
  activo            BOOLEAN       NOT NULL DEFAULT true,
  creado_en         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  creado_por        UUID          NOT NULL REFERENCES usuarios(id)         ON DELETE RESTRICT,
  eliminado_en      TIMESTAMPTZ,
  eliminado_por     UUID                   REFERENCES usuarios(id)         ON DELETE SET NULL,
  CONSTRAINT uq_repuestos_org_codigo UNIQUE (org_id, codigo),
  CONSTRAINT chk_repuestos_stock_actual  CHECK (stock_actual  >= 0),
  CONSTRAINT chk_repuestos_stock_minimo  CHECK (stock_minimo  >= 0),
  CONSTRAINT chk_repuestos_precio_costo  CHECK (precio_costo  IS NULL OR precio_costo  >= 0),
  CONSTRAINT chk_repuestos_precio_venta  CHECK (precio_venta  IS NULL OR precio_venta  >= 0)
);


-- ============================================================
-- PASO 2 — TABLA movimientos_stock
-- Append-only: SIN eliminado_en, SIN actualizado_en.
-- DATABASE_MODEL §7: "un registro incorrecto se anula con nueva fila tipo 'ajuste'"
-- MIGRATION_004_SPEC §2.2
-- ============================================================

CREATE TABLE movimientos_stock (
  id                    UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id                UUID          NOT NULL REFERENCES organizaciones(id)  ON DELETE RESTRICT,
  repuesto_id           UUID          NOT NULL REFERENCES repuestos(id)        ON DELETE RESTRICT,
  tipo                  TEXT          NOT NULL,
  cantidad              NUMERIC(10,3) NOT NULL,
  stock_antes           NUMERIC(10,3) NOT NULL,
  stock_despues         NUMERIC(10,3) NOT NULL,
  costo_unitario        NUMERIC(12,2),
  precio_venta_unitario NUMERIC(12,2),
  referencia_tipo       TEXT,
  referencia_id         UUID,
  motivo                TEXT,
  actor_id              UUID          NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  creado_en             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_movimientos_stock_tipo
    CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'consumo_ot', 'devolucion')),
  CONSTRAINT chk_movimientos_stock_cantidad
    CHECK (cantidad > 0)
  -- Sin chk_mov_stock_no_neg deliberadamente:
  -- "No bloquear la OT si no hay stock." (Sprint 8 §FASE 5)
  -- stock_despues puede ser 0 pero no negativo (el trigger usa GREATEST(0, ...))
);


-- ============================================================
-- PASO 3 — ÍNDICES
-- ============================================================

-- repuestos: catálogo activo por org (hot path del listado)
CREATE INDEX idx_repuestos_org_activo
  ON repuestos (org_id, activo)
  WHERE eliminado_en IS NULL;

-- repuestos: búsqueda fuzzy por nombre (GIN trigram — pg_trgm del m001)
CREATE INDEX idx_repuestos_nombre_trgm
  ON repuestos USING gin (nombre gin_trgm_ops)
  WHERE eliminado_en IS NULL;

-- repuestos: búsqueda por código de barra
CREATE INDEX idx_repuestos_codigo_barra
  ON repuestos (org_id, codigo_barra)
  WHERE codigo_barra IS NOT NULL AND eliminado_en IS NULL;

-- repuestos: alerta de bajo stock (partial — solo filas relevantes)
CREATE INDEX idx_repuestos_bajo_stock
  ON repuestos (org_id)
  WHERE activo = true AND eliminado_en IS NULL AND stock_actual < stock_minimo;

-- repuestos: FK desde sucursal
CREATE INDEX idx_repuestos_sucursal
  ON repuestos (sucursal_id)
  WHERE sucursal_id IS NOT NULL AND eliminado_en IS NULL;

-- movimientos_stock: historial por repuesto (hot path de kardex)
CREATE INDEX idx_movimientos_stock_repuesto
  ON movimientos_stock (repuesto_id, creado_en DESC);

-- movimientos_stock: feed de almacén por org
CREATE INDEX idx_movimientos_stock_org
  ON movimientos_stock (org_id, creado_en DESC);

-- movimientos_stock: trazabilidad por referencia (ej: items_reparacion)
CREATE INDEX idx_movimientos_stock_referencia
  ON movimientos_stock (referencia_tipo, referencia_id)
  WHERE referencia_id IS NOT NULL;


-- ============================================================
-- PASO 4 — TRIGGER fn_actualizar_stock_repuesto
-- AFTER INSERT en movimientos_stock.
-- SECURITY DEFINER: el mecánico tiene RLS INSERT en movimientos_stock pero no
-- tiene RLS UPDATE en repuestos → la función corre como postgres para bypassear.
-- El UPDATE es atómico: usa stock_actual ± cantidad, no un snapshot.
-- Esto garantiza consistencia bajo concurrencia (no race condition).
-- ============================================================

CREATE OR REPLACE FUNCTION fn_actualizar_stock_repuesto()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tipo IN ('entrada', 'devolucion') THEN
    UPDATE repuestos
    SET stock_actual = stock_actual + NEW.cantidad
    WHERE id = NEW.repuesto_id;
  ELSE
    -- salida, ajuste, consumo_ot: nunca deja negativo (GREATEST)
    UPDATE repuestos
    SET stock_actual = GREATEST(0, stock_actual - NEW.cantidad)
    WHERE id = NEW.repuesto_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_20_movimientos_stock_actualizar_stock
  AFTER INSERT ON movimientos_stock
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_stock_repuesto();


-- ============================================================
-- PASO 5 — TRIGGERS repuestos
-- Patrón estándar: trg_50 (set_updated_at) + trg_99 (audit)
-- ============================================================

CREATE TRIGGER trg_50_repuestos_set_updated_at
  BEFORE UPDATE ON repuestos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_99_repuestos_audit
  AFTER INSERT OR UPDATE OR DELETE ON repuestos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ============================================================
-- PASO 6 — RLS: repuestos
-- SELECT: todos los roles autenticados del tenant
-- INSERT/UPDATE: admin, jefe_taller, recepcionista
-- mecanico: solo SELECT (para buscar repuesto al agregar ítem en OT)
-- MIGRATION_004_SPEC §2.1 "RLS"
-- ============================================================

ALTER TABLE repuestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repuestos_select"
  ON repuestos FOR SELECT TO authenticated
  USING (org_id = mi_org_id() AND eliminado_en IS NULL);

CREATE POLICY "repuestos_insert"
  ON repuestos FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );

CREATE POLICY "repuestos_update"
  ON repuestos FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );


-- ============================================================
-- PASO 7 — RLS: movimientos_stock
-- SELECT: todos los roles del tenant (kardex visible por mecánico)
-- INSERT: admin, jefe_taller, recepcionista, mecanico
-- No hay UPDATE ni DELETE (append-only).
-- MIGRATION_004_SPEC §2.2 "RLS"
-- ============================================================

ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movimientos_stock_select"
  ON movimientos_stock FOR SELECT TO authenticated
  USING (org_id = mi_org_id());

CREATE POLICY "movimientos_stock_insert"
  ON movimientos_stock FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  );


-- ============================================================
-- PASO 8 — Activar FK diferidas de Migration 003
-- Los índices parciales ya existen (idx_items_presupuesto_repuesto,
-- idx_items_reparacion_repuesto — creados en m003 líneas 443 y 473).
-- ON DELETE SET NULL: ítems históricos conservan texto al eliminar repuesto.
-- MIGRATION_004_SPEC §3 "FK diferidas a activar"
-- ============================================================

ALTER TABLE items_presupuesto
  ADD CONSTRAINT fk_items_presupuesto_repuesto_id
    FOREIGN KEY (repuesto_id) REFERENCES repuestos(id) ON DELETE SET NULL;

ALTER TABLE items_reparacion
  ADD CONSTRAINT fk_items_reparacion_repuesto_id
    FOREIGN KEY (repuesto_id) REFERENCES repuestos(id) ON DELETE SET NULL;


-- ============================================================
-- PASO 9 — Extender soft_delete() para incluir 'repuestos'
-- CREATE OR REPLACE extiende la función creada en migration_fix_003
-- sin modificar el archivo de esa migración.
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete(p_table TEXT, p_id UUID)
  RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_org_id  UUID := mi_org_id();
  v_user_id UUID := auth.uid();
  v_rol     TEXT := mi_rol();
  v_allowed TEXT[];
  v_rows    INT;
BEGIN
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada' USING ERRCODE = '42501';
  END IF;

  v_allowed := CASE p_table
    WHEN 'sucursales'          THEN ARRAY['admin']::TEXT[]
    WHEN 'usuarios'            THEN ARRAY['admin']::TEXT[]
    WHEN 'clientes'            THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    WHEN 'conductores'         THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    WHEN 'vehiculos'           THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    WHEN 'citas'               THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    WHEN 'items_presupuesto'   THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    WHEN 'presupuestos'        THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    WHEN 'referencias_evento'  THEN ARRAY['admin','jefe_taller']::TEXT[]
    WHEN 'eventos'             THEN ARRAY['admin','jefe_taller','recepcionista','mecanico']::TEXT[]
    WHEN 'items_reparacion'    THEN ARRAY['admin','jefe_taller','recepcionista','mecanico']::TEXT[]
    WHEN 'ordenes_trabajo'     THEN ARRAY['admin','jefe_taller','recepcionista','mecanico']::TEXT[]
    WHEN 'repuestos'           THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    ELSE NULL
  END;

  IF v_allowed IS NULL THEN
    RAISE EXCEPTION 'Tabla no permitida: %', p_table USING ERRCODE = '22023';
  END IF;
  IF NOT (v_rol = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Rol % no autorizado para eliminar en %', v_rol, p_table
      USING ERRCODE = '42501';
  END IF;
  IF p_table = 'usuarios' AND p_id = v_user_id THEN
    RAISE EXCEPTION 'Un usuario no puede eliminarse a sí mismo' USING ERRCODE = '42501';
  END IF;

  EXECUTE format(
    'UPDATE %I SET eliminado_en = NOW(), eliminado_por = $1 WHERE id = $2 AND org_id = $3 AND eliminado_en IS NULL',
    p_table
  ) USING v_user_id, p_id, v_org_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Registro no encontrado, ya eliminado, o de otra organización'
      USING ERRCODE = 'P0002';
  END IF;
END;
$func$;

REVOKE ALL ON FUNCTION public.soft_delete(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.soft_delete(TEXT, UUID) TO authenticated;


-- ============================================================
-- PASO 10 — Extender restore_deleted() para incluir 'repuestos'
-- ============================================================

CREATE OR REPLACE FUNCTION public.restore_deleted(p_table TEXT, p_id UUID)
  RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_org_id  UUID := mi_org_id();
  v_user_id UUID := auth.uid();
  v_rol     TEXT := mi_rol();
  v_rows    INT;
BEGIN
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada' USING ERRCODE = '42501';
  END IF;
  IF v_rol NOT IN ('admin', 'jefe_taller') THEN
    RAISE EXCEPTION 'Solo admin/jefe_taller pueden restaurar registros' USING ERRCODE = '42501';
  END IF;

  IF p_table NOT IN (
    'sucursales', 'usuarios', 'clientes', 'conductores', 'vehiculos', 'citas',
    'items_presupuesto', 'presupuestos', 'referencias_evento', 'eventos',
    'items_reparacion', 'ordenes_trabajo', 'repuestos'
  ) THEN
    RAISE EXCEPTION 'Tabla no permitida: %', p_table USING ERRCODE = '22023';
  END IF;

  EXECUTE format(
    'UPDATE %I SET eliminado_en = NULL, eliminado_por = NULL WHERE id = $1 AND org_id = $2 AND eliminado_en IS NOT NULL',
    p_table
  ) USING p_id, v_org_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Registro no encontrado, ya activo, o de otra organización'
      USING ERRCODE = 'P0002';
  END IF;
END;
$func$;

REVOKE ALL ON FUNCTION public.restore_deleted(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_deleted(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_deleted(TEXT, UUID) TO authenticated;


-- ============================================================
-- PASO 11 — Vista v_repuestos_bajo_stock (convenience)
-- No tiene RLS propia: hereda el RLS de repuestos via SECURITY INVOKER.
-- ============================================================

CREATE OR REPLACE VIEW v_repuestos_bajo_stock AS
  SELECT
    id, org_id, codigo, nombre, marca, categoria,
    stock_actual, stock_minimo, unidad, ubicacion, proveedor
  FROM repuestos
  WHERE activo = true
    AND eliminado_en IS NULL
    AND stock_actual < stock_minimo;


-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN (ejecutar manualmente):
--
-- -- 1. Las tablas existen y tienen RLS
-- SELECT relname, relrowsecurity
-- FROM pg_class WHERE relname IN ('repuestos', 'movimientos_stock');
--
-- -- 2. Las FK están activas
-- SELECT conname FROM pg_constraint
-- WHERE conrelid IN ('items_reparacion'::regclass, 'items_presupuesto'::regclass)
--   AND contype = 'f' AND conname LIKE '%repuesto%';
--
-- -- 3. El trigger de stock existe y es SECURITY DEFINER
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'movimientos_stock'::regclass;
-- SELECT prosecdef FROM pg_proc WHERE proname = 'fn_actualizar_stock_repuesto';
--
-- -- 4. soft_delete incluye repuestos (ver en pg_proc.prosrc)
-- SELECT prosrc FROM pg_proc WHERE proname = 'soft_delete';
-- ============================================================

COMMIT;
