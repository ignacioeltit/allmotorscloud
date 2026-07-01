# MIGRATION 005 — Catálogo de Servicios y Mano de Obra

Versión: Sprint 9.1 Night Build — Revisión Arquitectónica Cerrada
Basado en: auditoría de 300 OTs + 10 budgets de TallerGP
Fecha: 2026-06-30

> **ESTADO: ✅ SPEC DEFINITIVA — APROBADA PARA IMPLEMENTAR**
>
> **Decisiones de integración incorporadas (Sprint 10 pre-auditoría):**
>
> **D1 — Sin `trabajo_ot`:** La tabla `trabajo_ot` fue eliminada del spec. La mano de obra
> se sigue registrando en `reparaciones → items_reparacion` (sistema operacional existente).
> Se extiende `items_reparacion` con campos nullable de vínculo al catálogo y snapshots de precio.
> Esto evita duplicar el registro de MO y no rompe el flujo existente.
>
> **D2 — Roles reales:** Se reemplazó el rol inexistente `'editor'` por los roles reales del proyecto.
> Catálogo y configuración: solo `admin` y `jefe_taller`.
> Cargos operacionales: `admin`, `jefe_taller`, `recepcionista`.
>
> **Correcciones de integración adicionales:** FK CASCADE → RESTRICT, `creado_por` en `cargos_ot`,
> `SET search_path = public` en SECURITY DEFINER, políticas separadas por operación,
> `v_ot_totales` reescrita con ruta real `ordenes_trabajo → reparaciones → items_reparacion`.
>
> Evidencia completa en: `tmp/tallergp/services-audit/`

---

## 1. Contexto

### Lo que sabemos con certeza (basado en evidencia)

La auditoría de 300 OTs reales de TallerGP produjo estos hallazgos concretos:

| Hallazgo | Evidencia |
|---|---|
| No existe endpoint `/labor`, `/services`, `/packages` | FASE 1 — HTTP 404 en 14+ endpoints probados |
| Única fuente: `/repair-orders/{id}` | 300 OTs descargadas exitosamente |
| Fórmula verificada: `qty × $/unit × (1 − dto%)` | 100% de líneas con precio > 0 |
| El valor unitario NO es un valor/hora global | 27 valores distintos encontrados |
| 5 tipos de paquete estructuralmente distintos | Ver FASE 7 más abajo |
| Convergencia alcanzada a ~200 OTs para el core | FASE 10 — solo 2 nuevos servicios en último bloque |

---

## 2. Números definitivos del catálogo

```
OTs analizadas:         300  (de 5.449 totales = 5.5%)
Labor lines extraídas: 1.711
Budgets analizados:      10  (de 3.055 totales)

Servicios únicos:         343
  Con código:              55  (16%)
  Sin código (ad-hoc):    288  (84%)
  Con horas estándar:     327  (95%)
  Con precio:             324  (94%)
  Usados ≥2 veces:         76  (22%)

Paquetes únicos:            5
  SSMANTPICK (×54)   — más frecuente
  12PUNTOS   (×46)   — segundo
  SSCAMNEU   (×1)
  KITMAXUSTR (×1)    — paquete de repuestos
  KITL200    (×1)    — paquete de repuestos
```

---

## 3. Fórmula de mano de obra (FASE 8)

### Fórmula confirmada

```
total_linea = ROUND(quantity × unit_price_net × (1 - discount_percentage / 100))
```

**Verificación:** 100% de todas las líneas con precio > 0.

### Tabla de valores unitarios reales (27 valores distintos)

Los valores "hora" en TallerGP representan el **precio por unidad de trabajo**, donde la unidad
puede ser hora, disco, rueda, o evento:

| Valor/unit (CLP) | Categoría | Usos | Servicios clave |
|---|---|---|---|
| **$29.412** | Labor mecánica estándar | 658 | SL0101F, 4200001, MFTB2, 1011 |
| **$28.500** | Labor mantención (pkg SSMANTPICK) | 212 | SL0101, SL0102-SL0105, SLRESSL |
| **$100.000** | Reprogramación electrónica DPF/EGR | 19 | RP00, RP02 |
| **$12.605** | Alineación liviano (por evento) | 18 | ALIAMS |
| **$8.403** | Rectificado disco (por disco) | 31 | RECDIS, RECTAM |
| **$400.000** | Reprogramación ECU (por evento) | 10 | RP01 |
| **$7.353** | Limpieza inyectores | 7 | INJCLE |
| **$4.980** | Balanceo (por rueda) | 16 | 600009 |
| **$4.697** | Montaje neumático (por rueda) | 12 | 600075 |
| **$16.807** | Alineación camioneta (por evento) | 12 | ALIAMSCAM |
| **$35.000** | Programación TPMS | 3 | TPMS |
| *(9 más)*  | Variantes especializadas raras | varios | |

**Implicación de diseño crítica:** El campo `precio_unitario` en la tabla `catalogo_servicios`
almacena el precio **por unidad específica del servicio**, no un valor hora global.
La columna `unidad_precio` (`'hora'/'disco'/'rueda'/'evento'`) clarifica la unidad.

---

## 4. Taxonomía de paquetes (FASE 7)

Se identificaron **3 tipos estructurales** de paquete en TallerGP:

### Tipo A — Cabecera facturable + checklist (12PUNTOS)

```
parts[]
  └── lineType=2, reference="135337", name="Inspeccion 12 PUNTOS...", price=$29.412
       ← Esta línea es la ÚNICA facturada

labor[]
  ├── lineType=0, reference="RFAMS", price=$0 (checklist)
  ├── lineType=0, reference="R1", price=$0
  └── ... (R1-R14, todos $0)
```

**En nuestro modelo:** `tipo_precio = 'cabecera'`, `precio_cabecera = 29412`

### Tipo B — Suma de ítems individuales (SSMANTPICK)

```
labor[]
  ├── lineType=0, reference="SL0101", qty=0.4, price=$28.500 → $11.400
  ├── lineType=0, reference="SL0102", qty=0.1, price=$28.500 → $2.850
  └── ... (6 items, cada uno con precio)

lines_package_parents[]
  └── {id: "SSMANTPICK", name: "SERVICIO MANTENCION PICKUP DIESEL"}
```

**En nuestro modelo:** `tipo_precio = 'suma_items'`, precio = suma de items

### Tipo C — Paquete de repuestos/materiales (KITMAXUSTR, KITL200)

```
parts[]  o  lines
  ├── reference="C00089344:SHIN", tipo=material, SKU real de inventario
  └── ... (todos son repuestos, no labor)
```

**En nuestro modelo:** `tipo_precio = 'suma_items'`, ítems son de tipo `'material'`
con `repuesto_id` vinculado al inventario existente.

---

## 5. Catálogo de servicios importables

### 55 servicios con código de referencia

De estos, **los 36 con código y usoCount ≥ 2** son el catálogo "oficial" a importar:

#### Labor mecánica estándar ($29.412/hr)

| Código | Nombre | Horas | Usos |
|---|---|---|---|
| `SL0101F` | RENOVAR ACEITE DE MOTOR Y FILTRO | 0.5h | ×68 |
| `SL0104` | RENOVAR FILTRO DE AIRE | 0.1h | ×68 |
| `SL0103` | RENOVAR FILTRO COMBUSTIBLE DIESEL | 0.3h | ×61 |
| `1011` | TEST BREVE / DIAGNÓSTICO SCANER 12v | 1h | ×54 |
| `4200001` | MANTENCIÓN FRENOS DELANTEROS | 1h | ×10 |
| `MFTB2` | MANTENCIÓN FRENOS TRASEROS | 1h | ×10 |
| `1602` | CONJUNTO EMBRAGUE DESMONTAR Y MONTAR | 0.5h | ×2 |

#### Labor mantención pickup ($28.500/hr)

| Código | Nombre | Horas | Usos |
|---|---|---|---|
| `SL0102` | RENOVAR FILTRO DE ACEITE | 0.1h | ×54 |
| `SL0101` | RENOVAR ACEITE MOTOR | 0.4h | ×54 |
| `SLRESSL` | REINICIAR INDICADOR MANTENCIÓN | 0.1h | ×52 |
| `SL0105` | RENOVAR FILTRO HABITÁCULO POLÉN | 0.1h | ×52 |

#### Neumáticos (precio por unidad)

| Código | Nombre | Unidad | $/unit | Usos |
|---|---|---|---|---|
| `RECDIS` | RECTIFICADO DISCOS DE FRENO | disco | $8.403 | ×31 |
| `ALIAMS` | ALINEACIÓN VEHÍCULO LIVIANO | evento | $12.605 | ×18 |
| `600009` | BALANCEO UNITARIO | rueda | $4.980 | ×16 |
| `ALIAMSCAM` | ALINEACIÓN CAMIONETA | evento | $16.807 | ×12 |
| `600075` | MONTAJE NEUMÁTICO LIVIANO | rueda | $4.697 | ×12 |

#### Reprogramación electrónica (precio por evento)

| Código | Nombre | $/evento | Usos |
|---|---|---|---|
| `RP00` | ELIMINACIÓN FÍSICA FILTRO PARTÍCULAS DPF | $100.000 | ×3+ |
| `RP01` | REPROGRAMACIÓN ECU BÁSICA | $400.000 | ×3+ |
| `RP02` | REPROGRAMACIÓN DPF/EGR BÁSICO | $100.000 | ×3+ |
| `TPMS` | PROGRAMACIÓN TPMS 1o4 | $35.000 | ×2 |
| `INJCLE` | LIMPIEZA INYECTORES BANCO DE PRUEBA | $7.353 | ×2 |
| `RECTAM` | RECTIFICADO DISCO TRASERO | $8.403 | ×2 |

#### Sub-ítems paquete 12PUNTOS ($0 — solo checklist)

`RFAMS`, `R1`–`R14` (15 ítems, todos $0, forman el paquete inspección)

---

## 6. Schema SQL definitivo

### `catalogo_servicios`

```sql
CREATE TABLE catalogo_servicios (
  id                  UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id              UUID NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,

  -- Identificación (de TallerGP)
  codigo              TEXT,
  nombre              TEXT NOT NULL,
  descripcion         TEXT,
  categoria           TEXT CHECK (categoria IN (
    'mecanica', 'mantencion', 'neumaticos', 'electronica',
    'diagnostico', 'inspeccion', 'otro'
  )),

  -- Precio (la "hora" puede ser hora/disco/rueda/evento según el servicio)
  precio_unitario     INTEGER NOT NULL DEFAULT 0   -- CLP por unidad. 0 = gratuito/checklist
                      CHECK (precio_unitario >= 0),
  unidad_precio       TEXT NOT NULL DEFAULT 'hora'
                      CHECK (unidad_precio IN ('hora','disco','rueda','evento','unidad')),
  horas_estandar      NUMERIC(6,2),        -- NULL si precio es por evento/unidad no-hora

  -- Flags
  -- activo=FALSE: servicio deshabilitado temporalmente (visible en admin, oculto en UI normal).
  -- eliminado_en IS NOT NULL: borrado lógico permanente. Son conceptos distintos; ambos coexisten.
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  es_checklist        BOOLEAN NOT NULL DEFAULT FALSE,  -- true para R1-R14 (solo informativo)

  -- Trazabilidad TallerGP
  fuente              TEXT NOT NULL DEFAULT 'manual'
                      CHECK (fuente IN ('manual','tallergp_history','tallergp_sync')),
  tallergp_reference  TEXT,   -- reference field de TallerGP
  frecuencia_uso      INTEGER DEFAULT 0,  -- cuántas veces apareció en OTs analizadas

  -- Timestamps
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  eliminado_en        TIMESTAMPTZ,

  UNIQUE (org_id, codigo) DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE catalogo_servicios ENABLE ROW LEVEL SECURITY;

-- Todos los roles pueden ver el catálogo (mecánico lo necesita para registrar trabajo).
-- Soft-delete: SELECT filtra eliminado_en IS NULL. Admin ve todo para auditoría.
CREATE POLICY "catalogo_servicios_select"
  ON catalogo_servicios FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND (eliminado_en IS NULL OR mi_rol() = 'admin')
  );

-- Solo admin y jefe_taller pueden crear/modificar el catálogo de precios.
CREATE POLICY "catalogo_servicios_insert"
  ON catalogo_servicios FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller')
  );

CREATE POLICY "catalogo_servicios_update"
  ON catalogo_servicios FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller')
  )
  WITH CHECK (org_id = mi_org_id());
```

### `plantillas_trabajo`

```sql
-- Un "paquete" o template de trabajo (SSMANTPICK, 12PUNTOS, etc.)
CREATE TABLE plantillas_trabajo (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  codigo          TEXT,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  categoria       TEXT CHECK (categoria IN (
    'mecanica', 'mantencion', 'neumaticos', 'electronica',
    'diagnostico', 'inspeccion', 'otro'
  )),

  -- Tipo de paquete (ver FASE 7)
  tipo_precio     TEXT NOT NULL DEFAULT 'suma_items'
                  CHECK (tipo_precio IN ('cabecera','suma_items')),

  -- precio_cabecera: obligatorio cuando tipo_precio='cabecera', NULL cuando 'suma_items'.
  precio_cabecera INTEGER CHECK (precio_cabecera IS NULL OR precio_cabecera >= 0),

  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  fuente          TEXT NOT NULL DEFAULT 'manual'
                  CHECK (fuente IN ('manual','tallergp_history','tallergp_sync')),
  tallergp_package_id TEXT,
  frecuencia_uso  INTEGER NOT NULL DEFAULT 0,

  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  eliminado_en    TIMESTAMPTZ,

  UNIQUE (org_id, codigo) DEFERRABLE INITIALLY DEFERRED,

  -- Integridad: si es paquete de tipo cabecera, el precio debe estar definido.
  CONSTRAINT chk_precio_cabecera_requerido
    CHECK (tipo_precio != 'cabecera' OR precio_cabecera IS NOT NULL)
);

ALTER TABLE plantillas_trabajo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plantillas_trabajo_select"
  ON plantillas_trabajo FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND (eliminado_en IS NULL OR mi_rol() = 'admin')
  );

CREATE POLICY "plantillas_trabajo_insert"
  ON plantillas_trabajo FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller')
  );

CREATE POLICY "plantillas_trabajo_update"
  ON plantillas_trabajo FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller')
  )
  WITH CHECK (org_id = mi_org_id());
```

### `items_plantilla`

**Nota de deuda técnica conocida:** `items_plantilla` no tiene campo `org_id` propio.
La protección multiempresa viene transitivamente del FK a `plantillas_trabajo`, que sí tiene RLS.
Para MVP de un taller esto es aceptable; en expansión SaaS agregar `org_id` aquí y RLS propia.

```sql
CREATE TABLE items_plantilla (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plantilla_id     UUID NOT NULL REFERENCES plantillas_trabajo(id) ON DELETE RESTRICT,

  -- Tipo del ítem dentro del paquete
  -- 'labor'   → servicio de mano de obra (vincula a catalogo_servicios)
  -- 'material' → repuesto o insumo de inventario (vincula a repuestos)
  -- 'other'   → ítem informativo o de otro tipo sin precio facturable
  tipo             TEXT NOT NULL CHECK (tipo IN ('labor','material','other')),

  -- Vínculos al catálogo
  servicio_id      UUID REFERENCES catalogo_servicios(id),
  repuesto_id      UUID REFERENCES repuestos(id),  -- Para paquetes Tipo C

  codigo_externo   TEXT,   -- reference de TallerGP si no hay servicio_id
  nombre           TEXT NOT NULL,

  -- Precio y cantidad
  cantidad         NUMERIC(10,3) NOT NULL DEFAULT 1,
  precio_unitario  INTEGER DEFAULT 0,  -- Para tipo B (suma_items). 0 si es cabecera.

  -- Flags
  es_cabecera      BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE para lineType=2 en Tipo A
  es_checklist     BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE para R1-R14 (precio=$0)
  obligatorio      BOOLEAN NOT NULL DEFAULT TRUE,
  orden            INTEGER NOT NULL DEFAULT 0,

  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_items_plantilla_plantilla ON items_plantilla (plantilla_id);
```

### Extensión de `items_reparacion` — vínculo con catálogo

**Decisión D1:** No se crea tabla `trabajo_ot`. La fuente de verdad de mano de obra es el flujo
operacional existente: `ordenes_trabajo → reparaciones → items_reparacion`.

Se extiende `items_reparacion` con columnas nullable para vincular líneas `tipo='mano_obra'`
al catálogo de servicios y preservar snapshots de precio al momento de la OT.

**Regla de snapshot:** el catálogo puede cambiar precios en el futuro. Las OTs deben conservar
el precio que tenían cuando se ejecutaron. Los campos `*_snapshot` se escriben al crear la línea
y nunca se actualizan aunque el catálogo cambie.

```sql
-- REQUIERE: catalogo_servicios y plantillas_trabajo ya creados (ejecutar después de sus CREATE TABLE)
ALTER TABLE items_reparacion
  -- Vínculo opcional al catálogo de servicios. NULL para trabajos ad-hoc o líneas de repuesto.
  ADD COLUMN servicio_catalogo_id    UUID REFERENCES catalogo_servicios(id) ON DELETE SET NULL,

  -- Vínculo opcional a la plantilla que generó este ítem (paquetes SSMANTPICK, 12PUNTOS, etc.)
  ADD COLUMN plantilla_id            UUID REFERENCES plantillas_trabajo(id) ON DELETE SET NULL,

  -- Snapshots del catálogo al momento de la OT. Inmutables post-creación.
  -- Preservan el precio histórico aunque el catálogo cambie en el futuro.
  ADD COLUMN horas_estandar_snapshot NUMERIC(6,2),      -- horas del catálogo al ejecutar
  ADD COLUMN valor_hora_snapshot     INTEGER,            -- $/unit del catálogo al ejecutar
  ADD COLUMN precio_catalogo_snapshot INTEGER,           -- precio neto calculado al ejecutar
  ADD COLUMN nombre_servicio_snapshot TEXT;              -- nombre del catálogo al ejecutar
```

**Nota de tipos:** `items_reparacion.costo_total` es `NUMERIC(12,2)` (convención del schema).
Los precios de `catalogo_servicios` son `INTEGER` (CLP entero). PostgreSQL castea
automáticamente `INTEGER` a `NUMERIC` en operaciones mixtas — no requiere CAST explícito.
Los snapshots se almacenan como `INTEGER` para preservar la semántica del catálogo.

### `configuracion_mano_obra`

```sql
-- Configuración de precios por categoría de trabajo
-- Los valores son los reales detectados en TallerGP (verificar con el taller)
CREATE TABLE configuracion_mano_obra (
  org_id                    UUID PRIMARY KEY REFERENCES organizaciones(id),

  -- Labor regular (evidencia directa: 658 usos en 300 OTs)
  valor_hora_mecanica        INTEGER NOT NULL DEFAULT 29412,

  -- Labor mantención paquetes (evidencia: SSMANTPICK ×54, 212 usos)
  valor_hora_mantencion      INTEGER NOT NULL DEFAULT 28500,

  -- Especializados (precio por EVENTO, no por hora)
  valor_alineacion_liviano   INTEGER DEFAULT 12605,
  valor_alineacion_camioneta INTEGER DEFAULT 16807,
  valor_reprog_ecu_basica    INTEGER DEFAULT 400000,
  valor_reprog_dpf_egr       INTEGER DEFAULT 100000,
  valor_programacion_tpms    INTEGER DEFAULT 35000,

  -- Precio por UNIDAD (disco, rueda)
  valor_rectificado_disco    INTEGER DEFAULT 8403,
  valor_balanceo_rueda       INTEGER DEFAULT 4980,
  valor_montaje_neumatico    INTEGER DEFAULT 4697,

  -- Configuración general
  moneda                     TEXT NOT NULL DEFAULT 'CLP',
  iva_porcentaje             NUMERIC(5,2) NOT NULL DEFAULT 19,

  actualizado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE configuracion_mano_obra ENABLE ROW LEVEL SECURITY;

-- Mecánico excluido: contiene valores hora y precios de catálogo (información financiera).
CREATE POLICY "configuracion_mo_select"
  ON configuracion_mano_obra FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );

-- Solo admin puede cambiar la tarifa hora (impacto directo en precios).
CREATE POLICY "configuracion_mo_update"
  ON configuracion_mano_obra FOR UPDATE TO authenticated
  USING (org_id = mi_org_id() AND mi_rol() = 'admin')
  WITH CHECK (org_id = mi_org_id());

-- INSERT inicial de configuración se hace en la migración con service_role; no via RLS.
```

### `cargos_ot`

Líneas financieras adicionales de la OT: insumos, traslados, garantías, descuentos y ajustes.
Son ingresadas manualmente al cerrar la OT o al generar el presupuesto.
Aparecen en la factura del cliente. Su IVA se calcula sobre el total de la OT.

**Origen TallerGP:** sección `lines.others` de los budgets (`INSUMOS`, `GARANTIA`, `DSCTO`).

**Reglas de negocio confirmadas:**
- El monto lo define quien cierra la OT o genera el presupuesto — sin fórmula automática.
- Varía por OT según criterio del técnico o recepcionista.
- `monto` se almacena siempre positivo (en CLP neto, sin IVA). Los descuentos son positivos también — la semántica de resta viene del `tipo_cargo`.
- `tipo_cargo = 'descuento'` reduce la base imponible antes del cálculo de IVA.

**Decisión arquitectónica — `tipo_cargo` en lugar de `es_descuento BOOLEAN`:**

Se descartó `es_descuento BOOLEAN` porque:
1. **No es reportable**: imposible agrupar por tipo (insumos vs traslados vs garantías) sin texto libre inconsistente.
2. **GARANTIA es ambigua con boolean**: puede ser un cargo ($0 informativo, o precio positivo), no solo un descuento.
3. **Sin CHECK en `monto`**: el diseño anterior permitía `monto < 0` sin validación, generando datos incoherentes.
4. **Vista incorrecta**: la vista anterior ignoraba `aplica_iva` en las líneas de descuento.

```sql
CREATE TABLE cargos_ot (
  id               UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           UUID          NOT NULL,
  -- ON DELETE RESTRICT: consistente con el resto del schema. Nunca borrar la OT padre
  -- mientras tenga cargos activos. La OT usa soft-delete (eliminado_en), no hard-delete.
  orden_trabajo_id UUID          NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE RESTRICT,

  -- Tipo estructural — define la semántica contable de esta línea en la factura
  -- 'insumo'   → consumibles y desgaste de herramientas (el caso más frecuente)
  -- 'cargo'    → traslado, estacionamiento u otro cargo genérico facturable
  -- 'garantia' → cargo o cobertura de garantía (puede ser $0 solo informativo)
  -- 'descuento'→ reduce la base imponible antes de IVA; monto positivo que se resta
  -- 'ajuste'   → corrección contable menor; no usar post-factura (requiere Nota de Crédito)
  tipo_cargo       TEXT          NOT NULL DEFAULT 'insumo'
                   CHECK (tipo_cargo IN (
                     'insumo', 'cargo', 'garantia', 'descuento', 'ajuste'
                   )),

  -- Texto visible en la factura del cliente.
  -- La UI sugiere valores basados en tipo_cargo pero el usuario puede escribir libremente.
  concepto         TEXT          NOT NULL,
  descripcion      TEXT,

  -- Monto NETO sin IVA, siempre positivo.
  -- Si tipo_cargo='descuento', este valor RESTA del subtotal neto (ver v_ot_totales).
  monto            INTEGER       NOT NULL DEFAULT 0 CHECK (monto >= 0),

  -- IVA por línea. En Chile todos los tipos son IVA-afecto (19%).
  -- El campo existe para cubrir casos edge futuros sin ALTER TABLE.
  aplica_iva       BOOLEAN       NOT NULL DEFAULT TRUE,

  creado_en        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- creado_por: convención del schema para tablas operacionales.
  -- Registra quién cerró la OT o generó el presupuesto con este cargo.
  creado_por       UUID          NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT
);

CREATE INDEX idx_cargos_ot_orden ON cargos_ot (orden_trabajo_id);

ALTER TABLE cargos_ot ENABLE ROW LEVEL SECURITY;

-- Políticas separadas por operación (patrón del proyecto — no usar FOR ALL).
-- Mecánico excluido: cargos_ot contiene información financiera (montos, descuentos).

CREATE POLICY "cargos_ot_select"
  ON cargos_ot FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );

CREATE POLICY "cargos_ot_insert"
  ON cargos_ot FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
    -- Cross-org: verifica que la OT padre pertenece al mismo tenant
    AND (SELECT org_id FROM ordenes_trabajo WHERE id = orden_trabajo_id) = mi_org_id()
  );

CREATE POLICY "cargos_ot_update"
  ON cargos_ot FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id());

-- No hay política DELETE: los cargos no se eliminan.
-- Para anular un cargo usar ajuste con monto=0 o tipo_cargo='descuento'.

-- Protección cross-org adicional vía trigger.
-- La política INSERT ya hace la subquery, pero el trigger cubre UPDATE también.
-- SECURITY DEFINER + SET search_path = public: convención HIGH-LA-1 del proyecto.
CREATE OR REPLACE FUNCTION fn_validar_org_cargos_ot()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ordenes_trabajo
    WHERE id = NEW.orden_trabajo_id AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'La orden de trabajo % no pertenece a la organización %',
      NEW.orden_trabajo_id, NEW.org_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_01_cargos_ot_validar_org
  BEFORE INSERT OR UPDATE ON cargos_ot
  FOR EACH ROW EXECUTE FUNCTION fn_validar_org_cargos_ot();

CREATE TRIGGER trg_50_cargos_ot_set_updated_at
  BEFORE UPDATE ON cargos_ot
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_99_cargos_ot_audit
  AFTER INSERT OR UPDATE OR DELETE ON cargos_ot
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();
```

### Reglas financieras — cálculo de totales OT

**Normativa SII Chile — descuentos comerciales (Circular 31/1997):**
Los descuentos comerciales otorgados al momento de la venta reducen la **base imponible**
antes del cálculo del IVA. No existe IVA sobre la parte descontada.

```
FÓRMULA DE TOTALES (orden obligatorio):

  subtotal_neto_afecto = MO + repuestos + cargos_afectos_iva - descuentos_afectos_iva
  subtotal_exento      = cargos_exentos_iva  (raro — solo casos especiales)

  IVA                  = ROUND(subtotal_neto_afecto × 0.19)
  total_con_iva        = subtotal_neto_afecto + IVA + subtotal_exento

INVARIANTES A RESPETAR:
  - monto en cargos_ot siempre positivo: >= 0
  - descuentos se almacenan positivos, la resta la hace la vista
  - IVA se calcula sobre el neto ajustado, nunca sobre el bruto
  - ajustes post-factura NO modifican la OT → requieren Nota de Crédito electrónica (fuera del MVP)
```

**Ruta de datos (D1 — sin trabajo_ot):**

La vista recorre la ruta operacional real:
```
ordenes_trabajo
  → reparaciones          (sesión de trabajo, tiene orden_trabajo_id)
    → items_reparacion    (líneas: tipo='mano_obra' o tipo='repuesto')
  → cargos_ot             (cargos adicionales, tiene orden_trabajo_id directo)
```

Los CTEs pre-agregan cada fuente independientemente antes del JOIN final (sin producto cartesiano).
`items_reparacion.costo_total` es `NUMERIC(12,2)` — compatible con `INTEGER` de `cargos_ot.monto`
en operaciones aritméticas (PostgreSQL promueve automáticamente).

### VIEW `v_ot_totales`

```sql
CREATE OR REPLACE VIEW v_ot_totales AS
WITH
  -- Todas las líneas de items_reparacion no eliminadas, con su OT ancestral.
  -- Un único CTE de base evita repetir el JOIN reparaciones→items_reparacion.
  lineas AS (
    SELECT
      r.orden_trabajo_id,
      ir.tipo,
      ir.costo_total
    FROM reparaciones r
    JOIN items_reparacion ir ON ir.reparacion_id = r.id
    WHERE ir.eliminado_en IS NULL
  ),

  -- Subtotal de mano de obra por OT
  mo AS (
    SELECT
      orden_trabajo_id,
      SUM(costo_total) AS total,
      COUNT(*)         AS cantidad
    FROM lineas
    WHERE tipo = 'mano_obra'
    GROUP BY orden_trabajo_id
  ),

  -- Subtotal de repuestos por OT
  rep AS (
    SELECT
      orden_trabajo_id,
      SUM(costo_total) AS total
    FROM lineas
    WHERE tipo = 'repuesto'
    GROUP BY orden_trabajo_id
  ),

  -- Cargos adicionales separados por tipo fiscal (cargos_ot.monto es INTEGER)
  cargos AS (
    SELECT
      orden_trabajo_id,
      -- Cargos que suman y son IVA-afectos
      SUM(CASE WHEN tipo_cargo != 'descuento' AND aplica_iva
               THEN monto ELSE 0 END)  AS total_cargos_afectos,
      -- Descuentos que reducen la base imponible (almacenados positivos, restan aquí)
      SUM(CASE WHEN tipo_cargo = 'descuento' AND aplica_iva
               THEN monto ELSE 0 END)  AS total_descuentos_afectos,
      -- Cargos IVA-exentos (raro; aplica_iva=FALSE explícito en la fila)
      SUM(CASE WHEN tipo_cargo != 'descuento' AND NOT aplica_iva
               THEN monto ELSE 0 END)  AS total_cargos_exentos
    FROM cargos_ot
    GROUP BY orden_trabajo_id
  )

SELECT
  ot.id,
  ot.org_id,
  ot.numero_ot,
  ot.estado,

  -- Subtotales desagregados (para UI, reportes y factura)
  COALESCE(mo.total, 0)::NUMERIC(14,2)           AS subtotal_mano_obra,
  COALESCE(mo.cantidad, 0)                        AS cantidad_trabajos,
  COALESCE(rep.total, 0)::NUMERIC(14,2)           AS subtotal_repuestos,
  COALESCE(cargos.total_cargos_afectos, 0)        AS subtotal_otros,
  COALESCE(cargos.total_descuentos_afectos, 0)    AS total_descuentos,
  COALESCE(cargos.total_cargos_exentos, 0)        AS subtotal_exento_iva,

  -- Base imponible = MO + repuestos + otros cargos afectos - descuentos afectos
  (
    COALESCE(mo.total, 0) +
    COALESCE(rep.total, 0) +
    COALESCE(cargos.total_cargos_afectos, 0) -
    COALESCE(cargos.total_descuentos_afectos, 0)
  )::NUMERIC(14,2)                                AS subtotal_neto_afecto,

  -- IVA 19% (SII: descuentos comerciales reducen la base imponible)
  ROUND((
    COALESCE(mo.total, 0) +
    COALESCE(rep.total, 0) +
    COALESCE(cargos.total_cargos_afectos, 0) -
    COALESCE(cargos.total_descuentos_afectos, 0)
  ) * 0.19)::NUMERIC(14,2)                        AS iva,

  -- Total final: base × 1.19 + exentos (sin IVA)
  (
    ROUND((
      COALESCE(mo.total, 0) +
      COALESCE(rep.total, 0) +
      COALESCE(cargos.total_cargos_afectos, 0) -
      COALESCE(cargos.total_descuentos_afectos, 0)
    ) * 1.19) +
    COALESCE(cargos.total_cargos_exentos, 0)
  )::NUMERIC(14,2)                                AS total_con_iva

FROM ordenes_trabajo ot
LEFT JOIN mo     ON mo.orden_trabajo_id     = ot.id
LEFT JOIN rep    ON rep.orden_trabajo_id    = ot.id
LEFT JOIN cargos ON cargos.orden_trabajo_id = ot.id;
```

---

## 7. Seed data

### Servicios (mínimo viable — 36 servicios con código y ≥2 usos)

```sql
-- Reemplazar '<ORG_ID>' con: (SELECT id FROM organizaciones LIMIT 1)

INSERT INTO catalogo_servicios (org_id, codigo, nombre, categoria, precio_unitario, unidad_precio, horas_estandar, fuente, tallergp_reference, frecuencia_uso) VALUES

-- === Labor mecánica estándar: $29.412/hora ===
('<ORG_ID>', 'SL0101F', 'RENOVAR ACEITE DE MOTOR Y FILTRO',          'mantencion', 29412, 'hora', 0.5,  'tallergp_history', 'SL0101F', 68),
('<ORG_ID>', 'SL0104',  'RENOVAR FILTRO DE AIRE',                     'mantencion', 29412, 'hora', 0.1,  'tallergp_history', 'SL0104',  68),
('<ORG_ID>', 'SL0103',  'RENOVAR FILTRO COMBUSTIBLE DIESEL PICKUP',   'mantencion', 29412, 'hora', 0.3,  'tallergp_history', 'SL0103',  61),
('<ORG_ID>', '1011',    'TEST BREVE / DIAGNÓSTICO SCANER 12v',        'diagnostico',29412, 'hora', 1.0,  'tallergp_history', '1011',    54),
('<ORG_ID>', '4200001', 'MANTENCIÓN FRENOS DELANTEROS',               'mecanica',   29412, 'hora', 1.0,  'tallergp_history', '4200001', 10),
('<ORG_ID>', 'MFTB2',   'MANTENCIÓN FRENOS TRASEROS',                 'mecanica',   29412, 'hora', 1.0,  'tallergp_history', 'MFTB2',   10),
('<ORG_ID>', '1129',    'FILTRO DE COMBUSTIBLE RENOVAR',              'mantencion', 29412, 'hora', 0.3,  'tallergp_history', '1129',    3),
('<ORG_ID>', '1316',    'CORREA TRAPEZOIDAL RENOVAR',                 'mecanica',   29412, 'hora', 0.5,  'tallergp_history', '1316',    2),
('<ORG_ID>', '1602',    'CONJUNTO DE EMBRAGUE DESMONTAR Y MONTAR',   'mecanica',   29412, 'hora', 0.5,  'tallergp_history', '1602',    2),
('<ORG_ID>', '1701',    'CAJA DE VELOCIDADES DESMONTAR Y MONTAR',    'mecanica',   29412, 'hora', 4.5,  'tallergp_history', '1701',    3),
('<ORG_ID>', '3701',    'ALTERNADOR DESMONTAR Y MONTAR',             'mecanica',   29412, 'hora', 1.0,  'tallergp_history', '3701',    2),

-- === Labor mantención pickup: $28.500/hora (paquete SSMANTPICK) ===
('<ORG_ID>', 'SL0102',  'RENOVAR FILTRO DE ACEITE',                   'mantencion', 28500, 'hora', 0.1,  'tallergp_history', 'SL0102',  54),
('<ORG_ID>', 'SL0101',  'RENOVAR ACEITE MOTOR',                       'mantencion', 28500, 'hora', 0.4,  'tallergp_history', 'SL0101',  54),
('<ORG_ID>', 'SLRESSL', 'REINICIAR INDICADOR DE MANTENIMIENTO BÁSICO','mantencion', 28500, 'hora', 0.1,  'tallergp_history', 'SLRESSL', 52),
('<ORG_ID>', 'SL0105',  'RENOVAR FILTRO HABITÁCULO POLÉN',            'mantencion', 28500, 'hora', 0.1,  'tallergp_history', 'SL0105',  52),

-- === Neumáticos / precio por disco o rueda ===
('<ORG_ID>', 'RECDIS',   'RECTIFICADO DISCOS DE FRENO',     'mecanica',   8403,  'disco',   2.0, 'tallergp_history', 'RECDIS',   31),
('<ORG_ID>', 'RECTAM',   'RECTIFICADO DISCO TRASERO',       'mecanica',   8403,  'disco',   2.0, 'tallergp_history', 'RECTAM',    2),
('<ORG_ID>', 'ALIAMS',   'ALINEACIÓN VEHÍCULO LIVIANO',     'neumaticos', 12605, 'evento',  1.0, 'tallergp_history', 'ALIAMS',   18),
('<ORG_ID>', '600009',   'BALANCEO UNITARIO',                'neumaticos', 4980,  'rueda',   1.0, 'tallergp_history', '600009',   16),
('<ORG_ID>', 'ALIAMSCAM','ALINEACIÓN CAMIONETA',             'neumaticos', 16807, 'evento',  1.0, 'tallergp_history', 'ALIAMSCAM',12),
('<ORG_ID>', '600075',   'MONTAJE NEUMÁTICO LIVIANO',        'neumaticos', 4697,  'rueda',   1.0, 'tallergp_history', '600075',   12),

-- === Reprogramación electrónica / precio por evento ===
('<ORG_ID>', 'RP00',  'ELIMINACIÓN FÍSICA FILTRO PARTÍCULAS DPF', 'electronica', 100000, 'evento', 1.0, 'tallergp_history', 'RP00',  3),
('<ORG_ID>', 'RP01',  'REPROGRAMACIÓN ECU BÁSICA',                'electronica', 400000, 'evento', 1.0, 'tallergp_history', 'RP01',  3),
('<ORG_ID>', 'RP02',  'REPROGRAMACIÓN DPF/EGR BÁSICO',            'electronica', 100000, 'evento', 1.0, 'tallergp_history', 'RP02',  3),
('<ORG_ID>', 'TPMS',  'PROGRAMACIÓN TPMS 1o4',                   'electronica', 35000,  'evento', 1.0, 'tallergp_history', 'TPMS',  2),
('<ORG_ID>', 'INJCLE','LIMPIEZA INYECTORES BANCO DE PRUEBA',      'mecanica',    7353,   'hora',   4.0, 'tallergp_history', 'INJCLE',2),

-- === Sub-ítems paquete 12PUNTOS ($0 — solo checklist de inspección) ===
('<ORG_ID>', 'RFAMS', 'Servicio Revisión Integral AMS',            'inspeccion',  0, 'hora', 1.0,  'tallergp_history', 'RFAMS', 46),
('<ORG_ID>', 'R1',    'Revisión de Luces',                         'inspeccion',  0, 'hora', NULL, 'tallergp_history', 'R1',   46),
('<ORG_ID>', 'R2',    'Inspección Visual Sistema de Suspensión',   'inspeccion',  0, 'hora', NULL, 'tallergp_history', 'R2',   46),
('<ORG_ID>', 'R3',    'Inspección de Niveles',                     'inspeccion',  0, 'hora', NULL, 'tallergp_history', 'R3',   46),
('<ORG_ID>', 'R4',    'Inspección Visual Filtros',                 'inspeccion',  0, 'hora', NULL, 'tallergp_history', 'R4',   46),
('<ORG_ID>', 'R5',    'Inspección Visual Correas',                 'inspeccion',  0, 'hora', NULL, 'tallergp_history', 'R5',   46),
('<ORG_ID>', 'R6',    'Inspección de Frenos (sacar rueda)',        'inspeccion',  0, 'hora', NULL, 'tallergp_history', 'R6',   46),
('<ORG_ID>', 'R7',    'Inspección Sistema de Dirección',          'inspeccion',  0, 'hora', NULL, 'tallergp_history', 'R7',   46),
('<ORG_ID>', 'R8',    'Inspección Visual y Mecánica Tren Delantero','inspeccion', 0, 'hora', NULL, 'tallergp_history', 'R8',   46),
('<ORG_ID>', 'R9',    'Inspección Visual Neumáticos',              'inspeccion',  0, 'hora', NULL, 'tallergp_history', 'R9',   46),
('<ORG_ID>', 'R10',   'Inspección y Corrección Presión Neumáticos','inspeccion',  0, 'hora', NULL, 'tallergp_history', 'R10',  46),
('<ORG_ID>', 'R11',   'Inspección Fugas de Aceite Motor',         'inspeccion',  0, 'hora', NULL, 'tallergp_history', 'R11',  46),
('<ORG_ID>', 'R12',   'Revisión Batería con Equipo de Diagnóstico','inspeccion',  0, 'hora', NULL, 'tallergp_history', 'R12',  46),
('<ORG_ID>', 'R13',   'Revisión Estado y Funcionamiento Plumillas','inspeccion',  0, 'hora', NULL, 'tallergp_history', 'R13',  46),
('<ORG_ID>', 'R14',   'Inspección Nivel Líquido Limpiaparabrisas','inspeccion',  0, 'hora', NULL, 'tallergp_history', 'R14',  46);
```

### Paquetes

```sql
-- Paquete 1: SSMANTPICK (Tipo B — suma de ítems)
INSERT INTO plantillas_trabajo (org_id, codigo, nombre, tipo_precio, fuente, tallergp_package_id, frecuencia_uso)
VALUES ('<ORG_ID>', 'SSMANTPICK', 'SERVICIO MANTENCIÓN PICKUP DIESEL', 'suma_items', 'tallergp_history', 'SSMANTPICK', 54);

-- Items: vincular por codigo (después de insertar catalogo_servicios)
-- SL0101 0.4h, SL0102 0.1h, SL0103 0.3h, SL0104 0.1h, SL0105 0.1h, SLRESSL 0.1h

-- Paquete 2: 12PUNTOS (Tipo A — cabecera)
INSERT INTO plantillas_trabajo (org_id, codigo, nombre, tipo_precio, precio_cabecera, fuente, tallergp_package_id, frecuencia_uso)
VALUES ('<ORG_ID>', '12PUNTOS', 'Inspección 12 Puntos AMS y más', 'cabecera', 29412, 'tallergp_history', '135337', 46);

-- Items: RFAMS (is_cabecera=false, precio_unitario=0) + R1-R14 (checklist)

-- Paquete 3: SSCAMNEU (Tipo B)
INSERT INTO plantillas_trabajo (org_id, codigo, nombre, tipo_precio, fuente, tallergp_package_id, frecuencia_uso)
VALUES ('<ORG_ID>', 'SSCAMNEU', 'Servicio Cambio de Neumáticos', 'suma_items', 'tallergp_history', 'SSCAMNEU', 1);

-- Items: ALIAMSCAM 1u, 600075 4 ruedas, 600009 4 ruedas

-- Paquetes 4-5: KITMAXUSTR y KITL200 (Tipo C — repuestos)
-- Vincular items a repuesto_id en lugar de servicio_id
```

### Configuración mano de obra

```sql
INSERT INTO configuracion_mano_obra (
  org_id, valor_hora_mecanica, valor_hora_mantencion,
  valor_alineacion_liviano, valor_alineacion_camioneta,
  valor_reprog_ecu_basica, valor_reprog_dpf_egr,
  valor_rectificado_disco, valor_balanceo_rueda, valor_montaje_neumatico,
  valor_programacion_tpms
) VALUES (
  (SELECT id FROM organizaciones LIMIT 1),
  29412, 28500, 12605, 16807, 400000, 100000, 8403, 4980, 4697, 35000
);
-- CONFIRMAR VALORES CON EL TALLER ANTES DE APLICAR
```

### Cargos adicionales — conceptos predefinidos

`cargos_ot` no tiene seed de datos (los montos son manuales por OT).
La UI debe sugerir el `tipo_cargo` y el `concepto` según el contexto:

```
tipo_cargo    concepto sugerido     descripción en factura
─────────────────────────────────────────────────────────
'insumo'    → "Insumos"            Lubricantes, consumibles, desgaste herramientas
'cargo'     → "Traslado"           Si el vehículo requirió traslado
'garantia'  → "Garantía"           Cobertura de garantía (puede ser $0)
'descuento' → "Descuento"          Resta del subtotal neto antes de IVA
'ajuste'    → "Ajuste"             Corrección menor; NO usar post-factura
```

**Regla de UI para descuentos:** el campo `monto` siempre se ingresa como número positivo.
La resta la realiza la vista automáticamente cuando `tipo_cargo = 'descuento'`.

**Flujo en la OT:**
1. Técnico / recepcionista abre la sección "Cargos adicionales" al cerrar la OT o generar presupuesto
2. Selecciona el tipo (dropdown con los 5 tipos) — la UI sugiere un concepto textual automáticamente
3. Puede editar el texto del concepto libremente (es lo que aparece en la factura)
4. Ingresa el monto neto positivo (sin IVA)
5. El sistema calcula el IVA automáticamente al totalizar la OT

**Ejemplo en factura:**
```
Mantención frenos delanteros        $29.412
Mantención frenos traseros          $29.412
Rectificado discos (×2)             $16.806
Insumos                              $8.500   ← tipo_cargo='insumo', ingresado manualmente
─────────────────────────────────────────────
Subtotal neto                       $84.130
IVA 19%                             $15.985
TOTAL                              $100.115
```

**Ejemplo con descuento:**
```
Mantención frenos delanteros        $29.412
Insumos                              $5.000   ← tipo_cargo='insumo'
Descuento cliente frecuente         -$3.000   ← tipo_cargo='descuento', monto=3000 en DB
─────────────────────────────────────────────
Subtotal neto                       $31.412
IVA 19%                              $5.968
TOTAL                               $37.380
```

---

## 8. Convergencia (FASE 10)

| Bloque OTs | Servicios con código acumulados | Nuevos | Paquetes |
|---|---|---|---|
| 1–50 | 36 | +36 | 0 |
| 51–100 | 42 | **+6** | 0 |
| 101–150 | 44 | +2 | 0 |
| 151–200 | 46 | +2 | 0 |
| 201–250 | 53 | +7 (RP00-RP02) | 0 |
| 251–300 | **55** | +2 | 0 |

**Conclusión:** El catálogo codificado converge. Después de las primeras 100 OTs se tiene el 76%
del catálogo codificado. El spike del bloque 201-250 son servicios de reprogramación electrónica
(raros, ×3 usos c/u) que no alteran la convergencia general.

**¿Se requieren más descargas?** Para el catálogo codificado: no. Para los 288 servicios ad-hoc
sin código: aumentar a 1.000 OTs daría más variantes, pero estas no son importables al catálogo
estándar (son trabajos personalizados).

---

## 9. Equivalencias detectadas (FASE 11)

### Alertas de deduplicación (no fusionar automáticamente)

| Similitud | Servicio A | Servicio B | Acción |
|---|---|---|---|
| 100% | `1701` CAJA DE VELOCIDADES D/M | `—` DESMONTAR Y MONTAR CAJA VEL. | Unificar bajo `1701` |
| 100% | `3701` Alternador desmontar y montar | `—` DESMONTAR Y MONTAR ALTERNADOR | Unificar bajo `3701` |
| 80% | `RECDIS` RECTIFICADO DISCOS | `- RECDIS` RECTIFICADO DISCOS DEL. | Normalizar código |
| 75% | `—` RENOVAR ACEITE TRANSMISIÓN | `—` RENOVAR ACEITE TRANSMISIÓN MEC. | Revisar si son distintos |
| 75% | `1316` CORREA TRAP. RENOVAR | `—` TENSOR CORREA TRAP. RENOVAR | Son distintos, OK |

---

## 10. Qué recuperar vs. qué es nuevo

| Concepto | De TallerGP | Mejorado en ERP |
|---|---|---|
| Código de servicio | ✅ Copiar | ✅ Mismo |
| Nombre | ✅ Copiar | ✅ Normalizar mayúsculas/tildes |
| Precio unitario | ✅ Copiar | — |
| Horas estándar | ✅ Copiar | — |
| Paquetes | ✅ Reconstruir | ✅ Tipo A/B/C explícito |
| Unidad de precio | ❌ Implícito en TallerGP | ✅ `unidad_precio` column |
| Categoría | ❌ No existe en TallerGP | ✅ Campo nuevo |
| Mecánico asignado | ✅ Disponible | ✅ `mecanico_id` en `reparaciones` (existente) |
| Frecuencia histórica | ✅ Contada | ✅ `frecuencia_uso` |
| Formula de cálculo | ✅ Reverse engineered | ✅ Implementada en trigger |

### Qué NO recuperar (limpiar al importar)

- Servicios con código-prefijo dash (`- RECDIS`, `- 1032`) → normalizar sin dash
- Servicios con precio $1 (EVALUACION REPARACION) → revisar si es placeholder
- Los 288 servicios ad-hoc sin código → no importar como catálogo estándar
- Paquetes KITMAXUSTR/KITL200 → verificar SKUs contra inventario antes de importar

---

## 11. Sprint siguiente recomendado

### Sprint 10 — Implementar Migration 005

```
Crear supabase/migrations/005_labor_services.sql en /Users/ignacioeltit/APPTALLERPROPIA/
usando el schema completo de este documento.

Pasos (en orden estricto de dependencias):

-- BLOQUE 1: Tablas nuevas (no dependen de nada existente)
1.  CREATE TABLE catalogo_servicios
    + ENABLE ROW LEVEL SECURITY
    + 3 políticas separadas (select/insert/update)
    + triggers trg_50_*_set_updated_at y trg_99_*_audit

2.  CREATE TABLE plantillas_trabajo
    + ENABLE ROW LEVEL SECURITY + constraint chk_precio_cabecera_requerido
    + 3 políticas separadas
    + triggers set_updated_at y audit

3.  CREATE TABLE items_plantilla
    (sin RLS directa — protegida transitivamente por plantillas_trabajo)

4.  CREATE TABLE configuracion_mano_obra
    + ENABLE ROW LEVEL SECURITY
    + 2 políticas (select + update)

-- BLOQUE 2: Extensión de tabla existente (requiere catalogo_servicios y plantillas_trabajo)
5.  ALTER TABLE items_reparacion
    ADD COLUMN servicio_catalogo_id, plantilla_id, horas_estandar_snapshot,
    valor_hora_snapshot, precio_catalogo_snapshot, nombre_servicio_snapshot

-- BLOQUE 3: Tabla operacional nueva (requiere ordenes_trabajo y usuarios)
6.  CREATE TABLE cargos_ot
    + ENABLE ROW LEVEL SECURITY
    + 3 políticas separadas (select/insert/update — mecánico excluido)
    + fn_validar_org_cargos_ot() SECURITY DEFINER SET search_path = public
    + trigger trg_01_cargos_ot_validar_org (BEFORE INSERT OR UPDATE)
    + trigger trg_50_cargos_ot_set_updated_at (BEFORE UPDATE)
    + trigger trg_99_cargos_ot_audit (AFTER INSERT OR UPDATE OR DELETE)

-- BLOQUE 4: Vista (requiere todos los objetos anteriores + reparaciones existente)
7.  CREATE OR REPLACE VIEW v_ot_totales
    (CTEs independientes — ruta: ordenes_trabajo → reparaciones → items_reparacion)

-- BLOQUE 5: Seed data
8.  INSERT INTO catalogo_servicios — 43 servicios
9.  INSERT INTO plantillas_trabajo + items_plantilla — 5 paquetes
10. INSERT INTO configuracion_mano_obra — valores TallerGP (confirmar con taller)

-- BLOQUE 6: Push y validación
11. supabase db push

12. Validar estructura:
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'items_reparacion'
    ORDER BY ordinal_position;
    -- Verificar que las 6 columnas nuevas aparecen al final.

13. Validar vista con OT real que tenga reparaciones e items_reparacion:
    SELECT * FROM v_ot_totales
    WHERE id = (SELECT orden_trabajo_id FROM reparaciones LIMIT 1);
    -- subtotal_mano_obra, subtotal_repuestos deben ser > 0 si la OT tiene trabajo registrado.

14. npm run typecheck (si hay tipos Supabase generados: supabase gen types typescript > types/supabase.ts primero)
```

---

## 12. Deuda técnica documentada

Las siguientes limitaciones son conocidas y aceptadas para el MVP.
Deben resolverse antes de expansión SaaS o auditoría contable formal.

### Baja prioridad (no bloquea MVP)

| # | Tabla | Limitación | Resolución futura |
|---|---|---|---|
| 1 | `items_plantilla` | Sin `org_id` propio — RLS transitiva vía FK | Agregar `org_id` + RLS directa en Sprint de SaaS |
| 2 | `catalogo_servicios` `plantillas_trabajo` | `activo` y `eliminado_en` coexisten; los queries deben filtrar ambos | Documenta la regla: `eliminado_en IS NULL AND activo = TRUE` para UI; omitir en reportes históricos |
| 3 | `configuracion_mano_obra` | Schema fijo por columna; no escala a orgs con categorías distintas | Migrar a tabla `configuracion_precios(org_id, categoria, valor)` en expansión multiempresa |
| 4 | `presupuestos` ya existe en el schema | La tabla `presupuestos` (Migration 003) es un documento separado. `cargos_ot` referencia `ordenes_trabajo` directamente — evaluar si en el futuro los cargos deberían poder vivir también en un `presupuesto` antes de convertirse en OT. | Sprint de facturación |
| 5 | Audit log en `cargos_ot` | `fn_audit_insert_trigger` ya está aplicado en `cargos_ot`. Para `catalogo_servicios` y `plantillas_trabajo` se debe decidir si también aplica (son datos de configuración, no operacionales). | Agregar triggers audit en Sprint siguiente si se requiere rastrear cambios de precios. |

### Fuera de alcance de Migration 005 (requiere migración propia)

| Concepto | Descripción |
|---|---|
| Nota de Crédito electrónica | Ajustes post-factura requieren documento tributario separado. No editar la OT. |
| Boleta vs Factura | La distinción de documento (persona natural vs empresa) afecta la UI pero no el schema de cálculo. |
| Retención de impuestos | Si el taller tiene contratos con empresas que retienen IVA, requiere campo adicional en la OT. |
| Estadísticas IA | Los campos `frecuencia_uso` en catálogo son suficientes para MVP de sugerencias. Para IA real se necesita `items_reparacion` con `servicio_catalogo_id` poblado — se consigue a medida que el taller use el ERP con catálogo vinculado. |
