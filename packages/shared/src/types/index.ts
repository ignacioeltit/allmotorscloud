// Tipos TypeScript compartidos entre web y mobile.
// Estos tipos NO tienen dependencias de framework.

export type UUID = string

// Tipo base para todas las entidades per-tenant
export interface TenantEntity {
  id: UUID
  org_id: UUID
  creado_en: string // ISO 8601
  actualizado_en: string
  eliminado_en: string | null
}

// Tipo base para entidades append-only (sin eliminado_en)
export interface AppendOnlyEntity {
  id: UUID
  org_id: UUID
  creado_en: string
}
