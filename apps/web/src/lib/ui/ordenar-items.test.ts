import { describe, it, expect } from 'vitest'
import { ordenarItemsPorTipo } from './ordenar-items'

describe('ordenarItemsPorTipo', () => {
  it('agrupa repuestos primero, luego mano de obra, luego otros', () => {
    const items = [
      { tipo: 'mano_obra', descripcion: 'cambio rótula' },
      { tipo: 'otros', descripcion: 'traslado' },
      { tipo: 'repuesto', descripcion: 'rótula' },
      { tipo: 'mano_obra', descripcion: 'alineación' },
      { tipo: 'repuesto', descripcion: 'bandeja' },
    ]
    expect(ordenarItemsPorTipo(items).map((i) => i.tipo)).toEqual([
      'repuesto', 'repuesto', 'mano_obra', 'mano_obra', 'otros',
    ])
  })

  it('conserva el orden de creación dentro de cada grupo (sort estable)', () => {
    const items = [
      { tipo: 'mano_obra', descripcion: 'b' },
      { tipo: 'repuesto', descripcion: 'x' },
      { tipo: 'mano_obra', descripcion: 'a' },
    ]
    expect(ordenarItemsPorTipo(items).map((i) => i.descripcion)).toEqual(['x', 'b', 'a'])
  })

  it('no muta el arreglo original y tolera tipos desconocidos al final', () => {
    const items = [
      { tipo: 'desconocido' },
      { tipo: 'repuesto' },
    ]
    const resultado = ordenarItemsPorTipo(items)
    expect(items[0]?.tipo).toBe('desconocido') // original intacto
    expect(resultado.map((i) => i.tipo)).toEqual(['repuesto', 'desconocido'])
  })
})
