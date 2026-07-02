// Decodificador de año del modelo a partir del VIN (ISO 3779 / norma NHTSA).
// Puro, sin dependencias — usado por el backfill y por los tests.
//
// El año se codifica en la posición 10 (índice 9) del VIN de 17 caracteres.
// El código se repite en un ciclo de 30 años (ej: 'K' = 1989 o 2019). La regla
// oficial usa la posición 7 para desambiguar, pero solo la respetan fabricantes
// norteamericanos; las marcas asiáticas/europeas (mayoría del parque chileno) no.
//
// Como este año es un ESTIMADO "por confirmar", se resuelve la ambigüedad
// eligiendo la interpretación MÁS RECIENTE que no supere el año tope. Un vehículo
// atendido hoy es mucho más probable que sea del ciclo reciente que del de hace
// 30 años; el humano confirma los pocos autos genuinamente antiguos.
// Letras no usadas: I, O, Q, U, Z (y el 0) — no aparecen como código de año.

const CODIGO_ANIO = {
  A: [1980, 2010], B: [1981, 2011], C: [1982, 2012], D: [1983, 2013],
  E: [1984, 2014], F: [1985, 2015], G: [1986, 2016], H: [1987, 2017],
  J: [1988, 2018], K: [1989, 2019], L: [1990, 2020], M: [1991, 2021],
  N: [1992, 2022], P: [1993, 2023], R: [1994, 2024], S: [1995, 2025],
  T: [1996, 2026], V: [1997, 2027], W: [1998, 2028], X: [1999, 2029],
  Y: [2000, 2030],
  1: [2001, 2031], 2: [2002, 2032], 3: [2003, 2033], 4: [2004, 2034],
  5: [2005, 2035], 6: [2006, 2036], 7: [2007, 2037], 8: [2008, 2038],
  9: [2009, 2039],
}

/**
 * Año del modelo estimado desde el VIN (sesgado a la interpretación más reciente
 * plausible), o null si no se puede decodificar.
 * @param {string|null} vin
 * @param {number} [anioMaximo] año tope (default: año actual + 1, por modelos "adelantados")
 */
export function anioDesdeVin(vin, anioMaximo = new Date().getFullYear() + 1) {
  if (!vin) return null
  const v = String(vin).replace(/\s/g, '').toUpperCase()
  if (v.length !== 17) return null

  const opciones = CODIGO_ANIO[v[9]]
  if (!opciones) return null

  // Preferir el ciclo reciente (opciones[1]); si cae en el futuro, usar el viejo.
  const [viejo, reciente] = opciones
  if (reciente <= anioMaximo) return reciente
  if (viejo <= anioMaximo) return viejo
  return null
}
