export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          accion: string
          actor_id: string | null
          actor_rol: string | null
          cambios: Json | null
          canal: string | null
          created_at: string
          entidad: string
          entidad_id: string
          id: string
          ip_origen: unknown
          org_id: string | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad: string
          entidad_id: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad?: string
          entidad_id?: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Relationships: []
      }
      audit_log_2020: {
        Row: {
          accion: string
          actor_id: string | null
          actor_rol: string | null
          cambios: Json | null
          canal: string | null
          created_at: string
          entidad: string
          entidad_id: string
          id: string
          ip_origen: unknown
          org_id: string | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad: string
          entidad_id: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad?: string
          entidad_id?: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Relationships: []
      }
      audit_log_2021: {
        Row: {
          accion: string
          actor_id: string | null
          actor_rol: string | null
          cambios: Json | null
          canal: string | null
          created_at: string
          entidad: string
          entidad_id: string
          id: string
          ip_origen: unknown
          org_id: string | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad: string
          entidad_id: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad?: string
          entidad_id?: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Relationships: []
      }
      audit_log_2022: {
        Row: {
          accion: string
          actor_id: string | null
          actor_rol: string | null
          cambios: Json | null
          canal: string | null
          created_at: string
          entidad: string
          entidad_id: string
          id: string
          ip_origen: unknown
          org_id: string | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad: string
          entidad_id: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad?: string
          entidad_id?: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Relationships: []
      }
      audit_log_2023: {
        Row: {
          accion: string
          actor_id: string | null
          actor_rol: string | null
          cambios: Json | null
          canal: string | null
          created_at: string
          entidad: string
          entidad_id: string
          id: string
          ip_origen: unknown
          org_id: string | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad: string
          entidad_id: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad?: string
          entidad_id?: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Relationships: []
      }
      audit_log_2024: {
        Row: {
          accion: string
          actor_id: string | null
          actor_rol: string | null
          cambios: Json | null
          canal: string | null
          created_at: string
          entidad: string
          entidad_id: string
          id: string
          ip_origen: unknown
          org_id: string | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad: string
          entidad_id: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad?: string
          entidad_id?: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Relationships: []
      }
      audit_log_2025: {
        Row: {
          accion: string
          actor_id: string | null
          actor_rol: string | null
          cambios: Json | null
          canal: string | null
          created_at: string
          entidad: string
          entidad_id: string
          id: string
          ip_origen: unknown
          org_id: string | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad: string
          entidad_id: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad?: string
          entidad_id?: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_q1: {
        Row: {
          accion: string
          actor_id: string | null
          actor_rol: string | null
          cambios: Json | null
          canal: string | null
          created_at: string
          entidad: string
          entidad_id: string
          id: string
          ip_origen: unknown
          org_id: string | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad: string
          entidad_id: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad?: string
          entidad_id?: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_q2: {
        Row: {
          accion: string
          actor_id: string | null
          actor_rol: string | null
          cambios: Json | null
          canal: string | null
          created_at: string
          entidad: string
          entidad_id: string
          id: string
          ip_origen: unknown
          org_id: string | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad: string
          entidad_id: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad?: string
          entidad_id?: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_q3: {
        Row: {
          accion: string
          actor_id: string | null
          actor_rol: string | null
          cambios: Json | null
          canal: string | null
          created_at: string
          entidad: string
          entidad_id: string
          id: string
          ip_origen: unknown
          org_id: string | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad: string
          entidad_id: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad?: string
          entidad_id?: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_q4: {
        Row: {
          accion: string
          actor_id: string | null
          actor_rol: string | null
          cambios: Json | null
          canal: string | null
          created_at: string
          entidad: string
          entidad_id: string
          id: string
          ip_origen: unknown
          org_id: string | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad: string
          entidad_id: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad?: string
          entidad_id?: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Relationships: []
      }
      audit_log_2027_q1: {
        Row: {
          accion: string
          actor_id: string | null
          actor_rol: string | null
          cambios: Json | null
          canal: string | null
          created_at: string
          entidad: string
          entidad_id: string
          id: string
          ip_origen: unknown
          org_id: string | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad: string
          entidad_id: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_rol?: string | null
          cambios?: Json | null
          canal?: string | null
          created_at?: string
          entidad?: string
          entidad_id?: string
          id?: string
          ip_origen?: unknown
          org_id?: string | null
        }
        Relationships: []
      }
      cargos_ot: {
        Row: {
          actualizado_en: string
          aplica_iva: boolean
          concepto: string
          creado_en: string
          creado_por: string
          descripcion: string | null
          id: string
          monto: number
          orden_trabajo_id: string
          org_id: string
          tipo_cargo: string
        }
        Insert: {
          actualizado_en?: string
          aplica_iva?: boolean
          concepto: string
          creado_en?: string
          creado_por: string
          descripcion?: string | null
          id?: string
          monto?: number
          orden_trabajo_id: string
          org_id: string
          tipo_cargo?: string
        }
        Update: {
          actualizado_en?: string
          aplica_iva?: boolean
          concepto?: string
          creado_en?: string
          creado_por?: string
          descripcion?: string | null
          id?: string
          monto?: number
          orden_trabajo_id?: string
          org_id?: string
          tipo_cargo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargos_ot_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_ot_orden_trabajo_id_fkey"
            columns: ["orden_trabajo_id"]
            isOneToOne: false
            referencedRelation: "ordenes_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_ot_orden_trabajo_id_fkey"
            columns: ["orden_trabajo_id"]
            isOneToOne: false
            referencedRelation: "v_ot_totales"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_servicios: {
        Row: {
          activo: boolean
          actualizado_en: string
          categoria: string | null
          codigo: string | null
          creado_en: string
          descripcion: string | null
          eliminado_en: string | null
          es_checklist: boolean
          frecuencia_uso: number | null
          fuente: string
          horas_estandar: number | null
          id: string
          nombre: string
          org_id: string
          precio_unitario: number
          requiere_revision: boolean
          tallergp_reference: string | null
          unidad_precio: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          categoria?: string | null
          codigo?: string | null
          creado_en?: string
          descripcion?: string | null
          eliminado_en?: string | null
          es_checklist?: boolean
          frecuencia_uso?: number | null
          fuente?: string
          horas_estandar?: number | null
          id?: string
          nombre: string
          org_id: string
          precio_unitario?: number
          requiere_revision?: boolean
          tallergp_reference?: string | null
          unidad_precio?: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          categoria?: string | null
          codigo?: string | null
          creado_en?: string
          descripcion?: string | null
          eliminado_en?: string | null
          es_checklist?: boolean
          frecuencia_uso?: number | null
          fuente?: string
          horas_estandar?: number | null
          id?: string
          nombre?: string
          org_id?: string
          precio_unitario?: number
          requiere_revision?: boolean
          tallergp_reference?: string | null
          unidad_precio?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_servicios_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      citas: {
        Row: {
          actualizado_en: string
          asignado_a: string | null
          cliente_id: string | null
          conductor_id: string | null
          creado_en: string
          creado_por: string
          duracion_estimada_min: number | null
          eliminado_en: string | null
          eliminado_por: string | null
          estado: string
          fecha_cita: string
          id: string
          notas: string | null
          org_id: string
          recepcion_evento_id: string | null
          sucursal_id: string | null
          tipo_servicio: string | null
          vehiculo_id: string
        }
        Insert: {
          actualizado_en?: string
          asignado_a?: string | null
          cliente_id?: string | null
          conductor_id?: string | null
          creado_en?: string
          creado_por: string
          duracion_estimada_min?: number | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: string
          fecha_cita: string
          id?: string
          notas?: string | null
          org_id: string
          recepcion_evento_id?: string | null
          sucursal_id?: string | null
          tipo_servicio?: string | null
          vehiculo_id: string
        }
        Update: {
          actualizado_en?: string
          asignado_a?: string | null
          cliente_id?: string | null
          conductor_id?: string | null
          creado_en?: string
          creado_por?: string
          duracion_estimada_min?: number | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: string
          fecha_cita?: string
          id?: string
          notas?: string | null
          org_id?: string
          recepcion_evento_id?: string | null
          sucursal_id?: string | null
          tipo_servicio?: string | null
          vehiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "citas_asignado_a_fkey"
            columns: ["asignado_a"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_eliminado_por_fkey"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_recepcion_evento_id_fkey"
            columns: ["recepcion_evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          actualizado_en: string
          creado_en: string
          creado_por: string | null
          direccion: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          email: string | null
          id: string
          nombre: string
          notas: string | null
          org_id: string
          rut: string | null
          telefono: string | null
          tipo: string
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          direccion?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          id?: string
          nombre: string
          notas?: string | null
          org_id: string
          rut?: string | null
          telefono?: string | null
          tipo?: string
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          direccion?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          org_id?: string
          rut?: string | null
          telefono?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_eliminado_por_fkey"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      conductores: {
        Row: {
          actualizado_en: string
          creado_en: string
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          email: string | null
          id: string
          licencia_tipo: string | null
          licencia_vencimiento: string | null
          nombre: string
          org_id: string
          rut: string | null
          telefono: string | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          id?: string
          licencia_tipo?: string | null
          licencia_vencimiento?: string | null
          nombre: string
          org_id: string
          rut?: string | null
          telefono?: string | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          id?: string
          licencia_tipo?: string | null
          licencia_vencimiento?: string | null
          nombre?: string
          org_id?: string
          rut?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conductores_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conductores_eliminado_por_fkey"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conductores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_mano_obra: {
        Row: {
          actualizado_en: string
          iva_porcentaje: number
          moneda: string
          org_id: string
          valor_alineacion_camioneta: number | null
          valor_alineacion_liviano: number | null
          valor_balanceo_rueda: number | null
          valor_hora_mantencion: number
          valor_hora_mecanica: number
          valor_montaje_neumatico: number | null
          valor_programacion_tpms: number | null
          valor_rectificado_disco: number | null
          valor_reprog_dpf_egr: number | null
          valor_reprog_ecu_basica: number | null
        }
        Insert: {
          actualizado_en?: string
          iva_porcentaje?: number
          moneda?: string
          org_id: string
          valor_alineacion_camioneta?: number | null
          valor_alineacion_liviano?: number | null
          valor_balanceo_rueda?: number | null
          valor_hora_mantencion?: number
          valor_hora_mecanica?: number
          valor_montaje_neumatico?: number | null
          valor_programacion_tpms?: number | null
          valor_rectificado_disco?: number | null
          valor_reprog_dpf_egr?: number | null
          valor_reprog_ecu_basica?: number | null
        }
        Update: {
          actualizado_en?: string
          iva_porcentaje?: number
          moneda?: string
          org_id?: string
          valor_alineacion_camioneta?: number | null
          valor_alineacion_liviano?: number | null
          valor_balanceo_rueda?: number | null
          valor_hora_mantencion?: number
          valor_hora_mecanica?: number
          valor_montaje_neumatico?: number | null
          valor_programacion_tpms?: number | null
          valor_rectificado_disco?: number | null
          valor_reprog_dpf_egr?: number | null
          valor_reprog_ecu_basica?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_mano_obra_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas: {
        Row: {
          conductor_retiro_id: string | null
          creado_en: string
          creado_por: string
          forma_pago: string | null
          id: string
          km_salida: number | null
          monto_pagado: number | null
          notas: string | null
          orden_trabajo_id: string
          org_id: string
        }
        Insert: {
          conductor_retiro_id?: string | null
          creado_en?: string
          creado_por: string
          forma_pago?: string | null
          id?: string
          km_salida?: number | null
          monto_pagado?: number | null
          notas?: string | null
          orden_trabajo_id: string
          org_id: string
        }
        Update: {
          conductor_retiro_id?: string | null
          creado_en?: string
          creado_por?: string
          forma_pago?: string | null
          id?: string
          km_salida?: number | null
          monto_pagado?: number | null
          notas?: string | null
          orden_trabajo_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregas_conductor_retiro_id_fkey"
            columns: ["conductor_retiro_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_orden_trabajo_id_fkey"
            columns: ["orden_trabajo_id"]
            isOneToOne: true
            referencedRelation: "ordenes_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_orden_trabajo_id_fkey"
            columns: ["orden_trabajo_id"]
            isOneToOne: true
            referencedRelation: "v_ot_totales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          actualizado_en: string
          asignado_a: string | null
          cancelado_en: string | null
          cancelado_por: string | null
          cerrado_en: string | null
          conductor_id: string | null
          creado_en: string
          creado_por: string
          descripcion: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          estado: string
          historia_tecnica_id: string
          id: string
          km_vehiculo: number | null
          orden_trabajo_id: string | null
          org_id: string
          razon_cancelacion: string | null
          sucursal_id: string | null
          tipo_evento_id: string
          titulo: string | null
          visible_cliente: boolean
        }
        Insert: {
          actualizado_en?: string
          asignado_a?: string | null
          cancelado_en?: string | null
          cancelado_por?: string | null
          cerrado_en?: string | null
          conductor_id?: string | null
          creado_en?: string
          creado_por: string
          descripcion?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: string
          historia_tecnica_id: string
          id?: string
          km_vehiculo?: number | null
          orden_trabajo_id?: string | null
          org_id: string
          razon_cancelacion?: string | null
          sucursal_id?: string | null
          tipo_evento_id: string
          titulo?: string | null
          visible_cliente?: boolean
        }
        Update: {
          actualizado_en?: string
          asignado_a?: string | null
          cancelado_en?: string | null
          cancelado_por?: string | null
          cerrado_en?: string | null
          conductor_id?: string | null
          creado_en?: string
          creado_por?: string
          descripcion?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: string
          historia_tecnica_id?: string
          id?: string
          km_vehiculo?: number | null
          orden_trabajo_id?: string | null
          org_id?: string
          razon_cancelacion?: string | null
          sucursal_id?: string | null
          tipo_evento_id?: string
          titulo?: string | null
          visible_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "eventos_asignado_a_fkey"
            columns: ["asignado_a"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_eliminado_por_fkey"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_historia_tecnica_id_fkey"
            columns: ["historia_tecnica_id"]
            isOneToOne: false
            referencedRelation: "historias_tecnicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_tipo_evento_id_fkey"
            columns: ["tipo_evento_id"]
            isOneToOne: false
            referencedRelation: "tipos_evento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_eventos_orden_trabajo_id"
            columns: ["orden_trabajo_id"]
            isOneToOne: false
            referencedRelation: "ordenes_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_eventos_orden_trabajo_id"
            columns: ["orden_trabajo_id"]
            isOneToOne: false
            referencedRelation: "v_ot_totales"
            referencedColumns: ["id"]
          },
        ]
      }
      evidencias: {
        Row: {
          bucket_path: string
          creado_en: string
          creado_por: string
          descripcion: string | null
          evento_id: string
          id: string
          mime_type: string
          nombre_original: string | null
          org_id: string
          signed_url_cache: string | null
          tamano_bytes: number
          tipo: string
          url_expires_at: string | null
          visible_cliente: boolean
        }
        Insert: {
          bucket_path: string
          creado_en?: string
          creado_por: string
          descripcion?: string | null
          evento_id: string
          id?: string
          mime_type: string
          nombre_original?: string | null
          org_id: string
          signed_url_cache?: string | null
          tamano_bytes: number
          tipo: string
          url_expires_at?: string | null
          visible_cliente?: boolean
        }
        Update: {
          bucket_path?: string
          creado_en?: string
          creado_por?: string
          descripcion?: string | null
          evento_id?: string
          id?: string
          mime_type?: string
          nombre_original?: string | null
          org_id?: string
          signed_url_cache?: string | null
          tamano_bytes?: number
          tipo?: string
          url_expires_at?: string | null
          visible_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "evidencias_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidencias_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidencias_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      garantias: {
        Row: {
          actualizado_en: string
          condiciones: string | null
          creado_en: string
          creado_por: string
          descripcion: string
          estado: string
          fecha_inicio: string
          fecha_vencimiento: string | null
          id: string
          km_vencimiento: number | null
          org_id: string
          reclamada_en: string | null
          reclamada_por: string | null
          reparacion_id: string
          resolucion: string | null
        }
        Insert: {
          actualizado_en?: string
          condiciones?: string | null
          creado_en?: string
          creado_por: string
          descripcion: string
          estado?: string
          fecha_inicio?: string
          fecha_vencimiento?: string | null
          id?: string
          km_vencimiento?: number | null
          org_id: string
          reclamada_en?: string | null
          reclamada_por?: string | null
          reparacion_id: string
          resolucion?: string | null
        }
        Update: {
          actualizado_en?: string
          condiciones?: string | null
          creado_en?: string
          creado_por?: string
          descripcion?: string
          estado?: string
          fecha_inicio?: string
          fecha_vencimiento?: string | null
          id?: string
          km_vencimiento?: number | null
          org_id?: string
          reclamada_en?: string | null
          reclamada_por?: string | null
          reparacion_id?: string
          resolucion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garantias_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantias_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantias_reparacion_id_fkey"
            columns: ["reparacion_id"]
            isOneToOne: false
            referencedRelation: "reparaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      historias_tecnicas: {
        Row: {
          actualizado_en: string
          creado_en: string
          id: string
          notas: string | null
          org_id: string
          vehiculo_id: string
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          id?: string
          notas?: string | null
          org_id: string
          vehiculo_id: string
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          id?: string
          notas?: string | null
          org_id?: string
          vehiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historias_tecnicas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historias_tecnicas_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: true
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      items_plantilla: {
        Row: {
          cantidad: number
          codigo_externo: string | null
          creado_en: string
          es_cabecera: boolean
          es_checklist: boolean
          id: string
          nombre: string
          obligatorio: boolean
          orden: number
          plantilla_id: string
          precio_unitario: number | null
          repuesto_id: string | null
          servicio_id: string | null
          tipo: string
        }
        Insert: {
          cantidad?: number
          codigo_externo?: string | null
          creado_en?: string
          es_cabecera?: boolean
          es_checklist?: boolean
          id?: string
          nombre: string
          obligatorio?: boolean
          orden?: number
          plantilla_id: string
          precio_unitario?: number | null
          repuesto_id?: string | null
          servicio_id?: string | null
          tipo: string
        }
        Update: {
          cantidad?: number
          codigo_externo?: string | null
          creado_en?: string
          es_cabecera?: boolean
          es_checklist?: boolean
          id?: string
          nombre?: string
          obligatorio?: boolean
          orden?: number
          plantilla_id?: string
          precio_unitario?: number | null
          repuesto_id?: string | null
          servicio_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_plantilla_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "plantillas_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_plantilla_repuesto_id_fkey"
            columns: ["repuesto_id"]
            isOneToOne: false
            referencedRelation: "repuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_plantilla_repuesto_id_fkey"
            columns: ["repuesto_id"]
            isOneToOne: false
            referencedRelation: "v_repuestos_bajo_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_plantilla_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "catalogo_servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      items_presupuesto: {
        Row: {
          actualizado_en: string
          autorizador_id: string | null
          cantidad: number
          creado_en: string
          creado_por: string
          descripcion: string
          descuento_porcentaje: number
          eliminado_en: string | null
          eliminado_por: string | null
          id: string
          org_id: string
          precio_total: number
          precio_unitario: number
          presupuesto_id: string
          repuesto_id: string | null
          tipo: string
        }
        Insert: {
          actualizado_en?: string
          autorizador_id?: string | null
          cantidad?: number
          creado_en?: string
          creado_por: string
          descripcion: string
          descuento_porcentaje?: number
          eliminado_en?: string | null
          eliminado_por?: string | null
          id?: string
          org_id: string
          precio_total: number
          precio_unitario: number
          presupuesto_id: string
          repuesto_id?: string | null
          tipo: string
        }
        Update: {
          actualizado_en?: string
          autorizador_id?: string | null
          cantidad?: number
          creado_en?: string
          creado_por?: string
          descripcion?: string
          descuento_porcentaje?: number
          eliminado_en?: string | null
          eliminado_por?: string | null
          id?: string
          org_id?: string
          precio_total?: number
          precio_unitario?: number
          presupuesto_id?: string
          repuesto_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_items_presupuesto_repuesto_id"
            columns: ["repuesto_id"]
            isOneToOne: false
            referencedRelation: "repuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_items_presupuesto_repuesto_id"
            columns: ["repuesto_id"]
            isOneToOne: false
            referencedRelation: "v_repuestos_bajo_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_presupuesto_autorizador_id_fkey"
            columns: ["autorizador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_presupuesto_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_presupuesto_eliminado_por_fkey"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_presupuesto_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_presupuesto_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      items_reparacion: {
        Row: {
          actualizado_en: string
          cantidad: number
          costo_total: number
          costo_unitario: number
          creado_en: string
          creado_por: string
          descripcion: string
          eliminado_en: string | null
          eliminado_por: string | null
          fin_en: string | null
          horas_estandar_snapshot: number | null
          id: string
          inicio_en: string | null
          item_presupuesto_id: string | null
          nombre_servicio_snapshot: string | null
          org_id: string
          plantilla_id: string | null
          precio_catalogo_snapshot: number | null
          reparacion_id: string
          repuesto_id: string | null
          servicio_catalogo_id: string | null
          tipo: string
          valor_hora_snapshot: number | null
        }
        Insert: {
          actualizado_en?: string
          cantidad?: number
          costo_total: number
          costo_unitario: number
          creado_en?: string
          creado_por: string
          descripcion: string
          eliminado_en?: string | null
          eliminado_por?: string | null
          fin_en?: string | null
          horas_estandar_snapshot?: number | null
          id?: string
          inicio_en?: string | null
          item_presupuesto_id?: string | null
          nombre_servicio_snapshot?: string | null
          org_id: string
          plantilla_id?: string | null
          precio_catalogo_snapshot?: number | null
          reparacion_id: string
          repuesto_id?: string | null
          servicio_catalogo_id?: string | null
          tipo: string
          valor_hora_snapshot?: number | null
        }
        Update: {
          actualizado_en?: string
          cantidad?: number
          costo_total?: number
          costo_unitario?: number
          creado_en?: string
          creado_por?: string
          descripcion?: string
          eliminado_en?: string | null
          eliminado_por?: string | null
          fin_en?: string | null
          horas_estandar_snapshot?: number | null
          id?: string
          inicio_en?: string | null
          item_presupuesto_id?: string | null
          nombre_servicio_snapshot?: string | null
          org_id?: string
          plantilla_id?: string | null
          precio_catalogo_snapshot?: number | null
          reparacion_id?: string
          repuesto_id?: string | null
          servicio_catalogo_id?: string | null
          tipo?: string
          valor_hora_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_items_reparacion_repuesto_id"
            columns: ["repuesto_id"]
            isOneToOne: false
            referencedRelation: "repuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_items_reparacion_repuesto_id"
            columns: ["repuesto_id"]
            isOneToOne: false
            referencedRelation: "v_repuestos_bajo_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_reparacion_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_reparacion_eliminado_por_fkey"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_reparacion_item_presupuesto_id_fkey"
            columns: ["item_presupuesto_id"]
            isOneToOne: false
            referencedRelation: "items_presupuesto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_reparacion_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_reparacion_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "plantillas_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_reparacion_reparacion_id_fkey"
            columns: ["reparacion_id"]
            isOneToOne: false
            referencedRelation: "reparaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_reparacion_servicio_catalogo_id_fkey"
            columns: ["servicio_catalogo_id"]
            isOneToOne: false
            referencedRelation: "catalogo_servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_stock: {
        Row: {
          actor_id: string
          cantidad: number
          costo_unitario: number | null
          creado_en: string
          id: string
          motivo: string | null
          org_id: string
          precio_venta_unitario: number | null
          referencia_id: string | null
          referencia_tipo: string | null
          repuesto_id: string
          stock_antes: number
          stock_despues: number
          tipo: string
        }
        Insert: {
          actor_id: string
          cantidad: number
          costo_unitario?: number | null
          creado_en?: string
          id?: string
          motivo?: string | null
          org_id: string
          precio_venta_unitario?: number | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          repuesto_id: string
          stock_antes: number
          stock_despues: number
          tipo: string
        }
        Update: {
          actor_id?: string
          cantidad?: number
          costo_unitario?: number | null
          creado_en?: string
          id?: string
          motivo?: string | null
          org_id?: string
          precio_venta_unitario?: number | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          repuesto_id?: string
          stock_antes?: number
          stock_despues?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_stock_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_stock_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_stock_repuesto_id_fkey"
            columns: ["repuesto_id"]
            isOneToOne: false
            referencedRelation: "repuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_stock_repuesto_id_fkey"
            columns: ["repuesto_id"]
            isOneToOne: false
            referencedRelation: "v_repuestos_bajo_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes_trabajo: {
        Row: {
          actualizado_en: string
          cerrado_en: string | null
          creado_en: string
          creado_por: string
          eliminado_en: string | null
          eliminado_por: string | null
          estado: string
          fecha_prometida_entrega: string | null
          id: string
          km_ingreso: number | null
          notas: string | null
          numero_ot: string
          org_id: string
          recepcionista_id: string | null
          sucursal_id: string | null
          vehiculo_id: string
        }
        Insert: {
          actualizado_en?: string
          cerrado_en?: string | null
          creado_en?: string
          creado_por: string
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: string
          fecha_prometida_entrega?: string | null
          id?: string
          km_ingreso?: number | null
          notas?: string | null
          numero_ot: string
          org_id: string
          recepcionista_id?: string | null
          sucursal_id?: string | null
          vehiculo_id: string
        }
        Update: {
          actualizado_en?: string
          cerrado_en?: string | null
          creado_en?: string
          creado_por?: string
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: string
          fecha_prometida_entrega?: string | null
          id?: string
          km_ingreso?: number | null
          notas?: string | null
          numero_ot?: string
          org_id?: string
          recepcionista_id?: string | null
          sucursal_id?: string | null
          vehiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_trabajo_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_trabajo_eliminado_por_fkey"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_trabajo_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_trabajo_recepcionista_id_fkey"
            columns: ["recepcionista_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_trabajo_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_trabajo_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      organizaciones: {
        Row: {
          actualizado_en: string
          ciudad: string | null
          configuracion: Json
          creado_en: string
          creado_por: string | null
          direccion: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          email: string | null
          id: string
          logo_url: string | null
          nombre: string
          rut: string
          slug: string
          telefono: string | null
        }
        Insert: {
          actualizado_en?: string
          ciudad?: string | null
          configuracion?: Json
          creado_en?: string
          creado_por?: string | null
          direccion?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          nombre: string
          rut: string
          slug: string
          telefono?: string | null
        }
        Update: {
          actualizado_en?: string
          ciudad?: string | null
          configuracion?: Json
          creado_en?: string
          creado_por?: string | null
          direccion?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          nombre?: string
          rut?: string
          slug?: string
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_organizaciones_creado_por"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_organizaciones_eliminado_por"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      permisos_rol: {
        Row: {
          actualizado_en: string
          creado_en: string
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          id: string
          nombre_permiso: string
          org_id: string
          rol_id: string
          valor: boolean
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          id?: string
          nombre_permiso: string
          org_id: string
          rol_id: string
          valor?: boolean
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          id?: string
          nombre_permiso?: string
          org_id?: string
          rol_id?: string
          valor?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "permisos_rol_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permisos_rol_eliminado_por_fkey"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permisos_rol_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permisos_rol_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas_trabajo: {
        Row: {
          activo: boolean
          actualizado_en: string
          categoria: string | null
          codigo: string | null
          creado_en: string
          descripcion: string | null
          eliminado_en: string | null
          frecuencia_uso: number
          fuente: string
          id: string
          nombre: string
          org_id: string
          precio_cabecera: number | null
          tallergp_package_id: string | null
          tipo_precio: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          categoria?: string | null
          codigo?: string | null
          creado_en?: string
          descripcion?: string | null
          eliminado_en?: string | null
          frecuencia_uso?: number
          fuente?: string
          id?: string
          nombre: string
          org_id: string
          precio_cabecera?: number | null
          tallergp_package_id?: string | null
          tipo_precio?: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          categoria?: string | null
          codigo?: string | null
          creado_en?: string
          descripcion?: string | null
          eliminado_en?: string | null
          frecuencia_uso?: number
          fuente?: string
          id?: string
          nombre?: string
          org_id?: string
          precio_cabecera?: number | null
          tallergp_package_id?: string | null
          tipo_precio?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_trabajo_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuestos: {
        Row: {
          actualizado_en: string
          autorizado_en: string | null
          autorizado_por_nombre: string | null
          creado_en: string
          creado_por: string
          eliminado_en: string | null
          eliminado_por: string | null
          enviado_en: string | null
          estado: string
          id: string
          notas: string | null
          orden_trabajo_id: string
          org_id: string
          presupuesto_anterior_id: string | null
          razon_rechazo: string | null
          rechazado_en: string | null
          total_descuentos: number
          total_mano_obra: number
          total_neto: number
          total_repuestos: number
          version: number
        }
        Insert: {
          actualizado_en?: string
          autorizado_en?: string | null
          autorizado_por_nombre?: string | null
          creado_en?: string
          creado_por: string
          eliminado_en?: string | null
          eliminado_por?: string | null
          enviado_en?: string | null
          estado?: string
          id?: string
          notas?: string | null
          orden_trabajo_id: string
          org_id: string
          presupuesto_anterior_id?: string | null
          razon_rechazo?: string | null
          rechazado_en?: string | null
          total_descuentos?: number
          total_mano_obra?: number
          total_neto?: number
          total_repuestos?: number
          version?: number
        }
        Update: {
          actualizado_en?: string
          autorizado_en?: string | null
          autorizado_por_nombre?: string | null
          creado_en?: string
          creado_por?: string
          eliminado_en?: string | null
          eliminado_por?: string | null
          enviado_en?: string | null
          estado?: string
          id?: string
          notas?: string | null
          orden_trabajo_id?: string
          org_id?: string
          presupuesto_anterior_id?: string | null
          razon_rechazo?: string | null
          rechazado_en?: string | null
          total_descuentos?: number
          total_mano_obra?: number
          total_neto?: number
          total_repuestos?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_presupuestos_anterior_id"
            columns: ["presupuesto_anterior_id"]
            isOneToOne: true
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_eliminado_por_fkey"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_orden_trabajo_id_fkey"
            columns: ["orden_trabajo_id"]
            isOneToOne: false
            referencedRelation: "ordenes_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_orden_trabajo_id_fkey"
            columns: ["orden_trabajo_id"]
            isOneToOne: false
            referencedRelation: "v_ot_totales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      propietarios_vehiculo: {
        Row: {
          actualizado_en: string
          cliente_id: string
          creado_en: string
          creado_por: string | null
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          notas: string | null
          org_id: string
          vehiculo_id: string
        }
        Insert: {
          actualizado_en?: string
          cliente_id: string
          creado_en?: string
          creado_por?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          notas?: string | null
          org_id: string
          vehiculo_id: string
        }
        Update: {
          actualizado_en?: string
          cliente_id?: string
          creado_en?: string
          creado_por?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          notas?: string | null
          org_id?: string
          vehiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "propietarios_vehiculo_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propietarios_vehiculo_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propietarios_vehiculo_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propietarios_vehiculo_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      referencias_evento: {
        Row: {
          creado_en: string
          creado_por: string
          eliminado_en: string | null
          eliminado_por: string | null
          evento_destino_id: string
          evento_origen_id: string
          id: string
          notas: string | null
          org_id: string
          tipo: string
        }
        Insert: {
          creado_en?: string
          creado_por: string
          eliminado_en?: string | null
          eliminado_por?: string | null
          evento_destino_id: string
          evento_origen_id: string
          id?: string
          notas?: string | null
          org_id: string
          tipo: string
        }
        Update: {
          creado_en?: string
          creado_por?: string
          eliminado_en?: string | null
          eliminado_por?: string | null
          evento_destino_id?: string
          evento_origen_id?: string
          id?: string
          notas?: string | null
          org_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "referencias_evento_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referencias_evento_eliminado_por_fkey"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referencias_evento_evento_destino_id_fkey"
            columns: ["evento_destino_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referencias_evento_evento_origen_id_fkey"
            columns: ["evento_origen_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referencias_evento_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      reparaciones: {
        Row: {
          actualizado_en: string
          creado_en: string
          creado_por: string
          descripcion: string | null
          evento_trabajo_id: string
          fin_en: string | null
          id: string
          inicio_en: string | null
          mecanico_id: string | null
          observaciones: string | null
          orden_trabajo_id: string
          org_id: string
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          creado_por: string
          descripcion?: string | null
          evento_trabajo_id: string
          fin_en?: string | null
          id?: string
          inicio_en?: string | null
          mecanico_id?: string | null
          observaciones?: string | null
          orden_trabajo_id: string
          org_id: string
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string
          descripcion?: string | null
          evento_trabajo_id?: string
          fin_en?: string | null
          id?: string
          inicio_en?: string | null
          mecanico_id?: string | null
          observaciones?: string | null
          orden_trabajo_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reparaciones_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reparaciones_evento_trabajo_id_fkey"
            columns: ["evento_trabajo_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reparaciones_mecanico_id_fkey"
            columns: ["mecanico_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reparaciones_orden_trabajo_id_fkey"
            columns: ["orden_trabajo_id"]
            isOneToOne: false
            referencedRelation: "ordenes_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reparaciones_orden_trabajo_id_fkey"
            columns: ["orden_trabajo_id"]
            isOneToOne: false
            referencedRelation: "v_ot_totales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reparaciones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      repuestos: {
        Row: {
          activo: boolean
          actualizado_en: string
          categoria: string | null
          codigo: string
          codigo_barra: string | null
          creado_en: string
          creado_por: string
          descripcion: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          id: string
          marca: string | null
          modelo_aplicacion: string | null
          nombre: string
          org_id: string
          precio_costo: number | null
          precio_venta: number | null
          proveedor: string | null
          stock_actual: number
          stock_minimo: number
          sucursal_id: string | null
          ubicacion: string | null
          unidad: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          categoria?: string | null
          codigo: string
          codigo_barra?: string | null
          creado_en?: string
          creado_por: string
          descripcion?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          id?: string
          marca?: string | null
          modelo_aplicacion?: string | null
          nombre: string
          org_id: string
          precio_costo?: number | null
          precio_venta?: number | null
          proveedor?: string | null
          stock_actual?: number
          stock_minimo?: number
          sucursal_id?: string | null
          ubicacion?: string | null
          unidad?: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          categoria?: string | null
          codigo?: string
          codigo_barra?: string | null
          creado_en?: string
          creado_por?: string
          descripcion?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          id?: string
          marca?: string | null
          modelo_aplicacion?: string | null
          nombre?: string
          org_id?: string
          precio_costo?: number | null
          precio_venta?: number | null
          proveedor?: string | null
          stock_actual?: number
          stock_minimo?: number
          sucursal_id?: string | null
          ubicacion?: string | null
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "repuestos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repuestos_eliminado_por_fkey"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repuestos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repuestos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          creado_en: string
          descripcion: string | null
          id: string
          nivel_acceso: number
          nombre: string
        }
        Insert: {
          creado_en?: string
          descripcion?: string | null
          id?: string
          nivel_acceso: number
          nombre: string
        }
        Update: {
          creado_en?: string
          descripcion?: string | null
          id?: string
          nivel_acceso?: number
          nombre?: string
        }
        Relationships: []
      }
      sucursales: {
        Row: {
          actualizado_en: string
          ciudad: string | null
          creado_en: string
          creado_por: string | null
          direccion: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          es_principal: boolean
          id: string
          nombre: string
          org_id: string
          telefono: string | null
        }
        Insert: {
          actualizado_en?: string
          ciudad?: string | null
          creado_en?: string
          creado_por?: string | null
          direccion?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          es_principal?: boolean
          id?: string
          nombre: string
          org_id: string
          telefono?: string | null
        }
        Update: {
          actualizado_en?: string
          ciudad?: string | null
          creado_en?: string
          creado_por?: string | null
          direccion?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          es_principal?: boolean
          id?: string
          nombre?: string
          org_id?: string
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sucursales_creado_por"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sucursales_eliminado_por"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucursales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_evento: {
        Row: {
          activo: boolean
          actualizado_en: string
          categoria: string
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          es_personalizado: boolean
          id: string
          nombre: string
          org_id: string
          slug: string
          tipo_evento_base_id: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          categoria: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          es_personalizado?: boolean
          id?: string
          nombre: string
          org_id: string
          slug: string
          tipo_evento_base_id?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          categoria?: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          es_personalizado?: boolean
          id?: string
          nombre?: string
          org_id?: string
          slug?: string
          tipo_evento_base_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tipos_evento_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tipos_evento_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tipos_evento_tipo_evento_base_id_fkey"
            columns: ["tipo_evento_base_id"]
            isOneToOne: false
            referencedRelation: "tipos_evento_base"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_evento_base: {
        Row: {
          creado_en: string
          genera_ot: boolean
          id: string
          nombre_visible: string
          slug: string
        }
        Insert: {
          creado_en?: string
          genera_ot?: boolean
          id?: string
          nombre_visible: string
          slug: string
        }
        Update: {
          creado_en?: string
          genera_ot?: boolean
          id?: string
          nombre_visible?: string
          slug?: string
        }
        Relationships: []
      }
      transiciones_evento: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          creado_en: string
          estado_anterior: string | null
          estado_nuevo: string
          evento_id: string
          id: string
          org_id: string
          razon: string | null
          vehiculo_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo: string
          evento_id: string
          id?: string
          org_id: string
          razon?: string | null
          vehiculo_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          evento_id?: string
          id?: string
          org_id?: string
          razon?: string | null
          vehiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_transiciones_evento_evento_id"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_transiciones_evento_vehiculo_id"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transiciones_evento_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      transiciones_evento_2020: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          creado_en: string
          estado_anterior: string | null
          estado_nuevo: string
          evento_id: string
          id: string
          org_id: string
          razon: string | null
          vehiculo_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo: string
          evento_id: string
          id?: string
          org_id: string
          razon?: string | null
          vehiculo_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          evento_id?: string
          id?: string
          org_id?: string
          razon?: string | null
          vehiculo_id?: string
        }
        Relationships: []
      }
      transiciones_evento_2021: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          creado_en: string
          estado_anterior: string | null
          estado_nuevo: string
          evento_id: string
          id: string
          org_id: string
          razon: string | null
          vehiculo_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo: string
          evento_id: string
          id?: string
          org_id: string
          razon?: string | null
          vehiculo_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          evento_id?: string
          id?: string
          org_id?: string
          razon?: string | null
          vehiculo_id?: string
        }
        Relationships: []
      }
      transiciones_evento_2022: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          creado_en: string
          estado_anterior: string | null
          estado_nuevo: string
          evento_id: string
          id: string
          org_id: string
          razon: string | null
          vehiculo_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo: string
          evento_id: string
          id?: string
          org_id: string
          razon?: string | null
          vehiculo_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          evento_id?: string
          id?: string
          org_id?: string
          razon?: string | null
          vehiculo_id?: string
        }
        Relationships: []
      }
      transiciones_evento_2023: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          creado_en: string
          estado_anterior: string | null
          estado_nuevo: string
          evento_id: string
          id: string
          org_id: string
          razon: string | null
          vehiculo_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo: string
          evento_id: string
          id?: string
          org_id: string
          razon?: string | null
          vehiculo_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          evento_id?: string
          id?: string
          org_id?: string
          razon?: string | null
          vehiculo_id?: string
        }
        Relationships: []
      }
      transiciones_evento_2024: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          creado_en: string
          estado_anterior: string | null
          estado_nuevo: string
          evento_id: string
          id: string
          org_id: string
          razon: string | null
          vehiculo_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo: string
          evento_id: string
          id?: string
          org_id: string
          razon?: string | null
          vehiculo_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          evento_id?: string
          id?: string
          org_id?: string
          razon?: string | null
          vehiculo_id?: string
        }
        Relationships: []
      }
      transiciones_evento_2025: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          creado_en: string
          estado_anterior: string | null
          estado_nuevo: string
          evento_id: string
          id: string
          org_id: string
          razon: string | null
          vehiculo_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo: string
          evento_id: string
          id?: string
          org_id: string
          razon?: string | null
          vehiculo_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          evento_id?: string
          id?: string
          org_id?: string
          razon?: string | null
          vehiculo_id?: string
        }
        Relationships: []
      }
      transiciones_evento_2026_q1: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          creado_en: string
          estado_anterior: string | null
          estado_nuevo: string
          evento_id: string
          id: string
          org_id: string
          razon: string | null
          vehiculo_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo: string
          evento_id: string
          id?: string
          org_id: string
          razon?: string | null
          vehiculo_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          evento_id?: string
          id?: string
          org_id?: string
          razon?: string | null
          vehiculo_id?: string
        }
        Relationships: []
      }
      transiciones_evento_2026_q2: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          creado_en: string
          estado_anterior: string | null
          estado_nuevo: string
          evento_id: string
          id: string
          org_id: string
          razon: string | null
          vehiculo_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo: string
          evento_id: string
          id?: string
          org_id: string
          razon?: string | null
          vehiculo_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          evento_id?: string
          id?: string
          org_id?: string
          razon?: string | null
          vehiculo_id?: string
        }
        Relationships: []
      }
      transiciones_evento_2026_q3: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          creado_en: string
          estado_anterior: string | null
          estado_nuevo: string
          evento_id: string
          id: string
          org_id: string
          razon: string | null
          vehiculo_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo: string
          evento_id: string
          id?: string
          org_id: string
          razon?: string | null
          vehiculo_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          evento_id?: string
          id?: string
          org_id?: string
          razon?: string | null
          vehiculo_id?: string
        }
        Relationships: []
      }
      transiciones_evento_2026_q4: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          creado_en: string
          estado_anterior: string | null
          estado_nuevo: string
          evento_id: string
          id: string
          org_id: string
          razon: string | null
          vehiculo_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo: string
          evento_id: string
          id?: string
          org_id: string
          razon?: string | null
          vehiculo_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          evento_id?: string
          id?: string
          org_id?: string
          razon?: string | null
          vehiculo_id?: string
        }
        Relationships: []
      }
      transiciones_evento_2027_q1: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          creado_en: string
          estado_anterior: string | null
          estado_nuevo: string
          evento_id: string
          id: string
          org_id: string
          razon: string | null
          vehiculo_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo: string
          evento_id: string
          id?: string
          org_id: string
          razon?: string | null
          vehiculo_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          creado_en?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          evento_id?: string
          id?: string
          org_id?: string
          razon?: string | null
          vehiculo_id?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          actualizado_en: string
          creado_en: string
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          email: string
          id: string
          nombre: string
          org_id: string
          rol_id: string
          sucursal_id: string | null
          telefono: string | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email: string
          id: string
          nombre: string
          org_id: string
          rol_id: string
          sucursal_id?: string | null
          telefono?: string | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string
          id?: string
          nombre?: string
          org_id?: string
          rol_id?: string
          sucursal_id?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_usuarios_creado_por"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_usuarios_eliminado_por"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      vehiculos: {
        Row: {
          actualizado_en: string
          anio: number | null
          color: string | null
          creado_en: string
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          id: string
          km_actual: number | null
          marca: string
          modelo: string
          notas: string | null
          org_id: string
          patente: string
          tipo: string
          vin: string | null
        }
        Insert: {
          actualizado_en?: string
          anio?: number | null
          color?: string | null
          creado_en?: string
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          id?: string
          km_actual?: number | null
          marca: string
          modelo: string
          notas?: string | null
          org_id: string
          patente: string
          tipo?: string
          vin?: string | null
        }
        Update: {
          actualizado_en?: string
          anio?: number | null
          color?: string | null
          creado_en?: string
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          id?: string
          km_actual?: number | null
          marca?: string
          modelo?: string
          notas?: string | null
          org_id?: string
          patente?: string
          tipo?: string
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehiculos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehiculos_eliminado_por_fkey"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehiculos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_ot_totales: {
        Row: {
          cantidad_trabajos: number | null
          estado: string | null
          id: string | null
          iva: number | null
          numero_ot: string | null
          org_id: string | null
          subtotal_exento_iva: number | null
          subtotal_mano_obra: number | null
          subtotal_neto_afecto: number | null
          subtotal_otros: number | null
          subtotal_repuestos: number | null
          total_con_iva: number | null
          total_descuentos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_trabajo_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      v_repuestos_bajo_stock: {
        Row: {
          categoria: string | null
          codigo: string | null
          id: string | null
          marca: string | null
          nombre: string | null
          org_id: string | null
          proveedor: string | null
          stock_actual: number | null
          stock_minimo: number | null
          ubicacion: string | null
          unidad: string | null
        }
        Insert: {
          categoria?: string | null
          codigo?: string | null
          id?: string | null
          marca?: string | null
          nombre?: string | null
          org_id?: string | null
          proveedor?: string | null
          stock_actual?: number | null
          stock_minimo?: number | null
          ubicacion?: string | null
          unidad?: string | null
        }
        Update: {
          categoria?: string | null
          codigo?: string | null
          id?: string | null
          marca?: string | null
          nombre?: string | null
          org_id?: string | null
          proveedor?: string | null
          stock_actual?: number | null
          stock_minimo?: number | null
          ubicacion?: string | null
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repuestos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      fn_audit_insert: {
        Args: {
          p_accion: string
          p_actor_id: string
          p_actor_rol: string
          p_entidad: string
          p_entidad_id: string
          p_estado_ant: Json
          p_estado_nuevo: Json
          p_org_id: string
        }
        Returns: undefined
      }
      mi_org_id: { Args: never; Returns: string }
      mi_rol: { Args: never; Returns: string }
      mi_sucursal_id: { Args: never; Returns: string }
      restore_deleted: {
        Args: { p_id: string; p_table: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soft_delete: {
        Args: { p_id: string; p_table: string }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
