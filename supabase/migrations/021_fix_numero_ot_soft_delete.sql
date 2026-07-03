-- ============================================================
-- Migration 021 — Correlativo de OT debe considerar las OT borradas en blando
--
-- Bug (encontrado 2026-07-03 al recibir un vehículo): fn_recibir_vehiculo es
-- SECURITY INVOKER, así que su MAX(numero_ot) corre con RLS y NO ve las OT con
-- eliminado_en (la policy de SELECT las oculta). Pero el UNIQUE(org_id,
-- numero_ot) sí las cuenta. Con la OT-000032 soft-deleteada, el MAX visible era
-- 31 → intentaba OT-000032 → unique_violation → recalculaba el MISMO máximo →
-- chocaba 4 veces → "No se pudo generar el número de OT".
--
-- Fix: helper fn_siguiente_numero_ot() SECURITY DEFINER que calcula el máximo
-- sobre TODAS las filas de la org (incluidas las borradas en blando). Devuelve
-- solo un entero y deriva la org de la sesión (mi_org_id()) — no expone datos.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_siguiente_numero_ot()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(substring(numero_ot FROM '^OT-(\d+)$')::INTEGER), 0) + 1
  FROM ordenes_trabajo
  WHERE org_id = mi_org_id()          -- org de la sesión; NULL → 1 (y el INSERT igual exige org)
    AND numero_ot ~ '^OT-\d+$';
$$;

REVOKE ALL ON FUNCTION fn_siguiente_numero_ot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_siguiente_numero_ot() TO authenticated;

-- fn_recibir_vehiculo: idéntica a la 012, salvo el paso 5 que ahora usa el helper.
CREATE OR REPLACE FUNCTION fn_recibir_vehiculo(
  p_tipo_evento_recepcion_id UUID,
  p_cliente_id               UUID DEFAULT NULL,
  p_cliente                  JSONB DEFAULT NULL,
  p_vehiculo_id              UUID DEFAULT NULL,
  p_vehiculo                 JSONB DEFAULT NULL,
  p_titulo                   TEXT DEFAULT 'Recepción del vehículo',
  p_descripcion              TEXT DEFAULT NULL,
  p_km                       INTEGER DEFAULT NULL,
  p_motivo                   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_org          UUID := mi_org_id();
  v_user         UUID := auth.uid();
  v_cliente_id   UUID := p_cliente_id;
  v_vehiculo_id  UUID := p_vehiculo_id;
  v_historia_id  UUID;
  v_ot           ordenes_trabajo%ROWTYPE;
  v_numero       TEXT;
  v_siguiente    INTEGER;
  v_intento      INTEGER;
BEGIN
  IF v_org IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: falta org o usuario.';
  END IF;

  -- 1) Cliente: usar existente o crear
  IF v_cliente_id IS NULL THEN
    IF p_cliente IS NULL OR COALESCE(p_cliente->>'nombre', '') = '' THEN
      RAISE EXCEPTION 'Falta el cliente.';
    END IF;
    INSERT INTO clientes (org_id, tipo, nombre, rut, telefono, email, direccion, creado_por)
    VALUES (
      v_org,
      COALESCE(p_cliente->>'tipo', 'persona_natural'),
      p_cliente->>'nombre',
      NULLIF(p_cliente->>'rut', ''),
      NULLIF(p_cliente->>'telefono', ''),
      NULLIF(p_cliente->>'email', ''),
      NULLIF(p_cliente->>'direccion', ''),
      v_user
    )
    RETURNING id INTO v_cliente_id;
  END IF;

  -- 2) Vehículo: usar existente o crear (el trigger crea la historia técnica 1:1)
  IF v_vehiculo_id IS NULL THEN
    IF p_vehiculo IS NULL OR COALESCE(p_vehiculo->>'patente', '') = '' THEN
      RAISE EXCEPTION 'Falta el vehículo.';
    END IF;
    INSERT INTO vehiculos (org_id, patente, vin, marca, modelo, anio, color, tipo, km_actual, notas, creado_por)
    VALUES (
      v_org,
      p_vehiculo->>'patente',
      NULLIF(p_vehiculo->>'vin', ''),
      p_vehiculo->>'marca',
      p_vehiculo->>'modelo',
      NULLIF(p_vehiculo->>'anio', '')::SMALLINT,
      NULLIF(p_vehiculo->>'color', ''),
      COALESCE(p_vehiculo->>'tipo', 'auto'),
      NULLIF(p_vehiculo->>'km_actual', '')::INTEGER,
      NULLIF(p_vehiculo->>'notas', ''),
      v_user
    )
    RETURNING id INTO v_vehiculo_id;

    -- Vehículo nuevo siempre queda vinculado al cliente
    INSERT INTO propietarios_vehiculo (vehiculo_id, cliente_id, org_id, creado_por)
    VALUES (v_vehiculo_id, v_cliente_id, v_org, v_user);
  ELSE
    -- Vehículo existente: vincular solo si no tiene propietario activo
    IF NOT EXISTS (
      SELECT 1 FROM propietarios_vehiculo
      WHERE org_id = v_org AND vehiculo_id = v_vehiculo_id AND fecha_fin IS NULL
    ) THEN
      INSERT INTO propietarios_vehiculo (vehiculo_id, cliente_id, org_id, creado_por)
      VALUES (v_vehiculo_id, v_cliente_id, v_org, v_user);
    END IF;
  END IF;

  -- 3) OT activa preexistente → reutilizar (invariante: una OT activa por vehículo)
  SELECT * INTO v_ot
  FROM ordenes_trabajo
  WHERE org_id = v_org
    AND vehiculo_id = v_vehiculo_id
    AND eliminado_en IS NULL
    AND estado NOT IN ('cerrada', 'cancelada')
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'orden_trabajo_id', v_ot.id,
      'numero_ot', v_ot.numero_ot,
      'reused', true
    );
  END IF;

  -- 4) Historia técnica (creada por trigger al insertar el vehículo)
  SELECT id INTO v_historia_id
  FROM historias_tecnicas
  WHERE org_id = v_org AND vehiculo_id = v_vehiculo_id;

  IF v_historia_id IS NULL THEN
    RAISE EXCEPTION 'El vehículo no tiene historia técnica.';
  END IF;

  -- 5) OT nueva. El correlativo lo da fn_siguiente_numero_ot() (SECURITY DEFINER:
  --    ve también las OT borradas en blando, que el UNIQUE cuenta igual).
  --    Ante colisión (recepciones simultáneas) se recalcula y reintenta.
  FOR v_intento IN 1..4 LOOP
    v_siguiente := fn_siguiente_numero_ot();
    v_numero := 'OT-' || lpad(v_siguiente::TEXT, 6, '0');

    BEGIN
      INSERT INTO ordenes_trabajo (org_id, vehiculo_id, numero_ot, km_ingreso, notas, creado_por)
      VALUES (v_org, v_vehiculo_id, v_numero, p_km, NULLIF(p_motivo, ''), v_user)
      RETURNING * INTO v_ot;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_intento = 4 THEN
        RAISE EXCEPTION 'No se pudo generar el número de OT. Inténtalo de nuevo.';
      END IF;
    END;
  END LOOP;

  -- 6) Evento de recepción ligado a la OT
  INSERT INTO eventos (
    historia_tecnica_id, org_id, tipo_evento_id, orden_trabajo_id,
    titulo, descripcion, km_vehiculo, creado_por
  )
  VALUES (
    v_historia_id, v_org, p_tipo_evento_recepcion_id, v_ot.id,
    p_titulo, p_descripcion, p_km, v_user
  );

  RETURN jsonb_build_object(
    'orden_trabajo_id', v_ot.id,
    'numero_ot', v_ot.numero_ot,
    'reused', false
  );
END;
$$;
