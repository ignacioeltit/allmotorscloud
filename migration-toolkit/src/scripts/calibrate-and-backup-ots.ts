/**
 * Calibra el ritmo real de la API de TallerGP (no documentado públicamente) mientras
 * respalda el detalle de OTs de verdad — cada request exitosa se guarda como progreso
 * real, no se desperdicia nada.
 *
 * Estrategia: empieza MUY lento (1 req cada 15s) y acelera gradualmente mientras no
 * haya errores 429. Si aparece un 429, se detiene inmediatamente (sin esperar la hora
 * de cooldown) y reporta el ritmo máximo seguro encontrado. No usa el cliente
 * compartido (client.ts) porque ese reintenta automáticamente esperando el
 * Retry-After completo — acá necesitamos detectar el 429 y parar, no esperarlo.
 *
 * Ejecutar: npm run calibrate-ots -- [--start-delay=15000] [--max=50]
 */

import 'dotenv/config'
import axios from 'axios'
import { writeFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'fs'
import { resolve, join } from 'path'
import { getBearerToken } from '../api/tallergp/auth.js'
import { logger } from '../utils/logger.js'

const BACKUP_DIR = resolve(process.env.EXPORT_DIR ?? './exports', 'backup')
const LIST_DIR = join(BACKUP_DIR, 'repair-orders-list')
const DETAIL_DIR = join(BACKUP_DIR, 'repair-orders')
const API_URL = process.env.TALLERGP_API_URL ?? 'https://api.tallergp.com'

const START_DELAY_MS = Number(process.argv.find((a) => a.startsWith('--start-delay='))?.split('=')[1] ?? 15000)
const FLOOR_DELAY_MS = 1000
const MAX_REQUESTS = Number(process.argv.find((a) => a.startsWith('--max='))?.split('=')[1] ?? Infinity)
const ACCELERATE_EVERY_N_SUCCESSES = 5
const ACCELERATE_FACTOR = 0.75 // reduce el delay un 25% cada N éxitos seguidos

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function loadPendingIds(): string[] {
  const files = readdirSync(LIST_DIR).filter((f) => f.startsWith('page-') && f.endsWith('.json')).sort()
  const ids: string[] = []
  for (const f of files) {
    const parsed = JSON.parse(readFileSync(join(LIST_DIR, f), 'utf-8'))
    for (const ot of parsed.data as { entry_id: string }[]) ids.push(ot.entry_id)
  }
  return ids.filter((id) => !existsSync(join(DETAIL_DIR, `${id}.json`)))
}

async function main(): Promise<void> {
  ensureDir(DETAIL_DIR)
  const pending = loadPendingIds()
  console.log(`\n─── Calibración de rate-limit + respaldo real de OTs ───`)
  console.log(`Pendientes: ${pending.length}. Delay inicial: ${START_DELAY_MS}ms. Máximo esta corrida: ${MAX_REQUESTS}\n`)

  const token = await getBearerToken()
  let delayMs = START_DELAY_MS
  let successStreak = 0
  let totalSuccess = 0
  let totalAttempts = 0

  for (const id of pending) {
    if (totalAttempts >= MAX_REQUESTS) {
      console.log(`\nLímite de esta corrida alcanzado (${MAX_REQUESTS}). Delay final estable: ${delayMs}ms.`)
      break
    }

    await sleep(delayMs)
    totalAttempts++

    try {
      const res = await axios.get(`${API_URL}/repair-orders/${id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        timeout: 30_000,
      })
      writeFileSync(join(DETAIL_DIR, `${id}.json`), JSON.stringify(res.data, null, 2), 'utf-8')
      totalSuccess++
      successStreak++
      console.log(`  ✓ [${totalSuccess}/${pending.length}] OT ${id} guardada (delay actual: ${delayMs}ms)`)

      if (successStreak >= ACCELERATE_EVERY_N_SUCCESSES) {
        const nuevoDelay = Math.max(FLOOR_DELAY_MS, Math.round(delayMs * ACCELERATE_FACTOR))
        if (nuevoDelay !== delayMs) {
          console.log(`  ⚡ ${successStreak} éxitos seguidos → acelerando: ${delayMs}ms → ${nuevoDelay}ms`)
        }
        delayMs = nuevoDelay
        successStreak = 0
      }
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      if (status === 429) {
        const retryAfter = axios.isAxiosError(err) ? err.response?.headers['retry-after'] : undefined
        console.log(`\n🛑 429 recibido en OT ${id}. Delay que lo disparó: ${delayMs}ms.`)
        console.log(`   Retry-After del servidor: ${retryAfter ?? '?'}s`)
        console.log(`\n═══════════════════════════════════════════════════`)
        console.log(`  RESULTADO DE CALIBRACIÓN`)
        console.log(`═══════════════════════════════════════════════════`)
        console.log(`  Requests exitosas antes del límite: ${totalSuccess}`)
        console.log(`  Delay seguro (último exitoso):       ${successStreak === 0 ? delayMs : delayMs}ms`)
        console.log(`  Delay que disparó el límite:         ${delayMs}ms`)
        console.log(`  OTs respaldadas en esta corrida:     ${totalSuccess}`)
        console.log(`  OTs pendientes en total:              ${pending.length - totalSuccess}`)
        console.log(`═══════════════════════════════════════════════════\n`)
        console.log(`No se espera el cooldown — deteniendo de inmediato para no perder tiempo.`)
        return
      }
      logger.error(`Error OT ${id}`, { status, error: (err as Error).message })
    }
  }

  console.log(`\n✅ Corrida terminada sin disparar rate-limit.`)
  console.log(`   Exitosas: ${totalSuccess}. Delay final: ${delayMs}ms.`)
  console.log(`   Pendientes restantes: ${pending.length - totalSuccess}`)
}

main().catch((err) => {
  logger.error('Error fatal en calibrate-and-backup-ots', { error: err.message })
  process.exit(1)
})
