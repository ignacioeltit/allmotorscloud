-- ============================================================
-- Migration 028 — Estado de facturación de la entrega (facturación mensual)
--
-- Caso (2026-07-04, Ignacio): clientes que se facturan UNA vez al mes. La OT se
-- termina y entrega (no debe verse como abierta), pero la factura se emite el
-- último día del mes. Antes se mezclaba "entregada" con "facturada": si no había
-- N° de factura al entregar, no había forma de recordar que faltaba facturar.
--
-- Separación:
--  - estado_pago (ya existía): pagada / pendiente  → cuentas por COBRAR.
--  - estado_factura (nuevo):   facturada / por_facturar / no_aplica → por FACTURAR.
--
-- 'por_facturar' = entregada pero la factura se emite después (mensual).
-- 'no_aplica'    = sin documento tributario.
-- ============================================================

ALTER TABLE entregas
  ADD COLUMN IF NOT EXISTS estado_factura TEXT NOT NULL DEFAULT 'facturada',
  ADD COLUMN IF NOT EXISTS facturado_en   DATE;

ALTER TABLE entregas
  ADD CONSTRAINT chk_entregas_estado_factura
    CHECK (estado_factura IN ('facturada', 'por_facturar', 'no_aplica'));

-- Backfill coherente de las entregas existentes:
--  - sin documento → no_aplica
--  - con documento y sin N° → por_facturar
--  - resto → facturada (default)
UPDATE entregas SET estado_factura = 'no_aplica'   WHERE tipo_documento = 'ninguno';
UPDATE entregas SET estado_factura = 'por_facturar'
  WHERE tipo_documento IN ('boleta','factura') AND (numero_factura IS NULL OR btrim(numero_factura) = '');

CREATE INDEX IF NOT EXISTS idx_entregas_por_facturar
  ON entregas (org_id, creado_en)
  WHERE estado_factura = 'por_facturar';
