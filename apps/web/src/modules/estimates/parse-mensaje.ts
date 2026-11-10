// Parser por reglas (sin IA) para generar un borrador de cotización desde un
// mensaje informal del cliente (ej: pegado de WhatsApp). Extrae lo predecible —
// nombre, patente, marca, teléfono, servicios solicitados y síntomas/fallas — y
// deja el resto al asesor, que revisa y ajusta el borrador antes de enviarlo.
//
// Es deterministico y offline: ninguna dependencia externa, ningún costo.

export interface MensajeParseado {
  nombre: string | null
  patente: string | null
  marca: string | null
  telefono: string | null
  /** Etiquetas canónicas de servicios cotizables detectados (sin precio). */
  servicios: string[]
  /** Frases de síntoma/falla → se cotizan como "Diagnóstico" (precio a confirmar). */
  sintomas: string[]
  textoOriginal: string
}

// Marcas comunes en Chile (en minúsculas, sin tildes para comparar).
const MARCAS = [
  'toyota', 'hyundai', 'kia', 'chevrolet', 'nissan', 'suzuki', 'mitsubishi',
  'mazda', 'ford', 'volkswagen', 'vw', 'peugeot', 'renault', 'honda', 'ram',
  'dodge', 'jeep', 'chery', 'great wall', 'haval', 'jac', 'mg', 'byd', 'subaru',
  'mercedes', 'mercedes-benz', 'bmw', 'audi', 'fiat', 'citroen', 'volvo', 'isuzu',
  'ssangyong', 'changan', 'maxus', 'foton', 'jetour', 'baic', 'dfsk', 'dfm',
  'opel', 'skoda', 'seat', 'mini', 'land rover', 'jaguar', 'porsche', 'tesla',
]

// Palabra clave (sin tildes) → etiqueta de servicio canónica cotizable.
const SERVICIOS: { claves: string[]; label: string }[] = [
  { claves: ['aceite', 'lubricacion'], label: 'Cambio de aceite' },
  { claves: ['filtro', 'filtros'], label: 'Cambio de filtros' },
  { claves: ['freno', 'frenos', 'pastilla', 'pastillas', 'balata', 'balatas'], label: 'Revisión/cambio de frenos' },
  { claves: ['alineacion', 'balanceo'], label: 'Alineación y balanceo' },
  { claves: ['bateria'], label: 'Batería' },
  { claves: ['embrague'], label: 'Embrague' },
  { claves: ['correa', 'distribucion'], label: 'Correa de distribución' },
  { claves: ['revision tecnica', 'planta de revision'], label: 'Preparación revisión técnica' },
  { claves: ['afinamiento', 'afinacion', 'bujia', 'bujias'], label: 'Afinamiento' },
  { claves: ['scanner', 'escaner'], label: 'Diagnóstico con scanner' },
  { claves: ['amortiguador', 'amortiguadores', 'suspension'], label: 'Suspensión' },
  { claves: ['neumatico', 'neumaticos'], label: 'Neumáticos' },
  { claves: ['luz', 'luces', 'ampolleta', 'ampolletas', 'foco', 'focos'], label: 'Luces' },
  { claves: ['aire acondicionado', 'climatizacion'], label: 'Aire acondicionado' },
  { claves: ['radiador', 'refrigerante', 'termostato'], label: 'Sistema de refrigeración' },
  { claves: ['embraque'], label: 'Embrague' },
]

// Palabras (sin tildes) que señalan un síntoma o falla a diagnosticar.
const SINTOMAS_KW = [
  'ruido', 'ruidos', 'falla', 'fallando', 'no funciona', 'no anda', 'no parte',
  'no enciende', 'no prende', 'se apaga', 'humo', 'vibra', 'vibracion', 'tiembla',
  'tira', 'pierde', 'fuga', 'gotea', 'gotera', 'huele', 'olor', 'recalienta',
  'calienta', 'chirrido', 'golpe', 'golpeteo', 'salta', 'tiron', 'tirones',
  'tironea', 'marcha', 'temperatura',
]

// Conectores que abren una cláusula al inicio y no aportan al síntoma.
const PREFIJOS_RUIDO = [
  'tiene', 'tengo', 'hay', 'un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las',
  'con', 'y', 'ademas', 'tambien', 'que', 'se', 'le', 'me', 'anda',
]

function sinTildes(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function norm(s: string): string {
  return sinTildes(s.toLowerCase()).replace(/\s+/g, ' ').trim()
}

function capitalizar(s: string): string {
  const t = s.trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t
}

/** Patente chilena: nuevo formato LLLL·DD o antiguo LL·DDDD. */
function extraerPatente(texto: string): string | null {
  const up = texto.toUpperCase()
  const mNuevo = up.match(/\b([A-Z]{4})[\s.-]?(\d{2})\b/)
  if (mNuevo) return `${mNuevo[1]}${mNuevo[2]}`
  const mAntiguo = up.match(/\b([A-Z]{2})[\s.-]?(\d{4})\b/)
  if (mAntiguo) return `${mAntiguo[1]}${mAntiguo[2]}`
  return null
}

function extraerMarca(textoNorm: string): string | null {
  for (const marca of MARCAS) {
    const re = new RegExp(`\\b${marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    if (re.test(textoNorm)) {
      // Devuelve la marca con mayúscula inicial (RAM/BMW/MG/VW se ven mejor en mayúsculas).
      return marca.length <= 3 ? marca.toUpperCase() : capitalizar(marca)
    }
  }
  return null
}

function extraerNombre(textoNorm: string, textoOriginal: string): string | null {
  const m = textoNorm.match(/\b(?:soy|me llamo|mi nombre es|habla|aqui)\s+([a-zñ]+(?:\s+[a-zñ]+){0,2})/)
  if (!m) return null
  const stop = new Set([
    'tengo', 'tiene', 'quiero', 'necesito', 'con', 'mi', 'y', 'el', 'la', 'un',
    'una', 'para', 'de', 'que', 'hola', 'buenas', 'buenos', 'dias', 'tardes',
    'noches', 'me', 'se', 'ando', 'tenia', 'queria',
  ])
  const tokens = (m[1] ?? '').split(' ').filter((t) => t && !stop.has(t)).slice(0, 2)
  if (tokens.length === 0) return null
  // Reconstruye con el casing original cuando se puede (busca cada token en el texto).
  return tokens
    .map((tok) => {
      const re = new RegExp(`\\b(${tok})\\b`, 'i')
      const orig = sinTildes(textoOriginal).match(re)?.[1]
      return capitalizar(orig ?? tok)
    })
    .join(' ')
}

function extraerTelefono(texto: string): string | null {
  const m = texto.match(/(?:\+?56)?\s*9\s*\d{4}\s*\d{4}/)
  if (!m) return null
  const d = m[0].replace(/\D/g, '')
  // Normaliza a 9 dígitos (sin prefijo país) para guardar en el cliente.
  if (d.length === 11 && d.startsWith('56')) return d.slice(2)
  if (d.length === 9) return d
  return d || null
}

function extraerServicios(textoNorm: string): string[] {
  const out: string[] = []
  for (const { claves, label } of SERVICIOS) {
    if (out.includes(label)) continue
    if (claves.some((c) => new RegExp(`\\b${c}\\b`).test(textoNorm))) out.push(label)
  }
  return out
}

function limpiarSintoma(clausula: string): string {
  let tokens = clausula.trim().split(/\s+/)
  while (tokens.length > 1 && PREFIJOS_RUIDO.includes(norm(tokens[0]!))) {
    tokens = tokens.slice(1)
  }
  return capitalizar(tokens.join(' ').trim())
}

function extraerSintomas(textoOriginal: string): string[] {
  // Divide en cláusulas por puntuación y conectores " y " / " ademas ".
  const clausulas = textoOriginal.split(/[.,;]+|\s+y\s+|\s+adem[aá]s\s+/i)
  const out: string[] = []
  for (const cl of clausulas) {
    const n = norm(cl)
    if (!n) continue
    if (SINTOMAS_KW.some((kw) => n.includes(kw))) {
      const limpio = limpiarSintoma(cl)
      if (limpio && !out.includes(limpio)) out.push(limpio)
    }
  }
  return out
}

/** Analiza un mensaje libre y devuelve los datos estructurados detectados. */
export function parseMensaje(texto: string): MensajeParseado {
  const textoOriginal = (texto ?? '').trim()
  const n = norm(textoOriginal)
  return {
    nombre: extraerNombre(n, textoOriginal),
    patente: extraerPatente(textoOriginal),
    marca: extraerMarca(n),
    telefono: extraerTelefono(textoOriginal),
    servicios: extraerServicios(n),
    sintomas: extraerSintomas(textoOriginal),
    textoOriginal,
  }
}
