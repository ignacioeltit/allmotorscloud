import { getClient, type PaginatedResponse } from '../client.js'

// ── Tipos inferidos de la documentación API + evidencia de líneas de OT ──────
// Los nombres exactos de campos son estimados hasta confirmar con respuesta real.
// Los fields con [key: string] absorben campos adicionales no documentados.

export interface TallerGPMaterial {
  id: string
  // Código / referencia del material
  reference?: string | null
  code?: string | null
  // Nombre / descripción
  description?: string | null
  name?: string | null
  // Precios (pueden venir como string o number según el endpoint)
  cost_price?: string | number | null
  sale_price?: string | number | null
  unit_price?: string | number | null
  // Stock
  stock?: number | string | null
  min_stock?: number | string | null
  minimum_stock?: number | string | null
  // Clasificación
  category_id?: string | number | null
  category?: string | null
  family?: string | null
  subfamily?: string | null
  type?: string | null           // 'material', 'service', 'labor', etc.
  type_id?: string | number | null
  // Proveedor
  supplier_id?: string | number | null
  supplier?: string | null
  // Otros
  brand?: string | null
  barcode?: string | null
  unit?: string | null
  active?: boolean | number | string | null
  [key: string]: unknown
}

export interface TallerGPSupplier {
  id: string
  name?: string | null
  code?: string | null
  vat_number?: string | null
  phone?: string | null
  mail?: string | null
  [key: string]: unknown
}

export interface MaterialListParams {
  page?: number
  per_page?: number
  reference?: string
  description?: string
  category_id?: number | string
  supplier_id?: number | string
  active?: boolean
}

export interface MaterialMovement {
  id?: string
  material_id?: string
  type?: string
  quantity?: number | string
  date?: string
  reference?: string | null
  [key: string]: unknown
}

// ── Funciones ─────────────────────────────────────────────────────────────────

export async function listMaterials(
  params: MaterialListParams = {}
): Promise<PaginatedResponse<TallerGPMaterial>> {
  const client = getClient()
  const res = await client.get<PaginatedResponse<TallerGPMaterial>>('/materials', { params })
  return res.data
}

export async function getMaterial(materialId: string): Promise<TallerGPMaterial> {
  const client = getClient()
  const res = await client.get<TallerGPMaterial>(`/materials/${materialId}`)
  return res.data
}

export async function getMaterialMovements(
  materialId: string
): Promise<PaginatedResponse<MaterialMovement>> {
  const client = getClient()
  const res = await client.get<PaginatedResponse<MaterialMovement>>(
    `/materials/${materialId}/movements`
  )
  return res.data
}

export async function listSuppliers(
  params: { page?: number; per_page?: number } = {}
): Promise<PaginatedResponse<TallerGPSupplier>> {
  const client = getClient()
  const res = await client.get<PaginatedResponse<TallerGPSupplier>>('/suppliers', { params })
  return res.data
}

/**
 * Descarga el catálogo completo de materiales paginando automáticamente.
 * Limita a `maxPages` para evitar descargas infinitas en caso de error.
 */
export async function fetchAllMaterials(
  perPage = 100,
  maxPages = 500,
  onProgress?: (downloaded: number, total: number, page: number) => void
): Promise<TallerGPMaterial[]> {
  const all: TallerGPMaterial[] = []
  let page = 1
  let totalPages = 1

  do {
    const res = await listMaterials({ page, per_page: perPage })
    all.push(...res.data)
    totalPages = Math.min(res.pagination.total_pages, maxPages)
    onProgress?.(all.length, res.pagination.total_count, page)
    page++
    if (page <= totalPages) await sleep(300)
  } while (page <= totalPages)

  return all
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
