// Crear vehículo. Formulario Client Component (mutación vía browser client).
// Si llega ?cliente=<id>, precarga ese cliente como propietario.
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getClienteById } from '@/modules/customers/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { VehiculoForm } from '@/components/forms/VehiculoForm'

export default async function NuevoVehiculoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>
}) {
  const { cliente: clienteId } = await searchParams

  let clienteInicial: { id: string; nombre: string } | undefined
  if (clienteId) {
    try {
      const supabase = await createClient()
      const c = await getClienteById(supabase, clienteId)
      clienteInicial = { id: c.id, nombre: c.nombre }
    } catch {
      clienteInicial = undefined
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Nuevo vehículo" />
      <VehiculoForm clienteInicial={clienteInicial} />
    </div>
  )
}
