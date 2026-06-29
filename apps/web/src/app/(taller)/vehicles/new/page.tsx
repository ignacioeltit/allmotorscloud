// Crear vehículo. Formulario Client Component (mutación vía browser client).
import { PageHeader } from '@/components/ui/PageHeader'
import { VehiculoForm } from '@/components/forms/VehiculoForm'

export default function NuevoVehiculoPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Nuevo vehículo" />
      <VehiculoForm />
    </div>
  )
}
