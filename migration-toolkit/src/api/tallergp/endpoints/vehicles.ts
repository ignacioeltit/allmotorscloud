import { getClient, type PaginatedResponse } from '../client.js'

export interface TallerGPVehicle {
  id: string
  plate?: string
  vin?: string
  brand_id?: string | number
  model_id?: string | number
  color?: string | null
  kms?: number | null
  registration_date?: string | null
  model_year?: number | null
  fuel_type_id?: string | number | null
  cv?: number | null
  kw?: number | null
  displacement?: number | null
  next_itv_date?: string | null
  next_itv?: string | null
  next_revision_date?: string | null
  client_id?: string
  model?: string | null
  branch?: string | null
  [key: string]: unknown
}

export interface VehicleListParams {
  page?: number
  per_page?: number
  plate?: string
  vin?: string
}

export async function listVehicles(
  params: VehicleListParams = {}
): Promise<PaginatedResponse<TallerGPVehicle>> {
  const client = getClient()
  const res = await client.get<PaginatedResponse<TallerGPVehicle>>('/vehicles', { params })
  return res.data
}

export async function getVehicle(vehicleId: string): Promise<TallerGPVehicle> {
  const client = getClient()
  const res = await client.get<TallerGPVehicle>(`/vehicles/${vehicleId}`)
  return res.data
}
