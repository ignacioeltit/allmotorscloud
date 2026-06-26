import { getClient, type PaginatedResponse } from '../client.js'

export interface InvoiceLine {
  line_id: string
  description: string
  quantity: string
  unit_price_net: string
  discount_percentage: string
  total_line_amount_net_calculated: string
  [key: string]: unknown
}

export interface TallerGPInvoice {
  invoice_id: string
  invoice_number: string
  date?: string
  client_id?: string
  vehicle_id?: string
  plate?: string
  vin?: string
  total_amount_with_vat?: number
  total_amount_without_vat?: number
  status_name?: string
  currency?: string
  accounted?: boolean
  blocked?: boolean
  lines?: InvoiceLine[]
  pdf?: string
  [key: string]: unknown
}

export interface InvoiceListParams {
  page?: number
  per_page?: number
  client_id?: string
  vehicle_id?: string
  invoice_number?: string
  from_date?: string
  to_date?: string
}

export async function listInvoices(
  params: InvoiceListParams = {}
): Promise<PaginatedResponse<TallerGPInvoice>> {
  const client = getClient()
  const res = await client.get<PaginatedResponse<TallerGPInvoice>>('/invoices', { params })
  return res.data
}

export async function getInvoice(invoiceId: string): Promise<TallerGPInvoice> {
  const client = getClient()
  const res = await client.get<TallerGPInvoice>(`/invoices/${invoiceId}`)
  return res.data
}
