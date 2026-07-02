// Nueva cotización (presupuesto sin OT).
export const dynamic = 'force-dynamic'

import { PageHeader } from '@/components/ui/PageHeader'
import { CotizacionNewClient } from '@/components/estimates/CotizacionNewClient'

export default function NuevaCotizacionPage() {
  return (
    <div>
      <PageHeader title="Nueva cotización" />
      <p className="-mt-3 mb-4 text-sm text-neutral-500">
        Cotiza a un cliente sin generar una orden de trabajo. Podrás convertirla en OT más adelante.
      </p>
      <CotizacionNewClient />
    </div>
  )
}
