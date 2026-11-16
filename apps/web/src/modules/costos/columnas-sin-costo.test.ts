// Regresión de la auditoría 2026-11 (A1): desde migration 058 las columnas de
// costo no son legibles por `authenticated`. Si alguna lista de columnas vuelve
// a pedirlas, la consulta falla con "permission denied" en producción.

import { describe, it, expect } from 'vitest'
import { ITEM_REPARACION_COLUMNS } from '@/modules/reparaciones/columns'
import {
  REPUESTO_COLUMNS,
  REPUESTO_RESUMEN_COLUMNS,
  MOVIMIENTO_COLUMNS,
} from '@/modules/inventory/columns'

const columnas = (lista: string) => lista.split(',').map((c) => c.trim())

describe('listas de columnas sin costos', () => {
  it('items_reparacion no pide costo_compra_unitario', () => {
    expect(columnas(ITEM_REPARACION_COLUMNS)).not.toContain('costo_compra_unitario')
    expect(columnas(ITEM_REPARACION_COLUMNS)).toContain('costo_unitario') // precio de venta: sí
  })

  it('repuestos no pide precio_costo', () => {
    expect(columnas(REPUESTO_COLUMNS)).not.toContain('precio_costo')
    expect(columnas(REPUESTO_RESUMEN_COLUMNS)).not.toContain('precio_costo')
  })

  it('movimientos_stock no pide costo_unitario', () => {
    expect(columnas(MOVIMIENTO_COLUMNS)).not.toContain('costo_unitario')
  })
})
