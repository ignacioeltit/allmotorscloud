// Detalle de Orden de Trabajo — vista operativa completa.
// 9 secciones: cabecera, acciones, cliente/vehículo, motivo, diagnóstico,
// trabajos, presupuesto, totales, historial.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrdenTrabajoById } from '@/modules/repair-orders/queries'
import { getVehiculoById } from '@/modules/vehicles/queries'
import { getPropietarioActivoByVehiculo } from '@/modules/customers/queries'
import { listEventosByOrdenTrabajo, getTipoEventoBySlug } from '@/modules/events/queries'
import { getHistoriaByVehiculoId } from '@/modules/technical-history/queries'
import { listReparacionesByOT } from '@/modules/reparaciones/queries'
import { getPresupuestoActivoByOT } from '@/modules/estimates/queries'
import { listMecanicosByOrg } from '@/modules/users/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { OrdenTrabajoActions } from '@/components/repair-orders/OrdenTrabajoActions'
import { TrabajosSection } from '@/components/repair-orders/TrabajosSection'
import { card, sectionLabel, linkClass } from '@/components/ui/styles'
import { ESTADO_PRESUPUESTO_LABEL } from '@/modules/estimates/constants'

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  })
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-neutral-600">{label}</p>
      <p className="mt-0.5 text-sm text-neutral-200">{value || '—'}</p>
    </div>
  )
}

export default async function OrdenTrabajoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const result = await load(async () => {
    const supabase = await createClient()

    const orden = await getOrdenTrabajoById(supabase, id)
    const [vehiculo, cliente, eventos, historia, tipoEvento, reparaciones, presupuesto, mecanicos] =
      await Promise.all([
        getVehiculoById(supabase, orden.vehiculo_id),
        getPropietarioActivoByVehiculo(supabase, orden.vehiculo_id),
        listEventosByOrdenTrabajo(supabase, orden.id),
        getHistoriaByVehiculoId(supabase, orden.vehiculo_id),
        getTipoEventoBySlug(supabase, 'reparacion'),
        listReparacionesByOT(supabase, orden.id),
        getPresupuestoActivoByOT(supabase, orden.id),
        listMecanicosByOrg(supabase),
      ])

    return { orden, vehiculo, cliente, eventos, historia, tipoEvento, reparaciones, presupuesto, mecanicos }
  })

  if (!result.ok) {
    return (
      <div>
        <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
          {result.isAuth
            ? 'Inicia sesión para ver la OT.'
            : 'No se pudo cargar la orden de trabajo.'}
        </Notice>
        <p className="mt-4">
          <Link href="/dashboard" className={linkClass}>
            ← Volver al dashboard
          </Link>
        </p>
      </div>
    )
  }

  const { orden, vehiculo, cliente, eventos, historia, tipoEvento, reparaciones, presupuesto, mecanicos } =
    result.data

  const recepcionEvento =
    eventos.find((e) => e.titulo?.toLowerCase().includes('recepci')) ??
    eventos[eventos.length - 1]

  // Totales desde reparaciones cargadas (evita un query extra)
  let totalMO = 0
  let totalRep = 0
  for (const rep of reparaciones) {
    for (const item of rep.items) {
      if (item.tipo === 'mano_obra') totalMO += item.costo_total
      else totalRep += item.costo_total
    }
  }
  const totalOT = totalMO + totalRep

  return (
    <div className="space-y-6">

      {/* ── Cabecera ── */}
      <div>
        <Link href="/dashboard" className={`${linkClass} text-sm`}>
          ← Dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">
                {orden.numero_ot}
              </h1>
              <StatusBadge estado={orden.estado} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-neutral-600">
              <span>Abierta {fmt(orden.creado_en)}</span>
              {orden.km_ingreso != null && (
                <span>Km ingreso: {orden.km_ingreso.toLocaleString('es-CL')}</span>
              )}
              {orden.fecha_prometida_entrega && (
                <span>Entrega prometida: {orden.fecha_prometida_entrega}</span>
              )}
              {orden.cerrado_en && <span>Cerrada: {fmt(orden.cerrado_en)}</span>}
            </div>
          </div>
          <Link
            href={`/vehicles/${orden.vehiculo_id}`}
            className={`${linkClass} shrink-0 text-sm`}
          >
            Ver ficha vehículo →
          </Link>
        </div>
      </div>

      {/* ── Acciones ── */}
      <div className="rounded-xl border border-white/[0.06] bg-neutral-900/50 p-4">
        <p className={`${sectionLabel} mb-2.5`}>Acciones</p>
        <OrdenTrabajoActions id={orden.id} estado={orden.estado} vehiculoId={orden.vehiculo_id} />
      </div>

      {/* ── Cliente + Vehículo ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={card}>
          <p className={sectionLabel}>Cliente</p>
          {cliente ? (
            <div className="mt-3 space-y-3">
              <p className="text-base font-semibold text-neutral-50">{cliente.nombre}</p>
              <div className="grid grid-cols-2 gap-3">
                <Info label="RUT" value={cliente.rut} />
                <Info label="Teléfono" value={cliente.telefono} />
                <Info label="Email" value={cliente.email} />
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">Sin propietario asignado.</p>
          )}
        </section>

        <section className={card}>
          <p className={sectionLabel}>Vehículo</p>
          <div className="mt-3 space-y-3">
            <p className="text-base font-semibold tracking-wide text-neutral-50">
              {vehiculo.patente}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Info label="Marca" value={vehiculo.marca} />
              <Info label="Modelo" value={vehiculo.modelo} />
              <Info label="Año" value={vehiculo.anio?.toString()} />
              <Info label="Color" value={vehiculo.color} />
              <Info label="VIN" value={vehiculo.vin} />
            </div>
          </div>
        </section>
      </div>

      {/* ── Motivo cliente ── */}
      {(orden.notas || recepcionEvento?.descripcion) && (
        <section className={card}>
          <p className={sectionLabel}>Motivo de ingreso</p>
          {orden.notas && (
            <p className="mt-3 text-sm leading-relaxed text-neutral-200">{orden.notas}</p>
          )}
          {recepcionEvento?.descripcion && (
            <div className={orden.notas ? 'mt-4 border-t border-white/[0.06] pt-3' : 'mt-3'}>
              <p className={`${sectionLabel} mb-2`}>Detalle de recepción</p>
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-neutral-400">
                {recepcionEvento.descripcion}
              </pre>
            </div>
          )}
        </section>
      )}

      {/* ── Trabajos (Client Component con formularios) ── */}
      <TrabajosSection
        ordenTrabajoId={orden.id}
        historiaId={historia.id}
        tipoEventoReparacionId={tipoEvento?.id ?? null}
        initialReparaciones={reparaciones}
        mecanicos={mecanicos}
      />

      {/* ── Presupuesto activo (read-only) ── */}
      {presupuesto && (
        <section className={card}>
          <div className="flex items-center justify-between gap-3">
            <p className={sectionLabel}>Presupuesto v{presupuesto.version}</p>
            <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-300">
              {ESTADO_PRESUPUESTO_LABEL[presupuesto.estado]}
            </span>
          </div>
          {presupuesto.items.length > 0 ? (
            <div className="mt-4 space-y-1.5">
              {presupuesto.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm"
                >
                  <span className="text-neutral-300">{item.descripcion}</span>
                  <span className="shrink-0 font-medium text-neutral-200">
                    {fmtCLP(item.precio_total)}
                  </span>
                </div>
              ))}
              <div className="mt-3 flex justify-between border-t border-white/[0.06] pt-3 text-sm font-semibold">
                <span className="text-neutral-400">Total neto</span>
                <span className="text-neutral-100">{fmtCLP(presupuesto.total_neto)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">Sin ítems en el presupuesto.</p>
          )}
          {presupuesto.notas && (
            <p className="mt-3 text-xs text-neutral-500">{presupuesto.notas}</p>
          )}
        </section>
      )}

      {/* ── Totales de trabajos registrados ── */}
      {totalOT > 0 && (
        <section className="rounded-xl border border-white/[0.06] bg-neutral-900/30 px-5 py-4">
          <p className={`${sectionLabel} mb-3`}>Totales de trabajos</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] text-neutral-600 uppercase tracking-wider">Mano de obra</p>
              <p className="mt-0.5 text-sm font-semibold text-neutral-200">{fmtCLP(totalMO)}</p>
            </div>
            <div>
              <p className="text-[11px] text-neutral-600 uppercase tracking-wider">Repuestos</p>
              <p className="mt-0.5 text-sm font-semibold text-neutral-200">{fmtCLP(totalRep)}</p>
            </div>
            <div>
              <p className="text-[11px] text-neutral-600 uppercase tracking-wider">Total</p>
              <p className="mt-0.5 text-base font-bold text-accent-400">{fmtCLP(totalOT)}</p>
            </div>
          </div>
        </section>
      )}

      {/* ── Historial de eventos ── */}
      <section>
        <p className={sectionLabel}>Historial de la OT</p>
        {eventos.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">Sin eventos registrados.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {eventos.map((ev) => (
              <li key={ev.id} className={`${card} flex items-start gap-4 py-3`}>
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-neutral-100">{ev.titulo ?? 'Evento'}</p>
                    <span className="shrink-0 text-xs text-neutral-600">{fmt(ev.creado_en)}</span>
                  </div>
                  {ev.descripcion && (
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{ev.descripcion}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
