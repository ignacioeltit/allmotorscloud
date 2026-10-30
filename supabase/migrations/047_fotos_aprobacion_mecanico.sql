-- 047 — Aprobación de fotos: el mecánico no puede auto-publicar al cliente.
--
-- Regla de negocio: las fotos que toma el taller (mecánico) quedan PENDIENTES
-- y debe aprobarlas un rol de gestión (admin / jefe_taller / recepcionista =
-- "asesor"). La app ya sube las fotos del mecánico con visible_cliente=false,
-- pero lo blindamos en DB: cualquier INSERT hecho por el rol 'mecanico' nace
-- oculto al cliente, aunque se intente saltar la app. La aprobación es el
-- UPDATE de visible_cliente, que por RLS (migration 003/034) solo pueden hacer
-- admin / jefe_taller / recepcionista.

CREATE OR REPLACE FUNCTION fn_evidencias_mecanico_sin_autoaprobar()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Solo aplica a fotos; el mecánico nunca publica directo al cliente.
  IF NEW.tipo = 'foto' AND mi_rol() = 'mecanico' THEN
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
