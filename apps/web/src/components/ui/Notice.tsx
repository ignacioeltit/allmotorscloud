// Avisos presentacionales (info / warning / error / empty). Tema oscuro.
type NoticeTone = 'info' | 'warning' | 'error' | 'empty'

const toneClasses: Record<NoticeTone, string> = {
  info: 'border-accent-500/20 bg-accent-500/[0.07] text-accent-200',
  warning: 'border-amber-500/25 bg-amber-500/[0.08] text-amber-200',
  error: 'border-red-500/25 bg-red-500/[0.08] text-red-200',
  empty: 'border-white/[0.06] bg-white/[0.02] text-neutral-500',
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: NoticeTone
  title?: string
  children?: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border p-4 text-sm ${toneClasses[tone]}`}>
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={title ? 'mt-1 text-[13px] opacity-90' : ''}>{children}</div> : null}
    </div>
  )
}
