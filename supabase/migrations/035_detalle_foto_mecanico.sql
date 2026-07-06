-- 035 — El mecánico puede editar el DETALLE de una foto (no la visibilidad).
--
-- El RLS de UPDATE de evidencias es solo admin/jefe/recepcionista y, al ser
-- a nivel de fila, no puede limitar por columna. Esta función SECURITY DEFINER
-- deja que cualquier miembro del taller (incluido el mecánico) edite únicamente
-- `descripcion`, sin poder tocar visible_cliente. Scope por mi_org_id().

CREATE OR REPLACE FUNCTION fn_editar_detalle_foto(p_foto_id UUID, p_descripcion TEXT)
  RETURNS VOID
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE evidencias
     SET descripcion = NULLIF(btrim(p_descripcion), '')
   WHERE id = p_foto_id
     AND org_id = mi_org_id()
     AND tipo = 'foto';
END;
$$;

REVOKE ALL ON FUNCTION fn_editar_detalle_foto(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_editar_detalle_foto(UUID, TEXT) TO authenticated;
