// Tarjeta de métrica (KPI) del dashboard — sólida, con sombra sutil e ícono opcional.
export function MetricCard({
  label,
  value,
  accent = false,
  hint,
  icon,
}: {
  label: string
  value: React.ReactNode
  accent?: boolean
  hint?: string
  icon?: React.ReactNode
}) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm shadow-black/[0.04] ${
        accent ? 'border-accent-500/25 bg-accent-500/[0.06]' : 'border-black/[0.07] bg-neutral-900'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-neutral-400">{label}</p>
        {icon ? (
          <span className={`text-base ${accent ? 'text-accent-400' : 'text-neutral-500'}`} aria-hidden>
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={`mt-2 text-3xl font-bold tabular-nums tracking-tight ${
          accent ? 'text-accent-400' : 'text-neutral-50'
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-neutral-600">{hint}</p> : null}
    </div>
  )
}
