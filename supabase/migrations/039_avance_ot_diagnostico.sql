-- 039 — La vista pública de avance (fn_avance_ot) también muestra los hallazgos
-- del mecánico (eventos tipo 'diagnostico') que se marcaron visibles al cliente.
-- Así el cliente ve, en el mismo link de las fotos, las notas del diagnóstico.
-- Reemplaza la función de la 037 agregando `diagnosticos`.

CREATE OR REPLACE FUNCTION fn_avance_ot(p_token UUID)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_ot     ordenes_trabajo%ROWTYPE;
  v_veh    RECORD;
  v_tal    RECORD;
  v_fotos  JSONB;
  v_trab   JSONB;
  v_diag   JSONB;
  v_total  NUMERIC;
BEGIN
  SELECT * INTO v_ot FROM ordenes_trabajo
  WHERE token_avance = p_token AND eliminado_en IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_encontrada');
  END IF;

  SELECT patente, marca, modelo, anio INTO v_veh FROM vehiculos WHERE id = v_ot.vehiculo_id;
  SELECT nombre, telefono, logo_url INTO v_tal FROM organizaciones WHERE id = v_ot.org_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('path', bucket_path, 'descripcion', descripcion, 'creado_en', creado_en)
    ORDER BY creado_en DESC), '[]'::jsonb)
  INTO v_fotos
  FROM evidencias
  WHERE orden_trabajo_id = v_ot.id AND visible_cliente = true AND tipo = 'foto';

  -- Líneas de la OT (mano de obra / repuestos / otros) con su total.
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('tipo', ir.tipo, 'descripcion', ir.descripcion,
                       'cantidad', ir.cantidad, 'total', ir.costo_total)
    ORDER BY ir.creado_en), '[]'::jsonb)
  INTO v_trab
  FROM items_reparacion ir
  JOIN reparaciones r ON r.id = ir.reparacion_id
  WHERE r.orden_trabajo_id = v_ot.id AND ir.eliminado_en IS NULL;

  -- Hallazgos del mecánico marcados visibles al cliente.
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('descripcion', e.descripcion, 'creado_en', e.creado_en)
    ORDER BY e.creado_en), '[]'::jsonb)
  INTO v_diag
  FROM eventos e
  JOIN tipos_evento te ON te.id = e.tipo_evento_id
  WHERE e.orden_trabajo_id = v_ot.id
    AND te.slug = 'diagnostico'
    AND e.visible_cliente = true
    AND e.eliminado_en IS NULL;

  SELECT total_con_iva INTO v_total FROM v_ot_totales WHERE id = v_ot.id;

  RETURN jsonb_build_object(
    'numero_ot', v_ot.numero_ot,
    'estado', v_ot.estado,
    'creado_en', v_ot.creado_en,
    'taller', jsonb_build_object('nombre', v_tal.nombre, 'telefono', v_tal.telefono, 'logo_url', v_tal.logo_url),
    'vehiculo', jsonb_build_object('patente', v_veh.patente, 'marca', v_veh.marca, 'modelo', v_veh.modelo, 'anio', v_veh.anio),
    'fotos', v_fotos,
    'trabajos', v_trab,
    'diagnosticos', v_diag,
    'total_con_iva', COALESCE(v_total, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION fn_avance_ot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_avance_ot(UUID) TO anon, authenticated;
