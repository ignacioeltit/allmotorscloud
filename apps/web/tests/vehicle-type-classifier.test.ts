import { describe, it, expect } from 'vitest'
// El clasificador vive junto al script de migración (fuera de apps/web) porque
// se ejecuta con node puro contra Supabase; acá solo se testea su lógica.
import { clasificar } from '../../../scripts/tallergp/lib/vehicle-type-classifier.mjs'

describe('clasificar (tipo de vehículo desde marca/modelo)', () => {
  it('detecta las camionetas más comunes del taller', () => {
    expect(clasificar('MITSUBISHI', 'L200')).toBe('camioneta')
    expect(clasificar('TOYOTA', 'HILUX')).toBe('camioneta')
    expect(clasificar('MAXUS', 'T60 4X4 GL')).toBe('camioneta')
    expect(clasificar('FORD', 'RANGER')).toBe('camioneta')
    expect(clasificar('NISSAN', 'NP300 NAVARA')).toBe('camioneta')
    expect(clasificar('MAHINDRA', 'NEW MAHINDRA PICK UP')).toBe('camioneta')
  })

  it('detecta furgones', () => {
    expect(clasificar('MERCEDES BENZ', 'SPRINTER')).toBe('furgon')
    expect(clasificar('PEUGEOT', 'PARTNER')).toBe('furgon')
    expect(clasificar('TOYOTA', 'HI-ACE')).toBe('furgon')
  })

  it('detecta camiones', () => {
    expect(clasificar('MITSUBISHI', 'FUSO CANTER')).toBe('camion')
    expect(clasificar('MERCEDES BENZ', 'ATEGO')).toBe('camion')
    expect(clasificar('TOYOTA', 'DYNA')).toBe('camion')
  })

  it('RAM VAN es furgón aunque RAM sea marca de camionetas', () => {
    expect(clasificar('RAM', 'VAN 700')).toBe('furgon')
    expect(clasificar('RAM', 'VAN 1000 CARGO XL 1.6')).toBe('furgon')
  })

  it('no clasifica autos comunes (quedan null → siguen como auto)', () => {
    expect(clasificar('TOYOTA', 'YARIS')).toBeNull()
    expect(clasificar('KIA', 'MORNING')).toBeNull()
    expect(clasificar('MAZDA', '3')).toBeNull()
  })

  it('el borde de palabra evita falsos positivos', () => {
    // AVANZA contiene "VAN" como substring pero no es token
    expect(clasificar('TOYOTA', 'AVANZA')).toBeNull()
    // RAV4 contiene "RA" pero no matchea RAM/RANGER
    expect(clasificar('TOYOTA', 'RAV4')).toBeNull()
  })

  it('sin marca ni modelo devuelve null sin romper', () => {
    expect(clasificar(null, null)).toBeNull()
    expect(clasificar('SIN INFORMACION', 'SIN INFORMACION')).toBeNull()
  })
})
