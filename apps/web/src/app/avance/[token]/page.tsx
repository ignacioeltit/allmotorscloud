// Página pública de avance de una OT (sin login). El cliente ve el estado de su
// vehículo y las fotos marcadas visibles. Datos por token vía fn_avance_ot
// (SECURITY DEFINER). Colores hex explícitos (fondo claro).
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { urlFoto } from '@/modules/evidencias'
import { TIPOS_ITEM_LABEL, type TipoItemReparacion } from '@/modules/reparaciones/constants'
import { ComentarWhatsapp } from './ComentarWhatsapp'

interface Trabajo {
  tipo: TipoItemReparacion
  descripcion: string | null
  cantidad: number
  total: number
}

interface Avance {
  numero_ot: string
  estado: string
  creado_en: string
  taller: { nombre: string | null; telefono: string | null; logo_url: string | null }
  vehiculo: { patente: string | null; marca: string | null; modelo: string | null; anio: number | null }
  fotos: { path: string; descripcion: string | null; creado_en: string }[]
  trabajos: Trabajo[]
  total_con_iva: number
}

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

// Orden de agrupación: repuestos, mano de obra, otros (igual que en la OT).
const ORDEN_TIPO: TipoItemReparacion[] = ['repuesto', 'mano_obra', 'otros']

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

      {/* Trabajos / detalle de la OT con precio */}
      {a.trabajos.length > 0 && (
        <div className="mt-8">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
            Detalle de los trabajos
          </p>
          <div className="overflow-hidden rounded-xl border border-[#e5e7eb]">
            {ORDEN_TIPO.filter((t) => a!.trabajos.some((w) => w.tipo === t)).map((tipo) => (
              <div key={tipo} className="border-b border-[#e5e7eb] last:border-b-0">
                <p className="bg-[#f9fafb] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  {TIPOS_ITEM_LABEL[tipo]}
                </p>
                {a!.trabajos
                  .filter((w) => w.tipo === tipo)
                  .map((w, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="text-[#374151]">
                        {w.descripcion || '—'}
                        {w.cantidad > 1 && <span className="text-[#9ca3af]"> × {w.cantidad}</span>}
                      </span>
                      <span className="shrink-0 font-medium text-[#111827]">{fmtCLP(w.total)}</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-[#e5e7eb] pt-3">
            <span className="text-sm font-semibold text-[#111827]">Total con IVA</span>
            <span className="text-lg font-bold text-[#111827]">{fmtCLP(a.total_con_iva)}</span>
          </div>
          <p className="mt-1 text-[11px] text-[#9ca3af]">Valores referenciales de los trabajos a la fecha.</p>
        </div>
      )}

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
              <div key={i} className="overflow-hidden rounded-lg border border-[#e5e7eb]">
                <a href={urlFoto(f.path)} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlFoto(f.path)} alt={f.descripcion ?? 'Foto del trabajo'} className="aspect-square w-full object-cover" loading="lazy" />
                </a>
                {f.descripcion && (
                  <p className="px-2 py-1.5 text-xs text-[#374151]">{f.descripcion}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comentario del cliente → WhatsApp del taller */}
      <ComentarWhatsapp telefono={a.taller.telefono} numeroOt={a.numero_ot} vehiculoLabel={veh || null} />

      <p className="mt-8 text-center text-xs text-[#9ca3af]">
        Este enlace muestra el avance de tu vehículo en tiempo real.
      </p>
    </div>
  )
}
