// Ficha del vehículo: datos + Historia Técnica (notas + eventos) + Órdenes de Trabajo.
// Server Component (lectura con server client + RLS).
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getVehiculoById } from '@/modules/vehicles/queries'
import { getHistoriaByVehiculoId } from '@/modules/technical-history/queries'
import { listEventosByHistoria } from '@/modules/events/queries'
import { listOrdenesTrabajoByVehiculo } from '@/modules/repair-orders/queries'
import { load } from '@/lib/ui/load'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
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
    const vehiculo = await getVehiculoById(supabase, id)
    const historia = await getHistoriaByVehiculoId(supabase, id)
    const [eventos, ordenes] = await Promise.all([
      listEventosByHistoria(supabase, historia.id),
      listOrdenesTrabajoByVehiculo(supabase, id),
    ])
    return { vehiculo, historia, eventos, ordenes }
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

  const { vehiculo, historia, eventos, ordenes } = result.data

  return (
    <div className="space-y-8">
      <div>
        <Link href="/vehicles" className={`${linkClass} text-sm`}>
          ← Vehículos
        </Link>
        <PageHeader title={`${vehiculo.patente} — ${vehiculo.marca} ${vehiculo.modelo}`} />
        <div className={`${card} grid grid-cols-2 gap-4 text-sm sm:grid-cols-4`}>
          <Info label="Tipo" value={vehiculo.tipo} />
          <Info label="Año" value={vehiculo.anio?.toString() ?? '—'} />
          <Info label="Kilometraje" value={vehiculo.km_actual?.toLocaleString('es-CL') ?? '—'} />
          <Info label="Color" value={vehiculo.color ?? '—'} />
        </div>
      </div>

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
                <Link href={`/repair-orders/${ot.id}`} className={`${card} block transition-colors hover:border-white/[0.14]`}>
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
