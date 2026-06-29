// Sección con título, paso opcional (numerado) y acción a la derecha.
export function Section({
  title,
  step,
  action,
  children,
}: {
  title: string
  step?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-neutral-900/50 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {step ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-[11px] font-semibold text-neutral-400">
              {step}
            </span>
          ) : null}
          <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
