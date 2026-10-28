// Reportes: análisis financiero del taller con gráficos y export.
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { listMovimientos } from '@/modules/finanzas/queries'
import { CATEGORIA_GASTO_LABEL } from '@/modules/finanzas/constants'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { MetricCard } from '@/components/ui/MetricCard'
import { ReportesExport } from '@/components/reports/ReportesExport'
import { sectionLabel, card } from '@/components/ui/styles'

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}
function fmtCLPcorto(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${Math.round(n)}`
}

export default async function ReportesPage() {
  const result = await load(async () => {
    const supabase = await createClient()
    const { rol } = await getAuthContext(supabase)
    if (!(rol === 'admin' || rol === 'jefe_taller' || rol === 'recepcionista')) {
      throw Object.assign(new Error('Sin permiso para ver reportes.'), { isAuth: true })
    }

    const hoy = new Date()
    const meses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1)
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MESES_CORTOS[d.getMonth()] }
    })
    const desde = `${meses[0]!.key}-01`
    const hasta = hoy.toISOString().slice(0, 10)
    const movs = await listMovimientos(supabase, { desde, hasta })

    const porMes = meses.map((m) => ({ ...m, ingresos: 0, gastos: 0 }))
    const idx = new Map(porMes.map((m, i) => [m.key, i]))
    for (const mv of movs) {
      const i = idx.get(mv.fecha.slice(0, 7))
      if (i == null) continue
      if (mv.tipo === 'ingreso') porMes[i]!.ingresos += mv.monto
      else porMes[i]!.gastos += mv.monto
    }

    const keyActual = meses[meses.length - 1]!.key
    const gastosCat: Record<string, number> = {}
    for (const mv of movs) {
      if (mv.tipo === 'gasto' && mv.fecha.slice(0, 7) === keyActual) {
        const k = mv.categoria ?? 'otro'
        gastosCat[k] = (gastosCat[k] ?? 0) + mv.monto
      }
    }
    const gastosPorCat = Object.entries(gastosCat).sort((a, b) => b[1] - a[1])

    const filasCsv = movs
      .slice()
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map((mv) => ({
        fecha: mv.fecha,
        tipo: mv.tipo,
        categoria: mv.categoria ? CATEGORIA_GASTO_LABEL[mv.categoria] ?? mv.categoria : '',
        descripcion: mv.descripcion ?? '',
        monto: mv.monto,
      }))

    return { porMes, gastosPorCat, mesActual: porMes[porMes.length - 1]!, filasCsv }
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth ? 'Reportes disponibles para admin, jefe de taller o recepción.' : 'No se pudieron cargar los reportes.'}
      </Notice>
    )
  }

  const { porMes, gastosPorCat, mesActual, filasCsv } = result.data
  const utilidad = mesActual.ingresos - mesActual.gastos
  const totalIngresos6 = porMes.reduce((s, m) => s + m.ingresos, 0)

  // Geometría del gráfico de barras (ingresos vs gastos por mes)
  const W = 640, H = 220, pad = 28, base = H - 34
  const maxV = Math.max(1, ...porMes.flatMap((m) => [m.ingresos, m.gastos]))
  const gw = (W - pad * 2) / porMes.length
  const bw = Math.min(26, gw / 3)
  const esc = (v: number) => (v / maxV) * (base - 20)

  const maxCat = Math.max(1, ...gastosPorCat.map(([, v]) => v))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={sectionLabel}>Análisis del taller</p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-50">Reportes</h1>
          <p className="mt-1 text-sm text-neutral-500">Últimos 6 meses · mes actual en detalle</p>
        </div>
        <ReportesExport filas={filasCsv} />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Ingresos del mes" value={fmtCLP(mesActual.ingresos)} icon="💰" accent />
        <MetricCard label="Gastos del mes" value={fmtCLP(mesActual.gastos)} icon="📉" />
        <MetricCard label="Utilidad del mes" value={fmtCLP(utilidad)} icon="📈" accent={utilidad > 0} />
        <MetricCard label="Ingresos 6 meses" value={fmtCLP(totalIngresos6)} icon="🗓" />
      </div>

      {/* Ingresos vs gastos por mes */}
      <section className={card}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-200">Ingresos vs gastos por mes</h2>
          <div className="flex items-center gap-3 text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Ingresos</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-red-500" /> Gastos</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Ingresos y gastos por mes">
          <line x1={pad} y1={base} x2={W - pad} y2={base} stroke="#00000018" strokeWidth="1" />
          {porMes.map((m, i) => {
            const x = pad + i * gw
            const xi = x + gw / 2 - bw - 2
            const xg = x + gw / 2 + 2
            const hi = esc(m.ingresos)
            const hg = esc(m.gastos)
            return (
              <g key={m.key}>
                <rect x={xi} y={base - hi} width={bw} height={hi} rx="2" fill="#10b981" />
                <rect x={xg} y={base - hg} width={bw} height={hg} rx="2" fill="#ef4444" />
                {m.ingresos > 0 && (
                  <text x={xi + bw / 2} y={base - hi - 4} textAnchor="middle" fontSize="9" fill="#047857">{fmtCLPcorto(m.ingresos)}</text>
                )}
                <text x={x + gw / 2} y={base + 16} textAnchor="middle" fontSize="11" fill="#6b7280" className="capitalize">{m.label}</text>
              </g>
            )
          })}
        </svg>
      </section>

      {/* Gastos por categoría (mes actual) */}
      <section className={card}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-200">Gastos por categoría — mes actual</h2>
        {gastosPorCat.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">Sin gastos registrados este mes.</p>
        ) : (
          <div className="space-y-2.5">
            {gastosPorCat.map(([cat, monto]) => (
              <div key={cat}>
                <div className="mb-0.5 flex items-center justify-between text-xs">
                  <span className="text-neutral-400">{CATEGORIA_GASTO_LABEL[cat] ?? cat}</span>
                  <span className="font-medium text-neutral-200">{fmtCLP(monto)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
                  <div className="h-full rounded-full bg-accent-500" style={{ width: `${(monto / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
