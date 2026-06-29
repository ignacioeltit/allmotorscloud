// Taxonomía de errores controlados del backend de la app.
//
// Toda query/mutation de los módulos lanza una de estas clases. Las capas
// superiores (hooks/componentes) las capturan y muestran `error.message` al usuario.
//
// Referencia: BACKEND_ARCHITECTURE §6 (verificación obligatoria de RLS) y §13.

import type { PostgrestError } from '@supabase/supabase-js'

/** Error base de la aplicación. `message` es seguro de mostrar al usuario (en español). */
export class AppError extends Error {
  /** Código estable para telemetría / manejo programático. */
  readonly code: string
  /** Causa original (PostgrestError, etc.), si aplica. */
  readonly cause?: unknown

  constructor(message: string, code: string, cause?: unknown) {
    super(message)
    this.name = new.target.name
    this.code = code
    this.cause = cause
  }
}

/** No hay sesión válida, o la sesión expiró, o falta `org_id` en el JWT. */
export class AuthError extends AppError {
  constructor(message = 'Sesión no válida o expirada. Vuelve a iniciar sesión.') {
    super(message, 'auth_error')
  }
}

/**
 * La operación afectó 0 filas pese a no haber error de Postgres.
 * Significa que RLS bloqueó la escritura/lectura o el id no pertenece al tenant.
 */
export class RlsError extends AppError {
  constructor(
    message = 'La operación fue bloqueada por permisos (RLS) o la sesión expiró.',
  ) {
    super(message, 'rls_blocked')
  }
}

/** Input inválido (Zod) o violación de CHECK / FK en la base. */
export class ValidationError extends AppError {
  /** Errores por campo, cuando provienen de Zod. */
  readonly fieldErrors?: Record<string, string[]>

  constructor(message: string, fieldErrors?: Record<string, string[]>, cause?: unknown) {
    super(message, 'validation_error', cause)
    this.fieldErrors = fieldErrors
  }
}

/** Violación de restricción única (ej: patente repetida, numero_ot repetido). */
export class ConflictError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'conflict', cause)
  }
}

/** El recurso solicitado no existe (o no es visible para el tenant via RLS). */
export class NotFoundError extends AppError {
  constructor(message = 'El recurso solicitado no existe o no es accesible.') {
    super(message, 'not_found')
  }
}

/** Error de base de datos no clasificado en las categorías anteriores. */
export class DatabaseError extends AppError {
  constructor(message = 'Error inesperado en la base de datos.', cause?: unknown) {
    super(message, 'database_error', cause)
  }
}

/**
 * Traduce un PostgrestError de Supabase a un `AppError` controlado.
 * Mapea los códigos SQLSTATE más relevantes para el dominio.
 */
export function mapPostgrestError(error: PostgrestError): AppError {
  switch (error.code) {
    case '23505': // unique_violation
      return new ConflictError(
        'Ya existe un registro con esos datos únicos (ej: patente o número repetido).',
        error,
      )
    case '23503': // foreign_key_violation
      return new ValidationError(
        'Referencia inválida: el registro relacionado no existe o pertenece a otra organización.',
        undefined,
        error,
      )
    case '23514': // check_violation
      return new ValidationError(
        'Uno de los valores no cumple las reglas de la base de datos.',
        undefined,
        error,
      )
    case '23502': // not_null_violation
      return new ValidationError('Falta un campo obligatorio.', undefined, error)
    case '42501': // insufficient_privilege
      return new RlsError()
    case 'PGRST116': // PostgREST: 0 filas donde se esperaba 1 (.single())
      return new NotFoundError()
    default:
      return new DatabaseError(
        'No se pudo completar la operación en la base de datos.',
        error,
      )
  }
}

/** Convierte un ZodError (vía `flatten()`) en un `ValidationError` controlado. */
export function validationErrorFromZod(flattened: {
  formErrors: string[]
  fieldErrors: Record<string, string[] | undefined>
}): ValidationError {
  const fieldErrors: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(flattened.fieldErrors)) {
    if (value && value.length > 0) fieldErrors[key] = value
  }
  const firstMessage =
    flattened.formErrors[0] ??
    Object.values(fieldErrors)[0]?.[0] ??
    'Los datos ingresados no son válidos.'
  return new ValidationError(firstMessage, fieldErrors)
}
