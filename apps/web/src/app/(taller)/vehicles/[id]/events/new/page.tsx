// Crear evento en la historia técnica del vehículo.
// El Server Component resuelve historia_tecnica_id y los tipos de evento; el formulario
// (Client Component) ejecuta la mutación con el browser client.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getHistoriaByVehiculoId } from '@/modules/technical-history/queries'
import { listTiposEvento } from '@/modules/events/queries'
import { load } from '@/lib/ui/load'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
import { EventoForm } from '@/components/forms/EventoForm'
import { linkClass } from '@/components/ui/styles'

export default async function NuevoEventoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const result = await load(async () => {
    const supabase = await createClient()
    const historia = await getHistoriaByVehiculoId(supabase, id)
    const tipos = await listTiposEvento(supabase)
    return { historiaId: historia.id, tipos }
  })

  return (
    <div className="max-w-2xl">
      <Link href={`/vehicles/${id}`} className={`${linkClass} text-sm`}>
        ← Volver a la ficha
      </Link>
      <PageHeader title="Registrar evento" />

      {!result.ok ? (
        <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
          {result.isAuth
            ? 'Inicia sesión para registrar eventos (Auth — Sprint 2 pendiente).'
            : 'No se pudo preparar el formulario.'}
        </Notice>
      ) : (
        <EventoForm
          vehiculoId={id}
          historiaTecnicaId={result.data.historiaId}
          tipos={result.data.tipos}
        />
      )}
    </div>
  )
}
