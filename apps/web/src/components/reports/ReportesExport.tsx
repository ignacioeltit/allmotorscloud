'use client'

// Botones de exportación de reportes: CSV (abrible en Excel) y PDF (vía impresión).

type Fila = { fecha: string; tipo: string; categoria: string; descripcion: string; monto: number }

export function ReportesExport({ filas }: { filas: Fila[] }) {
  function descargarCSV() {
    // Escapado seguro por celda: comillas dobladas (RFC-4180) + guard contra
    // formula injection (una celda que arranca con = + - @ tab/CR se ejecuta en Excel).
    const celda = (v: unknown) => {
      let s = String(v ?? '')
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
      return `"${s.replace(/"/g, '""')}"`
    }
    const encabezado = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto']
    const lineas = filas.map((f) =>
      [f.fecha, f.tipo, f.categoria, f.descripcion ?? '', f.monto].map(celda).join(','),
    )
    const csv = '﻿' + [encabezado.map(celda).join(','), ...lineas].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="no-print flex items-center gap-2">
      <button
        type="button"
        onClick={descargarCSV}
        className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-3.5 py-2 text-sm font-medium text-neutral-300 hover:bg-black/[0.06]"
      >
        ⬇ Exportar Excel (CSV)
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-3.5 py-2 text-sm font-medium text-neutral-300 hover:bg-black/[0.06]"
      >
        🖨 Descargar PDF
      </button>
    </div>
  )
}
