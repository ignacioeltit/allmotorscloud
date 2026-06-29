// Nueva Recepción — pantalla principal del flujo operativo (ruta canónica /recepcion).
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getTipoEventoRecepcionId } from '@/modules/reception/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { ReceptionFlow } from '../reception/ReceptionFlow'

export default async function RecepcionPage() {
  const result = await load(async () => {
    const supabase = await createClient()
    return getTipoEventoRecepcionId(supabase)
  })

  if (!result.ok) {
    return (
      <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
        {result.isAuth
          ? 'Inicia sesión para recibir vehículos.'
          : 'No se pudo preparar la recepción.'}
      </Notice>
    )
  }

  if (!result.data) {
    return (
      <Notice tone="warning" title="Falta configurar los tipos de evento">
        No existe un tipo de evento «recepcion» en esta organización. Se crea en el onboarding
        (o con el seed de desarrollo). No es posible recibir vehículos hasta que exista.
      </Notice>
    )
  }

  return <ReceptionFlow tipoRecepcionId={result.data} />
}
