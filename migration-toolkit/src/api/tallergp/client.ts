import axios, { type AxiosInstance, type AxiosError } from 'axios'
import { getBearerToken, clearTokenCache } from './auth.js'
import { logger } from '../../utils/logger.js'

export interface PaginatedResponse<T> {
  pagination: {
    current_page: number
    per_page: number
    total_count: number
    total_pages: number
  }
  data: T[]
}

let instance: AxiosInstance | null = null

export function getClient(): AxiosInstance {
  if (instance) return instance

  const baseURL = process.env.TALLERGP_API_URL ?? 'https://api.tallergp.com'

  instance = axios.create({
    baseURL,
    timeout: 30_000,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })

  // Inyectar token en cada request
  instance.interceptors.request.use(async (config) => {
    const token = await getBearerToken()
    config.headers.Authorization = `Bearer ${token}`
    logger.debug(`→ ${config.method?.toUpperCase()} ${config.url}`, {
      params: config.params,
    })
    return config
  })

  // Manejo de errores + retry automático en 401
  instance.interceptors.response.use(
    (response) => {
      logger.debug(`← ${response.status} ${response.config.url}`)
      return response
    },
    async (error: AxiosError) => {
      const status = error.response?.status
      const url = error.config?.url

      if (status === 401) {
        logger.warn('Token inválido o expirado, renovando...', { url })
        clearTokenCache()
        // Reintentar una vez con token nuevo
        const token = await getBearerToken()
        if (error.config) {
          error.config.headers.Authorization = `Bearer ${token}`
          return instance!.request(error.config)
        }
      }

      if (status === 429) {
        const retryAfter = Number(error.response?.headers['retry-after'] ?? 5)
        logger.warn(`Rate limit alcanzado. Esperando ${retryAfter}s...`, { url })
        await sleep(retryAfter * 1000)
        if (error.config) return instance!.request(error.config)
      }

      const message = (error.response?.data as any)?.message ?? error.message
      logger.error(`Error API TallerGP`, { status, url, message })
      throw new TallerGPApiError(message, status ?? 0, url ?? '')
    }
  )

  return instance
}

export class TallerGPApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string
  ) {
    super(message)
    this.name = 'TallerGPApiError'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
