import { getClient, type PaginatedResponse } from '../client.js'

export interface RepairOrderLine {
  type: 'part' | 'labor' | 'paint' | 'wheel' | 'other'
  reference?: string
  description?: string
  quantity?: number
  unit_price?: number
  discount?: number
  total?: number
  [key: string]: unknown
}

export interface TallerGPRepairOrder {
  entry_id: string
  order_number: string
  entry_date?: string
  client_id?: string
  vehicle_id?: string
  plate?: string
  vin?: string
  total_amount_net_from_entry?: number
  total_amount_vat_incl_from_entry?: number
  total_amount_vat_included?: number
  is_closed?: boolean | string | number
  service_status_id?: number | string | null
  service_status_name?: string | null
  pdf?: string
  parts?: RepairOrderLine[]
  labor?: RepairOrderLine[]
  paint?: RepairOrderLine[]
  other?: RepairOrderLine[]
  wheels?: RepairOrderLine[]
  [key: string]: unknown
}

export interface RepairOrderListParams {
  page?: number
  per_page?: number
  client_id?: number
  vehicle_id?: number
  order_number?: string
  closed?: boolean
}

export async function listRepairOrders(
  params: RepairOrderListParams = {}
): Promise<PaginatedResponse<TallerGPRepairOrder>> {
  const client = getClient()
  const res = await client.get<PaginatedResponse<TallerGPRepairOrder>>('/repair-orders', { params })
  return res.data
}

export async function getRepairOrder(entryId: string): Promise<TallerGPRepairOrder> {
  const client = getClient()
  const res = await client.get<TallerGPRepairOrder>(`/repair-orders/${entryId}`)
  return res.data
}
