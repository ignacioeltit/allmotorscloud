'use client'

// Documento imprimible de una cotización: encabezado del taller, cliente,
// vehículo, ítems agrupados y totales. Un botón (no-print) dispara la impresión
// del navegador, con la que también se puede "Guardar como PDF".

import { TIPO_ITEM_LABEL } from '@/modules/estimates/constants'
import type { CotizacionDetalle } from '@/modules/estimates/queries'
import type { OrganizacionInfo } from '@/modules/org/queries'
import { ordenarItemsPorTipo } from '@/lib/ui/ordenar-items'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

const IVA = 0.19

export function CotizacionDocumento({
  cotizacion,
  taller,
}: {
  cotizacion: CotizacionDetalle
  taller: OrganizacionInfo | null
}) {
  const p = cotizacion
  const fecha = new Date(p.creado_en).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
  const iva = Math.round(p.total_neto * IVA)
  const totalConIva = p.total_neto + iva

  return (
    <div className="doc-print mx-auto max-w-3xl bg-white text-[#111827]">
      {/* Botón de acción — no aparece en la impresión */}
      <div className="no-print mb-5 flex justify-end">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-500"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="rounded-xl border border-[#e5e7eb] bg-white p-8 print:border-0 print:p-0">
        {/* Encabezado taller */}
        <div className="flex items-start justify-between gap-6 border-b border-[#e5e7eb] pb-5">
          <div className="flex items-start gap-4">
            {taller?.logo_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={taller.logo_url} alt="" className="h-14 w-auto max-w-[140px] object-contain" />
            )}
            <div>
            <h1 className="text-xl font-semibold text-[#111827]">{taller?.nombre ?? 'Taller'}</h1>
            <div className="mt-1 space-y-0.5 text-xs text-[#6b7280]">
              {taller?.rut && <p>RUT {taller.rut}</p>}
              {taller?.direccion && <p>{[taller.direccion, taller.ciudad].filter(Boolean).join(', ')}</p>}
              {(taller?.telefono || taller?.email) && (
                <p>{[taller.telefono, taller.email].filter(Boolean).join(' · ')}</p>
              )}
            </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-600">Cotización</p>
            <p className="mt-1 text-xs text-[#6b7280]">{fecha}</p>
          </div>
        </div>

        {/* Cliente + vehículo */}
        <div className="mt-5 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Cliente</p>
            <p className="mt-1 font-medium text-[#111827]">{p.cliente?.nombre ?? '—'}</p>
            <p className="text-[#6b7280]">
              {[p.cliente?.rut, p.cliente?.telefono].filter(Boolean).join(' · ') || ''}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Vehículo</p>
            <p className="mt-1 font-medium text-[#111827]">{p.vehiculo?.patente ?? '—'}</p>
            <p className="text-[#6b7280]">
              {[p.vehiculo?.marca, p.vehiculo?.modelo, p.vehiculo?.anio].filter(Boolean).join(' · ') || ''}
            </p>
          </div>
        </div>

        {/* Ítems */}
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-[#e5e7eb] text-left text-[11px] uppercase tracking-wide text-[#9ca3af]">
              <th className="py-2 font-medium">Detalle</th>
              <th className="w-16 py-2 text-right font-medium">Cant.</th>
              <th className="w-28 py-2 text-right font-medium">P. unit.</th>
              <th className="w-28 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {ordenarItemsPorTipo(p.items).map((item) => (
              <tr key={item.id} className="border-b border-[#f3f4f6]">
                <td className="py-2">
                  {item.codigo && <span className="mr-1.5 font-mono text-[11px] text-[#6b7280]">{item.codigo}</span>}
                  <span className="text-[#1f2937]">{item.descripcion}</span>
                  <span className="ml-2 text-[10px] uppercase text-[#9ca3af]">{TIPO_ITEM_LABEL[item.tipo]}</span>
                </td>
                <td className="py-2 text-right text-[#4b5563]">{item.cantidad}</td>
                <td className="py-2 text-right text-[#4b5563]">{fmtCLP(item.precio_unitario)}</td>
                <td className="py-2 text-right font-medium text-[#1f2937]">{fmtCLP(item.precio_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            {p.total_mano_obra > 0 && (
              <Row label="Mano de obra" value={fmtCLP(p.total_mano_obra)} />
            )}
            {p.total_repuestos > 0 && <Row label="Repuestos" value={fmtCLP(p.total_repuestos)} />}
            {p.total_otros > 0 && <Row label="Otros" value={fmtCLP(p.total_otros)} />}
            <Row label="Neto" value={fmtCLP(p.total_neto)} />
            <Row label="IVA (19%)" value={fmtCLP(iva)} />
            <div className="flex justify-between border-t border-[#d1d5db] pt-1.5 text-base font-semibold text-[#111827]">
              <span>Total</span>
              <span>{fmtCLP(totalConIva)}</span>
            </div>
          </div>
        </div>

        {p.notas && (
          <div className="mt-6 border-t border-[#e5e7eb] pt-4 text-xs text-[#6b7280]">
            <p className="font-medium text-[#4b5563]">Notas</p>
            <p className="mt-1">{p.notas}</p>
          </div>
        )}

        <p className="mt-6 text-[11px] text-[#9ca3af]">
          Valores en pesos chilenos. Cotización referencial sujeta a revisión del vehículo.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[#4b5563]">
      <span>{label}</span>
      <span className="text-[#1f2937]">{value}</span>
    </div>
  )
}
