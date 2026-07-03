// Dashboard operativo tipo DMS.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { getTipoEventoRecepcionId } from '@/modules/reception/queries'
import { listCotizacionesRespondidas } from '@/modules/estimates/queries'
import { getCitasActivasPorVehiculo } from '@/modules/agenda/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { MetricCard } from '@/components/ui/MetricCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { btnPrimary, cardInteractive, sectionLabel } from '@/components/ui/styles'

type OtRow = {
  id: string
  numero_ot: string
  estado: string
  creado_en: string
  actualizado_en: string
  vehiculos: { patente: string; marca: string; modelo: string } | null
}

const TERMINALES = ['cerrada', 'cancelada']
const FUERA_TALLER = ['entregada', 'cerrada', 'cancelada']

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function startOfTodayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default async function DashboardPage() {
  const result = await load(async () => {
    const supabase = await createClient()
    const { orgId } = await getAuthContext(supabase)
    const desdeHoy = startOfTodayISO()

    const { data: otData, error: otError } = await supabase
      .from('ordenes_trabajo')
      .select('id, numero_ot, estado, creado_en, actualizado_en, vehiculos(patente, marca, modelo)')
      .eq('org_id', orgId)
      .is('eliminado_en', null)
      .order('creado_en', { ascending: false })
      .limit(200)
    if (otError) throw otError
    const rows = (otData ?? []) as unknown as OtRow[]

    let recepcionesHoy = 0
    const tipoRecepcionId = await getTipoEventoRecepcionId(supabase)
    if (tipoRecepcionId) {
      const { count } = await supabase
        .from('eventos')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('tipo_evento_id', tipoRecepcionId)
        .is('eliminado_en', null)
        .gte('creado_en', desdeHoy)
      recepcionesHoy = count ?? 0
    }

    const cotizacionesRespondidas = await listCotizacionesRespondidas(supabase)

    // Si el vehículo ya tiene una cita activa, la alerta "quiere agendar" se apaga.
    const vehiculosConAgendar = cotizacionesRespondidas
      .filter((c) => c.agendar_solicitado && c.vehiculo_id)
      .map((c) => c.vehiculo_id as string)
    const citasActivas = await getCitasActivasPorVehiculo(supabase, vehiculosConAgendar)

    const enTaller = rows.filter((r) => !FUERA_TALLER.includes(r.estado))

    // Mecánicos trabajando en cada OT visible (desde los trabajos asignados).
    const mecanicosPorOt: Record<string, string[]> = {}
    if (enTaller.length > 0) {
      const { data: repData } = await supabase
        .from('reparaciones')
        .select('orden_trabajo_id, mecanico:usuarios!mecanico_id(nombre)')
        .eq('org_id', orgId)
        .in('orden_trabajo_id', enTaller.map((r) => r.id))
        .not('mecanico_id', 'is', null)
      type RepRow = { orden_trabajo_id: string; mecanico: { nombre: string } | null }
      for (const r of (repData ?? []) as unknown as RepRow[]) {
        if (!r.mecanico?.nombre) continue
        const lista = (mecanicosPorOt[r.orden_trabajo_id] ??= [])
        if (!lista.includes(r.mecanico.nombre)) lista.push(r.mecanico.nombre)
      }
    }

    return {
      enTaller,
      mecanicosPorOt,
      cotizacionesRespondidas,
      citasActivas,
      metrics: {
        enTaller: enTaller.length,
        abiertas: rows.filter((r) => !TERMINALES.includes(r.estado)).length,
        esperandoRepuestos: rows.filter((r) => r.estado === 'autorizada').length,
        listas: rows.filter((r) => r.estado === 'lista_para_entrega').length,
        entregadasHoy: rows.filter(
          (r) => r.estado === 'entregada' && r.actualizado_en >= desdeHoy,
        ).length,
        recepcionesHoy,
      },
    }
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth
          ? 'Inicia sesión para ver el panel del taller.'
          : 'No se pudieron cargar los datos.'}
      </Notice>
    )
  }

  const { metrics, enTaller, mecanicosPorOt, cotizacionesRespondidas, citasActivas } = result.data
  const citaDe = (c: (typeof cotizacionesRespondidas)[number]) =>
    c.vehiculo_id ? citasActivas[c.vehiculo_id] ?? null : null
  const pidenAgendar = cotizacionesRespondidas.filter(
    (c) => c.estado === 'autorizado' && c.agendar_solicitado && !citaDe(c),
  ).length
  const hoy = new Date().toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={sectionLabel}>Panel del taller</p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-50">Dashboard</h1>
          <p className="mt-1 text-sm capitalize text-neutral-500">{hoy}</p>
        </div>
        <Link href="/recepcion" className={btnPrimary}>
          + Nueva Recepción
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <MetricCard label="Vehículos en taller" value={metrics.enTaller} accent />
        <MetricCard label="OT abiertas" value={metrics.abiertas} />
        <MetricCard label="Esperando repuestos" value={metrics.esperandoRepuestos} />
        <MetricCard label="Listos para entregar" value={metrics.listas} />
        <MetricCard label="Entregados hoy" value={metrics.entregadasHoy} />
        <MetricCard label="Recepciones del día" value={metrics.recepcionesHoy} />
        <MetricCard label="Piden agendar" value={pidenAgendar} accent={pidenAgendar > 0} />
        <MetricCard label="Facturación del día" value="—" hint="Próximamente" />
      </div>

      {cotizacionesRespondidas.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-200">Respuestas de clientes a cotizaciones</h2>
            <Link href="/estimates" className="text-xs text-accent-400 hover:text-accent-300">
              Ver todas →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cotizacionesRespondidas.map((c) => {
              const autorizado = c.estado === 'autorizado'
              const cita = citaDe(c)
              const href = c.orden_trabajo_id ? `/repair-orders/${c.orden_trabajo_id}` : `/estimates/${c.id}`
              return (
                <Link key={c.id} href={href} className={cardInteractive}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-semibold tracking-wide text-neutral-50">
                      {c.patente ?? 'Cotización'}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                        autorizado
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800'
                          : 'border-red-500/30 bg-red-500/10 text-red-800'
                      }`}
                    >
                      {autorizado ? 'Autorizada' : 'Rechazada'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-400">
                    {c.cliente_nombre ?? '—'}
                    {c.marca ? ` · ${c.marca} ${c.modelo}` : ''}
                  </p>
                  {c.agendar_solicitado && autorizado && (
                    cita ? (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        ✓ Cita agendada ·{' '}
                        {new Date(cita).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })}{' '}
                        {new Date(cita).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </p>
                    ) : (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-md border border-accent-500/30 bg-accent-500/10 px-2 py-0.5 text-xs font-medium text-accent-400">
                        📅 Quiere agendar
                      </p>
                    )
                  )}
                  {c.nota_cliente && (
                    <p className="mt-2 line-clamp-2 text-xs italic text-neutral-500">“{c.nota_cliente}”</p>
                  )}
                  <p className="mt-3 text-xs text-neutral-600">
                    {fmtCLP(c.total_neto)}
                    {c.respondido_en ? ` · ${new Date(c.respondido_en).toLocaleDateString('es-CL')}` : ''}
                  </p>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-200">Vehículos en el taller</h2>
          <span className="text-xs text-neutral-600">{enTaller.length} activos</span>
        </div>

        {enTaller.length === 0 ? (
          <EmptyState
            title="No hay vehículos en el taller"
            description="Cuando recibas un vehículo aparecerá aquí con su orden de trabajo."
            action={
              <Link href="/recepcion" className={btnPrimary}>
                Recibir un vehículo
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enTaller.map((ot) => (
              <Link key={ot.id} href={`/repair-orders/${ot.id}`} className={cardInteractive}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold tracking-wide text-neutral-50">
                    {ot.vehiculos?.patente ?? 'Vehículo'}
                  </span>
                  <StatusBadge estado={ot.estado} />
                </div>
                <p className="mt-1 text-sm text-neutral-400">
                  {ot.vehiculos ? `${ot.vehiculos.marca} ${ot.vehiculos.modelo}` : '—'}
                </p>
                {(mecanicosPorOt[ot.id]?.length ?? 0) > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-800">
                    🔧 {mecanicosPorOt[ot.id]!.join(', ')}
                  </p>
                )}
                <p className="mt-3 text-xs text-neutral-600">
                  {ot.numero_ot} · {new Date(ot.creado_en).toLocaleDateString('es-CL')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
