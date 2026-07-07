'use client'

// Documento imprimible para el CLIENTE: detalle de los trabajos realizados hasta
// la fecha con sus valores y el total acumulado (con IVA). A diferencia de
// OtDocumento (copia del mecánico, sin precios), este muestra el gasto.
// No es un documento tributario (no reemplaza boleta/factura).
//
// Paleta neutral invertida (tema claro) → colores hex explícitos: papel blanco.

import type { OrdenTrabajo } from '@/modules/repair-orders/types'
import type { Vehiculo } from '@/modules/vehicles/types'
import type { Cliente } from '@/modules/customers/types'
import type { ReparacionConItems, ItemReparacion } from '@/modules/reparaciones/types'
import type { OrganizacionInfo } from '@/modules/org/queries'
import type { TotalesOT } from '@/modules/entregas/queries'

const TIPO_LABEL: Record<string, string> = { repuesto: 'Repuestos / materiales', mano_obra: 'Mano de obra', otros: 'Otros' }
const ORDEN_TIPO = ['repuesto', 'mano_obra', 'otros'] as const

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function CuentaDocumento({
  orden,
  vehiculo,
  cliente,
  reparaciones,
  taller,
  totales,
}: {
  orden: OrdenTrabajo
  vehiculo: Vehiculo | null
  cliente: Cliente | null
  reparaciones: ReparacionConItems[]
  taller: OrganizacionInfo | null
  totales: TotalesOT
}) {
  const items: ItemReparacion[] = reparaciones.flatMap((r) => r.items)
  const porTipo = ORDEN_TIPO.map((tipo) => ({ tipo, lineas: items.filter((i) => i.tipo === tipo) })).filter(
    (g) => g.lineas.length > 0,
  )

  return (
    <div className="doc-print mx-auto max-w-2xl text-[#111827]">
      <div className="no-print mb-5 flex justify-end">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] pb-5">
          <div className="flex items-start gap-3">
            {taller?.logo_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={taller.logo_url} alt="" className="h-12 w-auto max-w-[120px] object-contain" />
            )}
            <div>
              <h1 className="text-lg font-semibold">{taller?.nombre ?? 'Taller'}</h1>
              <div className="mt-1 space-y-0.5 text-xs text-[#6b7280]">
                {taller?.rut && <p>RUT {taller.rut}</p>}
                {(taller?.telefono || taller?.direccion) && (
                  <p>{[taller?.telefono, taller?.direccion, taller?.ciudad].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#ea580c]">Detalle de trabajos</p>
            <p className="mt-0.5 text-xl font-bold tracking-wide">{orden.numero_ot}</p>
            <p className="mt-1 text-xs text-[#6b7280]">{fmtFecha(new Date().toISOString())}</p>
          </div>
        </div>

        {/* Cliente + vehículo */}
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Cliente</p>
            <p className="mt-1 font-medium">{cliente?.nombre ?? '—'}</p>
            <p className="text-xs text-[#6b7280]">{[cliente?.rut, cliente?.telefono].filter(Boolean).join(' · ')}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Vehículo</p>
            <p className="mt-1 font-medium tracking-wide">
              {[vehiculo?.patente, vehiculo?.marca, vehiculo?.modelo].filter(Boolean).join(' · ') || '—'}
            </p>
            <p className="text-xs text-[#6b7280]">
              {[
                vehiculo?.anio ? `Año ${vehiculo.anio}` : null,
                vehiculo?.cilindrada ? `Cilindrada ${vehiculo.cilindrada}` : null,
                vehiculo?.color,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        {/* Detalle de trabajos con valores, agrupado por tipo */}
        {porTipo.length > 0 ? (
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
              {porTipo.flatMap((g) => [
                <tr key={`h-${g.tipo}`}>
                  <td colSpan={4} className="pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                    {TIPO_LABEL[g.tipo]}
                  </td>
                </tr>,
                ...g.lineas.map((it) => (
                  <tr key={it.id} className="border-b border-[#f3f4f6] align-top">
                    <td className="py-1.5">
                      {it.codigo && <span className="mr-1.5 font-mono text-[11px] text-[#6b7280]">{it.codigo}</span>}
                      {it.descripcion}
                    </td>
                    <td className="py-1.5 text-right text-[#4b5563]">{it.cantidad}</td>
                    <td className="py-1.5 text-right text-[#4b5563]">{fmtCLP(it.costo_unitario)}</td>
                    <td className="py-1.5 text-right font-medium">{fmtCLP(it.costo_total)}</td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        ) : (
          <p className="mt-6 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-6 text-center text-sm text-[#6b7280]">
            Aún no hay trabajos con valores cargados.
          </p>
        )}

        {/* Totales acumulados */}
        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-[#4b5563]">
              <span>Neto</span>
              <span>{fmtCLP(totales.subtotal_neto_afecto)}</span>
            </div>
            <div className="flex justify-between text-[#4b5563]">
              <span>IVA 19%</span>
              <span>{fmtCLP(totales.iva)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-[#111827] pt-2 text-base font-bold">
              <span>Total con IVA</span>
              <span>{fmtCLP(totales.total_con_iva)}</span>
            </div>
          </div>
        </div>

        <p className="mt-6 text-[11px] text-[#9ca3af]">
          Valores acumulados de los trabajos realizados a la fecha. Documento informativo, no válido como boleta ni factura.
        </p>
      </div>
    </div>
  )
}
