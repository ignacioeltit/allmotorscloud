// Dashboard operativo tipo DMS.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { getTipoEventoRecepcionId } from '@/modules/reception/queries'
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

    const enTaller = rows.filter((r) => !FUERA_TALLER.includes(r.estado))
    return {
      enTaller,
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

  const { metrics, enTaller } = result.data
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
        <MetricCard label="Facturación del día" value="—" hint="Próximamente" />
      </div>

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
