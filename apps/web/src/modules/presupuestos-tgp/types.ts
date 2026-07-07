// Presupuestos históricos importados de TallerGP (tabla `presupuestos_tallergp`,
// migration 040). Son solo referencia para cargar sus líneas a una OT.

export type LineaTgp = {
  tipo: 'mano_obra' | 'repuesto' | 'otros'
  codigo: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  total: number
}

export interface PresupuestoTallerGp {
  id: string
  numero: string | null
  estado: string | null
  fecha: string | null
  cliente_nombre: string | null
  total_neto: number
  total_con_iva: number
  lineas: LineaTgp[]
}
