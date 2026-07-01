// Clasificador puro de tipo de vehículo a partir de marca/modelo.
// Sin dependencias ni efectos: usado por fix-vehicle-types.mjs y por los tests.

// Tokens con borde de palabra (evita que VAN matchee AVANZA, o H1 matchee CH1).
// El orden importa: camión antes que furgón (CANTER es camión aunque parezca van),
// furgón antes que camioneta (RAM VAN es furgón aunque RAM sea marca de pickups).
export const REGLAS = [
  {
    tipo: 'camion',
    tokens: [
      'CANTER', 'FRR', 'FTR', 'NPR', 'NPR70', 'NKR', 'NHR', 'NQR', 'ATEGO',
      'ACCELO', 'DYNA', 'FORWARD', 'DELIVERY', 'WORKER',
    ],
  },
  {
    tipo: 'furgon',
    tokens: [
      'SPRINTER', 'PARTNER', 'BERLINGO', 'BOXER', 'TRANSIT', 'H1', 'H-1', 'H100',
      'STARIA', 'MASTER', 'DUCATO', 'HIACE', 'HI-ACE', 'KANGOO', 'EXPRESS',
      'TRAFIC', 'CRAFTER', 'VAN', 'JUMPER', 'JUMPY', 'DOBLO', 'PORTER',
    ],
  },
  {
    tipo: 'camioneta',
    tokens: [
      'L200', 'HILUX', 'T60', 'RANGER', 'NP300', 'AMAROK', 'BT-50', 'BT50',
      'FRONTIER', 'NAVARA', 'F150', 'F-150', 'F250', 'F-250', 'POER', 'ACTYON',
      'D-MAX', 'DMAX', 'T8', 'T6', 'T7', 'T9', 'COLORADO', 'SAVEIRO', 'MONTANA',
      'TERRALORD', 'LANDTREK', 'DEER', 'WINGLE', 'HAVAL', 'PICKUP', 'DAKAR',
      'RAM', 'TORNADO', 'PETER', 'S10', 'S-10', 'LUV', 'B2500', 'BT2500',
    ],
  },
  {
    tipo: 'moto',
    tokens: ['MOTO', 'MOTOCICLETA', 'SCOOTER', 'CB190', 'CBR', 'GN125'],
  },
]

// Frases (substring directo, para multi-palabra)
export const FRASES = [
  { tipo: 'camioneta', frase: 'PICK UP' },
  { tipo: 'camioneta', frase: 'PICK-UP' },
]

/** Devuelve 'camioneta' | 'furgon' | 'camion' | 'moto', o null si no hay evidencia. */
export function clasificar(marca, modelo) {
  const texto = `${marca ?? ''} ${modelo ?? ''}`.toUpperCase()
  const tokens = new Set(texto.split(/[^A-Z0-9-]+/).filter(Boolean))

  for (const { tipo, frase } of FRASES) {
    if (texto.includes(frase)) return tipo
  }
  for (const regla of REGLAS) {
    for (const t of regla.tokens) {
      if (tokens.has(t)) return regla.tipo
    }
  }
  return null
}
