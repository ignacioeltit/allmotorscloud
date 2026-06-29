// Avisos presentacionales (info / warning / error / empty). Server Component puro.
type NoticeTone = 'info' | 'warning' | 'error' | 'empty'

const toneClasses: Record<NoticeTone, string> = {
  info: 'border-brand-100 bg-brand-50 text-brand-900',
  warning: 'border-warning-500/30 bg-warning-500/10 text-neutral-900',
  error: 'border-danger-500/30 bg-danger-500/10 text-danger-600',
  empty: 'border-neutral-200 bg-neutral-100 text-neutral-500',
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
    <div className={`rounded-md border p-4 text-sm ${toneClasses[tone]}`}>
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
    </div>
  )
}
