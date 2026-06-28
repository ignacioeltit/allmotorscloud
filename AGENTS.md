# AGENTS.md

# All Motors Cloud Engineering Manual

Version: 1.0

---

# Misión

All Motors Cloud es un ERP SaaS para talleres mecánicos construido bajo Domain Driven Design (DDD), Event Driven Architecture y PostgreSQL + Supabase.

El objetivo del proyecto es crear el sistema de gestión para talleres más robusto de Chile y posteriormente Latinoamérica.

Toda modificación debe priorizar:

1. Correctitud del dominio.
2. Integridad de los datos.
3. Seguridad.
4. Escalabilidad.
5. Mantenibilidad.

Nunca priorizar velocidad de desarrollo por sobre calidad arquitectónica.

---

# Fuente de verdad

Los documentos oficiales del proyecto son la única fuente de verdad.

Si el código contradice la documentación:

LA DOCUMENTACIÓN TIENE PRIORIDAD.

Orden de autoridad:

1. docs/architecture/DATABASE_MODEL.md
2. docs/architecture/SYSTEM_ARCHITECTURE.md
3. docs/architecture/PHYSICAL_SCHEMA.md
4. docs/architecture/PERSISTENCE_ARCHITECTURE.md
5. docs/architecture/SECURITY_MODEL.md
6. docs/architecture/EVENT_MODEL.md
7. docs/database/*
8. Código fuente

Nunca inventar comportamiento fuera de estos documentos.

---

# Antes de modificar código

Siempre:

- entender el requerimiento
- identificar el dominio afectado
- leer la documentación correspondiente
- verificar dependencias
- explicar el plan
- recién después escribir código

---

# Arquitectura

El proyecto utiliza:

- DDD
- Monolito modular
- PostgreSQL
- Supabase
- Turborepo
- Next.js
- React Native
- TypeScript estricto

Nunca introducir nuevas tecnologías sin justificación.

---

# Base de datos

No inventar:

- tablas
- columnas
- índices
- constraints
- relaciones

Todo debe existir previamente en DATABASE_MODEL.md.

Si falta una entidad:

Detenerse.

Explicar la inconsistencia.

No asumir.

---

# Eventos

El evento es la unidad mínima del sistema.

Nunca modificar:

- historia técnica
- flujo de eventos
- transiciones

sin revisar EVENT_MODEL.md.

---

# Seguridad

Todo acceso debe respetar:

- RLS
- org_id
- JWT
- Supabase Auth

Nunca omitir RLS.

Nunca usar bypass.

---

# Multi-tenancy

Toda información pertenece a una organización.

Nunca escribir consultas que mezclen organizaciones.

Nunca eliminar filtros RLS.

---

# Git

Antes de cada commit:

- revisar diff
- revisar arquitectura
- revisar migraciones
- revisar seguridad

Nunca hacer commits masivos sin revisión.

---

# Migraciones

Antes de crear una migration:

leer:

- DATABASE_MODEL
- PHYSICAL_SCHEMA
- MIGRATION_SPEC correspondiente

No alterar migraciones antiguas.

Crear nuevas migraciones.

---

# SQL

Preferencias:

- claridad
- constraints
- índices
- integridad

Nunca optimizar sacrificando legibilidad.

---

# TypeScript

Siempre:

strict

Nunca:

any

sin justificación.

---

# Antes de responder

Preguntarse:

¿Existe un documento que responda esto?

Si existe:

leerlo primero.

---

# Antes de implementar

Checklist:

☐ Documentación leída

☐ Impacto evaluado

☐ Arquitectura respetada

☐ Seguridad respetada

☐ Multi-tenancy respetado

☐ SQL consistente

☐ TypeScript consistente

☐ Plan explicado

Solo entonces escribir código.