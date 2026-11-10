-- 052 — Filtros sugeridos según historial de vehículos similares.
--
-- Como el aceite (fn_aceite_sugerido), pero devuelve la LISTA de filtros que el
-- taller suele usar en vehículos iguales (aire, aceite, polen, combustible…).
-- "Similar" = misma marca+modelo; si no hay historial del modelo, cae a marca.
-- Un filtro = repuesto de categoría 'filtros', o ítem de tipo 'repuesto' cuya
-- descripción contiene "filtro". Devuelve un arreglo JSONB (vacío si no hay).

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

  WITH filtros AS (
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
        rep.categoria = 'filtros'
        OR (ir.tipo = 'repuesto' AND lower(ir.descripcion) LIKE '%filtro%')
      )
  ),
  filtrado AS (
    SELECT * FROM filtros
    WHERE mismo_modelo = true
       OR NOT EXISTS (SELECT 1 FROM filtros WHERE mismo_modelo = true)
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
    ORDER BY count(*) DESC, max(creado_en) DESC
    LIMIT 6
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'repuesto_id',           repuesto_id,
           'descripcion',           descripcion,
           'precio_unitario',       precio_unitario,
           'costo_compra_unitario', costo_compra_unitario,
           'veces',                 veces
         ) ORDER BY veces DESC, ultima DESC), '[]'::jsonb)
  INTO v_res
  FROM agrupado;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION fn_filtros_sugeridos(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_filtros_sugeridos(TEXT, TEXT) TO authenticated;
