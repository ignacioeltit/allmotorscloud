/**
 * Verifica que las credenciales son válidas y la API responde.
 * Ejecutar antes del Explorer: npm run test-connection
 */

import 'dotenv/config'
import { getBearerToken } from '../api/tallergp/auth.js'
import { listCustomers } from '../api/tallergp/endpoints/customers.js'
import { logger } from '../utils/logger.js'

async function main(): Promise<void> {
  console.log('\n─── Test de Conexión — TallerGP API ───\n')

  // 1. Auth
  console.log('1. Autenticación...')
  try {
    const token = await getBearerToken()
    const preview = token.length > 20 ? `${token.slice(0, 10)}...${token.slice(-5)}` : '[token corto]'
    logger.info(`Token obtenido: ${preview}`)
  } catch (err) {
    logger.error('FALLO en autenticación', { error: (err as Error).message })
    process.exit(1)
  }

  // 2. Ping con el endpoint más simple
  console.log('\n2. Ping a /customers (1 registro)...')
  try {
    const res = await listCustomers({ page: 1, per_page: 1 })
    logger.info('Respuesta OK', {
      total_clientes: res.pagination.total_count,
      total_paginas: res.pagination.total_pages,
    })
    if (res.data.length > 0) {
      const c = res.data[0]
      logger.info('Primer cliente (preview)', {
        id: c.id,
        customer_number: c.customer_number,
        name: c.name,
      })
    }
  } catch (err) {
    logger.error('FALLO en GET /customers', { error: (err as Error).message })
    process.exit(1)
  }

  console.log('\n✅ Conexión exitosa. Todo listo para usar el Explorer.\n')
  console.log('   Próximo paso: npm run explore\n')
}

main().catch((err) => {
  logger.error('Error fatal', { error: err.message })
  process.exit(1)
})
