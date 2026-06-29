// Constantes de dominio compartidas entre web y mobile.
// NUNCA importar aquí desde frameworks (no React, no Next.js, no Expo).

export const ESTADOS_OT = [
  'pendiente_diagnostico',
  'diagnosticada',
  'presupuesto_pendiente',
  'presupuesto_enviado',
  'autorizada',
  'en_reparacion',
  'control_calidad',
  'lista_para_entrega',
  'entregada',
  'cerrada',
  'cancelada',
] as const

export type EstadoOT = (typeof ESTADOS_OT)[number]

export const ESTADOS_OT_ACTIVOS: EstadoOT[] = [
  'pendiente_diagnostico',
  'diagnosticada',
  'presupuesto_pendiente',
  'presupuesto_enviado',
  'autorizada',
  'en_reparacion',
  'control_calidad',
  'lista_para_entrega',
  'entregada',
]

export const ESTADOS_EVENTO = [
  'creado',
  'pendiente',
  'asignado',
  'en_ejecucion',
  'en_espera',
  'finalizado',
  'cerrado',
  'cancelado',
] as const

export type EstadoEvento = (typeof ESTADOS_EVENTO)[number]

export const ROLES_USUARIO = [
  'admin',
  'jefe_taller',
  'recepcionista',
  'mecanico',
  'cliente_portal',
] as const
export type RolUsuario = (typeof ROLES_USUARIO)[number]

export const RESULTADO_GARANTIA = ['vigente', 'reclamada', 'vencida', 'rechazada'] as const
export type ResultadoGarantia = (typeof RESULTADO_GARANTIA)[number]
