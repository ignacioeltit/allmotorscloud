'use client'

// Fotos de avance de la OT: subir desde el celular/computador, marcar cuáles ve
// el cliente, y compartir un link de seguimiento (público, por token).

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  subirFotoOT, toggleVisibleCliente, eliminarFotoOT, generarTokenAvance, urlFoto,
  actualizarDescripcionFoto, type FotoOT,
} from '@/modules/evidencias'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, inputClass, btnSecondary } from '@/components/ui/styles'

export function FotosSection({
  ordenTrabajoId,
  initialFotos,
  tokenInicial,
  puedeGestionar,
}: {
  ordenTrabajoId: string
  initialFotos: FotoOT[]
  tokenInicial: string | null
  puedeGestionar: boolean
}) {
  const router = useRouter()
  const [fotos, setFotos] = useState<FotoOT[]>(initialFotos)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(tokenInicial)
  const [copiado, setCopiado] = useState(false)
  const [detalle, setDetalle] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  const linkAvance = token && typeof window !== 'undefined' ? `${window.location.origin}/avance/${token}` : null
  const visiblesCount = fotos.filter((f) => f.visible_cliente).length

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setError(null)
    setSubiendo(true)
    try {
      const supabase = createClient()
      const nuevas: FotoOT[] = []
      for (const file of files) {
        if (file.size > 10_485_760) { setError(`"${file.name}" supera 10 MB.`); continue }
        nuevas.push(await subirFotoOT(supabase, ordenTrabajoId, file, detalle))
      }
      setFotos((prev) => [...nuevas, ...prev])
      setDetalle('')
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setSubiendo(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function toggle(f: FotoOT) {
    try {
      await toggleVisibleCliente(createClient(), f.id, !f.visible_cliente)
      setFotos((prev) => prev.map((x) => (x.id === f.id ? { ...x, visible_cliente: !x.visible_cliente } : x)))
    } catch (err) {
      setError(toErrorMessage(err))
    }
  }

  async function borrar(f: FotoOT) {
    if (!confirm('¿Eliminar esta foto?')) return
    try {
      await eliminarFotoOT(createClient(), f)
      setFotos((prev) => prev.filter((x) => x.id !== f.id))
    } catch (err) {
      setError(toErrorMessage(err))
    }
  }

  async function compartir() {
    try {
      const t = token ?? (await generarTokenAvance(createClient(), ordenTrabajoId))
      setToken(t)
      router.refresh()
    } catch (err) {
      setError(toErrorMessage(err))
    }
  }

  function copiar() {
    if (!linkAvance) return
    navigator.clipboard.writeText(linkAvance)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  return (
    <section className={`${card} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={sectionLabel}>Fotos del trabajo</p>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" onChange={onFiles} className="hidden" />
          <button type="button" className={btnSecondary} disabled={subiendo} onClick={() => fileRef.current?.click()}>
            {subiendo ? 'Subiendo…' : '📷 Subir fotos'}
          </button>
        </div>
      </div>

      {/* Detalle opcional para las próximas fotos que subas */}
      <input
        className={inputClass}
        placeholder="Detalle para las fotos que vas a subir (opcional): ej. 'antes de desarmar', 'pastillas gastadas'…"
        value={detalle}
        onChange={(e) => setDetalle(e.target.value)}
      />

      {error && <p className="text-sm text-red-700">{error}</p>}

      {fotos.length === 0 ? (
        <p className="text-sm text-neutral-500">Aún no hay fotos. Subí fotos del avance para mostrárselas al cliente.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {fotos.map((f) => (
            <FotoCard
              key={f.id}
              foto={f}
              puedeGestionar={puedeGestionar}
              onToggle={() => void toggle(f)}
              onBorrar={() => void borrar(f)}
              onDetalle={(txt) => setFotos((prev) => prev.map((x) => (x.id === f.id ? { ...x, descripcion: txt } : x)))}
            />
          ))}
        </div>
      )}

      {/* Compartir avance con el cliente */}
      <div className="flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-3">
        {linkAvance ? (
          <>
            <span className="text-xs text-neutral-500">Link de avance ({visiblesCount} foto{visiblesCount === 1 ? '' : 's'} visible{visiblesCount === 1 ? '' : 's'}):</span>
            <input readOnly value={linkAvance} className="min-w-[12rem] flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-neutral-700" onFocus={(e) => e.target.select()} />
            <button type="button" onClick={copiar} className={btnSecondary}>{copiado ? '✓ Copiado' : 'Copiar'}</button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent('Seguimiento de tu vehículo en el taller: ' + linkAvance)}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-500/20"
            >
              WhatsApp
            </a>
          </>
        ) : (
          <button type="button" onClick={() => void compartir()} className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500">
            🔗 Generar link de avance para el cliente
          </button>
        )}
      </div>
    </section>
  )
}

// ── Tarjeta de una foto: imagen + estado visible + detalle editable ──────
function FotoCard({
  foto,
  puedeGestionar,
  onToggle,
  onBorrar,
  onDetalle,
}: {
  foto: FotoOT
  puedeGestionar: boolean
  onToggle: () => void
  onBorrar: () => void
  onDetalle: (txt: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [txt, setTxt] = useState(foto.descripcion ?? '')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    try {
      await actualizarDescripcionFoto(createClient(), foto.id, txt)
      onDetalle(txt.trim() || '')
      setEditando(false)
    } catch {
      /* silencioso: se reintenta */
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-black/[0.06] bg-black/[0.02]">
      <div className="relative">
        <a href={urlFoto(foto.bucket_path)} target="_blank" rel="noopener noreferrer" className="block aspect-square">
          <Image src={urlFoto(foto.bucket_path)} alt={foto.descripcion ?? 'Foto'} width={300} height={300} unoptimized className="h-full w-full object-cover" />
        </a>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-2 py-1 text-[11px] text-white">
          {puedeGestionar ? (
            <button type="button" onClick={onToggle} className="hover:underline">
              {foto.visible_cliente ? '👁 Cliente ve' : '🔒 Interna'}
            </button>
          ) : (
            <span>{foto.visible_cliente ? '👁 Cliente ve' : '🔒 Interna'}</span>
          )}
          {puedeGestionar && (
            <button type="button" onClick={onBorrar} className="text-red-300 hover:text-red-200" title="Eliminar">✕</button>
          )}
        </div>
      </div>

      {/* Detalle de la foto */}
      <div className="px-2 py-1.5">
        {editando ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              className="min-w-0 flex-1 rounded border border-black/10 bg-white px-1.5 py-1 text-[11px] text-neutral-700 outline-none focus:border-accent-500"
              placeholder="Detalle…"
              value={txt}
              onChange={(e) => setTxt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void guardar(); if (e.key === 'Escape') setEditando(false) }}
              disabled={guardando}
            />
            <button type="button" onClick={() => void guardar()} disabled={guardando} className="rounded bg-accent-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
              {guardando ? '…' : 'OK'}
            </button>
          </div>
        ) : (
          // El detalle lo edita cualquiera del taller (incluido el mecánico).
          <button type="button" onClick={() => { setTxt(foto.descripcion ?? ''); setEditando(true) }} className="w-full text-left text-[11px] text-neutral-500 hover:text-neutral-300">
            {foto.descripcion ? foto.descripcion : '+ Agregar detalle'}
          </button>
        )}
      </div>
    </div>
  )
}
