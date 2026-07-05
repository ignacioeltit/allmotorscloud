-- 033 — Storage de branding (logo de la empresa).
--
-- Bucket público 'branding' (creado también vía API). Lectura pública para que
-- el logo se vea en los documentos; escritura solo para usuarios autenticados
-- (la pantalla de Datos de la empresa está restringida a admin en la app y por
-- la policy organizaciones_update). Ruta: branding/<org_id>/logo-<ts>.<ext>.

-- Bucket (idempotente por si el entorno es nuevo)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('branding', 'branding', true, 2097152,
        ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- Lectura pública
DROP POLICY IF EXISTS "branding_public_read" ON storage.objects;
CREATE POLICY "branding_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'branding');

-- Escritura para autenticados en el bucket branding
DROP POLICY IF EXISTS "branding_auth_insert" ON storage.objects;
CREATE POLICY "branding_auth_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding');

DROP POLICY IF EXISTS "branding_auth_update" ON storage.objects;
CREATE POLICY "branding_auth_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "branding_auth_delete" ON storage.objects;
CREATE POLICY "branding_auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'branding');
