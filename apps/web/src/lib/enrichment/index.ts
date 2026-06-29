// Enriquecimiento de vehículo por patente — orquestador server-only.
//
// Cadena de proveedores por prioridad (primario → secundario → …). Registro abierto:
// para sumar un proveedor, créalo implementando VehicleDataProvider y agrégalo a REGISTRY.
//
// Selección por VEHICLE_ENRICHMENT_PROVIDER (server-only):
//   '<name>'  → fuerza ese proveedor (p.ej. 'getapi', 'tallergp', 'mock')
//   'auto' / ausente → todos los configurados (excepto mock) en orden de prioridad
//
// NUNCA importar desde un Client Component. El browser usa GET /api/vehiculos/enriquecer.

import type { EnrichmentResult, NormalizedVehicle, VehicleDataProvider } from './types'
import { getapiProvider } from './providers/getapi'
import { tallergpProvider } from './providers/tallergp'
import { mockProvider } from './providers/mock'

/** Registro de proveedores disponibles. El orden real lo da `priority`. */
const REGISTRY: VehicleDataProvider[] = [getapiProvider, tallergpProvider, mockProvider]

/** Normaliza una patente chilena: mayúsculas, sin espacios ni guiones. */
export function normalizePlate(raw: string): string {
  return (raw ?? '').toUpperCase().replace(/[\s-]/g, '')
}

/** Validación de formato básico: 5–7 alfanuméricos. */
function isValidPlate(plate: string): boolean {
  return /^[A-Z0-9]{5,7}$/.test(plate)
}

/**
 * Indica si hay al menos un proveedor de enriquecimiento activo en este entorno.
 * Devuelve un booleano (sin secretos): seguro de pasar a un Client Component.
 * Permite que la UI salte la consulta externa y vaya directo a ingreso manual.
 */
export function isEnrichmentEnabled(): boolean {
  return resolveProviders().length > 0
}

/** Proveedores a intentar, en orden de prioridad, según la configuración del entorno. */
function resolveProviders(): VehicleDataProvider[] {
  const override = process.env.VEHICLE_ENRICHMENT_PROVIDER?.trim()

  if (override && override !== 'auto') {
    const provider = REGISTRY.find((p) => p.name === override)
    if (!provider) return []
    return provider.isConfigured() ? [provider] : []
  }

  // auto: todos los configurados salvo mock (mock solo por override explícito)
  return REGISTRY.filter((p) => p.name !== 'mock' && p.isConfigured()).sort(
    (a, b) => a.priority - b.priority,
  )
}

/** Log de desarrollo: patente, normalizada, proveedor, tiempo y resultado. Sin tokens ni PII. */
function logAttempt(fields: {
  patente: string
  norm: string
  provider: string
  ms: number
  resultado: string
}): void {
  if (process.env.NODE_ENV !== 'production') {
    console.info(
      `[enrichment] patente=${fields.patente} norm=${fields.norm} provider=${fields.provider} ms=${fields.ms} resultado=${fields.resultado}`,
    )
  }
}

/**
 * Intenta enriquecer un vehículo por patente recorriendo los proveedores configurados.
 * Nunca lanza: ante cualquier problema devuelve { found:false, reason }.
 * Estructura de respuesta única, independiente del proveedor.
 */
export async function enrichVehicleByPlate(rawPatente: string): Promise<EnrichmentResult> {
  const raw = rawPatente ?? ''
  const patente = normalizePlate(raw)

  if (!isValidPlate(patente)) {
    logAttempt({ patente: raw, norm: patente, provider: '-', ms: 0, resultado: 'patente_invalida' })
    return { found: false, reason: 'invalid_plate' }
  }

  const providers = resolveProviders()
  if (providers.length === 0) {
    logAttempt({ patente: raw, norm: patente, provider: '-', ms: 0, resultado: 'no_configurado' })
    return { found: false, reason: 'not_configured' }
  }

  let huboError = false
  for (const provider of providers) {
    const t0 = Date.now()
    try {
      const data = await provider.fetchByPlate(patente)
      const ms = Date.now() - t0
      if (data) {
        logAttempt({ patente: raw, norm: patente, provider: provider.name, ms, resultado: 'encontrado' })
        const normalized: NormalizedVehicle = {
          ...data,
          patente,
          fuente: provider.label,
          fechaConsulta: new Date().toISOString(),
        }
        return { found: true, data: normalized }
      }
      logAttempt({ patente: raw, norm: patente, provider: provider.name, ms, resultado: 'sin_datos' })
    } catch {
      // No se registra el error completo para no filtrar tokens/URLs/PII.
      huboError = true
      logAttempt({
        patente: raw,
        norm: patente,
        provider: provider.name,
        ms: Date.now() - t0,
        resultado: 'error',
      })
      // fallback: continuar con el siguiente proveedor
    }
  }

  return { found: false, reason: huboError ? 'provider_error' : 'no_data' }
}
