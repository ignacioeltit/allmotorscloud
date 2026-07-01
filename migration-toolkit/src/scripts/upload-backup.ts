/**
 * Sube el respaldo local (./exports/backup/) a un bucket privado de Supabase Storage.
 * Resumible vía manifest (_uploaded_manifest.json): solo sube lo que falte.
 *
 * Requiere en .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Ejecutar: npm run upload-backup
 */

import 'dotenv/config'
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs'
import { resolve, join, relative } from 'path'
import { createClient } from '@supabase/supabase-js'
import pLimit from 'p-limit'
import { logger } from '../utils/logger.js'

const BACKUP_DIR = resolve(process.env.EXPORT_DIR ?? './exports', 'backup')
const BUCKET = process.env.BACKUP_BUCKET ?? 'tallergp-backup'
const MANIFEST_PATH = join(BACKUP_DIR, '_uploaded_manifest.json')
const CONCURRENCY = 5

function loadManifest(): Set<string> {
  if (!existsSync(MANIFEST_PATH)) return new Set()
  try {
    return new Set(JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as string[])
  } catch {
    return new Set()
  }
}

function saveManifest(manifest: Set<string>): void {
  writeFileSync(MANIFEST_PATH, JSON.stringify([...manifest]), 'utf-8')
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
    } else if (entry.name.endsWith('.json') && entry.name !== '_uploaded_manifest.json') {
      out.push(full)
    }
  }
  return out
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en migration-toolkit/.env')
  }
  if (!existsSync(BACKUP_DIR)) {
    throw new Error(`No existe ${BACKUP_DIR}. Corre primero: npm run backup-full`)
  }

  const supabase = createClient(url, key)

  const { data: buckets, error: listBucketsErr } = await supabase.storage.listBuckets()
  if (listBucketsErr) throw listBucketsErr
  if (!buckets?.some((b) => b.name === BUCKET)) {
    logger.info(`Bucket '${BUCKET}' no existe. Creándolo como privado...`)
    const { error } = await supabase.storage.createBucket(BUCKET, { public: false })
    if (error) throw error
  }

  const manifest = loadManifest()
  const files = walk(BACKUP_DIR)
  const pending = files.filter((f) => !manifest.has(relative(BACKUP_DIR, f)))

  logger.info(`Archivos en respaldo local: ${files.length}. Pendientes de subir: ${pending.length}`)

  const limit = pLimit(CONCURRENCY)
  let done = 0
  let failed = 0

  await Promise.all(
    pending.map((file) =>
      limit(async () => {
        const relPath = relative(BACKUP_DIR, file)
        const content = readFileSync(file)
        const { error } = await supabase.storage.from(BUCKET).upload(relPath, content, {
          contentType: 'application/json',
          upsert: true,
        })
        if (error) {
          failed++
          logger.error(`Error subiendo ${relPath}`, { error: error.message })
          return
        }
        manifest.add(relPath)
        done++
        if (done % 100 === 0) {
          saveManifest(manifest)
          logger.info(`Subidos: ${done}/${pending.length}`)
        }
      })
    )
  )

  saveManifest(manifest)
  logger.info(`✅ Subida completa: ${done} nuevos, ${failed} con error. Total acumulado en manifest: ${manifest.size}`)
}

main().catch((err) => {
  logger.error('Error fatal en upload-backup', { error: err.message })
  process.exit(1)
})
