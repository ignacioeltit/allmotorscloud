import axios from 'axios'
import { logger } from '../../utils/logger.js'

interface TokenCache {
  accessToken: string
  expiresAt: number // epoch ms
}

let cache: TokenCache | null = null

/**
 * Devuelve un Bearer token válido.
 * Estrategia:
 *   1. Si TALLERGP_ACCESS_TOKEN está definido, lo usa directamente (token fijo).
 *   2. Si no, hace el flujo OAuth2 client_credentials con client_id + client_secret.
 *   3. Cachea el token hasta 60 seg antes de su expiración.
 */
export async function getBearerToken(): Promise<string> {
  // Opción A: token fijo desde entorno
  const fixedToken = process.env.TALLERGP_ACCESS_TOKEN
  if (fixedToken) {
    return fixedToken
  }

  // Opción B: OAuth2 client_credentials
  const clientId = process.env.TALLERGP_CLIENT_ID
  const clientSecret = process.env.TALLERGP_CLIENT_SECRET
  const tokenUrl = process.env.TALLERGP_TOKEN_URL ?? 'https://api.tallergp.com/oauth/token'

  if (!clientId || !clientSecret) {
    throw new Error(
      'Autenticación no configurada. Define TALLERGP_ACCESS_TOKEN ' +
      'o bien TALLERGP_CLIENT_ID + TALLERGP_CLIENT_SECRET en .env'
    )
  }

  // Usar token cacheado si sigue vigente
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    return cache.accessToken
  }

  logger.debug('Obteniendo nuevo token OAuth2...', { tokenUrl })

  const response = await axios.post(
    tokenUrl,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10_000,
    }
  )

  const { access_token, expires_in } = response.data as {
    access_token: string
    expires_in?: number
  }

  if (!access_token) {
    throw new Error('El servidor no devolvió access_token')
  }

  const ttl = (expires_in ?? 3600) * 1000
  cache = {
    accessToken: access_token,
    expiresAt: now + ttl - 60_000, // renovar 60s antes de expirar
  }

  logger.info('Token obtenido correctamente', {
    expira_en: `${Math.round(ttl / 60000)} min`,
  })

  return access_token
}

export function clearTokenCache(): void {
  cache = null
}
