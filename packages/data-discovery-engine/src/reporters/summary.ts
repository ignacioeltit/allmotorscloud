import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { EntityScanResult } from '../core/entity-scanner.js'

function pct(n: number, total: number): string {
  return total > 0 ? `${Math.round((n / total) * 100)}%` : '0%'
}

export function generateRelationshipMap(results: EntityScanResult[]): string {
  const lines: string[] = []
  const date = new Date().toLocaleString('es-CL')

  lines.push(`# Mapa de Relaciones — API TallerGP`)
  lines.push(``)
  lines.push(`> Generado automáticamente por Data Discovery Engine — ${date}`)
  lines.push(``)
  lines.push(`## Grafo de dependencias`)
  lines.push(``)
  lines.push('```')
  lines.push(`CLIENTES (customers)`)
  lines.push(`  ├─► VEHÍCULOS (vehicles)`)
  lines.push(`  │     ├─► RESGUARDOS (vehicle-intakes)`)
  lines.push(`  │     ├─► CITAS (appointments)`)
  lines.push(`  │     └─► ÓRDENES DE REPARACIÓN (repair-orders)`)
  lines.push(`  │               ├─► PRESUPUESTOS (budgets)`)
  lines.push(`  │               ├─► FACTURAS (invoices)`)
  lines.push(`  │               ├─► NOTAS ENTREGA (purchase-delivery-notes)`)
  lines.push(`  │               └─► LÍNEAS (parts / labor / paint / other / wheels)`)
  lines.push(`  │                         └─► MATERIALES (materials)`)
  lines.push(`  │                                   └─► MOVIMIENTOS STOCK`)
  lines.push(`  └─► FACTURAS (invoices)`)
  lines.push(``)
  lines.push(`PROVEEDORES (suppliers)`)
  lines.push(`  └─► MATERIALES (materials)`)
  lines.push(`        └─► MOVIMIENTOS DE STOCK`)
  lines.push(`        └─► FACTURAS DE COMPRA (purchase-invoices)`)
  lines.push(``)
  lines.push(`EMPLEADOS (employees)`)
  lines.push(`  ├─► ÓRDENES (labor lines → employee_id)`)
  lines.push(`  └─► CITAS (appointments)`)
  lines.push(``)
  lines.push(`MARCAS (brands)`)
  lines.push(`  └─► MODELOS → VEHÍCULOS`)
  lines.push(``)
  lines.push(`ASEGURADORAS (insurers)`)
  lines.push(`  └─► ÓRDENES (insurance_company_id)`)
  lines.push('```')
  lines.push(``)

  lines.push(`## Relaciones detectadas automáticamente`)
  lines.push(``)

  for (const result of results) {
    if (result.relationships.length === 0) continue
    lines.push(`### ${result.config.label} (\`${result.config.key}\`)`)
    lines.push(``)
    lines.push(`| Campo FK | → Entidad | Confianza |`)
    lines.push(`|---|---|---|`)
    for (const r of result.relationships) {
      const conf = r.confidence === 'high' ? '✅' : r.confidence === 'medium' ? '🟡' : '🔴'
      lines.push(`| \`${r.sourceField}\` | \`${r.targetEntity}\` | ${conf} ${r.confidence} |`)
    }
    lines.push(``)
  }

  lines.push(`## Prefijos de ID descubiertos`)
  lines.push(``)
  lines.push(`| Prefijo | Entidad | Ejemplo |`)
  lines.push(`|---|---|---|`)
  for (const result of results) {
    if (result.sampleIds.length > 0) {
      const prefix = result.sampleIds[0].slice(0, 3)
      lines.push(`| \`${prefix}...\` | \`${result.config.key}\` | \`${result.sampleIds[0]}\` |`)
    }
  }

  return lines.join('\n')
}

export function generateCoverageReport(results: EntityScanResult[]): string {
  const lines: string[] = []
  const date = new Date().toLocaleString('es-CL')
  const total = results.length
  const successful = results.filter((r) => !r.error).length
  const withDetail = results.filter((r) => r.detailFields.length > 0).length
  const totalRecords = results.reduce((s, r) => s + (r.pagination?.totalCount ?? 0), 0)
  const failed = results.filter((r) => r.error !== null)

  lines.push(`# Reporte de Cobertura — API TallerGP`)
  lines.push(``)
  lines.push(`> Generado automáticamente por Data Discovery Engine — ${date}`)
  lines.push(``)
  lines.push(`## Resumen ejecutivo`)
  lines.push(``)
  lines.push(`| Métrica | Valor |`)
  lines.push(`|---|---|`)
  lines.push(`| Entidades exploradas | ${successful}/${total} (${pct(successful, total)}) |`)
  lines.push(`| Entidades con detalle | ${withDetail}/${total} (${pct(withDetail, total)}) |`)
  lines.push(`| Total registros disponibles | ${totalRecords.toLocaleString('es-CL')} |`)
  lines.push(`| Entidades con error | ${failed.length} |`)
  lines.push(``)

  lines.push(`## Estado por entidad`)
  lines.push(``)
  lines.push(`| Entidad | Registros | Lista | Detalle | Campos | Relaciones | PDFs |`)
  lines.push(`|---|---|---|---|---|---|---|`)

  for (const r of results) {
    const records = r.pagination?.totalCount?.toLocaleString('es-CL') ?? '?'
    const lista = r.listFields.length > 0 ? '✅' : (r.error ? '❌' : '—')
    const detalle = r.detailFields.length > 0 ? '✅' : (r.config.detailPath ? '⚠️' : 'N/A')
    const campos = r.listFields.length + r.additionalDetailFields.length
    const rels = r.relationships.filter((rel) => rel.targetEntity !== 'unknown').length
    const pdfs = r.resources.filter((res) => res.type === 'pdf').length > 0 ? '✅' : '—'
    lines.push(`| ${r.config.label} | ${records} | ${lista} | ${detalle} | ${campos} | ${rels} | ${pdfs} |`)
  }
  lines.push(``)

  if (failed.length > 0) {
    lines.push(`## Entidades con error`)
    lines.push(``)
    for (const r of failed) {
      lines.push(`- **${r.config.label}** (\`${r.config.key}\`): ${r.error}`)
    }
    lines.push(``)
  }

  lines.push(`## ¿Qué podemos migrar hoy?`)
  lines.push(``)
  lines.push(`### Datos migrables inmediatamente`)
  const migratable = results.filter((r) => r.listFields.length > 0 && !r.error)
  for (const r of migratable) {
    const count = r.pagination?.totalCount ?? 0
    lines.push(`- ✅ **${r.config.label}** — ${count.toLocaleString('es-CL')} registros`)
  }
  lines.push(``)

  lines.push(`### Requieren investigación adicional`)
  lines.push(``)
  const needsWork = results.filter((r) => r.error || r.listFields.length === 0)
  if (needsWork.length === 0) {
    lines.push(`Ninguna — todas las entidades fueron exploradas exitosamente.`)
  } else {
    for (const r of needsWork) {
      lines.push(`- ⚠️ **${r.config.label}** — ${r.error ?? 'sin datos en muestra'}`)
    }
  }
  lines.push(``)

  lines.push(`## Próximos pasos recomendados`)
  lines.push(``)
  lines.push(`1. **Ejecutar extracción completa** de entidades Tier 1: clientes, vehículos, empleados, proveedores`)
  lines.push(`2. **Descargar PDFs** de órdenes cerradas — URL CloudFront requiere verificar expiración`)
  lines.push(`3. **Explorar \`/brands/{id}/models\`** para completar el catálogo de marcas/modelos`)
  lines.push(`4. **Verificar campos numérico-string** — convertir antes de insertar en PostgreSQL`)
  lines.push(`5. **Mapear \`client_type\`**: \`"1"\` = persona natural, \`"2"\` = empresa — relevante para RUT`)
  lines.push(`6. **Preservar \`tallergp_id\`** en todas las tablas del ERP para trazabilidad`)

  return lines.join('\n')
}

export function writeSummaryReports(
  docsDir: string,
  results: EntityScanResult[]
): void {
  mkdirSync(docsDir, { recursive: true })

  const relationshipMap = generateRelationshipMap(results)
  writeFileSync(join(docsDir, 'API_RELATIONSHIP_MAP.md'), relationshipMap, 'utf-8')

  const coverageReport = generateCoverageReport(results)
  writeFileSync(join(docsDir, 'API_COVERAGE_REPORT.md'), coverageReport, 'utf-8')
}
