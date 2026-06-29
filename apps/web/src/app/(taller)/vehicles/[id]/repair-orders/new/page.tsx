// Abrir Orden de Trabajo para el vehículo. El formulario (Client Component) ejecuta
// la mutación con el browser client; vehiculo_id viene de la ruta.
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { OrdenTrabajoForm } from '@/components/forms/OrdenTrabajoForm'
import { linkClass } from '@/components/ui/styles'

export default async function NuevaOrdenTrabajoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="max-w-2xl">
      <Link href={`/vehicles/${id}`} className={`${linkClass} text-sm`}>
        ← Volver a la ficha
      </Link>
      <PageHeader title="Abrir orden de trabajo" />
      <OrdenTrabajoForm vehiculoId={id} />
    </div>
  )
}
