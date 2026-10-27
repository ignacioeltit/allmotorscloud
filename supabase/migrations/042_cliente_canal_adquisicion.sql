-- 042 — Canal de adquisición del cliente ("¿cómo nos conoció?").
-- Para marketing: saber de dónde llegan los clientes. Texto libre acotado por la
-- app a una lista (recomendacion, google, redes_sociales, etc.).

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS canal_adquisicion TEXT;
