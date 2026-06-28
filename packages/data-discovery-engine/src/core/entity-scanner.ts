import { getClient } from '@allmotors/migration-toolkit/api/tallergp/client'
import { logger } from '@allmotors/migration-toolkit/utils/logger'
import { analyzeFields, registerIdPrefix, type FieldAnalysis } from './field-analyzer.js'
import type { EntityConfig } from '../config/entities.js'

export interface ScanPagination {
  totalCount: number
  totalPages: number
  currentPage: number
  perPage: number
}

export interface EntityScanResult {
  config: EntityConfig
  pagination: ScanPagination | null
  listFields: FieldAnalysis[]
  detailFields: FieldAnalysis[]
  additionalDetailFields: string[]
  resources: ResourceInfo[]
  relationships: RelationshipInfo[]
  sampleIds: string[]
  error: string | null
  scannedAt: string
}

export interface ResourceInfo {
  field: string
  type: 'pdf' | 'image' | 'video' | 'cdn' | 'url'
  example: string
}

export interface RelationshipInfo {
  sourceField: string
  targetEntity: string
  exampleId: string
  confidence: 'high' | 'medium' | 'low'
}

const SAMPLE_SIZE = 3

function parsePagination(raw: Record<string, unknown>): ScanPagination {
  return {
    totalCount: Number(raw.total_count ?? 0),
    totalPages: Number(raw.total_pages ?? 0),
    currentPage: Number(raw.current_page ?? 1),
    perPage: Number(raw.per_page ?? SAMPLE_SIZE),
  }
}

function extractResources(fields: FieldAnalysis[]): ResourceInfo[] {
  const resources: ResourceInfo[] = []
  for (const f of fields) {
    if (!f.isUrl) continue
    const ex = f.examples[0] ?? ''
    if (f.isPdfUrl) {
      resources.push({ field: f.name, type: 'pdf', example: ex })
    } else if (f.isCdnUrl) {
      resources.push({ field: f.name, type: 'cdn', example: ex })
    } else {
      resources.push({ field: f.name, type: 'url', example: ex })
    }
  }
  return resources
}

function extractRelationships(fields: FieldAnalysis[]): RelationshipInfo[] {
  const rels: RelationshipInfo[] = []
  for (const f of fields) {
    if (!f.isForeignKey) continue
    const ex = f.examples[0] ?? ''
    if (f.resolvedEntity) {
      rels.push({
        sourceField: f.name,
        targetEntity: f.resolvedEntity,
        exampleId: ex,
        confidence: 'high',
      })
    } else if (ex) {
      rels.push({
        sourceField: f.name,
        targetEntity: 'unknown',
        exampleId: ex,
        confidence: 'low',
      })
    }
  }
  return rels
}

export async function scanEntity(config: EntityConfig): Promise<EntityScanResult> {
  const client = getClient()
  const scannedAt = new Date().toISOString()

  const result: EntityScanResult = {
    config,
    pagination: null,
    listFields: [],
    detailFields: [],
    additionalDetailFields: [],
    resources: [],
    relationships: [],
    sampleIds: [],
    error: null,
    scannedAt,
  }

  // ── Step 1: List endpoint ──────────────────────────────────────────────────
  let listRecords: Record<string, unknown>[] = []

  try {
    const res = await client.get<{
      pagination: Record<string, unknown>
      data: Record<string, unknown>[]
    }>(config.endpoint, {
      params: { page: 1, per_page: SAMPLE_SIZE },
    })

    const body = res.data
    if (body.pagination) {
      result.pagination = parsePagination(body.pagination)
    }

    listRecords = body.data ?? []
    result.listFields = analyzeFields(listRecords)

    // Collect entity ID prefix for relationship detection
    const idValues = listRecords
      .map((r) => r[config.idField])
      .filter((v): v is string => typeof v === 'string' && v.length > 0)

    result.sampleIds = idValues.slice(0, 3)

    if (idValues.length > 0) {
      const prefix = idValues[0].slice(0, 3)
      registerIdPrefix(prefix, config.key)
    }

    logger.info(`  Lista OK — ${result.pagination?.totalCount ?? '?'} registros`, {
      entity: config.key,
    })
  } catch (err) {
    const msg = (err as Error).message
    result.error = `Error en lista: ${msg}`
    logger.error(`  Error en lista de ${config.key}: ${msg}`)
    return result
  }

  // ── Step 2: Detail endpoint ────────────────────────────────────────────────
  if (!config.detailPath || listRecords.length === 0) {
    result.resources = extractResources(result.listFields)
    result.relationships = extractRelationships(result.listFields)
    return result
  }

  const firstId = listRecords[0][config.idField]
  if (!firstId) {
    result.resources = extractResources(result.listFields)
    result.relationships = extractRelationships(result.listFields)
    return result
  }

  try {
    const detailUrl = config.detailPath.replace('{id}', String(firstId))
    const res = await client.get<Record<string, unknown>>(detailUrl)
    const detailRecord = res.data

    // Detail can return a single object or a paginated response
    const detailRecords: Record<string, unknown>[] = Array.isArray(detailRecord)
      ? detailRecord
      : [detailRecord]

    result.detailFields = analyzeFields(detailRecords)

    // Find fields that only appear in detail (not in list)
    const listFieldNames = new Set(result.listFields.map((f) => f.name))
    result.additionalDetailFields = result.detailFields
      .map((f) => f.name)
      .filter((n) => !listFieldNames.has(n))

    logger.info(`  Detalle OK — ${result.additionalDetailFields.length} campos adicionales vs lista`, {
      entity: config.key,
    })
  } catch (err) {
    const msg = (err as Error).message
    logger.warn(`  Detalle no disponible para ${config.key}: ${msg}`)
    // No es un error fatal — la lista ya fue obtenida
  }

  // Merge all fields for resource/relationship extraction
  const allFields = [
    ...result.listFields,
    ...result.detailFields.filter((f) =>
      result.additionalDetailFields.includes(f.name)
    ),
  ]

  result.resources = extractResources(allFields)
  result.relationships = extractRelationships(allFields)

  return result
}
