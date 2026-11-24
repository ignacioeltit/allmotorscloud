import { describe, it, expect } from 'vitest'
import { aplicarCostos, mapaDeCostos } from './merge'

describe('mapaDeCostos', () => {
  it('convierte filas de la RPC en un mapa id → costo numérico', () => {
    const mapa = mapaDeCostos(
      [
        { item_id: 'a', costo: '1500.50' },
        { item_id: 'b', costo: 2000 },
        { item_id: 'c', costo: null },
      ],
      (r) => r.item_id,
      (r) => r.costo,
    )
    expect(mapa.get('a')).toBe(1500.5)
    expect(mapa.get('b')).toBe(2000)
    expect(mapa.get('c')).toBeNull()
    expect(mapa.has('z')).toBe(false)
  })

  it('tolera respuesta vacía o nula', () => {
    expect(mapaDeCostos(null, (r: { id: string }) => r.id, () => 1).size).toBe(0)
    expect(mapaDeCostos([], (r: { id: string }) => r.id, () => 1).size).toBe(0)
  })
})

describe('aplicarCostos', () => {
  const items = [
    { id: 'a', descripcion: 'Filtro' },
    { id: 'b', descripcion: 'Aceite' },
  ]

  it('fusiona el costo de gestión en cada fila', () => {
    const r = aplicarCostos(items, 'costo_compra_unitario', new Map([['a', 1000], ['b', null]]))
    expect(r).toEqual([
      { id: 'a', descripcion: 'Filtro', costo_compra_unitario: 1000 },
      { id: 'b', descripcion: 'Aceite', costo_compra_unitario: null },
    ])
  })

  it('deja null las filas sin costo en el mapa', () => {
    const r = aplicarCostos(items, 'precio_costo', new Map([['a', 500]]))
    expect(r[1]?.precio_costo).toBeNull()
  })

  it('sin mapa (no es gestión) todas las filas quedan en null', () => {
    const r = aplicarCostos(items, 'costo_compra_unitario', null)
    expect(r.every((x) => x.costo_compra_unitario === null)).toBe(true)
  })

  it('no muta las filas originales', () => {
    aplicarCostos(items, 'costo_compra_unitario', new Map([['a', 1]]))
    expect(items[0]).toEqual({ id: 'a', descripcion: 'Filtro' })
  })
})
