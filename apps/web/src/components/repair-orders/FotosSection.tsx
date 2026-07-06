'use client'

// Fotos de avance de la OT: subir desde el celular/computador, marcar cuáles ve
// el cliente, y compartir un link de seguimiento (público, por token).

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  subirFotoOT, toggleVisibleCliente, eliminarFotoOT, generarTokenAvance, urlFoto,
  type FotoOT,
} from '@/modules/evidencias'
import { toErrorMessage } from '@/lib/ui/error-message'
import { card, sectionLabel, btnSecondary } from '@/components/ui/styles'

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
        nuevas.push(await subirFotoOT(supabase, ordenTrabajoId, file))
      }
      setFotos((prev) => [...nuevas, ...prev])
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

      {error && <p className="text-sm text-red-700">{error}</p>}

      {fotos.length === 0 ? (
        <p className="text-sm text-neutral-500">Aún no hay fotos. Subí fotos del avance para mostrárselas al cliente.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {fotos.map((f) => (
            <div key={f.id} className="group relative overflow-hidden rounded-lg border border-black/[0.06] bg-black/[0.02]">
              <a href={urlFoto(f.bucket_path)} target="_blank" rel="noopener noreferrer" className="block aspect-square">
                <Image src={urlFoto(f.bucket_path)} alt={f.descripcion ?? 'Foto'} width={300} height={300} unoptimized className="h-full w-full object-cover" />
              </a>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-2 py-1 text-[11px] text-white">
                {puedeGestionar ? (
                  <button type="button" onClick={() => void toggle(f)} className="hover:underline">
                    {f.visible_cliente ? '👁 Cliente ve' : '🔒 Interna'}
                  </button>
                ) : (
                  <span>{f.visible_cliente ? '👁 Cliente ve' : '🔒 Interna'}</span>
                )}
                {puedeGestionar && (
                  <button type="button" onClick={() => void borrar(f)} className="text-red-300 hover:text-red-200" title="Eliminar">✕</button>
                )}
              </div>
            </div>
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
