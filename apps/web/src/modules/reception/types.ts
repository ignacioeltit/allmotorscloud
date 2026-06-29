// Tipos del flujo de Recepción.

import type { Cliente } from '@/modules/customers/types'
import type { Vehiculo, VehiculoCreateInput } from '@/modules/vehicles/types'
import type { HistoriaTecnica } from '@/modules/technical-history/types'
import type { Evento } from '@/modules/events/types'
import type { OrdenTrabajo } from '@/modules/repair-orders/types'
import type { ClienteCreateInput } from '@/modules/customers/types'

/** Estado del checklist: clave del ítem → marcado o no. */
export type ChecklistEstado = Record<string, boolean>

/** Datos extra de vehículo que no tienen columna y se guardan en vehiculo.notas. */
export interface VehiculoSpecsExtra {
  motor?: string
  combustible?: string
  transmision?: string
}

/** Ficha consolidada de un vehículo existente (para precargar la recepción). */
export interface FichaVehiculo {
  vehiculo: Vehiculo
  cliente: Cliente | null
  historia: HistoriaTecnica | null
  eventos: Evento[]
  ordenes: OrdenTrabajo[]
}

/** Input completo del flujo "Recibir vehículo". */
export interface RecibirVehiculoInput {
  /** id del tipo_evento con slug 'recepcion' (resuelto en el servidor). */
  tipoEventoRecepcionId: string
  /** Cliente existente (id) o datos para crear uno nuevo. */
  clienteId: string | null
  clienteNuevo: ClienteCreateInput | null
  /** Vehículo existente (id) o datos para crear uno nuevo (+ specs extra). */
  vehiculoId: string | null
  vehiculoNuevo: (VehiculoCreateInput & VehiculoSpecsExtra) | null
  /** Datos de la recepción. */
  motivo: string
  sintomas?: string
  observaciones?: string
  prioridad?: string
  km?: number
  checklist: ChecklistEstado
}

/** Resultado del flujo: la OT a la que redirigir. */
export interface ResultadoRecepcion {
  ordenTrabajoId: string
  numeroOt: string
  /** true si se reutilizó una OT activa preexistente del vehículo. */
  reused: boolean
}
