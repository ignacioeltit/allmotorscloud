// Tarjeta de métrica del dashboard.
export function MetricCard({
  label,
  value,
  accent = false,
  hint,
}: {
  label: string
  value: React.ReactNode
  accent?: boolean
  hint?: string
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        accent ? 'border-accent-500/20 bg-accent-500/[0.04]' : 'border-black/[0.06] bg-neutral-900/50'
      }`}
    >
      <p className="text-[13px] text-neutral-400">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${
          accent ? 'text-accent-300' : 'text-neutral-50'
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-neutral-600">{hint}</p> : null}
    </div>
  )
}
