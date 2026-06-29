// Crear cliente. El formulario es un Client Component (mutación vía browser client).
import { PageHeader } from '@/components/ui/PageHeader'
import { ClienteForm } from '@/components/forms/ClienteForm'

export default function NuevoClientePage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Nuevo cliente" />
      <ClienteForm />
    </div>
  )
}
