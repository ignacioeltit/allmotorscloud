# 04 — Ciclo de Vida del Vehículo

**Estado:** Draft  
**Capítulo:** 04 de la Product Bible  
**Última actualización:** Junio 2026

---

## Objetivo de este capítulo

Documentar el vehículo como entidad central del sistema y todas las etapas de su ciclo de vida dentro del taller.

Este capítulo responde a la pregunta:
**¿Qué le ocurre a un vehículo desde que entra al taller hasta que sale, y qué queda registrado en cada paso?**

Todo el sistema gira alrededor de esta entidad.
No alrededor de la factura.
No alrededor de la orden de trabajo.
**Alrededor del vehículo.**

---

## Tabla de Contenidos

1. [El Vehículo como Entidad Principal](#1-el-vehículo-como-entidad-principal)
2. [Datos Identitarios del Vehículo](#2-datos-identitarios-del-vehículo)
3. [El Historial Técnico](#3-el-historial-técnico)
4. [Etapas del Ciclo de Vida en el Taller](#4-etapas-del-ciclo-de-vida-en-el-taller)
5. [Actores Involucrados](#5-actores-involucrados)
6. [Relaciones con Otras Entidades](#6-relaciones-con-otras-entidades)
7. [Información que No Debe Perderse Nunca](#7-información-que-no-debe-perderse-nunca)
8. [Evidencia Asociada al Vehículo](#8-evidencia-asociada-al-vehículo)

---

## 1. El Vehículo como Entidad Principal

> *Por completar.*

Secciones propuestas:
- Por qué el vehículo y no la OT ni la factura
- Qué implica que sea la entidad principal a nivel de modelo de datos
- Cómo se identifica un vehículo de forma única (patente, VIN)
- Casos borde: mismo vehículo con distintos dueños, vehículos sin VIN

---

## 2. Datos Identitarios del Vehículo

> *Por completar.*

Secciones propuestas:
- Campos mínimos obligatorios para registrar un vehículo
- Campos opcionales
- Marca y modelo: cómo se maneja el catálogo
- Identificadores externos: patente, VIN, código TallerGP
- Fotos del vehículo como dato identitario

---

## 3. El Historial Técnico

> *Por completar.*

El historial es el activo más importante del vehículo.
Debe contener **toda la vida del vehículo** en el taller.

Componentes del historial:
- Diagnósticos
- Presupuestos (aceptados y rechazados)
- Trabajos realizados
- Trabajos recomendados (no realizados)
- Fotografías de estado
- Videos de diagnóstico
- Resultados de scanner
- Garantías vigentes
- Próximas mantenciones recomendadas
- Kilometrajes registrados en cada ingreso

> *Cada componente: por completar con criterios de captura, formato y acceso.*

---

## 4. Etapas del Ciclo de Vida en el Taller

> *Por completar.*

### 4.1 Primer Ingreso

> *Por completar.*

Secciones propuestas:
- Registro del cliente (si es nuevo)
- Registro del vehículo (si es nuevo)
- Documentos de recepción
- Estado inicial del vehículo (fotos, nivel de combustible, km)

### 4.2 Recepción

> *Por completar.*

Secciones propuestas:
- Check-in del vehículo
- Descripción del problema (voz del cliente)
- Inspección visual inicial
- Evidencia fotográfica de recepción
- Asignación al mecánico

### 4.3 Diagnóstico

> *Por completar.*

Secciones propuestas:
- Proceso de diagnóstico
- Herramientas de diagnóstico (scanner)
- Cómo se registra el diagnóstico
- Diferencia entre diagnóstico confirmado y presuntivo

### 4.4 Presupuesto

> *Por completar.*

Secciones propuestas:
- Generación del presupuesto a partir del diagnóstico
- Aprobación por el cliente (presencial, teléfono, digital)
- Registro de presupuestos rechazados
- Trabajos parcialmente aprobados

### 4.5 Ejecución de la Reparación

> *Por completar.*

Secciones propuestas:
- Asignación de tareas al mecánico
- Registro de repuestos utilizados
- Registro de mano de obra
- Hallazgos durante la reparación
- Comunicación con el cliente durante el proceso

### 4.6 Control de Calidad

> *Por completar.*

Secciones propuestas:
- Revisión antes de entrega
- Quién aprueba la entrega
- Cómo queda registrado

### 4.7 Entrega

> *Por completar.*

Secciones propuestas:
- Proceso de entrega al cliente
- Firma del cliente
- Facturación
- Recomendaciones de próxima mantención
- Garantías

### 4.8 Post-Entrega

> *Por completar.*

Secciones propuestas:
- Gestión de garantías
- Seguimiento de recomendaciones pendientes
- Recordatorios automáticos
- Historial de mantenciones programadas

---

## 5. Actores Involucrados

> *Por completar.*

| Actor | Rol en el ciclo | Acceso al sistema |
|---|---|---|
| Propietario del taller | | |
| Recepcionista | | |
| Mecánico | | |
| Cliente | | |
| Proveedor | | |

> *Cada actor: por completar con descripción de rol, permisos y dispositivo de uso.*

---

## 6. Relaciones con Otras Entidades

> *Por completar.*

```
Vehículo
  ├── Cliente (propietario actual)
  │     └── Historial de propietarios anteriores
  ├── Órdenes de Trabajo
  │     ├── Diagnósticos
  │     ├── Repuestos utilizados → Inventario
  │     ├── Mano de obra → Empleados
  │     ├── Presupuestos
  │     └── Facturas
  ├── Citas programadas
  ├── Garantías vigentes
  └── Evidencia (fotos, videos, PDF, scanner)
```

> *Cada relación: por completar con cardinalidad, reglas de negocio e integridad referencial.*

---

## 7. Información que No Debe Perderse Nunca

> *Por completar.*

Secciones propuestas:
- Lista de campos que son inmutables una vez registrados
- Política de soft-delete en entidades del vehículo
- Cómo se maneja el cambio de propietario preservando el historial técnico
- Qué pasa si un cliente solicita borrar sus datos

---

## 8. Evidencia Asociada al Vehículo

> *Por completar.*

Secciones propuestas:
- Tipos de evidencia y en qué etapa se captura
- Almacenamiento (local, CDN, S3)
- Acceso y permisos
- Estrategia de migración desde TallerGP (PDFs CloudFront)
- Retención y archivo

---

## Referencias cruzadas

- Filosofía que explica por qué el vehículo es la entidad principal → [01-FILOSOFIA.md](./01-FILOSOFIA.md)
- Visión de los productos que consumen esta entidad → [02-VISION.md](./02-VISION.md)
- Principios de diseño aplicados en cada etapa → [03-PRINCIPIOS-DE-DISENO.md](./03-PRINCIPIOS-DE-DISENO.md)
- Contexto de migración de datos desde TallerGP → [00-PREAMBULO.md](./00-PREAMBULO.md)
