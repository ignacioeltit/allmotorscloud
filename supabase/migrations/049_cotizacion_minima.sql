-- 049 — Cotización con los mínimos datos (para no perder clientes).
--
-- Permite crear un presupuesto suelto sin vehículo y sin cliente (se completan
-- después). Antes se exigía OT o (cliente+vehículo). Cambios:
--   1. Se elimina el CHECK chk_presupuestos_atribuible.
--   2. La policy de INSERT valida la org de cada referencia SI está presente,
--      y permite que cliente/vehículo/OT sean NULL.
--   3. fn_crear_cotizacion deja de exigir cliente y vehículo: si no vienen, el
--      presupuesto queda sin ellos (y no crea propietario).

-- ── 1. Quitar la restricción "atribuible" ───────────────────────────────────
ALTER TABLE presupuestos DROP CONSTRAINT IF EXISTS chk_presupuestos_atribuible;

-- ── 2. RLS de INSERT: org-scope por referencia, todas opcionales ─────────────
DROP POLICY IF EXISTS "presupuestos_insert" ON presupuestos;
CREATE POLICY "presupuestos_insert"
  ON presupuestos FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
    AND (orden_trabajo_id IS NULL OR (SELECT org_id FROM ordenes_trabajo WHERE id = orden_trabajo_id) = mi_org_id())
    AND (cliente_id       IS NULL OR (SELECT org_id FROM clientes        WHERE id = cliente_id)        = mi_org_id())
    AND (vehiculo_id      IS NULL OR (SELECT org_id FROM vehiculos       WHERE id = vehiculo_id)       = mi_org_id())
  );

-- ── 3. fn_crear_cotizacion: cliente y vehículo opcionales ────────────────────
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

  -- 1) Cliente: existente, o crear si vienen datos; si no, queda sin cliente.
  IF v_cliente_id IS NULL AND p_cliente IS NOT NULL AND COALESCE(p_cliente->>'nombre', '') <> '' THEN
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

  -- 2) Vehículo: existente, o crear si viene patente; si no, queda sin vehículo.
  IF v_vehiculo_id IS NULL AND p_vehiculo IS NOT NULL AND COALESCE(p_vehiculo->>'patente', '') <> '' THEN
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
  END IF;

  -- Propietario: solo si hay vehículo Y cliente.
  IF v_vehiculo_id IS NOT NULL AND v_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM propietarios_vehiculo
      WHERE org_id = v_org AND vehiculo_id = v_vehiculo_id AND fecha_fin IS NULL
    ) THEN
      INSERT INTO propietarios_vehiculo (vehiculo_id, cliente_id, org_id, creado_por)
      VALUES (v_vehiculo_id, v_cliente_id, v_org, v_user);
    END IF;
  END IF;

  -- 3) Presupuesto en borrador, sin OT, con cliente/vehículo si los hay.
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
