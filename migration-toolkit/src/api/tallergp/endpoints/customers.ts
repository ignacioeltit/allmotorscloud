import { getClient, type PaginatedResponse } from '../client.js'

export interface TallerGPCustomer {
  id: string
  customer_number: string
  name: string
  lastname?: string
  surname?: string
  vat_number?: string
  address?: string
  zip_code?: string
  location?: string
  province?: string
  phone?: string
  mobile?: string
  mail?: string
  web?: string
  blocked?: boolean
  account_ledger?: string
  parts_discount?: number
  labor_discount?: number
  general_discount?: number
  [key: string]: unknown
}

export interface CustomerListParams {
  page?: number
  per_page?: number
  customer_number?: string
  email?: string
  phone?: string
}

export async function listCustomers(
  params: CustomerListParams = {}
): Promise<PaginatedResponse<TallerGPCustomer>> {
  const client = getClient()
  const res = await client.get<PaginatedResponse<TallerGPCustomer>>('/customers', { params })
  return res.data
}

export async function getCustomer(clientId: string): Promise<TallerGPCustomer> {
  const client = getClient()
  const res = await client.get<TallerGPCustomer>(`/customers/${clientId}`)
  return res.data
}

export async function getCustomerVehicles(clientId: number | string): Promise<unknown> {
  const client = getClient()
  const res = await client.get(`/customers/${clientId}/vehicles`)
  return res.data
}
