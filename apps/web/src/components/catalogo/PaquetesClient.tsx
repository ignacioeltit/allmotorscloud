'use client'

// Listado + alta de paquetes de trabajo. La gestión del surtido (ítems) vive en
// el detalle (/catalogo/paquetes/[id]).

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { crearPlantilla } from '@/modules/plantillas/mutations'
import type { PlantillaAdmin } from '@/modules/plantillas/queries'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, labelClass, btnPrimary, btnSecondary } from '@/components/ui/styles'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

export function PaquetesClient({ paquetes }: { paquetes: PlantillaAdmin[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [tipoPrecio, setTipoPrecio] = useState<'suma_items' | 'cabecera'>('suma_items')
  const [precioCabecera, setPrecioCabecera] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear() {
    setGuardando(true)
    setError(null)
    try {
      const { id } = await crearPlantilla(createClient(), {
        nombre,
        ...(codigo.trim() ? { codigo } : {}),
        tipoPrecio,
        precioCabecera: tipoPrecio === 'cabecera' ? parseFloat(precioCabecera) || 0 : null,
      })
      router.push(`/catalogo/paquetes/${id}`)
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className={`${card} p-0`}>
        <table className="w-full text-sm">
          <thead className="border-b border-black/[0.06] bg-black/[0.02] text-left text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Precio</th>
              <th className="px-4 py-3 text-right font-medium">Ítems</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {paquetes.map((p) => (
              <tr key={p.id} className="border-b border-black/[0.04] transition-colors last:border-0 hover:bg-black/[0.03]">
                <td className="px-4 py-3 font-mono text-xs text-neutral-500">{p.codigo ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-neutral-100">{p.nombre}</td>
                <td className="px-4 py-3 text-neutral-400">
                  {p.tipo_precio === 'cabecera'
                    ? `${fmtCLP(p.precio_cabecera ?? 0)} (precio único)`
                    : 'Suma de ítems'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-300">
                  {p.n_items === 0 ? (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800">
                      vacío
                    </span>
                  ) : (
                    p.n_items
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      p.activo
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800'
                        : 'border-black/10 bg-black/[0.04] text-neutral-500'
                    }`}
                  >
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/catalogo/paquetes/${p.id}`} className="text-accent-400 hover:text-accent-300">
                    Editar →
                  </Link>
                </td>
              </tr>
            ))}
            {paquetes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-neutral-500">
                  Aún no hay paquetes. Crea el primero.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {showForm ? (
        <section className={card}>
          <p className={`${sectionLabel} mb-4`}>Nuevo paquete</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Nombre *</label>
              <input autoFocus className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Mantención 10.000 km" />
            </div>
            <div>
              <label className={labelClass}>Código (opcional)</label>
              <input className={inputClass} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej: MANT10K" />
            </div>
            <div>
              <label className={labelClass}>Precio del paquete</label>
              <select className={inputClass} value={tipoPrecio} onChange={(e) => setTipoPrecio(e.target.value as 'suma_items' | 'cabecera')}>
                <option value="suma_items">Suma de los ítems</option>
                <option value="cabecera">Precio único (los ítems son detalle)</option>
              </select>
            </div>
            {tipoPrecio === 'cabecera' && (
              <div>
                <label className={labelClass}>Precio único (CLP) *</label>
                <input type="number" min="0" step="1" className={inputClass} value={precioCabecera} onChange={(e) => setPrecioCabecera(e.target.value)} />
              </div>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={() => void crear()} disabled={guardando || !nombre.trim()} className={btnPrimary}>
              {guardando ? 'Creando…' : 'Crear y cargar ítems →'}
            </button>
            <button onClick={() => setShowForm(false)} disabled={guardando} className={btnSecondary}>
              Cancelar
            </button>
          </div>
        </section>
      ) : (
        <button onClick={() => setShowForm(true)} className={btnPrimary}>
          + Nuevo paquete
        </button>
      )}
    </div>
  )
}
