import { describe, it, expect } from 'vitest'
import { otEstadoBadge, otEstadoLabel } from './styles'

const ESTADOS_OT = [
  'pendiente_diagnostico',
  'diagnosticada',
  'presupuesto_pendiente',
  'presupuesto_enviado',
  'autorizada',
  'en_reparacion',
  'control_calidad',
  'lista_para_entrega',
  'entregada',
  'cerrada',
  'cancelada',
]

describe('otEstadoLabel', () => {
  it('tiene etiqueta legible para todos los estados de OT', () => {
    for (const estado of ESTADOS_OT) {
      const label = otEstadoLabel(estado)
      expect(label).not.toBe(estado)
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('devuelve el estado crudo si no está mapeado (no rompe)', () => {
    expect(otEstadoLabel('estado_desconocido')).toBe('estado_desconocido')
  })
})

describe('otEstadoBadge', () => {
  it('tiene clases de color específicas para todos los estados de OT', () => {
    for (const estado of ESTADOS_OT) {
      const clases = otEstadoBadge(estado)
      expect(clases).toContain('border')
      expect(clases).toContain('text-')
    }
  })

  it('estados no mapeados usan el badge neutro sin romper', () => {
    expect(otEstadoBadge('estado_desconocido')).toContain('text-neutral-300')
  })
})
