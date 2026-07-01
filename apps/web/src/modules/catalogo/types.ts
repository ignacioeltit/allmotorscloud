// Tipos del módulo catálogo (tabla `catalogo_servicios`, M005 + M007).

export interface CatalogoServicio {
  id: string
  org_id: string
  codigo: string | null
  nombre: string
  descripcion: string | null
  categoria: string | null
  precio_unitario: number
  unidad_precio: string
  horas_estandar: number | null
  activo: boolean
  es_checklist: boolean
  fuente: string
  requiere_revision: boolean
  frecuencia_uso: number | null
  creado_en: string
  actualizado_en: string
  eliminado_en: string | null
}

export interface CrearServicioDesdeOTInput {
  nombre: string
  categoria: string
  precioUnitario: number
  horasEstandar?: number | null
}
