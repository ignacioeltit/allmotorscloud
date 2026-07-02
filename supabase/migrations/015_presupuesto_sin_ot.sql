-- ============================================================
-- Migration 015 — Presupuesto (cotización) sin OT
--
-- Hasta ahora un presupuesto SIEMPRE colgaba de una OT (orden_trabajo_id NOT
-- NULL). El flujo real del taller necesita cotizar a un cliente que llama o
-- llega, ANTES de que exista una OT. La OT se genera después: desde la
-- recepción, o desde una cotización existente (y en ese caso igual pasa por
-- recepción).
--
-- Decisión (2026-07-02, con Ignacio):
--  - orden_trabajo_id pasa a OPCIONAL.
--  - El presupuesto gana cliente_id + vehiculo_id directos (cliente y vehículo
--    son obligatorios al cotizar).
--  - Invariante: todo presupuesto es atribuible → tiene OT, o tiene cliente+vehículo.
-- ============================================================

ALTER TABLE presupuestos
  ALTER COLUMN orden_trabajo_id DROP NOT NULL;

ALTER TABLE presupuestos
  ADD COLUMN cliente_id  UUID REFERENCES clientes(id)  ON DELETE RESTRICT,
  ADD COLUMN vehiculo_id UUID REFERENCES vehiculos(id) ON DELETE RESTRICT;

-- Todo presupuesto debe ser atribuible: o cuelga de una OT (que ya lleva
-- cliente/vehículo), o trae su propio cliente + vehículo (cotización suelta).
ALTER TABLE presupuestos
  ADD CONSTRAINT chk_presupuestos_atribuible
    CHECK (
      orden_trabajo_id IS NOT NULL
      OR (cliente_id IS NOT NULL AND vehiculo_id IS NOT NULL)
    );

CREATE INDEX idx_presupuestos_vehiculo_id
  ON presupuestos (vehiculo_id)
  WHERE vehiculo_id IS NOT NULL AND eliminado_en IS NULL;

CREATE INDEX idx_presupuestos_cliente_id
  ON presupuestos (cliente_id)
  WHERE cliente_id IS NOT NULL AND eliminado_en IS NULL;

-- ── RLS: el insert debía validar la org vía la OT; ahora también acepta la
--    cotización suelta validando la org del cliente y del vehículo. ──────────
DROP POLICY IF EXISTS "presupuestos_insert" ON presupuestos;

CREATE POLICY "presupuestos_insert"
  ON presupuestos FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
    AND (
      -- Presupuesto ligado a OT (flujo existente)
      (
        orden_trabajo_id IS NOT NULL
        AND (SELECT org_id FROM ordenes_trabajo WHERE id = orden_trabajo_id) = mi_org_id()
      )
      -- Cotización suelta: cliente + vehículo del mismo tenant
      OR (
        orden_trabajo_id IS NULL
        AND cliente_id IS NOT NULL AND vehiculo_id IS NOT NULL
        AND (SELECT org_id FROM clientes  WHERE id = cliente_id)  = mi_org_id()
        AND (SELECT org_id FROM vehiculos WHERE id = vehiculo_id) = mi_org_id()
      )
    )
  );
