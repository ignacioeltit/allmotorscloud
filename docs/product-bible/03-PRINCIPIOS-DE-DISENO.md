# 03 — Principios de Diseño

**Estado:** Draft  
**Capítulo:** 03 de la Product Bible  
**Última actualización:** Junio 2026

---

## Objetivo de este capítulo

Documentar las reglas concretas que guían el diseño del producto.

Este capítulo responde a la pregunta:
**¿Cómo se toman decisiones de diseño y por qué?**

Estos principios no son sugerencias.
Son restricciones que toda funcionalidad debe cumplir.

---

## Tabla de Contenidos

1. [Principios Fundamentales](#1-principios-fundamentales)
2. [Principios de Experiencia de Usuario](#2-principios-de-experiencia-de-usuario)
3. [Principios de Datos](#3-principios-de-datos)
4. [Principios de Arquitectura](#4-principios-de-arquitectura)
5. [Principios de Productividad](#5-principios-de-productividad)
6. [Principios de Evidencia](#6-principios-de-evidencia)
7. [Principios de Trazabilidad](#7-principios-de-trazabilidad)
8. [Cómo Aplicar estos Principios](#8-cómo-aplicar-estos-principios)

---

## 1. Principios Fundamentales

> *Por completar.*

Los 7 principios fundamentales del proyecto (enumerados en el CLAUDE.md):

1. **El vehículo es la entidad principal.**
   > *Por completar: descripción completa, implicancias de diseño, ejemplos.*

2. **El historial técnico es el activo más importante.**
   > *Por completar: qué contiene, quién lo accede, cómo se protege.*

3. **El software nunca debe disminuir la productividad.**
   > *Por completar: cómo se mide, qué la viola, cómo se detecta.*

4. **Toda información debe capturarse una sola vez.**
   > *Por completar: qué significa en la práctica, cómo evitar duplicación.*

5. **La evidencia tiene prioridad sobre el texto.**
   > *Por completar: tipos de evidencia aceptada, cuándo aplica.*

6. **Todo debe quedar trazado.**
   > *Por completar: qué se traza, con qué granularidad, quién puede verlo.*

7. **El software debe adaptarse al taller.**
   > *Por completar: qué significa configurabilidad, qué no es configurable.*

---

## 2. Principios de Experiencia de Usuario

> *Por completar.*

Secciones propuestas:
- Diseño orientado al contexto del taller (taller sucio, guantes, tableta)
- Jerarquía de información
- Consistencia visual entre productos
- Accesibilidad en el taller
- Qué NO debe aparecer en pantalla

---

## 3. Principios de Datos

> *Por completar.*

Secciones propuestas:
- Modelo de datos centrado en el vehículo
- Relaciones entre entidades
- Integridad referencial
- Política de eliminación (¿se puede borrar? ¿qué pasa con el historial?)
- Separación entre datos operacionales y analíticos

---

## 4. Principios de Arquitectura

> *Por completar.*

Secciones propuestas:
- Arquitectura modular
- Un único modelo de dominio compartido
- Separación de responsabilidades
- Estrategia de API
- Escalabilidad desde el día uno
- Multi-tenant: ¿sí o no? ¿cuándo?

---

## 5. Principios de Productividad

> *Por completar.*

Secciones propuestas:
- **La regla de los 3 clics:** toda tarea frecuente en 3 clics o menos
- **La regla de los 10 segundos:** toda tarea frecuente en 10 segundos o menos
- Cuándo aplicar estas reglas
- Qué hacer cuando una funcionalidad las viola
- Automatización obligatoria vs. automatización opcional

---

## 6. Principios de Evidencia

> *Por completar.*

Secciones propuestas:
- Qué es evidencia en el contexto del taller
- Fotografías de recepción
- Videos de diagnóstico
- PDF firmado
- Scanner diagnóstico
- Cuándo es obligatoria vs. opcional
- Cómo se almacena y accede

---

## 7. Principios de Trazabilidad

> *Por completar.*

Secciones propuestas:
- Qué acciones deben quedar trazadas
- Estructura del log de auditoría (usuario, fecha, hora, acción)
- Quién puede ver la trazabilidad
- Cuánto tiempo se conserva
- Qué pasa si se intenta borrar un registro trazado

---

## 8. Cómo Aplicar estos Principios

> *Por completar.*

Secciones propuestas:
- Lista de verificación antes de implementar una funcionalidad
- Cómo resolver conflictos entre principios
- Quién tiene la autoridad para hacer excepciones
- Cómo documentar una excepción justificada

---

## Referencias cruzadas

- Origen de estos principios → [01-FILOSOFIA.md](./01-FILOSOFIA.md)
- Cómo se aplican en el ciclo del vehículo → [04-CICLO-DE-VIDA-DEL-VEHICULO.md](./04-CICLO-DE-VIDA-DEL-VEHICULO.md)
- Visión del producto que estos principios deben servir → [02-VISION.md](./02-VISION.md)
