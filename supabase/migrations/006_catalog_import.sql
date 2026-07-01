-- ============================================================
-- Migration 006 — Importación catálogo Mano de Obra
-- All Motors Cloud — Auditoría sobre 300 OTs TallerGP
-- Generado: 2026-06-30
-- Aprobado por: Ignacio Eltit
--
-- CONTENIDO:
--   • 4 INSERT (nuevos servicios)
--   • 32 UPDATE (seeds M005 corregidos)
--   • 2 FIX (seeds fuera de IMPORTAR: 1701, 3701)
--   • 0 DELETE — nunca se elimina catálogo
--
-- ESTRATEGIA IDEMPOTENTE:
--   INSERT ... ON CONFLICT (codigo, org_id) DO NOTHING
--   UPDATE ... WHERE campo IS DISTINCT FROM nuevo_valor
--   Re-ejecutable sin efecto secundario.
--
-- RESTRICCIONES:
--   • No toca tablas fuera de catalogo_servicios
--   • No toca OTs ni items_reparacion ni snapshots históricos
--   • RFAMS intacto (precio $0, es cabecera de 12PUNTOS)
--   • No modifica servicios marcados como EXCLUIR en el Excel
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- Variable de sesión: org_id del taller (Taller Demo)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM set_config(
    'app.import_org_id',
    (SELECT id::TEXT FROM organizaciones LIMIT 1),
    TRUE
  );
END $$;

-- ────────────────────────────────────────────────────────────
-- Extender CHECK de categoría para soportar 'frenos' y 'transmision'
-- El constraint original (M005) no los incluía. Aprobado como parte
-- del modelo ERP — las categorías del taller son más granulares
-- que el conjunto base definido en M001/M005.
-- ────────────────────────────────────────────────────────────
ALTER TABLE catalogo_servicios
  DROP CONSTRAINT IF EXISTS catalogo_servicios_categoria_check;

ALTER TABLE catalogo_servicios
  ADD CONSTRAINT catalogo_servicios_categoria_check
  CHECK (categoria = ANY (ARRAY[
    'mecanica', 'mantencion', 'neumaticos', 'electronica',
    'diagnostico', 'inspeccion', 'frenos', 'transmision', 'otro'
  ]));

-- ────────────────────────────────────────────────────────────
-- BLOQUE 1 — INSERT: 4 servicios nuevos
-- Todos vienen de IMPORTAR, uso >= 2, precio verificado
-- ────────────────────────────────────────────────────────────

-- La constraint unique (codigo, org_id) es DEFERRABLE → ON CONFLICT no soportada.
-- Usamos WHERE NOT EXISTS como alternativa idempotente equivalente.

INSERT INTO catalogo_servicios
  (org_id, codigo, nombre, categoria, horas_estandar, precio_unitario, activo)
SELECT
  current_setting('app.import_org_id')::UUID,
  v.codigo, v.nombre, v.categoria, v.horas, v.precio,
  TRUE
FROM (VALUES
  ('1301',  'RADIADOR DESMONTAR Y MONTAR',
   'mecanica',      2.10::NUMERIC, 61765),
  ('DPF01', 'REGENERACIÓN BÁSICA DPF SCANNER',
   'diagnostico',   1.29::NUMERIC, 37941),
  ('RP04',  'OBSTRUCCIÓN CONDUCTOR EGR',
   'electronica',   1.00::NUMERIC, 29780),
  ('SSMAC', 'MANTENCIÓN AIRE ACONDICIONADO (RECARGA, ACEITE, FILTRO)',
   'mantencion',    1.00::NUMERIC, 29412)
) AS v(codigo, nombre, categoria, horas, precio)
WHERE NOT EXISTS (
  SELECT 1 FROM catalogo_servicios cs
  WHERE cs.codigo = v.codigo
    AND cs.org_id = current_setting('app.import_org_id')::UUID
);

-- ────────────────────────────────────────────────────────────
-- BLOQUE 2 — UPDATE: 32 servicios con cambios
-- Cada UPDATE solo modifica si hay diferencia real (IS DISTINCT FROM)
-- ────────────────────────────────────────────────────────────

-- ── Mantención básica — precio: horas × valor_hora SSMANTPICK ($28.500/hr) ──

UPDATE catalogo_servicios SET
  precio_unitario = 11400,              -- fue: 28500 (bug: seed=valor_hora)
  actualizado_en  = NOW()
WHERE codigo = 'SL0101'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND precio_unitario IS DISTINCT FROM 11400;
-- SL0101 | RENOVAR ACEITE MOTOR | 0.4h × $28.500 = $11.400

UPDATE catalogo_servicios SET
  precio_unitario = 5882,               -- fue: 29412 (bug: seed=valor_hora)
  horas_estandar  = 0.20,              -- fue: 0.5 (aprobado: 0.2h es más frecuente)
  actualizado_en  = NOW()
WHERE codigo = 'SL0101F'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND (precio_unitario IS DISTINCT FROM 5882
    OR horas_estandar IS DISTINCT FROM 0.20);
-- SL0101F | RENOVAR ACEITE DE MOTOR Y FILTRO | 0.2h × $29.412 = $5.882

UPDATE catalogo_servicios SET
  precio_unitario = 2850,               -- fue: 28500 (bug)
  actualizado_en  = NOW()
WHERE codigo = 'SL0102'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND precio_unitario IS DISTINCT FROM 2850;
-- SL0102 | RENOVAR FILTRO DE ACEITE | 0.1h × $28.500 = $2.850

UPDATE catalogo_servicios SET
  precio_unitario = 8824,               -- fue: 29412 (bug)
  nombre          = 'RENOVAR FILTRO DE COMBUSTIBLE DIESEL PICKUP',
  actualizado_en  = NOW()
WHERE codigo = 'SL0103'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND (precio_unitario IS DISTINCT FROM 8824
    OR nombre IS DISTINCT FROM 'RENOVAR FILTRO DE COMBUSTIBLE DIESEL PICKUP');
-- SL0103 | 0.3h × $29.412 = $8.824 | + "DE" en nombre

UPDATE catalogo_servicios SET
  precio_unitario = 2941,               -- fue: 29412 (bug)
  actualizado_en  = NOW()
WHERE codigo = 'SL0104'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND precio_unitario IS DISTINCT FROM 2941;
-- SL0104 | RENOVAR FILTRO DE AIRE | 0.1h × $29.412 = $2.941

UPDATE catalogo_servicios SET
  precio_unitario = 2850,               -- fue: 28500 (bug)
  nombre          = 'RENOVAR FILTRO DE HABITÁCULO (POLÉN)',
  actualizado_en  = NOW()
WHERE codigo = 'SL0105'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND (precio_unitario IS DISTINCT FROM 2850
    OR nombre IS DISTINCT FROM 'RENOVAR FILTRO DE HABITÁCULO (POLÉN)');
-- SL0105 | 0.1h × $28.500 = $2.850 | + paréntesis y DE en nombre

UPDATE catalogo_servicios SET
  precio_unitario = 2850,               -- fue: 28500 (bug)
  actualizado_en  = NOW()
WHERE codigo = 'SLRESSL'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND precio_unitario IS DISTINCT FROM 2850;
-- SLRESSL | REINICIAR INDICADOR MANTENCIÓN BÁSICO | 0.1h × $28.500 = $2.850

-- ── Mantenimiento general ──────────────────────────────────────────────────

UPDATE catalogo_servicios SET
  precio_unitario = 8824,               -- fue: 29412 (bug)
  actualizado_en  = NOW()
WHERE codigo = '1129'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND precio_unitario IS DISTINCT FROM 8824;
-- 1129 | FILTRO DE COMBUSTIBLE RENOVAR | 0.3h × $29.412 = $8.824

-- ── Diagnóstico / Scanner ──────────────────────────────────────────────────

UPDATE catalogo_servicios SET
  nombre         = 'TEST BREVE / DIAGNÓSTICO SCANNER 12V',
  categoria      = 'diagnostico',
  actualizado_en = NOW()
WHERE codigo = '1011'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND (nombre IS DISTINCT FROM 'TEST BREVE / DIAGNÓSTICO SCANNER 12V'
    OR categoria IS DISTINCT FROM 'diagnostico');
-- 1011 | nombre mejorado con tildes y SCANNER correcto (era SCANER)

UPDATE catalogo_servicios SET
  precio_unitario = 29412,              -- fue: 7353 (bug: seed=valor_hora=$7.353/hr)
  categoria       = 'diagnostico',      -- fue: mecanica
  actualizado_en  = NOW()
WHERE codigo = 'INJCLE'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND (precio_unitario IS DISTINCT FROM 29412
    OR categoria IS DISTINCT FROM 'diagnostico');
-- INJCLE | LIMPIEZA INYECTORES BANCO DE PRUEBA | 4h × $7.353 = $29.412

-- ── Frenos ────────────────────────────────────────────────────────────────

UPDATE catalogo_servicios SET
  categoria      = 'frenos',           -- fue: mecanica
  actualizado_en = NOW()
WHERE codigo = '4200001'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND categoria IS DISTINCT FROM 'frenos';
-- 4200001 | MANTENCIÓN FRENOS DELANTEROS

UPDATE catalogo_servicios SET
  precio_unitario = 14706,             -- fue: 29412 (bug)
  horas_estandar  = 0.50,             -- fue: 1.0h
  categoria       = 'frenos',         -- fue: mecanica
  actualizado_en  = NOW()
WHERE codigo = 'MFTB2'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND (precio_unitario IS DISTINCT FROM 14706
    OR horas_estandar IS DISTINCT FROM 0.50
    OR categoria IS DISTINCT FROM 'frenos');
-- MFTB2 | MANTENCIÓN FRENOS TRASEROS | 0.5h × $29.412 = $14.706

UPDATE catalogo_servicios SET
  horas_estandar  = 1.00,             -- fue: 2.0h (aprobado: 1.0h)
  categoria       = 'frenos',         -- fue: mecanica
  actualizado_en  = NOW()
WHERE codigo = 'RECDIS'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND (horas_estandar IS DISTINCT FROM 1.00
    OR categoria IS DISTINCT FROM 'frenos');
-- RECDIS | RECTIFICADO DISCOS DE FRENO

UPDATE catalogo_servicios SET
  precio_unitario = 16806,            -- fue: 8403 (bug: seed=valor_hora)
  nombre          = 'RECTIFICADO TAMBOR DE FRENO',  -- fue: RECTIFICADO DISCO TRASERO (incorrecto)
  categoria       = 'frenos',         -- fue: mecanica
  actualizado_en  = NOW()
WHERE codigo = 'RECTAM'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND (precio_unitario IS DISTINCT FROM 16806
    OR nombre IS DISTINCT FROM 'RECTIFICADO TAMBOR DE FRENO'
    OR categoria IS DISTINCT FROM 'frenos');
-- RECTAM | 2h × $8.403 = $16.806 | nombre corregido (tambor ≠ disco)

-- ── Mecánica general ──────────────────────────────────────────────────────

UPDATE catalogo_servicios SET
  precio_unitario = 35294,            -- fue: 29412 (bug)
  horas_estandar  = 1.20,            -- fue: 0.5h
  actualizado_en  = NOW()
WHERE codigo = '1316'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND (precio_unitario IS DISTINCT FROM 35294
    OR horas_estandar IS DISTINCT FROM 1.20);
-- 1316 | CORREA TRAPEZOIDAL RENOVAR | 1.2h × $29.412 = $35.294

UPDATE catalogo_servicios SET
  precio_unitario = 14706,            -- fue: 29412 (bug)
  categoria       = 'transmision',    -- fue: mecanica
  nombre          = 'CONJUNTO DE EMBRAGUE DESMONTAR Y MONTAR',
  actualizado_en  = NOW()
WHERE codigo = '1602'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND (precio_unitario IS DISTINCT FROM 14706
    OR categoria IS DISTINCT FROM 'transmision'
    OR nombre IS DISTINCT FROM 'CONJUNTO DE EMBRAGUE DESMONTAR Y MONTAR');
-- 1602 | 0.5h × $29.412 = $14.706 | cat: mecanica → transmision

-- ── Electrónica / Reprogramación ─────────────────────────────────────────

UPDATE catalogo_servicios SET
  nombre         = 'ELIMINACIÓN FÍSICA FILTRO DE PARTÍCULAS DPF',
  actualizado_en = NOW()
WHERE codigo = 'RP00'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND nombre IS DISTINCT FROM 'ELIMINACIÓN FÍSICA FILTRO DE PARTÍCULAS DPF';
-- RP00 | nombre mejorado (agrega "DE", corrige "DISESL" del Excel)

UPDATE catalogo_servicios SET
  nombre         = 'PROGRAMACIÓN TPMS (1 DE 4)',
  actualizado_en = NOW()
WHERE codigo = 'TPMS'
  AND org_id = current_setting('app.import_org_id')::UUID
  AND nombre IS DISTINCT FROM 'PROGRAMACIÓN TPMS (1 DE 4)';
-- TPMS | nombre aclarado: "1o4" → "(1 DE 4)"

-- ── Inspección 12 Puntos (R1–R14) — solo normalización de nombres ─────────
-- Categoría: inspeccion (se mantiene — correcto como categoría transversal)
-- Precio: $0 (correcto — son ítems de checklist del paquete 12PUNTOS)

UPDATE catalogo_servicios SET nombre = 'REVISIÓN DE LUCES',                            actualizado_en = NOW()
WHERE codigo = 'R1'  AND org_id = current_setting('app.import_org_id')::UUID AND nombre IS DISTINCT FROM 'REVISIÓN DE LUCES';

UPDATE catalogo_servicios SET nombre = 'INSPECCIÓN VISUAL SISTEMA DE SUSPENSIÓN',      actualizado_en = NOW()
WHERE codigo = 'R2'  AND org_id = current_setting('app.import_org_id')::UUID AND nombre IS DISTINCT FROM 'INSPECCIÓN VISUAL SISTEMA DE SUSPENSIÓN';

UPDATE catalogo_servicios SET nombre = 'INSPECCIÓN DE NIVELES',                        actualizado_en = NOW()
WHERE codigo = 'R3'  AND org_id = current_setting('app.import_org_id')::UUID AND nombre IS DISTINCT FROM 'INSPECCIÓN DE NIVELES';

UPDATE catalogo_servicios SET nombre = 'INSPECCIÓN VISUAL FILTROS',                    actualizado_en = NOW()
WHERE codigo = 'R4'  AND org_id = current_setting('app.import_org_id')::UUID AND nombre IS DISTINCT FROM 'INSPECCIÓN VISUAL FILTROS';

UPDATE catalogo_servicios SET nombre = 'INSPECCIÓN VISUAL CORREAS',                    actualizado_en = NOW()
WHERE codigo = 'R5'  AND org_id = current_setting('app.import_org_id')::UUID AND nombre IS DISTINCT FROM 'INSPECCIÓN VISUAL CORREAS';

UPDATE catalogo_servicios SET nombre = 'INSPECCIÓN DE FRENOS (SACAR RUEDA)',            actualizado_en = NOW()
WHERE codigo = 'R6'  AND org_id = current_setting('app.import_org_id')::UUID AND nombre IS DISTINCT FROM 'INSPECCIÓN DE FRENOS (SACAR RUEDA)';

UPDATE catalogo_servicios SET nombre = 'INSPECCIÓN SISTEMA DE DIRECCIÓN',              actualizado_en = NOW()
WHERE codigo = 'R7'  AND org_id = current_setting('app.import_org_id')::UUID AND nombre IS DISTINCT FROM 'INSPECCIÓN SISTEMA DE DIRECCIÓN';

UPDATE catalogo_servicios SET nombre = 'INSPECCIÓN VISUAL Y MECÁNICA TREN DELANTERO',  actualizado_en = NOW()
WHERE codigo = 'R8'  AND org_id = current_setting('app.import_org_id')::UUID AND nombre IS DISTINCT FROM 'INSPECCIÓN VISUAL Y MECÁNICA TREN DELANTERO';

UPDATE catalogo_servicios SET nombre = 'INSPECCIÓN VISUAL NEUMÁTICOS',                 actualizado_en = NOW()
WHERE codigo = 'R9'  AND org_id = current_setting('app.import_org_id')::UUID AND nombre IS DISTINCT FROM 'INSPECCIÓN VISUAL NEUMÁTICOS';

UPDATE catalogo_servicios SET nombre = 'INSPECCIÓN Y CORRECCIÓN PRESIÓN NEUMÁTICOS',   actualizado_en = NOW()
WHERE codigo = 'R10' AND org_id = current_setting('app.import_org_id')::UUID AND nombre IS DISTINCT FROM 'INSPECCIÓN Y CORRECCIÓN PRESIÓN NEUMÁTICOS';

UPDATE catalogo_servicios SET nombre = 'INSPECCIÓN FUGAS DE ACEITE MOTOR',             actualizado_en = NOW()
WHERE codigo = 'R11' AND org_id = current_setting('app.import_org_id')::UUID AND nombre IS DISTINCT FROM 'INSPECCIÓN FUGAS DE ACEITE MOTOR';

UPDATE catalogo_servicios SET nombre = 'REVISIÓN BATERÍA CON EQUIPO DE DIAGNÓSTICO',   actualizado_en = NOW()
WHERE codigo = 'R12' AND org_id = current_setting('app.import_org_id')::UUID AND nombre IS DISTINCT FROM 'REVISIÓN BATERÍA CON EQUIPO DE DIAGNÓSTICO';

UPDATE catalogo_servicios SET nombre = 'REVISIÓN ESTADO Y FUNCIONAMIENTO PLUMILLAS',   actualizado_en = NOW()
WHERE codigo = 'R13' AND org_id = current_setting('app.import_org_id')::UUID AND nombre IS DISTINCT FROM 'REVISIÓN ESTADO Y FUNCIONAMIENTO PLUMILLAS';

UPDATE catalogo_servicios SET nombre = 'INSPECCIÓN NIVEL LÍQUIDO LIMPIAPARABRISAS',    actualizado_en = NOW()
WHERE codigo = 'R14' AND org_id = current_setting('app.import_org_id')::UUID AND nombre IS DISTINCT FROM 'INSPECCIÓN NIVEL LÍQUIDO LIMPIAPARABRISAS';

-- ────────────────────────────────────────────────────────────
-- BLOQUE 3 — FIX PRECIO: EXCLUIDO (ambos en REVIEW)
--
-- Durante investigación se descubrió que AMBOS tienen usoCount=1:
--   1701 CAJA DE VELOCIDADES: solo OT5561 en 300 OTs analizadas
--   3701 ALTERNADOR:          solo OT5673 en 300 OTs analizadas
--
-- Aplicar el mismo criterio aprobado para 3701 a 1701 por consistencia.
-- Estado: REVIEW — pendiente confirmación del taller.
--
-- Para aplicar cuando el taller confirme:
--   UPDATE catalogo_servicios SET precio_unitario=117648, horas_estandar=4.00,
--     actualizado_en=NOW() WHERE codigo='1701' AND org_id=<org_id>;
--   UPDATE catalogo_servicios SET precio_unitario=58824, horas_estandar=2.00,
--     actualizado_en=NOW() WHERE codigo='3701' AND org_id=<org_id>;
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- BLOQUE 4 — VERIFICACIÓN post-import
-- Conteo de filas afectadas por cada operación.
-- Esta sección NO modifica datos.
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_total   INTEGER;
  v_activos INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total   FROM catalogo_servicios;
  SELECT COUNT(*) INTO v_activos FROM catalogo_servicios WHERE activo = TRUE;
  RAISE NOTICE 'catalogo_servicios — total: %, activos: %', v_total, v_activos;

  -- Verificar INSERT: los 4 nuevos deben existir
  PERFORM 1 FROM catalogo_servicios WHERE codigo IN ('1301','DPF01','RP04','SSMAC');
  GET DIAGNOSTICS v_total = ROW_COUNT;
  RAISE NOTICE 'INSERT verificados (esperado 4): %', v_total;

  -- Verificar que RFAMS sigue intacto (precio = 0)
  SELECT precio_unitario INTO v_total FROM catalogo_servicios
    WHERE codigo = 'RFAMS' LIMIT 1;
  IF v_total = 0 THEN
    RAISE NOTICE 'RFAMS precio = 0 — intacto OK';
  ELSE
    RAISE WARNING 'RFAMS precio ≠ 0 — verificar';
  END IF;

  -- Verificar precio corregido en muestra
  SELECT precio_unitario INTO v_total FROM catalogo_servicios
    WHERE codigo = 'SL0104' LIMIT 1;
  IF v_total = 2941 THEN
    RAISE NOTICE 'SL0104 precio = 2941 — corrección OK';
  ELSE
    RAISE WARNING 'SL0104 precio = % — inesperado', v_total;
  END IF;

  -- Verificar RECTAM nombre
  PERFORM 1 FROM catalogo_servicios
    WHERE codigo = 'RECTAM' AND nombre = 'RECTIFICADO TAMBOR DE FRENO';
  IF FOUND THEN
    RAISE NOTICE 'RECTAM nombre corregido — OK';
  ELSE
    RAISE WARNING 'RECTAM nombre no coincide — verificar';
  END IF;

END $$;

COMMIT;

-- ─── FIN Migration 006 ────────────────────────────────────────────────────────
