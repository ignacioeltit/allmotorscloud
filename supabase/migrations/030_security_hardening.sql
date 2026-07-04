-- 030 — Endurecimiento de seguridad (hallazgos de auditoría 2026-07-04)
--
-- Hallazgo 1: v_ot_totales (recreada en 022) y v_repuestos_bajo_stock (004)
--   no tienen security_invoker → corren como owner (postgres) y SALTAN el RLS
--   de las tablas base. Un usuario autenticado de otra org podría leer totales
--   financieros de todas las OTs vía /rest/v1/v_ot_totales.
--   (v_presupuestos_listado ya estaba correcta desde 016.)
--
-- Hallazgo 2: las particiones de audit_log y transiciones_evento no tienen
--   RLS propio. En Postgres, el RLS del padre solo aplica consultando el
--   padre; una consulta directa a la partición (p.ej. audit_log_2026_q2 vía
--   PostgREST) lo omite. Como el re-grant post-migración fue GRANT ALL ON
--   ALL TABLES, las particiones quedaron legibles para authenticated.
--   Fix: revocar acceso directo a las particiones. Las consultas vía el padre
--   siguen funcionando (Postgres solo chequea permisos de la tabla nombrada).

-- ── 1. Vistas respetan el RLS del consultante ────────────────────────────────
ALTER VIEW v_ot_totales SET (security_invoker = true);
ALTER VIEW v_repuestos_bajo_stock SET (security_invoker = true);

-- ── 2. Bloquear acceso directo a particiones ─────────────────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_inherits i ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_namespace n ON n.oid = p.relnamespace
    WHERE n.nspname = 'public'
      AND p.relname IN ('audit_log', 'transiciones_evento')
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Nota operativa: al crear particiones futuras (2027_q2 en adelante), repetir
-- el REVOKE sobre la partición nueva, o crear las particiones ANTES de
-- cualquier GRANT masivo sobre el schema.
