// Columnas de items_reparacion legibles por SELECT directo.
//
// NO incluye costo_compra_unitario: desde migration 058 esa columna no es
// legible por `authenticated`; gestión la obtiene con fn_costos_items_ot
// (modules/costos). Pedirla aquí rompería la consulta con "permission denied".

export const ITEM_REPARACION_COLUMNS =
  'id, org_id, reparacion_id, item_presupuesto_id, tipo, codigo, descripcion, repuesto_id, cantidad, costo_unitario, costo_total, inicio_en, fin_en, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por, servicio_catalogo_id, plantilla_id, nombre_servicio_snapshot, horas_estandar_snapshot, valor_hora_snapshot, precio_catalogo_snapshot, estado_compra, nota_compra'
