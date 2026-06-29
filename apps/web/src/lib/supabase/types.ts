// Tipo del cliente Supabase compartido por las capas queries/mutations de los módulos.
//
// Nota: los tipos generados (`@allmotors/database/types`) aún no existen
// (pendiente `pnpm db:types` contra una instancia Supabase). Hasta entonces el
// cliente se tipa con el genérico por defecto y cada módulo define sus propias
// row types a mano en `types.ts`, fieles a las migraciones 001/002/003.

import type { SupabaseClient } from '@supabase/supabase-js'

/** Cliente Supabase ligado a la sesión del usuario (server o browser). RLS activo. */
export type DbClient = SupabaseClient
