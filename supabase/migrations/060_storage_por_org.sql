-- 060 — Storage aislado por organización y sin listado público
--       (auditoría 2026-11, A2 — opción "URL-llave")
--
-- Antes: buckets 'evidencias' y 'branding' públicos, con SELECT TO public
-- (cualquiera podía LISTAR y descargar todo) y escritura/borrado para
-- cualquier autenticado de cualquier org.
--
-- Ahora:
--   · Los buckets siguen public=true: las fotos y el logo se sirven por su URL
--     exacta (/storage/v1/object/public/...), que lleva UUIDs aleatorios.
--     Así /avance, /cotizacion y los documentos siguen funcionando igual.
--   · Sin policy SELECT para anon: nadie sin sesión puede listar los buckets.
--   · Toda policy exige que la primera carpeta de la ruta sea la org del JWT:
--       evidencias/<org_id>/<ot_id>/<uuid>.<ext>
--       branding/<org_id>/logo-<ts>.<ext>
--   · evidencias: subir = 4 roles del taller; borrar = gestión.
--   · branding: escribir = admin (la pantalla de empresa ya es solo admin).
--
-- Riesgo residual aceptado: una foto no aprobada (visible_cliente=false) se
-- abre si alguien ya tiene su URL exacta. Solo la ve el personal del taller.
--
-- Idempotente.

-- ── evidencias ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "evidencias_bucket_read"   ON storage.objects;
DROP POLICY IF EXISTS "evidencias_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_bucket_delete" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_org_select"    ON storage.objects;
DROP POLICY IF EXISTS "evidencias_org_insert"    ON storage.objects;
DROP POLICY IF EXISTS "evidencias_org_delete"    ON storage.objects;

-- Necesaria para remove() desde la app (Storage exige SELECT + DELETE).
-- Solo personal del taller: el listado revelaría fotos no aprobadas
-- (visible_cliente=false) a un futuro usuario cliente_portal.
CREATE POLICY "evidencias_org_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidencias'
    AND (storage.foldername(name))[1] = public.mi_org_id()::text
    AND public.mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  );

CREATE POLICY "evidencias_org_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidencias'
    AND (storage.foldername(name))[1] = public.mi_org_id()::text
    AND public.mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  );

CREATE POLICY "evidencias_org_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'evidencias'
    AND (storage.foldername(name))[1] = public.mi_org_id()::text
    AND public.fn_es_gestion()
  );

-- ── branding ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "branding_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "branding_auth_insert"  ON storage.objects;
DROP POLICY IF EXISTS "branding_auth_update"  ON storage.objects;
DROP POLICY IF EXISTS "branding_auth_delete"  ON storage.objects;
DROP POLICY IF EXISTS "branding_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "branding_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "branding_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "branding_admin_delete" ON storage.objects;

-- upload con upsert exige SELECT + INSERT + UPDATE.
CREATE POLICY "branding_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'branding'
    AND (storage.foldername(name))[1] = public.mi_org_id()::text
    AND public.mi_rol() = 'admin'
  );

CREATE POLICY "branding_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'branding'
    AND (storage.foldername(name))[1] = public.mi_org_id()::text
    AND public.mi_rol() = 'admin'
  );

CREATE POLICY "branding_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'branding'
    AND (storage.foldername(name))[1] = public.mi_org_id()::text
    AND public.mi_rol() = 'admin'
  )
  WITH CHECK (
    bucket_id = 'branding'
    AND (storage.foldername(name))[1] = public.mi_org_id()::text
    AND public.mi_rol() = 'admin'
  );

CREATE POLICY "branding_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'branding'
    AND (storage.foldername(name))[1] = public.mi_org_id()::text
    AND public.mi_rol() = 'admin'
  );
