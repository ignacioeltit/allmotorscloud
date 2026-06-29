-- ============================================================
-- migration_fix_001 — Corrección sistémica de WITH CHECK en policies UPDATE
-- All Motors Cloud — Junio 2026
--
-- PROBLEMA RAÍZ:
--   13 políticas UPDATE tienen `WITH CHECK (org_id = mi_org_id())` sin incluir
--   `mi_rol()`. En Supabase local (y potencialmente en producción), las funciones
--   STABLE evaluadas SOLAS en WITH CHECK pueden fallar con 403 porque el planificador
--   de PostgreSQL puede hoistar/cachear `mi_org_id()` fuera del contexto JWT.
--
--   Evidencia empírica: `items_reparacion_update` confirma el 403.
--   Patrón consistente: las únicas policies UPDATE que NO fallan incluyen
--   `mi_rol()` en WITH CHECK (ordenes_trabajo_update, eventos_update, reparaciones_update).
--
-- SOLUCIÓN:
--   Agregar `AND mi_rol() IN (...)` al WITH CHECK de cada policy afectada.
--   Los roles en WITH CHECK son idénticos a los del USING de cada policy —
--   la semántica de seguridad no cambia. Solo se hace la evaluación más explícita.
--
-- SEGURIDAD:
--   ✅ Multiempresa preservada: org_id = mi_org_id() sigue presente
--   ✅ Roles preservados: los mismos roles del USING
--   ✅ Sin USING(true) ni desactivación de RLS
--   ✅ Sin service_role expuesto
--   ✅ Idempotente: DROP IF EXISTS + CREATE
--
-- TABLAS AFECTADAS (Migration 002):
--   clientes, conductores, vehiculos, historias_tecnicas,
--   propietarios_vehiculo, tipos_evento, referencias_evento
--
-- TABLAS AFECTADAS (Migration 003):
--   citas, presupuestos, items_presupuesto, items_reparacion,
--   evidencias, garantias
--
-- SUPERSEDE: patch_002_fix_items_reparacion_update_policy.sql
--
-- Aplicar con:
--   supabase db query --linked -f scripts/db/migration_fix_001_rls_with_check.sql
-- ============================================================

BEGIN;


-- ============================================================
-- MIGRATION 002 — 7 policies
-- ============================================================

-- ---- clientes_update ----
-- USING: org_id = mi_org_id() AND eliminado_en IS NULL AND mi_rol() IN ('admin','jefe_taller','recepcionista')
-- WITH CHECK (antes): org_id = mi_org_id()
-- WITH CHECK (ahora): + mi_rol() IN (...)

DROP POLICY IF EXISTS "clientes_update" ON public.clientes;

CREATE POLICY "clientes_update"
  ON public.clientes FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );


-- ---- conductores_update ----

DROP POLICY IF EXISTS "conductores_update" ON public.conductores;

CREATE POLICY "conductores_update"
  ON public.conductores FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );


-- ---- vehiculos_update ----

DROP POLICY IF EXISTS "vehiculos_update" ON public.vehiculos;

CREATE POLICY "vehiculos_update"
  ON public.vehiculos FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );


-- ---- historias_tecnicas_update ----
-- USING restricye a admin/jefe_taller; WITH CHECK también

DROP POLICY IF EXISTS "historias_tecnicas_update" ON public.historias_tecnicas;

CREATE POLICY "historias_tecnicas_update"
  ON public.historias_tecnicas FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller')
  );


-- ---- propietarios_vehiculo_update ----
-- USING: fecha_fin IS NULL previene editar relaciones cerradas.
-- WITH CHECK no incluye fecha_fin IS NULL deliberadamente:
--   el UPDATE puede setear fecha_fin (cerrar relación) — bloquear ese caso rompería la operación.

DROP POLICY IF EXISTS "propietarios_vehiculo_update" ON public.propietarios_vehiculo;

CREATE POLICY "propietarios_vehiculo_update"
  ON public.propietarios_vehiculo FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND fecha_fin IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );


-- ---- tipos_evento_update ----

DROP POLICY IF EXISTS "tipos_evento_update" ON public.tipos_evento;

CREATE POLICY "tipos_evento_update"
  ON public.tipos_evento FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin')
  );


-- ---- referencias_evento_eliminar ----
-- Solo admin/jefe_taller pueden anular arcos del DAG (soft-delete via eliminado_en).
-- USING: eliminado_en IS NULL previene re-eliminar arcos ya eliminados.
-- WITH CHECK no incluye eliminado_en IS NULL: el UPDATE setea eliminado_en (ese es el objetivo).

DROP POLICY IF EXISTS "referencias_evento_eliminar" ON public.referencias_evento;

CREATE POLICY "referencias_evento_eliminar"
  ON public.referencias_evento FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller')
  );


-- ============================================================
-- MIGRATION 003 — 6 policies
-- ============================================================

-- ---- citas_update ----

DROP POLICY IF EXISTS "citas_update" ON public.citas;

CREATE POLICY "citas_update"
  ON public.citas FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );


-- ---- presupuestos_update ----

DROP POLICY IF EXISTS "presupuestos_update" ON public.presupuestos;

CREATE POLICY "presupuestos_update"
  ON public.presupuestos FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );


-- ---- items_presupuesto_update ----

DROP POLICY IF EXISTS "items_presupuesto_update" ON public.items_presupuesto;

CREATE POLICY "items_presupuesto_update"
  ON public.items_presupuesto FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );


-- ---- items_reparacion_update ----
-- SUPERSEDE: patch_002_fix_items_reparacion_update_policy.sql
-- BUG CONFIRMADO: 403 en soft-delete de ítems.
-- mecanico incluido: puede gestionar ítems de sus propias reparaciones.

DROP POLICY IF EXISTS "items_reparacion_update" ON public.items_reparacion;

CREATE POLICY "items_reparacion_update"
  ON public.items_reparacion FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  );


-- ---- evidencias_update_visible_cliente ----
-- Solo campo visible_cliente es mutable.
-- La app NO debe enviar otros campos en el UPDATE payload.

DROP POLICY IF EXISTS "evidencias_update_visible_cliente" ON public.evidencias;

CREATE POLICY "evidencias_update_visible_cliente"
  ON public.evidencias FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );


-- ---- garantias_update ----

DROP POLICY IF EXISTS "garantias_update" ON public.garantias;

CREATE POLICY "garantias_update"
  ON public.garantias FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );


COMMIT;


-- ============================================================
-- VERIFICACIÓN POST-APLICACIÓN (ejecutar manualmente):
--
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN (
--   'clientes', 'conductores', 'vehiculos', 'historias_tecnicas',
--   'propietarios_vehiculo', 'tipos_evento', 'referencias_evento',
--   'citas', 'presupuestos', 'items_presupuesto',
--   'items_reparacion', 'evidencias', 'garantias'
-- )
-- AND cmd = 'UPDATE'
-- ORDER BY tablename;
-- ============================================================
