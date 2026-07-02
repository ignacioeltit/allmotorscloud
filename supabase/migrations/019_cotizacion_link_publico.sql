-- ============================================================
-- Migration 019 — Enlace público de cotización (autorizar/rechazar)
--
-- El taller genera un token imposible de adivinar y comparte el enlace. El
-- cliente (SIN login) entra, ve la cotización y la autoriza o rechaza, puede
-- dejar una nota e indicar que quiere agendar.
--
-- Seguridad: el acceso público NO usa las tablas directamente. Dos funciones
-- SECURITY DEFINER, gatilladas por el token, son la única superficie expuesta a
-- `anon`: una lee SOLO esa cotización, la otra registra la respuesta SOLO en esa
-- cotización. Ninguna permite listar ni tocar otros datos de la organización.
-- ============================================================

ALTER TABLE presupuestos
  ADD COLUMN token_publico       UUID,
  ADD COLUMN nota_cliente        TEXT,
  ADD COLUMN agendar_solicitado  BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX uq_presupuestos_token_publico
  ON presupuestos (token_publico)
  WHERE token_publico IS NOT NULL;

-- ── Lectura pública (por token) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_cotizacion_publica(p_token UUID)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_p presupuestos%ROWTYPE;
  v_taller RECORD;
  v_cliente RECORD;
  v_vehiculo RECORD;
  v_items JSONB;
BEGIN
  SELECT * INTO v_p FROM presupuestos
  WHERE token_publico = p_token AND eliminado_en IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_encontrada');
  END IF;

  SELECT nombre, rut, telefono, direccion, ciudad INTO v_taller
  FROM organizaciones WHERE id = v_p.org_id;

  SELECT nombre INTO v_cliente FROM clientes WHERE id = v_p.cliente_id;
  SELECT patente, marca, modelo, anio INTO v_vehiculo FROM vehiculos WHERE id = v_p.vehiculo_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('tipo', i.tipo, 'descripcion', i.descripcion,
                       'cantidad', i.cantidad, 'precio_total', i.precio_total)
    ORDER BY i.creado_en), '[]'::jsonb)
  INTO v_items
  FROM items_presupuesto i
  WHERE i.presupuesto_id = v_p.id AND i.eliminado_en IS NULL;

  RETURN jsonb_build_object(
    'estado', v_p.estado,
    'creado_en', v_p.creado_en,
    'total_mano_obra', v_p.total_mano_obra,
    'total_repuestos', v_p.total_repuestos,
    'total_otros', v_p.total_otros,
    'total_neto', v_p.total_neto,
    'nota_cliente', v_p.nota_cliente,
    'agendar_solicitado', v_p.agendar_solicitado,
    'taller', jsonb_build_object('nombre', v_taller.nombre, 'rut', v_taller.rut,
                                 'telefono', v_taller.telefono, 'direccion', v_taller.direccion,
                                 'ciudad', v_taller.ciudad),
    'cliente', jsonb_build_object('nombre', v_cliente.nombre),
    'vehiculo', jsonb_build_object('patente', v_vehiculo.patente, 'marca', v_vehiculo.marca,
                                   'modelo', v_vehiculo.modelo, 'anio', v_vehiculo.anio),
    'items', v_items
  );
END;
$$;

-- ── Respuesta pública (autorizar / rechazar) ─────────────────────────────────
CREATE OR REPLACE FUNCTION fn_responder_cotizacion(
  p_token   UUID,
  p_accion  TEXT,               -- 'autorizar' | 'rechazar'
  p_nota    TEXT DEFAULT NULL,
  p_agendar BOOLEAN DEFAULT false
)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_p presupuestos%ROWTYPE;
BEGIN
  IF p_accion NOT IN ('autorizar', 'rechazar') THEN
    RETURN jsonb_build_object('error', 'accion_invalida');
  END IF;

  SELECT * INTO v_p FROM presupuestos
  WHERE token_publico = p_token AND eliminado_en IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_encontrada');
  END IF;

  -- Bloqueado: solo se responde una vez, desde 'borrador' o 'enviado'.
  IF v_p.estado NOT IN ('borrador', 'enviado') THEN
    RETURN jsonb_build_object('error', 'ya_respondida', 'estado', v_p.estado);
  END IF;

  IF p_accion = 'autorizar' THEN
    UPDATE presupuestos SET
      estado = 'autorizado',
      autorizado_en = NOW(),
      nota_cliente = NULLIF(btrim(p_nota), ''),
      agendar_solicitado = COALESCE(p_agendar, false)
    WHERE id = v_p.id;
    RETURN jsonb_build_object('ok', true, 'estado', 'autorizado');
  ELSE
    UPDATE presupuestos SET
      estado = 'rechazado',
      rechazado_en = NOW(),
      razon_rechazo = NULLIF(btrim(p_nota), ''),
      nota_cliente = NULLIF(btrim(p_nota), ''),
      agendar_solicitado = COALESCE(p_agendar, false)
    WHERE id = v_p.id;
    RETURN jsonb_build_object('ok', true, 'estado', 'rechazado');
  END IF;
END;
$$;

ALTER FUNCTION fn_cotizacion_publica(UUID) OWNER TO postgres;
ALTER FUNCTION fn_responder_cotizacion(UUID, TEXT, TEXT, BOOLEAN) OWNER TO postgres;

REVOKE ALL ON FUNCTION fn_cotizacion_publica(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_responder_cotizacion(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_cotizacion_publica(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_responder_cotizacion(UUID, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
