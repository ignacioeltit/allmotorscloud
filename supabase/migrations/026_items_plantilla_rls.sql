-- ============================================================
-- Migration 026 — RLS para items_plantilla
--
-- La tabla quedó sin RLS desde la migration 005 (los ítems de paquetes solo se
-- escribían por seed). Al construir la pantalla de administración de paquetes
-- (2026-07-03) se habilita: como no tiene org_id propio, la tenencia se deriva
-- del paquete padre (plantillas_trabajo.org_id).
--
-- Sin eliminado_en: es configuración, no historial operativo → DELETE físico
-- permitido para admin/jefe_taller (mismos roles que editan paquetes).
-- ============================================================

ALTER TABLE items_plantilla ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_plantilla_select"
  ON items_plantilla FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plantillas_trabajo p
      WHERE p.id = plantilla_id AND p.org_id = mi_org_id()
    )
  );

CREATE POLICY "items_plantilla_insert"
  ON items_plantilla FOR INSERT TO authenticated
  WITH CHECK (
    mi_rol() IN ('admin', 'jefe_taller')
    AND EXISTS (
      SELECT 1 FROM plantillas_trabajo p
      WHERE p.id = plantilla_id AND p.org_id = mi_org_id()
    )
  );

CREATE POLICY "items_plantilla_update"
  ON items_plantilla FOR UPDATE TO authenticated
  USING (
    mi_rol() IN ('admin', 'jefe_taller')
    AND EXISTS (
      SELECT 1 FROM plantillas_trabajo p
      WHERE p.id = plantilla_id AND p.org_id = mi_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plantillas_trabajo p
      WHERE p.id = plantilla_id AND p.org_id = mi_org_id()
    )
  );

CREATE POLICY "items_plantilla_delete"
  ON items_plantilla FOR DELETE TO authenticated
  USING (
    mi_rol() IN ('admin', 'jefe_taller')
    AND EXISTS (
      SELECT 1 FROM plantillas_trabajo p
      WHERE p.id = plantilla_id AND p.org_id = mi_org_id()
    )
  );
