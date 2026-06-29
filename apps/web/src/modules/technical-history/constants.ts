// Constantes del módulo technical-history (tabla `historias_tecnicas`).
//
// La historia técnica es 1:1 con el vehículo y la crea automáticamente un trigger
// al insertar el vehículo (migration 002). No tiene INSERT ni DELETE vía app.
// RLS: UPDATE solo para roles 'admin' y 'jefe_taller' (HIGH-SEC-1, migration 002).

/** Roles autorizados a editar la historia técnica (informativo; lo refuerza RLS). */
export const ROLES_EDITAN_HISTORIA = ['admin', 'jefe_taller'] as const
