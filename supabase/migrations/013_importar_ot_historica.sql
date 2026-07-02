-- ============================================================
-- Migration 013 — fn_importar_ot_historica: carga atómica de una OT de TallerGP
--
-- Recibe una OT ya respaldada (JSON crudo de la API de TallerGP) y la inserta
-- en el modelo de All Motors en UNA transacción:
--   ordenes_trabajo (cerrada) → eventos (cerrado) → reparaciones → items_reparacion
--
-- SECURITY DEFINER + OWNER postgres: la ejecuta el importador con service_role,
-- que ya bypassa RLS; se mantiene DEFINER para poder setear creado_en/cerrado_en
-- históricos y estados terminales sin pelear con las policies de usuario.
--
-- Idempotente: si ya existe una OT con ese numero_ot en la org, no hace nada
-- y devuelve {skipped:true}. El vehículo se resuelve por origen_tallergp_id;
-- si no está importado, devuelve {error:'vehiculo_no_encontrado'}.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_importar_ot_historica(
  p_org_id   UUID,
  p_user_id  UUID,
  p_ot       JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehiculo_id  UUID;
  v_historia_id  UUID;
  v_ot_id        UUID;
  v_evento_id    UUID;
  v_reparacion_id UUID;
  v_tipo_reparacion UUID;
  v_numero       TEXT := p_ot->>'order_number';
  v_entrada      TIMESTAMPTZ;
  v_salida       TIMESTAMPTZ;
  v_km           INTEGER;
  v_desc         TEXT;
  v_linea        JSONB;
  v_grupo        TEXT;
  v_tipo_item    TEXT;
  v_count_items  INTEGER := 0;
BEGIN
  IF v_numero IS NULL OR v_numero = '' THEN
    RETURN jsonb_build_object('error', 'sin_numero_ot');
  END IF;

  -- Dedup por número de OT
  IF EXISTS (SELECT 1 FROM ordenes_trabajo WHERE org_id = p_org_id AND numero_ot = v_numero) THEN
    RETURN jsonb_build_object('skipped', true, 'numero_ot', v_numero);
  END IF;

  -- Vehículo por origen_tallergp_id
  SELECT id INTO v_vehiculo_id
  FROM vehiculos
  WHERE org_id = p_org_id AND origen_tallergp_id = p_ot->>'vehicle_id' AND eliminado_en IS NULL;

  IF v_vehiculo_id IS NULL THEN
    RETURN jsonb_build_object('error', 'vehiculo_no_encontrado', 'numero_ot', v_numero);
  END IF;

  SELECT id INTO v_historia_id
  FROM historias_tecnicas
  WHERE org_id = p_org_id AND vehiculo_id = v_vehiculo_id;

  IF v_historia_id IS NULL THEN
    RETURN jsonb_build_object('error', 'historia_no_encontrada', 'numero_ot', v_numero);
  END IF;

  -- Fechas: "DD/MM/YYYY HH:MM" → timestamptz. Si falta salida, usar entrada.
  v_entrada := to_timestamp(NULLIF(p_ot->>'entry_datetime_formatted', ''), 'DD/MM/YYYY HH24:MI');
  v_salida  := to_timestamp(NULLIF(p_ot->>'exit_datetime_formatted', ''),  'DD/MM/YYYY HH24:MI');
  IF v_entrada IS NULL THEN v_entrada := NOW(); END IF;
  IF v_salida  IS NULL THEN v_salida  := v_entrada; END IF;
  v_km   := NULLIF(p_ot->>'kilometres', '')::INTEGER;
  v_desc := NULLIF(p_ot->>'breakdown_description', '');

  SELECT id INTO v_tipo_reparacion
  FROM tipos_evento WHERE org_id = p_org_id AND slug = 'reparacion' LIMIT 1;

  -- 1) OT cerrada (historial). cerrado_en explícito: el CHECK lo exige y el
  --    trigger set_cerrado_en es solo BEFORE UPDATE, no pisa este valor.
  INSERT INTO ordenes_trabajo (org_id, vehiculo_id, numero_ot, estado, km_ingreso, notas, cerrado_en, creado_en, creado_por)
  VALUES (p_org_id, v_vehiculo_id, v_numero, 'cerrada', v_km, v_desc, v_salida, v_entrada, p_user_id)
  RETURNING id INTO v_ot_id;

  -- 2) Evento cerrado, ligado a la OT
  INSERT INTO eventos (historia_tecnica_id, org_id, tipo_evento_id, orden_trabajo_id, estado, titulo, descripcion, km_vehiculo, cerrado_en, creado_en, creado_por)
  VALUES (v_historia_id, p_org_id, v_tipo_reparacion, v_ot_id, 'cerrado', v_numero, v_desc, v_km, v_salida, v_entrada, p_user_id)
  RETURNING id INTO v_evento_id;

  -- 3) Reparación que agrupa las líneas
  INSERT INTO reparaciones (org_id, orden_trabajo_id, evento_trabajo_id, descripcion, fin_en, creado_en, creado_por)
  VALUES (p_org_id, v_ot_id, v_evento_id, v_desc, v_salida, v_entrada, p_user_id)
  RETURNING id INTO v_reparacion_id;

  -- 4) Líneas: labor → mano_obra; parts/other/paint/wheels → repuesto
  FOR v_grupo, v_tipo_item IN
    SELECT * FROM (VALUES
      ('labor', 'mano_obra'),
      ('parts', 'repuesto'),
      ('other', 'repuesto'),
      ('paint', 'repuesto'),
      ('wheels', 'repuesto')
    ) AS g(grupo, tipo)
  LOOP
    FOR v_linea IN SELECT * FROM jsonb_array_elements(COALESCE(p_ot->v_grupo, '[]'::jsonb))
    LOOP
      INSERT INTO items_reparacion (org_id, reparacion_id, tipo, descripcion, cantidad, costo_unitario, costo_total, creado_en, creado_por)
      VALUES (
        p_org_id,
        v_reparacion_id,
        v_tipo_item,
        COALESCE(NULLIF(v_linea->>'description', ''), '(sin descripción)'),
        COALESCE(NULLIF(v_linea->>'quantity', '')::NUMERIC, 1),
        COALESCE(NULLIF(v_linea->>'unit_price_net', '')::NUMERIC, 0),
        COALESCE(NULLIF(v_linea->>'total_line_amount_net_calculated', '')::NUMERIC, 0),
        v_entrada,
        p_user_id
      );
      v_count_items := v_count_items + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'numero_ot', v_numero,
    'orden_trabajo_id', v_ot_id,
    'items', v_count_items
  );
END;
$$;

ALTER FUNCTION fn_importar_ot_historica(UUID, UUID, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION fn_importar_ot_historica(UUID, UUID, JSONB) FROM PUBLIC;
