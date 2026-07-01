# Spec Funcional — Catálogo Vivo en OT

**Fecha:** 2026-06-30  
**Estado:** Diseño aprobado. Sin implementación todavía. Migration 007 pendiente de autorización.  
**Contexto:** M005 + M006 aplicadas. 45 servicios en catálogo base. Schema confirmado leyendo la DB.

---

## Schema actual confirmado (DB real, no spec)

### `catalogo_servicios` — campos relevantes

| Campo | Tipo | Default | Notas |
|---|---|---|---|
| `id` | uuid | gen_random_uuid() | PK |
| `org_id` | uuid | — | FK organizaciones, RLS anchor |
| `codigo` | text | NULL | Opcional |
| `nombre` | text | — | NOT NULL |
| `categoria` | text | NULL | CHECK 9 valores (extendido en M006) |
| `precio_unitario` | integer | 0 | CLP neto |
| `unidad_precio` | text | 'hora' | hora/disco/rueda/evento/unidad |
| `horas_estandar` | numeric | NULL | NULL si precio es por evento |
| `activo` | boolean | true | FALSE = suspendido |
| `es_checklist` | boolean | false | R1-R14 |
| `fuente` | text | 'manual' | manual/tallergp_history/tallergp_sync |
| `frecuencia_uso` | integer | 0 | OTs en que apareció |
| `eliminado_en` | timestamptz | NULL | Soft-delete |
| ❌ `estado` | — | — | **No existe.** Pendiente M007. |
| ❌ `requiere_revision` | — | — | **No existe.** Pendiente M007. |

### `items_reparacion` — snapshot fields (ya existen desde M005)

| Campo | Tipo | Notas |
|---|---|---|
| `servicio_catalogo_id` | uuid nullable | FK a catalogo_servicios ON DELETE SET NULL |
| `plantilla_id` | uuid nullable | FK a plantillas_trabajo |
| `horas_estandar_snapshot` | numeric nullable | Horas del catálogo al ejecutar la OT |
| `valor_hora_snapshot` | integer nullable | $/unidad del catálogo al ejecutar |
| `precio_catalogo_snapshot` | integer nullable | Precio neto calculado al ejecutar |
| `nombre_servicio_snapshot` | text nullable | Nombre exacto del catálogo al ejecutar |
| ❌ `categoria_snapshot` | — | **No existe.** Si se necesita, va en M007. |

### Cadena de tablas OT

```
ordenes_trabajo
  └── reparaciones (1:N)
        └── items_reparacion (1:N)
              ├── tipo: 'mano_obra' | 'repuesto' | ...
              ├── costo_unitario, costo_total
              └── [snapshot fields] ← se llenan al vincular catálogo
  └── cargos_ot (1:N)  ← cargos adicionales fuera de items_reparacion
```

`v_ot_totales` agrega `items_reparacion.costo_total` (no toca el catálogo en ningún cálculo). Los snapshots no afectan la vista — solo son trazabilidad. Esto significa que reportes financieros son correctos incluso sin snapshots.

---

## Tarea 3 — Decisión: Opción A vs Opción B

### Opción A — `requiere_revision BOOLEAN DEFAULT FALSE`

```sql
ALTER TABLE catalogo_servicios
  ADD COLUMN requiere_revision BOOLEAN NOT NULL DEFAULT FALSE;
```

Estados posibles combinando con campos existentes:

| `requiere_revision` | `activo` | `eliminado_en` | Significado |
|---|---|---|---|
| FALSE | TRUE | NULL | ✅ Servicio aprobado y activo (normal) |
| TRUE | TRUE | NULL | ⚠️ Pendiente revisión — en uso, no verificado |
| FALSE | FALSE | NULL | Suspendido temporalmente |
| — | — | NOT NULL | Eliminado (soft-delete) |

### Opción B — `estado TEXT CHECK IN ('borrador', 'pendiente_revision', 'aprobado')`

Introduce el estado `borrador` — un servicio creado pero no vinculado a ninguna OT aún.

**¿Cuándo se usaría `borrador`?** El admin crea un servicio sin usarlo aún. Pero este flujo no existe en el taller hoy: los servicios se crean **porque se necesitan en una OT**, no de forma especulativa. El catálogo base se gestiona via SQL/migración, no via UI del mecánico o recepción.

### ✅ Recomendación: Opción A

**Motivo:** Los estados que el negocio necesita ahora son dos: "listo para usar" vs "pendiente que alguien lo revise". No existe el flujo de crear-sin-usar. El estado `borrador` es overengineering para este sprint.

`requiere_revision` es **ortogonal** a `activo`: un servicio puede estar aprobado y suspendido, o pendiente y activo (en uso en una OT activa). Los dos flags no se pisan.

Cuando el negocio crezca y necesite una distinción de ciclo de vida más granular, se agrega `estado TEXT` en una migración futura. El costo de migrar de un boolean a un enum es bajo.

---

## Tarea 1 — Schema confirmado: campos disponibles para snapshots

Al crear un `items_reparacion` vinculado a un servicio de catálogo, la app debe escribir:

```typescript
// Campos que se llenan al vincular servicio (desde catálogo O desde servicio nuevo)
{
  servicio_catalogo_id:     cs.id,
  nombre_servicio_snapshot: cs.nombre,
  horas_estandar_snapshot:  cs.horas_estandar,    // puede ser null
  valor_hora_snapshot:      cs.precio_unitario,    // precio unitario del catálogo
  precio_catalogo_snapshot: cs.precio_unitario,    // precio neto a cobrar
  // costo_unitario y costo_total: mismo valor, el precio cobrado en la OT
  costo_unitario:           precioEditado,         // puede diferir del catálogo
  costo_total:              precioEditado * cantidad,
}
```

**Nota:** `valor_hora_snapshot` y `precio_catalogo_snapshot` son conceptualmente distintos cuando `unidad_precio != 'hora'` (ej: rueda, disco, evento). Para servicios por hora, precio = horas × valor_hora. Para servicios por evento, precio = precio_unitario directamente. En ambos casos, `precio_catalogo_snapshot` captura el precio neto del catálogo al momento de uso.

**`categoria_snapshot` no existe en el schema actual.** Si se necesita para filtrar histórico de OTs por categoría, se agrega en M007. Por ahora, se obtiene via JOIN a `catalogo_servicios` para OTs recientes, y queda sin categoría para OTs donde el servicio fue eliminado del catálogo.

---

## Tarea 2 — Flujo UI/UX

### A) Buscador de servicios en OT

Contexto: el mecánico o la recepcionista está editando una línea `tipo='mano_obra'` de una OT.

```
┌─────────────────────────────────────────────────────────────────┐
│  Agregar trabajo de mano de obra                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [🔍  Buscar por nombre o código...          ] [Categoría ▾]   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ RENOVAR ACEITE MOTOR               mantencion  0.4h $11.400 │
│  │ CAMBIO FILTRO DE ACEITE            mantencion  0.3h  $8.824 │
│  │ MANTENCIÓN FRENOS DELANTEROS       frenos      0.5h $14.706 │
│  │ DIAGNÓSTICO SCANNER                diagnostico 1.0h $29.412 │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ + Crear "REPARACIÓN BOMBA AGUA"  →  nuevo servicio      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Mostrando servicios activos y aprobados.                       │
└─────────────────────────────────────────────────────────────────┘
```

**Comportamiento del buscador:**
- Busca sobre `nombre` (ILIKE `%texto%`) y `codigo` (exact match o ILIKE).
- Filtro base: `activo = TRUE AND eliminado_en IS NULL AND requiere_revision = FALSE`.
- Filtro de categoría opcional en el dropdown.
- Muestra: nombre, categoría (badge de color), horas, precio unitario.
- Si el texto no coincide con nada aprobado, muestra la opción "Crear X" al final.
- Si hay matches parciales similares al texto buscado (fuzzy), muestra un aviso: "¿Quisiste decir CAMBIO BUJÍAS PLATINO?" antes de mostrar "Crear nuevo".
- Límite de resultados: 10 ítems. Si hay más, mostrar "Ver todos" (modal/página separada).

**Servicios pendientes de revisión (`requiere_revision = TRUE`):**
- **No aparecen** en la búsqueda normal de mecánico y recepcionista.
- **Sí aparecen** cuando admin o jefe_taller buscan (con badge ⚠️).
- Esto evita que el catálogo se llene de basura visible para todos.

---

### B) Seleccionar servicio existente

Al hacer clic en un servicio del listado:

```
┌─────────────────────────────────────────────────────────────────┐
│  Trabajo de mano de obra                                        │
├─────────────────────────────────────────────────────────────────┤
│  Servicio:   MANTENCIÓN FRENOS DELANTEROS             [✕ limpiar] │
│  Categoría:  frenos                                             │
│                                                                 │
│  Horas:      [ 0.5  ]   (catálogo: 0.5h)                       │
│  Precio:     [ $ 14.706 ]   (catálogo: $14.706)                 │
│  Cantidad:   [ 1    ]                                           │
│  Total:      $14.706                                            │
│                                                                 │
│  Observación: [_______________________________________]         │
│                                                                 │
│              [Cancelar]                  [Agregar a OT]        │
└─────────────────────────────────────────────────────────────────┘
```

**Reglas al seleccionar:**
1. Precio y horas se pre-llenan desde el catálogo pero son **editables** (el taller puede cobrar diferente en casos especiales).
2. Al guardar, la app escribe en `items_reparacion`:
   - `servicio_catalogo_id = cs.id`
   - Los 4 snapshots con los valores del catálogo **al momento de seleccionar** (no los valores editados por el usuario — los del catálogo).
   - `costo_unitario` = precio editado por el usuario (puede diferir del snapshot).
   - `costo_total` = `costo_unitario × cantidad`.
3. Si el precio fue editado respecto al catálogo, mostrar un indicador visual sutil: "Precio modificado (catálogo: $14.706)".
4. La OT no tiene dependencia del catálogo después de guardado — los snapshots son autónomos.

**Campos que se escriben en `items_reparacion`:**
```
tipo                      = 'mano_obra'
descripcion               = cs.nombre   (o nombre editado por el usuario)
cantidad                  = [ingresada]
costo_unitario            = [precio editado por usuario]
costo_total               = costo_unitario × cantidad
servicio_catalogo_id      = cs.id
nombre_servicio_snapshot  = cs.nombre
horas_estandar_snapshot   = cs.horas_estandar
valor_hora_snapshot       = cs.precio_unitario
precio_catalogo_snapshot  = cs.precio_unitario
```

---

### C) Crear servicio nuevo desde OT

Disponible para: `admin`, `jefe_taller`, `recepcionista`.  
No disponible para: `mecanico` (ver Tarea 4).

```
┌─────────────────────────────────────────────────────────────────┐
│  Nuevo servicio  ⚠️                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Nombre: *  [REPARACIÓN BOMBA AGUA                  ]          │
│             (mín. 5 chars — no "prueba", "xx", etc.)           │
│                                                                 │
│  Categoría: [mecanica                              ▾]          │
│                                                                 │
│  Precio neto: * [$  ___________  ]  CLP                        │
│                                                                 │
│  Horas estándar: [ _____ ]  (opcional — dejar vacío si         │
│                               precio es por evento/unidad)      │
│                                                                 │
│  Código:    [____________] (opcional — se asigna después       │
│                              si el admin lo aprueba)            │
│                                                                 │
│  Observación / motivo:                                          │
│  [_____________________________________________]                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ⚠️  Este servicio quedará pendiente de revisión.      │   │
│  │     Admin o jefe_taller deberá aprobarlo como catálogo  │   │
│  │     oficial. Puedes usarlo en esta OT de inmediato.     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│              [Cancelar]           [Crear y usar en OT]         │
└─────────────────────────────────────────────────────────────────┘
```

**Al hacer "Crear y usar en OT":**

1. INSERT en `catalogo_servicios`:
   ```
   nombre            = [ingresado]
   categoria         = [seleccionada]
   precio_unitario   = [ingresado]
   horas_estandar    = [ingresado o NULL]
   activo            = TRUE
   fuente            = 'manual'
   requiere_revision = TRUE     ← siempre TRUE al crear desde OT
   codigo            = NULL     ← se asigna al aprobar
   ```

2. INSERT en `items_reparacion` con todos los snapshots del nuevo servicio.

3. La línea aparece en la OT con un badge ⚠️ visible solo para roles con permisos de revisión (admin/jefe_taller). El mecánico no ve el badge — ve la línea normal.

**Validaciones del formulario:**
- Nombre: mínimo 5 caracteres, no puede ser solo números o símbolos.
- Precio: entre $0 y $2.000.000 (aviso si es > $500.000 — "¿Precio inusualmente alto?").
- Categoría: obligatoria.
- Si el nombre es muy similar a uno existente (Levenshtein < 3): "¿Quisiste decir [X]?" con botón para volver al buscador.

---

## Tarea 4 — Permisos

### Matriz de acciones por rol

| Acción | admin | jefe_taller | recepcionista | mecanico |
|---|---|---|---|---|
| Buscar servicios aprobados (UI OT) | ✅ | ✅ | ✅ | ✅ |
| Ver servicios pendientes en búsqueda | ✅ | ✅ | ❌ | ❌ |
| Seleccionar servicio existente en OT | ✅ | ✅ | ✅ | ✅ |
| Crear servicio nuevo desde OT | ✅ | ✅ | ✅ | ❌ |
| Aprobar servicio pendiente | ✅ | ✅ | ❌ | ❌ |
| Editar nombre/precio/horas de servicio | ✅ | ✅ | ❌ | ❌ |
| Desactivar servicio (`activo=FALSE`) | ✅ | ✅ | ❌ | ❌ |
| Eliminar servicio (soft-delete) | ✅ | ❌ | ❌ | ❌ |
| Fusionar duplicados | ✅ | ✅ | ❌ | ❌ |
| Ver cola de revisión | ✅ | ✅ | ❌ | ❌ |

### Implicaciones en RLS

El schema actual tiene dos políticas de escritura:
```sql
-- Actual (M005):
catalogo_servicios_insert: mi_rol() IN ('admin', 'jefe_taller')
catalogo_servicios_update: mi_rol() IN ('admin', 'jefe_taller')
```

Para el nuevo flujo se necesita una tercera política:

```sql
-- Nueva (M007):
-- Recepcionista puede crear SOLO con requiere_revision=TRUE
CREATE POLICY "catalogo_servicios_insert_recepcion"
  ON catalogo_servicios FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() = 'recepcionista'
    AND requiere_revision = TRUE
    AND fuente = 'manual'
    AND activo = TRUE
  );
```

El `WITH CHECK` en la cláusula de INSERT garantiza que la recepcionista **no puede** omitir `requiere_revision=TRUE`. Si lo intenta, la DB rechaza el INSERT. Esto es una garantía de integridad, no solo una convención de UI.

Las políticas de UPDATE no cambian: recepcionista no puede editar servicios del catálogo.

### ¿Por qué el mecánico no puede crear servicios?

El mecánico registra **trabajo ejecutado** (horas, descripción técnica). La decisión de qué constituye un servicio de catálogo — con qué precio, nombre oficial y código — es una decisión administrativa. Si el mecánico necesita un servicio que no existe, comunica la necesidad a recepción o jefe. Este límite evita que el catálogo se llene de servicios con precios incorrectos ingresados desde el piso del taller.

---

## Tarea 5 — Cola de revisión

### Pantalla: Catálogo → Pendientes de revisión

Accesible solo para `admin` y `jefe_taller`. Badge de conteo en el menú lateral.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Servicios pendientes de revisión                           3 servicios │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ REPARACIÓN BOMBA AGUA                                            │   │
│  │ mecanica · $85.000 · 2.0h                                        │   │
│  │ Creado por: María González (recepcionista) · hace 2 horas        │   │
│  │ Usado en: OT-000142                                              │   │
│  │                                                                  │   │
│  │ [Aprobar]  [Editar y aprobar]  [Ver en OT]  [Marcar duplicado]  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ CAMBIO BUJIAS                                                    │   │
│  │ mantencion · $15.000 · —h                                        │   │
│  │ Creado por: María González (recepcionista) · hace 5 horas        │   │
│  │ Usado en: OT-000138                                              │   │
│  │                                                                  │   │
│  │ ⚠️ Posible duplicado de: CAMBIO BUJÍAS PLATINO ($45.000)        │   │
│  │                                                                  │   │
│  │ [Aprobar]  [Editar y aprobar]  [Ver en OT]  [Fusionar]          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Acciones disponibles

**Aprobar:**
```sql
UPDATE catalogo_servicios
SET requiere_revision = FALSE, actualizado_en = NOW()
WHERE id = $id AND org_id = mi_org_id();
```
El servicio pasa a ser catálogo oficial. El snapshot en la OT no cambia.

**Editar y aprobar:**
Formulario completo de edición (nombre, categoría, precio, horas, código). Al guardar, `requiere_revision = FALSE`. El snapshot existente en la OT **no cambia** — se muestra una nota: "Los cambios aplican solo a nuevas OTs".

**Marcar duplicado / Fusionar:**
1. El admin selecciona el servicio oficial al que corresponde.
2. La app actualiza `items_reparacion.servicio_catalogo_id` del servicio duplicado → al servicio oficial, en **todas las OTs** donde fue usado.
3. El servicio duplicado se elimina (`eliminado_en = NOW()`).
4. Los snapshots existentes **no cambian** — son inmutables por diseño. Solo el `servicio_catalogo_id` del item se actualiza para apuntar al servicio correcto.

Esta acción es irreversible y debe pedir confirmación con listado de OTs afectadas.

**Rechazar / Desactivar:**
El servicio se desactiva (`activo = FALSE, eliminado_en = NOW()`). Las OTs que lo usaron no se modifican. El snapshot preserva todo lo que la OT necesita.

### Detección automática de duplicados

Al crear un servicio pendiente, se ejecuta una búsqueda de similitud:

```sql
SELECT id, nombre, precio_unitario
FROM catalogo_servicios
WHERE org_id = mi_org_id()
  AND eliminado_en IS NULL
  AND similarity(lower(nombre), lower($nombre_nuevo)) > 0.4
ORDER BY similarity(lower(nombre), lower($nombre_nuevo)) DESC
LIMIT 3;
```

Requiere extensión `pg_trgm` (ya disponible en Supabase por defecto). Si hay matches, se muestra el aviso de posible duplicado tanto en el formulario de creación como en la cola de revisión.

---

## Tarea 6 — Riesgos y mitigaciones

| # | Riesgo | Severidad | Probabilidad | Mitigación |
|---|---|---|---|---|
| R1 | **Duplicados silenciosos** — "CAMBIO BUJIAS" vs "CAMBIO BUJÍAS PLATINO" | Alta | Alta | Búsqueda de similitud antes de mostrar "Crear". Badge en cola de revisión. |
| R2 | **Nombres basura** — "prueba", "xxx", "asdf" | Media | Media | Validación mínima (5 chars, no solo números/símbolos). La cola de revisión actúa de red de seguridad. |
| R3 | **Precio incorrecto** — recepcionista pone $1 o $999.999 | Alta | Media | Rango razonable ($0 – $2.000.000). Warning si outlier vs promedio de la misma categoría. El admin corrige antes de aprobar. |
| R4 | **Catálogo sin control** — acumulación de pendientes sin revisar | Alta | Alta si no hay hábito | Badge numérico en sidebar con conteo. Política del taller: revisar cola cada 48h (proceso, no técnico). |
| R5 | **Reportes contaminados** — OT tiene precio "incorrecto" en snapshot | Alta | Baja | El snapshot es el precio que se cobró (es correcto para el negocio). El admin puede editar el catálogo; el snapshot es inmutable. Si el precio estaba mal, el problema es anterior al snapshot. |
| R6 | **Mecánicos seleccionando no-aprobados** | Media | Baja | Los pendientes no aparecen en la búsqueda del mecánico. Solo admin/jefe ven pendientes. |
| R7 | **Servicios aprobados con precio erróneo** | Alta | Baja | El admin revisa antes de aprobar. Al editar el precio del catálogo, la UI muestra "no afecta OTs anteriores". |
| R8 | **Fusión incorrecta de duplicados** | Alta | Baja | La fusión lista OTs afectadas + pide confirmación explícita. Solo admin puede fusionar. |
| R9 | **`frecuencia_uso` desactualizado** | Baja | Alta | El campo `frecuencia_uso` en `catalogo_servicios` no se actualiza automáticamente. Requiere trigger o actualización manual. No es bloqueante para el flujo principal. |

### Mitigación de R9 (frecuencia_uso)

El campo `frecuencia_uso` en el catálogo quedó como counter manual. Para mantenerlo actualizado se puede usar un trigger en `items_reparacion`:

```sql
-- Trigger: incrementar frecuencia_uso al insertar items_reparacion vinculados
-- Implementar en M007 o posterior — no es crítico para el flujo de revisión.
```

Alternativa: calcularlo on-the-fly con un COUNT(*) en la vista. No bloquea el flujo principal.

---

## Tarea 7 — Migration 007 (schema necesario)

**No crear todavía. Aquí está el SQL para cuando se autorice.**

```sql
-- ─────────────────────────────────────────────────────────────
-- Migration 007 — Catálogo vivo: campo requiere_revision
-- Prerequisito: M005 y M006 aplicadas
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- 1. Campo de revisión (Opción A)
ALTER TABLE catalogo_servicios
  ADD COLUMN requiere_revision BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Los 45 servicios actuales son base confiable → no requieren revisión
UPDATE catalogo_servicios
  SET requiere_revision = FALSE
  WHERE requiere_revision IS DISTINCT FROM FALSE;

-- 3. Índice para la cola de revisión
CREATE INDEX idx_catalogo_revision
  ON catalogo_servicios (org_id, requiere_revision)
  WHERE requiere_revision = TRUE AND eliminado_en IS NULL;

-- 4. Nueva política: recepcionista puede crear solo con requiere_revision=TRUE
CREATE POLICY "catalogo_servicios_insert_recepcion"
  ON catalogo_servicios FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() = 'recepcionista'
    AND requiere_revision = TRUE
    AND fuente = 'manual'
    AND activo = TRUE
  );

-- 5. Política UPDATE: recepcionista NO puede editar catálogo (sin cambio en lógica,
--    pero explícita para documentación). La política actual ya lo excluye.

-- 6. OPCIONAL: categoria_snapshot en items_reparacion
--    Solo si se necesita filtrar OT histórico por categoría sin JOIN al catálogo.
--    Diferir a M008 si no es necesario para el sprint UI.
--
-- ALTER TABLE items_reparacion
--   ADD COLUMN categoria_snapshot TEXT;

COMMIT;
```

---

## Orden de implementación recomendado

### Sprint N (próximo — flujo UI OT)

1. **M007** — `ALTER TABLE catalogo_servicios ADD COLUMN requiere_revision`. Nueva policy INSERT recepcionista.
2. **Componente `ServiceSearchInput`** — buscador con ILIKE + filtro `requiere_revision=FALSE`. Incluye detección de similitud y opción "Crear".
3. **`ItemManoObraForm`** — modal/panel de agregar trabajo: selección de servicio + edición de precio/horas + escritura de snapshots.
4. **Mini-formulario de creación** — inline dentro del modal anterior. POST a `/api/catalogo/create` que fuerza `requiere_revision=TRUE`.
5. **Badge contador en sidebar** — query de `count(*) WHERE requiere_revision=TRUE`. Solo visible para admin/jefe_taller.
6. **Página de cola de revisión** — `/catalogo/revision`. CRUD de aprobación/rechazo. Solo admin/jefe_taller.
7. **Acción de fusión** — dentro de la página de revisión. Transacción que actualiza `servicio_catalogo_id` en `items_reparacion` + elimina el duplicado.
8. **Trigger `frecuencia_uso`** (opcional, puede ir en sprint siguiente).

### Sprint N+1 (post-UI base)

- Notificación (email/push) al admin/jefe_taller cuando hay > 3 pendientes por > 48h.
- Historial de auditoría de aprobaciones (quién aprobó, cuándo, desde qué estado).
- `categoria_snapshot` en `items_reparacion` si los reportes lo requieren.
- `frecuencia_uso` via trigger automático.

---

## Componentes UI necesarios

| Componente | Ruta sugerida | Descripción |
|---|---|---|
| `ServiceSearchInput` | `components/catalogo/ServiceSearchInput.tsx` | Buscador con debounce, filtro por categoría, detección de similitud |
| `ServiceCreateInlineForm` | `components/catalogo/ServiceCreateInlineForm.tsx` | Mini-formulario de creación desde OT |
| `ItemManoObraModal` | `components/ot/ItemManoObraModal.tsx` | Modal completo: buscar + seleccionar + crear + guardar |
| `CatalogoRevisionPage` | `app/(app)/catalogo/revision/page.tsx` | Cola de revisión para admin/jefe |
| `CatalogoRevisionCard` | `components/catalogo/RevisionCard.tsx` | Tarjeta de un servicio pendiente con acciones |
| `RevisionBadge` | `components/layout/Sidebar.tsx` | Badge contador integrado en nav |

---

## Resumen ejecutivo

### Decisión recomendada
**Opción A:** `requiere_revision BOOLEAN DEFAULT FALSE`. Mínimo necesario, ortogonal a `activo`, sin estados ambiguos.

### Campos necesarios
Los 4 snapshots ya existen en `items_reparacion` (M005). Solo falta `requiere_revision` en `catalogo_servicios` y una nueva política RLS para recepcionista. Eso es todo el schema.

### Flujo UI (3 superficies)
1. **OT → Buscador** — filtro `requiere_revision=FALSE`, opción "Crear" si no hay match.
2. **OT → Mini-formulario creación** — POST fuerza `requiere_revision=TRUE`, agrega a OT inmediatamente con snapshots.
3. **Admin/Jefe → Cola revisión** — aprobar, editar+aprobar, fusionar, rechazar.

### Permisos
- Mecánico: solo búsqueda y selección.
- Recepcionista: búsqueda + creación (siempre pendiente).
- Jefe_taller + Admin: todo, incluyendo aprobación y fusión.

### Riesgos principales
Duplicados y precios incorrectos son los más probables. La cola de revisión con detección de similitud es la red de seguridad primaria. El hábito de revisión cada 48h es la mitigación operativa (no técnica).

### Próximo sprint sugerido
1. Autorizar y aplicar M007.
2. Implementar los 7 componentes/páginas en el orden listado.
3. Prueba de flujo completo: recepcionista crea servicio → aparece en OT → admin aprueba → servicio activo en catálogo.
