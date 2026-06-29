// Proveedor TallerGP (server-only) — SECUNDARIO (fallback).
// Útil para vehículos que ya existían en la cuenta TallerGP del taller. Para patentes
// nuevas suele tener datos escasos (plate/vin/branch); por eso es secundario tras GetAPI.
//   GET {TALLERGP_API_URL}/vehicles?plate=XXX  (Bearer token)
// Ref: docs/TALLERGP_API_NOTES.md y migration-toolkit/src/api/tallergp/endpoints/vehicles.ts
//
// Variables de entorno (server-only, NUNCA con prefijo NEXT_PUBLIC):
//   TALLERGP_API_URL       — base, p.ej. https://api.tallergp.com
//   TALLERGP_BEARER_TOKEN  — token fijo de acceso (Bearer)

import type { VehicleData, VehicleDataProvider } from '../types'

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

type TallerGPVehicleRow = Record<string, unknown>

function normalize(row: TallerGPVehicleRow, patente: string): VehicleData {
  return {
    patente,
    // En los datos reales la marca aparece en `branch`; algunos despliegues usan `brand`.
    marca: str(row.brand) ?? str(row.branch),
    modelo: str(row.model),
    anio: num(row.model_year),
    vin: str(row.vin),
    motor: undefined, // sin campo de texto directo en la API
    combustible: undefined, // fuel_type_id es un id, no un nombre
    transmision: undefined, // no expuesto por la API
    color: str(row.color),
  }
}

export const tallergpProvider: VehicleDataProvider = {
  name: 'tallergp',
  label: 'TallerGP',
  priority: 2,

  isConfigured(): boolean {
    return Boolean(process.env.TALLERGP_API_URL && process.env.TALLERGP_BEARER_TOKEN)
  },

  async fetchByPlate(patente: string): Promise<VehicleData | null> {
    const base = process.env.TALLERGP_API_URL?.replace(/\/$/, '')
    const token = process.env.TALLERGP_BEARER_TOKEN
    if (!base || !token) return null

    const url = `${base}/vehicles?plate=${encodeURIComponent(patente)}&per_page=1`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      })

      if (process.env.NODE_ENV !== 'production') {
        console.info(`[enrichment:tallergp] http=${res.status}`)
      }

      if (res.status === 404) return null
      if (!res.ok) throw new Error(`tallergp_http_${res.status}`)

      const body = (await res.json()) as unknown
      let row: TallerGPVehicleRow | undefined
      if (body && typeof body === 'object') {
        const maybe = body as { data?: unknown }
        if (Array.isArray(maybe.data)) {
          row = maybe.data[0] as TallerGPVehicleRow | undefined
        } else if ('plate' in body || 'id' in body) {
          row = body as TallerGPVehicleRow
        }
      }

      if (!row) return null
      return normalize(row, patente)
    } finally {
      clearTimeout(timer)
    }
  },
}
