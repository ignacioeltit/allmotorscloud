-- ============================================================
-- Migration 018 — Búsqueda sin tildes + categoría "Otros" en presupuestos
--
-- (1) Búsqueda insensible a tildes: columna generada `busqueda` (minúsculas, sin
--     acentos) en repuestos y catalogo_servicios, con índice GIN trigram. La app
--     normaliza el término igual (sin tildes) y filtra sobre esta columna.
-- (2) Presupuestos: se agrega el tipo de ítem 'otros' (insumos, cargos varios)
--     y la columna total_otros, para poder cotizar en 3 categorías.
-- ============================================================

-- ── (1) Búsqueda sin tildes ──────────────────────────────────────────────────
-- Wrapper IMMUTABLE de unaccent (la forma con diccionario explícito es estable):
-- necesario para poder usarlo en una columna generada.
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  SET search_path = public, extensions, pg_catalog
  AS $$ SELECT lower(unaccent('unaccent', $1)) $$;

ALTER TABLE repuestos
  ADD COLUMN busqueda text
  GENERATED ALWAYS AS (
    f_unaccent(coalesce(codigo, '') || ' ' || coalesce(nombre, '') || ' ' || coalesce(marca, ''))
  ) STORED;

ALTER TABLE catalogo_servicios
  ADD COLUMN busqueda text
  GENERATED ALWAYS AS (
    f_unaccent(coalesce(codigo, '') || ' ' || coalesce(nombre, ''))
  ) STORED;

CREATE INDEX idx_repuestos_busqueda_trgm
  ON repuestos USING gin (busqueda gin_trgm_ops);

CREATE INDEX idx_catalogo_servicios_busqueda_trgm
  ON catalogo_servicios USING gin (busqueda gin_trgm_ops);

-- ── (2) Categoría "Otros" en presupuestos ────────────────────────────────────
ALTER TABLE items_presupuesto
  DROP CONSTRAINT chk_items_presupuesto_tipo;

ALTER TABLE items_presupuesto
  ADD CONSTRAINT chk_items_presupuesto_tipo
    CHECK (tipo IN ('mano_obra', 'repuesto', 'otros'));

ALTER TABLE presupuestos
  ADD COLUMN total_otros NUMERIC(12,2) NOT NULL DEFAULT 0;
