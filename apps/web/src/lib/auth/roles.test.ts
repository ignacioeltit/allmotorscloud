import { describe, it, expect } from 'vitest'
import { puedeVerCostos, ROLES_GESTION } from './roles'

describe('puedeVerCostos', () => {
  it.each(['admin', 'jefe_taller', 'recepcionista'])('permite a %s ver costos', (rol) => {
    expect(puedeVerCostos(rol)).toBe(true)
  })

  it.each(['mecanico', 'cliente_portal', 'ADMIN', '', 'otro'])('niega a "%s"', (rol) => {
    expect(puedeVerCostos(rol)).toBe(false)
  })

  it('niega cuando el JWT no trae rol', () => {
    expect(puedeVerCostos(null)).toBe(false)
    expect(puedeVerCostos(undefined)).toBe(false)
  })

  it('coincide con fn_es_gestion() de la migration 058', () => {
    expect([...ROLES_GESTION]).toEqual(['admin', 'jefe_taller', 'recepcionista'])
  })
})
