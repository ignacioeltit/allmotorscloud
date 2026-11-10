import { describe, it, expect } from 'vitest'
import { parseMensaje } from './parse-mensaje'

describe('parseMensaje', () => {
  it('extrae nombre, patente, marca, servicio y síntoma del ejemplo', () => {
    const p = parseMensaje(
      'hola soy ignacio tengo una ram pdfc21 quiero hacer cambio de aceite y tiene un ruido en la rueda delantera derecha',
    )
    expect(p.nombre).toBe('Ignacio')
    expect(p.patente).toBe('PDFC21')
    expect(p.marca).toBe('RAM')
    expect(p.servicios).toContain('Cambio de aceite')
    expect(p.sintomas).toContain('ruido en la rueda delantera derecha'.replace(/^./, (c) => c.toUpperCase()))
  })

  it('detecta patente de formato antiguo (LL·DDDD)', () => {
    expect(parseMensaje('mi auto es bb1234').patente).toBe('BB1234')
  })

  it('reconoce varios servicios y teléfono', () => {
    const p = parseMensaje('hola necesito cambio de aceite, frenos y alineación. mi fono es +56 9 8765 4321')
    expect(p.servicios).toEqual(
      expect.arrayContaining(['Cambio de aceite', 'Revisión/cambio de frenos', 'Alineación y balanceo']),
    )
    expect(p.telefono).toBe('987654321')
  })

  it('no inventa datos cuando el mensaje no los trae', () => {
    const p = parseMensaje('quiero una cotización')
    expect(p.nombre).toBeNull()
    expect(p.patente).toBeNull()
    expect(p.marca).toBeNull()
    expect(p.servicios).toEqual([])
    expect(p.sintomas).toEqual([])
  })

  it('no confunde la marca (3 letras) con una patente', () => {
    const p = parseMensaje('tengo un mg y suena raro el motor')
    expect(p.marca).toBe('MG')
    expect(p.patente).toBeNull()
  })
})
