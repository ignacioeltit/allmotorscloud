-- ============================================================
-- Migration 003 — Operational Core
-- All Motors Cloud
-- Versión: 1.0 — Junio 2026
-- Spec: docs/database/MIGRATION_003_SPEC.md v0.2 APPROVED WITH CONDITIONS
-- Dependencias: 001_initial_schema.sql, 002_domain_core.sql
-- ============================================================
--
-- ORDEN DE EJECUCIÓN:
--   Paso 01  — ordenes_trabajo
--   Paso 01b — FK diferida eventos.orden_trabajo_id → ordenes_trabajo.id
--   Paso 02  — citas
--   Paso 03  — presupuestos (+ FK self-referencial via ALTER TABLE)
--   Paso 04  — items_presupuesto
--   Paso 05  — reparaciones
--   Paso 06  — items_reparacion
--   Paso 07  — entregas
--   Paso 08  — evidencias
--   Paso 09  — garantias
--   Paso 10  — Índices
--   Paso 11  — Seeds (ninguno)
--   Paso 12  — Funciones de trigger nuevas
--   Paso 13  — Triggers (DESPUÉS de seeds — H-5)
--   Paso 14  — RLS + Policies
--
-- SPEC COMPLIANCE NOTES:
--   BLOCKER-SEC-1: INSERT policies de presupuestos, items_presupuesto,
--                  items_reparacion y garantias incluyen subquery cross-tenant (§9)
--   Advisory lock : fn_ot_unica_activa_por_vehiculo usa pg_advisory_xact_lock
--   Trigger 1     : fn_inmutabilidad_evento_cerrado protege 14 campos de eventos cerrados
--   R-09 resuelto : fn_set_cerrado_en setea cerrado_en automáticamente al cerrar OT
--   Versioning    : fn_versionar_presupuesto garantiza secuencia version desde DB
--   SECURITY DEFINER: todas las funciones nuevas usan SET search_path = public + OWNER postgres
-- ============================================================

BEGIN;


-- ============================================================
-- PASO 01 — TABLA ordenes_trabajo
-- Per-tenant. Soft-delete. Audit trigger. set_updated_at.
-- numero_ot UNIQUE(org_id, numero_ot) NO es partial — número de documento legal.
-- cerrado_en: auto-seteado por trigger fn_set_cerrado_en (Paso 12).
--   El CHECK chk_ordenes_trabajo_cerrado_en se evalúa DESPUÉS del BEFORE trigger
--   (PostgreSQL: triggers BEFORE modifican NEW antes de que los CHECKs sean evaluados).
-- ============================================================

CREATE TABLE ordenes_trabajo (
  id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id                  UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  vehiculo_id             UUID        NOT NULL REFERENCES vehiculos(id)      ON DELETE RESTRICT,
  numero_ot               TEXT        NOT NULL,
  estado                  TEXT        NOT NULL DEFAULT 'pendiente_diagnostico',
  sucursal_id             UUID                 REFERENCES sucursales(id)     ON DELETE SET NULL,
  recepcionista_id        UUID                 REFERENCES usuarios(id)       ON DELETE SET NULL,
  km_ingreso              INTEGER,
  fecha_prometida_entrega DATE,
  notas                   TEXT,
  cerrado_en              TIMESTAMPTZ,
  creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por              UUID        NOT NULL REFERENCES usuarios(id)       ON DELETE RESTRICT,
  eliminado_en            TIMESTAMPTZ,
  eliminado_por           UUID                 REFERENCES usuarios(id)       ON DELETE SET NULL,
  CONSTRAINT chk_ordenes_trabajo_estado
    CHECK (estado IN (
      'pendiente_diagnostico', 'diagnosticada', 'presupuesto_pendiente',
      'presupuesto_enviado', 'autorizada', 'en_reparacion', 'control_calidad',
      'lista_para_entrega', 'entregada', 'cerrada', 'cancelada'
    )),
  CONSTRAINT chk_ordenes_trabajo_cerrado_en
    CHECK (
      (estado NOT IN ('cerrada', 'cancelada') AND cerrado_en IS NULL) OR
      (estado IN ('cerrada', 'cancelada') AND cerrado_en IS NOT NULL)
    ),
  CONSTRAINT uq_ordenes_trabajo_org_numero_ot
    UNIQUE (org_id, numero_ot)
);


-- ============================================================
-- PASO 01b — FK DIFERIDA: eventos.orden_trabajo_id → ordenes_trabajo.id
-- Columna existe desde Migration 002 como UUID NULL sin FK activa.
-- Se completa aquí, inmediatamente después de crear ordenes_trabajo.
-- Patrón idéntico a los pasos 04b y 08b de Migration 002 (CORRECCIÓN-R-2).
-- ============================================================

ALTER TABLE eventos
  ADD CONSTRAINT fk_eventos_orden_trabajo_id
    FOREIGN KEY (orden_trabajo_id) REFERENCES ordenes_trabajo(id) ON DELETE RESTRICT;


-- ============================================================
-- PASO 02 — TABLA citas
-- Per-tenant. Soft-delete. Audit trigger. set_updated_at.
-- PA9: diseño provisional — DATABASE_MODEL no especifica citas aún.
-- recepcion_evento_id: apunta al evento de tipo 'recepcion' generado
--   cuando el cliente con cita previa llega (dirección: cita → evento_recepcion).
-- ============================================================

CREATE TABLE citas (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id                UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  vehiculo_id           UUID        NOT NULL REFERENCES vehiculos(id)      ON DELETE RESTRICT,
  cliente_id            UUID                 REFERENCES clientes(id)       ON DELETE SET NULL,
  conductor_id          UUID                 REFERENCES conductores(id)    ON DELETE SET NULL,
  sucursal_id           UUID                 REFERENCES sucursales(id)     ON DELETE SET NULL,
  asignado_a            UUID                 REFERENCES usuarios(id)       ON DELETE SET NULL,
  fecha_cita            TIMESTAMPTZ NOT NULL,
  duracion_estimada_min SMALLINT,
  tipo_servicio         TEXT,
  estado                TEXT        NOT NULL DEFAULT 'programada',
  notas                 TEXT,
  recepcion_evento_id   UUID                 REFERENCES eventos(id)        ON DELETE SET NULL,
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por            UUID        NOT NULL REFERENCES usuarios(id)       ON DELETE RESTRICT,
  eliminado_en          TIMESTAMPTZ,
  eliminado_por         UUID                 REFERENCES usuarios(id)       ON DELETE SET NULL,
  CONSTRAINT chk_citas_estado
    CHECK (estado IN ('programada', 'confirmada', 'cancelada', 'realizada', 'no_presentada'))
);


-- ============================================================
-- PASO 03 — TABLA presupuestos
-- Per-tenant. Soft-delete. Audit trigger. set_updated_at.
-- presupuesto_anterior_id: FK self-referencial añadida via ALTER TABLE
--   inmediatamente después (PostgreSQL no puede referenciar tabla en definición inicial).
-- version: auto-seteado por trigger fn_versionar_presupuesto (Paso 12).
--   DEFAULT 1 es el fallback; el trigger siempre lo sobreescribe en INSERT.
-- UNIQUE(presupuesto_anterior_id): una sola versión siguiente por versión anterior.
--   PostgreSQL UNIQUE permite múltiples NULL → múltiples v1 raíz por OT son válidas.
-- ============================================================

CREATE TABLE presupuestos (
  id                      UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id                  UUID          NOT NULL REFERENCES organizaciones(id)  ON DELETE RESTRICT,
  orden_trabajo_id        UUID          NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE RESTRICT,
  presupuesto_anterior_id UUID,                  -- FK self-ref añadida abajo via ALTER TABLE
  version                 SMALLINT      NOT NULL DEFAULT 1,
  estado                  TEXT          NOT NULL DEFAULT 'borrador',
  total_mano_obra         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_repuestos         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_descuentos        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_neto              NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas                   TEXT,
  enviado_en              TIMESTAMPTZ,
  autorizado_en           TIMESTAMPTZ,
  autorizado_por_nombre   TEXT,
  rechazado_en            TIMESTAMPTZ,
  razon_rechazo           TEXT,
  creado_en               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  creado_por              UUID          NOT NULL REFERENCES usuarios(id)        ON DELETE RESTRICT,
  eliminado_en            TIMESTAMPTZ,
  eliminado_por           UUID                   REFERENCES usuarios(id)        ON DELETE SET NULL,
  CONSTRAINT chk_presupuestos_estado
    CHECK (estado IN ('borrador', 'enviado', 'autorizado', 'rechazado')),
  CONSTRAINT uq_presupuestos_anterior_id
    UNIQUE (presupuesto_anterior_id)
);

-- FK self-referencial: presupuesto_anterior_id → presupuestos.id
-- Separada del CREATE TABLE porque la tabla debe existir antes de referenciar a sí misma.
ALTER TABLE presupuestos
  ADD CONSTRAINT fk_presupuestos_anterior_id
    FOREIGN KEY (presupuesto_anterior_id) REFERENCES presupuestos(id) ON DELETE RESTRICT;


-- ============================================================
-- PASO 04 — TABLA items_presupuesto
-- Per-tenant. Soft-delete. Audit trigger. set_updated_at.
-- repuesto_id: UUID NULL sin FK activa — FK formal en Migration 004.
-- precio_total = cantidad * precio_unitario * (1 - descuento/100).
--   Denormalización deliberada (MIGRATION_003_SPEC §4.4).
-- ============================================================

CREATE TABLE items_presupuesto (
  id                   UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id               UUID          NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  presupuesto_id       UUID          NOT NULL REFERENCES presupuestos(id)   ON DELETE RESTRICT,
  tipo                 TEXT          NOT NULL,
  descripcion          TEXT          NOT NULL,
  repuesto_id          UUID,                   -- FK diferida → repuestos.id (Migration 004)
  cantidad             NUMERIC(10,3) NOT NULL DEFAULT 1,
  precio_unitario      NUMERIC(12,2) NOT NULL,
  descuento_porcentaje NUMERIC(5,2)  NOT NULL DEFAULT 0,
  precio_total         NUMERIC(12,2) NOT NULL,
  autorizador_id       UUID                   REFERENCES usuarios(id)       ON DELETE SET NULL,
  creado_en            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  creado_por           UUID          NOT NULL REFERENCES usuarios(id)       ON DELETE RESTRICT,
  eliminado_en         TIMESTAMPTZ,
  eliminado_por        UUID                   REFERENCES usuarios(id)       ON DELETE SET NULL,
  CONSTRAINT chk_items_presupuesto_tipo
    CHECK (tipo IN ('mano_obra', 'repuesto'))
);


-- ============================================================
-- PASO 05 — TABLA reparaciones
-- Per-tenant. SIN eliminado_en (inmutable; errores se corrigen con evento 'correccion').
-- Audit trigger. set_updated_at.
-- evento_trabajo_id: evento técnico de ejecución (no el de autorización del cliente).
--   La validación del prerrequisito de autorización es responsabilidad de la aplicación.
-- DATABASE_MODEL §10, Regla 6: "Reparación no puede existir sin evento técnico cerrado y autorizado."
-- ============================================================

CREATE TABLE reparaciones (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id            UUID        NOT NULL REFERENCES organizaciones(id)  ON DELETE RESTRICT,
  orden_trabajo_id  UUID        NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE RESTRICT,
  evento_trabajo_id UUID        NOT NULL REFERENCES eventos(id)         ON DELETE RESTRICT,
  mecanico_id       UUID                 REFERENCES usuarios(id)        ON DELETE SET NULL,
  descripcion       TEXT,
  observaciones     TEXT,
  inicio_en         TIMESTAMPTZ,
  fin_en            TIMESTAMPTZ,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por        UUID        NOT NULL REFERENCES usuarios(id)        ON DELETE RESTRICT,
  CONSTRAINT chk_reparaciones_tiempos
    CHECK (fin_en IS NULL OR inicio_en IS NULL OR fin_en > inicio_en)
);


-- ============================================================
-- PASO 06 — TABLA items_reparacion
-- Per-tenant. Soft-delete. Audit trigger. set_updated_at.
-- item_presupuesto_id: trazabilidad hacia ítem presupuestado autorizado.
--   NULL en trabajos de garantía sin presupuesto previo.
--   DATABASE_MODEL §4.3: "Referencia a ítem del presupuesto autorizado."
-- repuesto_id: FK diferida → repuestos.id (Migration 004).
-- costo_total = cantidad * costo_unitario: denormalización deliberada.
-- ============================================================

CREATE TABLE items_reparacion (
  id                  UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id              UUID          NOT NULL REFERENCES organizaciones(id)    ON DELETE RESTRICT,
  reparacion_id       UUID          NOT NULL REFERENCES reparaciones(id)      ON DELETE RESTRICT,
  item_presupuesto_id UUID                   REFERENCES items_presupuesto(id) ON DELETE SET NULL,
  tipo                TEXT          NOT NULL,
  descripcion         TEXT          NOT NULL,
  repuesto_id         UUID,                   -- FK diferida → repuestos.id (Migration 004)
  cantidad            NUMERIC(10,3) NOT NULL DEFAULT 1,
  costo_unitario      NUMERIC(12,2) NOT NULL,
  costo_total         NUMERIC(12,2) NOT NULL,
  inicio_en           TIMESTAMPTZ,
  fin_en              TIMESTAMPTZ,
  creado_en           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  creado_por          UUID          NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  eliminado_en        TIMESTAMPTZ,
  eliminado_por       UUID                   REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT chk_items_reparacion_tipo
    CHECK (tipo IN ('mano_obra', 'repuesto')),
  CONSTRAINT chk_items_reparacion_tiempos
    CHECK (fin_en IS NULL OR inicio_en IS NULL OR fin_en > inicio_en)
);


-- ============================================================
-- PASO 07 — TABLA entregas
-- Per-tenant. SIN actualizado_en (acto puntual e inmutable).
-- SIN eliminado_en (registro legal de devolución del vehículo).
-- UNIQUE(orden_trabajo_id): una sola entrega por OT.
-- conductor_retiro_id ON DELETE SET NULL: conductores son visitas temporales.
-- ============================================================

CREATE TABLE entregas (
  id                  UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id              UUID          NOT NULL REFERENCES organizaciones(id)  ON DELETE RESTRICT,
  orden_trabajo_id    UUID          NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE RESTRICT,
  conductor_retiro_id UUID                   REFERENCES conductores(id)     ON DELETE SET NULL,
  km_salida           INTEGER,
  forma_pago          TEXT,
  monto_pagado        NUMERIC(12,2),
  notas               TEXT,
  creado_en           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  creado_por          UUID          NOT NULL REFERENCES usuarios(id)        ON DELETE RESTRICT,
  CONSTRAINT chk_entregas_forma_pago
    CHECK (forma_pago IS NULL OR forma_pago IN (
      'efectivo', 'transferencia', 'tarjeta_debito',
      'tarjeta_credito', 'cheque', 'otro'
    )),
  CONSTRAINT uq_entregas_orden_trabajo_id
    UNIQUE (orden_trabajo_id)
);


-- ============================================================
-- PASO 08 — TABLA evidencias
-- Per-tenant. SIN actualizado_en (inmutable).
-- SIN eliminado_en: se oculta con visible_cliente = false.
-- bucket_path: path interno de Storage, nunca URL pública.
-- signed_url_cache + url_expires_at: patrón PERSISTENCE_ARCHITECTURE §3.2.
-- visible_cliente: único campo mutable (se actualiza sin trigger set_updated_at
--   porque la tabla no tiene columna actualizado_en).
-- ============================================================

CREATE TABLE evidencias (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  evento_id        UUID        NOT NULL REFERENCES eventos(id)        ON DELETE RESTRICT,
  tipo             TEXT        NOT NULL,
  bucket_path      TEXT        NOT NULL,
  mime_type        TEXT        NOT NULL,
  tamano_bytes     BIGINT      NOT NULL,
  nombre_original  TEXT,
  descripcion      TEXT,
  visible_cliente  BOOLEAN     NOT NULL DEFAULT false,
  signed_url_cache TEXT,
  url_expires_at   TIMESTAMPTZ,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por       UUID        NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT chk_evidencias_tipo
    CHECK (tipo IN ('foto', 'video', 'pdf', 'firma_digital', 'archivo_obd', 'otro'))
);


-- ============================================================
-- PASO 09 — TABLA garantias
-- Per-tenant. SIN eliminado_en (historial legal permanente).
-- Los cambios de estado (vigente → reclamada → vencida/rechazada) quedan en audit_log.
-- DATABASE_MODEL §10, Regla 7: "Garantía debe referenciar la reparación original."
-- ============================================================

CREATE TABLE garantias (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id            UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  reparacion_id     UUID        NOT NULL REFERENCES reparaciones(id)   ON DELETE RESTRICT,
  descripcion       TEXT        NOT NULL,
  estado            TEXT        NOT NULL DEFAULT 'vigente',
  fecha_inicio      DATE        NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  km_vencimiento    INTEGER,
  condiciones       TEXT,
  reclamada_en      TIMESTAMPTZ,
  reclamada_por     TEXT,
  resolucion        TEXT,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por        UUID        NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT chk_garantias_estado
    CHECK (estado IN ('vigente', 'reclamada', 'vencida', 'rechazada')),
  CONSTRAINT chk_garantias_fechas
    CHECK (fecha_vencimiento IS NULL OR fecha_vencimiento > fecha_inicio)
);


-- ============================================================
-- PASO 10 — ÍNDICES
-- Convenciones PHYSICAL_SCHEMA.md §5:
--   * Partial WHERE eliminado_en IS NULL para tablas con soft-delete
--   * INCLUDE para cubrir columnas de listado sin heap fetch (dashboard)
--   * UNIQUE parcial para constraints condicionales (no declarables inline)
-- ============================================================

-- ---- ordenes_trabajo ----

-- Hot path del trigger de unicidad: org_id en la clave evita scan cross-tenant
CREATE INDEX idx_ordenes_trabajo_vehiculo_activo
  ON ordenes_trabajo (vehiculo_id, org_id)
  WHERE estado NOT IN ('cerrada', 'cancelada') AND eliminado_en IS NULL;

-- Dashboard: filtro + orden + columnas de listado sin heap fetch
CREATE INDEX idx_ordenes_trabajo_org_estado
  ON ordenes_trabajo (org_id, estado, creado_en DESC)
  INCLUDE (numero_ot, vehiculo_id, sucursal_id)
  WHERE eliminado_en IS NULL;

-- Feed cronológico
CREATE INDEX idx_ordenes_trabajo_org_fecha
  ON ordenes_trabajo (org_id, creado_en DESC)
  WHERE eliminado_en IS NULL;

-- FK index + OTs por recepcionista
CREATE INDEX idx_ordenes_trabajo_recepcionista
  ON ordenes_trabajo (recepcionista_id)
  WHERE eliminado_en IS NULL;


-- ---- citas ----

-- Vista de agenda: citas activas del taller
CREATE INDEX idx_citas_org_fecha_activas
  ON citas (org_id, fecha_cita)
  WHERE eliminado_en IS NULL AND estado IN ('programada', 'confirmada');

-- Historial de citas de un vehículo
CREATE INDEX idx_citas_vehiculo_fecha
  ON citas (vehiculo_id, fecha_cita DESC)
  WHERE eliminado_en IS NULL;

-- RLS scan + feed cronológico
CREATE INDEX idx_citas_org_fecha
  ON citas (org_id, creado_en DESC)
  WHERE eliminado_en IS NULL;

-- FK index: previene seq-scan en ON DELETE SET NULL de eventos
CREATE INDEX idx_citas_recepcion_evento
  ON citas (recepcion_evento_id)
  WHERE recepcion_evento_id IS NOT NULL AND eliminado_en IS NULL;

-- FK index: cola de citas por usuario asignado
CREATE INDEX idx_citas_asignado_a
  ON citas (asignado_a)
  WHERE eliminado_en IS NULL;

-- FK indexes para ON DELETE SET NULL: previenen seq-scan sobre citas
-- cuando se elimina un cliente o conductor
CREATE INDEX idx_citas_cliente
  ON citas (cliente_id)
  WHERE cliente_id IS NOT NULL AND eliminado_en IS NULL;

CREATE INDEX idx_citas_conductor
  ON citas (conductor_id)
  WHERE conductor_id IS NOT NULL AND eliminado_en IS NULL;


-- ---- presupuestos ----

-- FK index + lookup presupuestos de una OT
CREATE INDEX idx_presupuestos_ot
  ON presupuestos (orden_trabajo_id)
  WHERE eliminado_en IS NULL;

-- Una sola versión activa (borrador/enviado) por OT
CREATE UNIQUE INDEX idx_presupuestos_ot_version_activa
  ON presupuestos (orden_trabajo_id)
  WHERE estado IN ('borrador', 'enviado') AND eliminado_en IS NULL;


-- ---- items_presupuesto ----

-- FK index + listar ítems de un presupuesto
CREATE INDEX idx_items_presupuesto_presupuesto
  ON items_presupuesto (presupuesto_id)
  WHERE eliminado_en IS NULL;

-- FK index diferida (Migration 004 activa la FK cuando exista repuestos)
CREATE INDEX idx_items_presupuesto_repuesto
  ON items_presupuesto (repuesto_id)
  WHERE repuesto_id IS NOT NULL AND eliminado_en IS NULL;


-- ---- reparaciones ----
-- Sin eliminado_en: no hay partial index WHERE eliminado_en IS NULL.

-- FK index + listar reparaciones de una OT
CREATE INDEX idx_reparaciones_ot
  ON reparaciones (orden_trabajo_id);

-- FK index + lookup bidireccional evento → reparación
CREATE INDEX idx_reparaciones_evento_trabajo
  ON reparaciones (evento_trabajo_id);

-- Cola de trabajo activo del mecánico
CREATE INDEX idx_reparaciones_mecanico_activo
  ON reparaciones (mecanico_id, creado_en DESC)
  WHERE fin_en IS NULL;


-- ---- items_reparacion ----

-- FK index + listar ítems de una reparación
CREATE INDEX idx_items_reparacion_reparacion
  ON items_reparacion (reparacion_id)
  WHERE eliminado_en IS NULL;

-- FK index diferida (Migration 004)
CREATE INDEX idx_items_reparacion_repuesto
  ON items_reparacion (repuesto_id)
  WHERE repuesto_id IS NOT NULL AND eliminado_en IS NULL;


-- ---- entregas ----
-- uq_entregas_orden_trabajo_id ya crea un B-tree UNIQUE implícito: no duplicar.


-- ---- evidencias ----
-- Sin eliminado_en: no hay partial index de soft-delete.

-- HOT PATH: todas las evidencias de un evento, ordenadas
CREATE INDEX idx_evidencias_evento_fecha
  ON evidencias (evento_id, creado_en DESC);

-- RLS scan + auditoría de uploads por tenant
CREATE INDEX idx_evidencias_org_fecha
  ON evidencias (org_id, creado_en DESC);

-- Job de limpieza de URLs expiradas (cron)
CREATE INDEX idx_evidencias_url_expiracion
  ON evidencias (url_expires_at)
  WHERE signed_url_cache IS NOT NULL;


-- ---- garantias ----
-- Sin eliminado_en: no hay partial index de soft-delete.

-- FK index + lookup garantías de una reparación
CREATE INDEX idx_garantias_reparacion
  ON garantias (reparacion_id);

-- CRÍTICO: job diario de alertas de vencimiento
-- estado excluido de la clave: el predicado parcial ya lo garantiza (decisión E3-M1)
CREATE INDEX idx_garantias_vigentes
  ON garantias (org_id, fecha_vencimiento)
  WHERE estado = 'vigente';

-- Feed cronológico
CREATE INDEX idx_garantias_org_fecha
  ON garantias (org_id, creado_en DESC);


-- ============================================================
-- PASO 11 — SEEDS
-- No hay seeds en Migration 003.
-- Las tablas operacionales son per-tenant y se pueblan en operación.
-- Bloque preservado por convención H-5 (seeds SIEMPRE antes de triggers).
-- ============================================================

-- (sin seeds)


-- ============================================================
-- PASO 12 — FUNCIONES DE TRIGGER NUEVAS
--
-- Las cuatro funciones nuevas usan:
--   SECURITY DEFINER: ejecuta con permisos del owner (postgres)
--   SET search_path = public: previene search_path hijacking
--   OWNER TO postgres: postgres tiene BYPASSRLS → puede leer/escribir
--     cross-table sin que las RLS de las tablas referenciadas bloqueen.
--
-- (1) fn_inmutabilidad_evento_cerrado  — Trigger 1 (R-11 de Migration 002)
-- (2) fn_ot_unica_activa_por_vehiculo  — DATABASE_MODEL §10 Regla 5
-- (3) fn_versionar_presupuesto         — garantiza secuencia de version desde DB
-- (4) fn_set_cerrado_en               — auto-set cerrado_en al cerrar OT (R-09)
-- ============================================================


-- ---- (1) fn_inmutabilidad_evento_cerrado ----
-- BEFORE UPDATE en eventos.
-- Si el evento ya tiene cerrado_en seteado, bloquea cambios en campos técnicos.
-- Campos NO protegidos (excepción explícita SECURITY_MODEL §6):
--   visible_cliente, eliminado_en, eliminado_por.
-- Campos protegidos (14 columnas): ver MIGRATION_003_SPEC §8.2.

CREATE OR REPLACE FUNCTION fn_inmutabilidad_evento_cerrado()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Evento no cerrado: permitir sin restricciones
  IF OLD.cerrado_en IS NULL THEN
    RETURN NEW;
  END IF;

  -- Evento cerrado: verificar campos técnicos protegidos.
  -- IS DISTINCT FROM maneja NULL correctamente (NULL IS DISTINCT FROM NULL = false).
  IF (
    OLD.historia_tecnica_id IS DISTINCT FROM NEW.historia_tecnica_id OR
    OLD.tipo_evento_id       IS DISTINCT FROM NEW.tipo_evento_id      OR
    OLD.estado               IS DISTINCT FROM NEW.estado              OR
    OLD.titulo               IS DISTINCT FROM NEW.titulo              OR
    OLD.descripcion          IS DISTINCT FROM NEW.descripcion         OR
    OLD.asignado_a           IS DISTINCT FROM NEW.asignado_a          OR
    OLD.km_vehiculo          IS DISTINCT FROM NEW.km_vehiculo         OR
    OLD.orden_trabajo_id     IS DISTINCT FROM NEW.orden_trabajo_id    OR
    OLD.sucursal_id          IS DISTINCT FROM NEW.sucursal_id         OR
    OLD.conductor_id         IS DISTINCT FROM NEW.conductor_id        OR
    OLD.cerrado_en           IS DISTINCT FROM NEW.cerrado_en          OR
    OLD.cancelado_en         IS DISTINCT FROM NEW.cancelado_en        OR
    OLD.cancelado_por        IS DISTINCT FROM NEW.cancelado_por       OR
    OLD.razon_cancelacion    IS DISTINCT FROM NEW.razon_cancelacion
  ) THEN
    RAISE EXCEPTION
      'evento_inmutable: el evento % está cerrado y no puede modificarse. Campos permitidos: visible_cliente, eliminado_en, eliminado_por.',
      OLD.id;
  END IF;

  -- Solo cambios en campos no protegidos: permitir
  RETURN NEW;
END;
$$;

ALTER FUNCTION fn_inmutabilidad_evento_cerrado() OWNER TO postgres;


-- ---- (2) fn_ot_unica_activa_por_vehiculo ----
-- BEFORE INSERT OR UPDATE en ordenes_trabajo.
-- Garantiza DATABASE_MODEL §10 Regla 5: "Solo puede existir una OT activa por vehículo."
-- Advisory lock por vehiculo_id serializa INSERTs concurrentes (mismo patrón
-- que fn_referencias_evento_anti_ciclo de Migration 002).

CREATE OR REPLACE FUNCTION fn_ot_unica_activa_por_vehiculo()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Estados cerrada/cancelada liberan el vehículo: nunca bloquear
  IF NEW.estado IN ('cerrada', 'cancelada') THEN
    RETURN NEW;
  END IF;

  -- Advisory lock de transacción por vehiculo_id: serializa verificaciones concurrentes.
  -- Se libera automáticamente en COMMIT/ROLLBACK (seguro bajo pgBouncer transaction mode).
  PERFORM pg_advisory_xact_lock(hashtext('ot_activa_' || NEW.vehiculo_id::text));

  -- Verificar existencia de otra OT activa para el mismo vehículo y tenant
  IF EXISTS (
    SELECT 1
    FROM   ordenes_trabajo
    WHERE  vehiculo_id   = NEW.vehiculo_id
      AND  org_id        = NEW.org_id
      AND  estado NOT IN ('cerrada', 'cancelada')
      AND  eliminado_en  IS NULL
      AND  id           <> NEW.id  -- excluir la propia fila en UPDATE
  ) THEN
    RAISE EXCEPTION
      'ot_unica_activa: el vehículo % ya tiene una OT activa en la organización %',
      NEW.vehiculo_id, NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION fn_ot_unica_activa_por_vehiculo() OWNER TO postgres;


-- ---- (3) fn_versionar_presupuesto ----
-- BEFORE INSERT en presupuestos.
-- Auto-incrementa version garantizando secuencia desde la DB.
-- Si presupuesto_anterior_id IS NULL → version = 1.
-- Si presupuesto_anterior_id IS NOT NULL → version = version_anterior + 1.
-- Segunda defensa cross-tenant: verifica que el presupuesto anterior
-- pertenezca al mismo tenant.

CREATE OR REPLACE FUNCTION fn_versionar_presupuesto()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_version_anterior SMALLINT;
BEGIN
  IF NEW.presupuesto_anterior_id IS NULL THEN
    -- Primer presupuesto de la cadena
    NEW.version := 1;
  ELSE
    -- Leer versión del presupuesto anterior dentro del mismo tenant
    SELECT version
      INTO v_version_anterior
      FROM presupuestos
     WHERE id     = NEW.presupuesto_anterior_id
       AND org_id = NEW.org_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'versionar_presupuesto: presupuesto anterior % no existe en la organización %',
        NEW.presupuesto_anterior_id, NEW.org_id;
    END IF;

    NEW.version := v_version_anterior + 1;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION fn_versionar_presupuesto() OWNER TO postgres;


-- ---- (4) fn_set_cerrado_en ----
-- BEFORE UPDATE en ordenes_trabajo.
-- Resuelve R-09: auto-setea cerrado_en cuando estado cambia a cerrada/cancelada.
-- Previene reapertura de OTs ya cerradas.
-- Naming trg_10_: ejecuta después de trg_01_ (unicidad) y antes de trg_50_ (set_updated_at).

CREATE OR REPLACE FUNCTION fn_set_cerrado_en()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Estado cambia a cerrada/cancelada: setear cerrado_en si la aplicación no lo incluyó
  IF NEW.estado IN ('cerrada', 'cancelada')
    AND OLD.estado NOT IN ('cerrada', 'cancelada')
  THEN
    IF NEW.cerrado_en IS NULL THEN
      NEW.cerrado_en := NOW();
    END IF;

  -- Intento de reabrir OT cerrada: rechazar.
  -- Condición anclada a OLD.estado IN ('cerrada','cancelada') para evitar
  -- falsos positivos si cerrado_en fue seteado manualmente en estado no-cerrado
  -- (anomalía solo posible por acceso directo a DB bypassando RLS).
  ELSIF NEW.estado NOT IN ('cerrada', 'cancelada')
    AND OLD.estado IN ('cerrada', 'cancelada')
    AND OLD.cerrado_en IS NOT NULL
  THEN
    RAISE EXCEPTION
      'ot_reabrir_invalido: la OT % está cerrada y no puede reabrirse.',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION fn_set_cerrado_en() OWNER TO postgres;


-- ============================================================
-- PASO 13 — TRIGGERS
-- Naming convention M-11 (PHYSICAL_SCHEMA.md §6):
--   trg_01_* → BEFORE (validación / guarda de integridad)
--   trg_10_* → BEFORE (side effects pre-write, entre 01 y 50)
--   trg_50_* → BEFORE UPDATE (fn_set_updated_at)
--   trg_99_* → AFTER DML (fn_audit_insert_trigger)
--
-- PostgreSQL ejecuta triggers con mismo momento+evento en orden
-- alfabético por nombre. Los prefijos garantizan orden determinista.
-- ============================================================

-- ---- eventos (trigger nuevo en tabla existente de Migration 002) ----
-- Trigger 1: inmutabilidad de eventos cerrados.
-- trg_01_ ejecuta ANTES que trg_50_eventos_set_updated_at:
-- si el evento está cerrado y el UPDATE toca un campo protegido,
-- RAISE EXCEPTION aborta antes de que set_updated_at se ejecute.

CREATE TRIGGER trg_01_eventos_inmutabilidad_cerrado
  BEFORE UPDATE ON eventos
  FOR EACH ROW EXECUTE FUNCTION fn_inmutabilidad_evento_cerrado();


-- ---- ordenes_trabajo ----

-- trg_01: validación de unicidad de OT activa (con advisory lock)
CREATE TRIGGER trg_01_ordenes_trabajo_ot_unica_activa
  BEFORE INSERT OR UPDATE ON ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION fn_ot_unica_activa_por_vehiculo();

-- trg_10: auto-set cerrado_en / prevención de reapertura
CREATE TRIGGER trg_10_ordenes_trabajo_set_cerrado_en
  BEFORE UPDATE ON ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION fn_set_cerrado_en();

-- trg_50: set_updated_at
CREATE TRIGGER trg_50_ordenes_trabajo_set_updated_at
  BEFORE UPDATE ON ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- trg_99: audit log (INSERT y UPDATE; soft-delete via UPDATE queda cubierto)
CREATE TRIGGER trg_99_ordenes_trabajo_audit
  AFTER INSERT OR UPDATE ON ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- citas ----

CREATE TRIGGER trg_50_citas_set_updated_at
  BEFORE UPDATE ON citas
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_99_citas_audit
  AFTER INSERT OR UPDATE ON citas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- presupuestos ----

-- trg_01: auto-versioning en INSERT
CREATE TRIGGER trg_01_presupuestos_version
  BEFORE INSERT ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION fn_versionar_presupuesto();

CREATE TRIGGER trg_50_presupuestos_set_updated_at
  BEFORE UPDATE ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_99_presupuestos_audit
  AFTER INSERT OR UPDATE ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- items_presupuesto ----

CREATE TRIGGER trg_50_items_presupuesto_set_updated_at
  BEFORE UPDATE ON items_presupuesto
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- OR DELETE: captura hard-delete accidental además del soft-delete esperado
CREATE TRIGGER trg_99_items_presupuesto_audit
  AFTER INSERT OR UPDATE OR DELETE ON items_presupuesto
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- reparaciones ----

CREATE TRIGGER trg_50_reparaciones_set_updated_at
  BEFORE UPDATE ON reparaciones
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Sin DELETE: reparaciones no tienen eliminado_en ni se borran físicamente
CREATE TRIGGER trg_99_reparaciones_audit
  AFTER INSERT OR UPDATE ON reparaciones
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- items_reparacion ----

CREATE TRIGGER trg_50_items_reparacion_set_updated_at
  BEFORE UPDATE ON items_reparacion
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_99_items_reparacion_audit
  AFTER INSERT OR UPDATE OR DELETE ON items_reparacion
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- entregas ----
-- Solo INSERT: entregas son inmutables (sin actualizado_en, sin eliminado_en).

CREATE TRIGGER trg_99_entregas_audit
  AFTER INSERT ON entregas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- evidencias ----
-- Solo INSERT: evidencias son inmutables.
-- visible_cliente puede actualizarse sin trigger de auditoría (campo de presentación).

CREATE TRIGGER trg_99_evidencias_audit
  AFTER INSERT ON evidencias
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- garantias ----

CREATE TRIGGER trg_50_garantias_set_updated_at
  BEFORE UPDATE ON garantias
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Cambios de estado (vigente → reclamada) son críticos de auditar
CREATE TRIGGER trg_99_garantias_audit
  AFTER INSERT OR UPDATE ON garantias
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ============================================================
-- PASO 14 — RLS + POLICIES
-- Todas las tablas nuevas con RLS habilitado.
-- BLOCKER-SEC-1: INSERT de presupuestos, items_presupuesto,
--   items_reparacion y garantias incluyen subquery cross-tenant.
-- TO authenticated: todas las policies aplican solo a usuarios autenticados.
-- ============================================================

ALTER TABLE ordenes_trabajo  ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_presupuesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE reparaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_reparacion  ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidencias        ENABLE ROW LEVEL SECURITY;
ALTER TABLE garantias         ENABLE ROW LEVEL SECURITY;


-- ---- ordenes_trabajo ----
-- mecanico puede SELECT y UPDATE (registrar avances), pero no INSERT.
-- WITH CHECK con cerrado_en IS NULL para mecanico: impide que cierre la OT.

CREATE POLICY "ordenes_trabajo_select"
  ON ordenes_trabajo FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
  );

CREATE POLICY "ordenes_trabajo_insert"
  ON ordenes_trabajo FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );

CREATE POLICY "ordenes_trabajo_update"
  ON ordenes_trabajo FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND (
      mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
      OR (mi_rol() = 'mecanico' AND cerrado_en IS NULL)
    )
  );


-- ---- citas ----

CREATE POLICY "citas_select"
  ON citas FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
  );

CREATE POLICY "citas_insert"
  ON citas FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );

CREATE POLICY "citas_update"
  ON citas FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id());


-- ---- presupuestos ----
-- mecanico EXCLUIDO: presupuestos contienen precios (SECURITY_MODEL §7, Regla 9).
-- BLOCKER-SEC-1: subquery en INSERT verifica que OT padre es del mismo tenant.

CREATE POLICY "presupuestos_select"
  ON presupuestos FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );

CREATE POLICY "presupuestos_insert"
  ON presupuestos FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
    AND (SELECT org_id FROM ordenes_trabajo WHERE id = orden_trabajo_id) = mi_org_id()
  );

CREATE POLICY "presupuestos_update"
  ON presupuestos FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id());


-- ---- items_presupuesto ----
-- mecanico EXCLUIDO: contiene precios de ítems.
-- BLOCKER-SEC-1: subquery en INSERT verifica que presupuesto padre es del mismo tenant.

CREATE POLICY "items_presupuesto_select"
  ON items_presupuesto FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );

CREATE POLICY "items_presupuesto_insert"
  ON items_presupuesto FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
    AND (SELECT org_id FROM presupuestos WHERE id = presupuesto_id) = mi_org_id()
  );

CREATE POLICY "items_presupuesto_update"
  ON items_presupuesto FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id());


-- ---- reparaciones ----
-- mecanico puede SELECT y UPDATE sus propias reparaciones.
-- mecanico_id = auth.uid(): restricción adicional en WITH CHECK para mecanico.

CREATE POLICY "reparaciones_select"
  ON reparaciones FOR SELECT TO authenticated
  USING (org_id = mi_org_id());

CREATE POLICY "reparaciones_insert"
  ON reparaciones FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  );

CREATE POLICY "reparaciones_update"
  ON reparaciones FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND (
      mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
      OR (mi_rol() = 'mecanico' AND mecanico_id = auth.uid())
    )
  );


-- ---- items_reparacion ----
-- mecanico puede SELECT y gestionar ítems.
-- NOTA DT-1: costo_unitario/costo_total visibles al mecanico en MVP.
--   Vista v_items_reparacion_mecanico sin columnas financieras en Migration 006.
-- BLOCKER-SEC-1: subquery en INSERT verifica que reparación padre es del mismo tenant.

CREATE POLICY "items_reparacion_select"
  ON items_reparacion FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
  );

CREATE POLICY "items_reparacion_insert"
  ON items_reparacion FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
    AND (SELECT org_id FROM reparaciones WHERE id = reparacion_id) = mi_org_id()
  );

CREATE POLICY "items_reparacion_update"
  ON items_reparacion FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  )
  WITH CHECK (org_id = mi_org_id());


-- ---- entregas ----
-- mecanico EXCLUIDO: forma_pago y monto_pagado son datos financieros.
-- Sin UPDATE ni DELETE: entregas son inmutables por diseño de dominio.

CREATE POLICY "entregas_select"
  ON entregas FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );

CREATE POLICY "entregas_insert"
  ON entregas FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );


-- ---- evidencias ----
-- mecanico puede SELECT e INSERT: herramienta principal de documentación técnica.
-- UPDATE restringido a admin/jefe/recepcionista para cambiar visible_cliente.
-- NOTA: RLS no filtra columnas individuales — la aplicación protege el payload.

CREATE POLICY "evidencias_select"
  ON evidencias FOR SELECT TO authenticated
  USING (org_id = mi_org_id());

CREATE POLICY "evidencias_insert"
  ON evidencias FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  );

-- Nombre explícito documenta la intención: solo visible_cliente debe modificarse
CREATE POLICY "evidencias_update_visible_cliente"
  ON evidencias FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id());


-- ---- garantias ----
-- mecanico puede SELECT: necesita ver garantías vigentes de vehículos que repara.
-- BLOCKER-SEC-1: subquery en INSERT verifica que reparación padre es del mismo tenant.

CREATE POLICY "garantias_select"
  ON garantias FOR SELECT TO authenticated
  USING (org_id = mi_org_id());

CREATE POLICY "garantias_insert"
  ON garantias FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
    AND (SELECT org_id FROM reparaciones WHERE id = reparacion_id) = mi_org_id()
  );

CREATE POLICY "garantias_update"
  ON garantias FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id());


COMMIT;
