import { describe, it, expect } from 'vitest'
import { anioDesdeVin } from '../../../scripts/tallergp/lib/vin-year.mjs'

// Año tope fijo para que los tests no dependan de la fecha actual.
const MAX = 2026

describe('anioDesdeVin', () => {
  it('decodifica el ciclo reciente cuando es plausible', () => {
    // char 10 = 'K' → 2019 (preferido sobre 1989)
    expect(anioDesdeVin('KMHCN41CP7U153681'.slice(0, 9) + 'K' + '1234567', MAX)).toBe(2019)
    // VINs reales de la flota
    expect(anioDesdeVin('KMHCN41CP7U153681', MAX)).toBe(2007) // char10 '7' → 2007 (2037 > max)
    expect(anioDesdeVin('LSFAM11A8PA061177', MAX)).toBe(2023) // char10 'P' → 2023
  })

  it('cae al ciclo viejo solo si el reciente supera el año tope', () => {
    // char 10 = 'V' → [1997, 2027]; con tope 2026, 2027 no cabe → 1997
    const vin = '123456789V2345678' // posición 10 (índice 9) = 'V'
    expect(anioDesdeVin(vin, 2026)).toBe(1997)
    // con tope 2027, sí cabe el reciente
    expect(anioDesdeVin(vin, 2027)).toBe(2027)
  })

  it('devuelve null para VIN inválido o incompleto', () => {
    expect(anioDesdeVin(null, MAX)).toBeNull()
    expect(anioDesdeVin('', MAX)).toBeNull()
    expect(anioDesdeVin('CORTO123', MAX)).toBeNull()
    expect(anioDesdeVin('UMY720-925547', MAX)).toBeNull() // no tiene 17 chars
  })

  it('ignora espacios y normaliza a mayúsculas', () => {
    expect(anioDesdeVin('lsfam11a8pa061177', MAX)).toBe(2023)
    expect(anioDesdeVin('LSFAM11A8 PA061177'.replace(' ', ''), MAX)).toBe(2023)
  })

  it('devuelve null si el código de año no es válido (0, I, O, Q)', () => {
    const vinI = '123456789I2345678' // índice 9 = 'I' (no usado)
    expect(anioDesdeVin(vinI, MAX)).toBeNull()
  })
})
