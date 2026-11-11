-- 056 — fn_filtros_sugeridos: devolver UN filtro por tipo (aire/aceite/polén/combustible).
--
-- Antes podía traer 3 filtros de aire (variantes de distintos modelos de la misma
-- marca) y ninguno de los otros tipos. Ahora clasifica cada filtro por subtipo y
-- devuelve el más usado de cada subtipo, para una propuesta limpia (un aire, un
-- aceite, un polén, un combustible), prefiriendo el historial del mismo modelo.

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

REVOKE ALL ON FUNCTION fn_filtros_sugeridos(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_filtros_sugeridos(TEXT, TEXT) TO authenticated;
