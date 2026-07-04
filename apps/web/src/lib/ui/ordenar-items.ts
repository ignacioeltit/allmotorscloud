// Orden de presentación de ítems en OTs, presupuestos y documentos:
// primero repuestos/materiales, luego mano de obra, luego otros.
// El sort es estable → dentro de cada grupo se conserva el orden de creación.

const ORDEN_TIPO: Record<string, number> = {
  repuesto: 0,
  mano_obra: 1,
  otros: 2,
}

export function ordenarItemsPorTipo<T extends { tipo: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (ORDEN_TIPO[a.tipo] ?? 9) - (ORDEN_TIPO[b.tipo] ?? 9),
  )
}
