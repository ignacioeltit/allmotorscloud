'use client'

// Datos de la empresa (taller): nombre, RUT, contacto, dirección y logo.
// Aparecen en la cabecera de los documentos (cotización, OT, comprobante).
// Solo admin (RLS organizaciones_update). El logo se sube al bucket público
// `branding` y se guarda su URL en logo_url.

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { actualizarOrganizacion, subirLogo } from '@/modules/org/mutations'
import type { OrganizacionInfo } from '@/modules/org/queries'
import { inputClass, labelClass, btnPrimary, btnSecondary } from '@/components/ui/styles'
import { toErrorMessage } from '@/lib/ui/error-message'

interface Campos {
  nombre: string
  rut: string
  telefono: string
  email: string
  direccion: string
  ciudad: string
}

export function EmpresaSettingsClient({ initial }: { initial: OrganizacionInfo }) {
  const [campos, setCampos] = useState<Campos>({
    nombre: initial.nombre ?? '',
    rut: initial.rut ?? '',
    telefono: initial.telefono ?? '',
    email: initial.email ?? '',
    direccion: initial.direccion ?? '',
    ciudad: initial.ciudad ?? '',
  })
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logo_url)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement | null>(null)

  function set<K extends keyof Campos>(k: K, v: string) {
    setSaved(false)
    setCampos((prev) => ({ ...prev, [k]: v }))
  }

  async function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2_097_152) { setError('El logo no puede superar 2 MB.'); return }
    setError(null)
    setSubiendoLogo(true)
    try {
      const url = await subirLogo(createClient(), file)
      setLogoUrl(url)
      setSaved(false)
      // Persistir de inmediato el logo (además del guardado general).
      await actualizarOrganizacion(createClient(), { ...campos, logo_url: url })
      setSaved(true)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setSubiendoLogo(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function guardar() {
    setError(null)
    setSaved(false)
    if (!campos.nombre.trim()) { setError('El nombre de la empresa es obligatorio.'); return }
    startTransition(async () => {
      try {
        await actualizarOrganizacion(createClient(), { ...campos, logo_url: logoUrl ?? '' })
        setSaved(true)
      } catch (err) {
        setError(toErrorMessage(err))
      }
    })
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Logo */}
      <section className="rounded-xl border border-black/[0.06] bg-neutral-900/50 p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">Logo</p>
        <div className="flex items-center gap-5">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/[0.08] bg-white">
            {logoUrl ? (
              <Image src={logoUrl} alt="Logo" width={96} height={96} className="h-full w-full object-contain" unoptimized />
            ) : (
              <span className="text-[11px] text-neutral-400">Sin logo</span>
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={onLogoFile}
              className="hidden"
            />
            <button type="button" className={btnSecondary} disabled={subiendoLogo} onClick={() => fileRef.current?.click()}>
              {subiendoLogo ? 'Subiendo…' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
            </button>
            {logoUrl && (
              <button
                type="button"
                className="ml-2 text-xs text-red-700 hover:text-red-800"
                disabled={subiendoLogo || pending}
                onClick={() => { setLogoUrl(null); setSaved(false) }}
              >
                Quitar
              </button>
            )}
            <p className="text-[11px] text-neutral-600">PNG, JPG, WEBP o SVG · máx 2 MB.</p>
          </div>
        </div>
      </section>

      {/* Datos */}
      <section className="rounded-xl border border-black/[0.06] bg-neutral-900/50 p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">Datos de la empresa</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nombre / Razón social *</label>
            <input className={inputClass} value={campos.nombre} onChange={(e) => set('nombre', e.target.value)} disabled={pending} />
          </div>
          <div>
            <label className={labelClass}>RUT</label>
            <input className={inputClass} value={campos.rut} onChange={(e) => set('rut', e.target.value)} placeholder="76.123.456-7" disabled={pending} />
          </div>
          <div>
            <label className={labelClass}>Teléfono</label>
            <input className={inputClass} value={campos.telefono} onChange={(e) => set('telefono', e.target.value)} disabled={pending} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input className={inputClass} type="email" value={campos.email} onChange={(e) => set('email', e.target.value)} disabled={pending} />
          </div>
          <div>
            <label className={labelClass}>Ciudad</label>
            <input className={inputClass} value={campos.ciudad} onChange={(e) => set('ciudad', e.target.value)} disabled={pending} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Dirección</label>
            <input className={inputClass} value={campos.direccion} onChange={(e) => set('direccion', e.target.value)} disabled={pending} />
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-800">{error}</p>
      )}
      {saved && !error && (
        <p className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-800">
          Datos de la empresa guardados.
        </p>
      )}

      <button type="button" className={btnPrimary} onClick={guardar} disabled={pending || subiendoLogo}>
        {pending ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  )
}
