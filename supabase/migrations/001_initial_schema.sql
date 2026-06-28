-- ============================================================
-- Migration 001 — Foundation
-- All Motors Cloud
-- Versión: 1.0 — Junio 2026
-- Spec: docs/database/MIGRATION_001_SPEC.md v0.3 FINAL FROZEN
-- Dependencias: ninguna
-- ============================================================
--
-- ORDEN DE EJECUCIÓN (corregido post-Architecture Board):
--   Paso 1  — Extensiones (fuera de transacción — no son transaccionales en PG)
--   Paso 2  — Funciones SECURITY DEFINER
--   Paso 3  — Tablas catálogo global (roles, tipos_evento_base)
--   Paso 4  — organizaciones (FK circular creado_por/eliminado_por sin FK activa)
--   Paso 5  — sucursales (FK a organizaciones)
--   Paso 6  — usuarios + ALTER TABLE FKs circulares
--   Paso 7  — permisos_rol
--   Paso 8  — Tablas particionadas + todas las particiones (transiciones_evento, audit_log)
--   Paso 9  — Índices
--   Paso 10 — RLS + Policies
--   Paso 11 — Seeds (ANTES de triggers — H-5: seeds no generan audit trail)
--   Paso 12 — Triggers (DESPUÉS de seeds)
--
-- NOTAS CRÍTICAS:
--   * CREATE EXTENSION no es transaccional → siempre IF NOT EXISTS (Condición 3)
--   * Todas las funciones SECURITY DEFINER llevan SET search_path = public (R3)
--   * fn_audit_insert owned by postgres para BYPASSRLS en audit_log
--   * transiciones_evento.evento_id y vehiculo_id: FK diferidas a Migration 002
--   * Triggers con prefijo numérico para orden determinista (M-11)
--   * Seeds ejecutados antes de triggers (H-5)
-- ============================================================


-- ============================================================
-- PASO 1 — EXTENSIONES
-- Fuera de BEGIN/COMMIT: CREATE EXTENSION no es transaccional en PostgreSQL.
-- IF NOT EXISTS garantiza idempotencia ante re-ejecución parcial.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "vector";


-- ============================================================
-- INICIO DE TRANSACCIÓN PRINCIPAL
-- Todos los DDL de tablas, índices, policies y seeds van dentro
-- de esta transacción para garantizar atomicidad.
-- ============================================================
BEGIN;


-- ============================================================
-- PASO 2 — FUNCIONES SECURITY DEFINER
-- Todas llevan SET search_path = public para prevenir
-- search_path hijacking (R3 / PHYSICAL_SCHEMA.md §8.3).
-- ============================================================

-- Función RLS: org_id del usuario autenticado desde JWT claim
-- O(1) — no hace lookup en tabla usuarios (PERSISTENCE_ARCHITECTURE.md §9)
CREATE OR REPLACE FUNCTION mi_org_id()
  RETURNS UUID
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT NULLIF(
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'org_id',
    ''
  )::UUID;
$$;

-- Función RLS: rol del usuario autenticado desde JWT claim
CREATE OR REPLACE FUNCTION mi_rol()
  RETURNS TEXT
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT NULLIF(
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role',
    ''
  );
$$;

-- Función RLS: sucursal_id del usuario autenticado desde JWT claim
-- Puede ser NULL para usuarios admin sin sucursal asignada
CREATE OR REPLACE FUNCTION mi_sucursal_id()
  RETURNS UUID
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT NULLIF(
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'sucursal_id',
    ''
  )::UUID;
$$;

-- Función trigger: mantiene actualizado_en = NOW() en BEFORE UPDATE
-- Compartida por todas las tablas per-tenant operacionales
CREATE OR REPLACE FUNCTION fn_set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$;

-- Función de auditoría central
-- Owned by postgres para BYPASSRLS sobre audit_log (ningún rol de aplicación
-- tiene policy INSERT en audit_log — solo esta función puede insertar).
-- ip_origen y canal se obtienen INTERNAMENTE via current_setting (Condición 2):
--   SET LOCAL app.current_ip = '1.2.3.4';  (dentro de BEGIN...COMMIT)
--   SET LOCAL app.canal = 'web_erp';
-- Ambos campos son nullable: NULL es válido cuando las variables no están seteadas
-- (común en Supabase pgBouncer transaction mode).
-- PII hasheado con SHA-256 antes de persistir (R4 / PHYSICAL_SCHEMA.md §7.4).
CREATE OR REPLACE FUNCTION fn_audit_insert(
  p_actor_id     UUID,
  p_actor_rol    TEXT,
  p_org_id       UUID,
  p_accion       TEXT,
  p_entidad      TEXT,
  p_entidad_id   UUID,
  p_estado_ant   JSONB,
  p_estado_nuevo JSONB
)
  RETURNS VOID
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_ip_origen      INET;
  v_canal          TEXT;
  v_ant_hashed     JSONB;
  v_nuevo_hashed   JSONB;
  v_pii_fields     TEXT[] := ARRAY['rut','nombre','nombre_completo','telefono','email','direccion'];
  v_field          TEXT;
BEGIN
  -- Obtener ip y canal de variables de sesión con missing_ok=true
  -- Retorna NULL (no excepción) si la variable no está seteada
  v_ip_origen := NULLIF(current_setting('app.current_ip', true), '')::INET;
  v_canal     := NULLIF(current_setting('app.canal', true), '');

  -- Hashear PII en estado anterior
  v_ant_hashed := p_estado_ant;
  IF v_ant_hashed IS NOT NULL THEN
    FOREACH v_field IN ARRAY v_pii_fields LOOP
      IF (v_ant_hashed ? v_field) AND (v_ant_hashed ->> v_field IS NOT NULL) THEN
        v_ant_hashed := jsonb_set(
          v_ant_hashed,
          ARRAY[v_field],
          to_jsonb(encode(digest(v_ant_hashed ->> v_field, 'sha256'), 'hex'))
        );
      END IF;
    END LOOP;
  END IF;

  -- Hashear PII en estado nuevo
  v_nuevo_hashed := p_estado_nuevo;
  IF v_nuevo_hashed IS NOT NULL THEN
    FOREACH v_field IN ARRAY v_pii_fields LOOP
      IF (v_nuevo_hashed ? v_field) AND (v_nuevo_hashed ->> v_field IS NOT NULL) THEN
        v_nuevo_hashed := jsonb_set(
          v_nuevo_hashed,
          ARRAY[v_field],
          to_jsonb(encode(digest(v_nuevo_hashed ->> v_field, 'sha256'), 'hex'))
        );
      END IF;
    END LOOP;
  END IF;

  INSERT INTO audit_log (
    actor_id, actor_rol, org_id,
    accion, entidad, entidad_id,
    cambios, ip_origen, canal
  ) VALUES (
    p_actor_id, p_actor_rol, p_org_id,
    p_accion, p_entidad, p_entidad_id,
    jsonb_build_object('ant', v_ant_hashed, 'nuevo', v_nuevo_hashed),
    v_ip_origen, v_canal
  );
END;
$$;

-- Trigger function: extrae contexto de la fila y llama a fn_audit_insert
-- Para organizaciones (sin columna org_id): usa id como org_id via COALESCE
CREATE OR REPLACE FUNCTION fn_audit_insert_trigger()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_actor_id     UUID;
  v_actor_rol    TEXT;
  v_org_id       UUID;
  v_entidad_id   UUID;
  v_estado_ant   JSONB;
  v_estado_nuevo JSONB;
  v_row_json     JSONB;
BEGIN
  v_actor_id  := auth.uid();
  v_actor_rol := mi_rol();

  IF TG_OP = 'DELETE' THEN
    v_row_json     := row_to_json(OLD)::jsonb;
    v_org_id       := COALESCE((v_row_json ->> 'org_id')::UUID, (v_row_json ->> 'id')::UUID);
    v_entidad_id   := (v_row_json ->> 'id')::UUID;
    v_estado_ant   := v_row_json;
    v_estado_nuevo := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_row_json     := row_to_json(NEW)::jsonb;
    v_org_id       := COALESCE((v_row_json ->> 'org_id')::UUID, (v_row_json ->> 'id')::UUID);
    v_entidad_id   := (v_row_json ->> 'id')::UUID;
    v_estado_ant   := NULL;
    v_estado_nuevo := v_row_json;
  ELSE -- UPDATE
    v_row_json     := row_to_json(NEW)::jsonb;
    v_org_id       := COALESCE((v_row_json ->> 'org_id')::UUID, (v_row_json ->> 'id')::UUID);
    v_entidad_id   := (v_row_json ->> 'id')::UUID;
    v_estado_ant   := row_to_json(OLD)::jsonb;
    v_estado_nuevo := v_row_json;
  END IF;

  PERFORM fn_audit_insert(
    v_actor_id,
    v_actor_rol,
    v_org_id,
    TG_OP,
    TG_TABLE_NAME,
    v_entidad_id,
    v_estado_ant,
    v_estado_nuevo
  );

  RETURN NULL; -- AFTER trigger: valor de retorno ignorado
END;
$$;


-- ============================================================
-- PASO 3 — TABLAS CATÁLOGO GLOBAL
-- Sin org_id. Son de solo lectura para todos los tenants.
-- Modificaciones solo via migrations (service_role).
-- ============================================================

CREATE TABLE roles (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre        TEXT        NOT NULL,
  descripcion   TEXT,
  nivel_acceso  INTEGER     NOT NULL,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_roles_nombre        UNIQUE (nombre),
  CONSTRAINT chk_roles_nivel_acceso CHECK (nivel_acceso BETWEEN 0 AND 100)
);

CREATE TABLE tipos_evento_base (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug           TEXT        NOT NULL,
  nombre_visible TEXT        NOT NULL,
  genera_ot      BOOLEAN     NOT NULL DEFAULT false,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tipos_evento_base_slug UNIQUE (slug)
);


-- ============================================================
-- PASO 4 — TABLA TENANT RAÍZ: organizaciones
-- creado_por y eliminado_por son UUID nullable SIN FK activa.
-- FK circular → se añade via ALTER TABLE en Paso 6 post-creación de usuarios.
-- ============================================================

CREATE TABLE organizaciones (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug           TEXT        NOT NULL,
  rut            TEXT        NOT NULL,
  nombre         TEXT        NOT NULL,
  telefono       TEXT,
  email          TEXT,
  direccion      TEXT,
  ciudad         TEXT,
  logo_url       TEXT,
  configuracion  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Audit columns (MIGRATION_001_SPEC.md §8.3)
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por     UUID,        -- FK circular → ALTER TABLE Paso 6
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  UUID,        -- FK circular → ALTER TABLE Paso 6
  CONSTRAINT uq_organizaciones_slug UNIQUE (slug),
  CONSTRAINT uq_organizaciones_rut  UNIQUE (rut)
);


-- ============================================================
-- PASO 5 — TABLA sucursales (FK a organizaciones)
-- ============================================================

CREATE TABLE sucursales (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id         UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  nombre         TEXT        NOT NULL,
  direccion      TEXT,
  ciudad         TEXT,
  telefono       TEXT,
  es_principal   BOOLEAN     NOT NULL DEFAULT false,
  -- Audit columns
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por     UUID,        -- FK → usuarios → ALTER TABLE Paso 6
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  UUID         -- FK → usuarios → ALTER TABLE Paso 6
);


-- ============================================================
-- PASO 6 — TABLA usuarios + ALTER TABLE FKs circulares
-- id coincide con auth.uid() de Supabase Auth (no usa gen_random_uuid()).
-- ============================================================

CREATE TABLE usuarios (
  id             UUID        NOT NULL PRIMARY KEY, -- = auth.uid()
  org_id         UUID        NOT NULL REFERENCES organizaciones(id)  ON DELETE RESTRICT,
  sucursal_id    UUID                 REFERENCES sucursales(id)      ON DELETE RESTRICT,
  rol_id         UUID        NOT NULL REFERENCES roles(id)           ON DELETE RESTRICT,
  nombre         TEXT        NOT NULL,
  email          TEXT        NOT NULL,
  telefono       TEXT,
  -- Audit columns
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por     UUID,        -- Self-referential FK → ALTER TABLE abajo
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  UUID         -- Self-referential FK → ALTER TABLE abajo
);

-- FKs circulares: ahora que usuarios existe se pueden declarar todas
-- H-1: spec §2 Paso 6 — todos los ALTER TABLE explícitos (organizaciones + sucursales + usuarios)

ALTER TABLE organizaciones
  ADD CONSTRAINT fk_organizaciones_creado_por
    FOREIGN KEY (creado_por)   REFERENCES usuarios(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_organizaciones_eliminado_por
    FOREIGN KEY (eliminado_por) REFERENCES usuarios(id) ON DELETE RESTRICT;

ALTER TABLE sucursales
  ADD CONSTRAINT fk_sucursales_creado_por
    FOREIGN KEY (creado_por)   REFERENCES usuarios(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_sucursales_eliminado_por
    FOREIGN KEY (eliminado_por) REFERENCES usuarios(id) ON DELETE RESTRICT;

ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuarios_creado_por
    FOREIGN KEY (creado_por)   REFERENCES usuarios(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_usuarios_eliminado_por
    FOREIGN KEY (eliminado_por) REFERENCES usuarios(id) ON DELETE RESTRICT;


-- ============================================================
-- PASO 7 — TABLA permisos_rol
-- permisos_rol.creado_por puede ser FK directa (usuarios ya existe)
-- ============================================================

CREATE TABLE permisos_rol (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id         UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  rol_id         UUID        NOT NULL REFERENCES roles(id)          ON DELETE RESTRICT,
  nombre_permiso TEXT        NOT NULL,
  valor          BOOLEAN     NOT NULL DEFAULT true,
  -- Audit columns
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por     UUID                 REFERENCES usuarios(id)       ON DELETE RESTRICT,
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  UUID                 REFERENCES usuarios(id)       ON DELETE RESTRICT
);


-- ============================================================
-- PASO 8 — TABLAS PARTICIONADAS
--
-- transiciones_evento: RANGE por creado_en — append-only
--   evento_id:  UUID NOT NULL SIN FK (tabla eventos no existe en Migration 001)
--   vehiculo_id: UUID NOT NULL — denormalización deliberada para evitar
--               triple JOIN en hot path de Historia Técnica.
--               FK vehiculo_id → vehiculos.id diferida a Migration 002.
--   Ambas FKs diferidas se añaden al INICIO de Migration 002.
--
-- audit_log: RANGE por created_at — append-only via SECURITY DEFINER
--   org_id:   UUID NULL (NULL para operaciones sobre catálogos globales)
--   actor_id: UUID NULL (NULL para operaciones de sistema). Sin FK.
--
-- Índices sobre tabla PADRE: heredados por todas las particiones (§5.6).
-- PK debe incluir columna de partición en tablas RANGE.
-- 11 particiones por tabla: 6 anuales (2020-2025) + 4 trimestrales (2026) + 1 buffer
-- ============================================================

-- ---- transiciones_evento ----

CREATE TABLE transiciones_evento (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  evento_id       UUID        NOT NULL, -- FK diferida → Migration 002
  vehiculo_id     UUID        NOT NULL, -- Denormalización deliberada — FK diferida → Migration 002
  org_id          UUID        NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  estado_anterior TEXT,                 -- NULL en primera transición del evento
  estado_nuevo    TEXT        NOT NULL,
  actor_id        UUID,                 -- NULL cuando actor_tipo = 'sistema'
  actor_tipo      TEXT        NOT NULL,
  razon           TEXT,                 -- Obligatoria cuando estado_nuevo = 'cancelado'
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Columna de particionamiento
  CONSTRAINT chk_transiciones_evento_actor_tipo
    CHECK (actor_tipo IN ('humano', 'sistema')),
  PRIMARY KEY (id, creado_en) -- PK compuesta: requerido por RANGE partitioning
) PARTITION BY RANGE (creado_en);

-- Particiones históricas anuales (datos de migración TallerGP)
CREATE TABLE transiciones_evento_2020
  PARTITION OF transiciones_evento FOR VALUES FROM ('2020-01-01') TO ('2021-01-01');
CREATE TABLE transiciones_evento_2021
  PARTITION OF transiciones_evento FOR VALUES FROM ('2021-01-01') TO ('2022-01-01');
CREATE TABLE transiciones_evento_2022
  PARTITION OF transiciones_evento FOR VALUES FROM ('2022-01-01') TO ('2023-01-01');
CREATE TABLE transiciones_evento_2023
  PARTITION OF transiciones_evento FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');
CREATE TABLE transiciones_evento_2024
  PARTITION OF transiciones_evento FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE transiciones_evento_2025
  PARTITION OF transiciones_evento FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- Particiones operacionales 2026 (trimestrales)
CREATE TABLE transiciones_evento_2026_q1
  PARTITION OF transiciones_evento FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE transiciones_evento_2026_q2
  PARTITION OF transiciones_evento FOR VALUES FROM ('2026-04-01') TO ('2026-07-01'); -- ACTIVA junio 2026
CREATE TABLE transiciones_evento_2026_q3
  PARTITION OF transiciones_evento FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE transiciones_evento_2026_q4
  PARTITION OF transiciones_evento FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');

-- Partición buffer 2027
CREATE TABLE transiciones_evento_2027_q1
  PARTITION OF transiciones_evento FOR VALUES FROM ('2027-01-01') TO ('2027-04-01');


-- ---- audit_log ----

CREATE TABLE audit_log (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Columna de particionamiento
  actor_id    UUID,        -- NULL para operaciones de sistema/migration. Sin FK (preservar históricos)
  actor_rol   TEXT,        -- NULL para actor sistema
  org_id      UUID,        -- NULL para operaciones sobre catálogos globales. Sin FK (preservar post-offboarding)
  accion      TEXT        NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', o código semántico
  entidad     TEXT        NOT NULL, -- nombre de la tabla afectada
  entidad_id  UUID        NOT NULL, -- id del registro afectado
  cambios     JSONB,       -- diff before/after con PII hasheado via SHA-256
  ip_origen   INET,        -- via current_setting('app.current_ip', true) — nullable
  canal       TEXT,        -- via current_setting('app.canal', true) — nullable
  PRIMARY KEY (id, created_at) -- PK compuesta: requerido por RANGE partitioning
) PARTITION BY RANGE (created_at);

-- Particiones históricas anuales
CREATE TABLE audit_log_2020
  PARTITION OF audit_log FOR VALUES FROM ('2020-01-01') TO ('2021-01-01');
CREATE TABLE audit_log_2021
  PARTITION OF audit_log FOR VALUES FROM ('2021-01-01') TO ('2022-01-01');
CREATE TABLE audit_log_2022
  PARTITION OF audit_log FOR VALUES FROM ('2022-01-01') TO ('2023-01-01');
CREATE TABLE audit_log_2023
  PARTITION OF audit_log FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');
CREATE TABLE audit_log_2024
  PARTITION OF audit_log FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE audit_log_2025
  PARTITION OF audit_log FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- Particiones operacionales 2026 (trimestrales)
CREATE TABLE audit_log_2026_q1
  PARTITION OF audit_log FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE audit_log_2026_q2
  PARTITION OF audit_log FOR VALUES FROM ('2026-04-01') TO ('2026-07-01'); -- ACTIVA junio 2026
CREATE TABLE audit_log_2026_q3
  PARTITION OF audit_log FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE audit_log_2026_q4
  PARTITION OF audit_log FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');

-- Partición buffer 2027
CREATE TABLE audit_log_2027_q1
  PARTITION OF audit_log FOR VALUES FROM ('2027-01-01') TO ('2027-04-01');


-- ============================================================
-- PASO 9 — ÍNDICES
-- Índices sobre tablas particionadas → sobre tabla PADRE (heredan a particiones).
-- Reglas de PHYSICAL_SCHEMA.md §5:
--   * org_id nunca solo — siempre compuesto
--   * Tablas operacionales: índices parciales WHERE eliminado_en IS NULL
--   * Sin GIN en Migration 001 (van en Migration 002)
--   * Ningún índice sin justificación documentada
-- ============================================================

-- ---- organizaciones ----
-- UNIQUE slug y rut ya declarados inline en CREATE TABLE

-- ---- sucursales ----
CREATE INDEX idx_sucursales_org_id
  ON sucursales (org_id);

CREATE UNIQUE INDEX idx_sucursales_org_nombre_activo
  ON sucursales (org_id, nombre)
  WHERE eliminado_en IS NULL;

-- ---- usuarios ----
CREATE INDEX idx_usuarios_org_id
  ON usuarios (org_id)
  WHERE eliminado_en IS NULL;

CREATE UNIQUE INDEX idx_usuarios_org_email_activo
  ON usuarios (org_id, email)
  WHERE eliminado_en IS NULL;

CREATE INDEX idx_usuarios_rol_id
  ON usuarios (rol_id)
  WHERE eliminado_en IS NULL;

CREATE INDEX idx_usuarios_sucursal_id
  ON usuarios (sucursal_id)
  WHERE eliminado_en IS NULL;

-- ---- permisos_rol ----
CREATE INDEX idx_permisos_rol_org_id
  ON permisos_rol (org_id);

-- M-3: no índice simple en rol_id — cubierto por el unique compuesto abajo

CREATE UNIQUE INDEX idx_permisos_rol_org_rol_permiso_activo
  ON permisos_rol (org_id, rol_id, nombre_permiso)
  WHERE eliminado_en IS NULL;

-- ---- transiciones_evento (padre → hereda a todas las particiones) ----

-- HOT PATH: Historia Técnica por vehículo (DATABASE_MODEL.md §8, PHYSICAL_SCHEMA.md §4)
-- Requiere columna denormalizada vehiculo_id. Índice cubre queries
-- independientemente de la partición activa.
CREATE INDEX idx_transiciones_evento_vehiculo_fecha
  ON transiciones_evento (vehiculo_id, creado_en DESC);

-- Queries de auditoría por tenant + rango de fecha
CREATE INDEX idx_transiciones_evento_org_fecha
  ON transiciones_evento (org_id, creado_en DESC);

-- FK placeholder: evento_id sin FK activa hasta Migration 002
CREATE INDEX idx_transiciones_evento_evento_id
  ON transiciones_evento (evento_id);

-- ---- audit_log (padre → hereda a todas las particiones) ----

CREATE INDEX idx_audit_log_org_fecha
  ON audit_log (org_id, created_at DESC);

-- H-4 (Architecture Board): hot path "¿quién modificó este registro específico?"
-- Sin este índice: seq-scan de toda la partición para cada query de historial
CREATE INDEX idx_audit_log_org_entidad_id
  ON audit_log (org_id, entidad, entidad_id, created_at DESC)
  WHERE org_id IS NOT NULL;

CREATE INDEX idx_audit_log_actor_id
  ON audit_log (actor_id);


-- ============================================================
-- PASO 10 — RLS + POLICIES
-- Policies sobre tablas particionadas → sobre tabla PADRE.
-- Particiones hijas heredan policies del padre automáticamente (PG 12+).
-- NO definir policies directamente en particiones individuales.
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_evento_base   ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursales          ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos_rol        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transiciones_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;

-- ---- roles (catálogo global — solo lectura para roles de aplicación) ----
CREATE POLICY "roles_select_authenticated"
  ON roles FOR SELECT TO authenticated
  USING (true);
-- INSERT / UPDATE / DELETE: sin policy → bloqueado (solo service_role en migrations)

-- ---- tipos_evento_base (catálogo global — solo lectura) ----
CREATE POLICY "tipos_evento_base_select_authenticated"
  ON tipos_evento_base FOR SELECT TO authenticated
  USING (true);
-- INSERT / UPDATE / DELETE: sin policy → bloqueado

-- ---- organizaciones ----
-- El tenant solo puede ver su propia fila
CREATE POLICY "organizaciones_select"
  ON organizaciones FOR SELECT TO authenticated
  USING (id = mi_org_id());

-- INSERT: sin policy → solo service_role (onboarding via Edge Function server-side)
-- Ver MIGRATION_001_SPEC.md §8.2 nota onboarding crítica y §9.2

CREATE POLICY "organizaciones_update"
  ON organizaciones FOR UPDATE TO authenticated
  USING     (id = mi_org_id() AND mi_rol() = 'admin')
  WITH CHECK(id = mi_org_id() AND mi_rol() = 'admin');

-- DELETE: sin policy → bloqueado

-- ---- sucursales ----
CREATE POLICY "sucursales_select"
  ON sucursales FOR SELECT TO authenticated
  USING (org_id = mi_org_id() AND eliminado_en IS NULL);

CREATE POLICY "sucursales_insert"
  ON sucursales FOR INSERT TO authenticated
  WITH CHECK (org_id = mi_org_id() AND mi_rol() = 'admin');

CREATE POLICY "sucursales_update"
  ON sucursales FOR UPDATE TO authenticated
  USING     (org_id = mi_org_id() AND mi_rol() = 'admin' AND eliminado_en IS NULL)
  WITH CHECK(org_id = mi_org_id() AND mi_rol() = 'admin');

-- DELETE: sin policy → bloqueado (soft-delete via UPDATE de eliminado_en)

-- ---- usuarios ----
CREATE POLICY "usuarios_select"
  ON usuarios FOR SELECT TO authenticated
  USING (org_id = mi_org_id() AND eliminado_en IS NULL);

CREATE POLICY "usuarios_insert"
  ON usuarios FOR INSERT TO authenticated
  WITH CHECK (org_id = mi_org_id() AND mi_rol() = 'admin');

-- H-8 BLOCKER PRE-DEPLOY (Architecture Board §13.2):
-- WITH CHECK previene escalada de privilegios via edición del propio rol.
-- Un usuario editando su perfil NO puede cambiar su rol_id ni su org_id.
-- La subquery lee el rol_id actual del DB (estado antes del UPDATE).
CREATE POLICY "usuarios_update"
  ON usuarios FOR UPDATE TO authenticated
  USING (
    org_id = mi_org_id()
    AND (mi_rol() = 'admin' OR id = auth.uid())
    AND eliminado_en IS NULL
  )
  WITH CHECK (
    org_id = mi_org_id()
    AND (
      mi_rol() = 'admin'
      OR (
        id = auth.uid()
        AND rol_id = (SELECT u.rol_id FROM usuarios u WHERE u.id = auth.uid())
        AND org_id  = (SELECT u.org_id  FROM usuarios u WHERE u.id = auth.uid())
      )
    )
  );

-- DELETE: sin policy → bloqueado (soft-delete via UPDATE de eliminado_en)

-- ---- permisos_rol ----
CREATE POLICY "permisos_rol_select"
  ON permisos_rol FOR SELECT TO authenticated
  USING (org_id = mi_org_id());

CREATE POLICY "permisos_rol_insert"
  ON permisos_rol FOR INSERT TO authenticated
  WITH CHECK (org_id = mi_org_id() AND mi_rol() = 'admin');

CREATE POLICY "permisos_rol_update"
  ON permisos_rol FOR UPDATE TO authenticated
  USING     (org_id = mi_org_id() AND mi_rol() = 'admin')
  WITH CHECK(org_id = mi_org_id() AND mi_rol() = 'admin');

-- DELETE: sin policy → bloqueado

-- ---- transiciones_evento (append-only) ----
CREATE POLICY "transiciones_evento_select"
  ON transiciones_evento FOR SELECT TO authenticated
  USING (org_id = mi_org_id());

-- H-7 + BLOCKER-SEC-1 (Architecture Board §13.3):
-- org_id = mi_org_id() en INSERT es obligatorio.
-- Sin esta condición, un usuario podría insertar con org_id de otro tenant.
-- cliente_portal excluido: no tiene autoridad sobre la máquina de estados interna.
CREATE POLICY "transiciones_evento_insert"
  ON transiciones_evento FOR INSERT TO authenticated
  WITH CHECK (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller', 'recepcionista', 'mecanico')
  );

-- UPDATE: sin policy → retorna 0 filas afectadas (append-only por diseño)
-- DELETE: sin policy → retorna 0 filas afectadas (append-only por diseño)

-- ---- audit_log (append-only via SECURITY DEFINER) ----
-- Solo admin y jefe_taller pueden leer audit_log
-- Esta asimetría es deliberada: el actor no puede ver ni borrar su propio rastro
CREATE POLICY "audit_log_select"
  ON audit_log FOR SELECT TO authenticated
  USING (
    org_id = mi_org_id()
    AND mi_rol() IN ('admin', 'jefe_taller')
  );

-- INSERT: sin policy directa → solo via fn_audit_insert() con BYPASSRLS
-- UPDATE: sin policy → bloqueado (inmutable)
-- DELETE: sin policy → bloqueado (inmutable)


-- ============================================================
-- PASO 11 — SEEDS
-- Se insertan ANTES de crear los triggers de auditoría (H-5).
-- Esto evita que los seeds de catálogos globales generen filas
-- en audit_log con actor_id=NULL y org_id=NULL desde el momento 0.
-- Los seeds son datos de instalación, no actividad de usuario.
-- Las migrations corren como postgres (BYPASSRLS) → pasan RLS.
-- ============================================================

-- ---- roles (5 filas — catálogo base global) ----
-- Invariante: estos 5 roles son el catálogo universal.
-- Personalización de permisos por tenant vive en permisos_rol.
INSERT INTO roles (nombre, descripcion, nivel_acceso) VALUES
  ('admin',
   'Administrador completo de la organización. Gestiona usuarios, configuración, billing y reportes financieros.',
   100),
  ('jefe_taller',
   'Supervisión técnica y operativa. Acceso a toda información técnica y financiera. Puede aprobar control de calidad.',
   80),
  ('recepcionista',
   'Operación de front-desk. Flujo completo de atención: recepción, presupuestos, autorizaciones, cobros.',
   60),
  ('mecanico',
   'Trabajo técnico exclusivo. Solo vehículos y eventos asignados. Sin acceso a precios, finanzas ni PII del cliente.',
   40),
  ('cliente_portal',
   'Acceso externo de solo lectura. Solo sus propios vehículos y registros marcados como visibles.',
   10);

-- ---- tipos_evento_base (31 filas — EVENT_MODEL.md §4 + extensión documentada) ----

-- Categoría 1 — Contacto y Programación (2)
INSERT INTO tipos_evento_base (slug, nombre_visible, genera_ot) VALUES
  ('consulta', 'Consulta', false),
  ('cita',     'Cita',     false);

-- Categoría 2 — Ingreso del Vehículo (2)
INSERT INTO tipos_evento_base (slug, nombre_visible, genera_ot) VALUES
  ('recepcion', 'Recepción', true),
  ('check_in',  'Check-In',  false);

-- Categoría 3 — Evaluación Técnica (7)
INSERT INTO tipos_evento_base (slug, nombre_visible, genera_ot) VALUES
  ('diagnostico',         'Diagnóstico',         true),
  ('escaneo_electronico', 'Escaneo Electrónico',  false),
  ('inspeccion_visual',   'Inspección Visual',    false),
  ('prueba_ruta',         'Prueba de Ruta',       false),
  ('revision_preventiva', 'Revisión Preventiva',  true),
  ('revision_precompra',  'Revisión Precompra',   false),
  ('peritaje',            'Peritaje',             false);

-- Categoría 4 — Presupuesto y Autorización (4)
INSERT INTO tipos_evento_base (slug, nombre_visible, genera_ot) VALUES
  ('cotizacion',               'Cotización',                  false),
  ('presupuesto',              'Presupuesto',                 true),
  ('autorizacion',             'Autorización',                true),
  ('modificacion_presupuesto', 'Modificación de Presupuesto', true);

-- Categoría 5 — Ejecución del Trabajo (6)
INSERT INTO tipos_evento_base (slug, nombre_visible, genera_ot) VALUES
  ('reparacion',          'Reparación',           true),
  ('mantencion',          'Mantención',           true),
  ('instalacion',         'Instalación',          false),
  ('solicitud_repuestos', 'Solicitud de Repuestos', false),
  ('espera_repuestos',    'Espera de Repuestos',  false),
  ('lavado',              'Lavado',               false);

-- Categoría 6 — Calidad y Entrega (2)
INSERT INTO tipos_evento_base (slug, nombre_visible, genera_ot) VALUES
  ('control_calidad', 'Control de Calidad', true),
  ('entrega',         'Entrega',            true);

-- Categoría 7 — Post-Venta y Garantía (4)
INSERT INTO tipos_evento_base (slug, nombre_visible, genera_ot) VALUES
  ('seguimiento',     'Seguimiento',          false),
  ('reclamo_cliente', 'Reclamo del Cliente',  false),
  ('garantia',        'Garantía',             true),
  ('reingreso',       'Reingreso',            true);

-- Categoría 8 — Generados por el Sistema (3)
INSERT INTO tipos_evento_base (slug, nombre_visible, genera_ot) VALUES
  ('alerta_mantencion',           'Alerta de Mantención',              false),
  ('recordatorio_cita',           'Recordatorio de Cita',              false),
  ('alerta_vencimiento_garantia', 'Alerta de Vencimiento de Garantía', false);

-- Tipo adicional obligatorio (extensión documentada — DATABASE_MODEL.md §4.2)
-- Requerido para corregir errores en eventos cerrados sin modificar el original
INSERT INTO tipos_evento_base (slug, nombre_visible, genera_ot) VALUES
  ('correccion', 'Corrección', false);

-- Verificación inline: 31 filas esperadas
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM tipos_evento_base) <> 31 THEN
    RAISE EXCEPTION 'tipos_evento_base seed incompleto: se esperaban 31 filas, se insertaron %',
      (SELECT COUNT(*) FROM tipos_evento_base);
  END IF;
END;
$$;


-- ============================================================
-- PASO 12 — TRIGGERS
-- Se crean DESPUÉS de los seeds (H-5): los seeds no generan
-- registros en audit_log.
--
-- Naming con prefijo numérico para orden de ejecución determinista (M-11):
--   trg_50_* → BEFORE UPDATE (fn_set_updated_at)
--   trg_99_* → AFTER INSERT/UPDATE/DELETE (fn_audit_insert_trigger)
--
-- Tablas SIN trigger de auditoría (por diseño):
--   * transiciones_evento y audit_log: auditar la tabla de auditoría
--     crearía un loop infinito de triggers.
--   * roles y tipos_evento_base: catálogos globales auditados via
--     git + schema_migrations, no via trigger (M-12 cerrada).
-- ============================================================

-- ---- fn_set_updated_at (BEFORE UPDATE) ----
-- Invariante: actualizado_en nunca es escrita por la aplicación

CREATE TRIGGER trg_50_organizaciones_set_updated_at
  BEFORE UPDATE ON organizaciones
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_50_sucursales_set_updated_at
  BEFORE UPDATE ON sucursales
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_50_usuarios_set_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_50_permisos_rol_set_updated_at
  BEFORE UPDATE ON permisos_rol
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---- fn_audit_insert_trigger (AFTER INSERT/UPDATE/DELETE) ----
-- Garantía de base de datos: toda mutación queda en audit_log
-- independientemente del código de aplicación.

CREATE TRIGGER trg_99_organizaciones_audit
  AFTER INSERT OR UPDATE ON organizaciones
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();

CREATE TRIGGER trg_99_sucursales_audit
  AFTER INSERT OR UPDATE OR DELETE ON sucursales
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();

CREATE TRIGGER trg_99_usuarios_audit
  AFTER INSERT OR UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();

CREATE TRIGGER trg_99_permisos_rol_audit
  AFTER INSERT OR UPDATE OR DELETE ON permisos_rol
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insert_trigger();


-- ============================================================
-- FIN DE TRANSACCIÓN PRINCIPAL
-- ============================================================
COMMIT;


-- ============================================================
-- NOTA PARA MIGRATION 002 (NO implementar aquí):
--
-- Al inicio de Migration 002, añadir:
--   ALTER TABLE transiciones_evento
--     ADD CONSTRAINT fk_transiciones_evento_evento_id
--       FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE RESTRICT,
--     ADD CONSTRAINT fk_transiciones_evento_vehiculo_id
--       FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE RESTRICT;
--
-- OBJETOS DIFERIDOS A MIGRATIONS POSTERIORES:
--   * FK transiciones_evento.evento_id → eventos.id (Migration 002)
--   * FK transiciones_evento.vehiculo_id → vehiculos.id (Migration 002)
--   * Trigger inmutabilidad de eventos cerrados (Migration 003)
--   * Trigger anti-ciclo en referencias_evento (Migration 002)
--   * Índices GIN pg_trgm (Migration 002)
--   * Índices tsvector (Migration 002)
--   * Índice HNSW pgvector (V1)
--   * Vistas v_clientes_mecanico, v_items_presupuesto_mecanico (Migration 006)
--
-- RIESGOS CONOCIDOS (ver MIGRATION_001_SPEC.md §10):
--   R9: Desactivación de usuario no revoca JWT — implementar en UC-A01
--   R6: Job automático de creación de particiones futuras — implementar antes de Q4 2026
--   R13: Protección de "último admin" — implementar antes del sprint UC-A01
-- ============================================================
