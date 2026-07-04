'use client'

// Vista pública de una cotización (sin login). El cliente ve el documento y
// puede autorizar o rechazar, dejar una nota e indicar que quiere agendar.
// Toda la interacción pasa por la RPC fn_responder_cotizacion (gatillada por
// token); una vez respondida, queda bloqueada.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ordenarItemsPorTipo } from '@/lib/ui/ordenar-items'

export interface CotizacionPublica {
  estado: string
  creado_en: string
  total_mano_obra: number
  total_repuestos: number
  total_otros: number
  total_neto: number
  nota_cliente: string | null
  agendar_solicitado: boolean
  taller: { nombre: string | null; rut: string | null; telefono: string | null; direccion: string | null; ciudad: string | null }
  cliente: { nombre: string | null }
  vehiculo: { patente: string | null; marca: string | null; modelo: string | null; anio: number | null }
  items: Array<{ tipo: string; descripcion: string; cantidad: number; precio_total: number }>
}

const IVA = 0.19
const TIPO_LABEL: Record<string, string> = { mano_obra: 'Mano de obra', repuesto: 'Repuesto', otros: 'Otros' }

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

export function CotizacionPublicaClient({ token, inicial }: { token: string; inicial: CotizacionPublica }) {
  const [coti, setCoti] = useState(inicial)
  const [nota, setNota] = useState('')
  const [agendar, setAgendar] = useState(false)
  const [enviando, setEnviando] = useState<null | 'autorizar' | 'rechazar'>(null)
  const [error, setError] = useState<string | null>(null)

  const iva = Math.round(coti.total_neto * IVA)
  const total = coti.total_neto + iva
  const fecha = new Date(coti.creado_en).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
  const respondida = coti.estado === 'autorizado' || coti.estado === 'rechazado'

  async function responder(accion: 'autorizar' | 'rechazar') {
    setEnviando(accion)
    setError(null)
    try {
      const { data, error: e } = await createClient().rpc('fn_responder_cotizacion', {
        p_token: token,
        p_accion: accion,
        p_nota: nota.trim() || null,
        p_agendar: agendar,
      })
      if (e) throw new Error(e.message)
      const res = data as { ok?: boolean; estado?: string; error?: string }
      if (res.error) {
        setError(res.error === 'ya_respondida' ? 'Esta cotización ya fue respondida.' : 'No se pudo registrar la respuesta.')
        if (res.estado) setCoti((c) => ({ ...c, estado: res.estado! }))
        return
      }
      setCoti((c) => ({ ...c, estado: res.estado!, nota_cliente: nota.trim() || null, agendar_solicitado: agendar }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar la respuesta.')
    } finally {
      setEnviando(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-[#111827]">
      <div className="no-print mb-4 flex justify-end">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#f9fafb]"
        >
          Descargar PDF
        </button>
      </div>

      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm sm:p-8">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] pb-5">
          <div>
            <h1 className="text-lg font-semibold">{coti.taller.nombre ?? 'Taller'}</h1>
            <div className="mt-1 space-y-0.5 text-xs text-[#6b7280]">
              {coti.taller.rut && <p>RUT {coti.taller.rut}</p>}
              {(coti.taller.telefono || coti.taller.direccion) && (
                <p>{[coti.taller.telefono, coti.taller.direccion, coti.taller.ciudad].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#ea580c]">Cotización</p>
            <p className="mt-1 text-xs text-[#6b7280]">{fecha}</p>
          </div>
        </div>

        {/* Cliente + vehículo */}
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Cliente</p>
            <p className="mt-1 font-medium">{coti.cliente.nombre ?? '—'}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Vehículo</p>
            <p className="mt-1 font-medium">
              {[coti.vehiculo.patente, coti.vehiculo.marca, coti.vehiculo.modelo].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>

        {/* Ítems */}
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-[#e5e7eb] text-left text-[11px] uppercase tracking-wide text-[#9ca3af]">
              <th className="py-2 font-medium">Detalle</th>
              <th className="w-14 py-2 text-right font-medium">Cant.</th>
              <th className="w-28 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {ordenarItemsPorTipo(coti.items).map((it, i) => (
              <tr key={i} className="border-b border-[#f3f4f6]">
                <td className="py-2">
                  <span>{it.descripcion}</span>
                  <span className="ml-2 text-[10px] uppercase text-[#9ca3af]">{TIPO_LABEL[it.tipo] ?? it.tipo}</span>
                </td>
                <td className="py-2 text-right text-[#4b5563]">{it.cantidad}</td>
                <td className="py-2 text-right font-medium">{fmtCLP(it.precio_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="mt-4 flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between text-[#4b5563]"><span>Neto</span><span>{fmtCLP(coti.total_neto)}</span></div>
            <div className="flex justify-between text-[#4b5563]"><span>IVA (19%)</span><span>{fmtCLP(iva)}</span></div>
            <div className="flex justify-between border-t border-[#d1d5db] pt-1.5 text-base font-semibold">
              <span>Total</span><span>{fmtCLP(total)}</span>
            </div>
          </div>
        </div>

        {/* Respuesta del cliente — no se imprime en el PDF */}
        <div className={`mt-8 border-t border-[#e5e7eb] pt-6 ${respondida ? '' : 'no-print'}`}>
          {respondida ? (
            <div
              className={`rounded-xl border p-4 text-sm ${
                coti.estado === 'autorizado'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-red-300 bg-red-50 text-red-800'
              }`}
            >
              <p className="font-semibold">
                {coti.estado === 'autorizado' ? '✓ Cotización autorizada' : 'Cotización rechazada'}
              </p>
              <p className="mt-1">
                Gracias por tu respuesta. {coti.estado === 'autorizado' ? 'El taller se contactará contigo.' : ''}
              </p>
              {coti.agendar_solicitado && (
                <p className="mt-1 font-medium">Indicaste que quieres agendar — el taller coordinará contigo.</p>
              )}
              {coti.nota_cliente && <p className="mt-2 text-[#4b5563]">Tu nota: “{coti.nota_cliente}”</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#374151]">Nota (opcional)</label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-orange-100"
                  placeholder="Ej: prefiero coordinar para la próxima semana"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-[#374151]">
                <input type="checkbox" checked={agendar} onChange={(e) => setAgendar(e.target.checked)} className="h-4 w-4" />
                Quiero agendar una hora para dejar el vehículo
              </label>

              {error && <p className="text-sm text-red-700">{error}</p>}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => void responder('autorizar')}
                  disabled={enviando !== null}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                >
                  {enviando === 'autorizar' ? 'Enviando…' : 'Autorizar cotización'}
                </button>
                <button
                  onClick={() => void responder('rechazar')}
                  disabled={enviando !== null}
                  className="flex-1 rounded-lg border border-[#d1d5db] px-4 py-3 text-sm font-medium text-[#374151] transition-colors hover:bg-[#f9fafb] disabled:opacity-50"
                >
                  {enviando === 'rechazar' ? 'Enviando…' : 'Rechazar'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-[#9ca3af]">
          Cotización referencial sujeta a revisión del vehículo. Valores en pesos chilenos.
        </p>
      </div>
    </div>
  )
}
