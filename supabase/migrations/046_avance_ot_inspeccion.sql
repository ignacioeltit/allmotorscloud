-- 046 — El link de avance también muestra los puntos de la inspección que
-- requieren atención u observación (de inspecciones_ot, migración 044), con su
-- etiqueta legible. Reemplaza la función de la 039 agregando `inspeccion`.
-- Las etiquetas R1..R14 viven en el frontend; acá se mapean con un CASE fijo.

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
  v_insp   JSONB;
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

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('tipo', ir.tipo, 'descripcion', ir.descripcion,
                       'cantidad', ir.cantidad, 'total', ir.costo_total)
    ORDER BY ir.creado_en), '[]'::jsonb)
  INTO v_trab
  FROM items_reparacion ir
  JOIN reparaciones r ON r.id = ir.reparacion_id
  WHERE r.orden_trabajo_id = v_ot.id AND ir.eliminado_en IS NULL;

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

  -- Puntos de inspección que requieren atención u observación, con etiqueta.
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'punto', CASE p->>'codigo'
        WHEN 'R1'  THEN 'Revisión de luces'
        WHEN 'R2'  THEN 'Suspensión'
        WHEN 'R3'  THEN 'Niveles (aceite / refrigerante)'
        WHEN 'R4'  THEN 'Filtros'
        WHEN 'R5'  THEN 'Correas'
        WHEN 'R6'  THEN 'Frenos'
        WHEN 'R7'  THEN 'Dirección'
        WHEN 'R8'  THEN 'Tren delantero'
        WHEN 'R9'  THEN 'Neumáticos'
        WHEN 'R10' THEN 'Presión de inflado'
        WHEN 'R11' THEN 'Fugas de aceite motor'
        WHEN 'R12' THEN 'Batería'
        WHEN 'R13' THEN 'Plumillas'
        WHEN 'R14' THEN 'Nivel líquido limpiaparabrisas'
        ELSE p->>'codigo'
      END,
      'estado', p->>'estado',
      'nota', p->>'nota',
      'foto', p->>'foto'
    )
    ORDER BY (p->>'estado' = 'atencion') DESC
  ), '[]'::jsonb)
  INTO v_insp
  FROM inspecciones_ot i
  CROSS JOIN LATERAL jsonb_array_elements(i.puntos) AS p
  WHERE i.orden_trabajo_id = v_ot.id
    AND p->>'estado' IN ('observacion', 'atencion');

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
    'inspeccion', v_insp,
    'total_con_iva', COALESCE(v_total, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION fn_avance_ot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_avance_ot(UUID) TO anon, authenticated;
