// Columnas de repuestos y movimientos_stock legibles por SELECT directo.
//
// NO incluyen repuestos.precio_costo ni movimientos_stock.costo_unitario: desde
// migration 058 no son legibles por `authenticated`. Gestión los obtiene con
// las RPCs de modules/costos. Pedirlos aquí rompería la consulta.

export const REPUESTO_COLUMNS =
  'id, org_id, sucursal_id, codigo, codigo_barra, nombre, descripcion, marca, modelo_aplicacion, categoria, unidad, precio_venta, stock_actual, stock_minimo, ubicacion, proveedor, activo, creado_en, actualizado_en, creado_por, eliminado_en, eliminado_por'

export const REPUESTO_RESUMEN_COLUMNS =
  'id, codigo, nombre, descripcion, marca, unidad, precio_venta, stock_actual, stock_minimo'

export const MOVIMIENTO_COLUMNS =
  'id, org_id, repuesto_id, tipo, cantidad, stock_antes, stock_despues, precio_venta_unitario, referencia_tipo, referencia_id, motivo, actor_id, creado_en'
