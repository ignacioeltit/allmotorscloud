export interface ConfiguracionManoObra {
  org_id: string

  // Tarifas hora por categoría
  valor_hora_mecanica: number
  valor_hora_mantencion: number
  valor_hora_diagnostico: number
  valor_hora_electricidad: number
  valor_hora_diesel: number

  // Precios por evento
  valor_alineacion_liviano: number | null
  valor_alineacion_camioneta: number | null
  valor_reprog_ecu_basica: number | null
  valor_reprog_dpf_egr: number | null
  valor_programacion_tpms: number | null

  // Precios por unidad
  valor_rectificado_disco: number | null
  valor_balanceo_rueda: number | null
  valor_montaje_neumatico: number | null

  moneda: string
  iva_porcentaje: number
  actualizado_en: string
}

export type ConfiguracionManoObraUpdate = Partial<
  Omit<ConfiguracionManoObra, 'org_id' | 'actualizado_en'>
>
