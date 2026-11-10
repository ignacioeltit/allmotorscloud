-- 050 — Asociar un vehículo (y cliente) a una cotización creada con mínimos datos.
--
-- Para cerrar el ciclo de la "cotización sin vehículo": cuando el cliente llega
-- e identifica el auto, se asocia al presupuesto (buscando por patente o creando
-- el vehículo/cliente). Deja el presupuesto listo para convertir a OT.
--
-- INVOKER: cada INSERT/UPDATE pasa por las policies RLS del usuario (admin /
-- jefe_taller / recepcionista), igual que fn_crear_cotizacion.

CREATE OR REPLACE FUNCTION fn_asociar_vehiculo_cotizacion(
  p_presupuesto_id UUID,
  p_cliente_id     UUID  DEFAULT NULL,
  p_cliente        JSONB DEFAULT NULL,
  p_vehiculo_id    UUID  DEFAULT NULL,
  p_vehiculo       JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_org          UUID := mi_org_id();
  v_user         UUID := auth.uid();
  v_cliente_id   UUID := p_cliente_id;
  v_vehiculo_id  UUID := p_vehiculo_id;
  v_pres_cliente UUID;
  v_pres_veh     UUID;
  v_pres_ot      UUID;
BEGIN
  IF v_org IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: falta org o usuario.';
  END IF;

  -- Seguridad (cross-tenant): los ids vienen del cliente. Si se pasa un
  -- vehiculo_id/cliente_id existente, debe pertenecer a la organización.
  IF p_vehiculo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM vehiculos WHERE id = p_vehiculo_id AND org_id = v_org AND eliminado_en IS NULL
  ) THEN
    RAISE EXCEPTION 'Vehículo no encontrado.';
  END IF;
  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clientes WHERE id = p_cliente_id AND org_id = v_org AND eliminado_en IS NULL
  ) THEN
    RAISE EXCEPTION 'Cliente no encontrado.';
  END IF;

  -- El presupuesto debe ser del tenant, suelto (sin OT) y sin vehículo aún.
  SELECT cliente_id, vehiculo_id, orden_trabajo_id
    INTO v_pres_cliente, v_pres_veh, v_pres_ot
    FROM presupuestos
   WHERE id = p_presupuesto_id AND org_id = v_org AND eliminado_en IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotización no encontrada.';
  END IF;
  IF v_pres_ot IS NOT NULL THEN
    RAISE EXCEPTION 'La cotización ya está ligada a una orden de trabajo.';
  END IF;
  IF v_pres_veh IS NOT NULL THEN
    RAISE EXCEPTION 'La cotización ya tiene un vehículo asociado.';
  END IF;

  -- Cliente: usar el del presupuesto si ya tiene; si no, el indicado o uno nuevo.
  IF v_pres_cliente IS NOT NULL THEN
    v_cliente_id := v_pres_cliente;
  ELSIF v_cliente_id IS NULL AND p_cliente IS NOT NULL AND COALESCE(p_cliente->>'nombre', '') <> '' THEN
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

  -- Vehículo: usar existente o crear (requiere patente).
  IF v_vehiculo_id IS NULL THEN
    IF p_vehiculo IS NULL OR COALESCE(p_vehiculo->>'patente', '') = '' THEN
      RAISE EXCEPTION 'Falta el vehículo (patente).';
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
  END IF;

  -- Propietario si hay vehículo + cliente y el vehículo no tiene dueño activo.
  IF v_vehiculo_id IS NOT NULL AND v_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM propietarios_vehiculo
      WHERE org_id = v_org AND vehiculo_id = v_vehiculo_id AND fecha_fin IS NULL
    ) THEN
      INSERT INTO propietarios_vehiculo (vehiculo_id, cliente_id, org_id, creado_por)
      VALUES (v_vehiculo_id, v_cliente_id, v_org, v_user);
    END IF;
  END IF;

  -- Asociar al presupuesto (solo rellena lo que faltaba).
  UPDATE presupuestos
     SET vehiculo_id = v_vehiculo_id,
         cliente_id  = COALESCE(cliente_id, v_cliente_id)
   WHERE id = p_presupuesto_id AND org_id = v_org;

  RETURN jsonb_build_object(
    'presupuesto_id', p_presupuesto_id,
    'cliente_id', v_cliente_id,
    'vehiculo_id', v_vehiculo_id
  );
END;
$$;

REVOKE ALL ON FUNCTION fn_asociar_vehiculo_cotizacion FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_asociar_vehiculo_cotizacion TO authenticated;
