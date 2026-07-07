import { describe, it, expect } from 'vitest'
import { normalizarPatente, normalizarRut } from './identificadores'

describe('normalizarPatente', () => {
  it('trata igual una patente con o sin guion', () => {
    expect(normalizarPatente('hdcx10')).toBe('HDCX10')
    expect(normalizarPatente('hdcx-10')).toBe('HDCX10')
    expect(normalizarPatente('HDCX10')).toBe(normalizarPatente('hdcx-10'))
  })

  it('elimina espacios y otros separadores', () => {
    expect(normalizarPatente(' hd cx-10 ')).toBe('HDCX10')
  })
})

describe('normalizarRut', () => {
  it('trata igual un RUT con o sin puntos y guion', () => {
    expect(normalizarRut('16218807-0')).toBe('162188070')
    expect(normalizarRut('16.218.807-0')).toBe('162188070')
    expect(normalizarRut('16.218.807-0')).toBe(normalizarRut('16218807-0'))
  })

  it('conserva el dígito verificador K en mayúscula', () => {
    expect(normalizarRut('12.345.678-k')).toBe('12345678K')
  })
})
