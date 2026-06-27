# Arquitectura Frontend — All Motors Cloud

**Estado:** Draft  
**Versión:** 1.0  
**Última actualización:** Junio 2026  
**Propósito:** Definir la arquitectura del cliente web Next.js 15+

---

## 1. Propósito

Este documento define la arquitectura del cliente web de All Motors Cloud. Describe cómo el frontend sirve a los cuatro roles que interactúan via browser: recepcionista, jefe de taller, administrador y cliente externo (portal). La aplicación móvil del mecánico es un cliente nativo separado y está fuera del alcance de este documento.

---

## 2. Alcance

**Incluye:**
- Estructura de rutas por rol (App Router de Next.js 15+)
- Reglas de decisión servidor vs. cliente para componentes React
- Arquitectura de estado global y local
- Formularios de los flujos críticos: recepción, presupuesto, entrega
- Mecanismos de tiempo real en la UI (Supabase Realtime)
- Portal del cliente (web móvil)
- Patrones de UX transversales
- Guards de rutas por rol

**Excluye:** API routes, schema de base de datos, lógica de negocio del backend, aplicación nativa del mecánico.

---

## 3. Relación con el Domain Model

El frontend es un consumidor del dominio. Sus entidades centrales son las mismas que define el Domain Model:

| Dominio | Reflejo en frontend |
|---|---|
| Vehículo + Historia Técnica | Pantalla de historial; precarga al buscar patente |
| Orden de Trabajo | Contexto de sesión compartido entre pasos del flujo |
| Evento (Recepción, Diagnóstico, Presupuesto…) | Cada step de wizard o formulario genera un evento |
| Estado del Evento | Determina qué acciones y secciones se habilitan en la UI |
| Evidencias (fotos, firma, PDF) | Upload directo a Storage; referencia guardada en el evento |
| Actor responsable | Se registra automáticamente desde la sesión activa |

La UI no puede iniciar un paso siguiente si el estado del evento anterior no lo permite. Esta restricción se impone tanto en el servidor (RLS, validaciones de API) como en el cliente (navegación bloqueada, botones deshabilitados).

---

## 4. Estructura de rutas por rol

```
src/app/
│
├── (auth)/                         # Sin sesión
│   ├── login/
│   └── portal/login/               # Login portal cliente (separado)
│
├── (taller)/                       # Requieren sesión: recepción / jefe / admin
│   ├── layout.tsx                  # Guard de sesión + navbar taller
│   ├── dashboard/                  # Vista principal: vehículos en taller hoy
│   ├── recepciones/
│   │   ├── nueva/                  # UC-R05: wizard recepción
│   │   └── [ot_id]/
│   │       ├── page.tsx            # Resumen de la OT activa
│   │       ├── diagnostico/        # UC-D01
│   │       ├── presupuesto/        # UC-P01, UC-P03, UC-P04, UC-P05
│   │       ├── reparacion/         # UC-E01..E04
│   │       ├── calidad/            # UC-E05
│   │       └── entrega/            # UC-ENT01, UC-ENT02, UC-ENT03
│   ├── vehiculos/
│   │   ├── buscar/                 # Búsqueda por patente (entrada al flujo)
│   │   └── [vehiculo_id]/          # Historia Técnica completa del vehículo
│   ├── clientes/
│   │   └── [cliente_id]/
│   └── admin/                      # Solo rol admin
│       ├── reportes/
│       ├── usuarios/
│       └── configuracion/
│
└── (portal)/                       # Portal cliente — web móvil
    ├── layout.tsx                  # Guard sesión cliente + nav mínimo
    ├── mis-vehiculos/
    └── vehiculos/[vehiculo_id]/
        ├── estado/                 # Estado OT activa
        ├── historial/              # Historia Técnica filtrada
        └── presupuesto/[id]/       # Vista presupuesto (lectura/aprobación futura)
```

**Convención de grupos de ruta:**
- `(taller)` — sesión de empleado del taller; guard verifica `rol IN ('recepcion', 'jefe_taller', 'admin')`
- `(portal)` — sesión de cliente externo; guard verifica `tipo_sesion = 'cliente'`
- `(auth)` — sin guard, redirige a dashboard si ya hay sesión activa

---

## 5. Arquitectura de componentes (servidor vs. cliente)

### Regla de decisión

```
¿Necesita interacción del usuario (click, input, drag)?
  Sí → componente cliente ('use client')
  No → ¿Necesita datos frescos en cada request?
         Sí → Server Component con fetch
         No → Server Component con cache o static
```

### Tabla de aplicación

| Componente | Tipo | Razón |
|---|---|---|
| Layout de ruta | Servidor | Lectura de sesión, sin interacción |
| Guard de ruta | Servidor | `createServerClient`; redirige antes de renderizar |
| Dashboard — contenedor | Servidor | Carga inicial de OTs del día |
| Dashboard — tabla reactiva | Cliente | Realtime + filtros interactivos |
| Wizard de recepción | Cliente | Formulario multi-step con estado local |
| Vista Historia Técnica | Servidor | Solo lectura; datos inmutables |
| Línea de tiempo de eventos | Servidor | Renderizado estático de eventos pasados |
| Formulario de presupuesto | Cliente | Cálculo en tiempo real, ítems dinámicos |
| Selector de patente (typeahead) | Cliente | Búsqueda reactiva |
| Upload de evidencias (fotos) | Cliente | FileReader + cámara nativa |
| Panel de firma digital | Cliente | Canvas interactivo |
| Notificaciones / toasts | Cliente | Estado efímero de UI |

### Reglas de importación de clientes Supabase

| Contexto | Cliente | Importación |
|---|---|---|
| Server Component, layout, guard | `createServerClient` | `@/lib/supabase/server` |
| Route Handler (`/api/…`) | `createServerClient` | `@/lib/supabase/server` |
| Componente cliente, hook, formulario | `createBrowserClient` | `@/lib/supabase/client` |

Nunca importar `client.ts` desde un Server Component. Nunca importar `server.ts` desde un componente con `'use client'`.

---

## 6. Gestión de estado

### Separación de responsabilidades

| Capa | Herramienta | Qué guarda |
|---|---|---|
| Estado del servidor | Server Components + fetch | Datos iniciales de la página |
| Estado de sesión activa | Zustand store `useOTStore` | OT en progreso (id, paso actual, datos acumulados) |
| Estado de UI local | `useState` / `useReducer` | Dropdowns, spinners, errores por campo |
| Estado de notificaciones | Zustand store `useNotifStore` | Alertas tiempo real pendientes de lectura |
| Estado de sincronización | Custom hook `useRealtimeOT` | Cambios de estado de OTs activas via Realtime |

### Stores Zustand

**`useOTStore`**
```
{
  otId: string | null,
  paso: 'recepcion' | 'diagnostico' | 'presupuesto' | 'reparacion' | 'calidad' | 'entrega',
  vehiculoId: string | null,
  clienteId: string | null,
  limpiar: () => void,
  avanzarPaso: (paso) => void
}
```
Se inicializa al abrir una OT. Se limpia al cerrarla o navegar fuera del flujo.

**`useNotifStore`**
```
{
  alertas: Alerta[],
  marcarLeida: (id) => void,
  agregarAlerta: (alerta) => void
}
```
Alimentado por el canal Realtime del taller.

### Actualizaciones después de guardar (patrón obligatorio)

```typescript
try {
  await guardarDirecto(campos)   // mutación directa con createBrowserClient
  await recargar()               // refetch del estado local
  localStorage.setItem('dashboard_stale', '1')  // notifica otras pestañas
  router.refresh()               // invalida cache del router (Server Components)
} catch (e) {
  setError(e instanceof Error ? e.message : 'Error al guardar')
}
```

Toda mutación que modifique una OT visible en el dashboard debe seguir este patrón.

---

## 7. Arquitectura de formularios

### Principio general

Todos los formularios de flujos críticos usan **React Hook Form + Zod**. El schema Zod es la única fuente de verdad para validación; no hay validación duplicada en el servidor de Next.js.

### Flujo de Recepción (UC-R05)

Wizard multi-step de 4 pasos. Cada paso valida su propio schema antes de avanzar.

```
Paso 1 — Vehículo y cliente
  Schema: z.object({ patente, km, combustible, clienteId })
  Componentes cliente: PatenteBuscador (typeahead), ClienteSelector
  On submit: crea/verifica vehículo y cliente en Supabase

Paso 2 — Evidencias de ingreso
  Schema: z.object({ fotos: z.array(z.string()).min(4) })
  Componentes cliente: FotoCaptura (camera API), FotoGaleria
  On submit: sube fotos a Supabase Storage; guarda referencias

Paso 3 — Descripción del problema
  Schema: z.object({ descripcion_cliente: z.string().min(10) })
  Componente cliente: textarea con contador de caracteres

Paso 4 — Firma del cliente
  Schema: z.object({ firma_url: z.string().url() })
  Componente cliente: FirmaCanvas (canvas + signature pad)
  On submit: sube imagen firma a Storage; crea evento Recepción en DB
```

El `useOTStore` persiste `otId` y `paso` entre steps. Si el usuario navega atrás, el formulario recupera los valores del store.

### Flujo de Presupuesto (UC-P01 + UC-P04)

Formulario dinámico de ítems con cálculo en tiempo real.

```
Secciones:
  - Repuestos: lista de ítems (código, descripción, cantidad, precio unitario)
  - Mano de obra: lista (descripción, horas, precio/hora)
  - Insumos y otros costos
  - Totales calculados: subtotal, IVA (19%), total
  - Vigencia: fecha de expiración del presupuesto

Componentes:
  - ItemRepuesto: inline edit con spinner (useState<string|null> para tracking multi-ítem)
  - CalculadorTotales: componente puro, recalcula en tiempo real
  - PresupuestoPDF: generación de PDF para envío/impresión
```

Los ítems del presupuesto usan el patrón de **inline edit con spinner de instancia**:
```typescript
const [guardando, setGuardando] = useState<string | null>(null)
// guardando === item.id → ese ítem muestra spinner
// guardando === null → ningún ítem en proceso
```

### Flujo de Entrega (UC-ENT01 + UC-ENT02 + UC-ENT03)

Formulario secuencial en una sola pantalla (no wizard). Los tres casos de uso se completan en orden visible.

```
Sección 1 — Verificación identidad (lectura)
Sección 2 — Km de salida (input)
Sección 3 — Emisión factura/boleta (selector tipo + confirmación)
Sección 4 — Registro de pago (forma, monto, referencia)
Sección 5 — Firma de entrega (FirmaCanvas)
Botón final — "Cerrar OT" (deshabilitado hasta que secciones 3 y 4 estén completas)
```

El cierre de OT es irreversible. La UI muestra un dialog de confirmación explícito antes de ejecutar.

---

## 8. Tiempo real en la UI

### Mecanismos para invalidar cache del router (TTL 30s en Next.js)

El router cache de Next.js persiste datos 30 segundos. `router.refresh()` solo funciona si la petición llega antes del TTL. Se usan tres mecanismos en paralelo:

| Mecanismo | Caso que cubre |
|---|---|
| `pageshow` event (`persisted: true`) | Navegación con botón "Atrás" (bfcache) |
| `storage` event en `localStorage` (clave `dashboard_stale`) | Cambio en otra pestaña del mismo browser |
| Supabase Realtime channel `ordenes_de_trabajo` | Cambio en cualquier cliente (mismo tab, otra pestaña, otro dispositivo) |

### Canal Realtime del dashboard

```typescript
// hook useRealtimeDashboard.ts
const channel = supabase
  .channel('ots_taller')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'ordenes_de_trabajo',
    filter: `taller_id=eq.${tallerId}`
  }, () => {
    recargarOTs()
  })
  .subscribe()
```

El componente de tabla del dashboard es cliente (`'use client'`). Recibe los datos iniciales como prop del Server Component padre (prefetch en el servidor) y los actualiza via Realtime sin recargar la página.

### Notificaciones operativas

Las alertas del sistema (vehículo listo, tiempo excedido, presupuesto sin respuesta) se reciben via un segundo canal Realtime `notificaciones_taller` y se almacenan en `useNotifStore`. El badge del icono de notificaciones se actualiza sin rerenderizar el layout.

---

## 9. Portal del Cliente (web móvil)

El grupo de ruta `(portal)` es una aplicación separada visualmente pero en el mismo proyecto Next.js.

### Dispositivo objetivo
Mobile web (pantallas 375px–430px). No se requiere PWA en MVP; se evalúa para V2.

### Sesión del cliente

Autenticación por email magic link o código OTP por SMS. No usa contraseña. La sesión es independiente de la sesión de empleado; `createBrowserClient` devuelve contextos separados según el tipo de usuario.

### Pantallas del portal (UC-PC01)

| Pantalla | Datos | Origen |
|---|---|---|
| Mis vehículos | Lista de vehículos asociados al cliente | Server Component |
| Estado de OT activa | Estado actual, último evento, tiempo estimado | Server Component + Realtime |
| Historia Técnica (filtrada) | Eventos visibles al cliente (sin diagnósticos internos) | Server Component |
| Presupuesto activo | Vista de lectura del presupuesto enviado | Server Component |

### Realtime en el portal

El cliente ve el estado de su OT en tiempo real via un canal filtrado por `ot_id`. Si el estado cambia a `lista_para_entrega`, la pantalla actualiza automáticamente y muestra el banner "Tu vehículo está listo".

### Restricción de visibilidad

El taller configura qué tipos de evento son visibles al cliente. El campo `visible_cliente: boolean` en la tabla de eventos controla la visibilidad. Los diagnósticos técnicos y notas internas se excluyen por defecto.

---

## 10. Patrones de UX críticos

### Dropdowns con múltiples instancias

Cuando el mismo dropdown aparece en más de un lugar del DOM (ej: barra de acciones desktop + FAB móvil), cada instancia usa **su propio ref**:

```typescript
const refDesktop = useRef<HTMLDivElement>(null)
const refMobile = useRef<HTMLDivElement>(null)
// Un único ref compartido → el último montado sobreescribe al primero
// → el outside-click handler del primero queda roto
```

### Inline edits

Los campos editables inline en listas muestran un spinner por instancia, no un spinner global. Patrón obligatorio:

```typescript
const [guardando, setGuardando] = useState<string | null>(null)
// guardando === item.id → spinner en ese ítem
```

### Verificación de éxito en mutaciones

Toda llamada a `supabase.update()` o `supabase.insert()` encadena `.select('id')` y verifica que `data.length > 0`. Si la operación afecta cero filas, la UI muestra un error explícito (posible bloqueo por RLS o sesión expirada).

### Bloqueo por estado del dominio

Los botones de avance entre pasos del flujo se habilitan/deshabilitan según el estado del evento correspondiente. Esto no se implementa con lógica de UI ad-hoc; se consulta el estado real del evento en la DB. Nunca asumir estado desde el store local.

### Confirmación para acciones irreversibles

Las acciones que cierran eventos de forma permanente (cierre de OT, aprobación de control de calidad, entrega del vehículo) requieren un dialog de confirmación que describe exactamente qué ocurrirá y no puede deshacerse.

---

## 11. Decisiones principales

| Decisión | Elección | Alternativa descartada | Razón |
|---|---|---|---|
| Wizard de recepción | Multi-step con store Zustand | Formulario de una sola página | La recepción tiene 4 secciones claramente separadas; el store permite recuperar si el usuario navega atrás |
| Realtime | Canal Supabase en componente cliente | Polling | Latencia menor; se alinea con el stack ya comprometido |
| Invalidación de cache | Tres mecanismos en paralelo | Solo `router.refresh()` | El TTL de 30s del router cache hace que `router.refresh()` solo no sea suficiente |
| Portal cliente | Mismo proyecto Next.js, grupo de ruta separado | App independiente | Comparte layout system, autenticación Supabase y componentes base; despliega a la misma URL |
| Formulario de presupuesto | React Hook Form + cálculo en tiempo real | Server Action | La lógica de cálculo de ítems y totales requiere reactividad pura del cliente |
| Autenticación portal | Magic link / OTP SMS | Contraseña | El cliente no tiene un incentivo fuerte para recordar otra contraseña; el flujo sin contraseña reduce fricción |

---

## 12. Reglas

1. Nunca importar `@/lib/supabase/client` desde un Server Component.
2. Nunca importar `@/lib/supabase/server` desde un componente con `'use client'`.
3. Toda mutación que modifique estado visible en el dashboard debe seguir el patrón: `guardar → recargar → localStorage.setItem('dashboard_stale','1') → router.refresh()`.
4. El botón "Cerrar OT" y toda acción irreversible requieren dialog de confirmación explícita.
5. Los dropdowns con múltiples instancias en el DOM usan refs separados, nunca un ref compartido.
6. Toda mutación verifica que `data.length > 0`; si es cero, muestra error al usuario.
7. El estado habilitado/deshabilitado de los pasos del flujo se consulta desde la DB, no se infiere desde el store local.
8. El portal del cliente solo muestra eventos marcados como `visible_cliente = true`.
9. Las validaciones de schema Zod son la única fuente de verdad para validación de formularios; no duplicar en servidor de Next.js.
10. El mecánico no interactúa con esta aplicación web; su interfaz es la app nativa.

---

## 13. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Cache TTL 30s del router causa inconsistencia entre dashboard y detalle de OT | Alta | Medio | Los tres mecanismos de invalidación (pageshow, storage event, Realtime) cubren los escenarios principales |
| Canal Realtime con alta concurrencia (muchos vehículos activos simultáneos) | Baja en MVP | Alto | Filtrar canales por `taller_id`; no suscribirse a cambios de toda la tabla |
| Upload de fotos (4 ángulos de recepción) en conexión móvil lenta en el taller | Media | Medio | Comprimir imágenes en cliente antes de subir; mostrar progreso por foto |
| Wizard de recepción interrumpido a mitad del flujo (llamada telefónica, etc.) | Alta | Medio | `useOTStore` persiste en `sessionStorage`; el wizard recupera el estado al volver |
| Firma digital en tableta con palm rejection deficiente | Media | Bajo | Botón "Limpiar firma" accesible; opción de firma física como alternativa documentada |

---

## 14. Preguntas abiertas

1. **Aprobación remota de presupuesto (UC-P04):** ¿el cliente puede aprobar desde el portal, o solo lo ve y debe llamar para confirmar? Si aprueba desde el portal, ¿eso cuenta como evidencia equivalente al mensaje de WhatsApp?

2. **Notificación "vehículo listo" (UC-E05):** ¿el portal muestra un banner automático al cliente cuando el estado cambia a `lista_para_entrega`, o también se envía push/SMS?

3. **Sesión de recepcionista en tablet compartida:** si varios recepcionistas usan la misma tablet, ¿cada uno hace login/logout o hay un modo de sesión compartida con PIN rápido?

4. **Dashboard en tiempo real (UC-REP01):** ¿los reportes administrativos son en tiempo real o con período de cálculo? Los reportes en tiempo real tienen implicaciones de rendimiento en Supabase.

5. **Offline en el taller:** si la conexión cae durante un wizard de recepción, ¿se guarda en borrador local o se pierde el progreso? `sessionStorage` como capa de borrador no es suficiente ante cierre del navegador.

---

## 15. Impacto futuro en desarrollo

| Capacidad futura | Preparación necesaria ahora |
|---|---|
| Aprobación de presupuesto desde portal | El componente de vista de presupuesto en el portal debe ser extensible; no acoplar al modo solo-lectura |
| PWA del portal cliente | El grupo de ruta `(portal)` debe tener su propio `manifest.json` desde el inicio |
| Notificaciones push al cliente | El layout del portal debe registrar el Service Worker desde V1 aunque no se use en MVP |
| Multi-taller (un administrador, varios talleres) | El `taller_id` debe estar en el contexto de sesión desde el día uno; no asumir taller único |
| App Mecánico como PWA futura | El canal Realtime de eventos debe ser consultable desde fuera del grupo `(taller)` |

---

*Este documento define la arquitectura del cliente web. Toda pantalla, componente y hook debe poder trazarse hasta un caso de uso documentado en `docs/application/use-cases/`.*

*Los detalles de componentes individuales y sus contratos de props se documentan en los archivos de diseño de pantallas correspondientes.*
