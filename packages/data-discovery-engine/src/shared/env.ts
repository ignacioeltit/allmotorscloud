import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'

const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../migration-toolkit/.env'),
  resolve(import.meta.dirname ?? __dirname, '../../../../migration-toolkit/.env'),
]

let loaded = false
for (const p of candidates) {
  if (existsSync(p)) {
    config({ path: p })
    loaded = true
    break
  }
}

if (!loaded) config() // fallback: busca .env en cwd
