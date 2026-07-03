-- ============================================================
-- Migration 024 — fn_cotizacion_publica: resolver cliente/vehículo vía la OT
--
-- Bug: la función leía v_p.cliente_id / v_p.vehiculo_id directos. Esas
-- columnas solo existen en cotizaciones sueltas (creadas sin OT). Un
-- presupuesto creado DENTRO de una OT (el flujo más común: recepción → OT →
-- "+ Crear presupuesto") solo tiene orden_trabajo_id — cliente_id/vehiculo_id
-- quedan NULL. El enlace público mostraba taller correcto pero cliente y
-- vehículo vacíos.
--
-- Fix: mismo patrón COALESCE que v_presupuestos_listado (migration 016) —
-- vehículo directo o el de la OT; cliente directo o el propietario activo del
-- vehículo resuelto.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_cotizacion_publica(p_token UUID)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_p presupuestos%ROWTYPE;
  v_taller RECORD;
  v_cliente RECORD;
  v_vehiculo RECORD;
  v_vehiculo_id UUID;
  v_cliente_id UUID;
  v_items JSONB;
BEGIN
  SELECT * INTO v_p FROM presupuestos
  WHERE token_publico = p_token AND eliminado_en IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_encontrada');
  END IF;

  SELECT nombre, rut, telefono, direccion, ciudad INTO v_taller
  FROM organizaciones WHERE id = v_p.org_id;

  -- Vehículo: directo, o el de la OT si el presupuesto vive dentro de una.
  v_vehiculo_id := v_p.vehiculo_id;
  IF v_vehiculo_id IS NULL AND v_p.orden_trabajo_id IS NOT NULL THEN
    SELECT vehiculo_id INTO v_vehiculo_id FROM ordenes_trabajo WHERE id = v_p.orden_trabajo_id;
  END IF;
  SELECT patente, marca, modelo, anio INTO v_vehiculo FROM vehiculos WHERE id = v_vehiculo_id;

  -- Cliente: directo, o el propietario activo del vehículo resuelto arriba.
  v_cliente_id := v_p.cliente_id;
  IF v_cliente_id IS NULL AND v_vehiculo_id IS NOT NULL THEN
    SELECT cliente_id INTO v_cliente_id
    FROM propietarios_vehiculo
    WHERE vehiculo_id = v_vehiculo_id AND fecha_fin IS NULL
    LIMIT 1;
  END IF;
  SELECT nombre INTO v_cliente FROM clientes WHERE id = v_cliente_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('tipo', i.tipo, 'descripcion', i.descripcion,
                       'cantidad', i.cantidad, 'precio_total', i.precio_total)
    ORDER BY i.creado_en), '[]'::jsonb)
  INTO v_items
  FROM items_presupuesto i
  WHERE i.presupuesto_id = v_p.id AND i.eliminado_en IS NULL;

  RETURN jsonb_build_object(
    'estado', v_p.estado,
    'creado_en', v_p.creado_en,
    'total_mano_obra', v_p.total_mano_obra,
    'total_repuestos', v_p.total_repuestos,
    'total_otros', v_p.total_otros,
    'total_neto', v_p.total_neto,
    'nota_cliente', v_p.nota_cliente,
    'agendar_solicitado', v_p.agendar_solicitado,
    'taller', jsonb_build_object('nombre', v_taller.nombre, 'rut', v_taller.rut,
                                 'telefono', v_taller.telefono, 'direccion', v_taller.direccion,
                                 'ciudad', v_taller.ciudad),
    'cliente', jsonb_build_object('nombre', v_cliente.nombre),
    'vehiculo', jsonb_build_object('patente', v_vehiculo.patente, 'marca', v_vehiculo.marca,
                                   'modelo', v_vehiculo.modelo, 'anio', v_vehiculo.anio),
    'items', v_items
  );
END;
$$;
