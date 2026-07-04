'use client'

// Orden de compra imprimible para el encargado de compras: datos del vehículo +
// repuestos a conseguir (por comprar / comprado en camino), con su nota (dónde /
// cómo). Sin precios de venta. Colores hex explícitos (documento blanco).

import type { OrdenTrabajo } from '@/modules/repair-orders/types'
import type { Vehiculo } from '@/modules/vehicles/types'
import type { ReparacionConItems } from '@/modules/reparaciones/types'
import type { OrganizacionInfo } from '@/modules/org/queries'
import { ESTADO_COMPRA_LABEL, ESTADOS_COMPRA_PENDIENTES } from '@/modules/reparaciones/constants'

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function OrdenCompraDocumento({
  orden,
  vehiculo,
  reparaciones,
  taller,
}: {
  orden: OrdenTrabajo
  vehiculo: Vehiculo | null
  reparaciones: ReparacionConItems[]
  taller: OrganizacionInfo | null
}) {
  const items = reparaciones
    .flatMap((r) => r.items)
    .filter((i) => i.tipo === 'repuesto' && ESTADOS_COMPRA_PENDIENTES.includes(i.estado_compra))

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
        <div className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] pb-5">
          <div>
            <h1 className="text-lg font-semibold">{taller?.nombre ?? 'Taller'}</h1>
            {taller?.telefono && <p className="mt-1 text-xs text-[#6b7280]">{taller.telefono}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#ea580c]">Orden de compra</p>
            <p className="mt-0.5 text-lg font-bold tracking-wide">{orden.numero_ot}</p>
            <p className="mt-1 text-xs text-[#6b7280]">{fmtFecha(new Date().toISOString())}</p>
          </div>
        </div>

        {/* Vehículo */}
        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Vehículo</p>
          <p className="mt-1 font-medium tracking-wide">
            {[vehiculo?.patente, vehiculo?.marca, vehiculo?.modelo].filter(Boolean).join(' · ') || '—'}
          </p>
          <p className="text-xs text-[#6b7280]">
            {[
              vehiculo?.anio ? `Año ${vehiculo.anio}` : null,
              vehiculo?.vin ? `VIN ${vehiculo.vin}` : null,
              vehiculo?.color,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {vehiculo?.notas && <p className="mt-0.5 text-xs text-[#6b7280]">{vehiculo.notas}</p>}
        </div>

        {/* Repuestos a comprar — el comprador anota costo y lugar por ítem */}
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-[#e5e7eb] text-left text-[11px] uppercase tracking-wide text-[#9ca3af]">
              <th className="w-8 py-2 font-medium"></th>
              <th className="py-2 font-medium">Repuesto</th>
              <th className="w-12 py-2 text-right font-medium">Cant.</th>
              <th className="w-28 py-2 font-medium">Costo $</th>
              <th className="w-40 py-2 font-medium">Comprado en</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-[#e5e7eb] align-bottom">
                <td className="py-3 align-top">☐</td>
                <td className="py-3">
                  {it.descripcion}
                  <span className="ml-2 text-[10px] uppercase text-[#9ca3af]">{ESTADO_COMPRA_LABEL[it.estado_compra]}</span>
                  {it.nota_compra && (
                    <span className="block text-[11px] text-[#6b7280]">{it.nota_compra}</span>
                  )}
                </td>
                <td className="py-3 text-right text-[#4b5563]">{it.cantidad}</td>
                {/* Celdas en blanco para escribir a mano */}
                <td className="py-3"><span className="block h-5 border-b border-[#d1d5db]" /></td>
                <td className="py-3"><span className="block h-5 border-b border-[#d1d5db]" /></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="py-3 text-center text-[#9ca3af]">No hay repuestos por comprar.</td></tr>
            )}
          </tbody>
        </table>

        {/* Total y notas libres para el comprador */}
        <div className="mt-6 flex justify-end">
          <div className="w-64">
            <div className="flex items-end justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Total compra $</span>
              <span className="h-6 flex-1 border-b border-[#9ca3af]" />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
            Observaciones del comprador
          </p>
          <div className="mt-2 space-y-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="border-b border-[#d1d5db]" />
            ))}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-10 text-center text-xs text-[#6b7280]">
          <div><div className="border-t border-[#9ca3af] pt-1.5">Solicita (taller)</div></div>
          <div><div className="border-t border-[#9ca3af] pt-1.5">Compra (encargado)</div></div>
        </div>
      </div>
    </div>
  )
}
