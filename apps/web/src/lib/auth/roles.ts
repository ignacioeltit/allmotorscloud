// Reglas de rol compartidas por la app.
//
// Espejo de la función SQL fn_es_gestion() (migration 058): costo de compra,
// utilidad y margen solo los ven admin, jefe de taller y recepción (asesor de
// servicio). La base de datos lo impone por su cuenta; aquí solo se decide qué
// pedir y qué mostrar.

export const ROLES_GESTION = ['admin', 'jefe_taller', 'recepcionista'] as const

export type RolGestion = (typeof ROLES_GESTION)[number]

/** true si el rol puede ver costos de compra, utilidad y margen. */
export function puedeVerCostos(rol: string | null | undefined): rol is RolGestion {
  return rol != null && (ROLES_GESTION as readonly string[]).includes(rol)
}
