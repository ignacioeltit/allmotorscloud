'use client'

// Documento imprimible de una Orden de Trabajo, pensado para entregar al
// MECÁNICO: qué vehículo es, de quién, qué hay que hacer (trabajos cargados y/o
// presupuesto autorizado) y espacio para anotar. SIN precios.
//
// OJO tema: la paleta neutral está invertida (tema claro), por eso el documento
// usa colores hex explícitos — es un papel blanco con texto negro.

import type { OrdenTrabajo } from '@/modules/repair-orders/types'
import type { Vehiculo } from '@/modules/vehicles/types'
import type { Cliente } from '@/modules/customers/types'
import type { Evento } from '@/modules/events/types'
import type { ReparacionConItems } from '@/modules/reparaciones/types'
import type { PresupuestoConItems } from '@/modules/estimates/types'
import type { OrganizacionInfo } from '@/modules/org/queries'
import type { MecanicoSimple } from '@/modules/users/types'
import { ordenarItemsPorTipo } from '@/lib/ui/ordenar-items'

const TIPO_LABEL: Record<string, string> = { mano_obra: 'Mano de obra', repuesto: 'Repuesto', otros: 'Otros' }

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * La descripción del evento de recepción es texto plano construido en
 * reception/mutations.ts: líneas "Etiqueta: valor" seguidas de un bloque
 * "Checklist de recepción:" con líneas "✓/✗ ítem". Se separa para imprimir
 * el reclamo del cliente como texto y el checklist como lista compacta.
 */
function parseDescripcionRecepcion(desc: string): { campos: [string, string][]; checklist: string[] } {
  const lineas = desc.split('\n')
  const idx = lineas.findIndex((l) => l.trim() === 'Checklist de recepción:')
  const encabezado = (idx === -1 ? lineas : lineas.slice(0, idx)).filter((l) => l.trim())
  const checklist = idx === -1 ? [] : lineas.slice(idx + 1).filter((l) => l.trim())
  const campos: [string, string][] = encabezado.map((l) => {
    const i = l.indexOf(':')
    return i === -1 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
  return { campos, checklist }
}

export function OtDocumento({
  orden,
  vehiculo,
  cliente,
  eventoRecepcion,
  reparaciones,
  presupuesto,
  taller,
  mecanicos,
}: {
  orden: OrdenTrabajo
  vehiculo: Vehiculo | null
  cliente: Cliente | null
  eventoRecepcion: Evento | null
  reparaciones: ReparacionConItems[]
  presupuesto: PresupuestoConItems | null
  taller: OrganizacionInfo | null
  mecanicos: MecanicoSimple[]
}) {
  const nombreMecanico = (id: string | null) =>
    id ? mecanicos.find((m) => m.id === id)?.nombre ?? null : null

  const conTrabajos = reparaciones.some((r) => r.items.length > 0 || r.descripcion)

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
          <div>
            <h1 className="text-lg font-semibold">{taller?.nombre ?? 'Taller'}</h1>
            <div className="mt-1 space-y-0.5 text-xs text-[#6b7280]">
              {taller?.rut && <p>RUT {taller.rut}</p>}
              {(taller?.telefono || taller?.direccion) && (
                <p>{[taller?.telefono, taller?.direccion, taller?.ciudad].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#ea580c]">Orden de trabajo</p>
            <p className="mt-0.5 text-xl font-bold tracking-wide">{orden.numero_ot}</p>
            <p className="mt-1 text-xs text-[#6b7280]">{fmtFecha(orden.creado_en)}</p>
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
                vehiculo?.color,
                orden.km_ingreso != null ? `${orden.km_ingreso.toLocaleString('es-CL')} km` : null,
                vehiculo?.vin ? `VIN ${vehiculo.vin}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        {/* Lo que dice el cliente al ingresar (motivo, síntomas, checklist de recepción) */}
        {eventoRecepcion?.descripcion ? (
          (() => {
            const { campos, checklist } = parseDescripcionRecepcion(eventoRecepcion.descripcion!)
            return (
              <div className="mt-5 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                  Lo que indica el cliente
                </p>
                <div className="mt-2 space-y-1.5 text-sm">
                  {campos.map(([label, valor], i) => (
                    <p key={i}>
                      <span className="font-medium">{label}:</span> {valor}
                    </p>
                  ))}
                </div>
                {checklist.length > 0 && (
                  <div className="mt-3 border-t border-[#e5e7eb] pt-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                      Checklist de recepción
                    </p>
                    <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-3">
                      {checklist.map((linea, i) => (
                        <p key={i}>{linea}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()
        ) : orden.notas ? (
          <div className="mt-5 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Motivo de ingreso</p>
            <p className="mt-1 text-sm">{orden.notas}</p>
          </div>
        ) : null}

        {/* Trabajos cargados */}
        {conTrabajos && (
          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Trabajos</p>
            {reparaciones.map((r) => (
              <div key={r.id} className="mt-2">
                {(r.descripcion || nombreMecanico(r.mecanico_id)) && (
                  <p className="text-sm font-medium">
                    {r.descripcion ?? 'Trabajo'}
                    {nombreMecanico(r.mecanico_id) && (
                      <span className="ml-2 text-xs font-normal text-[#6b7280]">
                        Mecánico: {nombreMecanico(r.mecanico_id)}
                      </span>
                    )}
                  </p>
                )}
                {r.items.length > 0 && (
                  <table className="mt-1 w-full text-sm">
                    <tbody>
                      {ordenarItemsPorTipo(r.items).map((it) => (
                        <tr key={it.id} className="border-b border-[#f3f4f6]">
                          <td className="w-6 py-1.5 align-top">☐</td>
                          <td className="py-1.5">
                            {it.descripcion}
                            <span className="ml-2 text-[10px] uppercase text-[#9ca3af]">{TIPO_LABEL[it.tipo] ?? it.tipo}</span>
                          </td>
                          <td className="w-16 py-1.5 text-right text-[#4b5563]">× {it.cantidad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Trabajo autorizado por presupuesto (útil cuando la OT viene de una cotización) */}
        {!conTrabajos && presupuesto && presupuesto.items.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
              Trabajo autorizado (presupuesto {presupuesto.estado === 'autorizado' ? 'aprobado por el cliente' : presupuesto.estado})
            </p>
            <table className="mt-1 w-full text-sm">
              <tbody>
                {ordenarItemsPorTipo(presupuesto.items).map((it) => (
                  <tr key={it.id} className="border-b border-[#f3f4f6]">
                    <td className="w-6 py-1.5 align-top">☐</td>
                    <td className="py-1.5">
                      {it.descripcion}
                      <span className="ml-2 text-[10px] uppercase text-[#9ca3af]">{TIPO_LABEL[it.tipo] ?? it.tipo}</span>
                    </td>
                    <td className="w-16 py-1.5 text-right text-[#4b5563]">× {it.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notas del mecánico */}
        <div className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Notas del mecánico</p>
          <div className="mt-2 space-y-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border-b border-[#d1d5db]" />
            ))}
          </div>
        </div>

        {/* Firmas */}
        <div className="mt-10 grid grid-cols-2 gap-10 text-center text-xs text-[#6b7280]">
          <div>
            <div className="border-t border-[#9ca3af] pt-1.5">Mecánico</div>
          </div>
          <div>
            <div className="border-t border-[#9ca3af] pt-1.5">Jefe de taller</div>
          </div>
        </div>
      </div>
    </div>
  )
}
