// Nueva cita. Puede venir precargada desde una cotización autorizada que pidió
// agendar (?vehiculo_id&cliente_id&vehiculo&cliente&motivo).
export const dynamic = 'force-dynamic'

import { PageHeader } from '@/components/ui/PageHeader'
import { CitaNewClient, type CitaPrefill } from '@/components/agenda/CitaNewClient'

interface Props {
  searchParams: Promise<{
    vehiculo_id?: string
    cliente_id?: string
    vehiculo?: string
    cliente?: string
    motivo?: string
    notas?: string
  }>
}

export default async function NuevaCitaPage({ searchParams }: Props) {
  const sp = await searchParams

  const prefill: CitaPrefill | undefined = sp.vehiculo_id
    ? {
        vehiculoId: sp.vehiculo_id,
        clienteId: sp.cliente_id ?? null,
        vehiculoLabel: sp.vehiculo ?? 'Vehículo',
        clienteNombre: sp.cliente ?? null,
        motivo: sp.motivo ?? '',
        notas: sp.notas ?? '',
      }
    : undefined

  return (
    <div>
      <PageHeader title="Nueva cita" />
      <p className="-mt-3 mb-4 text-sm text-neutral-500">
        Agenda una cita para un vehículo ya registrado. Los vehículos nuevos entran por recepción.
      </p>
      <CitaNewClient prefill={prefill} />
    </div>
  )
}
