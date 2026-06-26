# 00 — Preámbulo

**Estado:** Aprobado  
**Capítulo:** 00 de la Product Bible  
**Versión:** 1.0  
**Última actualización:** Junio 2026  
**Autor:** Ignacio Eltit — All Motors SPA, Chillán Viejo, Chile

---

## Tabla de Contenidos

1. [El Punto de Partida](#1-el-punto-de-partida)
2. [El Problema Real](#2-el-problema-real)
3. [La Decisión de Construir](#3-la-decisión-de-construir)
4. [Por qué No es un Clon de TallerGP](#4-por-qué-no-es-un-clon-de-tallergp)
5. [La Fase de Exploración: Lo que Aprendimos](#5-la-fase-de-exploración-lo-que-aprendimos)
6. [El Descubrimiento Central: El Historial del Vehículo](#6-el-descubrimiento-central-el-historial-del-vehículo)
7. [La Visión a Largo Plazo](#7-la-visión-a-largo-plazo)
8. [Construir desde Adentro](#8-construir-desde-adentro)
9. [A Quién Está Dirigido este Documento](#9-a-quién-está-dirigido-este-documento)

---

## 1. El Punto de Partida

All Motors Cloud no nació en una incubadora.  
No nació de un análisis de mercado.  
No nació de un equipo de producto intentando entender cómo funciona un taller mecánico.

Nació en All Motors SPA, un taller mecánico en Chillán Viejo, Chile.

Nació de años de operación diaria: de órdenes de trabajo impresas, de clientes que llaman a preguntar si su auto está listo, de mecánicos que buscan en un sistema la historia de un vehículo que ya han reparado tres veces y que recuerdan vagamente, de presupuestos aprobados por teléfono que después nadie recuerda quién autorizó, de repuestos que se ingresan dos veces porque el sistema no los encontró la primera vez.

Nació de una pregunta que el propietario del taller se hizo después de años usando distintos sistemas de gestión:

> *¿Por qué el software que uso me hace trabajar más en lugar de menos?*

Esa pregunta es el origen de este proyecto.

---

## 2. El Problema Real

Los sistemas de gestión para talleres mecánicos existen desde hace décadas. El mercado tiene opciones. Algunos son buenos en lo que hacen. Pero todos comparten un problema estructural: fueron diseñados por empresas de software que estudiaron talleres mecánicos desde afuera.

Estudiaron los procesos. Modelaron las entidades. Construyeron formularios. Generaron reportes. Pero no vivieron el taller.

El resultado es predecible: sistemas con decenas de funcionalidades que nadie usa, interfaces pensadas para escritorios de oficina y no para talleres donde se trabaja con las manos, flujos de trabajo que obligan al mecánico a detenerse, lavarse las manos, sentarse frente a un computador e ingresar datos que el sistema exige pero que no agregan valor real a la reparación.

Los problemas concretos que motivaron este proyecto son los siguientes:

**El historial técnico está fragmentado.** La información de un vehículo está distribuida entre órdenes de trabajo, presupuestos y facturas que no siempre están relacionadas entre sí de forma coherente. Reconstruir el historial completo de un vehículo requiere buscar en múltiples lugares.

**La evidencia no existe.** Los sistemas de gestión tradicionales capturan texto. No capturan fotografías del estado del vehículo al ingreso, no capturan videos del diagnóstico, no capturan la firma digital del cliente aprobando un presupuesto. Cuando surge una disputa, la única evidencia es lo que alguien escribió en un formulario.

**El software compite con el tiempo del mecánico.** Un taller gana dinero reparando vehículos. Cada minuto que un mecánico pasa ingresando datos es un minuto que no está reparando. Los sistemas actuales no están diseñados con esa restricción como premisa fundamental.

**El cliente es invisible.** El cliente llama para preguntar el estado de su vehículo y alguien tiene que buscar físicamente esa información. No existe una forma de que el cliente acceda en tiempo real al estado de su reparación. No existe comunicación proactiva. El taller responde, no anticipa.

**Los datos son del proveedor del software.** Si el taller decide cambiar de sistema, pierde años de historial o debe pagar por una exportación que nadie garantiza que esté completa. El historial técnico de los vehículos es un activo del taller, no del proveedor del software.

Estos no son problemas de usabilidad que se resuelven con un rediseño de interfaz. Son problemas de concepción. El software fue construido con las prioridades equivocadas.

---

## 3. La Decisión de Construir

La decisión de construir un sistema propio en lugar de comprar uno existente no fue tomada a la ligera.

Construir software es caro, lento y complejo. Mantenerlo es aún más caro. Y un taller mecánico no es una empresa de tecnología: su negocio principal es reparar vehículos, no desarrollar software.

La decisión se tomó después de evaluar las alternativas disponibles en el mercado y llegar a la misma conclusión en cada evaluación: ningún sistema existente resuelve el problema desde la raíz porque ninguno fue construido con las premisas correctas.

Las premisas correctas son:

- El vehículo es la entidad central. No la factura. No la orden de trabajo.
- El historial técnico del vehículo es el activo más valioso. Debe ser completo, permanente y del taller.
- El software debe reducir el trabajo, no aumentarlo.
- La evidencia visual tiene más valor que el texto.
- El taller debe adaptarse al software lo mínimo posible. El software debe adaptarse al taller.

Ningún sistema del mercado fue construido desde estas premisas. Por eso se decidió construir uno.

Los riesgos de esta decisión se asumieron conscientemente:
- El proyecto tomará tiempo.
- Requerirá inversión continua.
- Habrá funcionalidades que tardarán más de lo que se quisiera.

Pero al final del proceso, el taller será propietario de su plataforma, de sus datos y de su historial técnico. Sin dependencia de terceros. Sin licencias que aumentan año a año. Sin datos rehenes.

---

## 4. Por qué No es un Clon de TallerGP

TallerGP es el sistema de gestión que All Motors SPA ha utilizado durante años. Es la referencia más cercana. La fuente de datos históricos. El sistema que será reemplazado.

Pero no es el modelo.

Es importante entender esta distinción porque la tentación de clonar es real. TallerGP tiene funcionalidades que funcionan. Tiene flujos que el equipo del taller conoce. Reproducirlos sería más rápido que pensar desde cero.

Sin embargo, reproducir TallerGP significaría reproducir también sus limitaciones, su arquitectura, sus decisiones de diseño y los supuestos que las originaron. Significaría construir un sistema con las mismas premisas equivocadas, solo con tecnología más moderna.

All Motors Cloud no replica TallerGP. Lo reemplaza con una concepción distinta.

TallerGP tiene un rol específico y acotado en este proyecto:

**Es una fuente de migración de datos históricos.**

Nada más. Sus 5.449 órdenes de trabajo, sus 3.539 vehículos y sus 2.842 clientes representan años de historia operacional del taller. Ese historial tiene valor. Migrarlo correctamente es parte del proyecto.

Pero la arquitectura, la experiencia de usuario, el modelo de datos y las decisiones de diseño de All Motors Cloud se construyen desde cero, con las premisas correctas, sin herencia de las limitaciones de TallerGP.

---

## 5. La Fase de Exploración: Lo que Aprendimos

Antes de escribir la primera línea de código del sistema operacional, se realizó una fase de exploración técnica sistemática de la API oficial de TallerGP. El objetivo era triple:

1. Verificar que los datos históricos eran recuperables antes de comprometerse a migrarlos.
2. Entender el modelo de datos real, no el documentado.
3. Identificar las limitaciones de la API para saber qué datos no estarían disponibles.

Los resultados fueron reveladores en varios sentidos.

**Lo que la API sí puede entregar:**

La API de TallerGP expone los datos centrales del taller de forma completa. El detalle de cada orden de trabajo incluye los repuestos utilizados, la mano de obra cobrada, los montos desglosados y los PDFs generados. El historial de kilometrajes está registrado. Las relaciones entre vehículos, clientes y órdenes de trabajo son recuperables y coherentes.

La exploración cubrió 15 tipos de entidades con paginación completa: clientes, vehículos, órdenes de trabajo, presupuestos, facturas, empleados, marcas, insumos y más. La validación del historial de un vehículo real (patente SRDV88) confirmó que la API permite reconstruir prácticamente todo el historial técnico operacional.

**Lo que la API no puede entregar:**

La API no expone fotografías del estado del vehículo. No expone videos de diagnóstico. No expone resultados de scanner. No expone firmas digitales. Los PDFs de órdenes de trabajo existen en un CDN externo y son accesibles, pero representan documentos finales, no evidencia del proceso de reparación.

Esta limitación no es un problema de migración. Es una confirmación del diagnóstico original: los sistemas actuales no capturan evidencia. All Motors Cloud deberá capturarla desde el día uno.

**Lo que aprendimos sobre la calidad de los datos:**

Los datos en TallerGP son reales pero imperfectos. Los identificadores son cadenas opacas, no números secuenciales. Los tipos de algunos campos son inconsistentes entre endpoints: el mismo campo puede llegar como string, número o booleano dependiendo de la ruta consultada. Los valores monetarios en los detalles de órdenes de trabajo llegan como strings que deben parsearse.

Estos hallazgos son valiosos. Confirman que el modelo de datos de All Motors Cloud debe ser diseñado con criterios de calidad más estrictos desde el origen, no heredando las inconsistencias del sistema anterior.

---

## 6. El Descubrimiento Central: El Historial del Vehículo

La fase de exploración produjo un hallazgo que cambió la forma de pensar el sistema.

Al reconstruir el historial completo del vehículo SRDV88 usando exclusivamente la API, quedó en evidencia algo que parecía obvio pero que no lo era hasta verlo en datos reales: **el historial técnico de un vehículo es el activo más valioso del taller, y no está siendo tratado como tal.**

TallerGP organiza su información alrededor de las órdenes de trabajo. Una orden de trabajo tiene un estado, tiene items de repuestos y mano de obra, tiene un cliente y tiene un vehículo. El vehículo es un campo de la orden de trabajo, no la entidad que la contiene.

Esta decisión de diseño tiene consecuencias prácticas: cuando un cliente llega con un vehículo que ya fue atendido múltiples veces, el sistema muestra una lista de órdenes de trabajo. El mecánico tiene que abrir cada una para reconstruir mentalmente qué le pasó a ese vehículo. No existe una vista unificada del historial técnico. No existe una línea de tiempo. No existe un registro de los trabajos recomendados que el cliente rechazó. No existe un registro de las garantías que se otorgaron y si se cumplieron.

El vehículo es tratado como un atributo de la factura, cuando debería ser exactamente al revés.

All Motors Cloud invierte esta relación:

**El vehículo es la entidad principal. Todo lo demás gira a su alrededor.**

Una orden de trabajo pertenece a un vehículo. Un presupuesto pertenece a un vehículo. Una fotografía de diagnóstico pertenece a un vehículo. Una garantía pertenece a un vehículo. El cliente puede cambiar, el propietario puede cambiar, pero el historial técnico del vehículo permanece intacto y completo.

Este principio no es estético. Tiene consecuencias concretas en el modelo de datos, en la interfaz de usuario y en la forma en que el taller trabaja con la información. Cuando un vehículo llega por décima vez, el mecánico ve en segundos todo lo que se le ha hecho, qué se recomendó y no se realizó, cuándo fue la última alineación y qué se dejó pendiente. Sin buscar. Sin reconstruir. La información está donde debe estar.

---

## 7. La Visión a Largo Plazo

All Motors Cloud no es un sistema de gestión de talleres.

Es el Sistema Operativo de un Taller Mecánico.

La distinción importa. Un sistema de gestión administra procesos. Un sistema operativo los integra, los automatiza y los potencia. La diferencia es la misma que existe entre una aplicación de escritorio y el sistema sobre el que corre.

La visión es construir una plataforma compuesta por múltiples productos que comparten un único modelo de dominio:

- **Core ERP** — la base operacional: vehículos, clientes, órdenes de trabajo, presupuestos, facturación.
- **Recepción Digital** — el ingreso del vehículo con evidencia fotográfica y firma del cliente.
- **Check-In Inteligente** — reconocimiento de patente, historial inmediato, alertas de mantención vencida.
- **Historial Técnico** — la vista unificada de toda la vida del vehículo en el taller.
- **App del Mecánico** — interfaz táctil diseñada para el taller, no para la oficina.
- **Portal del Cliente** — el cliente ve en tiempo real el estado de su vehículo.
- **CRM** — seguimiento de clientes, recordatorios de mantención, comunicación proactiva.
- **Inventario** — control de repuestos con integración directa a las órdenes de trabajo.
- **Compras** — órdenes de compra, proveedores, trazabilidad de insumos.
- **Business Intelligence** — métricas operacionales, rentabilidad por tipo de trabajo, rendimiento del equipo.
- **Inteligencia Artificial** — diagnóstico asistido, predicción de mantenciones, detección de anomalías.
- **API Pública** — integración con proveedores, aseguradoras y sistemas externos.

Todos estos productos comparten la misma base de datos. El vehículo registrado en el Core ERP es el mismo vehículo que el mecánico ve en su app, el que el cliente consulta en el portal y el que aparece en los reportes de business intelligence.

No hay silos. No hay duplicación. Cada dato se captura una sola vez y está disponible en todo el sistema.

El horizonte de esta visión no es un año ni dos. Es la construcción progresiva de una plataforma que, cuando esté completa, haga que operar sin ella sea impensable para cualquier taller que la haya adoptado.

---

## 8. Construir desde Adentro

Hay algo fundamentalmente distinto en construir software cuando eres el usuario final.

La mayoría del software empresarial es construido por personas que nunca han operado el negocio que intentan digitalizar. Hacen entrevistas con usuarios. Hacen talleres de diseño. Observan flujos de trabajo. Pero al final del día, van a sus casas y no piensan más en el problema hasta el día siguiente.

El propietario de un taller no tiene ese lujo. Cuando un cliente llama a las 8 de la mañana para saber si su auto está listo, cuando un mecánico pide autorización para un repuesto que no estaba en el presupuesto original, cuando el contador pregunta cuánto se facturó en el trimestre, cuando hay que responder a un reclamo por una garantía de hace seis meses — todos esos problemas son reales, tienen urgencia real y tienen consecuencias reales.

Construir All Motors Cloud desde adentro significa que cada decisión de diseño pasa por una prueba de fuego que ninguna empresa de software puede replicar: ¿esto hace más fácil operar el taller, o solo parece una buena idea en una pizarra?

Esa pregunta no es retórica. Es el filtro más importante del proyecto y está formulada explícitamente en la constitución del producto:

> *¿Esta funcionalidad mejora realmente la operación del taller?*

Si la respuesta es no, la funcionalidad no se construye, independientemente de cuán interesante sea técnicamente.

Esta restricción es una ventaja competitiva. Los sistemas de gestión que se construyen desde afuera tienden a acumular funcionalidades porque cada cliente pide algo diferente y es más fácil agregar que decidir. El resultado son sistemas con cientos de opciones donde nadie sabe qué hace cada una. All Motors Cloud se construye con la disciplina de quien sabe exactamente qué necesita porque lo vive cada día.

---

## 9. A Quién Está Dirigido este Documento

Este documento está dirigido a tres audiencias distintas y tiene un propósito diferente para cada una.

**Para los desarrolladores** que trabajan en el proyecto, este preámbulo establece el contexto que no está en el código. El código dice qué hace el sistema. Este documento dice por qué existe y cuáles son las restricciones que nunca deben violarse. Antes de implementar cualquier funcionalidad, el desarrollador debe poder responder la pregunta del filtro. Si no puede responderla con el historial del taller como referencia, es una señal de que hay una decisión de negocio que aún no está documentada.

**Para los futuros socios** que evalúan si este proyecto tiene potencial, este documento establece que All Motors Cloud no es un proyecto de hobby ni un ejercicio técnico. Es la respuesta a un problema real, construida por alguien que tiene incentivos genuinos para que funcione porque lo usa en su propio negocio. La ventaja del conocimiento de dominio no puede comprarse. Solo se adquiere con años de operación.

**Para los potenciales inversionistas**, este documento establece la tesis central: el mercado de software para talleres mecánicos independientes en Latinoamérica es un mercado desatendido por soluciones que fueron diseñadas desde la perspectiva equivocada. La oportunidad no está en construir otro sistema de gestión. Está en construir el primero que fue concebido desde adentro.

---

## Referencias cruzadas

- Filosofía que define cómo tomamos decisiones → [01-FILOSOFIA.md](./01-FILOSOFIA.md)
- Visión detallada del producto y sus módulos → [02-VISION.md](./02-VISION.md)
- Principios concretos que implementan esta filosofía → [03-PRINCIPIOS-DE-DISENO.md](./03-PRINCIPIOS-DE-DISENO.md)
- El vehículo como entidad central del sistema → [04-CICLO-DE-VIDA-DEL-VEHICULO.md](./04-CICLO-DE-VIDA-DEL-VEHICULO.md)
