-- ============================================================
-- Migration 025 — La autorización del cliente avanza la OT
--
-- Cuando el cliente autoriza por el enlace público un presupuesto que vive
-- dentro de una OT, la OT quedaba igual (ej: 'pendiente_diagnostico') y nada
-- reflejaba la aprobación — el taller no veía qué hacer después.
--
-- Ahora fn_responder_cotizacion, al autorizar, también mueve la OT a estado
-- 'autorizada' SI está en una etapa previa (pendiente_diagnostico,
-- diagnosticada, presupuesto_pendiente, presupuesto_enviado). Nunca retrocede
-- una OT que ya está en reparación o más allá.
-- ============================================================

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

    -- Presupuesto de una OT: la OT avanza a 'autorizada' si estaba en una
    -- etapa previa. No retrocede OTs ya en curso.
    IF v_p.orden_trabajo_id IS NOT NULL THEN
      UPDATE ordenes_trabajo SET estado = 'autorizada'
      WHERE id = v_p.orden_trabajo_id
        AND estado IN ('pendiente_diagnostico', 'diagnosticada',
                       'presupuesto_pendiente', 'presupuesto_enviado');
    END IF;

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

ALTER FUNCTION fn_responder_cotizacion(UUID, TEXT, TEXT, BOOLEAN) OWNER TO postgres;
REVOKE ALL ON FUNCTION fn_responder_cotizacion(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_responder_cotizacion(UUID, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
