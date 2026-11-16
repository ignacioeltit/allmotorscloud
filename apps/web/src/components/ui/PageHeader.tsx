// Encabezado de página con título y acción opcional. Server Component.
import Link from 'next/link'
import { btnPrimary } from './styles'

export function PageHeader({
  title,
  action,
}: {
  title: string
  action?: { href: string; label: string }
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h1 className="flex items-center gap-3 text-xl font-semibold text-neutral-50">
        <span className="h-6 w-1.5 rounded-full bg-gradient-to-b from-orange-400 to-orange-600" aria-hidden />
        {title}
      </h1>
      {action ? (
        <Link href={action.href} className={btnPrimary}>
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}
