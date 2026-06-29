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
      <h1 className="text-xl font-semibold text-neutral-50">{title}</h1>
      {action ? (
        <Link href={action.href} className={btnPrimary}>
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}
