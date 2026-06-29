-- ============================================================
-- migration_fix_003 — Patrón definitivo Soft Delete + RLS
-- All Motors Cloud — Sprint 7.2, Junio 2026
-- ============================================================
--
-- CAUSA RAÍZ TÉCNICA:
--   PostgreSQL aplica el SELECT policy USING al NEW row durante UPDATE como
--   "visibility check" (PG docs §5.8.3: "The row must also pass the
--   row security policy check for UPDATE"). Si SELECT USING contiene
--   `eliminado_en IS NULL` y el UPDATE intenta SET eliminado_en = NOW(),
--   el new row viola esa condición → ERROR 42501 silent fail.
--
-- HISTORIA DE FIXES:
--   fix_001 → Agregó mi_rol() a WITH CHECK de 13 UPDATE policies (necesario,
--             no suficiente).
--   fix_002 → Removió eliminado_en IS NULL de SELECT policies (parche
--             funcional pero débil: registros eliminados visibles a sesiones
--             autenticadas en el mismo tenant).
--
-- PATRÓN DEFINITIVO (este script):
--   ┌─────────────────────────────────────────────────────────┐
--   │ 1. SELECT USING: org_id = mi_org_id()                   │
--   │               AND eliminado_en IS NULL    ← restaurado  │
--   │ 2. UPDATE USING: org_id = mi_org_id()                   │
--   │               AND eliminado_en IS NULL    ← sin cambio  │
--   │               AND mi_rol() IN (...)                     │
--   │ 3. soft_delete(table, id) — SECURITY DEFINER            │
--   │    - Valida sesión, org_id, rol (por tabla), no re-del. │
--   │    - Ejecuta UPDATE SET eliminado_en = NOW()            │
--   │    - Bypassa el visibility check legítimamente          │
--   │ 4. restore_deleted(table, id) — SECURITY DEFINER        │
--   │    - Valida sesión, org_id, rol elevado                 │
--   │    - Ejecuta UPDATE SET eliminado_en = NULL             │
--   └─────────────────────────────────────────────────────────┘
--
-- POR QUÉ SECURITY DEFINER ES CORRECTO:
--   La función corre como su propietario (postgres) → RLS no aplica.
--   Sin embargo la función IMPLEMENTA manualmente las mismas garantías:
--     org_id = mi_org_id()        → aislamiento multi-tenant
--     mi_rol() IN (...)           → control de acceso por rol
--     eliminado_en IS NULL        → no re-eliminación
--   No es un bypass, es una validación explícita y auditada.
--
-- INVARIANTES DE SEGURIDAD PRESERVADAS:
--   ✅ Registros eliminados invisibles: SELECT USING tiene eliminado_en IS NULL
--   ✅ Registros eliminados no editables directamente: UPDATE USING también
--   ✅ Soft-delete solo via función: la validación es explícita e irrenunciable
--   ✅ Restore solo via función: requiere rol elevado (admin/jefe_taller)
--   ✅ Sin USING(true) ni WITH CHECK(true) en ninguna policy
--   ✅ Sin service_role desde el frontend
--   ✅ RLS no desactivado en ninguna tabla
--   ✅ Aislamiento multi-tenant en functions + policies
--   ✅ Un usuario no puede auto-eliminarse (regla de negocio en función)
--
-- TABLAS CUBIERTAS (12):
--   sucursales, usuarios, clientes, conductores, vehiculos,
--   referencias_evento, eventos, citas, items_presupuesto,
--   items_reparacion, ordenes_trabajo, presupuestos
--
-- Aplicar con:
--   supabase db query --linked -f scripts/db/migration_fix_003_soft_delete_pattern.sql
-- ============================================================

BEGIN;


-- ============================================================
-- PARTE 1 — Restaurar eliminado_en IS NULL en SELECT policies
--            (revertir fix_002)
-- ============================================================

-- sucursales
DROP POLICY IF EXISTS "sucursales_select" ON public.sucursales;
CREATE POLICY "sucursales_select"
  ON public.sucursales FOR SELECT TO authenticated
  USING (org_id = mi_org_id() AND eliminado_en IS NULL);


-- usuarios
DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;
CREATE POLICY "usuarios_select"
  ON public.usuarios FOR SELECT TO authenticated
  USING (org_id = mi_org_id() AND eliminado_en IS NULL);


-- clientes (mantiene restricción de rol)
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
CREATE POLICY "clientes_select"
  ON public.clientes FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );


-- conductores
DROP POLICY IF EXISTS "conductores_select" ON public.conductores;
CREATE POLICY "conductores_select"
  ON public.conductores FOR SELECT TO authenticated
  USING (org_id = mi_org_id() AND eliminado_en IS NULL);


-- vehiculos
DROP POLICY IF EXISTS "vehiculos_select" ON public.vehiculos;
CREATE POLICY "vehiculos_select"
  ON public.vehiculos FOR SELECT TO authenticated
  USING (org_id = mi_org_id() AND eliminado_en IS NULL);


-- referencias_evento
DROP POLICY IF EXISTS "referencias_evento_select" ON public.referencias_evento;
CREATE POLICY "referencias_evento_select"
  ON public.referencias_evento FOR SELECT TO authenticated
  USING (org_id = mi_org_id() AND eliminado_en IS NULL);


-- eventos
DROP POLICY IF EXISTS "eventos_select" ON public.eventos;
CREATE POLICY "eventos_select"
  ON public.eventos FOR SELECT TO authenticated
  USING (org_id = mi_org_id() AND eliminado_en IS NULL);


-- citas
DROP POLICY IF EXISTS "citas_select" ON public.citas;
CREATE POLICY "citas_select"
  ON public.citas FOR SELECT TO authenticated
  USING (org_id = mi_org_id() AND eliminado_en IS NULL);


-- items_presupuesto (mantiene restricción de rol)
DROP POLICY IF EXISTS "items_presupuesto_select" ON public.items_presupuesto;
CREATE POLICY "items_presupuesto_select"
  ON public.items_presupuesto FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );


-- items_reparacion
DROP POLICY IF EXISTS "items_reparacion_select" ON public.items_reparacion;
CREATE POLICY "items_reparacion_select"
  ON public.items_reparacion FOR SELECT TO authenticated
  USING (org_id = mi_org_id() AND eliminado_en IS NULL);


-- ordenes_trabajo
DROP POLICY IF EXISTS "ordenes_trabajo_select" ON public.ordenes_trabajo;
CREATE POLICY "ordenes_trabajo_select"
  ON public.ordenes_trabajo FOR SELECT TO authenticated
  USING (org_id = mi_org_id() AND eliminado_en IS NULL);


-- presupuestos (mantiene restricción de rol)
DROP POLICY IF EXISTS "presupuestos_select" ON public.presupuestos;
CREATE POLICY "presupuestos_select"
  ON public.presupuestos FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );


-- ============================================================
-- PARTE 2 — Función soft_delete
-- ============================================================
-- Elimina lógicamente un registro (eliminado_en = NOW()).
-- SECURITY DEFINER: corre como postgres → bypassa visibility check.
-- Toda la lógica de seguridad se implementa explícitamente aquí.
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete(p_table TEXT, p_id UUID)
  RETURNS VOID
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_org_id  UUID    := mi_org_id();
  v_user_id UUID    := auth.uid();
  v_rol     TEXT    := mi_rol();
  v_allowed TEXT[];
  v_rows    INT;
BEGIN
  -- Validar sesión autenticada
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada'
      USING ERRCODE = '42501';
  END IF;

  -- Whitelist de tablas + roles autorizados por tabla
  -- Mirrors exactamente las restricciones de los UPDATE USING policies.
  v_allowed := CASE p_table
    WHEN 'sucursales'         THEN ARRAY['admin']::TEXT[]
    WHEN 'usuarios'           THEN ARRAY['admin']::TEXT[]
    WHEN 'clientes'           THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    WHEN 'conductores'        THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    WHEN 'vehiculos'          THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    WHEN 'citas'              THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    WHEN 'items_presupuesto'  THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    WHEN 'presupuestos'       THEN ARRAY['admin','jefe_taller','recepcionista']::TEXT[]
    WHEN 'referencias_evento' THEN ARRAY['admin','jefe_taller']::TEXT[]
    WHEN 'eventos'            THEN ARRAY['admin','jefe_taller','recepcionista','mecanico']::TEXT[]
    WHEN 'items_reparacion'   THEN ARRAY['admin','jefe_taller','recepcionista','mecanico']::TEXT[]
    WHEN 'ordenes_trabajo'    THEN ARRAY['admin','jefe_taller','recepcionista','mecanico']::TEXT[]
    ELSE NULL
  END;

  -- Tabla no en whitelist → error explícito (no leak de datos)
  IF v_allowed IS NULL THEN
    RAISE EXCEPTION 'Tabla no permitida: %', p_table
      USING ERRCODE = '22023';
  END IF;

  -- Verificar rol
  IF NOT (v_rol = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Rol % no autorizado para eliminar en %', v_rol, p_table
      USING ERRCODE = '42501';
  END IF;

  -- Regla de negocio: no auto-eliminación de usuario activo
  IF p_table = 'usuarios' AND p_id = v_user_id THEN
    RAISE EXCEPTION 'Un usuario no puede eliminarse a sí mismo'
      USING ERRCODE = '42501';
  END IF;

  -- Ejecutar soft-delete con guardia de tenant (org_id) y no-redeleción (eliminado_en IS NULL)
  EXECUTE format(
    'UPDATE %I
     SET eliminado_en = NOW(), eliminado_por = $1
     WHERE id = $2
       AND org_id = $3
       AND eliminado_en IS NULL',
    p_table
  ) USING v_user_id, p_id, v_org_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- 0 filas → no existe, ya eliminado, o de otra org (no distinguimos para no leakear)
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Registro no encontrado, ya eliminado, o de otra organización'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.soft_delete(TEXT, UUID) IS
  'Eliminación lógica (soft delete) con validación explícita de tenant, rol e idempotencia. '
  'Llamar desde el frontend via supabase.rpc(''soft_delete'', {p_table, p_id}).';

-- Solo sesiones autenticadas; anon no puede llamarla
REVOKE ALL ON FUNCTION public.soft_delete(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.soft_delete(TEXT, UUID) TO authenticated;


-- ============================================================
-- PARTE 3 — Función restore_deleted
-- ============================================================
-- Restaura un registro eliminado (eliminado_en = NULL).
-- Requiere rol elevado (admin o jefe_taller) en todas las tablas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.restore_deleted(p_table TEXT, p_id UUID)
  RETURNS VOID
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_org_id  UUID    := mi_org_id();
  v_user_id UUID    := auth.uid();
  v_rol     TEXT    := mi_rol();
  v_allowed TEXT[];
  v_rows    INT;
BEGIN
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada'
      USING ERRCODE = '42501';
  END IF;

  -- Restaurar es operación privilegiada: solo admin/jefe_taller
  v_allowed := CASE p_table
    WHEN 'sucursales'         THEN ARRAY['admin']::TEXT[]
    WHEN 'usuarios'           THEN ARRAY['admin']::TEXT[]
    WHEN 'clientes'           THEN ARRAY['admin','jefe_taller']::TEXT[]
    WHEN 'conductores'        THEN ARRAY['admin','jefe_taller']::TEXT[]
    WHEN 'vehiculos'          THEN ARRAY['admin','jefe_taller']::TEXT[]
    WHEN 'citas'              THEN ARRAY['admin','jefe_taller']::TEXT[]
    WHEN 'items_presupuesto'  THEN ARRAY['admin','jefe_taller']::TEXT[]
    WHEN 'presupuestos'       THEN ARRAY['admin','jefe_taller']::TEXT[]
    WHEN 'referencias_evento' THEN ARRAY['admin','jefe_taller']::TEXT[]
    WHEN 'eventos'            THEN ARRAY['admin','jefe_taller']::TEXT[]
    WHEN 'items_reparacion'   THEN ARRAY['admin','jefe_taller']::TEXT[]
    WHEN 'ordenes_trabajo'    THEN ARRAY['admin','jefe_taller']::TEXT[]
    ELSE NULL
  END;

  IF v_allowed IS NULL THEN
    RAISE EXCEPTION 'Tabla no permitida: %', p_table
      USING ERRCODE = '22023';
  END IF;

  IF NOT (v_rol = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Rol % no autorizado para restaurar en %', v_rol, p_table
      USING ERRCODE = '42501';
  END IF;

  EXECUTE format(
    'UPDATE %I
     SET eliminado_en = NULL, eliminado_por = NULL
     WHERE id = $1
       AND org_id = $2
       AND eliminado_en IS NOT NULL',
    p_table
  ) USING p_id, v_org_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Registro no encontrado, no está eliminado, o de otra organización'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.restore_deleted(TEXT, UUID) IS
  'Restaura un registro eliminado lógicamente. Requiere rol admin o jefe_taller. '
  'Llamar desde el frontend via supabase.rpc(''restore_deleted'', {p_table, p_id}).';

REVOKE ALL ON FUNCTION public.restore_deleted(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_deleted(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_deleted(TEXT, UUID) TO authenticated;


COMMIT;


-- ============================================================
-- VERIFICACIÓN POST-APLICACIÓN (ejecutar manualmente):
--
-- 1. SELECT policies con eliminado_en IS NULL restauradas (debe ser 12 filas):
-- SELECT tablename, policyname, qual FROM pg_policies
-- WHERE cmd = 'SELECT' AND qual ILIKE '%eliminado_en%'
-- AND schemaname = 'public' ORDER BY tablename;
--
-- 2. Funciones SECURITY DEFINER creadas:
-- SELECT proname, prosecdef, proacl FROM pg_proc
-- WHERE proname IN ('soft_delete','restore_deleted')
-- AND pronamespace = 'public'::regnamespace;
--
-- 3. GRANT solo a authenticated (no anon, no public):
-- SELECT grantee, privilege_type FROM information_schema.role_routine_grants
-- WHERE routine_name IN ('soft_delete','restore_deleted')
-- AND specific_schema = 'public'
-- ORDER BY routine_name, grantee;
-- ============================================================
