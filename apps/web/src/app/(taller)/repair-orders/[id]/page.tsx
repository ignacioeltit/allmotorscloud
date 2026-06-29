// Detalle de Orden de Trabajo — vista de la OT recién creada (o existente).
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrdenTrabajoById } from '@/modules/repair-orders/queries'
import { getVehiculoById } from '@/modules/vehicles/queries'
import { getPropietarioActivoByVehiculo } from '@/modules/customers/queries'
import { listEventosByOrdenTrabajo } from '@/modules/events/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { card, sectionLabel, linkClass } from '@/components/ui/styles'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { OrdenTrabajoActions } from '@/components/repair-orders/OrdenTrabajoActions'

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Info({ label, value }: { label: string; value: string | null }) {
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
    const vehiculo = await getVehiculoById(supabase, orden.vehiculo_id)
    const cliente = await getPropietarioActivoByVehiculo(supabase, orden.vehiculo_id)
    const eventos = await listEventosByOrdenTrabajo(supabase, orden.id)
    return { orden, vehiculo, cliente, eventos }
  })

  if (!result.ok) {
    return (
      <div>
        <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
          {result.isAuth ? 'Inicia sesión para ver la OT.' : 'No se pudo cargar la orden de trabajo.'}
        </Notice>
        <p className="mt-4">
          <Link href="/dashboard" className={linkClass}>
            ← Volver al dashboard
          </Link>
        </p>
      </div>
    )
  }

  const { orden, vehiculo, cliente, eventos } = result.data
  const recepcion = eventos.find((e) => e.titulo?.toLowerCase().includes('recepci')) ?? eventos[eventos.length - 1]

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className={`${linkClass} text-sm`}>
          ← Dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">
              {orden.numero_ot}
            </h1>
            <StatusBadge estado={orden.estado} />
          </div>
          <p className="text-sm text-neutral-500">Abierta {fmt(orden.creado_en)}</p>
        </div>

        <div className="mt-4 rounded-xl border border-white/[0.06] bg-neutral-900/50 p-4">
          <p className={`${sectionLabel} mb-2.5`}>Acciones</p>
          <OrdenTrabajoActions id={orden.id} estado={orden.estado} vehiculoId={orden.vehiculo_id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Cliente */}
        <section className={card}>
          <p className={sectionLabel}>Cliente</p>
          {cliente ? (
            <div className="mt-3 space-y-3">
              <p className="text-lg font-semibold text-neutral-50">{cliente.nombre}</p>
              <div className="grid grid-cols-2 gap-3">
                <Info label="RUT" value={cliente.rut} />
                <Info label="Teléfono" value={cliente.telefono} />
                <Info label="Email" value={cliente.email} />
                <Info label="Dirección" value={cliente.direccion} />
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">Sin propietario asignado.</p>
          )}
        </section>

        {/* Vehículo */}
        <section className={card}>
          <p className={sectionLabel}>Vehículo</p>
          <div className="mt-3 space-y-3">
            <p className="text-lg font-semibold tracking-wide text-neutral-50">
              {vehiculo.patente}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Info label="Marca" value={vehiculo.marca} />
              <Info label="Modelo" value={vehiculo.modelo} />
              <Info label="Año" value={vehiculo.anio?.toString() ?? null} />
              <Info label="Color" value={vehiculo.color} />
              <Info label="Km ingreso" value={orden.km_ingreso?.toLocaleString('es-CL') ?? null} />
              <Info label="VIN" value={vehiculo.vin} />
            </div>
            {vehiculo.notas && (
              <p className="whitespace-pre-wrap rounded-lg bg-white/[0.02] px-3 py-2 text-xs text-neutral-400">
                {vehiculo.notas}
              </p>
            )}
          </div>
        </section>

        {/* Motivo / recepción */}
        <section className={card}>
          <p className={sectionLabel}>Motivo de ingreso</p>
          <p className="mt-3 text-sm text-neutral-200">{orden.notas || '—'}</p>
          {recepcion?.descripcion && (
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <p className={sectionLabel}>Detalle de recepción</p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-neutral-400">
                {recepcion.descripcion}
              </pre>
            </div>
          )}
        </section>
      </div>

      {/* Historial de eventos */}
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
