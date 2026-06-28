export interface FieldAnalysis {
  name: string
  observedTypes: string[]
  nullCount: number
  totalCount: number
  nullRate: number
  examples: string[]
  maxLength: number
  isHashId: boolean
  isForeignKey: boolean
  isUrl: boolean
  isCdnUrl: boolean
  isPdfUrl: boolean
  isDate: boolean
  isCurrencyAmount: boolean
  isNumericString: boolean
  isBoolean: boolean
  isArray: boolean
  isObject: boolean
  isEnum: boolean
  enumValues?: string[]
  resolvedEntity?: string
}

// Prefijos de ID conocidos (se enriquecen durante el descubrimiento)
const ID_PREFIX_MAP: Record<string, string> = {
  '7ps': 'customers',
  '9g3': 'vehicles',
  'xd0': 'repair-orders',
  'lm2': 'employees',
  '8fu': 'invoices',
  'es6': 'delivery-notes',
}

const HASH_ID_PATTERN = /^[a-z0-9]{28,40}$/
const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}(\s\d{2}:\d{2}(:\d{2})?)?$/
const NUMERIC_STRING_PATTERN = /^-?\d+(\.\d+)?$/
const URL_PATTERN = /^https?:\/\//
const CDN_PATTERN = /cloudfront\.net|s3\.amazonaws\.com|cdn\./

export function registerIdPrefix(prefix: string, entityKey: string): void {
  if (prefix.length >= 3) {
    ID_PREFIX_MAP[prefix] = entityKey
  }
}

export function detectEntityFromId(value: string): string | undefined {
  if (typeof value !== 'string' || !HASH_ID_PATTERN.test(value)) return undefined
  for (const [prefix, entity] of Object.entries(ID_PREFIX_MAP)) {
    if (value.startsWith(prefix)) return entity
  }
  return undefined
}

function inferType(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  if (typeof value === 'string') {
    if (NUMERIC_STRING_PATTERN.test(value)) return 'numeric-string'
    return 'string'
  }
  return 'unknown'
}

function toStr(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 80)
  return String(value).slice(0, 80)
}

export function analyzeFields(records: Record<string, unknown>[]): FieldAnalysis[] {
  if (records.length === 0) return []

  const fieldMap = new Map<string, {
    types: Set<string>
    nullCount: number
    values: unknown[]
  }>()

  // Collect all field data from all records
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (!fieldMap.has(key)) {
        fieldMap.set(key, { types: new Set(), nullCount: 0, values: [] })
      }
      const entry = fieldMap.get(key)!
      if (value === null || value === undefined) {
        entry.nullCount++
      } else {
        if (entry.values.length < 3) entry.values.push(value)
      }
      entry.types.add(inferType(value))
    }
  }

  const total = records.length

  return Array.from(fieldMap.entries()).map(([name, data]): FieldAnalysis => {
    const observedTypes = Array.from(data.types).filter((t) => t !== 'null')
    const examples = data.values.map(toStr).filter(Boolean)
    const maxLength = examples.reduce((m, e) => Math.max(m, e.length), 0)

    const nonNullValues = data.values.filter((v) => v !== null && v !== undefined)
    const stringValues = nonNullValues.filter((v): v is string => typeof v === 'string')
    const firstValue = nonNullValues[0]
    const firstStr = typeof firstValue === 'string' ? firstValue : ''

    // FK & ID detection
    const nameLooksLikeFk = name.endsWith('_id') || name === 'id' || name === 'entry_id' ||
      name === 'budget_id' || name === 'invoice_id' || name === 'material_id' || name === 'intake_id'
    const valueIsHash = firstStr.length > 0 && HASH_ID_PATTERN.test(firstStr)
    const isForeignKey = name.endsWith('_id') && name !== 'id' &&
      name !== 'entry_id' && name !== 'budget_id' && name !== 'invoice_id' &&
      name !== 'material_id' && name !== 'intake_id'
    const isHashId = nameLooksLikeFk && valueIsHash

    // URL detection
    const isUrl = stringValues.some((v) => URL_PATTERN.test(v))
    const isCdnUrl = stringValues.some((v) => URL_PATTERN.test(v) && CDN_PATTERN.test(v))
    const isPdfUrl = stringValues.some((v) => URL_PATTERN.test(v) && v.includes('.pdf'))

    // Date detection
    const isDate = stringValues.length > 0 &&
      stringValues.every((v) => !v || DATE_PATTERN.test(v))

    // Numeric-string detection
    const isNumericString = observedTypes.includes('numeric-string') &&
      !observedTypes.includes('string')

    // Currency: number field with values that look like Chilean pesos (large integers)
    const isCurrencyAmount = (observedTypes.includes('number') || isNumericString) &&
      (name.includes('amount') || name.includes('price') || name.includes('cost') ||
        name.includes('total') || name.includes('net') || name.includes('vat'))

    // Enum detection: 5 or fewer distinct string values across samples
    const distinctStringValues = Array.from(new Set(stringValues))
    const isEnum = distinctStringValues.length > 0 &&
      distinctStringValues.length <= 5 && total >= 3

    // Resolve entity from FK value
    let resolvedEntity: string | undefined
    if (isForeignKey && firstStr) {
      resolvedEntity = detectEntityFromId(firstStr)
    }

    return {
      name,
      observedTypes: Array.from(data.types),
      nullCount: data.nullCount,
      totalCount: total,
      nullRate: Math.round((data.nullCount / total) * 100),
      examples,
      maxLength,
      isHashId,
      isForeignKey,
      isUrl,
      isCdnUrl,
      isPdfUrl,
      isDate,
      isCurrencyAmount,
      isNumericString,
      isBoolean: observedTypes.includes('boolean'),
      isArray: observedTypes.includes('array'),
      isObject: observedTypes.includes('object'),
      isEnum,
      enumValues: isEnum ? distinctStringValues : undefined,
      resolvedEntity,
    }
  })
}
