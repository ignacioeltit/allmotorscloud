// Agenda del taller: citas por día y por semana.
export const dynamic = 'force-dynamic'

import { PageHeader } from '@/components/ui/PageHeader'
import { AgendaView } from '@/components/agenda/AgendaView'

export default function AgendaPage() {
  return (
    <div>
      <PageHeader title="Agenda" />
      <p className="-mt-3 mb-4 text-sm text-neutral-500">
        Citas programadas del taller. Cambia entre vista de día y semana, y actualiza el estado de
        cada cita a medida que el cliente llega.
      </p>
      <AgendaView />
    </div>
  )
}
