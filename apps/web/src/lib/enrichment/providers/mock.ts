// Proveedor mock (server-only) para probar el flujo sin proveedor real.
// Se activa SOLO con VEHICLE_ENRICHMENT_PROVIDER=mock (nunca en auto/producción).
// Datos determinísticos por patente. La patente 'SINDAT0' simula "sin datos".

import type { VehicleData, VehicleDataProvider } from '../types'

export const mockProvider: VehicleDataProvider = {
  name: 'mock',
  label: 'Mock (pruebas)',
  priority: 99,

  isConfigured(): boolean {
    return true
  },

  async fetchByPlate(patente: string): Promise<VehicleData | null> {
    if (patente === 'SINDAT0') return null
    return {
      patente,
      marca: 'Toyota',
      modelo: 'Hilux',
      anio: 2020,
      vin: `MOCK${patente}00000000`.slice(0, 17),
      motor: '2.4D',
      combustible: 'Diésel',
      transmision: 'Manual',
      color: 'Blanco',
    }
  },
}
