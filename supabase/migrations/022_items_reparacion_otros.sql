-- ============================================================
-- Migration 022 — Tipo 'otros' en items_reparacion (insumos, traslados, etc.)
--
-- Los trabajos de una OT solo aceptaban mano_obra/repuesto. El taller también
-- cobra conceptos que no son ni lo uno ni lo otro (insumos, gestión, traslado),
-- igual que ya se permitió en items_presupuesto (migration 018).
--
-- v_ot_totales se recrea incluyendo el nuevo tipo en la base imponible: los
-- 'otros' son ventas afectas a IVA igual que MO y repuestos. Se expone como
-- columna nueva subtotal_otros_trabajos (subtotal_otros ya existía y son los
-- cargos_ot — se mantiene para compatibilidad).
-- ============================================================

ALTER TABLE items_reparacion
  DROP CONSTRAINT chk_items_reparacion_tipo;

ALTER TABLE items_reparacion
  ADD CONSTRAINT chk_items_reparacion_tipo
    CHECK (tipo IN ('mano_obra', 'repuesto', 'otros'));

-- DROP + CREATE (no OR REPLACE): la columna nueva va al medio de la lista y
-- Postgres no permite reordenar columnas de una vista con OR REPLACE. Nadie
-- consume la vista todavía (la app calcula totales en la página).
DROP VIEW IF EXISTS v_ot_totales;

CREATE VIEW v_ot_totales AS
WITH
  lineas AS (
    SELECT
      r.orden_trabajo_id,
      ir.tipo,
      ir.costo_total
    FROM reparaciones r
    JOIN items_reparacion ir ON ir.reparacion_id = r.id
    WHERE ir.eliminado_en IS NULL
  ),

  mo AS (
    SELECT orden_trabajo_id, SUM(costo_total) AS total, COUNT(*) AS cantidad
    FROM lineas WHERE tipo = 'mano_obra'
    GROUP BY orden_trabajo_id
  ),

  rep AS (
    SELECT orden_trabajo_id, SUM(costo_total) AS total
    FROM lineas WHERE tipo = 'repuesto'
    GROUP BY orden_trabajo_id
  ),

  -- Ítems 'otros' (insumos, traslados…): afectos a IVA, suman a la base.
  otr AS (
    SELECT orden_trabajo_id, SUM(costo_total) AS total
    FROM lineas WHERE tipo = 'otros'
    GROUP BY orden_trabajo_id
  ),

  cargos AS (
    SELECT
      orden_trabajo_id,
      SUM(CASE WHEN tipo_cargo != 'descuento' AND aplica_iva
               THEN monto ELSE 0 END)                  AS total_cargos_afectos,
      SUM(CASE WHEN tipo_cargo = 'descuento' AND aplica_iva
               THEN monto ELSE 0 END)                  AS total_descuentos_afectos,
      SUM(CASE WHEN tipo_cargo != 'descuento' AND NOT aplica_iva
               THEN monto ELSE 0 END)                  AS total_cargos_exentos
    FROM cargos_ot
    GROUP BY orden_trabajo_id
  )

SELECT
  ot.id,
  ot.org_id,
  ot.numero_ot,
  ot.estado,

  COALESCE(mo.total,  0)::NUMERIC(14,2)              AS subtotal_mano_obra,
  COALESCE(mo.cantidad, 0)                            AS cantidad_trabajos,
  COALESCE(rep.total, 0)::NUMERIC(14,2)              AS subtotal_repuestos,
  COALESCE(otr.total, 0)::NUMERIC(14,2)              AS subtotal_otros_trabajos,
  COALESCE(cargos.total_cargos_afectos,    0)        AS subtotal_otros,
  COALESCE(cargos.total_descuentos_afectos,0)        AS total_descuentos,
  COALESCE(cargos.total_cargos_exentos,   0)         AS subtotal_exento_iva,

  (
    COALESCE(mo.total,  0) +
    COALESCE(rep.total, 0) +
    COALESCE(otr.total, 0) +
    COALESCE(cargos.total_cargos_afectos,    0) -
    COALESCE(cargos.total_descuentos_afectos,0)
  )::NUMERIC(14,2)                                   AS subtotal_neto_afecto,

  ROUND((
    COALESCE(mo.total,  0) +
    COALESCE(rep.total, 0) +
    COALESCE(otr.total, 0) +
    COALESCE(cargos.total_cargos_afectos,    0) -
    COALESCE(cargos.total_descuentos_afectos,0)
  ) * 0.19)::NUMERIC(14,2)                           AS iva,

  (
    ROUND((
      COALESCE(mo.total,  0) +
      COALESCE(rep.total, 0) +
      COALESCE(otr.total, 0) +
      COALESCE(cargos.total_cargos_afectos,    0) -
      COALESCE(cargos.total_descuentos_afectos,0)
    ) * 1.19) +
    COALESCE(cargos.total_cargos_exentos, 0)
  )::NUMERIC(14,2)                                   AS total_con_iva

FROM ordenes_trabajo ot
LEFT JOIN mo     ON mo.orden_trabajo_id     = ot.id
LEFT JOIN rep    ON rep.orden_trabajo_id    = ot.id
LEFT JOIN otr    ON otr.orden_trabajo_id    = ot.id
LEFT JOIN cargos ON cargos.orden_trabajo_id = ot.id;
