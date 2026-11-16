// Tarjeta de métrica (KPI): franja de color arriba, ícono en una pastilla del
// mismo tono y valor grande. `accent` la destaca (fondo de color suave).

export type TonoMetrica = 'orange' | 'sky' | 'emerald' | 'amber' | 'violet' | 'rose' | 'blue' | 'teal' | 'slate'

const TONOS: Record<TonoMetrica, { barra: string; chip: string; valor: string; fondo: string }> = {
  orange:  { barra: 'from-orange-400 to-orange-600',   chip: 'bg-orange-100 text-orange-600',   valor: 'text-orange-600',  fondo: 'from-orange-50' },
  sky:     { barra: 'from-sky-400 to-sky-600',         chip: 'bg-sky-100 text-sky-600',         valor: 'text-sky-700',     fondo: 'from-sky-50' },
  emerald: { barra: 'from-emerald-400 to-emerald-600', chip: 'bg-emerald-100 text-emerald-600', valor: 'text-emerald-700', fondo: 'from-emerald-50' },
  amber:   { barra: 'from-amber-300 to-amber-500',     chip: 'bg-amber-100 text-amber-600',     valor: 'text-amber-700',   fondo: 'from-amber-50' },
  violet:  { barra: 'from-violet-400 to-violet-600',   chip: 'bg-violet-100 text-violet-600',   valor: 'text-violet-700',  fondo: 'from-violet-50' },
  rose:    { barra: 'from-rose-400 to-rose-600',       chip: 'bg-rose-100 text-rose-600',       valor: 'text-rose-700',    fondo: 'from-rose-50' },
  blue:    { barra: 'from-blue-400 to-blue-600',       chip: 'bg-blue-100 text-blue-600',       valor: 'text-blue-700',    fondo: 'from-blue-50' },
  teal:    { barra: 'from-teal-400 to-teal-600',       chip: 'bg-teal-100 text-teal-600',       valor: 'text-teal-700',    fondo: 'from-teal-50' },
  slate:   { barra: 'from-slate-300 to-slate-500',     chip: 'bg-slate-100 text-slate-600',     valor: 'text-neutral-50',  fondo: 'from-slate-50' },
}

export function MetricCard({
  label,
  value,
  accent = false,
  hint,
  icon,
  tone,
}: {
  label: string
  value: React.ReactNode
  /** Destaca la tarjeta con fondo de color y valor en el tono. */
  accent?: boolean
  hint?: string
  icon?: React.ReactNode
  /** Color de la tarjeta. Por defecto naranjo si `accent`, gris si no. */
  tone?: TonoMetrica
}) {
  const t = TONOS[tone ?? (accent ? 'orange' : 'slate')]
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-black/[0.06] p-5 shadow-sm shadow-black/[0.05] transition-shadow hover:shadow-md ${
        accent ? `bg-gradient-to-br ${t.fondo} to-white` : 'bg-white'
      }`}
    >
      <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.barra}`} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-neutral-400">{label}</p>
        {icon ? (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${t.chip}`} aria-hidden>
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${
          accent || tone ? t.valor : 'text-neutral-50'
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-neutral-500">{hint}</p> : null}
    </div>
  )
}
