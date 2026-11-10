'use client'

// Asocia un vehículo (y cliente, si falta) a una cotización creada con datos
// mínimos. Busca por patente: si existe, la vincula; si no, captura el vehículo
// nuevo. Deja la cotización lista para convertir a OT.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getVehiculoByPatente } from '@/modules/vehicles/queries'
import { asociarVehiculoCotizacion } from '@/modules/estimates/mutations'
import { TIPOS_VEHICULO } from '@/modules/vehicles/constants'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, inputClass, labelClass, sectionLabel, btnPrimary, btnSecondary } from '@/components/ui/styles'

type Modo = 'buscar' | 'nuevo'

export function AsociarVehiculoSection({
  presupuestoId,
  tieneCliente,
}: {
  presupuestoId: string
  tieneCliente: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [modo, setModo] = useState<Modo>('buscar')
  const [patente, setPatente] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Vehículo nuevo
  const [vMarca, setVMarca] = useState('')
  const [vModelo, setVModelo] = useState('')
  const [vTipo, setVTipo] = useState<(typeof TIPOS_VEHICULO)[number]>('auto')
  const [vAnio, setVAnio] = useState('')
  // Cliente nuevo (solo si la cotización no tiene cliente)
  const [cNombre, setCNombre] = useState('')
  const [cTelefono, setCTelefono] = useState('')

  async function onBuscar(e: FormEvent) {
    e.preventDefault()
    const q = patente.trim()
    if (!q) return
    setBuscando(true)
    setError(null)
    try {
      const v = await getVehiculoByPatente(createClient(), q)
      if (v) {
        await asociar({ vehiculoId: v.id })
      } else {
        setPatente(q.toUpperCase())
        setModo('nuevo')
      }
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBuscando(false)
    }
  }

  async function asociar(args: { vehiculoId?: string }) {
    setGuardando(true)
    setError(null)
    try {
      await asociarVehiculoCotizacion(createClient(), {
        presupuestoId,
        ...(args.vehiculoId
          ? { vehiculoId: args.vehiculoId }
          : {
              vehiculo: {
                patente: patente.trim().toUpperCase(),
                marca: vMarca.trim(),
                modelo: vModelo.trim(),
                tipo: vTipo,
                ...(vAnio.trim() ? { anio: vAnio.trim() } : {}),
              },
            }),
        ...(!tieneCliente && (cNombre.trim() || cTelefono.trim())
          ? {
              cliente: {
                nombre: cNombre.trim() || (cTelefono.trim() ? `Cliente ${cTelefono.trim()}` : 'Cliente'),
                ...(cTelefono.trim() ? { telefono: cTelefono.trim() } : {}),
              },
            }
          : {}),
      })
      router.refresh()
    } catch (err) {
      setError(toErrorMessage(err))
      setGuardando(false)
    }
  }

  const puedeCrear = Boolean(patente.trim() && vMarca.trim() && vModelo.trim())

  if (!abierto) {
    return (
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <p className="text-sm font-medium text-neutral-100">Esta cotización no tiene vehículo asignado</p>
          <p className="mt-0.5 text-xs text-neutral-500">Asócialo para confirmar insumos y poder convertirla en OT.</p>
        </div>
        <button type="button" onClick={() => setAbierto(true)} className={btnPrimary}>
          + Asociar vehículo
        </button>
      </div>
    )
  }

  return (
    <section className={`${card} space-y-4`}>
      <div className="flex items-center justify-between">
        <p className={sectionLabel}>Asociar vehículo</p>
        <button type="button" onClick={() => { setAbierto(false); setModo('buscar'); setError(null) }} className={btnSecondary}>
          Cancelar
        </button>
      </div>

      {modo === 'buscar' ? (
        <form onSubmit={onBuscar} className="space-y-2">
          <label className={labelClass}>Patente</label>
          <input autoFocus value={patente} onChange={(e) => setPatente(e.target.value)} placeholder="ABCD12" className={inputClass} />
          <p className="text-xs text-neutral-600">
            {buscando || guardando ? 'Buscando…' : 'Escribe la patente y presiona Enter. Si no existe, la registras.'}
          </p>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Patente</label>
              <input className={inputClass} value={patente} onChange={(e) => setPatente(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Marca</label>
              <input className={inputClass} value={vMarca} onChange={(e) => setVMarca(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Modelo</label>
              <input className={inputClass} value={vModelo} onChange={(e) => setVModelo(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Año</label>
              <input type="number" className={inputClass} value={vAnio} onChange={(e) => setVAnio(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Tipo</label>
              <select className={inputClass} value={vTipo} onChange={(e) => setVTipo(e.target.value as (typeof TIPOS_VEHICULO)[number])}>
                {TIPOS_VEHICULO.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {!tieneCliente && (
            <div className="grid grid-cols-1 gap-3 border-t border-black/[0.06] pt-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Nombre del cliente (opcional)</label>
                <input className={inputClass} value={cNombre} onChange={(e) => setCNombre(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Teléfono (opcional)</label>
                <input className={inputClass} value={cTelefono} onChange={(e) => setCTelefono(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void asociar({})} disabled={!puedeCrear || guardando} className={btnPrimary}>
              {guardando ? 'Asociando…' : 'Asociar vehículo →'}
            </button>
            <button type="button" onClick={() => setModo('buscar')} className={btnSecondary}>Volver</button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  )
}
