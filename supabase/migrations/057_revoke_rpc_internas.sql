-- 057 — Cerrar RPC internas SECURITY DEFINER (auditoría 2026-11, hallazgos C1 y C2)
--
-- fn_importar_ot_historica (013) y fn_audit_insert (001) son SECURITY DEFINER y
-- confían en p_org_id / p_actor_id recibidos como parámetro. Solo hacían
-- REVOKE FROM PUBLIC (o nada), lo que en Supabase no quita los grants directos
-- a anon/authenticated. Quedan solo para service_role:
--   - fn_importar_ot_historica: la usan los scripts de migration-toolkit.
--   - fn_audit_insert: la invocan triggers del mismo owner (no requieren grant).
--
-- Ya aplicado a mano en producción (ixnugbxetmkmxfwutxbz) el 2026-11-16;
-- esta migración lo deja en el repo. REVOKE/GRANT son idempotentes.

REVOKE ALL ON FUNCTION public.fn_importar_ot_historica(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_importar_ot_historica(uuid, uuid, jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.fn_audit_insert(uuid, text, uuid, text, text, uuid, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_audit_insert(uuid, text, uuid, text, text, uuid, jsonb, jsonb)
  TO service_role;
