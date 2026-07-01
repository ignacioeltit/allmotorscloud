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
import { writeFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'fs'
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

// Compuerta para el cron cada 10 min: tras un 429 se anota cuándo vence el
// bloqueo (+1 min de margen); las corridas que llegan antes salen sin gastar
// requests. El lockfile evita dos tandas simultáneas (eso fue lo que agotó
// la cuota la primera vez).
const STATE_PATH = join(BACKUP_DIR, '_ot-backup-state.json')
const LOCK_PATH = join(BACKUP_DIR, '_ot-backup.lock')
const COOLDOWN_MARGIN_MS = 60_000

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function nextAllowedAt(): number {
  if (!existsSync(STATE_PATH)) return 0
  try {
    return Number(JSON.parse(readFileSync(STATE_PATH, 'utf-8')).nextAllowedAt ?? 0)
  } catch {
    return 0
  }
}

function writeNextAllowed(retryAfterSeconds: number): void {
  const nextAt = Date.now() + retryAfterSeconds * 1000 + COOLDOWN_MARGIN_MS
  writeFileSync(STATE_PATH, JSON.stringify({ nextAllowedAt: nextAt, updatedAt: new Date().toISOString() }), 'utf-8')
}

/** true si otro proceso tiene el lock y sigue vivo. */
function acquireLock(): boolean {
  if (existsSync(LOCK_PATH)) {
    try {
      const pid = Number(readFileSync(LOCK_PATH, 'utf-8'))
      process.kill(pid, 0) // no mata: solo verifica existencia
      return false // proceso vivo → no tomar el lock
    } catch {
      // pid muerto o ilegible → lock huérfano, se puede tomar
    }
  }
  writeFileSync(LOCK_PATH, String(process.pid), 'utf-8')
  return true
}

function releaseLock(): void {
  try {
    if (existsSync(LOCK_PATH) && readFileSync(LOCK_PATH, 'utf-8') === String(process.pid)) {
      unlinkSync(LOCK_PATH)
    }
  } catch {
    /* best effort */
  }
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

  // Compuerta de cooldown: si el bloqueo del último 429 sigue vigente, salir
  // sin gastar ni un request (el cron reintenta en 10 min).
  const allowedAt = nextAllowedAt()
  if (Date.now() < allowedAt) {
    const min = Math.ceil((allowedAt - Date.now()) / 60000)
    console.log(`[${new Date().toISOString()}] Cooldown vigente: faltan ~${min} min. Salgo sin consumir cuota.`)
    return
  }

  if (!acquireLock()) {
    console.log(`[${new Date().toISOString()}] Otra tanda sigue corriendo (lock activo). Salgo.`)
    return
  }

  const pending = loadPendingIds()
  if (pending.length === 0) {
    console.log(`\n🏁 RESPALDO COMPLETO: no quedan OTs pendientes. Puedes quitar el cron (crontab -r).`)
    releaseLock()
    return
  }

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
        writeNextAllowed(Number(retryAfter) || 3600)
        console.log(`\n🛑 429 recibido en OT ${id}. Delay que lo disparó: ${delayMs}ms.`)
        console.log(`   Retry-After del servidor: ${retryAfter ?? '?'}s — próxima tanda anotada para dentro de ~61 min.`)
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
        releaseLock()
        return
      }
      logger.error(`Error OT ${id}`, { status, error: (err as Error).message })
    }
  }

  console.log(`\n✅ Corrida terminada sin disparar rate-limit.`)
  console.log(`   Exitosas: ${totalSuccess}. Delay final: ${delayMs}ms.`)
  console.log(`   Pendientes restantes: ${pending.length - totalSuccess}`)
  releaseLock()
}

main().catch((err) => {
  logger.error('Error fatal en calibrate-and-backup-ots', { error: err.message })
  releaseLock()
  process.exit(1)
})
