// Funciones puras para fusionar costos (que solo gestión recibe vía RPC) con
// filas que la app leyó sin ellos. Ver migration 058.

/** Mapa id → costo. Un id ausente significa "costo desconocido". */
export type MapaCostos = ReadonlyMap<string, number | null>

/** Convierte las filas de una RPC de costos en un mapa id → costo. */
export function mapaDeCostos<R>(
  filas: readonly R[] | null | undefined,
  id: (fila: R) => string,
  costo: (fila: R) => number | string | null,
): Map<string, number | null> {
  const mapa = new Map<string, number | null>()
  for (const fila of filas ?? []) {
    const valor = costo(fila)
    mapa.set(id(fila), valor == null ? null : Number(valor))
  }
  return mapa
}

/**
 * Devuelve copias de `filas` con `campo` tomado del mapa de costos.
 * Si el mapa es null (el usuario no es gestión) el campo queda en null.
 */
export function aplicarCostos<T extends { id: string }, K extends string>(
  filas: readonly T[],
  campo: K,
  costos: MapaCostos | null,
): (T & Record<K, number | null>)[] {
  return filas.map((fila) => ({
    ...fila,
    [campo]: costos?.get(fila.id) ?? null,
  })) as (T & Record<K, number | null>)[]
}
