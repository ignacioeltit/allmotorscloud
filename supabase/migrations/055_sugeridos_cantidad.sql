-- 055 — Aceite/filtros sugeridos: devolver también la CANTIDAD típica del historial.
--
-- El aceite usa N bidones (p.ej. 2), no 1; la cantidad debe salir del historial,
-- no de las horas de mano de obra del paquete. Se agrega 'cantidad' (la más
-- reciente) al JSON de fn_aceite_sugerido y fn_filtros_sugeridos.

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
  IF v_org IS NULL OR COALESCE(btrim(p_marca), '') = '' THEN
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

REVOKE ALL ON FUNCTION fn_aceite_sugerido(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_aceite_sugerido(TEXT, TEXT) TO authenticated;

-- ── Filtros ──────────────────────────────────────────────────────────────────
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
  IF v_org IS NULL OR COALESCE(btrim(p_marca), '') = '' THEN
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
    SELECT f.* FROM fuente f
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
    SELECT coalesce(repuesto_id::text, 'txt:' || lower(descripcion))     AS clave,
      (array_agg(repuesto_id           ORDER BY creado_en DESC))[1]      AS repuesto_id,
      (array_agg(descripcion           ORDER BY creado_en DESC))[1]      AS descripcion,
      (array_agg(cantidad              ORDER BY creado_en DESC))[1]      AS cantidad,
      (array_agg(precio_unitario       ORDER BY creado_en DESC))[1]      AS precio_unitario,
      (array_agg(costo_compra_unitario ORDER BY creado_en DESC))[1]      AS costo_compra_unitario,
      count(*) AS veces, max(creado_en) AS ultima
    FROM filtrado GROUP BY 1
    ORDER BY count(*) DESC, max(creado_en) DESC
    LIMIT 6
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('repuesto_id', repuesto_id, 'descripcion', descripcion,
    'cantidad', cantidad, 'precio_unitario', precio_unitario,
    'costo_compra_unitario', costo_compra_unitario, 'veces', veces)
    ORDER BY veces DESC, ultima DESC), '[]'::jsonb)
  INTO v_res FROM agrupado;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION fn_filtros_sugeridos(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_filtros_sugeridos(TEXT, TEXT) TO authenticated;
