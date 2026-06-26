import { getClient, type PaginatedResponse } from '../client.js'

export interface BudgetLine {
  line_id: string
  description: string
  quantity: string
  reference?: string
  unit_price_net: string
  discount_percentage: string
  total_line_amount_net_calculated: string
  [key: string]: unknown
}

export interface TallerGPBudget {
  budget_id: string
  budget_number: string
  budget_date_formatted?: string
  status_description?: string
  valid_until_date_formatted?: string
  subtotal_net_amount?: number
  total_tax_amount?: number
  total_amount_vat_included?: number
  client_id?: string
  vehicle_id?: string
  parts?: BudgetLine[]
  labor?: BudgetLine[]
  other?: BudgetLine[]
  [key: string]: unknown
}

export interface BudgetListParams {
  page?: number
  per_page?: number
  client_id?: string
  vehicle_id?: string
  budget_number?: string
  from_date?: string
  to_date?: string
}

export async function listBudgets(
  params: BudgetListParams = {}
): Promise<PaginatedResponse<TallerGPBudget>> {
  const client = getClient()
  const res = await client.get<PaginatedResponse<TallerGPBudget>>('/budgets', { params })
  return res.data
}

export async function getBudget(budgetId: string): Promise<TallerGPBudget> {
  const client = getClient()
  const res = await client.get<TallerGPBudget>(`/budgets/${budgetId}`)
  return res.data
}
