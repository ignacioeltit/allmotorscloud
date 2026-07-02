-- ============================================================
-- Migration 016 — Vista v_presupuestos_listado
--
-- Aplana un presupuesto con su OT (si tiene), su vehículo (directo o vía OT) y
-- su cliente (directo o vía propietario activo de la OT), para el listado global
-- /estimates con búsqueda por N° OT, patente o cliente sin pelear con embeds
-- de doble camino en PostgREST.
--
-- security_invoker = true → la vista respeta las RLS de las tablas base con el
-- rol del usuario que consulta (no las bypassa).
-- ============================================================

CREATE OR REPLACE VIEW v_presupuestos_listado
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.org_id,
  p.orden_trabajo_id,
  p.estado,
  p.total_neto,
  p.creado_en,
  p.eliminado_en,
  ot.numero_ot,
  COALESCE(vp.patente, vo.patente) AS patente,
  COALESCE(vp.marca,   vo.marca)   AS marca,
  COALESCE(vp.modelo,  vo.modelo)  AS modelo,
  COALESCE(cp.nombre,  cot.nombre) AS cliente_nombre
FROM presupuestos p
LEFT JOIN ordenes_trabajo ot ON ot.id = p.orden_trabajo_id
LEFT JOIN vehiculos       vp ON vp.id = p.vehiculo_id
LEFT JOIN vehiculos       vo ON vo.id = ot.vehiculo_id
LEFT JOIN clientes        cp ON cp.id = p.cliente_id
LEFT JOIN LATERAL (
  SELECT c.nombre
  FROM propietarios_vehiculo pv
  JOIN clientes c ON c.id = pv.cliente_id
  WHERE pv.vehiculo_id = ot.vehiculo_id
    AND pv.fecha_fin IS NULL
  LIMIT 1
) cot ON true;
