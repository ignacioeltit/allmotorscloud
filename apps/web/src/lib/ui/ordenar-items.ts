// Orden de presentación de ítems en OTs, presupuestos y documentos:
// primero toda la mano de obra, luego repuestos/materiales, luego otros.
// El sort es estable → dentro de cada grupo se conserva el orden de creación.

const ORDEN_TIPO: Record<string, number> = {
  mano_obra: 0,
  repuesto: 1,
  otros: 2,
}

export function ordenarItemsPorTipo<T extends { tipo: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (ORDEN_TIPO[a.tipo] ?? 9) - (ORDEN_TIPO[b.tipo] ?? 9),
  )
}
