'use client'

export function ImprimirVentaBtn() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-3.5 py-2 text-sm font-medium text-neutral-300 hover:bg-black/[0.06]"
    >
      🖨 Imprimir comprobante
    </button>
  )
}
