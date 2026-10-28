-- 045 — POS mostrador: venta directa de repuestos/productos sin OT.
-- Sin arqueo de caja (decisión del taller): la venta entra a finanzas como
-- ingreso y descuenta stock del inventario. Todo en una transacción vía RPC.

CREATE TABLE IF NOT EXISTS ventas_mostrador (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizaciones(id),
  folio         INTEGER NOT NULL,                       -- correlativo por tenant
  cliente_id    UUID REFERENCES clientes(id) ON DELETE SET NULL,  -- opcional (walk-in)
  metodo_pago   TEXT NOT NULL DEFAULT 'efectivo',
  subtotal_neto NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva           NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,        -- con IVA (lo que paga el cliente)
  notas         TEXT,
  creado_por    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  anulada_en    TIMESTAMPTZ,
  anulada_por   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT uq_venta_folio UNIQUE (org_id, folio)
);

CREATE TABLE IF NOT EXISTS items_venta_mostrador (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizaciones(id),
  venta_id        UUID NOT NULL REFERENCES ventas_mostrador(id) ON DELETE CASCADE,
  repuesto_id     UUID REFERENCES repuestos(id) ON DELETE SET NULL,  -- null = ítem libre
  descripcion     TEXT NOT NULL DEFAULT '',
  cantidad        NUMERIC(12,2) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,                -- con IVA
  total           NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_venta_mostrador_org  ON ventas_mostrador (org_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_item_venta_mostrador ON items_venta_mostrador (org_id, venta_id);

ALTER TABLE ventas_mostrador      ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_venta_mostrador ENABLE ROW LEVEL SECURITY;

-- Lectura: todo el tenant. Escritura directa: solo gestión (igual la hace el RPC).
CREATE POLICY venta_select ON ventas_mostrador
  FOR SELECT TO authenticated USING (org_id = mi_org_id());
CREATE POLICY venta_update ON ventas_mostrador
  FOR UPDATE TO authenticated
  USING (org_id = mi_org_id() AND mi_rol() IN ('admin','jefe_taller','recepcionista'))
  WITH CHECK (org_id = mi_org_id());
CREATE POLICY item_venta_select ON items_venta_mostrador
  FOR SELECT TO authenticated USING (org_id = mi_org_id());

GRANT SELECT, UPDATE ON ventas_mostrador TO authenticated;
GRANT SELECT ON items_venta_mostrador TO authenticated;

-- ── RPC transaccional: registra la venta completa ────────────────────────────
-- Inserta venta + ítems, descuenta stock (vía movimientos_stock, el trigger
-- fn_actualizar_stock_repuesto ajusta stock_actual) y registra el ingreso en
-- finanzas. SECURITY DEFINER: valida tenant y rol manualmente.
CREATE OR REPLACE FUNCTION fn_registrar_venta_mostrador(
  p_items       JSONB,
  p_cliente_id  UUID DEFAULT NULL,
  p_metodo_pago TEXT DEFAULT 'efectivo',
  p_notas       TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org   UUID := mi_org_id();
  v_user  UUID := auth.uid();
  v_rol   TEXT := mi_rol();
  v_venta UUID;
  v_folio INTEGER;
  v_total NUMERIC := 0;
  v_neto  NUMERIC;
  v_iva   NUMERIC;
  v_item  JSONB;
  v_rep   UUID;
  v_cant  NUMERIC;
  v_precio NUMERIC;
  v_line  NUMERIC;
  v_stock NUMERIC;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Sin organización'; END IF;
  IF v_rol NOT IN ('admin','jefe_taller','recepcionista') THEN
    RAISE EXCEPTION 'Sin permiso para registrar ventas';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta no tiene ítems';
  END IF;

  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clientes c
    WHERE c.id = p_cliente_id AND c.org_id = v_org AND c.eliminado_en IS NULL
  ) THEN
    RAISE EXCEPTION 'Cliente inválido';
  END IF;

  SELECT COALESCE(MAX(folio), 0) + 1 INTO v_folio FROM ventas_mostrador WHERE org_id = v_org;

  INSERT INTO ventas_mostrador (org_id, folio, cliente_id, metodo_pago, notas, creado_por)
  VALUES (v_org, v_folio, p_cliente_id, COALESCE(p_metodo_pago, 'efectivo'), p_notas, v_user)
  RETURNING id INTO v_venta;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_rep    := NULLIF(v_item->>'repuesto_id', '')::uuid;
    v_cant   := COALESCE((v_item->>'cantidad')::numeric, 0);
    v_precio := COALESCE((v_item->>'precio_unitario')::numeric, 0);
    IF v_cant <= 0 OR v_precio < 0 THEN RAISE EXCEPTION 'Ítem inválido'; END IF;
    v_line := round(v_cant * v_precio);

    IF v_rep IS NOT NULL THEN
      SELECT stock_actual INTO v_stock FROM repuestos
      WHERE id = v_rep AND org_id = v_org AND eliminado_en IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'Repuesto inválido'; END IF;
    END IF;

    INSERT INTO items_venta_mostrador (org_id, venta_id, repuesto_id, descripcion, cantidad, precio_unitario, total)
    VALUES (v_org, v_venta, v_rep, COALESCE(v_item->>'descripcion', ''), v_cant, v_precio, v_line);

    IF v_rep IS NOT NULL THEN
      INSERT INTO movimientos_stock
        (org_id, repuesto_id, tipo, cantidad, stock_antes, stock_despues, referencia_tipo, referencia_id, motivo, actor_id)
      VALUES
        (v_org, v_rep, 'salida', v_cant, v_stock, GREATEST(0, v_stock - v_cant),
         'venta_mostrador', v_venta, 'Venta mostrador #' || v_folio, v_user);
    END IF;

    v_total := v_total + v_line;
  END LOOP;

  v_neto := round(v_total / 1.19);
  v_iva  := v_total - v_neto;

  UPDATE ventas_mostrador
     SET subtotal_neto = v_neto, iva = v_iva, total = v_total
   WHERE id = v_venta;

  INSERT INTO movimientos_financieros (org_id, tipo, monto, fecha, categoria, descripcion, forma_pago, creado_por)
  VALUES (v_org, 'ingreso', v_total, CURRENT_DATE, 'pago_mostrador',
          'Venta mostrador #' || v_folio, COALESCE(p_metodo_pago, 'efectivo'), v_user);

  RETURN v_venta;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_registrar_venta_mostrador(JSONB, UUID, TEXT, TEXT) TO authenticated;
