-- 047 — Aprobación de fotos: SOLO admin o asesor (recepcionista) publican al cliente.
--
-- Regla de negocio: las fotos que toma el taller quedan PENDIENTES y las aprueba
-- un admin o el asesor de servicio (rol 'recepcionista'). Nadie más publica al
-- cliente: ni el mecánico ni el jefe de taller. Dos candados:
--
--   1. Trigger BEFORE INSERT: cualquier foto insertada por un rol que NO sea
--      admin/recepcionista nace oculta (visible_cliente=false), aunque se intente
--      saltar la app. La app ya sube así las fotos de esos roles.
--   2. Policy de UPDATE (aprobación = cambiar visible_cliente): se restringe a
--      admin/recepcionista (antes incluía jefe_taller).
--
-- Las fotos de recepción las sube el asesor/admin, así que siguen visibles.

-- ── 1. El mecánico (y cualquier no-aprobador) no auto-publica ────────────────
CREATE OR REPLACE FUNCTION fn_evidencias_mecanico_sin_autoaprobar()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Solo aplica a fotos; solo admin/recepcionista pueden publicar directo.
  IF NEW.tipo = 'foto' AND mi_rol() NOT IN ('admin', 'recepcionista') THEN
    NEW.visible_cliente := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evidencias_mecanico_sin_autoaprobar ON evidencias;
CREATE TRIGGER evidencias_mecanico_sin_autoaprobar
  BEFORE INSERT ON evidencias
  FOR EACH ROW
  EXECUTE FUNCTION fn_evidencias_mecanico_sin_autoaprobar();

-- ── 2. Aprobar (UPDATE de visible_cliente) solo admin/recepcionista ──────────
DROP POLICY IF EXISTS "evidencias_update_visible_cliente" ON evidencias;
CREATE POLICY "evidencias_update_visible_cliente"
  ON evidencias FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id());
