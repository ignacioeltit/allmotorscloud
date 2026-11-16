-- 058 — Costos solo para gestión, también en la base (auditoría 2026-11, A1)
--
-- Regla de negocio: costo de compra, utilidad y margen solo los ven admin,
-- jefe_taller y recepcionista. Hasta ahora solo lo ocultaba la UI: el mecánico
-- podía leer las columnas de costo vía PostgREST con su JWT.
--
-- Todos los usuarios de la app son el rol Postgres `authenticated`, así que un
-- GRANT por columna no distingue gestión de mecánico. Diseño:
--   1. Se quita el SELECT de tabla y se otorga SELECT solo sobre las columnas no
--      sensibles (un REVOKE de columna no sirve mientras exista SELECT de tabla).
--      Columnas ocultas:
--        items_reparacion.costo_compra_unitario
--        repuestos.precio_costo
--        movimientos_stock.costo_unitario
--   2. Gestión lee los costos con RPCs SECURITY DEFINER que validan rol y org.
--   3. fn_aceite_sugerido / fn_filtros_sugeridos (herramientas de cotización)
--      quedan solo para gestión.
-- INSERT/UPDATE de tabla se mantienen; el mecánico queda frenado por los
-- triggers de la migración 059.
--
-- ⚠ MANTENCIÓN: toda columna NUEVA en estas 3 tablas necesita su
--   GRANT SELECT (columna) ON <tabla> TO authenticated; o no será legible.
--   Basta con volver a ejecutar el bloque DO de la sección 3.
--
-- ORDEN DE DESPLIEGUE: secciones 0–2 (funciones) → desplegar la app → sección 3.
--
-- Idempotente: se puede ejecutar más de una vez.

-- ── 0. Helper de rol ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_es_gestion()
  RETURNS BOOLEAN
  LANGUAGE sql
  STABLE
  SET search_path = public
AS $$
  SELECT COALESCE(mi_rol() IN ('admin', 'jefe_taller', 'recepcionista'), false);
$$;

REVOKE ALL ON FUNCTION fn_es_gestion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_es_gestion() TO authenticated, service_role;

-- ── 1. RPCs de costos para gestión ───────────────────────────────────────────
-- Devuelven vacío (no error) si el llamante no es gestión: la app solo las
-- llama con puedeVerCostos, y así un JWT desfasado no rompe la ficha.

CREATE OR REPLACE FUNCTION fn_costos_items_ot(p_ot_id UUID)
  RETURNS TABLE (item_id UUID, costo_compra_unitario NUMERIC)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT ir.id, ir.costo_compra_unitario
  FROM items_reparacion ir
  JOIN reparaciones r ON r.id = ir.reparacion_id
  WHERE fn_es_gestion()
    AND ir.org_id = mi_org_id()
    AND r.org_id  = mi_org_id()
    AND r.orden_trabajo_id = p_ot_id
    AND ir.eliminado_en IS NULL;
$$;

CREATE OR REPLACE FUNCTION fn_costos_repuestos(p_ids UUID[] DEFAULT NULL)
  RETURNS TABLE (repuesto_id UUID, precio_costo NUMERIC)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT rp.id, rp.precio_costo
  FROM repuestos rp
  WHERE fn_es_gestion()
    AND rp.org_id = mi_org_id()
    AND (p_ids IS NULL OR rp.id = ANY (p_ids));
$$;

CREATE OR REPLACE FUNCTION fn_costos_movimientos(p_repuesto_id UUID)
  RETURNS TABLE (movimiento_id UUID, costo_unitario NUMERIC)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT ms.id, ms.costo_unitario
  FROM movimientos_stock ms
  WHERE fn_es_gestion()
    AND ms.org_id = mi_org_id()
    AND ms.repuesto_id = p_repuesto_id;
$$;

-- Costo total del stock activo (resumen de inventario). NULL si no es gestión.
CREATE OR REPLACE FUNCTION fn_valor_stock_costo()
  RETURNS NUMERIC
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT CASE WHEN fn_es_gestion() THEN
    COALESCE(SUM(rp.stock_actual * COALESCE(rp.precio_costo, 0)), 0)
  END
  FROM repuestos rp
  WHERE rp.org_id = mi_org_id()
    AND rp.activo = true
    AND rp.eliminado_en IS NULL;
$$;

REVOKE ALL ON FUNCTION fn_costos_items_ot(UUID)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fn_costos_repuestos(UUID[])   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fn_costos_movimientos(UUID)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fn_valor_stock_costo()        FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_costos_items_ot(UUID)    TO authenticated;
GRANT EXECUTE ON FUNCTION fn_costos_repuestos(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_costos_movimientos(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_valor_stock_costo()      TO authenticated;

-- ── 2. Sugeridos de cotización: solo gestión ─────────────────────────────────
-- Cuerpos idénticos a 055 (aceite) y 056 (filtros); el único cambio es la
-- condición de rol en el primer IF.

-- ── Aceite ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_aceite_sugerido(p_marca TEXT, p_modelo TEXT)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_org UUID := mi_org_id();
  v_res JSONB;
BEGIN
  IF v_org IS NULL OR NOT fn_es_gestion() OR COALESCE(btrim(p_marca), '') = '' THEN
    RETURN NULL;
  END IF;

  WITH fuente AS (
    SELECT ir.repuesto_id, ir.descripcion, ir.cantidad::numeric AS cantidad,
           ir.costo_unitario::numeric AS precio_unitario,
           ir.costo_compra_unitario::numeric AS costo_compra_unitario, ir.creado_en, ir.tipo,
           (lower(v.modelo) = lower(p_modelo)) AS mismo_modelo
    FROM items_reparacion ir
    JOIN reparaciones    r ON r.id = ir.reparacion_id
    JOIN ordenes_trabajo o ON o.id = r.orden_trabajo_id
    JOIN vehiculos       v ON v.id = o.vehiculo_id
    WHERE ir.org_id = v_org AND o.org_id = v_org AND ir.eliminado_en IS NULL
      AND lower(v.marca) = lower(p_marca)
    UNION ALL
    SELECT ip.repuesto_id, ip.descripcion, ip.cantidad::numeric,
           ip.precio_unitario::numeric, NULL::numeric, ip.creado_en, ip.tipo,
           (lower(v.modelo) = lower(p_modelo)) AS mismo_modelo
    FROM items_presupuesto ip
    JOIN presupuestos pr ON pr.id = ip.presupuesto_id
    JOIN vehiculos    v  ON v.id = pr.vehiculo_id
    WHERE ip.org_id = v_org AND pr.org_id = v_org
      AND ip.eliminado_en IS NULL AND pr.eliminado_en IS NULL
      AND lower(v.marca) = lower(p_marca)
  ),
  candidatos AS (
    SELECT f.*,
      CASE
        WHEN lower(f.descripcion) ~ '[0-9]{1,2}w-?[0-9]{2}' THEN 3
        WHEN rep.categoria = 'aceites_lubricantes'          THEN 2
        ELSE 1
      END AS score
    FROM fuente f
    LEFT JOIN repuestos rep ON rep.id = f.repuesto_id
    WHERE f.tipo <> 'mano_obra'
      AND lower(f.descripcion) NOT LIKE '%filtro%'
      AND lower(f.descripcion) NOT LIKE '%renovar%'
      AND lower(f.descripcion) NOT LIKE '%cambio%'
      AND lower(f.descripcion) NOT LIKE '%insumo%'
      AND lower(f.descripcion) NOT LIKE '%mano de obra%'
      AND lower(f.descripcion) NOT LIKE '%servicio%'
      AND (
        rep.categoria = 'aceites_lubricantes'
        OR lower(f.descripcion) ~ '[0-9]{1,2}w-?[0-9]{2}'
        OR lower(f.descripcion) LIKE '%aceite%'
      )
  ),
  filtrado AS (
    SELECT * FROM candidatos
    WHERE mismo_modelo = true OR NOT EXISTS (SELECT 1 FROM candidatos WHERE mismo_modelo = true)
  ),
  agrupado AS (
    SELECT coalesce(repuesto_id::text, 'txt:' || lower(descripcion))     AS clave,
      (array_agg(repuesto_id           ORDER BY creado_en DESC))[1]      AS repuesto_id,
      (array_agg(descripcion           ORDER BY creado_en DESC))[1]      AS descripcion,
      (array_agg(cantidad              ORDER BY creado_en DESC))[1]      AS cantidad,
      (array_agg(precio_unitario       ORDER BY creado_en DESC))[1]      AS precio_unitario,
      (array_agg(costo_compra_unitario ORDER BY creado_en DESC))[1]      AS costo_compra_unitario,
      max(score) AS score, count(*) AS veces, max(creado_en) AS ultima
    FROM filtrado GROUP BY 1
  )
  SELECT jsonb_build_object('repuesto_id', repuesto_id, 'descripcion', descripcion,
    'cantidad', cantidad, 'precio_unitario', precio_unitario,
    'costo_compra_unitario', costo_compra_unitario, 'veces', veces)
  INTO v_res FROM agrupado
  ORDER BY score DESC, veces DESC, ultima DESC
  LIMIT 1;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION fn_aceite_sugerido(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_aceite_sugerido(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION fn_filtros_sugeridos(p_marca TEXT, p_modelo TEXT)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_org UUID := mi_org_id();
  v_res JSONB;
BEGIN
  IF v_org IS NULL OR NOT fn_es_gestion() OR COALESCE(btrim(p_marca), '') = '' THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH fuente AS (
    SELECT ir.repuesto_id, ir.descripcion, ir.cantidad::numeric AS cantidad,
           ir.costo_unitario::numeric AS precio_unitario,
           ir.costo_compra_unitario::numeric AS costo_compra_unitario, ir.creado_en, ir.tipo,
           (lower(v.modelo) = lower(p_modelo)) AS mismo_modelo
    FROM items_reparacion ir
    JOIN reparaciones    r ON r.id = ir.reparacion_id
    JOIN ordenes_trabajo o ON o.id = r.orden_trabajo_id
    JOIN vehiculos       v ON v.id = o.vehiculo_id
    WHERE ir.org_id = v_org AND o.org_id = v_org AND ir.eliminado_en IS NULL
      AND lower(v.marca) = lower(p_marca)
    UNION ALL
    SELECT ip.repuesto_id, ip.descripcion, ip.cantidad::numeric,
           ip.precio_unitario::numeric, NULL::numeric, ip.creado_en, ip.tipo,
           (lower(v.modelo) = lower(p_modelo)) AS mismo_modelo
    FROM items_presupuesto ip
    JOIN presupuestos pr ON pr.id = ip.presupuesto_id
    JOIN vehiculos    v  ON v.id = pr.vehiculo_id
    WHERE ip.org_id = v_org AND pr.org_id = v_org
      AND ip.eliminado_en IS NULL AND pr.eliminado_en IS NULL
      AND lower(v.marca) = lower(p_marca)
  ),
  filtros AS (
    SELECT f.*,
      CASE
        WHEN lower(f.descripcion) ~ 'polen|polén|habitaculo|habitáculo|cabina' THEN 'polen'
        WHEN lower(f.descripcion) ~ 'combustible|petroleo|petróleo|diesel|bencina|gasolina|nafta' THEN 'combustible'
        WHEN lower(f.descripcion) LIKE '%aceite%' THEN 'aceite'
        WHEN lower(f.descripcion) ~ 'aire|f\.air' THEN 'aire'
        ELSE 'otro'
      END AS subtipo
    FROM fuente f
    LEFT JOIN repuestos rep ON rep.id = f.repuesto_id
    WHERE f.tipo <> 'mano_obra'
      AND lower(f.descripcion) NOT LIKE '%renovar%'
      AND lower(f.descripcion) NOT LIKE '%cambio%'
      AND lower(f.descripcion) NOT LIKE '%mano de obra%'
      AND (rep.categoria = 'filtros' OR lower(f.descripcion) LIKE '%filtro%')
  ),
  filtrado AS (
    SELECT * FROM filtros
    WHERE mismo_modelo = true OR NOT EXISTS (SELECT 1 FROM filtros WHERE mismo_modelo = true)
  ),
  agrupado AS (
    SELECT subtipo,
      coalesce(repuesto_id::text, 'txt:' || lower(descripcion))              AS clave,
      (array_agg(repuesto_id           ORDER BY creado_en DESC))[1]          AS repuesto_id,
      (array_agg(descripcion           ORDER BY creado_en DESC))[1]          AS descripcion,
      (array_agg(cantidad              ORDER BY creado_en DESC))[1]          AS cantidad,
      (array_agg(precio_unitario       ORDER BY creado_en DESC))[1]          AS precio_unitario,
      (array_agg(costo_compra_unitario ORDER BY creado_en DESC))[1]          AS costo_compra_unitario,
      count(*) AS veces, max(creado_en) AS ultima
    FROM filtrado
    GROUP BY subtipo, clave
  ),
  -- Un filtro por subtipo: el más usado (desempata por más reciente).
  ranked AS (
    SELECT *, row_number() OVER (PARTITION BY subtipo ORDER BY veces DESC, ultima DESC) AS rn
    FROM agrupado
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('repuesto_id', repuesto_id, 'descripcion', descripcion,
    'cantidad', cantidad, 'precio_unitario', precio_unitario,
    'costo_compra_unitario', costo_compra_unitario, 'veces', veces)
    ORDER BY veces DESC, ultima DESC), '[]'::jsonb)
  INTO v_res
  FROM ranked
  WHERE rn = 1;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION fn_filtros_sugeridos(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_filtros_sugeridos(TEXT, TEXT) TO authenticated;

-- ── 3. SELECT por columna (todas menos la de costo) ──────────────────────────
-- Va al final a propósito: aplicar SOLO después de desplegar la app que ya no
-- pide estas columnas (la app anterior las selecciona y fallaría).
DO $$
DECLARE
  r    RECORD;
  cols TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('items_reparacion',  'costo_compra_unitario'),
      ('repuestos',         'precio_costo'),
      ('movimientos_stock', 'costo_unitario')
    ) AS t(tabla, oculta)
  LOOP
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      INTO cols
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = r.tabla
       AND column_name <> r.oculta;

    EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated', r.tabla);
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO authenticated', cols, r.tabla);
  END LOOP;
END $$;
