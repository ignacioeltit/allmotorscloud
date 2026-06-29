-- Patch remoto seguro — corrige fn_audit_insert() en Supabase Cloud.
--
-- Causa raíz: pgcrypto está instalada en el schema `extensions` (estándar Supabase),
-- pero fn_audit_insert() corre con `SET search_path = public`, por lo que el `digest()`
-- sin calificar no se resuelve → "function digest(...) does not exist".
--
-- Fix: calificar el schema → extensions.digest(...). Se mantiene SET search_path = public
-- (no se amplía el search_path: calificar es más seguro y no depende del path).
--
-- Idempotente (CREATE OR REPLACE). No cambia owner ni permisos del objeto existente.
-- Aplicar con: supabase db query --linked -f scripts/db/patch_001_fix_audit_digest.sql

CREATE OR REPLACE FUNCTION public.fn_audit_insert(
  p_actor_id     UUID,
  p_actor_rol    TEXT,
  p_org_id       UUID,
  p_accion       TEXT,
  p_entidad      TEXT,
  p_entidad_id   UUID,
  p_estado_ant   JSONB,
  p_estado_nuevo JSONB
)
  RETURNS VOID
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_ip_origen      INET;
  v_canal          TEXT;
  v_ant_hashed     JSONB;
  v_nuevo_hashed   JSONB;
  v_pii_fields     TEXT[] := ARRAY['rut','nombre','nombre_completo','telefono','email','direccion'];
  v_field          TEXT;
BEGIN
  -- Obtener ip y canal de variables de sesión con missing_ok=true
  -- Retorna NULL (no excepción) si la variable no está seteada
  v_ip_origen := NULLIF(current_setting('app.current_ip', true), '')::INET;
  v_canal     := NULLIF(current_setting('app.canal', true), '');

  -- Hashear PII en estado anterior
  v_ant_hashed := p_estado_ant;
  IF v_ant_hashed IS NOT NULL THEN
    FOREACH v_field IN ARRAY v_pii_fields LOOP
      IF (v_ant_hashed ? v_field) AND (v_ant_hashed ->> v_field IS NOT NULL) THEN
        v_ant_hashed := jsonb_set(
          v_ant_hashed,
          ARRAY[v_field],
          to_jsonb(encode(extensions.digest(v_ant_hashed ->> v_field, 'sha256'), 'hex'))
        );
      END IF;
    END LOOP;
  END IF;

  -- Hashear PII en estado nuevo
  v_nuevo_hashed := p_estado_nuevo;
  IF v_nuevo_hashed IS NOT NULL THEN
    FOREACH v_field IN ARRAY v_pii_fields LOOP
      IF (v_nuevo_hashed ? v_field) AND (v_nuevo_hashed ->> v_field IS NOT NULL) THEN
        v_nuevo_hashed := jsonb_set(
          v_nuevo_hashed,
          ARRAY[v_field],
          to_jsonb(encode(extensions.digest(v_nuevo_hashed ->> v_field, 'sha256'), 'hex'))
        );
      END IF;
    END LOOP;
  END IF;

  INSERT INTO audit_log (
    actor_id, actor_rol, org_id,
    accion, entidad, entidad_id,
    cambios, ip_origen, canal
  ) VALUES (
    p_actor_id, p_actor_rol, p_org_id,
    p_accion, p_entidad, p_entidad_id,
    jsonb_build_object('ant', v_ant_hashed, 'nuevo', v_nuevo_hashed),
    v_ip_origen, v_canal
  );
END;
$$;
