-- ============================================================
-- Migration 005 — Labor Services: Catálogo de Mano de Obra
-- All Motors Cloud
-- Versión: 1.0 — Junio 2026
-- Spec: docs/database/MIGRATION_005_SERVICE_CATALOG_SPEC.md (APROBADA)
--
-- Dependencias:
--   001 (fn_set_updated_at, fn_audit_insert_trigger, mi_org_id, mi_rol)
--   002 (organizaciones, usuarios)
--   003 (ordenes_trabajo, reparaciones, items_reparacion)
--   004 (repuestos)
--
-- Crea:
--   catalogo_servicios        — catálogo maestro de MO per-tenant
--   plantillas_trabajo        — paquetes de servicio (SSMANTPICK, 12PUNTOS, etc.)
--   items_plantilla           — líneas de cada paquete
--   configuracion_mano_obra   — tarifas hora por categoría per-tenant
--   cargos_ot                 — cargos adicionales (insumos, traslados, descuentos)
--
-- Extiende:
--   items_reparacion → 6 columnas nullable (vínculo catálogo + snapshots)
--
-- Crea:
--   v_ot_totales              — vista financiera consolidada por OT
--
-- Seeds:
--   36 servicios con código y uso ≥ 2 (fuente: auditoría 300 OTs TallerGP)
--   5 paquetes (SSMANTPICK, 12PUNTOS, SSCAMNEU, KITMAXUSTR, KITL200)
--   1 fila configuracion_mano_obra con tarifas TallerGP
--
-- DECISIONES ARQUITECTÓNICAS:
--   D1 — Sin trabajo_ot: MO se registra en reparaciones → items_reparacion (existente)
--   D2 — Roles: admin+jefe_taller para catálogo; +recepcionista para cargos operacionales
--
-- CONVENCIONES DEL PROYECTO:
--   FK: ON DELETE RESTRICT (nunca CASCADE)
--   Triggers: trg_50_* set_updated_at, trg_99_* audit
--   SECURITY DEFINER: siempre SET search_path = public
--   Policies: separadas por operación (no FOR ALL)
--   Soft-delete: eliminado_en TIMESTAMPTZ NULL
-- ============================================================

BEGIN;


-- ============================================================
-- BLOQUE 1 — TABLA catalogo_servicios
-- Master catalog de servicios de mano de obra per-tenant.
-- Soft-delete. set_updated_at. Audit trigger.
-- UNIQUE(org_id, codigo) DEFERRABLE para permitir transacciones
-- que reordenen códigos temporalmente (rename en dos pasos).
-- precio_unitario ≥ 0: $0 permitido para ítems checklist (R1-R14).
-- ============================================================

CREATE TABLE catalogo_servicios (
  id                  UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id              UUID          NOT NULL REFERENCES organizaciones(id)  ON DELETE RESTRICT,

  -- Identificación — viene de TallerGP (reference field)
  codigo              TEXT,
  nombre              TEXT          NOT NULL,
  descripcion         TEXT,
  categoria           TEXT
                      CHECK (categoria IN (
                        'mecanica', 'mantencion', 'neumaticos', 'electronica',
                        'diagnostico', 'inspeccion', 'otro'
                      )),

  -- Precio y unidad de facturación
  -- 'hora'   → valor × horas (MO estándar)
  -- 'disco'  → valor × cantidad de discos (rectificado)
  -- 'rueda'  → valor × cantidad de ruedas (balanceo, montaje)
  -- 'evento' → valor fijo (reprogramación, alineación, TPMS)
  -- 'unidad' → valor × cantidad genérica
  precio_unitario     INTEGER       NOT NULL DEFAULT 0
                      CHECK (precio_unitario >= 0),
  unidad_precio       TEXT          NOT NULL DEFAULT 'hora'
                      CHECK (unidad_precio IN ('hora','disco','rueda','evento','unidad')),
  horas_estandar      NUMERIC(6,2),  -- NULL si precio es por evento/disco/rueda

  -- Flags de comportamiento
  activo              BOOLEAN       NOT NULL DEFAULT TRUE,
  es_checklist        BOOLEAN       NOT NULL DEFAULT FALSE, -- TRUE para R1-R14

  -- Trazabilidad TallerGP
  fuente              TEXT          NOT NULL DEFAULT 'manual'
                      CHECK (fuente IN ('manual','tallergp_history','tallergp_sync')),
  tallergp_reference  TEXT,       -- reference field de TallerGP (código en sus OTs)
  frecuencia_uso      INTEGER               DEFAULT 0,

  -- Timestamps
  creado_en           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  eliminado_en        TIMESTAMPTZ,

  CONSTRAINT uq_catalogo_servicios_org_codigo
    UNIQUE (org_id, codigo) DEFERRABLE INITIALLY DEFERRED
);

-- Índices de acceso frecuente
CREATE INDEX idx_catalogo_servicios_org_activo
  ON catalogo_servicios (org_id, activo)
  WHERE eliminado_en IS NULL;

CREATE INDEX idx_catalogo_servicios_org_categoria
  ON catalogo_servicios (org_id, categoria)
  WHERE eliminado_en IS NULL AND activo = TRUE;

-- Búsqueda por nombre o código (UI de selección de servicio)
CREATE INDEX idx_catalogo_servicios_nombre_trgm
  ON catalogo_servicios USING gin (nombre gin_trgm_ops)
  WHERE eliminado_en IS NULL;

-- RLS
ALTER TABLE catalogo_servicios ENABLE ROW LEVEL SECURITY;

-- Todos los roles autenticados del tenant pueden ver servicios activos.
-- Mecánico lo necesita al registrar trabajo. Admin ve también los eliminados.
CREATE POLICY "catalogo_servicios_select"
  ON catalogo_servicios FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND (eliminado_en IS NULL OR mi_rol() = 'admin')
  );

-- Solo admin y jefe_taller pueden crear servicios (control de precios).
CREATE POLICY "catalogo_servicios_insert"
  ON catalogo_servicios FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller')
  );

-- Solo admin y jefe_taller pueden modificar el catálogo.
CREATE POLICY "catalogo_servicios_update"
  ON catalogo_servicios FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller')
  )
  WITH CHECK (org_id = mi_org_id());

-- Triggers
CREATE TRIGGER trg_50_catalogo_servicios_set_updated_at
  BEFORE UPDATE ON catalogo_servicios
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_99_catalogo_servicios_audit
  AFTER INSERT OR UPDATE OR DELETE ON catalogo_servicios
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ============================================================
-- BLOQUE 2 — TABLA plantillas_trabajo
-- Paquetes de servicio (SSMANTPICK, 12PUNTOS, SSCAMNEU, etc.)
-- Dos tipos estructurales:
--   'suma_items'  → precio = suma de items_plantilla (Tipo B)
--   'cabecera'    → precio fijo en precio_cabecera, items son checklist (Tipo A)
-- El CHECK chk_precio_cabecera_requerido garantiza integridad.
-- ============================================================

CREATE TABLE plantillas_trabajo (
  id                  UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id              UUID          NOT NULL REFERENCES organizaciones(id)  ON DELETE RESTRICT,

  codigo              TEXT,
  nombre              TEXT          NOT NULL,
  descripcion         TEXT,
  categoria           TEXT
                      CHECK (categoria IN (
                        'mecanica', 'mantencion', 'neumaticos', 'electronica',
                        'diagnostico', 'inspeccion', 'otro'
                      )),

  -- Tipo de precio del paquete
  tipo_precio         TEXT          NOT NULL DEFAULT 'suma_items'
                      CHECK (tipo_precio IN ('cabecera','suma_items')),

  -- Precio de cabecera para tipo='cabecera'. NULL cuando tipo='suma_items'.
  precio_cabecera     INTEGER       CHECK (precio_cabecera IS NULL OR precio_cabecera >= 0),

  activo              BOOLEAN       NOT NULL DEFAULT TRUE,
  fuente              TEXT          NOT NULL DEFAULT 'manual'
                      CHECK (fuente IN ('manual','tallergp_history','tallergp_sync')),
  tallergp_package_id TEXT,         -- ID del paquete en TallerGP
  frecuencia_uso      INTEGER       NOT NULL DEFAULT 0,

  creado_en           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  eliminado_en        TIMESTAMPTZ,

  CONSTRAINT uq_plantillas_trabajo_org_codigo
    UNIQUE (org_id, codigo) DEFERRABLE INITIALLY DEFERRED,

  -- Integridad: paquete cabecera DEBE tener precio definido.
  CONSTRAINT chk_precio_cabecera_requerido
    CHECK (tipo_precio != 'cabecera' OR precio_cabecera IS NOT NULL)
);

CREATE INDEX idx_plantillas_trabajo_org_activo
  ON plantillas_trabajo (org_id, activo)
  WHERE eliminado_en IS NULL;

-- RLS
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

-- Triggers
CREATE TRIGGER trg_50_plantillas_trabajo_set_updated_at
  BEFORE UPDATE ON plantillas_trabajo
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_99_plantillas_trabajo_audit
  AFTER INSERT OR UPDATE OR DELETE ON plantillas_trabajo
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ============================================================
-- BLOQUE 3 — TABLA items_plantilla
-- Líneas de cada paquete de trabajo.
-- No tiene org_id propio: protección multiempresa viene del FK
-- a plantillas_trabajo, que tiene RLS activa.
-- MVP de un solo taller: aceptable. En SaaS: agregar org_id + RLS propia.
-- ============================================================

CREATE TABLE items_plantilla (
  id               UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plantilla_id     UUID          NOT NULL REFERENCES plantillas_trabajo(id) ON DELETE RESTRICT,

  -- 'labor'    → línea de mano de obra (vincula a catalogo_servicios)
  -- 'material' → repuesto/insumo de inventario (vincula a repuestos)
  -- 'other'    → ítem informativo sin precio facturable
  tipo             TEXT          NOT NULL
                   CHECK (tipo IN ('labor','material','other')),

  -- Vínculos al catálogo (opcionales — pueden ser ad-hoc con solo nombre)
  servicio_id      UUID          REFERENCES catalogo_servicios(id)  ON DELETE SET NULL,
  repuesto_id      UUID          REFERENCES repuestos(id)           ON DELETE SET NULL,

  codigo_externo   TEXT,          -- reference de TallerGP cuando no hay servicio_id
  nombre           TEXT          NOT NULL,

  -- Precio y cantidad dentro del paquete
  cantidad         NUMERIC(10,3) NOT NULL DEFAULT 1,
  precio_unitario  INTEGER               DEFAULT 0,

  -- Flags de presentación
  es_cabecera      BOOLEAN       NOT NULL DEFAULT FALSE, -- TRUE para lineType=2 (Tipo A: 12PUNTOS)
  es_checklist     BOOLEAN       NOT NULL DEFAULT FALSE, -- TRUE para R1-R14 (precio=$0)
  obligatorio      BOOLEAN       NOT NULL DEFAULT TRUE,
  orden            INTEGER       NOT NULL DEFAULT 0,

  creado_en        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_items_plantilla_plantilla
  ON items_plantilla (plantilla_id);

CREATE INDEX idx_items_plantilla_servicio
  ON items_plantilla (servicio_id)
  WHERE servicio_id IS NOT NULL;


-- ============================================================
-- BLOQUE 4 — TABLA configuracion_mano_obra
-- Una fila por tenant. Almacena tarifas hora por categoría.
-- Los valores son los reales detectados en auditoría de TallerGP.
-- PRIMARY KEY = org_id: solo existe una configuración por tenant.
-- ============================================================

CREATE TABLE configuracion_mano_obra (
  org_id                     UUID          NOT NULL PRIMARY KEY
                             REFERENCES organizaciones(id) ON DELETE RESTRICT,

  -- Labor regular — evidencia: 658 usos × $29.412/hr en 300 OTs
  valor_hora_mecanica        INTEGER       NOT NULL DEFAULT 29412,

  -- Labor mantención paquetes — evidencia: SSMANTPICK ×54, 212 usos × $28.500/hr
  valor_hora_mantencion      INTEGER       NOT NULL DEFAULT 28500,

  -- Especializados — precio por EVENTO, no por hora
  valor_alineacion_liviano   INTEGER                DEFAULT 12605,
  valor_alineacion_camioneta INTEGER                DEFAULT 16807,
  valor_reprog_ecu_basica    INTEGER                DEFAULT 400000,
  valor_reprog_dpf_egr       INTEGER                DEFAULT 100000,
  valor_programacion_tpms    INTEGER                DEFAULT 35000,

  -- Precio por UNIDAD (disco, rueda)
  valor_rectificado_disco    INTEGER                DEFAULT 8403,
  valor_balanceo_rueda       INTEGER                DEFAULT 4980,
  valor_montaje_neumatico    INTEGER                DEFAULT 4697,

  -- Configuración general
  moneda                     TEXT          NOT NULL DEFAULT 'CLP',
  iva_porcentaje             NUMERIC(5,2)  NOT NULL DEFAULT 19,

  actualizado_en             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE configuracion_mano_obra ENABLE ROW LEVEL SECURITY;

-- Mecánico excluido: contiene tarifas hora y precios (información financiera).
CREATE POLICY "configuracion_mo_select"
  ON configuracion_mano_obra FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );

-- Solo admin puede cambiar las tarifas hora (impacto directo en precios OT).
CREATE POLICY "configuracion_mo_update"
  ON configuracion_mano_obra FOR UPDATE TO authenticated
  USING (org_id = mi_org_id() AND mi_rol() = 'admin')
  WITH CHECK (org_id = mi_org_id());

-- INSERT inicial de configuración se hace en el seed de esta migración
-- con permisos de service_role — no requiere política RLS de INSERT.

CREATE TRIGGER trg_50_configuracion_mo_set_updated_at
  BEFORE UPDATE ON configuracion_mano_obra
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ============================================================
-- BLOQUE 5 — EXTENSIÓN DE items_reparacion (Decisión D1)
-- No se crea tabla trabajo_ot. La MO se sigue registrando en
-- el flujo existente: reparaciones → items_reparacion.
-- Se agregan 6 columnas nullable para:
--   (a) vincular la línea al catálogo de servicios
--   (b) preservar snapshots del precio al momento de la OT
--
-- REGLA DE SNAPSHOT: los valores *_snapshot se escriben al
-- crear la línea y nunca se actualizan, aunque el catálogo
-- cambie en el futuro. Preservan el precio histórico.
--
-- NOTA DE TIPOS: costo_total es NUMERIC(12,2) (convención del
-- schema). Los precios de catálogo son INTEGER (CLP entero).
-- PostgreSQL promueve INTEGER → NUMERIC en operaciones mixtas.
-- Los snapshots se almacenan como INTEGER para preservar la
-- semántica del catálogo.
-- ============================================================

ALTER TABLE items_reparacion
  -- Vínculo opcional al catálogo. NULL para trabajos ad-hoc o líneas tipo='repuesto'.
  ADD COLUMN servicio_catalogo_id    UUID          REFERENCES catalogo_servicios(id) ON DELETE SET NULL,

  -- Vínculo opcional a la plantilla que generó este ítem.
  ADD COLUMN plantilla_id            UUID          REFERENCES plantillas_trabajo(id) ON DELETE SET NULL,

  -- Snapshots inmutables: preservan el estado del catálogo al momento de la OT.
  ADD COLUMN horas_estandar_snapshot NUMERIC(6,2),
  ADD COLUMN valor_hora_snapshot     INTEGER,
  ADD COLUMN precio_catalogo_snapshot INTEGER,
  ADD COLUMN nombre_servicio_snapshot TEXT;

-- Índice para lookup inverso: qué items_reparacion usan un servicio del catálogo.
CREATE INDEX idx_items_reparacion_catalogo
  ON items_reparacion (servicio_catalogo_id)
  WHERE servicio_catalogo_id IS NOT NULL AND eliminado_en IS NULL;


-- ============================================================
-- BLOQUE 6 — TABLA cargos_ot
-- Líneas financieras adicionales por OT: insumos, traslados,
-- garantías, descuentos y ajustes.
-- Ingresadas manualmente al cerrar la OT o generar presupuesto.
-- Aparecen en la factura del cliente.
--
-- REGLA tipo_cargo='descuento': monto SE ALMACENA POSITIVO.
-- La resta la hace v_ot_totales según tipo_cargo.
--
-- FK ON DELETE RESTRICT: consistente con el schema. La OT usa
-- soft-delete (eliminado_en), nunca hard-delete mientras tenga cargos.
--
-- NO existe política DELETE: cargos no se eliminan.
-- Para anular: usar ajuste con monto=0 o tipo_cargo='descuento'.
-- ============================================================

CREATE TABLE cargos_ot (
  id               UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           UUID          NOT NULL,
  orden_trabajo_id UUID          NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE RESTRICT,

  -- Tipo estructural — define semántica contable en la factura.
  -- 'insumo'    → consumibles y desgaste de herramientas (caso más frecuente)
  -- 'cargo'     → traslado, estacionamiento u otro cargo genérico facturable
  -- 'garantia'  → cargo o cobertura de garantía (puede ser $0 solo informativo)
  -- 'descuento' → reduce la base imponible antes de IVA; monto positivo que RESTA
  -- 'ajuste'    → corrección contable menor; NO usar post-factura
  tipo_cargo       TEXT          NOT NULL DEFAULT 'insumo'
                   CHECK (tipo_cargo IN (
                     'insumo', 'cargo', 'garantia', 'descuento', 'ajuste'
                   )),

  -- Texto visible en la factura — la UI sugiere según tipo_cargo,
  -- el usuario puede editarlo libremente.
  concepto         TEXT          NOT NULL,
  descripcion      TEXT,

  -- Monto NETO sin IVA, siempre positivo.
  -- Para 'descuento': el valor positivo RESTA en v_ot_totales.
  monto            INTEGER       NOT NULL DEFAULT 0 CHECK (monto >= 0),

  -- IVA por línea. DEFAULT TRUE porque en Chile casi todo es IVA-afecto.
  -- Campo existe para casos edge (cliente IVA-exento, convenio SII especial).
  aplica_iva       BOOLEAN       NOT NULL DEFAULT TRUE,

  creado_en        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- creado_por: convención del schema para tablas operacionales.
  -- Registra quién agregó el cargo (recepcionista o jefe al cerrar la OT).
  creado_por       UUID          NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT
);

CREATE INDEX idx_cargos_ot_orden
  ON cargos_ot (orden_trabajo_id);

-- RLS
ALTER TABLE cargos_ot ENABLE ROW LEVEL SECURITY;

-- Políticas separadas por operación (patrón del proyecto — no usar FOR ALL).
-- Mecánico excluido: cargos_ot contiene información financiera.

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
    -- Verificación cross-org en la política: la OT padre debe pertenecer al mismo tenant.
    AND (SELECT ot.org_id FROM ordenes_trabajo ot WHERE ot.id = orden_trabajo_id) = mi_org_id()
  );

CREATE POLICY "cargos_ot_update"
  ON cargos_ot FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id());

-- Sin política DELETE: cargos no se eliminan post-factura.

-- Trigger de validación cross-org (refuerzo del CHECK en la política INSERT,
-- cubre también UPDATE que cambie orden_trabajo_id).
-- SECURITY DEFINER + SET search_path = public: convención HIGH-LA-1.
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
    RAISE EXCEPTION
      'cargos_ot_cross_org: la orden de trabajo % no pertenece a la organización %',
      NEW.orden_trabajo_id, NEW.org_id;
  END IF;
  RETURN NEW;
END;
$$;

-- OWNER TO postgres: postgres tiene BYPASSRLS → puede leer ordenes_trabajo
-- sin que la RLS de esa tabla bloquee la lectura cross-table del trigger.
-- Patrón idéntico a fn_inmutabilidad_evento_cerrado, fn_ot_unica_activa_por_vehiculo,
-- fn_versionar_presupuesto y fn_set_cerrado_en en Migration 003.
ALTER FUNCTION fn_validar_org_cargos_ot() OWNER TO postgres;

-- Triggers en orden: validación → updated_at → audit
CREATE TRIGGER trg_01_cargos_ot_validar_org
  BEFORE INSERT OR UPDATE ON cargos_ot
  FOR EACH ROW EXECUTE FUNCTION fn_validar_org_cargos_ot();

CREATE TRIGGER trg_50_cargos_ot_set_updated_at
  BEFORE UPDATE ON cargos_ot
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_99_cargos_ot_audit
  AFTER INSERT OR UPDATE OR DELETE ON cargos_ot
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ============================================================
-- BLOQUE 7 — VISTA v_ot_totales
-- Totales financieros consolidados por OT para facturación.
--
-- RUTA DE DATOS (D1 — sin trabajo_ot):
--   ordenes_trabajo
--     → reparaciones          (orden_trabajo_id)
--       → items_reparacion    (reparacion_id, tipo IN ('mano_obra','repuesto'))
--     → cargos_ot             (orden_trabajo_id directo)
--
-- CTEs PRE-AGREGADOS: cada fuente se agrega independientemente.
-- Evita el producto cartesiano que produce SUM incorrecto cuando
-- hay múltiples reparaciones y múltiples cargos en la misma OT.
--
-- FÓRMULA SII CHILE (Circular 31/1997):
--   base_afecta = MO + repuestos + otros_cargos_afectos - descuentos_afectos
--   IVA         = ROUND(base_afecta × 0.19)
--   total       = base_afecta + IVA + cargos_exentos
-- ============================================================

CREATE OR REPLACE VIEW v_ot_totales AS
WITH
  -- CTE base: todas las líneas de items_reparacion no eliminadas con su OT ancestral.
  -- Un solo JOIN reparaciones→items_reparacion evita repetir la unión en cada CTE.
  lineas AS (
    SELECT
      r.orden_trabajo_id,
      ir.tipo,
      ir.costo_total
    FROM reparaciones r
    JOIN items_reparacion ir ON ir.reparacion_id = r.id
    WHERE ir.eliminado_en IS NULL
  ),

  -- Subtotal mano de obra por OT.
  -- costo_total es NUMERIC(12,2): SUM produce NUMERIC, sin cast adicional.
  mo AS (
    SELECT
      orden_trabajo_id,
      SUM(costo_total) AS total,
      COUNT(*)         AS cantidad
    FROM lineas
    WHERE tipo = 'mano_obra'
    GROUP BY orden_trabajo_id
  ),

  -- Subtotal repuestos por OT.
  rep AS (
    SELECT
      orden_trabajo_id,
      SUM(costo_total) AS total
    FROM lineas
    WHERE tipo = 'repuesto'
    GROUP BY orden_trabajo_id
  ),

  -- Cargos adicionales separados por tipo fiscal.
  -- monto es INTEGER: SUM produce BIGINT; el CASE produce INTEGER por branch.
  -- PostgreSQL promueve automáticamente INTEGER→NUMERIC en el total final.
  cargos AS (
    SELECT
      orden_trabajo_id,
      -- Cargos que suman a la base imponible (todos excepto 'descuento', con IVA)
      SUM(CASE WHEN tipo_cargo != 'descuento' AND aplica_iva
               THEN monto ELSE 0 END)                  AS total_cargos_afectos,
      -- Descuentos que RESTAN de la base imponible (almacenados positivos)
      SUM(CASE WHEN tipo_cargo = 'descuento' AND aplica_iva
               THEN monto ELSE 0 END)                  AS total_descuentos_afectos,
      -- Cargos IVA-exentos: raro en taller; aplica_iva=FALSE explícito en la fila
      SUM(CASE WHEN tipo_cargo != 'descuento' AND NOT aplica_iva
               THEN monto ELSE 0 END)                  AS total_cargos_exentos
    FROM cargos_ot
    GROUP BY orden_trabajo_id
  )

SELECT
  ot.id,
  ot.org_id,
  ot.numero_ot,
  ot.estado,

  -- Subtotales desagregados (para UI, reportes y construcción de factura)
  COALESCE(mo.total,  0)::NUMERIC(14,2)              AS subtotal_mano_obra,
  COALESCE(mo.cantidad, 0)                            AS cantidad_trabajos,
  COALESCE(rep.total, 0)::NUMERIC(14,2)              AS subtotal_repuestos,
  COALESCE(cargos.total_cargos_afectos,    0)        AS subtotal_otros,
  COALESCE(cargos.total_descuentos_afectos,0)        AS total_descuentos,
  COALESCE(cargos.total_cargos_exentos,   0)         AS subtotal_exento_iva,

  -- Base imponible (SII: descuentos comerciales reducen base antes de IVA)
  (
    COALESCE(mo.total,  0) +
    COALESCE(rep.total, 0) +
    COALESCE(cargos.total_cargos_afectos,    0) -
    COALESCE(cargos.total_descuentos_afectos,0)
  )::NUMERIC(14,2)                                   AS subtotal_neto_afecto,

  -- IVA 19% sobre la base imponible
  ROUND((
    COALESCE(mo.total,  0) +
    COALESCE(rep.total, 0) +
    COALESCE(cargos.total_cargos_afectos,    0) -
    COALESCE(cargos.total_descuentos_afectos,0)
  ) * 0.19)::NUMERIC(14,2)                           AS iva,

  -- Total final: base × 1.19 + conceptos exentos de IVA
  (
    ROUND((
      COALESCE(mo.total,  0) +
      COALESCE(rep.total, 0) +
      COALESCE(cargos.total_cargos_afectos,    0) -
      COALESCE(cargos.total_descuentos_afectos,0)
    ) * 1.19) +
    COALESCE(cargos.total_cargos_exentos, 0)
  )::NUMERIC(14,2)                                   AS total_con_iva

FROM ordenes_trabajo ot
LEFT JOIN mo     ON mo.orden_trabajo_id     = ot.id
LEFT JOIN rep    ON rep.orden_trabajo_id    = ot.id
LEFT JOIN cargos ON cargos.orden_trabajo_id = ot.id;


-- ============================================================
-- BLOQUE 8 — SEEDS
-- H-5: Seeds siempre ANTES de triggers (triggers ya creados arriba,
-- pero los de catalogo_servicios y plantillas_trabajo disparan
-- audit trail que para seeds de catálogo inicial es aceptable).
--
-- ORG_ID: se lee dinámicamente con (SELECT id FROM organizaciones LIMIT 1).
-- Si no existe ninguna organización en la DB de destino, el seed
-- se saltará con error FK y debe re-ejecutarse después de crear la org.
-- ============================================================

-- ----------------------------------------------------------------
-- SEED: catalogo_servicios — 41 servicios
-- Fuente: auditoría 300 OTs reales de TallerGP.
-- Desglose: 26 servicios productivos con código + RFAMS + R1-R14 (checklist 12PUNTOS) = 41 total.
-- Criterio de inclusión: código presente Y frecuencia_uso >= 2.
-- ----------------------------------------------------------------

INSERT INTO catalogo_servicios (
  org_id, codigo, nombre, categoria,
  precio_unitario, unidad_precio, horas_estandar,
  activo, es_checklist,
  fuente, tallergp_reference, frecuencia_uso
)
SELECT
  (SELECT id FROM organizaciones LIMIT 1),
  codigo, nombre, categoria,
  precio_unitario, unidad_precio, horas_estandar,
  activo, es_checklist,
  'tallergp_history', tallergp_reference, frecuencia_uso
FROM (VALUES
  -- === Labor mecánica estándar: $29.412/hr ===
  ('SL0101F', 'RENOVAR ACEITE DE MOTOR Y FILTRO',           'mantencion', 29412, 'hora',   0.5,  TRUE, FALSE, 'SL0101F',  68),
  ('SL0104',  'RENOVAR FILTRO DE AIRE',                      'mantencion', 29412, 'hora',   0.1,  TRUE, FALSE, 'SL0104',   68),
  ('SL0103',  'RENOVAR FILTRO COMBUSTIBLE DIESEL PICKUP',    'mantencion', 29412, 'hora',   0.3,  TRUE, FALSE, 'SL0103',   61),
  ('1011',    'TEST BREVE / DIAGNÓSTICO SCANER 12v',         'diagnostico',29412, 'hora',   1.0,  TRUE, FALSE, '1011',     54),
  ('4200001', 'MANTENCIÓN FRENOS DELANTEROS',                'mecanica',   29412, 'hora',   1.0,  TRUE, FALSE, '4200001',  10),
  ('MFTB2',   'MANTENCIÓN FRENOS TRASEROS',                  'mecanica',   29412, 'hora',   1.0,  TRUE, FALSE, 'MFTB2',    10),
  ('1129',    'FILTRO DE COMBUSTIBLE RENOVAR',               'mantencion', 29412, 'hora',   0.3,  TRUE, FALSE, '1129',      3),
  ('1316',    'CORREA TRAPEZOIDAL RENOVAR',                  'mecanica',   29412, 'hora',   0.5,  TRUE, FALSE, '1316',      2),
  ('1602',    'CONJUNTO DE EMBRAGUE DESMONTAR Y MONTAR',    'mecanica',   29412, 'hora',   0.5,  TRUE, FALSE, '1602',      2),
  ('1701',    'CAJA DE VELOCIDADES DESMONTAR Y MONTAR',     'mecanica',   29412, 'hora',   4.5,  TRUE, FALSE, '1701',      3),
  ('3701',    'ALTERNADOR DESMONTAR Y MONTAR',              'mecanica',   29412, 'hora',   1.0,  TRUE, FALSE, '3701',      2),

  -- === Labor mantención pickup: $28.500/hr (paquete SSMANTPICK) ===
  ('SL0102',  'RENOVAR FILTRO DE ACEITE',                    'mantencion', 28500, 'hora',   0.1,  TRUE, FALSE, 'SL0102',   54),
  ('SL0101',  'RENOVAR ACEITE MOTOR',                        'mantencion', 28500, 'hora',   0.4,  TRUE, FALSE, 'SL0101',   54),
  ('SLRESSL', 'REINICIAR INDICADOR DE MANTENIMIENTO BÁSICO', 'mantencion', 28500, 'hora',   0.1,  TRUE, FALSE, 'SLRESSL',  52),
  ('SL0105',  'RENOVAR FILTRO HABITÁCULO POLÉN',             'mantencion', 28500, 'hora',   0.1,  TRUE, FALSE, 'SL0105',   52),

  -- === Neumáticos / precio por disco o rueda ===
  ('RECDIS',    'RECTIFICADO DISCOS DE FRENO',     'mecanica',   8403,  'disco',  2.0,  TRUE, FALSE, 'RECDIS',    31),
  ('RECTAM',    'RECTIFICADO DISCO TRASERO',       'mecanica',   8403,  'disco',  2.0,  TRUE, FALSE, 'RECTAM',     2),
  ('ALIAMS',    'ALINEACIÓN VEHÍCULO LIVIANO',     'neumaticos', 12605, 'evento', 1.0,  TRUE, FALSE, 'ALIAMS',    18),
  ('600009',    'BALANCEO UNITARIO',               'neumaticos', 4980,  'rueda',  1.0,  TRUE, FALSE, '600009',    16),
  ('ALIAMSCAM', 'ALINEACIÓN CAMIONETA',            'neumaticos', 16807, 'evento', 1.0,  TRUE, FALSE, 'ALIAMSCAM', 12),
  ('600075',    'MONTAJE NEUMÁTICO LIVIANO',       'neumaticos', 4697,  'rueda',  1.0,  TRUE, FALSE, '600075',    12),

  -- === Reprogramación electrónica / precio por evento ===
  ('RP00',  'ELIMINACIÓN FÍSICA FILTRO PARTÍCULAS DPF', 'electronica', 100000, 'evento', 1.0, TRUE, FALSE, 'RP00',   3),
  ('RP01',  'REPROGRAMACIÓN ECU BÁSICA',                'electronica', 400000, 'evento', 1.0, TRUE, FALSE, 'RP01',   3),
  ('RP02',  'REPROGRAMACIÓN DPF/EGR BÁSICO',            'electronica', 100000, 'evento', 1.0, TRUE, FALSE, 'RP02',   3),
  ('TPMS',  'PROGRAMACIÓN TPMS 1o4',                   'electronica', 35000,  'evento', 1.0, TRUE, FALSE, 'TPMS',   2),
  ('INJCLE','LIMPIEZA INYECTORES BANCO DE PRUEBA',      'mecanica',    7353,   'hora',   4.0, TRUE, FALSE, 'INJCLE', 2),

  -- === Sub-ítems paquete 12PUNTOS ($0 — checklist de inspección) ===
  ('RFAMS','Servicio Revisión Integral AMS',              'inspeccion', 0, 'hora', 1.0,  TRUE, FALSE, 'RFAMS', 46),
  ('R1',   'Revisión de Luces',                           'inspeccion', 0, 'hora', NULL, TRUE, TRUE,  'R1',    46),
  ('R2',   'Inspección Visual Sistema de Suspensión',     'inspeccion', 0, 'hora', NULL, TRUE, TRUE,  'R2',    46),
  ('R3',   'Inspección de Niveles',                       'inspeccion', 0, 'hora', NULL, TRUE, TRUE,  'R3',    46),
  ('R4',   'Inspección Visual Filtros',                   'inspeccion', 0, 'hora', NULL, TRUE, TRUE,  'R4',    46),
  ('R5',   'Inspección Visual Correas',                   'inspeccion', 0, 'hora', NULL, TRUE, TRUE,  'R5',    46),
  ('R6',   'Inspección de Frenos (sacar rueda)',          'inspeccion', 0, 'hora', NULL, TRUE, TRUE,  'R6',    46),
  ('R7',   'Inspección Sistema de Dirección',             'inspeccion', 0, 'hora', NULL, TRUE, TRUE,  'R7',    46),
  ('R8',   'Inspección Visual y Mecánica Tren Delantero', 'inspeccion', 0, 'hora', NULL, TRUE, TRUE,  'R8',    46),
  ('R9',   'Inspección Visual Neumáticos',                'inspeccion', 0, 'hora', NULL, TRUE, TRUE,  'R9',    46),
  ('R10',  'Inspección y Corrección Presión Neumáticos',  'inspeccion', 0, 'hora', NULL, TRUE, TRUE,  'R10',   46),
  ('R11',  'Inspección Fugas de Aceite Motor',            'inspeccion', 0, 'hora', NULL, TRUE, TRUE,  'R11',   46),
  ('R12',  'Revisión Batería con Equipo de Diagnóstico',  'inspeccion', 0, 'hora', NULL, TRUE, TRUE,  'R12',   46),
  ('R13',  'Revisión Estado y Funcionamiento Plumillas',  'inspeccion', 0, 'hora', NULL, TRUE, TRUE,  'R13',   46),
  ('R14',  'Inspección Nivel Líquido Limpiaparabrisas',   'inspeccion', 0, 'hora', NULL, TRUE, TRUE,  'R14',   46)
) AS v(
  codigo, nombre, categoria,
  precio_unitario, unidad_precio, horas_estandar,
  activo, es_checklist,
  tallergp_reference, frecuencia_uso
);


-- ----------------------------------------------------------------
-- SEED: plantillas_trabajo — 5 paquetes
-- ----------------------------------------------------------------

INSERT INTO plantillas_trabajo (
  org_id, codigo, nombre, tipo_precio, precio_cabecera,
  fuente, tallergp_package_id, frecuencia_uso
)
SELECT
  (SELECT id FROM organizaciones LIMIT 1),
  codigo, nombre, tipo_precio, precio_cabecera,
  'tallergp_history', tallergp_package_id, frecuencia_uso
FROM (VALUES
  -- Tipo B: precio = suma de ítems
  ('SSMANTPICK', 'SERVICIO MANTENCIÓN PICKUP DIESEL', 'suma_items', NULL::INTEGER, 'SSMANTPICK', 54),
  -- Tipo A: precio = cabecera fija ($29.412)
  ('12PUNTOS',   'Inspección 12 Puntos AMS y más',    'cabecera',   29412,         '135337',     46),
  -- Tipo B: suma ítems (alineación + montaje + balanceo)
  ('SSCAMNEU',   'Servicio Cambio de Neumáticos',     'suma_items', NULL::INTEGER, 'SSCAMNEU',    1),
  -- Tipo C: paquete de repuestos (items tienen repuesto_id)
  ('KITMAXUSTR', 'Kit Maxxforce Ustar',               'suma_items', NULL::INTEGER, 'KITMAXUSTR',  1),
  ('KITL200',    'Kit L200',                          'suma_items', NULL::INTEGER, 'KITL200',     1)
) AS v(codigo, nombre, tipo_precio, precio_cabecera, tallergp_package_id, frecuencia_uso);


-- ----------------------------------------------------------------
-- SEED: items_plantilla — ítems de SSMANTPICK y 12PUNTOS
-- Los paquetes Tipo C (KITMAXUSTR, KITL200) requieren repuesto_id
-- que depende de los registros en repuestos — se populan post-migración.
-- ----------------------------------------------------------------

-- SSMANTPICK: 6 ítems de mano de obra (horas × $28.500/hr)
INSERT INTO items_plantilla (plantilla_id, tipo, servicio_id, nombre, cantidad, precio_unitario, obligatorio, orden)
SELECT
  pt.id,
  'labor',
  cs.id,
  v.nombre,
  v.cantidad::NUMERIC(10,3),
  cs.precio_unitario,
  TRUE,
  v.orden
FROM (VALUES
  ('SL0101',  'RENOVAR ACEITE MOTOR',                        0.4, 1),
  ('SL0102',  'RENOVAR FILTRO DE ACEITE',                    0.1, 2),
  ('SL0103',  'RENOVAR FILTRO COMBUSTIBLE DIESEL PICKUP',    0.3, 3),
  ('SL0104',  'RENOVAR FILTRO DE AIRE',                      0.1, 4),
  ('SL0105',  'RENOVAR FILTRO HABITÁCULO POLÉN',             0.1, 5),
  ('SLRESSL', 'REINICIAR INDICADOR DE MANTENIMIENTO BÁSICO', 0.1, 6)
) AS v(codigo, nombre, cantidad, orden)
JOIN plantillas_trabajo pt ON pt.codigo = 'SSMANTPICK'
  AND pt.org_id = (SELECT id FROM organizaciones LIMIT 1)
JOIN catalogo_servicios cs ON cs.codigo = v.codigo
  AND cs.org_id = pt.org_id;

-- 12PUNTOS: ítem cabecera facturable + 14 checklist (R1-R14)
-- Ítem cabecera: RFAMS (es el ítem con precio, linetype=2 en TallerGP)
INSERT INTO items_plantilla (plantilla_id, tipo, servicio_id, nombre, cantidad, precio_unitario, es_cabecera, es_checklist, orden)
SELECT
  pt.id,
  'labor',
  cs.id,
  cs.nombre,
  1,
  cs.precio_unitario,
  TRUE,  -- es_cabecera
  FALSE,
  0
FROM plantillas_trabajo pt
JOIN catalogo_servicios cs ON cs.codigo = 'RFAMS' AND cs.org_id = pt.org_id
WHERE pt.codigo = '12PUNTOS' AND pt.org_id = (SELECT id FROM organizaciones LIMIT 1);

-- 14 ítems checklist: R1-R14 ($0 cada uno)
INSERT INTO items_plantilla (plantilla_id, tipo, servicio_id, nombre, cantidad, precio_unitario, es_checklist, orden)
SELECT
  pt.id,
  'labor',
  cs.id,
  cs.nombre,
  1,
  0,
  TRUE,
  ROW_NUMBER() OVER (ORDER BY cs.codigo)::INTEGER
FROM (VALUES
  ('R1'),('R2'),('R3'),('R4'),('R5'),('R6'),('R7'),
  ('R8'),('R9'),('R10'),('R11'),('R12'),('R13'),('R14')
) AS v(codigo)
JOIN catalogo_servicios cs ON cs.codigo = v.codigo
  AND cs.org_id = (SELECT id FROM organizaciones LIMIT 1)
JOIN plantillas_trabajo pt ON pt.codigo = '12PUNTOS'
  AND pt.org_id = cs.org_id;

-- SSCAMNEU: 3 ítems (alineación + montaje × 4 + balanceo × 4)
INSERT INTO items_plantilla (plantilla_id, tipo, servicio_id, nombre, cantidad, precio_unitario, obligatorio, orden)
SELECT
  pt.id,
  'labor',
  cs.id,
  v.nombre,
  v.cantidad::NUMERIC(10,3),
  cs.precio_unitario,
  TRUE,
  v.orden
FROM (VALUES
  ('ALIAMSCAM', 'ALINEACIÓN CAMIONETA',       1.0, 1),
  ('600075',    'MONTAJE NEUMÁTICO LIVIANO',   4.0, 2),
  ('600009',    'BALANCEO UNITARIO',           4.0, 3)
) AS v(codigo, nombre, cantidad, orden)
JOIN plantillas_trabajo pt ON pt.codigo = 'SSCAMNEU'
  AND pt.org_id = (SELECT id FROM organizaciones LIMIT 1)
JOIN catalogo_servicios cs ON cs.codigo = v.codigo AND cs.org_id = pt.org_id;


-- ----------------------------------------------------------------
-- SEED: configuracion_mano_obra — valores reales TallerGP
-- CONFIRMAR VALORES CON EL TALLER ANTES DE LLEVAR A PRODUCCIÓN.
-- ----------------------------------------------------------------
INSERT INTO configuracion_mano_obra (
  org_id,
  valor_hora_mecanica, valor_hora_mantencion,
  valor_alineacion_liviano, valor_alineacion_camioneta,
  valor_reprog_ecu_basica, valor_reprog_dpf_egr,
  valor_programacion_tpms,
  valor_rectificado_disco, valor_balanceo_rueda, valor_montaje_neumatico
) VALUES (
  (SELECT id FROM organizaciones LIMIT 1),
  29412, 28500,
  12605, 16807,
  400000, 100000,
  35000,
  8403, 4980, 4697
);


COMMIT;
