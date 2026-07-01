# Estrategia de Catálogo Vivo

**Decisión arquitectónica:** 2026-06-30  
**Estado:** Aprobada. No implementar hasta sprint siguiente.

---

## Decisión central

El catálogo de servicios (`catalogo_servicios`) es un **catálogo vivo y progresivo**, no un volcado de datos históricos.

Los 45 servicios actuales (41 seed M005 + 4 M006) son la base confiable. No se importarán masivamente:
- Servicios marcados EXCLUIR en el audit de TallerGP
- Servicios sin código de referencia
- Servicios con menos de 2 usos (usoCount=1 o 0)
- Servicios dudosos sin evidencia adicional

El catálogo crece a medida que el taller lo usa, no antes.

---

## Implicaciones en el flujo OT

### La OT debe poder:

1. **Seleccionar servicios existentes** del catálogo aprobado (`estado = 'aprobado'`).
2. **Crear servicios nuevos** inline cuando no existe el que necesita.
   - El servicio nuevo queda en `estado = 'pendiente_revision'` — nunca aprobado automáticamente.
   - Solo `admin` o `jefe_taller` pueden cambiarlo a `'aprobado'`.
3. **No tocar servicios ni OTs históricas** — las reparaciones existentes no se modifican.

### Snapshots son inmutables

Cuando una OT vincula un servicio (aprobado o pendiente), se escriben los snapshots al momento de creación:
- `nombre_servicio_snapshot` — nombre exacto usado
- `precio_catalogo_snapshot` — precio en ese instante
- `horas_estandar_snapshot` — horas en ese instante
- `valor_hora_snapshot` — tarifa usada

Los snapshots nunca se actualizan aunque el catálogo cambie después.

---

## Schema implicado — campo `estado` en `catalogo_servicios`

El catálogo actual tiene `activo BOOLEAN`. Para soportar el flujo de aprobación se necesita un campo de estado de ciclo de vida. Dos opciones:

### Opción A — Columna `estado TEXT` separada (preferida)

```sql
ALTER TABLE catalogo_servicios
  ADD COLUMN estado TEXT NOT NULL DEFAULT 'aprobado'
  CHECK (estado IN ('borrador', 'pendiente_revision', 'aprobado'));
```

- `borrador`: creado pero no vinculado aún a ninguna OT. Visible solo para admin/jefe_taller.
- `pendiente_revision`: fue creado desde una OT y está en uso, pero no ha sido revisado por el taller. Visible para todos (la OT lo necesita), pero marcado como "no verificado" en la UI.
- `aprobado`: servicio estándar verificado. Visible para todos sin banner de advertencia.

Los 45 servicios existentes se migran con `estado = 'aprobado'`.

**Comportamiento de `activo` (sin cambio):**
- `activo = TRUE`: visible en búsquedas normales de la UI.
- `activo = FALSE`: deshabilitado temporalmente. No aparece en búsquedas pero sigue en el historial.

Los dos campos son ortogonales: un servicio puede ser `estado='aprobado'` y `activo=FALSE` (suspendido), o `estado='pendiente_revision'` y `activo=TRUE` (en uso, pendiente aprobación).

### Opción B — Reutilizar `activo` (no recomendada)

Usar `activo=FALSE` para "no aprobado" confunde "suspendido" con "pendiente". Descartada.

---

## Flujo propuesto para Sprint siguiente

### Pantalla: Edición de ítem en OT (línea de mano de obra)

```
┌─────────────────────────────────────────────────────────┐
│ Buscar servicio...                        [🔍]          │
│                                                         │
│   ○ CAMBIO ACEITE MOTOR                  $11.400        │
│   ○ REVISIÓN FRENOS DELANTEROS           $14.706        │
│   ○ DIAGNÓSTICO SCANNER                  $29.412        │
│   ─────────────────────────────────────────────         │
│   + Crear "REPARACIÓN BOMBA AGUA"  →  (nuevo)           │
└─────────────────────────────────────────────────────────┘
```

- La búsqueda filtra `estado='aprobado' AND activo=TRUE`.
- Si el texto no coincide con nada, aparece la opción "Crear X".
- Seleccionar un servicio existente: llena precio y horas del catálogo, editables en la línea.
- Crear nuevo: abre un mini-formulario inline.

### Mini-formulario de creación desde OT

```
┌─────────────────────────────────────────────────────────┐
│ Nuevo servicio                                          │
│                                                         │
│ Nombre:     [REPARACIÓN BOMBA AGUA         ]            │
│ Categoría:  [mecanica ▾]                               │
│ Precio:     [$  _________ ]                             │
│ Horas:      [  ___  ]                                   │
│                                                         │
│ ⚠️  Se creará como pendiente de revisión               │
│    Admin/jefe podrá aprobarlo como catálogo oficial.   │
│                                                         │
│              [Cancelar]  [Guardar y usar]               │
└─────────────────────────────────────────────────────────┘
```

Al guardar:
1. Se crea `catalogo_servicios` con `estado='pendiente_revision'`, `fuente='manual'`.
2. Se vincula a `items_reparacion.servicio_catalogo_id`.
3. Se escriben los snapshots con los valores ingresados.
4. La línea queda en la OT con un badge `⚠️ No verificado`.

### Pantalla: Cola de revisión de catálogo (admin / jefe_taller)

```
┌─────────────────────────────────────────────────────────┐
│ Servicios pendientes de revisión              3 items   │
│                                                         │
│ REPARACIÓN BOMBA AGUA        mecanica  $85.000  1 OT   │
│ [Aprobar]  [Editar y aprobar]  [Rechazar]               │
│                                                         │
│ CAMBIO BUJÍAS PLATINO        mantencion $45.000  1 OT  │
│ [Aprobar]  [Editar y aprobar]  [Rechazar]               │
└─────────────────────────────────────────────────────────┘
```

Acciones disponibles:
- **Aprobar**: `estado → 'aprobado'`. El servicio pasa a ser parte del catálogo oficial.
- **Editar y aprobar**: corrección de nombre/precio/horas antes de aprobar (snapshot ya fue tomado en la OT, no cambia).
- **Rechazar**: `eliminado_en = NOW()`. La OT que lo usó no se toca — el snapshot preserva todo.

---

## Reglas de negocio

| Regla | Detalle |
|---|---|
| Quién puede crear | Cualquier rol puede crear servicios desde OT. Todos excepto `mecanico` pueden ver el formulario de creación. |
| Quién puede aprobar | Solo `admin` o `jefe_taller`. |
| Snapshot obligatorio | Si se vincula `servicio_catalogo_id`, los 4 campos snapshot deben escribirse. |
| OT usa borrador | Una OT puede usar un servicio `pendiente_revision`. La OT no queda bloqueada. |
| Snapshot no cambia | Aprobar/rechazar/editar el catálogo no modifica snapshots en OTs existentes. |
| OTs históricas | Las OTs y reparaciones existentes (sin `servicio_catalogo_id`) no se tocan. |

---

## Servicios en estado REVIEW (pendientes hasta 2026-06-30)

Dos servicios del audit TallerGP no se modificaron en M006 por evidencia insuficiente (1 OT cada uno). El taller debe confirmarlos antes de cambiarlos:

| Código | Nombre | Actualmente | Propuesto |
|---|---|---|---|
| `1701` | CAJA DE VELOCIDADES DESMONTAR Y MONTAR | 4.5h / $29.412 | 4.0h / $117.648 |
| `3701` | ALTERNADOR DESMONTAR Y MONTAR | 1.0h / $29.412 | 2.0h / $58.824 |

Para aplicar cuando se confirmen, los comandos están en `supabase/migrations/006_catalog_import.sql` como comentarios al final del Bloque 3.

---

## Schema: Migration necesaria antes de implementar UI

Antes del sprint de UI del catálogo se necesita **Migration 007**:

```sql
-- M007 — Ciclo de vida del catálogo
ALTER TABLE catalogo_servicios
  ADD COLUMN estado TEXT NOT NULL DEFAULT 'aprobado'
  CHECK (estado IN ('borrador', 'pendiente_revision', 'aprobado'));

-- Servicios existentes: todos aprobados
UPDATE catalogo_servicios SET estado = 'aprobado';

-- Política SELECT: pendiente_revision visible para todos (la OT lo necesita)
-- El filtro de UI (no mostrar en búsqueda normal) se maneja en app, no en RLS.

-- Opcionalmente: índice para la cola de revisión
CREATE INDEX ON catalogo_servicios (org_id, estado) WHERE estado = 'pendiente_revision';
```

RLS no cambia: `mi_org_id()` sigue siendo el único predicado de aislamiento multiempresa.

---

## Pendientes de decisión antes de implementar

1. ¿El `mecanico` puede crear servicios desde OT o solo seleccionar existentes?
2. ¿Un servicio `pendiente_revision` "Rechazado" se elimina (soft-delete) o pasa a `borrador`?
3. ¿La UI de la OT debe mostrar badge `⚠️` en líneas con servicio no verificado, o es innecesario para el mecánico?
4. ¿Código de servicio es requerido al crear desde OT, o se puede dejar NULL y asignar después?
