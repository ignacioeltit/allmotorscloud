-- 051 — Fix fn_aceite_sugerido: tomar el ACEITE PRODUCTO, no una mano de obra.
--
-- El match por texto '%aceite%' agarraba líneas de mano de obra como
-- "RENOVAR ACEITE MOTOR". Ahora el match por descripción exige que el ítem sea
-- de tipo 'repuesto' (producto), además de preferir repuestos de categoría
-- 'aceites_lubricantes'. Así sugiere el aceite real (ej. PETRONAS 5W30).

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
        OR (
          ir.tipo = 'repuesto'
          AND lower(ir.descripcion) LIKE '%aceite%'
          AND lower(ir.descripcion) NOT LIKE '%filtro%'
        )
      )
  ),
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

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION fn_aceite_sugerido(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_aceite_sugerido(TEXT, TEXT) TO authenticated;
