-- 054 — fn_aceite_sugerido: detectar el ACEITE PRODUCTO, no un insumo/mano de obra.
--
-- El aceite real suele llamarse por marca+grado (ej. "PETRONAS SYNTIUM 5000 XS
-- 5W30") y NO contiene la palabra "aceite", así que no se pescaba; en cambio
-- "INSUMOS BASICOS RENOVAR ACEITE MOTOR" sí la tiene y se colaba.
--
-- Ahora un candidato a aceite es un ítem que NO es mano de obra, no es filtro ni
-- insumo/renovar/servicio, y además: es de categoría 'aceites_lubricantes', O
-- tiene un grado SAE en la descripción (5w30, 10w-40…), O contiene "aceite".
-- Se prioriza el que tiene grado SAE (es casi seguro el aceite producto).

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
  candidatos AS (
    SELECT f.*,
      CASE
        WHEN lower(f.descripcion) ~ '[0-9]{1,2}w-?[0-9]{2}' THEN 3  -- grado SAE → casi seguro el aceite
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
      (array_agg(precio_unitario       ORDER BY creado_en DESC))[1]      AS precio_unitario,
      (array_agg(costo_compra_unitario ORDER BY creado_en DESC))[1]      AS costo_compra_unitario,
      max(score) AS score, count(*) AS veces, max(creado_en) AS ultima
    FROM filtrado GROUP BY 1
  )
  SELECT jsonb_build_object('repuesto_id', repuesto_id, 'descripcion', descripcion,
    'precio_unitario', precio_unitario, 'costo_compra_unitario', costo_compra_unitario, 'veces', veces)
  INTO v_res FROM agrupado
  ORDER BY score DESC, veces DESC, ultima DESC
  LIMIT 1;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION fn_aceite_sugerido(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_aceite_sugerido(TEXT, TEXT) TO authenticated;
