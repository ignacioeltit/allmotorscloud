-- 053 — Aceite/filtros sugeridos: mirar también el historial de COTIZACIONES.
--
-- Las funciones 051/052 solo miraban trabajos ejecutados (items_reparacion),
-- pero el historial del taller (p.ej. presupuestos importados de TallerGP) vive
-- sobre todo en items_presupuesto. Ahora ambas unen las dos fuentes: trabajos
-- (OT) + cotizaciones (presupuestos con vehículo), para marca+modelo (fallback
-- marca). Así deduce el aceite y los filtros reales del modelo aunque no haya
-- OTs ejecutadas, solo cotizaciones.

-- ── Aceite (un solo producto) ────────────────────────────────────────────────
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
    -- Trabajos ejecutados (OT)
    SELECT ir.repuesto_id, ir.descripcion, ir.costo_unitario::numeric AS precio_unitario,
           ir.costo_compra_unitario::numeric AS costo_compra_unitario, ir.creado_en, ir.tipo,
           (lower(v.modelo) = lower(p_modelo)) AS mismo_modelo
    FROM items_reparacion ir
    JOIN reparaciones    r ON r.id = ir.reparacion_id
    JOIN ordenes_trabajo o ON o.id = r.orden_trabajo_id
    JOIN vehiculos       v ON v.id = o.vehiculo_id
    WHERE ir.org_id = v_org AND o.org_id = v_org AND ir.eliminado_en IS NULL
      AND lower(v.marca) = lower(p_marca)
    UNION ALL
    -- Cotizaciones con vehículo (presupuestos)
    SELECT ip.repuesto_id, ip.descripcion, ip.precio_unitario::numeric,
           NULL::numeric, ip.creado_en, ip.tipo,
           (lower(v.modelo) = lower(p_modelo)) AS mismo_modelo
    FROM items_presupuesto ip
    JOIN presupuestos pr ON pr.id = ip.presupuesto_id
    JOIN vehiculos    v  ON v.id = pr.vehiculo_id
    WHERE ip.org_id = v_org AND pr.org_id = v_org
      AND ip.eliminado_en IS NULL AND pr.eliminado_en IS NULL
      AND lower(v.marca) = lower(p_marca)
  ),
  aceites AS (
    SELECT f.* FROM fuente f
    LEFT JOIN repuestos rep ON rep.id = f.repuesto_id
    WHERE rep.categoria = 'aceites_lubricantes'
       OR (f.tipo = 'repuesto' AND lower(f.descripcion) LIKE '%aceite%' AND lower(f.descripcion) NOT LIKE '%filtro%')
  ),
  filtrado AS (
    SELECT * FROM aceites
    WHERE mismo_modelo = true OR NOT EXISTS (SELECT 1 FROM aceites WHERE mismo_modelo = true)
  ),
  agrupado AS (
    SELECT coalesce(repuesto_id::text, 'txt:' || lower(descripcion))     AS clave,
      (array_agg(repuesto_id           ORDER BY creado_en DESC))[1]      AS repuesto_id,
      (array_agg(descripcion           ORDER BY creado_en DESC))[1]      AS descripcion,
      (array_agg(precio_unitario       ORDER BY creado_en DESC))[1]      AS precio_unitario,
      (array_agg(costo_compra_unitario ORDER BY creado_en DESC))[1]      AS costo_compra_unitario,
      count(*) AS veces, max(creado_en) AS ultima
    FROM filtrado GROUP BY 1
  )
  SELECT jsonb_build_object('repuesto_id', repuesto_id, 'descripcion', descripcion,
    'precio_unitario', precio_unitario, 'costo_compra_unitario', costo_compra_unitario, 'veces', veces)
  INTO v_res FROM agrupado ORDER BY veces DESC, ultima DESC LIMIT 1;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION fn_aceite_sugerido(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_aceite_sugerido(TEXT, TEXT) TO authenticated;

-- ── Filtros (lista) ──────────────────────────────────────────────────────────
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
    SELECT ir.repuesto_id, ir.descripcion, ir.costo_unitario::numeric AS precio_unitario,
           ir.costo_compra_unitario::numeric AS costo_compra_unitario, ir.creado_en, ir.tipo,
           (lower(v.modelo) = lower(p_modelo)) AS mismo_modelo
    FROM items_reparacion ir
    JOIN reparaciones    r ON r.id = ir.reparacion_id
    JOIN ordenes_trabajo o ON o.id = r.orden_trabajo_id
    JOIN vehiculos       v ON v.id = o.vehiculo_id
    WHERE ir.org_id = v_org AND o.org_id = v_org AND ir.eliminado_en IS NULL
      AND lower(v.marca) = lower(p_marca)
    UNION ALL
    SELECT ip.repuesto_id, ip.descripcion, ip.precio_unitario::numeric,
           NULL::numeric, ip.creado_en, ip.tipo,
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
    WHERE rep.categoria = 'filtros'
       OR (f.tipo = 'repuesto' AND lower(f.descripcion) LIKE '%filtro%')
  ),
  filtrado AS (
    SELECT * FROM filtros
    WHERE mismo_modelo = true OR NOT EXISTS (SELECT 1 FROM filtros WHERE mismo_modelo = true)
  ),
  agrupado AS (
    SELECT coalesce(repuesto_id::text, 'txt:' || lower(descripcion))     AS clave,
      (array_agg(repuesto_id           ORDER BY creado_en DESC))[1]      AS repuesto_id,
      (array_agg(descripcion           ORDER BY creado_en DESC))[1]      AS descripcion,
      (array_agg(precio_unitario       ORDER BY creado_en DESC))[1]      AS precio_unitario,
      (array_agg(costo_compra_unitario ORDER BY creado_en DESC))[1]      AS costo_compra_unitario,
      count(*) AS veces, max(creado_en) AS ultima
    FROM filtrado GROUP BY 1
    ORDER BY count(*) DESC, max(creado_en) DESC
    LIMIT 6
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('repuesto_id', repuesto_id, 'descripcion', descripcion,
    'precio_unitario', precio_unitario, 'costo_compra_unitario', costo_compra_unitario, 'veces', veces)
    ORDER BY veces DESC, ultima DESC), '[]'::jsonb)
  INTO v_res FROM agrupado;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION fn_filtros_sugeridos(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_filtros_sugeridos(TEXT, TEXT) TO authenticated;
