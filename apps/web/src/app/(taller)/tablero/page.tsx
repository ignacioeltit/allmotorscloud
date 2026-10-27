// Tablero operativo tipo Kanban: las OTs activas como tarjetas, agrupadas por
// etapa, con el tiempo que llevan en su etapa actual. Clic → abre la OT.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { sectionLabel } from '@/components/ui/styles'

type OtRow = {
  id: string
  numero_ot: string
  estado: string
  creado_en: string
  actualizado_en: string
  vehiculos: { patente: string; marca: string; modelo: string } | null
}

// Columnas del tablero (agrupan estados relacionados), en orden del flujo.
const COLUMNAS: { titulo: string; estados: string[] }[] = [
  { titulo: 'Diagnóstico', estados: ['pendiente_diagnostico', 'diagnosticada'] },
  { titulo: 'Presupuesto', estados: ['presupuesto_pendiente', 'presupuesto_enviado'] },
  { titulo: 'Autorizada', estados: ['autorizada'] },
  { titulo: 'En reparación', estados: ['en_reparacion', 'control_calidad'] },
  { titulo: 'Lista para entregar', estados: ['lista_para_entrega'] },
]

function tiempoEnEtapa(desdeISO: string): string {
  const ms = Date.now() - new Date(desdeISO).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${Math.max(min, 0)} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h`
  return `${Math.floor(h / 24)} d`
}

export default async function TableroPage() {
  const result = await load(async () => {
    const supabase = await createClient()
    const { orgId } = await getAuthContext(supabase)

    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .select('id, numero_ot, estado, creado_en, actualizado_en, vehiculos(patente, marca, modelo)')
      .eq('org_id', orgId)
      .is('eliminado_en', null)
      .not('estado', 'in', '(entregada,cerrada,cancelada)')
      .order('actualizado_en', { ascending: true })
      .limit(300)
    if (error) throw error
    const rows = (data ?? []) as unknown as OtRow[]

    const mecanicosPorOt: Record<string, string[]> = {}
    if (rows.length > 0) {
      const { data: repData } = await supabase
        .from('reparaciones')
        .select('orden_trabajo_id, mecanico:usuarios!mecanico_id(nombre)')
        .eq('org_id', orgId)
        .in('orden_trabajo_id', rows.map((r) => r.id))
        .not('mecanico_id', 'is', null)
      type RepRow = { orden_trabajo_id: string; mecanico: { nombre: string } | null }
      for (const r of (repData ?? []) as unknown as RepRow[]) {
        if (!r.mecanico?.nombre) continue
        const lista = (mecanicosPorOt[r.orden_trabajo_id] ??= [])
        if (!lista.includes(r.mecanico.nombre)) lista.push(r.mecanico.nombre)
      }
    }

    return { rows, mecanicosPorOt }
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth ? 'Inicia sesión para ver el tablero.' : 'No se pudo cargar el tablero.'}
      </Notice>
    )
  }

  const { rows, mecanicosPorOt } = result.data
  const columnas = COLUMNAS.map((col) => ({
    ...col,
    ots: rows.filter((r) => col.estados.includes(r.estado)),
  }))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={sectionLabel}>Panel operativo</p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-50">Tablero</h1>
          <p className="mt-1 text-sm text-neutral-500">{rows.length} vehículos en el flujo del taller</p>
        </div>
        <Link href="/recepcion" className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-500">
          + Nueva Recepción
        </Link>
      </header>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columnas.map((col) => (
          <div key={col.titulo} className="flex w-72 shrink-0 flex-col">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-neutral-200">{col.titulo}</h2>
              <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-xs font-medium text-neutral-500">
                {col.ots.length}
              </span>
            </div>
            <div className="flex-1 space-y-2.5 rounded-xl bg-black/[0.025] p-2.5">
              {col.ots.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-neutral-500">—</p>
              ) : (
                col.ots.map((ot) => (
                  <Link
                    key={ot.id}
                    href={`/repair-orders/${ot.id}`}
                    className="block rounded-lg border border-black/[0.07] bg-neutral-900 p-3 shadow-sm shadow-black/[0.04] transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/[0.08]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold tracking-wide text-neutral-50">
                        {ot.vehiculos?.patente ?? 'Vehículo'}
                      </span>
                      <StatusBadge estado={ot.estado} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-neutral-400">
                      {ot.vehiculos ? `${ot.vehiculos.marca} ${ot.vehiculos.modelo}` : '—'}
                    </p>
                    {(mecanicosPorOt[ot.id]?.length ?? 0) > 0 && (
                      <p className="mt-1.5 truncate text-[11px] text-sky-800">🔧 {mecanicosPorOt[ot.id]!.join(', ')}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
                      <span>{ot.numero_ot}</span>
                      <span className="inline-flex items-center gap-1">⏱ {tiempoEnEtapa(ot.actualizado_en)}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
