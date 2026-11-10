-- 048 — Aceite sugerido según historial de vehículos similares.
--
-- Para la cotización "desde mensaje": dado marca+modelo, devuelve el aceite que
-- el taller suele usar en vehículos iguales, mirando los cambios de aceite ya
-- registrados (items_reparacion). "Similar" = misma marca+modelo; si no hay
-- historial de ese modelo, cae a misma marca. Identifica el aceite por repuesto
-- de categoría 'aceites_lubricantes', o por descripción con "aceite" (y sin
-- "filtro", para no confundir con el filtro de aceite). Devuelve el más usado
-- (desempata por más reciente), o NULL si no hay historial.

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

  WITH aceites AS (
    SELECT
      ir.repuesto_id,
      ir.descripcion,
      ir.costo_unitario,
      ir.costo_compra_unitario,
      ir.creado_en,
      (lower(v.modelo) = lower(p_modelo)) AS mismo_modelo
    FROM items_reparacion ir
    JOIN reparaciones    r ON r.id = ir.reparacion_id
    JOIN ordenes_trabajo o ON o.id = r.orden_trabajo_id
    JOIN vehiculos       v ON v.id = o.vehiculo_id
    LEFT JOIN repuestos rep ON rep.id = ir.repuesto_id
    WHERE ir.org_id = v_org
      AND o.org_id  = v_org
      AND ir.eliminado_en IS NULL
      AND lower(v.marca) = lower(p_marca)
      AND (
        rep.categoria = 'aceites_lubricantes'
        OR (lower(ir.descripcion) LIKE '%aceite%' AND lower(ir.descripcion) NOT LIKE '%filtro%')
      )
  ),
  -- Si hay registros del mismo modelo, se usan SOLO esos; si no, se cae a marca.
  filtrado AS (
    SELECT * FROM aceites
    WHERE mismo_modelo = true
       OR NOT EXISTS (SELECT 1 FROM aceites WHERE mismo_modelo = true)
  ),
  agrupado AS (
    SELECT
      coalesce(repuesto_id::text, 'txt:' || lower(descripcion))              AS clave,
      (array_agg(repuesto_id           ORDER BY creado_en DESC))[1]          AS repuesto_id,
      (array_agg(descripcion           ORDER BY creado_en DESC))[1]          AS descripcion,
      (array_agg(costo_unitario        ORDER BY creado_en DESC))[1]          AS precio_unitario,
      (array_agg(costo_compra_unitario ORDER BY creado_en DESC))[1]          AS costo_compra_unitario,
      count(*)                                                               AS veces,
      max(creado_en)                                                         AS ultima
    FROM filtrado
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'repuesto_id',           repuesto_id,
    'descripcion',           descripcion,
    'precio_unitario',       precio_unitario,
    'costo_compra_unitario', costo_compra_unitario,
    'veces',                 veces
  )
  INTO v_res
  FROM agrupado
  ORDER BY veces DESC, ultima DESC
  LIMIT 1;

  RETURN v_res;  -- NULL si no hay historial
END;
$$;

REVOKE ALL ON FUNCTION fn_aceite_sugerido(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_aceite_sugerido(TEXT, TEXT) TO authenticated;
