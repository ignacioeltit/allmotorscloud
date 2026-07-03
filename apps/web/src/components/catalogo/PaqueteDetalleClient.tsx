'use client'

// Detalle de un paquete: datos editables + surtido de ítems (servicios,
// repuestos, insumos). Las líneas nuevas se cargan por lote con autocompletado
// del catálogo (mano de obra) o del inventario (materiales), o texto libre.

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  actualizarPlantilla,
  addItemsPlantilla,
  eliminarItemPlantilla,
  type NuevoItemPlantilla,
} from '@/modules/plantillas/mutations'
import type { PlantillaAdmin, ItemPlantilla } from '@/modules/plantillas/queries'
import { BuscadorLineaCatalogo } from '@/components/estimates/BuscadorLineaCatalogo'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, labelClass, btnPrimary, btnGhost } from '@/components/ui/styles'

const TIPO_LABEL: Record<ItemPlantilla['tipo'], string> = {
  labor: 'Mano de obra',
  material: 'Repuesto / material',
  other: 'Otros / insumo',
}

const inputCell =
  'w-full rounded-md border border-black/10 bg-neutral-950/60 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-accent-500/60 focus:outline-none focus:ring-1 focus:ring-accent-500/25'

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

interface FilaNueva {
  tipo: NuevoItemPlantilla['tipo']
  nombre: string
  cantidad: string
  precio: string
}

function filaVacia(): FilaNueva {
  return { tipo: 'labor', nombre: '', cantidad: '1', precio: '' }
}

export function PaqueteDetalleClient({
  plantilla,
  items,
}: {
  plantilla: PlantillaAdmin
  items: ItemPlantilla[]
}) {
  const router = useRouter()

  // ── Datos del paquete ──────────────────────────────────────────────────────
  const [nombre, setNombre] = useState(plantilla.nombre)
  const [codigo, setCodigo] = useState(plantilla.codigo ?? '')
  const [tipoPrecio, setTipoPrecio] = useState(plantilla.tipo_precio as 'suma_items' | 'cabecera')
  const [precioCabecera, setPrecioCabecera] = useState(
    plantilla.precio_cabecera != null ? String(plantilla.precio_cabecera) : '',
  )
  const [guardandoDatos, setGuardandoDatos] = useState(false)
  const [errorDatos, setErrorDatos] = useState<string | null>(null)
  const [datosOk, setDatosOk] = useState(false)

  // ── Líneas nuevas ──────────────────────────────────────────────────────────
  const [filas, setFilas] = useState<FilaNueva[]>(() => Array.from({ length: 3 }, filaVacia))
  const [guardandoFilas, setGuardandoFilas] = useState(false)
  const [errorFilas, setErrorFilas] = useState<string | null>(null)
  const [borrando, setBorrando] = useState<string | null>(null)
  const okTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sumaItems = items.filter((i) => !i.es_cabecera).reduce(
    (acc, i) => acc + Math.round(i.cantidad * (i.precio_unitario ?? 0)),
    0,
  )

  async function guardarDatos() {
    setGuardandoDatos(true)
    setErrorDatos(null)
    try {
      await actualizarPlantilla(createClient(), plantilla.id, {
        nombre,
        codigo: codigo.trim() || null,
        tipoPrecio,
        precioCabecera: tipoPrecio === 'cabecera' ? parseFloat(precioCabecera) || 0 : null,
      })
      setDatosOk(true)
      if (okTimer.current) clearTimeout(okTimer.current)
      okTimer.current = setTimeout(() => setDatosOk(false), 2000)
      router.refresh()
    } catch (e) {
      setErrorDatos(toErrorMessage(e))
    } finally {
      setGuardandoDatos(false)
    }
  }

  async function toggleActivo() {
    setGuardandoDatos(true)
    setErrorDatos(null)
    try {
      await actualizarPlantilla(createClient(), plantilla.id, { activo: !plantilla.activo })
      router.refresh()
    } catch (e) {
      setErrorDatos(toErrorMessage(e))
    } finally {
      setGuardandoDatos(false)
    }
  }

  function setFila(i: number, cambios: Partial<FilaNueva>) {
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...cambios } : f)))
  }

  const filasConDatos = filas.filter(
    (f) => f.nombre.trim() && !isNaN(parseFloat(f.cantidad)) && parseFloat(f.cantidad) > 0,
  )

  async function guardarFilas() {
    if (filasConDatos.length === 0) {
      setErrorFilas('Completa al menos una línea (nombre y cantidad).')
      return
    }
    setGuardandoFilas(true)
    setErrorFilas(null)
    try {
      await addItemsPlantilla(
        createClient(),
        plantilla.id,
        filasConDatos.map((f) => ({
          tipo: f.tipo,
          nombre: f.nombre,
          cantidad: parseFloat(f.cantidad),
          precioUnitario: parseFloat(f.precio) || 0,
        })),
      )
      setFilas(Array.from({ length: 3 }, filaVacia))
      router.refresh()
    } catch (e) {
      setErrorFilas(toErrorMessage(e))
    } finally {
      setGuardandoFilas(false)
    }
  }

  async function quitarItem(id: string) {
    setBorrando(id)
    setErrorFilas(null)
    try {
      await eliminarItemPlantilla(createClient(), id)
      router.refresh()
    } catch (e) {
      setErrorFilas(toErrorMessage(e))
    } finally {
      setBorrando(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Datos del paquete ── */}
      <section className={card}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className={sectionLabel}>Paquete</p>
          <button
            onClick={() => void toggleActivo()}
            disabled={guardandoDatos}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              plantilla.activo
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20'
                : 'border-black/10 bg-black/[0.04] text-neutral-500 hover:bg-black/[0.08]'
            }`}
            title={plantilla.activo ? 'Click para desactivar' : 'Click para activar'}
          >
            {plantilla.activo ? 'Activo — se ofrece al cargar líneas' : 'Inactivo — oculto'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Nombre *</label>
            <input className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Código</label>
            <input className={inputClass} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Precio del paquete</label>
            <select className={inputClass} value={tipoPrecio} onChange={(e) => setTipoPrecio(e.target.value as 'suma_items' | 'cabecera')}>
              <option value="suma_items">Suma de los ítems ({fmtCLP(sumaItems)})</option>
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

        {errorDatos && <p className="mt-3 text-sm text-red-800">{errorDatos}</p>}
        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => void guardarDatos()} disabled={guardandoDatos || !nombre.trim()} className={btnPrimary}>
            {guardandoDatos ? 'Guardando…' : 'Guardar datos'}
          </button>
          {datosOk && <span className="text-sm text-emerald-700">Guardado ✓</span>}
        </div>
      </section>

      {/* ── Surtido actual ── */}
      <section className={`${card} space-y-3`}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Surtido del paquete</p>
          <p className="text-sm text-neutral-400">
            {items.length} ítem{items.length === 1 ? '' : 's'}
            {tipoPrecio === 'suma_items' && items.length > 0 ? ` · ${fmtCLP(sumaItems)}` : ''}
          </p>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Este paquete está vacío: no aparece en «+ Agregar paquete» hasta que cargues sus líneas.
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-3 rounded-lg border border-black/[0.05] bg-black/[0.02] px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="mr-2 rounded-full border border-black/[0.08] bg-black/[0.04] px-2 py-0.5 text-[10px] text-neutral-500">
                    {TIPO_LABEL[it.tipo] ?? it.tipo}
                  </span>
                  <span className="text-neutral-300">{it.nombre}</span>
                  {it.cantidad !== 1 && <span className="ml-2 text-xs text-neutral-500">× {it.cantidad}</span>}
                  {it.es_cabecera && <span className="ml-2 text-[10px] uppercase text-amber-700">cabecera</span>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-medium text-neutral-200">
                    {fmtCLP(Math.round(it.cantidad * (it.precio_unitario ?? 0)))}
                  </span>
                  <button
                    onClick={() => void quitarItem(it.id)}
                    disabled={borrando === it.id}
                    className={`${btnGhost} px-2 py-1 text-red-700 hover:text-red-800`}
                    title="Quitar del paquete"
                  >
                    {borrando === it.id ? '…' : '×'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Agregar líneas ── */}
      <section className={`${card} space-y-3`}>
        <p className={sectionLabel}>Agregar líneas al paquete</p>
        <div className="overflow-x-auto rounded-lg border border-black/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] bg-black/[0.02] text-left text-[10px] uppercase tracking-wider text-neutral-500">
                <th className="w-44 px-2 py-2 font-medium">Tipo</th>
                <th className="px-2 py-2 font-medium">Descripción</th>
                <th className="w-20 px-2 py-2 font-medium">Cant.</th>
                <th className="w-28 px-2 py-2 font-medium">Precio</th>
                <th className="w-8 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i} className="border-b border-black/[0.03] last:border-0">
                  <td className="px-2 py-1.5">
                    <select
                      className={inputCell}
                      value={f.tipo}
                      onChange={(e) => setFila(i, { tipo: e.target.value as FilaNueva['tipo'] })}
                    >
                      <option value="labor">Mano de obra</option>
                      <option value="material">Repuesto / material</option>
                      <option value="other">Otros / insumo</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    {f.tipo === 'other' ? (
                      <input
                        className={inputCell}
                        placeholder={i === 0 ? 'Ej: Insumos, grasa, silicona…' : ''}
                        value={f.nombre}
                        onChange={(e) => setFila(i, { nombre: e.target.value })}
                      />
                    ) : (
                      <BuscadorLineaCatalogo
                        grupo={f.tipo === 'labor' ? 'mano_obra' : 'repuesto'}
                        className={inputCell}
                        placeholder={i === 0 ? 'Buscar en catálogo/inventario o escribir…' : ''}
                        value={f.nombre}
                        onChangeText={(text) => setFila(i, { nombre: text })}
                        onPick={(s) => setFila(i, { nombre: s.descripcion, cantidad: String(s.cantidad), ...(s.precio != null ? { precio: String(s.precio) } : {}) })}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min="0" step="any" className={inputCell} value={f.cantidad} onChange={(e) => setFila(i, { cantidad: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min="0" step="1" placeholder="0" className={inputCell} value={f.precio} onChange={(e) => setFila(i, { precio: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {filas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFilas((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-neutral-500 hover:text-red-700"
                        aria-label="Quitar línea"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setFilas((prev) => [...prev, filaVacia()])} className={`${btnGhost} text-xs`}>
            + Agregar línea
          </button>
          <div className="flex items-center gap-3">
            {errorFilas && <p className="text-xs text-red-800">{errorFilas}</p>}
            <button onClick={() => void guardarFilas()} disabled={guardandoFilas || filasConDatos.length === 0} className={btnPrimary}>
              {guardandoFilas ? 'Guardando…' : `Guardar ${filasConDatos.length || ''} línea${filasConDatos.length === 1 ? '' : 's'}`.trim()}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
