-- ============================================================
-- Migration 017 — fn_crear_cotizacion: cotización suelta atómica
--
-- Crea una cotización (presupuesto sin OT) en UNA transacción: cliente (si es
-- nuevo) + vehículo (si es nuevo) + propietario + presupuesto en 'borrador'.
-- Los ítems se agregan después vía addItemPresupuesto.
--
-- SECURITY INVOKER: cada INSERT pasa por las policies RLS del usuario que llama
-- (admin / jefe_taller / recepcionista), igual que fn_recibir_vehiculo.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_crear_cotizacion(
  p_cliente_id  UUID DEFAULT NULL,
  p_cliente     JSONB DEFAULT NULL,
  p_vehiculo_id UUID DEFAULT NULL,
  p_vehiculo    JSONB DEFAULT NULL,
  p_notas       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_org         UUID := mi_org_id();
  v_user        UUID := auth.uid();
  v_cliente_id  UUID := p_cliente_id;
  v_vehiculo_id UUID := p_vehiculo_id;
  v_presupuesto UUID;
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

  -- 2) Vehículo: usar existente o crear (trigger crea su historia técnica 1:1)
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

    INSERT INTO propietarios_vehiculo (vehiculo_id, cliente_id, org_id, creado_por)
    VALUES (v_vehiculo_id, v_cliente_id, v_org, v_user);
  ELSE
    -- Vehículo existente sin propietario activo → vincular
    IF NOT EXISTS (
      SELECT 1 FROM propietarios_vehiculo
      WHERE org_id = v_org AND vehiculo_id = v_vehiculo_id AND fecha_fin IS NULL
    ) THEN
      INSERT INTO propietarios_vehiculo (vehiculo_id, cliente_id, org_id, creado_por)
      VALUES (v_vehiculo_id, v_cliente_id, v_org, v_user);
    END IF;
  END IF;

  -- 3) Presupuesto en borrador, sin OT, con cliente + vehículo directos
  INSERT INTO presupuestos (org_id, orden_trabajo_id, cliente_id, vehiculo_id, notas, creado_por)
  VALUES (v_org, NULL, v_cliente_id, v_vehiculo_id, NULLIF(p_notas, ''), v_user)
  RETURNING id INTO v_presupuesto;

  RETURN jsonb_build_object(
    'presupuesto_id', v_presupuesto,
    'cliente_id', v_cliente_id,
    'vehiculo_id', v_vehiculo_id
  );
END;
$$;

REVOKE ALL ON FUNCTION fn_crear_cotizacion FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_crear_cotizacion TO authenticated;
