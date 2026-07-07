// Diagrama de siluetas del vehículo (varios lados) para marcar daños a mano en
// la recepción. Silueta según tipo: camioneta/camión = pickup, resto = auto.
// Line-art negro sobre blanco (documento imprimible).

const S = { fill: 'none', stroke: '#111827', strokeWidth: 1.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

function esPickup(tipo: string | null | undefined): boolean {
  return tipo === 'camioneta' || tipo === 'camion'
}

// ── AUTO ──────────────────────────────────────────────────────────────────
function AutoLateral() {
  return (
    <svg viewBox="0 0 150 60" className="h-full w-full">
      <path {...S} d="M8 44 L14 44 M136 44 L142 44 M8 44 Q8 34 18 32 L40 31 Q48 20 62 18 L92 18 Q104 20 110 31 L134 33 Q142 35 142 44" />
      <path {...S} d="M18 44 L134 44" />
      <path {...S} d="M62 18 L60 31 M92 18 L94 31 M40 31 L134 31" />
      <circle {...S} cx="40" cy="46" r="9" />
      <circle {...S} cx="112" cy="46" r="9" />
    </svg>
  )
}
function AutoTecho() {
  return (
    <svg viewBox="0 0 150 60" className="h-full w-full">
      <rect {...S} x="18" y="10" width="114" height="40" rx="16" />
      <path {...S} d="M46 12 L52 24 L98 24 L104 12 M46 48 L52 36 L98 36 L104 48 M52 24 L52 36 M98 24 L98 36" />
    </svg>
  )
}
function AutoFrente() {
  return (
    <svg viewBox="0 0 100 60" className="h-full w-full">
      <rect {...S} x="16" y="10" width="68" height="42" rx="9" />
      <path {...S} d="M26 24 L74 24 M22 44 L78 44" />
      <circle {...S} cx="30" cy="34" r="4" />
      <circle {...S} cx="70" cy="34" r="4" />
    </svg>
  )
}

// ── PICKUP / CAMIONETA ──────────────────────────────────────────────────────
function PickupLateral() {
  return (
    <svg viewBox="0 0 160 60" className="h-full w-full">
      <path {...S} d="M8 46 L8 40 Q8 34 16 33 L44 32 Q50 18 66 17 L92 17 L96 33 L152 33 L152 46" />
      <path {...S} d="M16 46 L152 46" />
      <path {...S} d="M66 17 L64 33 M92 17 L96 33 M44 32 L96 33 M96 33 L96 46" />
      <circle {...S} cx="42" cy="48" r="9" />
      <circle {...S} cx="124" cy="48" r="9" />
    </svg>
  )
}
function PickupTecho() {
  return (
    <svg viewBox="0 0 160 60" className="h-full w-full">
      <rect {...S} x="14" y="10" width="132" height="40" rx="10" />
      <path {...S} d="M58 10 L58 50 M40 16 L52 24 L52 36 L40 44 M52 24 L14 24 M52 36 L14 36" />
      <rect {...S} x="64" y="16" width="76" height="28" rx="3" />
    </svg>
  )
}
function PickupFrente() {
  return (
    <svg viewBox="0 0 100 60" className="h-full w-full">
      <rect {...S} x="14" y="8" width="72" height="46" rx="7" />
      <path {...S} d="M24 22 L76 22 M20 40 L80 40" />
      <rect {...S} x="26" y="28" width="10" height="7" rx="1.5" />
      <rect {...S} x="64" y="28" width="10" height="7" rx="1.5" />
    </svg>
  )
}

function Vista({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded border border-[#e5e7eb] p-1">
      <div className="h-14 w-full">{children}</div>
      <p className="mt-0.5 text-[9px] uppercase tracking-wide text-[#9ca3af]">{label}</p>
    </div>
  )
}

export function VehiculoDiagramaDanos({ tipo }: { tipo: string | null | undefined }) {
  const pickup = esPickup(tipo)
  return (
    <div className="mt-4" style={{ breakInside: 'avoid' }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
          Estado del vehículo — marcar daños
        </p>
        <p className="text-[9px] text-[#9ca3af]">Rayón / · Abolladura ◯ · Golpe ✕ · Falta ✱</p>
      </div>
      <div className="mt-1.5 grid grid-cols-5 gap-1.5">
        {pickup ? (
          <>
            <Vista label="Techo"><PickupTecho /></Vista>
            <Vista label="Lado conductor"><PickupLateral /></Vista>
            <Vista label="Lado pasajero"><div style={{ transform: 'scaleX(-1)' }} className="h-full w-full"><PickupLateral /></div></Vista>
            <Vista label="Frontal"><PickupFrente /></Vista>
            <Vista label="Trasera"><div style={{ transform: 'scaleX(-1)' }} className="h-full w-full"><PickupFrente /></div></Vista>
          </>
        ) : (
          <>
            <Vista label="Techo"><AutoTecho /></Vista>
            <Vista label="Lado conductor"><AutoLateral /></Vista>
            <Vista label="Lado pasajero"><div style={{ transform: 'scaleX(-1)' }} className="h-full w-full"><AutoLateral /></div></Vista>
            <Vista label="Frontal"><AutoFrente /></Vista>
            <Vista label="Trasera"><div style={{ transform: 'scaleX(-1)' }} className="h-full w-full"><AutoFrente /></div></Vista>
          </>
        )}
      </div>
    </div>
  )
}
