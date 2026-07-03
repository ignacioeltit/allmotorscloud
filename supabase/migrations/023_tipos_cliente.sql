-- ============================================================
-- Migration 023 — Nuevos tipos de cliente: familia y mercado_publico
--
-- Pedido del taller (2026-07-03): al crear un cliente se debe poder clasificar
-- como Particular, Empresa, Familia o Mercado Público (licitaciones/compra ágil,
-- conecta con Chilecompra2). 'persona_natural' se mantiene como valor almacenado
-- (etiquetado "Particular" en la UI) y 'aseguradora' se conserva por
-- compatibilidad con datos existentes.
-- ============================================================

ALTER TABLE clientes
  DROP CONSTRAINT chk_clientes_tipo;

ALTER TABLE clientes
  ADD CONSTRAINT chk_clientes_tipo
    CHECK (tipo IN ('persona_natural', 'empresa', 'aseguradora', 'familia', 'mercado_publico'));
