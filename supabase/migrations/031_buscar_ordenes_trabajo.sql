-- 031 — Búsqueda server-side de órdenes de trabajo.
--
-- El listado /repair-orders no puede traer las 5.000+ OTs al cliente (PostgREST
-- tope 1.000 filas). Esta función busca en la base por N° OT, patente,
-- marca/modelo y cliente (sin tildes, vía f_unaccent), filtra por estado y
-- pagina. Devuelve el total de coincidencias en cada fila (count over) para
-- armar la paginación en un solo viaje.
--
-- SECURITY INVOKER: respeta RLS del llamante; además filtra por mi_org_id().

CREATE OR REPLACE FUNCTION fn_buscar_ordenes_trabajo(
  p_q      TEXT DEFAULT NULL,
  p_estado TEXT DEFAULT NULL,   -- 'todas' | 'en_taller' | <estado exacto>
  p_limit  INT  DEFAULT 50,
  p_offset INT  DEFAULT 0
)
RETURNS TABLE (
  id             UUID,
  numero_ot      TEXT,
  estado         TEXT,
  creado_en      TIMESTAMPTZ,
  patente        TEXT,
  marca          TEXT,
  modelo         TEXT,
  cliente_nombre TEXT,
  total          BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions, pg_catalog
AS $$
  WITH base AS (
    SELECT
      ot.id, ot.numero_ot, ot.estado, ot.creado_en,
      v.patente, v.marca, v.modelo,
      c.nombre AS cliente_nombre
    FROM ordenes_trabajo ot
    JOIN vehiculos v ON v.id = ot.vehiculo_id
    LEFT JOIN propietarios_vehiculo pv
      ON pv.vehiculo_id = v.id AND pv.fecha_fin IS NULL
    LEFT JOIN clientes c ON c.id = pv.cliente_id
    WHERE ot.org_id = mi_org_id()
      AND ot.eliminado_en IS NULL
      AND (
        p_estado IS NULL OR p_estado = 'todas'
        OR (p_estado = 'en_taller' AND ot.estado NOT IN ('entregada','cerrada','cancelada'))
        OR (p_estado NOT IN ('todas','en_taller') AND ot.estado = p_estado)
      )
      AND (
        p_q IS NULL OR p_q = ''
        OR f_unaccent(ot.numero_ot)                                        LIKE '%'||f_unaccent(p_q)||'%'
        OR f_unaccent(coalesce(v.patente,''))                              LIKE '%'||f_unaccent(p_q)||'%'
        OR f_unaccent(coalesce(v.marca,'')||' '||coalesce(v.modelo,''))    LIKE '%'||f_unaccent(p_q)||'%'
        OR f_unaccent(coalesce(c.nombre,''))                               LIKE '%'||f_unaccent(p_q)||'%'
      )
  )
  SELECT b.id, b.numero_ot, b.estado, b.creado_en, b.patente, b.marca, b.modelo,
         b.cliente_nombre, count(*) OVER() AS total
  FROM base b
  ORDER BY b.creado_en DESC
  LIMIT  greatest(1, least(p_limit, 200))
  OFFSET greatest(0, p_offset);
$$;

GRANT EXECUTE ON FUNCTION fn_buscar_ordenes_trabajo(TEXT, TEXT, INT, INT) TO authenticated;
