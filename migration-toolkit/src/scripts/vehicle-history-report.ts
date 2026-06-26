import { writeFileSync } from 'fs'
import { join } from 'path'
import type { VehicleHistory } from './vehicle-history.js'
import type { TallerGPRepairOrder } from '../api/tallergp/endpoints/repair-orders.js'

const CLP = (n: number | string | undefined): string => {
  const num = Number(n ?? 0)
  return isNaN(num) ? '—' : `$${num.toLocaleString('es-CL')}`
}

const str = (v: unknown): string => (v != null && v !== '' ? String(v) : '—')

interface PartSummary {
  reference: string
  description: string
  quantity: number
  unitPrice: number
  total: number
  orderId: string
  orderNumber: string
}

interface LaborSummary {
  description: string
  quantity: number
  employee: string
  total: number
  orderNumber: string
}

function sortedOTs(details: TallerGPRepairOrder[]): TallerGPRepairOrder[] {
  return [...details].sort((a, b) => {
    const dateA = parseDate(a.entry_date_formatted as string ?? a.entry_date as string)
    const dateB = parseDate(b.entry_date_formatted as string ?? b.entry_date as string)
    return dateA - dateB
  })
}

function parseDate(formatted: string | undefined): number {
  if (!formatted) return 0
  const [datePart] = formatted.split(' ')
  const parts = datePart?.split('/')
  if (!parts || parts.length < 3) return 0
  return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime()
}

function aggregateParts(details: TallerGPRepairOrder[]): PartSummary[] {
  const map = new Map<string, PartSummary>()
  for (const ot of details) {
    const parts = (ot.parts as any[]) ?? []
    for (const p of parts) {
      if (Number(p.is_visible) === 0) continue
      const key = p.reference ?? p.description
      const qty = Number(p.quantity ?? 1)
      const unit = Number(p.unit_price_net ?? 0)
      const total = Number(p.total_line_amount_net_calculated ?? unit * qty)
      if (map.has(key)) {
        const ex = map.get(key)!
        ex.quantity += qty
        ex.total += total
      } else {
        map.set(key, {
          reference: p.reference ?? '—',
          description: p.description ?? '—',
          quantity: qty,
          unitPrice: unit,
          total,
          orderId: ot.entry_id as string,
          orderNumber: ot.order_number as string,
        })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function aggregateLabor(details: TallerGPRepairOrder[]): LaborSummary[] {
  const lines: LaborSummary[] = []
  for (const ot of details) {
    const labor = (ot.labor as any[]) ?? []
    for (const l of labor) {
      const total = Number(l.total_line_amount_net_calculated ?? 0)
      if (total === 0 && Number(l.unit_price_net ?? 0) === 0) continue
      lines.push({
        description: l.description ?? '—',
        quantity: Number(l.quantity ?? 1),
        employee: l.employee_number ?? '—',
        total,
        orderNumber: ot.order_number as string,
      })
    }
  }
  return lines
}

export async function generateVehicleReport(
  h: VehicleHistory,
  reportsDir: string
): Promise<string> {
  const lines: string[] = []
  const date = new Date().toLocaleString('es-CL')
  const vd = h.vehicleDetail ?? h.vehicle
  const c = h.customer
  const ots = sortedOTs(h.repairOrderDetails)
  const parts = aggregateParts(h.repairOrderDetails)
  const labor = aggregateLabor(h.repairOrderDetails)

  // ── Totales financieros ──────────────────────────────────────────────────
  const totalOTs = h.repairOrderDetails.reduce(
    (s, ot) => s + Number(ot.total_amount_vat_incl_from_entry ?? 0), 0
  )
  const totalFacturas = h.invoiceDetails.reduce(
    (s, inv) => s + Number(inv.total_amount_with_vat ?? 0), 0
  )
  const totalPartes = parts.reduce((s, p) => s + p.total, 0)
  const totalManoObra = labor.reduce((s, l) => s + l.total, 0)

  // ── Header ───────────────────────────────────────────────────────────────
  lines.push(`# Historial Completo — ${h.plate}`)
  lines.push(``)
  lines.push(`> Generado: ${date} | Fuente: TallerGP API (solo lectura)`)
  lines.push(``)

  // ── Vehículo ─────────────────────────────────────────────────────────────
  lines.push(`## Datos del Vehículo`)
  lines.push(``)
  lines.push(`| Campo | Valor |`)
  lines.push(`|---|---|`)
  lines.push(`| Patente | **${h.plate}** |`)
  lines.push(`| VIN | ${str(vd?.vin)} |`)
  lines.push(`| Marca | ${str(vd?.branch ?? (vd as any)?.brand)} |`)
  lines.push(`| Modelo | ${str(vd?.model)} |`)
  lines.push(`| Color | ${str((vd as any)?.color)} |`)
  lines.push(`| Año | ${str((vd as any)?.model_year)} |`)
  lines.push(`| Combustible | ${str((vd as any)?.fuel_type_id)} |`)
  lines.push(`| Próxima ITV | ${str(vd?.next_itv ?? (vd as any)?.next_itv_date)} |`)
  lines.push(`| Próxima revisión | ${str((vd as any)?.next_revision_date)} |`)
  lines.push(`| ID interno API | \`${str(vd?.id)}\` |`)
  lines.push(``)

  // ── Cliente ──────────────────────────────────────────────────────────────
  lines.push(`## Cliente`)
  lines.push(``)
  if (c) {
    const fullName = [c.name, c.lastname, c.surname].filter(Boolean).join(' ')
    lines.push(`| Campo | Valor |`)
    lines.push(`|---|---|`)
    lines.push(`| Nombre completo | ${fullName || '—'} |`)
    lines.push(`| N° cliente | ${str(c.customer_number)} |`)
    lines.push(`| RUT / VAT | ${str(c.vat_number)} |`)
    lines.push(`| Tipo | ${c.client_type === '1' ? 'Persona natural' : c.client_type === '2' ? 'Empresa' : str(c.client_type)} |`)
    lines.push(`| Teléfono | ${str(c.phone ?? c.mobile)} |`)
    lines.push(`| Email | ${str(c.mail)} |`)
    lines.push(`| Dirección | ${str(c.address)} |`)
    lines.push(`| Ciudad | ${str(c.location)} |`)
    lines.push(`| ID interno API | \`${str(c.id)}\` |`)
  } else {
    lines.push(`> No se pudo obtener información del cliente.`)
  }
  lines.push(``)

  // ── Resumen financiero ───────────────────────────────────────────────────
  lines.push(`## Resumen Financiero`)
  lines.push(``)
  lines.push(`| Concepto | Valor |`)
  lines.push(`|---|---|`)
  lines.push(`| OTs procesadas | ${h.repairOrderDetails.length} de ${h.repairOrders.length} |`)
  lines.push(`| Total ingresos (OTs, c/IVA) | **${CLP(totalOTs)}** |`)
  lines.push(`| Total facturado (c/IVA) | **${CLP(totalFacturas)}** |`)
  lines.push(`| Total en repuestos (neto) | ${CLP(totalPartes)} |`)
  lines.push(`| Total en mano de obra (neto) | ${CLP(totalManoObra)} |`)
  lines.push(`| Presupuestos encontrados | ${h.budgets.length} |`)
  lines.push(`| Facturas encontradas | ${h.invoiceDetails.length} |`)
  lines.push(`| PDFs disponibles | ${h.pdfs.length} |`)
  lines.push(``)

  // ── PDFs ─────────────────────────────────────────────────────────────────
  if (h.pdfs.length > 0) {
    lines.push(`## PDFs Disponibles`)
    lines.push(``)
    lines.push(`| Tipo | Número | URL |`)
    lines.push(`|---|---|---|`)
    for (const pdf of h.pdfs) {
      const tipo = pdf.source === 'invoice' ? 'Factura' : 'OT'
      const num = pdf.orderNumber ?? pdf.invoiceNumber ?? '—'
      const short = pdf.url.length > 70 ? pdf.url.slice(0, 67) + '...' : pdf.url
      lines.push(`| ${tipo} | ${num} | [PDF](${pdf.url}) \`${short}\` |`)
    }
    lines.push(``)
  }

  // ── Historial cronológico ─────────────────────────────────────────────────
  lines.push(`## Historial Cronológico`)
  lines.push(``)

  if (ots.length === 0) {
    lines.push(`> Sin órdenes de trabajo registradas para este vehículo.`)
    lines.push(``)
  }

  for (const ot of ots) {
    const fecha = str(ot.entry_date_formatted ?? ot.entry_date)
    const salida = str((ot as any).exit_datetime_formatted)
    const kms = str((ot as any).kilometres)
    const estado = ot.is_closed === '1' || ot.is_closed === true || ot.is_closed === 1
      ? '✅ Cerrada' : '🔄 Abierta'
    const totalOT = CLP(ot.total_amount_vat_incl_from_entry ?? (ot as any).total_amount_vat_included)
    const invNum = str((ot as any).associated_invoice_number)
    const invId = str((ot as any).associated_invoice_id)

    lines.push(`### ${ot.order_number} — ${fecha}`)
    lines.push(``)
    lines.push(`| | |`)
    lines.push(`|---|---|`)
    lines.push(`| Estado | ${estado} |`)
    lines.push(`| Fecha entrada | ${fecha} |`)
    lines.push(`| Fecha salida | ${salida} |`)
    lines.push(`| Kilómetros | ${kms !== '—' ? `${Number(kms).toLocaleString('es-CL')} km` : '—'} |`)
    lines.push(`| Total (c/IVA) | ${totalOT} |`)
    lines.push(`| Factura | ${invNum !== '—' ? invNum : '—'} |`)
    lines.push(`| Nivel combustible | ${str((ot as any).fuel_level_name)} |`)
    lines.push(``)

    // Diagnóstico
    const diag = str((ot as any).breakdown_description)
    if (diag !== '—') {
      lines.push(`**Diagnóstico / Solicitud del cliente:**`)
      lines.push(``)
      lines.push('```')
      lines.push(diag.trim())
      lines.push('```')
      lines.push(``)
    }

    // Repuestos
    const otParts = ((ot.parts ?? []) as any[]).filter((p) => Number(p.is_visible) !== 0)
    if (otParts.length > 0) {
      lines.push(`**Repuestos:**`)
      lines.push(``)
      lines.push(`| Ref | Descripción | Cant | P.Unit (neto) | Total (neto) |`)
      lines.push(`|---|---|---|---|---|`)
      for (const p of otParts) {
        const qty = Number(p.quantity ?? 1)
        const unit = Number(p.unit_price_net ?? 0)
        const tot = Number(p.total_line_amount_net_calculated ?? unit * qty)
        lines.push(`| ${str(p.reference)} | ${str(p.description)} | ${qty} | ${CLP(unit)} | ${CLP(tot)} |`)
      }
      lines.push(``)
    }

    // Mano de obra
    const otLabor = ((ot.labor ?? []) as any[]).filter(
      (l) => Number(l.total_line_amount_net_calculated ?? 0) !== 0 || Number(l.unit_price_net ?? 0) !== 0
    )
    if (otLabor.length > 0) {
      lines.push(`**Mano de obra:**`)
      lines.push(``)
      lines.push(`| Descripción | Cant | Empleado | Total (neto) |`)
      lines.push(`|---|---|---|---|`)
      for (const l of otLabor) {
        const tot = Number(l.total_line_amount_net_calculated ?? 0)
        lines.push(`| ${str(l.description)} | ${str(l.quantity)} | ${str(l.employee_number)} | ${CLP(tot)} |`)
      }
      lines.push(``)
    }

    // Otros cargos
    const otOther = ((ot.other ?? []) as any[])
    if (otOther.length > 0) {
      lines.push(`**Otros cargos / Descuentos:**`)
      lines.push(``)
      for (const o of otOther) {
        const tot = Number(o.total_line_amount_net_calculated ?? 0)
        lines.push(`- ${str(o.description)}: ${CLP(tot)}`)
      }
      lines.push(``)
    }

    // Observaciones de la OT
    const obs = str((ot as any).observations)
    if (obs !== '—') {
      lines.push(`**Observaciones:** ${obs}`)
      lines.push(``)
    }

    // Recursos
    const res = (ot as any).resources
    const images: unknown[] = res?.images ?? []
    const videos: unknown[] = res?.videos ?? []
    const documents: unknown[] = (ot as any).documents ?? []
    if (images.length > 0 || videos.length > 0 || documents.length > 0) {
      lines.push(`**Recursos adjuntos:** ${images.length} imágenes · ${videos.length} videos · ${documents.length} documentos`)
      lines.push(``)
    }

    if (invNum !== '—' && invId !== '—') {
      lines.push(`**Factura asociada:** ${invNum} (ID: \`${invId}\`)`)
      lines.push(``)
    }

    lines.push(`---`)
    lines.push(``)
  }

  // ── Resumen de repuestos ──────────────────────────────────────────────────
  if (parts.length > 0) {
    lines.push(`## Repuestos Totales Utilizados`)
    lines.push(``)
    lines.push(`| Referencia | Descripción | Cant total | Total neto |`)
    lines.push(`|---|---|---|---|`)
    for (const p of parts.slice(0, 30)) {
      lines.push(`| ${p.reference} | ${p.description} | ${p.quantity} | ${CLP(p.total)} |`)
    }
    if (parts.length > 30) lines.push(`| … | *(${parts.length - 30} más)* | | |`)
    lines.push(``)
  }

  // ── Facturas ─────────────────────────────────────────────────────────────
  if (h.invoiceDetails.length > 0) {
    lines.push(`## Facturas`)
    lines.push(``)
    lines.push(`| N° Factura | Fecha | Total (c/IVA) | Estado |`)
    lines.push(`|---|---|---|---|`)
    for (const inv of h.invoiceDetails) {
      lines.push(`| ${str(inv.invoice_number)} | ${str(inv.date)} | ${CLP(inv.total_amount_with_vat)} | ${str(inv.status_name)} |`)
    }
    lines.push(``)
  }

  // ── Kilómetros ────────────────────────────────────────────────────────────
  const kmsData = ots
    .map((ot) => ({ num: ot.order_number, kms: Number((ot as any).kilometres ?? 0), fecha: str(ot.entry_date_formatted ?? ot.entry_date) }))
    .filter((r) => r.kms > 0)

  if (kmsData.length > 0) {
    lines.push(`## Registro de Kilometrajes`)
    lines.push(``)
    lines.push(`| OT | Fecha | Km registrados |`)
    lines.push(`|---|---|---|`)
    for (const r of kmsData) {
      lines.push(`| ${r.num} | ${r.fecha} | ${r.kms.toLocaleString('es-CL')} km |`)
    }
    lines.push(``)
  }

  // ── Campos faltantes / No disponibles por API ─────────────────────────────
  lines.push(`## Campos Faltantes y Límites de la API`)
  lines.push(``)
  lines.push(`Esta sección documenta información visible en la **interfaz web de TallerGP** que **NO pudo obtenerse mediante la API oficial**.`)
  lines.push(``)
  lines.push(`| Información | Disponible vía API | Observación |`)
  lines.push(`|---|---|---|`)
  lines.push(`| Fotos de recepción del vehículo | ❌ | \`resources.images[]\` vacío en todas las OTs muestreadas |`)
  lines.push(`| Videos de recepción | ❌ | \`resources.videos[]\` vacío en todas las OTs |`)
  lines.push(`| Firma digital del cliente | ❌ | \`signature_acceptance_type\` siempre null |`)
  lines.push(`| Checklist inspección (valores) | ⚠️ Parcial | Las líneas aparecen en \`labor[]\` pero sin valor de condición (OK/Mal/Regular) |`)
  lines.push(`| Historial de cambios de estado | ❌ | API muestra solo estado actual, no auditoría de cambios |`)
  lines.push(`| Clocking / Ficha de horas | ❌ | \`clocking_id\` null en todas las líneas de labor muestreadas |`)
  lines.push(`| Documentos adjuntos | ⚠️ Parcial | Campo \`documents[]\` vacío en muestra; puede haber datos en otros registros |`)
  lines.push(`| Comentarios internos técnico | ❌ | No hay campo de comentarios privados en la respuesta |`)
  lines.push(`| Fotos del diagnóstico (intraOT) | ❌ | No expuesto en API |`)
  lines.push(`| Historial de servicio previo | ✅ | Disponible como lista de OTs paginadas |`)
  lines.push(`| PDFs de OTs | ✅ | URL CloudFront en campo \`pdf\` — requiere acceso público o presignado |`)
  lines.push(`| Presupuestos | ✅ | Endpoint \`/budgets?vehicle_id=...\` funcional |`)
  lines.push(`| Facturas | ✅ | Endpoint \`/invoices?vehicle_id=...\` funcional |`)
  lines.push(`| Líneas de repuestos | ✅ | Campo \`parts[]\` en detalle de OT |`)
  lines.push(`| Líneas de mano de obra | ✅ | Campo \`labor[]\` en detalle de OT |`)
  lines.push(`| Empleado asignado | ✅ | \`employee_id\` + \`employee_number\` en líneas de labor |`)
  lines.push(``)

  // ── Cobertura de migración ────────────────────────────────────────────────
  lines.push(`## Cobertura de la Migración`)
  lines.push(``)
  const totalFieldsDetected = Object.keys(vd ?? {}).length
  const alwaysNullFields = Object.entries(vd ?? {})
    .filter(([, v]) => v === null || v === '').map(([k]) => k)

  lines.push(`| Métrica | Valor |`)
  lines.push(`|---|---|`)
  lines.push(`| OTs con detalle completo | ${h.repairOrderDetails.length}/${h.repairOrders.length} |`)
  lines.push(`| Facturas con detalle | ${h.invoiceDetails.length}/${h.invoices.length} |`)
  lines.push(`| PDFs disponibles | ${h.pdfs.length} |`)
  lines.push(`| Campos vehículo detectados | ${totalFieldsDetected} |`)
  lines.push(`| Campos vehículo vacíos/null | ${alwaysNullFields.length} (${alwaysNullFields.join(', ')}) |`)
  lines.push(`| Errores durante la extracción | ${h.errors.length} |`)
  lines.push(``)

  if (h.errors.length > 0) {
    lines.push(`## Errores Encontrados`)
    lines.push(``)
    for (const e of h.errors) {
      lines.push(`- ${e}`)
    }
    lines.push(``)
  }

  lines.push(`---`)
  lines.push(`*Informe generado por All Motors Migration Toolkit — ${date}*`)

  // ── Escribir archivo ──────────────────────────────────────────────────────
  const content = lines.join('\n')
  const filename = `${h.plate}-history-report.md`
  const filePath = join(reportsDir, filename)
  writeFileSync(filePath, content, 'utf-8')
  return filePath
}
