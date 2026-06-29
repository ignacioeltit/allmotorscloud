// Estado vacío elegante (sin datos). Nunca mostrar JSON ni crashear.
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] px-6 py-12 text-center">
      <p className="text-sm font-medium text-neutral-300">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}
