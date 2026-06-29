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
import { card, badge, btnPrimary, btnSecondary, linkClass } from '@/components/ui/styles'

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-CL')
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
            ? 'Inicia sesión para ver la ficha del vehículo (Auth — Sprint 2 pendiente).'
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
        <div className={`${card} grid grid-cols-2 gap-3 text-sm sm:grid-cols-4`}>
          <div>
            <p className="text-neutral-500">Tipo</p>
            <p className="text-neutral-900">{vehiculo.tipo}</p>
          </div>
          <div>
            <p className="text-neutral-500">Año</p>
            <p className="text-neutral-900">{vehiculo.anio ?? '—'}</p>
          </div>
          <div>
            <p className="text-neutral-500">Kilometraje</p>
            <p className="text-neutral-900">{vehiculo.km_actual ?? '—'}</p>
          </div>
          <div>
            <p className="text-neutral-500">Color</p>
            <p className="text-neutral-900">{vehiculo.color ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Historia Técnica */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Historia Técnica</h2>
          <Link href={`/vehicles/${id}/events/new`} className={btnPrimary}>
            Registrar evento
          </Link>
        </div>

        {historia.notas ? (
          <div className={`${card} mb-3`}>
            <p className="text-sm text-neutral-500">Notas generales</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{historia.notas}</p>
          </div>
        ) : null}

        {eventos.length === 0 ? (
          <Notice tone="empty">Sin eventos registrados en la historia técnica.</Notice>
        ) : (
          <ul className="space-y-2">
            {eventos.map((ev) => (
              <li key={ev.id} className={card}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-neutral-900">{ev.titulo ?? '(sin título)'}</p>
                  <span className={badge}>{ev.estado}</span>
                </div>
                {ev.descripcion ? (
                  <p className="mt-1 text-sm text-neutral-600">{ev.descripcion}</p>
                ) : null}
                <p className="mt-2 text-xs text-neutral-400">{fmt(ev.creado_en)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Órdenes de Trabajo */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Órdenes de Trabajo</h2>
          <Link href={`/vehicles/${id}/repair-orders/new`} className={btnSecondary}>
            Abrir OT
          </Link>
        </div>

        {ordenes.length === 0 ? (
          <Notice tone="empty">Este vehículo no tiene órdenes de trabajo.</Notice>
        ) : (
          <ul className="space-y-2">
            {ordenes.map((ot) => (
              <li key={ot.id} className={card}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-neutral-900">OT {ot.numero_ot}</p>
                  <span className={badge}>{ot.estado}</span>
                </div>
                <p className="mt-2 text-xs text-neutral-400">
                  Abierta {fmt(ot.creado_en)}
                  {ot.cerrado_en ? ` · Cerrada ${fmt(ot.cerrado_en)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
