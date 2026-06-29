// Enriquecimiento de vehículo por patente — contrato y tipos.
//
// SERVER-ONLY: este árbol (lib/enrichment/**) usa credenciales de proveedores externos y
// NUNCA debe importarse desde un Client Component. Solo lo consume el route handler
// `app/api/vehiculos/enriquecer`. El browser lo invoca por fetch a esa ruta.
//
// Arquitectura desacoplada: cada proveedor implementa `VehicleDataProvider`. El orquestador
// (index.ts) recorre los proveedores configurados por prioridad (primario → secundario → …).

/** Datos crudos de vehículo que devuelve un proveedor (forma estable del dominio). */
export interface VehicleData {
  patente: string
  marca?: string
  modelo?: string
  anio?: number
  vin?: string
  motor?: string
  combustible?: string
  transmision?: string
  color?: string
}

/** Resultado normalizado final: datos + trazabilidad (fuente y fecha de consulta). */
export interface NormalizedVehicle extends VehicleData {
  /** Etiqueta legible del proveedor que entregó los datos (p.ej. "GetAPI.cl"). */
  fuente: string
  /** Fecha/hora de la consulta en ISO 8601. */
  fechaConsulta: string
}

/** Razón por la que no se obtuvieron datos (para mensajes y telemetría). */
export type EnrichmentMiss =
  | 'invalid_plate' // patente con formato inválido
  | 'not_configured' // no hay proveedor activo/configurado en este entorno
  | 'no_data' // algún proveedor respondió pero sin datos para esa patente
  | 'provider_error' // timeout / error de red / error del proveedor

/** Estructura única de respuesta, independiente del proveedor. */
export type EnrichmentResult =
  | { found: true; data: NormalizedVehicle }
  | { found: false; reason: EnrichmentMiss }

/**
 * Contrato común de todos los proveedores de datos vehiculares.
 * Implementar uno nuevo = crear una clase/objeto con esta forma y registrarlo en index.ts.
 */
export interface VehicleDataProvider {
  /** Id estable interno (p.ej. 'getapi'). Usado por VEHICLE_ENRICHMENT_PROVIDER. */
  readonly name: string
  /** Nombre legible para mostrar como fuente (p.ej. 'GetAPI.cl'). */
  readonly label: string
  /** Orden de intento: menor = se consulta primero. */
  readonly priority: number
  /** true solo si el proveedor tiene la configuración necesaria (URL + credenciales). */
  isConfigured(): boolean
  /** Devuelve datos o null si no hay datos para esa patente. Puede lanzar ante error de red. */
  fetchByPlate(patente: string): Promise<VehicleData | null>
}
