import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { EntityScanResult } from '../core/entity-scanner.js'

export interface CatalogEntry {
  entity: string
  label: string
  endpoint: string
  record_count: number
  total_pages: number
  supports_detail: boolean
  supports_pagination: boolean
  list_fields: string[]
  detail_only_fields: string[]
  relationships: Array<{
    field: string
    target_entity: string
    confidence: string
  }>
  resources: Array<{
    field: string
    type: string
    example: string
  }>
  foreign_keys: string[]
  nullable_fields: string[]
  currency_fields: string[]
  date_fields: string[]
  last_scan: string
  error: string | null
}

export function buildCatalogEntry(result: EntityScanResult): CatalogEntry {
  const allFields = [...result.listFields, ...result.detailFields]
  const uniqueFields = Array.from(new Map(allFields.map((f) => [f.name, f])).values())

  return {
    entity: result.config.key,
    label: result.config.label,
    endpoint: result.config.endpoint,
    record_count: result.pagination?.totalCount ?? 0,
    total_pages: result.pagination?.totalPages ?? 0,
    supports_detail: result.config.detailPath !== null,
    supports_pagination: result.pagination !== null,
    list_fields: result.listFields.map((f) => f.name),
    detail_only_fields: result.additionalDetailFields,
    relationships: result.relationships.map((r) => ({
      field: r.sourceField,
      target_entity: r.targetEntity,
      confidence: r.confidence,
    })),
    resources: result.resources.map((r) => ({
      field: r.field,
      type: r.type,
      example: r.example,
    })),
    foreign_keys: uniqueFields.filter((f) => f.isForeignKey).map((f) => f.name),
    nullable_fields: uniqueFields.filter((f) => f.nullRate > 50).map((f) => f.name),
    currency_fields: uniqueFields.filter((f) => f.isCurrencyAmount).map((f) => f.name),
    date_fields: uniqueFields.filter((f) => f.isDate).map((f) => f.name),
    last_scan: result.scannedAt,
    error: result.error,
  }
}

export function writeCatalog(
  catalogDir: string,
  entry: CatalogEntry
): void {
  mkdirSync(catalogDir, { recursive: true })
  const path = join(catalogDir, `${entry.entity}.json`)
  writeFileSync(path, JSON.stringify(entry, null, 2), 'utf-8')
}
