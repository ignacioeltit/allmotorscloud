-- 059 — El mecánico no edita costos, precios ni campos sensibles de la OT
--       (auditoría 2026-11, A3; incluye el fix M2 de soft_delete)
--
-- Las policies UPDATE de items_reparacion y ordenes_trabajo permiten al
-- mecánico actualizar cualquier columna. RLS no limita columnas, así que se
-- agregan triggers BEFORE que solo actúan cuando mi_rol() = 'mecanico':
--
--   items_reparacion
--     INSERT: costo_compra_unitario lo pone la base desde repuestos.precio_costo
--             (el mecánico ya no puede leerlo, migración 058). Para el mecánico
--             siempre; para gestión solo si viene vacío. Para el mecánico,
--             costo_total se recalcula como cantidad × costo_unitario.
--     UPDATE: no puede cambiar precio, costo ni vínculos del ítem. Sí cantidad,
--             descripción, estado de compra, tiempos y soft delete.
--   ordenes_trabajo
--     UPDATE: solo estado (no a entregada/cerrada/cancelada), km_ingreso y el
--             token del link de avance la primera vez (no puede rotarlo).
--             Cualquier otra columna, incluida eliminado_en, se rechaza.
--
-- soft_delete: el mecánico ya no puede borrar OTs, y un JWT sin rol deja de
-- pasar el chequeo (antes NULL = ANY(...) no lanzaba excepción).
--
-- Idempotente.

-- ── 1. items_reparacion ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_items_reparacion_limites_mecanico()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_protegidas CONSTANT TEXT[] := ARRAY[
    'costo_unitario', 'costo_compra_unitario', 'org_id', 'reparacion_id',
    'repuesto_id', 'item_presupuesto_id', 'servicio_catalogo_id', 'plantilla_id',
    'horas_estandar_snapshot', 'valor_hora_snapshot', 'precio_catalogo_snapshot',
    'nombre_servicio_snapshot', 'creado_por', 'creado_en'
  ];
  v_col TEXT;
  v_es_mecanico CONSTANT BOOLEAN := (mi_rol() = 'mecanico');
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Costo de compra desde el inventario: siempre para el mecánico (ignora lo
    -- que envíe); para gestión, solo si no lo indicó (puede corregirlo después).
    IF v_es_mecanico THEN
      NEW.costo_compra_unitario := NULL;
    END IF;
    IF NEW.costo_compra_unitario IS NULL AND NEW.repuesto_id IS NOT NULL THEN
      SELECT rp.precio_costo INTO NEW.costo_compra_unitario
      FROM repuestos rp
      WHERE rp.id = NEW.repuesto_id AND rp.org_id = NEW.org_id;
    END IF;
    IF NOT v_es_mecanico THEN
      RETURN NEW;
    END IF;
  ELSIF NOT v_es_mecanico THEN
    RETURN NEW;
  ELSE
    FOREACH v_col IN ARRAY v_protegidas LOOP
      IF (to_jsonb(NEW) -> v_col) IS DISTINCT FROM (to_jsonb(OLD) -> v_col) THEN
        RAISE EXCEPTION 'El rol mecánico no puede modificar %', v_col
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  NEW.costo_total := round(NEW.cantidad * NEW.costo_unitario, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_05_items_reparacion_limites_mecanico ON items_reparacion;
CREATE TRIGGER trg_05_items_reparacion_limites_mecanico
  BEFORE INSERT OR UPDATE ON items_reparacion
  FOR EACH ROW EXECUTE FUNCTION fn_items_reparacion_limites_mecanico();

-- ── 2. ordenes_trabajo ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_ordenes_trabajo_limites_mecanico()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  -- Columnas que el mecánico puede cambiar. cerrado_en y actualizado_en las
  -- ajustan otros triggers.
  v_editables CONSTANT TEXT[] := ARRAY[
    'estado', 'km_ingreso', 'token_avance', 'actualizado_en', 'cerrado_en'
  ];
BEGIN
  IF mi_rol() IS DISTINCT FROM 'mecanico' THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - v_editables) IS DISTINCT FROM (to_jsonb(OLD) - v_editables) THEN
    RAISE EXCEPTION 'El rol mecánico solo puede cambiar estado, km y el link de avance de la OT'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado
     AND NEW.estado IN ('entregada', 'cerrada', 'cancelada') THEN
    RAISE EXCEPTION 'Entregar, cerrar o cancelar una OT corresponde a gestión'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.token_avance IS NOT NULL
     AND NEW.token_avance IS DISTINCT FROM OLD.token_avance THEN
    RAISE EXCEPTION 'El rol mecánico no puede cambiar un link de avance ya generado'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_05_ordenes_trabajo_limites_mecanico ON ordenes_trabajo;
CREATE TRIGGER trg_05_ordenes_trabajo_limites_mecanico
  BEFORE UPDATE ON ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION fn_ordenes_trabajo_limites_mecanico();

REVOKE ALL ON FUNCTION fn_items_reparacion_limites_mecanico() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fn_ordenes_trabajo_limites_mecanico()  FROM PUBLIC, anon, authenticated;

-- ── 3. soft_delete (cuerpo de 004 con dos cambios) ───────────────────────────
--   · 'ordenes_trabajo' ya no incluye 'mecanico'.
--   · IF v_rol IS NULL OR NOT (...)  — un JWT sin rol ya no pasa.
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
    WHEN 'ordenes_trabajo'     THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    WHEN 'repuestos'           THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    ELSE NULL
  END;

  IF v_allowed IS NULL THEN
    RAISE EXCEPTION 'Tabla no permitida: %', p_table USING ERRCODE = '22023';
  END IF;
  IF v_rol IS NULL OR NOT (v_rol = ANY(v_allowed)) THEN
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

