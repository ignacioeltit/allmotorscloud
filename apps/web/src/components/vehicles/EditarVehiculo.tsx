'use client'

// Edición de un vehículo ya creado (patente, marca, modelo, año, color,
// cilindrada, tipo, VIN, km, notas). Solo gestión. Usa updateVehiculo.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateVehiculo } from '@/modules/vehicles/mutations'
import { TIPOS_VEHICULO, type TipoVehiculo } from '@/modules/vehicles/constants'
import type { Vehiculo } from '@/modules/vehicles/types'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, labelClass, btnPrimary, btnSecondary } from '@/components/ui/styles'

const TIPO_LABEL: Record<string, string> = {
  auto: 'Auto', camioneta: 'Camioneta', moto: 'Moto', furgon: 'Furgón', camion: 'Camión', otro: 'Otro',
}

export function EditarVehiculo({ vehiculo, puedeGestionar }: { vehiculo: Vehiculo; puedeGestionar: boolean }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [f, setF] = useState({
    patente: vehiculo.patente,
    marca: vehiculo.marca,
    modelo: vehiculo.modelo,
    tipo: vehiculo.tipo as TipoVehiculo,
    anio: vehiculo.anio != null ? String(vehiculo.anio) : '',
    color: vehiculo.color ?? '',
    cilindrada: vehiculo.cilindrada ?? '',
    vin: vehiculo.vin ?? '',
    km_actual: vehiculo.km_actual != null ? String(vehiculo.km_actual) : '',
    notas: vehiculo.notas ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof typeof f>(k: K, v: string) { setF((p) => ({ ...p, [k]: v })) }

  async function guardar() {
    setError(null)
    if (!f.patente.trim() || !f.marca.trim() || !f.modelo.trim()) {
      setError('Patente, marca y modelo son obligatorios.')
      return
    }
    setGuardando(true)
    try {
      const anioNum = f.anio.trim() ? parseInt(f.anio, 10) : null
      const kmNum = f.km_actual.trim() ? parseInt(f.km_actual, 10) : null
      await updateVehiculo(createClient(), vehiculo.id, {
        patente: f.patente.trim(),
        marca: f.marca.trim(),
        modelo: f.modelo.trim(),
        tipo: f.tipo,
        anio: anioNum,
        color: f.color.trim() || null,
        cilindrada: f.cilindrada.trim() || null,
        vin: f.vin.trim() || null,
        km_actual: kmNum,
        notas: f.notas.trim() || null,
      })
      setEditando(false)
      router.refresh()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setGuardando(false)
    }
  }

  if (!editando) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className={sectionLabel}>Datos del vehículo</p>
        {puedeGestionar && (
          <button type="button" className={btnSecondary} onClick={() => setEditando(true)}>Editar datos</button>
        )}
      </div>
    )
  }

  return (
    <section className={`${card} space-y-4`}>
      <p className={sectionLabel}>Editar vehículo</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label className={labelClass}>Patente *</label><input className={inputClass} value={f.patente} onChange={(e) => set('patente', e.target.value)} disabled={guardando} /></div>
        <div><label className={labelClass}>Tipo</label>
          <select className={inputClass} value={f.tipo} onChange={(e) => set('tipo', e.target.value)} disabled={guardando}>
            {TIPOS_VEHICULO.map((t) => <option key={t} value={t}>{TIPO_LABEL[t] ?? t}</option>)}
          </select>
        </div>
        <div><label className={labelClass}>Marca *</label><input className={inputClass} value={f.marca} onChange={(e) => set('marca', e.target.value)} disabled={guardando} /></div>
        <div><label className={labelClass}>Modelo *</label><input className={inputClass} value={f.modelo} onChange={(e) => set('modelo', e.target.value)} disabled={guardando} /></div>
        <div><label className={labelClass}>Año</label><input type="number" className={inputClass} value={f.anio} onChange={(e) => set('anio', e.target.value)} disabled={guardando} /></div>
        <div><label className={labelClass}>Cilindrada / motor</label><input className={inputClass} placeholder="ej: 2.0 · 1600cc · V8 5.3L" value={f.cilindrada} onChange={(e) => set('cilindrada', e.target.value)} disabled={guardando} /></div>
        <div><label className={labelClass}>Color</label><input className={inputClass} value={f.color} onChange={(e) => set('color', e.target.value)} disabled={guardando} /></div>
        <div><label className={labelClass}>Kilometraje</label><input type="number" className={inputClass} value={f.km_actual} onChange={(e) => set('km_actual', e.target.value)} disabled={guardando} /></div>
        <div><label className={labelClass}>VIN</label><input className={inputClass} value={f.vin} onChange={(e) => set('vin', e.target.value)} disabled={guardando} /></div>
        <div className="sm:col-span-2"><label className={labelClass}>Notas</label><input className={inputClass} value={f.notas} onChange={(e) => set('notas', e.target.value)} disabled={guardando} /></div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnPrimary} onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button type="button" className={btnSecondary} onClick={() => setEditando(false)} disabled={guardando}>Cancelar</button>
      </div>
    </section>
  )
}
