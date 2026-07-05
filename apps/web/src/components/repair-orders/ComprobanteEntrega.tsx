'use client'

// Comprobante de entrega (para el cliente): detalle de trabajos CON precios,
// neto/IVA/total, forma de pago y "recibí conforme". NO es documento tributario
// (la boleta/factura SII es un paso aparte). Colores hex explícitos por el tema
// invertido (documento blanco).

import type { OrdenTrabajo } from '@/modules/repair-orders/types'
import type { Vehiculo } from '@/modules/vehicles/types'
import type { Cliente } from '@/modules/customers/types'
import type { ReparacionConItems } from '@/modules/reparaciones/types'
import type { OrganizacionInfo } from '@/modules/org/queries'
import type { Entrega, TotalesOT } from '@/modules/entregas/queries'
import { FORMA_PAGO_LABEL } from '@/modules/entregas/constants'
import { ordenarItemsPorTipo } from '@/lib/ui/ordenar-items'

const TIPO_LABEL: Record<string, string> = { mano_obra: 'Mano de obra', repuesto: 'Repuesto', otros: 'Otros' }

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}
function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function ComprobanteEntrega({
  orden,
  vehiculo,
  cliente,
  reparaciones,
  taller,
  entrega,
  totales,
}: {
  orden: OrdenTrabajo
  vehiculo: Vehiculo | null
  cliente: Cliente | null
  reparaciones: ReparacionConItems[]
  taller: OrganizacionInfo | null
  entrega: Entrega | null
  totales: TotalesOT
}) {
  const items = reparaciones.flatMap((r) => r.items)

  return (
    <div className="mx-auto max-w-2xl text-[#111827]">
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
            <p className="text-sm font-semibold uppercase tracking-wide text-[#ea580c]">Comprobante de entrega</p>
            <p className="mt-0.5 text-lg font-bold tracking-wide">{orden.numero_ot}</p>
            <p className="mt-1 text-xs text-[#6b7280]">{fmtFecha(entrega?.creado_en ?? orden.creado_en)}</p>
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
                orden.km_ingreso != null ? `Ingreso ${orden.km_ingreso.toLocaleString('es-CL')} km` : null,
                entrega?.km_salida != null ? `Salida ${entrega.km_salida.toLocaleString('es-CL')} km` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        {/* Detalle */}
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-[#e5e7eb] text-left text-[11px] uppercase tracking-wide text-[#9ca3af]">
              <th className="py-2 font-medium">Detalle del trabajo</th>
              <th className="w-14 py-2 text-right font-medium">Cant.</th>
              <th className="w-28 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {ordenarItemsPorTipo(items).map((it) => (
              <tr key={it.id} className="border-b border-[#f3f4f6]">
                <td className="py-2">
                  <span>{it.descripcion}</span>
                  <span className="ml-2 text-[10px] uppercase text-[#9ca3af]">{TIPO_LABEL[it.tipo] ?? it.tipo}</span>
                </td>
                <td className="py-2 text-right text-[#4b5563]">{it.cantidad}</td>
                <td className="py-2 text-right font-medium">{fmtCLP(it.costo_total)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="py-3 text-center text-[#9ca3af]">Sin ítems registrados.</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totales */}
        <div className="mt-4 flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between text-[#4b5563]"><span>Neto</span><span>{fmtCLP(totales.subtotal_neto_afecto)}</span></div>
            <div className="flex justify-between text-[#4b5563]"><span>IVA (19%)</span><span>{fmtCLP(totales.iva)}</span></div>
            <div className="flex justify-between border-t border-[#d1d5db] pt-1.5 text-base font-semibold">
              <span>Total</span><span>{fmtCLP(totales.total_con_iva)}</span>
            </div>
          </div>
        </div>

        {/* Documento + pago */}
        {entrega && (
          <div className="mt-5 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-sm">
            {entrega.tipo_documento !== 'ninguno' && (
              <p>
                <span className="font-medium">
                  {entrega.tipo_documento === 'factura' ? 'Factura' : 'Boleta'} N°:
                </span>{' '}
                {entrega.numero_factura ?? '—'}
              </p>
            )}
            <p>
              <span className="font-medium">Pago:</span>{' '}
              {entrega.condicion_pago === 'credito' && entrega.estado_pago === 'pendiente'
                ? `Crédito${entrega.vence_en ? ` · vence ${new Date(entrega.vence_en + 'T00:00').toLocaleDateString('es-CL')}` : ''} · PENDIENTE`
                : `${entrega.forma_pago ? FORMA_PAGO_LABEL[entrega.forma_pago] : 'Contado'}${entrega.monto_pagado != null ? ` · ${fmtCLP(entrega.monto_pagado)}` : ''}`}
              {entrega.notas ? ` · ${entrega.notas}` : ''}
            </p>
          </div>
        )}

        {/* Firma */}
        <div className="mt-12 grid grid-cols-2 gap-10 text-center text-xs text-[#6b7280]">
          <div><div className="border-t border-[#9ca3af] pt-1.5">Entregó (taller)</div></div>
          <div><div className="border-t border-[#9ca3af] pt-1.5">Recibí conforme (cliente)</div></div>
        </div>

        <p className="mt-6 text-center text-[11px] text-[#9ca3af]">
          Comprobante de entrega — no constituye documento tributario. Valores en pesos chilenos.
        </p>
      </div>
    </div>
  )
}
