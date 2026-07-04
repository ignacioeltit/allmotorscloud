import { describe, it, expect } from 'vitest'
import { ordenarItemsPorTipo } from './ordenar-items'

describe('ordenarItemsPorTipo', () => {
  it('agrupa mano de obra primero, luego repuestos, luego otros', () => {
    const items = [
      { tipo: 'repuesto', descripcion: 'rótula' },
      { tipo: 'otros', descripcion: 'traslado' },
      { tipo: 'mano_obra', descripcion: 'cambio rótula' },
      { tipo: 'repuesto', descripcion: 'bandeja' },
      { tipo: 'mano_obra', descripcion: 'alineación' },
    ]
    expect(ordenarItemsPorTipo(items).map((i) => i.tipo)).toEqual([
      'mano_obra', 'mano_obra', 'repuesto', 'repuesto', 'otros',
    ])
  })

  it('conserva el orden de creación dentro de cada grupo (sort estable)', () => {
    const items = [
      { tipo: 'repuesto', descripcion: 'b' },
      { tipo: 'mano_obra', descripcion: 'x' },
      { tipo: 'repuesto', descripcion: 'a' },
    ]
    expect(ordenarItemsPorTipo(items).map((i) => i.descripcion)).toEqual(['x', 'b', 'a'])
  })

  it('no muta el arreglo original y tolera tipos desconocidos al final', () => {
    const items = [
      { tipo: 'desconocido' },
      { tipo: 'mano_obra' },
    ]
    const resultado = ordenarItemsPorTipo(items)
    expect(items[0]?.tipo).toBe('desconocido') // original intacto
    expect(resultado.map((i) => i.tipo)).toEqual(['mano_obra', 'desconocido'])
  })
})
