// Proveedor GetAPI.cl (server-only) — PRIMARIO.
// API REST chilena especializada en consulta de vehículo por patente.
//   GET https://chile.getapi.cl/v1/vehicles/plate/{patente}
//   Header de auth: X-Api-Key: <key>
// Devuelve marca, modelo, año, VIN, motor (cilindrada), combustible, transmisión, color.
// Ref: https://getapi.cl/docs/  (verificado, jun 2026)
//
// Variables de entorno (server-only, NUNCA con prefijo NEXT_PUBLIC):
//   GETAPI_API_KEY        — requerida para activar el proveedor
//   GETAPI_VEHICLES_URL   — opcional, base por defecto https://chile.getapi.cl/v1

import type { VehicleData, VehicleDataProvider } from '../types'

const DEFAULT_BASE = 'https://chile.getapi.cl/v1'
const TIMEOUT_MS = 8000

function str(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim()
  if (typeof v === 'number') return String(v)
  return undefined
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && /^\d{4}$/.test(v.trim())) return Number.parseInt(v, 10)
  return undefined
}

/** Normaliza el combustible a las opciones del dominio (constants COMBUSTIBLES). */
function mapCombustible(v: unknown): string | undefined {
  const s = str(v)?.toUpperCase()
  if (!s) return undefined
  if (s.includes('BENCIN') || s.includes('GASOLIN')) return 'Bencina'
  if (s.includes('DIES') || s.includes('DIÉS')) return 'Diésel'
  if (s.includes('ELEC') || s.includes('ELÉC')) return 'Eléctrico'
  if (s.includes('HIBR') || s.includes('HÍBR')) return 'Híbrido'
  if (s.includes('GLP') || s.includes('GAS')) return 'GLP'
  return 'Otro'
}

/** Normaliza la transmisión a las opciones del dominio (constants TRANSMISIONES). */
function mapTransmision(v: unknown): string | undefined {
  const s = str(v)?.toUpperCase()
  if (!s) return undefined
  if (s.includes('AUTOM')) return 'Automática'
  if (s.includes('MANUAL') || s.includes('MEC')) return 'Manual'
  if (s.includes('CVT')) return 'CVT'
  return 'Otro'
}

function normalize(data: Record<string, unknown>, patente: string): VehicleData {
  const model =
    data.model && typeof data.model === 'object' ? (data.model as Record<string, unknown>) : {}
  return {
    patente,
    marca: str(model.brand),
    modelo: str(model.name) ?? str(data.version),
    anio: num(data.year),
    vin: str(data.vinNumber),
    motor: str(data.engine),
    combustible: mapCombustible(data.fuel),
    transmision: mapTransmision(data.transmission),
    color: str(data.color),
  }
}

export const getapiProvider: VehicleDataProvider = {
  name: 'getapi',
  label: 'GetAPI.cl',
  priority: 1,

  isConfigured(): boolean {
    return Boolean(process.env.GETAPI_API_KEY)
  },

  async fetchByPlate(patente: string): Promise<VehicleData | null> {
    const key = process.env.GETAPI_API_KEY
    if (!key) return null
    const base = (process.env.GETAPI_VEHICLES_URL ?? DEFAULT_BASE).replace(/\/$/, '')
    const url = `${base}/vehicles/plate/${encodeURIComponent(patente)}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'X-Api-Key': key, Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      })

      if (process.env.NODE_ENV !== 'production') {
        console.info(`[enrichment:getapi] http=${res.status}`)
      }

      if (res.status === 404) return null
      if (!res.ok) throw new Error(`getapi_http_${res.status}`)

      const body = (await res.json()) as unknown
      let data: Record<string, unknown> | undefined
      if (body && typeof body === 'object') {
        const maybe = body as { data?: unknown }
        data =
          maybe.data && typeof maybe.data === 'object'
            ? (maybe.data as Record<string, unknown>)
            : (body as Record<string, unknown>)
      }

      if (!data || (!data.licensePlate && !data.vinNumber && !data.model && !data.year)) {
        return null
      }
      return normalize(data, patente)
    } finally {
      clearTimeout(timer)
    }
  },
}
