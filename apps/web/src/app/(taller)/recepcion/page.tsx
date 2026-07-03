// Nueva Recepción — pantalla principal del flujo operativo (ruta canónica /recepcion).
// Acepta ?presupuesto_id=<uuid> para convertir una cotización autorizada en OT
// (Fase C): precarga vehículo+cliente+motivo y enlaza la cotización al recibir.
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTipoEventoRecepcionId } from '@/modules/reception/queries'
import { getCotizacionById } from '@/modules/estimates/queries'
import { isEnrichmentEnabled } from '@/lib/enrichment'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { ReceptionFlow, type RecepcionPrefill } from '../reception/ReceptionFlow'

export default async function RecepcionPage({
  searchParams,
}: {
  searchParams: Promise<{ presupuesto_id?: string }>
}) {
  const { presupuesto_id: presupuestoId } = await searchParams

  const result = await load(async () => {
    const supabase = await createClient()
    const tipoRecepcionId = await getTipoEventoRecepcionId(supabase)

    // Prefill desde una cotización (conversión a OT).
    let prefill: RecepcionPrefill | null = null
    if (presupuestoId) {
      const coti = await getCotizacionById(supabase, presupuestoId)
      if (coti?.orden_trabajo_id) {
        // Ya fue convertida: ir directo a su OT (idempotente).
        return { tipoRecepcionId, redirigirA: `/repair-orders/${coti.orden_trabajo_id}`, prefill: null }
      }
      if (coti?.vehiculo?.id && coti.estado === 'autorizado') {
        const labores = coti.items.filter((i) => i.tipo === 'mano_obra').map((i) => i.descripcion)
        const detalle = (labores.length ? labores : coti.items.map((i) => i.descripcion)).slice(0, 3).join(', ')
        prefill = {
          presupuestoId: coti.id,
          vehiculoId: coti.vehiculo.id,
          folio: coti.folio,
          motivo: `${coti.folio ?? 'Cotización'} autorizada${detalle ? `: ${detalle}` : ''}`.slice(0, 300),
        }
      }
    }
    return { tipoRecepcionId, redirigirA: null, prefill }
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

  if (result.data.redirigirA) {
    redirect(result.data.redirigirA)
  }

  if (!result.data.tipoRecepcionId) {
    return (
      <Notice tone="warning" title="Falta configurar los tipos de evento">
        No existe un tipo de evento «recepcion» en esta organización. Se crea en el onboarding
        (o con el seed de desarrollo). No es posible recibir vehículos hasta que exista.
      </Notice>
    )
  }

  return (
    <ReceptionFlow
      tipoRecepcionId={result.data.tipoRecepcionId}
      enrichmentEnabled={isEnrichmentEnabled()}
      prefill={result.data.prefill}
    />
  )
}
