import { describe, it, expect } from 'vitest'
import { getValorHoraForServicio } from './helpers'
import type { ConfiguracionManoObra } from './types'

const config = {
  valor_hora_mecanica: 29412,
  valor_hora_mantencion: 28500,
  valor_hora_diagnostico: 35000,
  valor_hora_electricidad: 32000,
  valor_hora_diesel: 31000,
} as ConfiguracionManoObra

describe('getValorHoraForServicio', () => {
  it('devuelve la tarifa específica de cada categoría', () => {
    expect(getValorHoraForServicio(config, 'mantencion')).toBe(28500)
    expect(getValorHoraForServicio(config, 'diagnostico')).toBe(35000)
    expect(getValorHoraForServicio(config, 'electricidad')).toBe(32000)
    expect(getValorHoraForServicio(config, 'diesel')).toBe(31000)
  })

  it('usa valor_hora_mecanica para categorías sin tarifa propia', () => {
    expect(getValorHoraForServicio(config, 'frenos')).toBe(29412)
    expect(getValorHoraForServicio(config, 'transmision')).toBe(29412)
  })

  it('usa valor_hora_mecanica cuando la categoría es null', () => {
    expect(getValorHoraForServicio(config, null)).toBe(29412)
  })
})
