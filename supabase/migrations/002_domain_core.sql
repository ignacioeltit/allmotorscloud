-- ============================================================
-- Migration 002 — Domain Core
-- All Motors Cloud
-- Versión: 1.0 — Junio 2026
-- Spec: docs/database/MIGRATION_002_SPEC.md v0.1 APPROVED WITH CONDITIONS
-- Dependencias: 001_initial_schema.sql
-- ============================================================
--
-- ORDEN DE EJECUCIÓN:
--   Paso 02  — clientes
--   Paso 03  — conductores
--   Paso 04  — vehiculos
--   Paso 04b — FK diferida transiciones_evento.vehiculo_id → vehiculos.id
--   Paso 05  — historias_tecnicas
--   Paso 06  — propietarios_vehiculo
--   Paso 07  — tipos_evento
--   Paso 08  — eventos
--   Paso 08b — FK diferida transiciones_evento.evento_id → eventos.id
--   Paso 09  — referencias_evento
--   Paso 10  — Índices (incluyendo GIN pg_trgm — extensión disponible desde Migration 001)
--   Paso 11  — Seeds (ninguno en Migration 002)
--   Paso 12  — Funciones de trigger (fn_crear_historia_tecnica, fn_referencias_evento_anti_ciclo)
--   Paso 13  — Triggers (DESPUÉS de seeds — H-5)
--   Paso 14  — RLS + Policies
--
-- CONDICIONES ARCHITECTURE BOARD APLICADAS (§14.7):
--   HIGH-LA-1    : fn_crear_historia_tecnica SECURITY DEFINER + SET search_path + OWNER TO postgres
--   HIGH-SEC-1   : historias_tecnicas UPDATE policy restringida a admin y jefe_taller
--   HIGH-SEC-2   : eventos UPDATE WITH CHECK incluye cerrado_en IS NULL para mecanico
--   BLOCKER-SEC-1: referencias_evento INSERT policy incluye subquery cross-tenant
--   CORRECCIÓN-R-2: FKs diferidas de transiciones_evento completadas inline (04b y 08b)
--   CORRECCIÓN-R-4: índice (org_id, tipo_evento_id, creado_en DESC) añadido a eventos
-- ============================================================

BEGIN;


-- ============================================================
-- PASO 02 — TABLA clientes
-- Per-tenant. Soft-delete. Audit trigger. set_updated_at.
-- creado_por nullable: permite migración TallerGP sin usuario auth.
-- ============================================================

CREATE TABLE clientes (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id         UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  tipo           TEXT        NOT NULL DEFAULT 'persona_natural',
  nombre         TEXT        NOT NULL,
  rut            TEXT,
  telefono       TEXT,
  email          TEXT,
  direccion      TEXT,
  notas          TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por     UUID                 REFERENCES usuarios(id) ON DELETE SET NULL,
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  UUID                 REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT chk_clientes_tipo
    CHECK (tipo IN ('persona_natural', 'empresa', 'aseguradora'))
);


-- ============================================================
-- PASO 03 — TABLA conductores
-- Per-tenant. Soft-delete. Audit trigger. set_updated_at.
-- ============================================================

CREATE TABLE conductores (
  id                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id               UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  nombre               TEXT        NOT NULL,
  rut                  TEXT,
  telefono             TEXT,
  email                TEXT,
  licencia_tipo        TEXT,
  licencia_vencimiento DATE,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por           UUID                 REFERENCES usuarios(id) ON DELETE SET NULL,
  eliminado_en         TIMESTAMPTZ,
  eliminado_por        UUID                 REFERENCES usuarios(id) ON DELETE SET NULL
);


-- ============================================================
-- PASO 04 — TABLA vehiculos
-- UNIQUE(org_id, patente) NO es partial: una patente identifica
-- un vehículo de por vida — no deben existir dos registros con la
-- misma patente en la misma org, activos o eliminados.
-- (DATABASE_MODEL §4.1 — decisión deliberada, no error)
-- ============================================================

CREATE TABLE vehiculos (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id         UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  patente        TEXT        NOT NULL,
  vin            TEXT,
  marca          TEXT        NOT NULL,
  modelo         TEXT        NOT NULL,
  anio           SMALLINT,
  color          TEXT,
  tipo           TEXT        NOT NULL DEFAULT 'auto',
  km_actual      INTEGER,
  notas          TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por     UUID                 REFERENCES usuarios(id) ON DELETE SET NULL,
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  UUID                 REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT chk_vehiculos_tipo
    CHECK (tipo IN ('auto', 'camioneta', 'moto', 'furgon', 'camion', 'otro')),
  CONSTRAINT uq_vehiculos_org_patente
    UNIQUE (org_id, patente)
);


-- ============================================================
-- PASO 04b — FK DIFERIDA: transiciones_evento.vehiculo_id → vehiculos.id
-- Columna existe desde Migration 001 sin FK activa (BLK-1 Architecture Board).
-- Se completa aquí, inmediatamente después de crear vehiculos (CORRECCIÓN-R-2).
-- ============================================================

ALTER TABLE transiciones_evento
  ADD CONSTRAINT fk_transiciones_evento_vehiculo_id
    FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE RESTRICT;


-- ============================================================
-- PASO 05 — TABLA historias_tecnicas
-- Sin creado_por: creada por trigger de sistema, no por usuario.
-- Sin eliminado_en: inmutable — DATABASE_MODEL §4.1 "Nunca se elimina."
-- UNIQUE(vehiculo_id) impone relación 1:1 estricta.
-- INSERT bloqueado para usuarios via RLS (sin policy) — solo fn_crear_historia_tecnica().
-- ============================================================

CREATE TABLE historias_tecnicas (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehiculo_id    UUID        NOT NULL REFERENCES vehiculos(id)       ON DELETE RESTRICT,
  org_id         UUID        NOT NULL REFERENCES organizaciones(id)  ON DELETE RESTRICT,
  notas          TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_historias_tecnicas_vehiculo_id
    UNIQUE (vehiculo_id)
);


-- ============================================================
-- PASO 06 — TABLA propietarios_vehiculo
-- Sin eliminado_en: la relación termina con fecha_fin, no soft-delete.
-- UNIQUE PARTIAL (vehiculo_id) WHERE fecha_fin IS NULL se crea en Paso 10.
-- ============================================================

CREATE TABLE propietarios_vehiculo (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehiculo_id    UUID        NOT NULL REFERENCES vehiculos(id)       ON DELETE RESTRICT,
  cliente_id     UUID        NOT NULL REFERENCES clientes(id)        ON DELETE RESTRICT,
  org_id         UUID        NOT NULL REFERENCES organizaciones(id)  ON DELETE RESTRICT,
  fecha_inicio   DATE        NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin      DATE,
  notas          TEXT,
  CONSTRAINT chk_propietarios_vehiculo_fechas
    CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por     UUID                 REFERENCES usuarios(id) ON DELETE SET NULL
);


-- ============================================================
-- PASO 07 — TABLA tipos_evento
-- Sin eliminado_en: desactivación vía activo = false.
-- UNIQUE PARTIAL (org_id, slug) WHERE activo = true se crea en Paso 10.
-- ============================================================

CREATE TABLE tipos_evento (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id              UUID        NOT NULL REFERENCES organizaciones(id)    ON DELETE RESTRICT,
  tipo_evento_base_id UUID                 REFERENCES tipos_evento_base(id) ON DELETE SET NULL,
  nombre              TEXT        NOT NULL,
  slug                TEXT        NOT NULL,
  descripcion         TEXT,
  categoria           TEXT        NOT NULL,
  activo              BOOLEAN     NOT NULL DEFAULT true,
  es_personalizado    BOOLEAN     NOT NULL DEFAULT false,
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por          UUID                 REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT chk_tipos_evento_categoria
    CHECK (categoria IN (
      'inspeccion', 'mantencion', 'reparacion', 'garantia',
      'estimacion', 'documentacion', 'comunicacion', 'administracion'
    ))
);


-- ============================================================
-- PASO 08 — TABLA eventos
-- orden_trabajo_id: UUID NULL sin FK activa — FK formal añadida en Migration 003
-- cuando ordenes_trabajo exista. (DATABASE_MODEL §4.7)
-- creado_por NOT NULL: los eventos deben tener autor; Edge Functions de sistema
-- deben autenticarse con un usuario de sistema o con service_role (R-06).
-- ============================================================

CREATE TABLE eventos (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  historia_tecnica_id UUID        NOT NULL REFERENCES historias_tecnicas(id) ON DELETE RESTRICT,
  org_id              UUID        NOT NULL REFERENCES organizaciones(id)      ON DELETE RESTRICT,
  tipo_evento_id      UUID        NOT NULL REFERENCES tipos_evento(id)        ON DELETE RESTRICT,
  sucursal_id         UUID                 REFERENCES sucursales(id)          ON DELETE SET NULL,
  conductor_id        UUID                 REFERENCES conductores(id)         ON DELETE SET NULL,
  orden_trabajo_id    UUID,                -- FK diferida → Migration 003 (ordenes_trabajo.id)
  estado              TEXT        NOT NULL DEFAULT 'creado',
  titulo              TEXT,
  descripcion         TEXT,
  asignado_a          UUID                 REFERENCES usuarios(id)            ON DELETE SET NULL,
  km_vehiculo         INTEGER,
  visible_cliente     BOOLEAN     NOT NULL DEFAULT false,
  cerrado_en          TIMESTAMPTZ,
  cancelado_en        TIMESTAMPTZ,
  cancelado_por       UUID                 REFERENCES usuarios(id)            ON DELETE SET NULL,
  razon_cancelacion   TEXT,
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por          UUID        NOT NULL REFERENCES usuarios(id)            ON DELETE RESTRICT,
  eliminado_en        TIMESTAMPTZ,
  eliminado_por       UUID                 REFERENCES usuarios(id)            ON DELETE SET NULL,
  CONSTRAINT chk_eventos_estado
    CHECK (estado IN (
      'creado', 'pendiente', 'asignado', 'en_ejecucion',
      'en_espera', 'finalizado', 'cerrado', 'cancelado'
    )),
  CONSTRAINT chk_eventos_cancelacion
    CHECK (
      (cancelado_en IS NULL AND razon_cancelacion IS NULL) OR
      (cancelado_en IS NOT NULL AND razon_cancelacion IS NOT NULL)
    )
);


-- ============================================================
-- PASO 08b — FK DIFERIDA: transiciones_evento.evento_id → eventos.id
-- Columna existe desde Migration 001 sin FK activa.
-- Se completa aquí, inmediatamente después de crear eventos (CORRECCIÓN-R-2).
-- ============================================================

ALTER TABLE transiciones_evento
  ADD CONSTRAINT fk_transiciones_evento_evento_id
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE RESTRICT;


-- ============================================================
-- PASO 09 — TABLA referencias_evento
-- Sin actualizado_en: referencias son inmutables; erróneas se anulan
-- seteando eliminado_en y creando una nueva referencia correcta.
-- Sin trigger de auditoría: la tabla es en sí misma un log de relaciones.
-- ============================================================

CREATE TABLE referencias_evento (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_origen_id  UUID        NOT NULL REFERENCES eventos(id)        ON DELETE RESTRICT,
  evento_destino_id UUID        NOT NULL REFERENCES eventos(id)        ON DELETE RESTRICT,
  org_id            UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  tipo              TEXT        NOT NULL,
  notas             TEXT,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por        UUID        NOT NULL REFERENCES usuarios(id)       ON DELETE RESTRICT,
  eliminado_en      TIMESTAMPTZ,
  eliminado_por     UUID                 REFERENCES usuarios(id)       ON DELETE SET NULL,
  CONSTRAINT chk_referencias_evento_tipo
    CHECK (tipo IN ('precede_a', 'relacionado_con', 'correccion_de', 'garantia_de')),
  CONSTRAINT chk_referencias_evento_no_auto
    CHECK (evento_origen_id <> evento_destino_id)
);


-- ============================================================
-- PASO 10 — ÍNDICES
-- Reglas de PHYSICAL_SCHEMA.md §5:
--   * Índices parciales WHERE eliminado_en IS NULL para tablas con soft-delete
--   * GIN pg_trgm para campos de búsqueda textual (pg_trgm disponible desde Migration 001)
--   * Índices UNIQUE parciales para constraints condicionales (no declarables inline)
-- ============================================================

-- ---- clientes ----

CREATE INDEX idx_clientes_org_id
  ON clientes (org_id)
  WHERE eliminado_en IS NULL;

-- Cubre lookup exacto por RUT y actúa como constraint de unicidad (NULL permitido = múltiples NULL válidos)
CREATE UNIQUE INDEX idx_clientes_org_rut_activo
  ON clientes (org_id, rut)
  WHERE eliminado_en IS NULL;

CREATE INDEX idx_clientes_nombre_trgm
  ON clientes USING GIN (nombre gin_trgm_ops);

-- WHERE rut IS NOT NULL: GIN no puede usar operadores trgm sobre NULL — evita indexar entradas vacías
CREATE INDEX idx_clientes_rut_trgm
  ON clientes USING GIN (rut gin_trgm_ops)
  WHERE rut IS NOT NULL;


-- ---- conductores ----

CREATE INDEX idx_conductores_org_id
  ON conductores (org_id)
  WHERE eliminado_en IS NULL;

CREATE INDEX idx_conductores_nombre_trgm
  ON conductores USING GIN (nombre gin_trgm_ops);

CREATE INDEX idx_conductores_rut_trgm
  ON conductores USING GIN (rut gin_trgm_ops)
  WHERE rut IS NOT NULL;


-- ---- vehiculos ----
-- UNIQUE(org_id, patente) declara automáticamente un B-tree; no duplicar.

CREATE INDEX idx_vehiculos_org_id
  ON vehiculos (org_id)
  WHERE eliminado_en IS NULL;

-- Partial WHERE eliminado_en IS NULL: excluye vehículos dados de baja del índice GIN
CREATE INDEX idx_vehiculos_patente_trgm
  ON vehiculos USING GIN (patente gin_trgm_ops)
  WHERE eliminado_en IS NULL;


-- ---- historias_tecnicas ----
-- UNIQUE(vehiculo_id) declara automáticamente un B-tree; no duplicar.

CREATE INDEX idx_historias_tecnicas_org_id
  ON historias_tecnicas (org_id);


-- ---- propietarios_vehiculo ----

-- Constraint: máximo un propietario activo por vehículo (UNIQUE PARTIAL)
CREATE UNIQUE INDEX idx_propietarios_vehiculo_activo
  ON propietarios_vehiculo (vehiculo_id)
  WHERE fecha_fin IS NULL;

-- Historial completo de propietarios de un vehículo
CREATE INDEX idx_propietarios_vehiculo_historial
  ON propietarios_vehiculo (vehiculo_id);

-- Vehículos activos de un cliente
CREATE INDEX idx_propietarios_vehiculo_cliente_activo
  ON propietarios_vehiculo (cliente_id)
  WHERE fecha_fin IS NULL;

CREATE INDEX idx_propietarios_vehiculo_org_id
  ON propietarios_vehiculo (org_id);


-- ---- tipos_evento ----
-- UNIQUE PARTIAL (org_id, slug) WHERE activo = true

CREATE UNIQUE INDEX idx_tipos_evento_org_slug_activo
  ON tipos_evento (org_id, slug)
  WHERE activo = true;

CREATE INDEX idx_tipos_evento_org_activo
  ON tipos_evento (org_id)
  WHERE activo = true;


-- ---- eventos ----

-- HOT PATH PRIMARIO: Historia Técnica — todos los eventos de un vehículo, cronológico
-- DATABASE_MODEL §8: "índice más crítico del sistema"
CREATE INDEX idx_eventos_historia_tecnica_fecha
  ON eventos (historia_tecnica_id, creado_en DESC)
  WHERE eliminado_en IS NULL;

-- Filtro por tipo y estado en Historia Técnica
CREATE INDEX idx_eventos_historia_tecnica_tipo_estado
  ON eventos (historia_tecnica_id, tipo_evento_id, estado)
  WHERE eliminado_en IS NULL;

-- Dashboard: cubre filtro por org_id + estado + ORDER BY creado_en DESC en una sola pasada.
-- Reemplaza el índice (org_id, estado) sin creado_en que requería Sort heap adicional.
CREATE INDEX idx_eventos_org_estado_fecha
  ON eventos (org_id, estado, creado_en DESC)
  WHERE eliminado_en IS NULL;

-- Cola de trabajo del mecánico: eventos asignados no cerrados
CREATE INDEX idx_eventos_asignado_activo
  ON eventos (asignado_a)
  WHERE eliminado_en IS NULL
    AND estado NOT IN ('cerrado', 'cancelado');

-- Feed cronológico por organización
CREATE INDEX idx_eventos_org_fecha
  ON eventos (org_id, creado_en DESC)
  WHERE eliminado_en IS NULL;

-- Analytics por tipo de evento en organización (CORRECCIÓN-R-4)
CREATE INDEX idx_eventos_org_tipo_fecha
  ON eventos (org_id, tipo_evento_id, creado_en DESC)
  WHERE eliminado_en IS NULL;


-- ---- referencias_evento ----

-- Arcos salientes de un evento (forward DAG traversal)
CREATE INDEX idx_referencias_evento_origen
  ON referencias_evento (evento_origen_id)
  WHERE eliminado_en IS NULL;

-- Arcos entrantes (reverse DAG + cycle detection read path)
CREATE INDEX idx_referencias_evento_destino
  ON referencias_evento (evento_destino_id)
  WHERE eliminado_en IS NULL;


-- ============================================================
-- PASO 11 — SEEDS
-- No hay seeds en Migration 002.
-- tipos_evento: poblada durante onboarding via Edge Function (service_role).
-- historias_tecnicas: creadas automáticamente por trigger AFTER INSERT en vehiculos.
-- Bloque vacío preservado por convención H-5 (seeds siempre antes de triggers).
-- ============================================================

-- (sin seeds)


-- ============================================================
-- PASO 12 — FUNCIONES DE TRIGGER
--
-- fn_crear_historia_tecnica:
--   SECURITY DEFINER + SET search_path = public + OWNER TO postgres (HIGH-LA-1)
--   postgres tiene BYPASSRLS → puede INSERT en historias_tecnicas aunque
--   no haya policy INSERT para usuarios. Sin OWNER postgres, el INSERT
--   falla silenciosamente aunque la función sea SECURITY DEFINER.
--
-- fn_referencias_evento_anti_ciclo:
--   SECURITY DEFINER + SET search_path = public
--   Usa pg_advisory_xact_lock (no pg_advisory_lock): el lock de transacción
--   se libera automáticamente al COMMIT/ROLLBACK, previniendo deadlocks
--   de sesión bajo pgBouncer transaction mode.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_crear_historia_tecnica()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- NEW.org_id garantiza consistencia: org_id de historia_tecnica = org_id del vehiculo.
  -- No hay creado_por: esta es una acción de sistema, no de usuario.
  INSERT INTO historias_tecnicas (vehiculo_id, org_id, creado_en, actualizado_en)
  VALUES (NEW.id, NEW.org_id, NOW(), NOW());
  RETURN NULL; -- AFTER trigger: valor de retorno ignorado por PostgreSQL
END;
$$;

-- postgres tiene BYPASSRLS; sin este OWNER el INSERT en historias_tecnicas
-- fallaría porque la tabla tiene RLS habilitado sin policy INSERT para usuarios.
ALTER FUNCTION fn_crear_historia_tecnica() OWNER TO postgres;


CREATE OR REPLACE FUNCTION fn_referencias_evento_anti_ciclo()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_ciclo_detectado BOOLEAN;
BEGIN
  -- Lock por org_id: serializa INSERTs concurrentes dentro del mismo tenant,
  -- pero permite que distintos tenants inserten referencias en paralelo.
  -- El lock se libera automáticamente al COMMIT/ROLLBACK (xact-level).
  PERFORM pg_advisory_xact_lock(hashtext('referencias_evento_ciclo_' || NEW.org_id::text));

  -- Recorrer el grafo activo desde NEW.evento_destino_id siguiendo arcos
  -- en dirección (origen → destino), hasta 50 niveles de profundidad.
  -- UNION (no UNION ALL) deduplica nodos visitados para evitar explosión
  -- combinatoria en grafos con múltiples arcos por nodo.
  -- Si se alcanza NEW.evento_origen_id → el nuevo arco crearía un ciclo.
  SELECT EXISTS (
    WITH RECURSIVE alcanzable(evento_id, profundidad) AS (
      SELECT NEW.evento_destino_id, 1
      UNION
      SELECT re.evento_destino_id, a.profundidad + 1
      FROM   referencias_evento re
      JOIN   alcanzable a ON re.evento_origen_id = a.evento_id
      WHERE  re.eliminado_en IS NULL
        AND  a.profundidad < 50
    )
    SELECT 1 FROM alcanzable WHERE evento_id = NEW.evento_origen_id
  ) INTO v_ciclo_detectado;

  IF v_ciclo_detectado THEN
    RAISE EXCEPTION
      'referencias_evento: ciclo detectado entre eventos % y %',
      NEW.evento_origen_id, NEW.evento_destino_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Igual que fn_crear_historia_tecnica: OWNER postgres para que SECURITY DEFINER
-- opere con BYPASSRLS al leer referencias_evento durante la detección de ciclos.
ALTER FUNCTION fn_referencias_evento_anti_ciclo() OWNER TO postgres;


-- ============================================================
-- PASO 13 — TRIGGERS
-- Naming convention M-11 (prefijo numérico para orden determinista):
--   trg_01_* → BEFORE INSERT  (validación — anti-ciclo DAG)
--   trg_50_* → BEFORE UPDATE  (fn_set_updated_at)
--   trg_80_* → AFTER INSERT   (side effects — crear historia_tecnica)
--   trg_99_* → AFTER DML      (fn_audit_insert_trigger)
--
-- referencias_evento: SIN trigger de auditoría (CORRECCIÓN-R-1).
-- historias_tecnicas: trigger de auditoría solo en UPDATE (no INSERT),
--   porque el INSERT ocurre via trigger de sistema sin actor_id de usuario.
-- ============================================================

-- ---- clientes ----

CREATE TRIGGER trg_50_clientes_set_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_99_clientes_audit
  AFTER INSERT OR UPDATE OR DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- conductores ----

CREATE TRIGGER trg_50_conductores_set_updated_at
  BEFORE UPDATE ON conductores
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_99_conductores_audit
  AFTER INSERT OR UPDATE OR DELETE ON conductores
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- vehiculos ----

CREATE TRIGGER trg_50_vehiculos_set_updated_at
  BEFORE UPDATE ON vehiculos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Crea automáticamente la historia_tecnica 1:1 al insertar el vehículo
CREATE TRIGGER trg_80_vehiculos_crear_historia_tecnica
  AFTER INSERT ON vehiculos
  FOR EACH ROW EXECUTE FUNCTION fn_crear_historia_tecnica();

CREATE TRIGGER trg_99_vehiculos_audit
  AFTER INSERT OR UPDATE OR DELETE ON vehiculos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- historias_tecnicas ----

CREATE TRIGGER trg_50_historias_tecnicas_set_updated_at
  BEFORE UPDATE ON historias_tecnicas
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Solo UPDATE: el INSERT ocurre via trigger de sistema sin actor_id de usuario.
-- Auditar ese INSERT generaría entradas con actor_id=NULL de bajo valor.
CREATE TRIGGER trg_99_historias_tecnicas_audit
  AFTER UPDATE ON historias_tecnicas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- propietarios_vehiculo ----

CREATE TRIGGER trg_50_propietarios_vehiculo_set_updated_at
  BEFORE UPDATE ON propietarios_vehiculo
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_99_propietarios_vehiculo_audit
  AFTER INSERT OR UPDATE OR DELETE ON propietarios_vehiculo
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- tipos_evento ----

CREATE TRIGGER trg_50_tipos_evento_set_updated_at
  BEFORE UPDATE ON tipos_evento
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_99_tipos_evento_audit
  AFTER INSERT OR UPDATE OR DELETE ON tipos_evento
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- eventos ----

CREATE TRIGGER trg_50_eventos_set_updated_at
  BEFORE UPDATE ON eventos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_99_eventos_audit
  AFTER INSERT OR UPDATE OR DELETE ON eventos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ---- referencias_evento ----

-- trg_01_*: primer trigger en ejecutarse (BEFORE INSERT, antes de trg_50/trg_80/trg_99)
CREATE TRIGGER trg_01_referencias_evento_anti_ciclo
  BEFORE INSERT ON referencias_evento
  FOR EACH ROW EXECUTE FUNCTION fn_referencias_evento_anti_ciclo();

-- Sin trigger de auditoría: referencias_evento es un log de relaciones por naturaleza propia.
-- Auditar arcos del DAG es ruido sin valor operacional. (CORRECCIÓN-R-1)


-- ============================================================
-- PASO 14 — RLS + POLICIES
-- Todas las tablas nuevas tienen RLS habilitado.
-- Roles disponibles (Migration 001 seeds): admin, jefe_taller, recepcionista,
--   mecanico, cliente_portal.
-- Funciones de Migration 001: mi_org_id(), mi_rol().
-- ============================================================

ALTER TABLE clientes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE conductores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE historias_tecnicas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE propietarios_vehiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_evento          ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE referencias_evento    ENABLE ROW LEVEL SECURITY;


-- ---- clientes ----
-- mecanico EXCLUIDO: contiene PII — PERMISSION_MODEL §6
-- cliente_portal: diferido a Migration 006 (v_clientes_portal con security_barrier)

CREATE POLICY "clientes_select"
  ON clientes FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );

CREATE POLICY "clientes_insert"
  ON clientes FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );

-- WITH CHECK (org_id = mi_org_id()) previene cambio de org_id — DATABASE_MODEL §10 regla 9
CREATE POLICY "clientes_update"
  ON clientes FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id());

-- DELETE: sin policy → bloqueado (soft-delete via UPDATE de eliminado_en)


-- ---- conductores ----
-- mecanico PUEDE ver conductores: no contiene PII financiera crítica

CREATE POLICY "conductores_select"
  ON conductores FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
  );

CREATE POLICY "conductores_insert"
  ON conductores FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );

CREATE POLICY "conductores_update"
  ON conductores FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id());

-- DELETE: sin policy → bloqueado (soft-delete)


-- ---- vehiculos ----
-- Todos los roles pueden ver vehículos de su organización
-- (restricción "solo vehículos asignados" para mecanico se aplica en Migration 003+)

CREATE POLICY "vehiculos_select"
  ON vehiculos FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
  );

CREATE POLICY "vehiculos_insert"
  ON vehiculos FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );

CREATE POLICY "vehiculos_update"
  ON vehiculos FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id());

-- DELETE: sin policy → bloqueado (soft-delete)


-- ---- historias_tecnicas ----
-- SELECT: todos los roles (mecánico necesita ver la historia técnica del vehículo)
-- INSERT: sin policy → bloqueado para usuarios (solo fn_crear_historia_tecnica con BYPASSRLS)
-- UPDATE: admin y jefe_taller únicamente (HIGH-SEC-1 — recepcionista puede ver, no editar)

CREATE POLICY "historias_tecnicas_select"
  ON historias_tecnicas FOR SELECT TO authenticated
  USING (org_id = mi_org_id());

CREATE POLICY "historias_tecnicas_update"
  ON historias_tecnicas FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller')
  )
  WITH CHECK (org_id = mi_org_id());

-- DELETE: sin policy → bloqueado (historias_tecnicas son inmutables)


-- ---- propietarios_vehiculo ----

CREATE POLICY "propietarios_vehiculo_select"
  ON propietarios_vehiculo FOR SELECT TO authenticated
  USING (org_id = mi_org_id());

CREATE POLICY "propietarios_vehiculo_insert"
  ON propietarios_vehiculo FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  );

-- fecha_fin IS NULL en USING: solo la relación activa es editable.
-- Para corregir históricos, admin debe usar service_role (bypasea RLS).
CREATE POLICY "propietarios_vehiculo_update"
  ON propietarios_vehiculo FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND fecha_fin IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
  )
  WITH CHECK (org_id = mi_org_id());

-- DELETE: sin policy → bloqueado


-- ---- tipos_evento ----
-- SELECT: todos los roles — incluye activo=false para que eventos históricos
--   que referencian un tipo desactivado puedan resolver su label.
--   La capa de aplicación filtra activo=true al mostrar el selector de nuevo evento.
-- INSERT: solo admin (onboarding Edge Function usa service_role → bypasea RLS)

CREATE POLICY "tipos_evento_select"
  ON tipos_evento FOR SELECT TO authenticated
  USING (org_id = mi_org_id());

CREATE POLICY "tipos_evento_insert"
  ON tipos_evento FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin')
  );

CREATE POLICY "tipos_evento_update"
  ON tipos_evento FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin')
  )
  WITH CHECK (org_id = mi_org_id());

-- DELETE: sin policy → bloqueado (desactivar via activo = false)


-- ---- eventos ----
-- mecanico puede insertar (reportar hallazgo) y actualizar (marcar progreso)
-- Restricción granular (solo eventos asignados) se implementa en Migration 003.

CREATE POLICY "eventos_select"
  ON eventos FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
  );

CREATE POLICY "eventos_insert"
  ON eventos FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  );

-- HIGH-SEC-2 (Architecture Board): mecanico no puede actualizar eventos cerrados.
-- WITH CHECK: si NEW.cerrado_en IS NOT NULL para mecanico → UPDATE rechazado.
-- Protección completa de campos individuales requiere Trigger 1 en Migration 003.
CREATE POLICY "eventos_update"
  ON eventos FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND (
      mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
      OR (
        mi_rol() = 'mecanico'
        AND cerrado_en IS NULL
      )
    )
  );

-- DELETE: sin policy → bloqueado (soft-delete)


-- ---- referencias_evento ----
-- BLOCKER-SEC-1 (Architecture Board): INSERT policy verifica via subquery que
-- ambos eventos referenciados pertenecen al org_id del usuario.
-- La SELECT policy en eventos impide obtener UUIDs de otros tenants via SDK normal,
-- pero si el UUID es conocido por otro vector, sin esta subquery el INSERT cruzaría tenants.
-- Los lookups usan el índice PK de eventos → O(log n) por INSERT.

CREATE POLICY "referencias_evento_select"
  ON referencias_evento FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
  );

CREATE POLICY "referencias_evento_insert"
  ON referencias_evento FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista')
    AND (SELECT org_id FROM eventos WHERE id = evento_origen_id)  = mi_org_id()
    AND (SELECT org_id FROM eventos WHERE id = evento_destino_id) = mi_org_id()
  );

-- Solo para anular arcos (soft-delete via eliminado_en): admin y jefe_taller
CREATE POLICY "referencias_evento_eliminar"
  ON referencias_evento FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND eliminado_en IS NULL
    AND mi_rol() IN ('admin', 'jefe_taller')
  )
  WITH CHECK (org_id = mi_org_id());

-- DELETE: sin policy → bloqueado (soft-delete)


-- ============================================================
-- FIN DE TRANSACCIÓN PRINCIPAL
-- ============================================================
COMMIT;


-- ============================================================
-- NOTA PARA MIGRATION 003 (NO implementar aquí):
--
-- Al inicio de Migration 003, añadir:
--   ALTER TABLE eventos
--     ADD CONSTRAINT fk_eventos_orden_trabajo_id
--       FOREIGN KEY (orden_trabajo_id) REFERENCES ordenes_trabajo(id) ON DELETE RESTRICT;
--
-- Migration 003 también implementa:
--   * Trigger 1: inmutabilidad de eventos cerrados (BEFORE UPDATE ON eventos)
--     — PRIORIDAD MÁXIMA: cada sprint sin este trigger es ventana de degradación de datos.
--   * Trigger de sincronización OT-Evento
--   * Restricción DB: mecanico no puede cerrar ni actualizar eventos no asignados
--
-- RIESGOS ACTIVOS (ver MIGRATION_002_SPEC.md §12):
--   R-03: patente soft-deleted bloquea re-registro — reactivar via UPDATE eliminado_en=NULL
--   R-06: eventos.creado_por NOT NULL — Edge Functions deben autenticarse con usuario real
--   R-08: cliente_portal no puede leer clientes hasta Migration 006
--   R-10: migración TallerGP debe hacer topological sort de referencias_evento
--   R-11: mecanico puede setear estado='cerrado' con cerrado_en=NULL hasta que
--         Trigger 1 de Migration 003 esté activo — ventana de corrupción de estado
-- ============================================================
