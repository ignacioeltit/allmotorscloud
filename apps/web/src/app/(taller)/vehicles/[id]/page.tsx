// Ficha del vehículo: datos + Historia Técnica (notas + eventos) + Órdenes de Trabajo.
// Server Component (lectura con server client + RLS).
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { getVehiculoById } from '@/modules/vehicles/queries'
import { getPropietarioActivoByVehiculo } from '@/modules/customers/queries'
import { getHistoriaByVehiculoId } from '@/modules/technical-history/queries'
import { listEventosByHistoria } from '@/modules/events/queries'
import { listOrdenesTrabajoByVehiculo, getHistorialServiciosVehiculo } from '@/modules/repair-orders/queries'
import { load } from '@/lib/ui/load'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
import { HistorialServiciosVehiculo } from '@/components/vehicles/HistorialServiciosVehiculo'
import { AsignarPropietario } from '@/components/vehicles/AsignarPropietario'
import { EditarVehiculo } from '@/components/vehicles/EditarVehiculo'
import {
  card,
  badge,
  btnSecondary,
  linkClass,
  sectionLabel,
  otEstadoBadge,
  otEstadoLabel,
} from '@/components/ui/styles'

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-CL')
}

function fmtFecha(dateStr: string): string {
  // DATE 'YYYY-MM-DD' → fecha local sin desfase de zona horaria.
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Días desde hoy hasta la fecha (negativo = ya venció). */
function diasHasta(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const objetivo = new Date(y!, m! - 1, d!)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000)
}

/** Clase de color según urgencia (vencida roja, próxima ámbar, ok neutra). */
function claseVencimiento(dias: number): string {
  if (dias < 0) return 'text-red-700 font-semibold'
  if (dias <= 30) return 'text-amber-700 font-semibold'
  return 'text-neutral-200'
}

function etiquetaVencimiento(dias: number): string {
  if (dias < 0) return `vencida hace ${Math.abs(dias)} d`
  if (dias === 0) return 'vence hoy'
  if (dias <= 30) return `en ${dias} d`
  return ''
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-neutral-600">{label}</p>
      <p className="mt-0.5 text-neutral-200">{value}</p>
    </div>
  )
}

export default async function VehiculoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const result = await load(async () => {
    const supabase = await createClient()
    const { rol } = await getAuthContext(supabase)
    const vehiculo = await getVehiculoById(supabase, id)
    const historia = await getHistoriaByVehiculoId(supabase, id)
    const [eventos, ordenes, servicios, propietario] = await Promise.all([
      listEventosByHistoria(supabase, historia.id),
      listOrdenesTrabajoByVehiculo(supabase, id),
      getHistorialServiciosVehiculo(supabase, id),
      getPropietarioActivoByVehiculo(supabase, id),
    ])
    const puedeGestionar = rol === 'admin' || rol === 'jefe_taller' || rol === 'recepcionista'
    return { vehiculo, historia, eventos, ordenes, servicios, propietario, puedeGestionar }
  })

  if (!result.ok) {
    return (
      <div>
        <PageHeader title="Ficha del vehículo" />
        <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
          {result.isAuth
            ? 'Inicia sesión para ver la ficha del vehículo.'
            : 'No se pudo cargar el vehículo.'}
        </Notice>
        <p className="mt-4">
          <Link href="/vehicles" className={linkClass}>
            ← Volver a vehículos
          </Link>
        </p>
      </div>
    )
  }

  const { vehiculo, historia, eventos, ordenes, servicios, propietario, puedeGestionar } = result.data

  return (
    <div className="space-y-8">
      <div>
        <Link href="/vehicles" className={`${linkClass} text-sm`}>
          ← Vehículos
        </Link>
        <PageHeader title={`${vehiculo.patente} — ${vehiculo.marca} ${vehiculo.modelo}`} />
        <div className={`${card} grid grid-cols-2 gap-4 text-sm sm:grid-cols-4`}>
          <Info label="Tipo" value={vehiculo.tipo} />
          <Info
            label="Año"
            value={
              vehiculo.anio != null
                ? vehiculo.anio_por_confirmar
                  ? `${vehiculo.anio} · por confirmar`
                  : vehiculo.anio.toString()
                : '—'
            }
          />
          <Info label="Cilindrada" value={vehiculo.cilindrada ?? '—'} />
          <Info label="Kilometraje" value={vehiculo.km_actual?.toLocaleString('es-CL') ?? '—'} />
          <Info label="Color" value={vehiculo.color ?? '—'} />
          <Info label="VIN" value={vehiculo.vin ?? '—'} />
        </div>
        {(vehiculo.fecha_revision_tecnica || vehiculo.proxima_mantencion_fecha || vehiculo.proxima_mantencion_km != null) && (
          <div className={`${card} mt-3 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3`}>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-neutral-600">Revisión técnica</p>
              {vehiculo.fecha_revision_tecnica ? (
                (() => {
                  const dias = diasHasta(vehiculo.fecha_revision_tecnica)
                  const et = etiquetaVencimiento(dias)
                  return (
                    <p className={`mt-0.5 ${claseVencimiento(dias)}`}>
                      {fmtFecha(vehiculo.fecha_revision_tecnica)}
                      {et && <span className="ml-1 text-xs font-normal">· {et}</span>}
                    </p>
                  )
                })()
              ) : (
                <p className="mt-0.5 text-neutral-500">—</p>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-neutral-600">Próx. mantención (fecha)</p>
              {vehiculo.proxima_mantencion_fecha ? (
                (() => {
                  const dias = diasHasta(vehiculo.proxima_mantencion_fecha)
                  const et = etiquetaVencimiento(dias)
                  return (
                    <p className={`mt-0.5 ${claseVencimiento(dias)}`}>
                      {fmtFecha(vehiculo.proxima_mantencion_fecha)}
                      {et && <span className="ml-1 text-xs font-normal">· {et}</span>}
                    </p>
                  )
                })()
              ) : (
                <p className="mt-0.5 text-neutral-500">—</p>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-neutral-600">Próx. mantención (km)</p>
              {vehiculo.proxima_mantencion_km != null ? (
                (() => {
                  const faltan = vehiculo.km_actual != null ? vehiculo.proxima_mantencion_km! - vehiculo.km_actual : null
                  const urgente = faltan != null && faltan <= 1000
                  return (
                    <p className={`mt-0.5 ${urgente ? (faltan! < 0 ? 'text-red-700 font-semibold' : 'text-amber-700 font-semibold') : 'text-neutral-200'}`}>
                      {vehiculo.proxima_mantencion_km.toLocaleString('es-CL')} km
                      {faltan != null && (
                        <span className="ml-1 text-xs font-normal">
                          · {faltan < 0 ? `pasada por ${Math.abs(faltan).toLocaleString('es-CL')} km` : `faltan ${faltan.toLocaleString('es-CL')} km`}
                        </span>
                      )}
                    </p>
                  )
                })()
              ) : (
                <p className="mt-0.5 text-neutral-500">—</p>
              )}
            </div>
          </div>
        )}
        <div className="mt-3">
          <EditarVehiculo vehiculo={vehiculo} puedeGestionar={puedeGestionar} />
        </div>
      </div>

      {/* Propietario: asignar / cambiar */}
      <AsignarPropietario
        vehiculoId={id}
        propietarioActual={propietario ? { id: propietario.id, nombre: propietario.nombre } : null}
        puedeGestionar={puedeGestionar}
      />

      {/* Historial de servicios — lo primero: "¿cuándo se le cambió X?" */}
      <section id="historial-servicios">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">Historial de servicios</h2>
          <span className="text-xs text-neutral-500">Todo lo hecho al vehículo, en todas sus OTs</span>
        </div>
        <HistorialServiciosVehiculo rows={servicios} />
      </section>

      {/* Historia Técnica */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">Historia Técnica</h2>
          <Link href={`/vehicles/${id}/events/new`} className={btnSecondary}>
            Registrar evento
          </Link>
        </div>

        {historia.notas ? (
          <div className={`${card} mb-3`}>
            <p className={sectionLabel}>Notas generales</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-300">{historia.notas}</p>
          </div>
        ) : null}

        {eventos.length === 0 ? (
          <Notice tone="empty">Sin eventos registrados en la historia técnica.</Notice>
        ) : (
          <ul className="space-y-2">
            {eventos.map((ev) => (
              <li key={ev.id} className={card}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-neutral-100">{ev.titulo ?? '(sin título)'}</p>
                  <span className={badge}>{ev.estado}</span>
                </div>
                {ev.descripcion ? (
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-400">{ev.descripcion}</p>
                ) : null}
                <p className="mt-2 text-xs text-neutral-600">{fmt(ev.creado_en)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Órdenes de Trabajo */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">Órdenes de Trabajo</h2>
          <Link href={`/vehicles/${id}/repair-orders/new`} className={btnSecondary}>
            Abrir OT
          </Link>
        </div>

        {ordenes.length === 0 ? (
          <Notice tone="empty">Este vehículo no tiene órdenes de trabajo.</Notice>
        ) : (
          <ul className="space-y-2">
            {ordenes.map((ot) => (
              <li key={ot.id}>
                <Link href={`/repair-orders/${ot.id}`} className={`${card} block transition-colors hover:border-black/[0.14]`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-neutral-100">{ot.numero_ot}</p>
                    <span className={otEstadoBadge(ot.estado)}>{otEstadoLabel(ot.estado)}</span>
                  </div>
                  <p className="mt-2 text-xs text-neutral-600">
                    Abierta {fmt(ot.creado_en)}
                    {ot.cerrado_en ? ` · Cerrada ${fmt(ot.cerrado_en)}` : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
