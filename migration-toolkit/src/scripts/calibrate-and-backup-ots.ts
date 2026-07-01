/**
 * Respaldo autónomo del historial TallerGP por fases: OTs → presupuestos → facturas.
 * Cada tanda respeta la cuota real de la API (~100 requests/hora, no documentada):
 * arranca lento (1 req/15s), acelera gradualmente, y ante un 429 se detiene al
 * instante anotando cuándo vence el bloqueo para que la próxima corrida del cron
 * (cada 10 min) sepa si le toca trabajar o salir sin gastar cuota.
 *
 * No usa el cliente compartido (client.ts) porque ese espera el Retry-After
 * completo dentro del proceso; acá el cron es quien maneja la espera.
 *
 * Resumible por existencia de archivo: listas en <fase>-list/page-NNNNN.json,
 * detalles en <fase>/<id>.json. Ejecutar: npm run calibrate-ots
 */

import 'dotenv/config'
import axios from 'axios'
import { writeFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'fs'
import { resolve, join } from 'path'
import { getBearerToken } from '../api/tallergp/auth.js'
import { logger } from '../utils/logger.js'

const BACKUP_DIR = resolve(process.env.EXPORT_DIR ?? './exports', 'backup')
const API_URL = process.env.TALLERGP_API_URL ?? 'https://api.tallergp.com'
const PER_PAGE = 100

const START_DELAY_MS = Number(process.argv.find((a) => a.startsWith('--start-delay='))?.split('=')[1] ?? 15000)
const FLOOR_DELAY_MS = 1000
const MAX_REQUESTS = Number(process.argv.find((a) => a.startsWith('--max='))?.split('=')[1] ?? Infinity)
const ACCELERATE_EVERY_N_SUCCESSES = 5
const ACCELERATE_FACTOR = 0.75 // reduce el delay un 25% cada N éxitos seguidos

// Fases en orden: cuando una queda completa (listado + todos los detalles),
// la siguiente corrida continúa con la próxima automáticamente.
interface Fase {
  nombre: string
  listPath: string
  listDir: string
  detailDir: string
  idField: string
}

const FASES: Fase[] = [
  { nombre: 'OTs', listPath: '/repair-orders', listDir: 'repair-orders-list', detailDir: 'repair-orders', idField: 'entry_id' },
  { nombre: 'Presupuestos', listPath: '/budgets', listDir: 'budgets-list', detailDir: 'budgets', idField: 'budget_id' },
  { nombre: 'Facturas', listPath: '/invoices', listDir: 'invoices-list', detailDir: 'invoices', idField: 'invoice_id' },
]

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

function pad(n: number): string {
  return String(n).padStart(5, '0')
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

// ── Trabajo pendiente por fase ───────────────────────────────────────────────

type Trabajo =
  | { kind: 'list'; page: number }
  | { kind: 'detail'; id: string }

/** Estado del listado de una fase: páginas descargadas vs total conocido. */
function estadoListado(fase: Fase): { paginas: number; totalPaginas: number | null } {
  const dir = join(BACKUP_DIR, fase.listDir)
  if (!existsSync(dir)) return { paginas: 0, totalPaginas: null }
  const files = readdirSync(dir).filter((f) => f.startsWith('page-') && f.endsWith('.json'))
  if (files.length === 0) return { paginas: 0, totalPaginas: null }
  const primera = JSON.parse(readFileSync(join(dir, files.sort()[0]!), 'utf-8'))
  return { paginas: files.length, totalPaginas: Number(primera.pagination.total_pages) }
}

/** Cola de trabajo de la fase: primero páginas de listado faltantes, luego detalles. */
function colaDeFase(fase: Fase): Trabajo[] {
  const listDir = join(BACKUP_DIR, fase.listDir)
  const detailDir = join(BACKUP_DIR, fase.detailDir)
  ensureDir(listDir)
  ensureDir(detailDir)

  const { paginas, totalPaginas } = estadoListado(fase)
  if (totalPaginas === null || paginas < totalPaginas) {
    // Listado incompleto: pedir las páginas que falten (los detalles vienen después)
    const cola: Trabajo[] = []
    const hasta = totalPaginas ?? 1
    for (let p = 1; p <= hasta; p++) {
      if (!existsSync(join(listDir, `page-${pad(p)}.json`))) cola.push({ kind: 'list', page: p })
    }
    if (totalPaginas === null) return cola // aún no sabemos cuántas hay: parte con la 1
    return cola
  }

  // Listado completo: detalles pendientes
  const ids: string[] = []
  for (const f of readdirSync(listDir).filter((x) => x.startsWith('page-')).sort()) {
    const parsed = JSON.parse(readFileSync(join(listDir, f), 'utf-8'))
    for (const row of parsed.data as Record<string, string>[]) {
      const id = row[fase.idField]
      if (id) ids.push(id)
    }
  }
  return ids
    .filter((id) => !existsSync(join(detailDir, `${id}.json`)))
    .map((id) => ({ kind: 'detail', id }))
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
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

  const token = await getBearerToken()
  let delayMs = START_DELAY_MS
  let successStreak = 0
  let totalSuccess = 0
  let totalAttempts = 0

  try {
    for (const fase of FASES) {
      // La cola se recalcula al entrar a la fase y cada vez que se agota
      // (ej: al terminar el listado aparecen los detalles).
      for (;;) {
        const cola = colaDeFase(fase)
        if (cola.length === 0) break

        console.log(`\n─── Fase ${fase.nombre}: ${cola.length} ítems pendientes (delay actual: ${delayMs}ms) ───`)

        for (const trabajo of cola) {
          if (totalAttempts >= MAX_REQUESTS) {
            console.log(`\nLímite de esta corrida alcanzado (${MAX_REQUESTS}).`)
            return
          }

          await sleep(delayMs)
          totalAttempts++

          const url =
            trabajo.kind === 'list'
              ? `${API_URL}${fase.listPath}?page=${trabajo.page}&per_page=${PER_PAGE}`
              : `${API_URL}${fase.listPath}/${trabajo.id}`

          try {
            const res = await axios.get(url, {
              headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
              timeout: 30_000,
            })

            if (trabajo.kind === 'list') {
              writeFileSync(
                join(BACKUP_DIR, fase.listDir, `page-${pad(trabajo.page)}.json`),
                JSON.stringify(res.data, null, 2),
                'utf-8',
              )
              console.log(`  ✓ ${fase.nombre} listado página ${trabajo.page}/${res.data?.pagination?.total_pages ?? '?'}`)
            } else {
              writeFileSync(
                join(BACKUP_DIR, fase.detailDir, `${trabajo.id}.json`),
                JSON.stringify(res.data, null, 2),
                'utf-8',
              )
              totalSuccess++
              if (totalSuccess % 10 === 0) {
                console.log(`  ✓ ${fase.nombre}: ${totalSuccess} detalles en esta tanda (delay: ${delayMs}ms)`)
              }
            }

            successStreak++
            if (successStreak >= ACCELERATE_EVERY_N_SUCCESSES) {
              delayMs = Math.max(FLOOR_DELAY_MS, Math.round(delayMs * ACCELERATE_FACTOR))
              successStreak = 0
            }
          } catch (err) {
            const status = axios.isAxiosError(err) ? err.response?.status : undefined
            if (status === 429) {
              const retryAfter = axios.isAxiosError(err) ? err.response?.headers['retry-after'] : undefined
              writeNextAllowed(Number(retryAfter) || 3600)
              console.log(`\n🛑 429 en fase ${fase.nombre}. Requests de esta tanda: ${totalAttempts - 1} ok.`)
              console.log(`   Retry-After: ${retryAfter ?? '?'}s — próxima tanda anotada para dentro de ~61 min.`)
              return
            }
            logger.error(`Error en ${fase.nombre} (${JSON.stringify(trabajo)})`, {
              status,
              error: (err as Error).message,
            })
          }
        }

        // Cola agotada sin 429: recalcular (pueden aparecer detalles tras el listado)
      }

      console.log(`\n✅ Fase ${fase.nombre} COMPLETA (listado + detalles).`)
    }

    console.log(`\n🏁 EXTRACCIÓN COMPLETA: OTs, presupuestos y facturas respaldados.`)
    console.log(`   Puedes quitar el cron con: crontab -r`)
  } finally {
    releaseLock()
  }
}

main().catch((err) => {
  logger.error('Error fatal en calibrate-and-backup-ots', { error: err.message })
  releaseLock()
  process.exit(1)
})
