// Página pública de avance de una OT (sin login). El cliente ve el estado de su
// vehículo y las fotos marcadas visibles. Datos por token vía fn_avance_ot
// (SECURITY DEFINER). Colores hex explícitos (fondo claro).
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { urlFoto } from '@/modules/evidencias'

interface Avance {
  numero_ot: string
  estado: string
  creado_en: string
  taller: { nombre: string | null; telefono: string | null; logo_url: string | null }
  vehiculo: { patente: string | null; marca: string | null; modelo: string | null; anio: number | null }
  fotos: { path: string; descripcion: string | null; creado_en: string }[]
}

const ESTADO_CLIENTE: Record<string, { label: string; color: string }> = {
  pendiente_diagnostico: { label: 'En diagnóstico', color: '#0369a1' },
  diagnosticada: { label: 'Diagnóstico listo', color: '#0369a1' },
  presupuesto_pendiente: { label: 'Preparando presupuesto', color: '#b45309' },
  presupuesto_enviado: { label: 'Esperando tu aprobación', color: '#b45309' },
  autorizada: { label: 'Aprobado — en cola de reparación', color: '#7c3aed' },
  en_reparacion: { label: 'En reparación', color: '#7c3aed' },
  control_calidad: { label: 'Control de calidad', color: '#7c3aed' },
  lista_para_entrega: { label: '¡Listo para retirar!', color: '#15803d' },
  entregada: { label: 'Entregado', color: '#15803d' },
  cerrada: { label: 'Entregado', color: '#15803d' },
  cancelada: { label: 'Cancelada', color: '#b91c1c' },
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function AvancePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let a: Avance | null = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.rpc('fn_avance_ot', { p_token: token })
    const res = data as (Avance & { error?: string }) | null
    if (res && !res.error) a = res
  } catch {
    a = null
  }

  if (!a) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-[#111827]">
        <h1 className="text-lg font-semibold">Seguimiento no disponible</h1>
        <p className="mt-2 text-sm text-[#6b7280]">El enlace no es válido o ya no está disponible. Contacta al taller.</p>
      </div>
    )
  }

  const estado = ESTADO_CLIENTE[a.estado] ?? { label: a.estado, color: '#6b7280' }
  const veh = [a.vehiculo.patente, a.vehiculo.marca, a.vehiculo.modelo, a.vehiculo.anio].filter(Boolean).join(' · ')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-[#111827]">
      {/* Taller */}
      <div className="flex items-center gap-3 border-b border-[#e5e7eb] pb-5">
        {a.taller.logo_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={a.taller.logo_url} alt="" className="h-12 w-auto max-w-[120px] object-contain" />
        )}
        <div>
          <h1 className="text-lg font-semibold">{a.taller.nombre ?? 'Taller'}</h1>
          {a.taller.telefono && <p className="text-xs text-[#6b7280]">{a.taller.telefono}</p>}
        </div>
      </div>

      {/* Estado */}
      <div className="mt-6">
        <p className="text-[11px] uppercase tracking-wide text-[#9ca3af]">Seguimiento · {a.numero_ot}</p>
        <p className="mt-1 text-sm text-[#374151]">{veh || 'Tu vehículo'}</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: estado.color }}>
          {estado.label}
        </div>
        <p className="mt-2 text-xs text-[#9ca3af]">Ingresado el {fmtFecha(a.creado_en)}</p>
      </div>

      {/* Fotos */}
      <div className="mt-8">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
          Fotos del trabajo
        </p>
        {a.fotos.length === 0 ? (
          <p className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-6 text-center text-sm text-[#6b7280]">
            Aún no hay fotos publicadas. Vuelve a revisar más tarde.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {a.fotos.map((f, i) => (
              <a key={i} href={urlFoto(f.path)} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-[#e5e7eb]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlFoto(f.path)} alt={f.descripcion ?? 'Foto del trabajo'} className="aspect-square w-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        )}
      </div>

      <p className="mt-10 text-center text-xs text-[#9ca3af]">
        Este enlace muestra el avance de tu vehículo en tiempo real.
      </p>
    </div>
  )
}
