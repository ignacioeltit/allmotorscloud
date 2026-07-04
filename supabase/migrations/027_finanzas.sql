-- ============================================================
-- Migration 027 — Finanzas: cuentas por cobrar + libro de ingresos y gastos
--
-- Dos necesidades del taller (2026-07-04, con Ignacio):
--  1) Cliente a crédito (paga a 30 días): al entregar se factura de inmediato
--     (se guarda el N° de factura fiscal) pero se marca NO pagada; luego se
--     cobra y se marca pagada.
--  2) Registro de ingresos y gastos: dónde queda que "me pagaron una OT" y
--     dónde se anotan los gastos del taller.
--
-- Modelo:
--  - `entregas` gana la parte de facturación/cobro (numero_factura,
--    tipo_documento, condicion_pago, estado_pago, vence_en, pagado_en) + policy
--    UPDATE (antes solo select/insert) para poder marcar pagada más tarde.
--  - `movimientos_financieros` = libro de caja: cada ingreso y gasto. Un pago de
--    OT crea UN ingreso (índice único por entrega evita doble registro). Los
--    gastos se ingresan a mano.
--
-- NOTA: el N° de factura es el folio del documento tributario que el taller
-- emite en su sistema fiscal — acá solo se registra. La emisión electrónica SII
-- (DTE) es un pendiente aparte.
-- ============================================================

-- ── entregas: facturación y estado de cobro ─────────────────────────────────
ALTER TABLE entregas
  ADD COLUMN IF NOT EXISTS numero_factura TEXT,
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT NOT NULL DEFAULT 'ninguno',
  ADD COLUMN IF NOT EXISTS condicion_pago TEXT NOT NULL DEFAULT 'contado',
  ADD COLUMN IF NOT EXISTS estado_pago    TEXT NOT NULL DEFAULT 'pagada',
  ADD COLUMN IF NOT EXISTS vence_en       DATE,
  ADD COLUMN IF NOT EXISTS pagado_en      DATE;

ALTER TABLE entregas
  ADD CONSTRAINT chk_entregas_tipo_documento CHECK (tipo_documento IN ('ninguno','boleta','factura')),
  ADD CONSTRAINT chk_entregas_condicion_pago CHECK (condicion_pago IN ('contado','credito')),
  ADD CONSTRAINT chk_entregas_estado_pago    CHECK (estado_pago IN ('pagada','pendiente'));

CREATE INDEX IF NOT EXISTS idx_entregas_por_cobrar
  ON entregas (org_id, vence_en)
  WHERE estado_pago = 'pendiente';

-- Faltaba la policy de UPDATE (marcar pagada, corregir N° de factura).
DROP POLICY IF EXISTS "entregas_update" ON entregas;
CREATE POLICY "entregas_update"
  ON entregas FOR UPDATE TO authenticated
  USING (org_id = mi_org_id() AND mi_rol() IN ('admin','jefe_taller','recepcionista'))
  WITH CHECK (org_id = mi_org_id());

-- ── movimientos_financieros: libro de ingresos y gastos ─────────────────────
CREATE TABLE IF NOT EXISTS movimientos_financieros (
  id               UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           UUID          NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  tipo             TEXT          NOT NULL CHECK (tipo IN ('ingreso','gasto')),
  categoria        TEXT,
  monto            NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
  fecha            DATE          NOT NULL DEFAULT CURRENT_DATE,
  descripcion      TEXT,
  forma_pago       TEXT          CHECK (forma_pago IS NULL OR forma_pago IN
                     ('efectivo','transferencia','tarjeta_debito','tarjeta_credito','cheque','otro')),
  orden_trabajo_id UUID          REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  entrega_id       UUID          REFERENCES entregas(id)        ON DELETE SET NULL,
  creado_en        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  creado_por       UUID          NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  eliminado_en     TIMESTAMPTZ,
  eliminado_por    UUID          REFERENCES usuarios(id)          ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mov_fin_org_fecha
  ON movimientos_financieros (org_id, fecha DESC)
  WHERE eliminado_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_mov_fin_ot
  ON movimientos_financieros (orden_trabajo_id)
  WHERE orden_trabajo_id IS NOT NULL;

-- Un solo ingreso por entrega (evita doble registro al marcar pagada).
CREATE UNIQUE INDEX IF NOT EXISTS uq_mov_fin_entrega_ingreso
  ON movimientos_financieros (entrega_id)
  WHERE entrega_id IS NOT NULL AND tipo = 'ingreso' AND eliminado_en IS NULL;

ALTER TABLE movimientos_financieros ENABLE ROW LEVEL SECURITY;

-- Datos financieros: admin/jefe_taller/recepcionista (manejan caja). Mecánico excluido.
CREATE POLICY "mov_fin_select"
  ON movimientos_financieros FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin','jefe_taller','recepcionista')
  );

CREATE POLICY "mov_fin_insert"
  ON movimientos_financieros FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin','jefe_taller','recepcionista')
  );

CREATE POLICY "mov_fin_update"
  ON movimientos_financieros FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin','jefe_taller')
  )
  WITH CHECK (org_id = mi_org_id());

-- Grants (por si las default privileges no cubren esta tabla nueva).
GRANT SELECT, INSERT, UPDATE, DELETE ON movimientos_financieros TO authenticated;
GRANT ALL ON movimientos_financieros TO service_role;
