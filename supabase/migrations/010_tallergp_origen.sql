-- ============================================================
-- Migration 010 — Enlace con origen TallerGP
--
-- Permite importar clientes y vehículos desde TallerGP conservando
-- el ID original, para poder enlazar el historial de OTs más adelante
-- sin depender de coincidencias frágiles por RUT o patente.
-- ============================================================

ALTER TABLE clientes
  ADD COLUMN origen_tallergp_id TEXT;

ALTER TABLE vehiculos
  ADD COLUMN origen_tallergp_id TEXT;

-- Único por organización cuando está presente — evita duplicar el mismo
-- registro de TallerGP si el script de importación se corre más de una vez.
CREATE UNIQUE INDEX uq_clientes_org_origen_tallergp_id
  ON clientes (org_id, origen_tallergp_id)
  WHERE origen_tallergp_id IS NOT NULL;

CREATE UNIQUE INDEX uq_vehiculos_org_origen_tallergp_id
  ON vehiculos (org_id, origen_tallergp_id)
  WHERE origen_tallergp_id IS NOT NULL;
