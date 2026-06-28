import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { EntityScanResult } from '../core/entity-scanner.js'
import type { FieldAnalysis } from '../core/field-analyzer.js'

function fieldTypeLabel(f: FieldAnalysis): string {
  if (f.isPdfUrl) return '`pdf-url`'
  if (f.isCdnUrl) return '`cdn-url`'
  if (f.isUrl) return '`url`'
  if (f.isDate) return '`date`'
  if (f.isCurrencyAmount) return '`currency`'
  if (f.isNumericString) return '`numeric-string`'
  if (f.isHashId) return '`hash-id`'
  if (f.isBoolean) return '`boolean`'
  if (f.isArray) return '`array`'
  if (f.isObject) return '`object`'
  if (f.isEnum && f.enumValues) return `\`enum(${f.enumValues.join('|')})\``
  const types = f.observedTypes.filter((t) => t !== 'null')
  return types.length > 0 ? `\`${types.join('|')}\`` : '`unknown`'
}

function fieldFlags(f: FieldAnalysis): string {
  const flags: string[] = []
  if (f.isForeignKey) flags.push('FK')
  if (f.nullRate === 100) flags.push('siempre null')
  else if (f.nullRate > 80) flags.push('casi null')
  else if (f.nullRate > 0) flags.push(`null ${f.nullRate}%`)
  if (f.resolvedEntity) flags.push(`→ ${f.resolvedEntity}`)
  return flags.length > 0 ? flags.join(', ') : '—'
}

function renderFieldTable(fields: FieldAnalysis[], title: string): string {
  if (fields.length === 0) return ''
  const rows = fields.map((f) => {
    const ex = f.examples[0] ?? ''
    const safe = ex.length > 50 ? ex.slice(0, 47) + '...' : ex
    return `| \`${f.name}\` | ${fieldTypeLabel(f)} | ${fieldFlags(f)} | \`${safe}\` |`
  }).join('\n')
  return `### ${title}\n\n| Campo | Tipo | Notas | Ejemplo |\n|---|---|---|---|\n${rows}\n`
}

export function generateEntityMarkdown(result: EntityScanResult): string {
  const { config, pagination, listFields, detailFields, additionalDetailFields, resources, relationships } = result
  const date = new Date(result.scannedAt).toLocaleString('es-CL')
  const lines: string[] = []

  lines.push(`# ${config.label}`)
  lines.push(``)
  lines.push(`> Generado automáticamente por Data Discovery Engine — ${date}`)
  lines.push(``)
  lines.push(`## Resumen`)
  lines.push(``)
  lines.push(`| Propiedad | Valor |`)
  lines.push(`|---|---|`)
  lines.push(`| Endpoint lista | \`GET ${config.endpoint}\` |`)
  lines.push(`| Endpoint detalle | ${config.detailPath ? `\`GET ${config.detailPath}\`` : 'No disponible'} |`)
  lines.push(`| Total registros | ${pagination?.totalCount?.toLocaleString('es-CL') ?? '?'} |`)
  lines.push(`| Total páginas | ${pagination?.totalPages ?? '?'} |`)
  lines.push(`| Campos en lista | ${listFields.length} |`)
  lines.push(`| Campos adicionales en detalle | ${additionalDetailFields.length} |`)
  lines.push(`| Relaciones detectadas | ${relationships.length} |`)
  lines.push(`| Recursos (PDF/CDN/URL) | ${resources.length} |`)
  if (result.error) lines.push(`| Error | ⚠️ ${result.error} |`)
  lines.push(``)

  if (config.notes) {
    lines.push(`> **Nota:** ${config.notes}`)
    lines.push(``)
  }

  if (relationships.length > 0) {
    lines.push(`## Relaciones`)
    lines.push(``)
    lines.push(`| Campo FK | Entidad objetivo | Confianza |`)
    lines.push(`|---|---|---|`)
    for (const r of relationships) {
      const conf = r.confidence === 'high' ? '✅ alta' : r.confidence === 'medium' ? '🟡 media' : '🔴 baja'
      lines.push(`| \`${r.sourceField}\` | \`${r.targetEntity}\` | ${conf} |`)
    }
    lines.push(``)
  }

  if (resources.length > 0) {
    lines.push(`## Recursos Detectados`)
    lines.push(``)
    lines.push(`| Campo | Tipo | Ejemplo |`)
    lines.push(`|---|---|---|`)
    for (const r of resources) {
      const ex = r.example.length > 70 ? r.example.slice(0, 67) + '...' : r.example
      lines.push(`| \`${r.field}\` | ${r.type} | \`${ex}\` |`)
    }
    lines.push(``)
  }

  lines.push(renderFieldTable(listFields, 'Campos del Listado'))

  if (additionalDetailFields.length > 0) {
    const detailOnly = detailFields.filter((f) => additionalDetailFields.includes(f.name))
    lines.push(renderFieldTable(detailOnly, 'Campos Adicionales en Detalle'))
  }

  lines.push(`## Observaciones`)
  lines.push(``)

  const allFields = [...listFields, ...detailFields]
  const alwaysNull = allFields.filter((f) => f.nullRate === 100)
  const numStr = allFields.filter((f) => f.isNumericString)
  const hasPdf = resources.some((r) => r.type === 'pdf')
  const hasImages = listFields.some((f) => f.name === 'images' || f.name === 'photos')

  if (alwaysNull.length > 0) {
    lines.push(`- **${alwaysNull.length} campos siempre nulos** en la muestra: ${alwaysNull.map((f) => `\`${f.name}\``).join(', ')}`)
  }
  if (numStr.length > 0) {
    lines.push(`- **Números como string**: ${numStr.map((f) => `\`${f.name}\``).join(', ')} — verificar y convertir al migrar`)
  }
  if (hasPdf) {
    lines.push(`- **PDFs en CloudFront** — requieren descarga independiente antes de migrar`)
  }
  if (hasImages) {
    lines.push(`- **Imágenes/fotos** detectadas — requieren estrategia de migración de assets`)
  }
  if (allFields.length === 0) {
    lines.push(`- Sin datos disponibles para analizar`)
  }

  return lines.join('\n')
}

export function writeEntityMarkdown(docsDir: string, result: EntityScanResult): string {
  mkdirSync(docsDir, { recursive: true })
  const content = generateEntityMarkdown(result)
  const filePath = join(docsDir, `${result.config.key}.md`)
  writeFileSync(filePath, content, 'utf-8')
  return filePath
}
