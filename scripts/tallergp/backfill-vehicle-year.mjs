#!/usr/bin/env node
// Rellena vehiculos.anio decodificándolo del VIN, y marca anio_por_confirmar=true
// para que el taller lo valide en la próxima recepción. TallerGP no expone el año
// por API, así que el VIN (posición 10, desambiguada con la 7) es la única fuente.
//
// Uso:
//   dry-run: node --env-file=apps/web/.env.local scripts/tallergp/backfill-vehicle-year.mjs
//   apply:   node --env-file=apps/web/.env.local scripts/tallergp/backfill-vehicle-year.mjs --apply
//
// Solo toca vehículos importados (origen_tallergp_id) con anio IS NULL: nunca
// pisa un año ya puesto o confirmado a mano.

import { anioDesdeVin } from './lib/vin-year.mjs'

const APPLY = process.argv.includes('--apply')
const BATCH = 200

const U = process.env.NEXT_PUBLIC_SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!U || !K) {
  console.error('\nERROR: ejecutar con node --env-file=apps/web/.env.local ...\n')
  process.exit(1)
}
const H = { apikey: K, Authorization: `Bearer ${K}` }

async function getAll(pathBase) {
  const all = []
  let offset = 0
  const limit = 1000
  for (;;) {
    const r = await fetch(`${U}/rest/v1${pathBase}&limit=${limit}&offset=${offset}`, { headers: H })
    if (!r.ok) throw new Error(`GET → ${r.status}: ${(await r.text()).slice(0, 200)}`)
    const rows = await r.json()
    all.push(...rows)
    if (rows.length < limit) break
    offset += limit
  }
  return all
}

async function patch(path, body) {
  const r = await fetch(`${U}/rest/v1${path}`, {
    method: 'PATCH',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`PATCH → ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`\n🔧 Backfill de año desde VIN${APPLY ? ' [APPLY]' : ' [DRY-RUN]'}`)

  const vehiculos = await getAll(
    '/vehiculos?select=id,patente,vin,anio,marca,modelo' +
    '&origen_tallergp_id=not.is.null&anio=is.null&eliminado_en=is.null&order=patente.asc',
  )
  console.log(`  Vehículos importados sin año: ${vehiculos.length}`)

  // Agrupar por año decodificado, y juntar los que quedan sin VIN utilizable
  const porAnio = new Map()
  const conYear = []
  let sinVin = 0
  const decadas = {}

  for (const v of vehiculos) {
    const anio = anioDesdeVin(v.vin)
    if (anio == null) { sinVin++; continue }
    conYear.push({ id: v.id, anio })
    porAnio.set(anio, (porAnio.get(anio) ?? 0) + 1)
    const d = `${Math.floor(anio / 10) * 10}s`
    decadas[d] = (decadas[d] ?? 0) + 1
  }

  const sep = '─'.repeat(50)
  console.log(sep)
  console.log(`  Con año decodificable:  ${conYear.length}`)
  console.log(`  Sin VIN utilizable:     ${sinVin}  (quedan sin año)`)
  console.log(sep)
  console.log('  Distribución por década:')
  for (const d of Object.keys(decadas).sort()) console.log(`    ${d}: ${decadas[d]}`)
  console.log('  Muestra (primeros 10):')
  for (const v of vehiculos.slice(0, 10)) {
    const a = anioDesdeVin(v.vin)
    console.log(`    ${v.patente.padEnd(9)} ${(v.marca + ' ' + v.modelo).slice(0, 22).padEnd(23)} VIN ${(v.vin || '—').padEnd(18)} → ${a ?? '(sin dato)'}`)
  }
  console.log(sep)

  if (!APPLY) {
    console.log('\n  Para aplicar:')
    console.log('  node --env-file=apps/web/.env.local scripts/tallergp/backfill-vehicle-year.mjs --apply\n')
    return
  }

  console.log('\n🚀 Aplicando (anio + anio_por_confirmar=true)…')
  // Agrupar por año para hacer PATCH por lotes (un update por año usando id=in.())
  const idsPorAnio = new Map()
  for (const { id, anio } of conYear) {
    if (!idsPorAnio.has(anio)) idsPorAnio.set(anio, [])
    idsPorAnio.get(anio).push(id)
  }

  let done = 0
  for (const [anio, ids] of idsPorAnio) {
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH)
      await patch(`/vehiculos?id=in.(${chunk.join(',')})`, { anio, anio_por_confirmar: true })
      done += chunk.length
      process.stdout.write(`  Actualizados: ${done}/${conYear.length}…\r`)
      await sleep(100)
    }
  }
  console.log(`\n✅ Backfill aplicado: ${conYear.length} vehículos con año estimado (por confirmar).\n`)
}

main().catch((e) => {
  console.error('\n❌ Error fatal:', e.message)
  process.exit(1)
})
