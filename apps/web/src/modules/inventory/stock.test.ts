import { describe, it, expect } from 'vitest'
import { calcularEstadoStock } from './queries'

describe('calcularEstadoStock', () => {
  it('sin_stock cuando el stock es cero o negativo', () => {
    expect(calcularEstadoStock(0, 5)).toBe('sin_stock')
    expect(calcularEstadoStock(-2, 0)).toBe('sin_stock')
  })

  it('bajo_stock cuando hay stock pero está bajo el mínimo', () => {
    expect(calcularEstadoStock(1, 5)).toBe('bajo_stock')
    expect(calcularEstadoStock(4.5, 5)).toBe('bajo_stock')
  })

  it('en_stock cuando alcanza o supera el mínimo', () => {
    expect(calcularEstadoStock(5, 5)).toBe('en_stock')
    expect(calcularEstadoStock(100, 5)).toBe('en_stock')
  })

  it('en_stock cuando no hay mínimo configurado y hay stock', () => {
    expect(calcularEstadoStock(1, 0)).toBe('en_stock')
  })
})
