# Migration 005 — Estado de validación

**Actualizado:** 2026-06-30  
**Entorno validado:** `all-motors-cloud` (iowxkemtvsffohakczpi) — autorizado como DEV  
**Estado:** ✅ Aplicada y validada

---

## Estado de migraciones

| Migration | Local | all-motors-cloud (DEV) |
|---|---|---|
| 001 | ✅ | ✅ aplicada |
| 002 | ✅ | ✅ aplicada |
| 003 | ✅ | ✅ aplicada |
| 004 | ✅ | ✅ aplicada |
| 005 | ✅ | ✅ **aplicada 2026-06-30** |

---

## Objetos creados por Migration 005

| Objeto | Tipo | RLS | Estado |
|---|---|---|---|
| `catalogo_servicios` | tabla | ✅ activa | ✅ |
| `plantillas_trabajo` | tabla | ✅ activa | ✅ |
| `items_plantilla` | tabla | ⚠️ sin RLS (intencional) | ✅ |
| `configuracion_mano_obra` | tabla | ✅ activa | ✅ |
| `cargos_ot` | tabla | ✅ activa | ✅ |
| `v_ot_totales` | vista | N/A (hereda de ot) | ✅ |
| `items_reparacion` (6 cols) | ALTER TABLE | — | ✅ |

**Nota `items_plantilla`:** sin org_id propio. Protección multiempresa viene del FK a `plantillas_trabajo` que sí tiene RLS. Documentado en la migración como aceptable en MVP single-tenant.

---

## Validación de seeds

| Objeto | Esperado | Real | Resultado |
|---|---|---|---|
| `catalogo_servicios` | 41 | 41 | ✅ |
| `plantillas_trabajo` | 5 | 5 | ✅ |
| `items_plantilla` | 24* | 24 | ✅ |
| `configuracion_mano_obra` | 1 | 1 | ✅ |

*24 ítems: 6 (SSMANTPICK) + 15 (12PUNTOS: 1 cabecera + 14 checklist) + 3 (SSCAMNEU).  
KITMAXUSTR (0) y KITL200 (0) requieren `repuesto_id` del inventario — pendiente.

---

## Validación de columnas ALTER TABLE items_reparacion

| Columna | Tipo | Nullable |
|---|---|---|
| `servicio_catalogo_id` | uuid | YES |
| `plantilla_id` | uuid | YES |
| `horas_estandar_snapshot` | numeric | YES |
| `valor_hora_snapshot` | integer | YES |
| `precio_catalogo_snapshot` | integer | YES |
| `nombre_servicio_snapshot` | text | YES |

✅ Las 6 columnas D1 presentes y correctamente tipadas.

---

## Validación fn_validar_org_cargos_ot

| Propiedad | Valor | Resultado |
|---|---|---|
| `security_definer` | true | ✅ |
| `config` | `[search_path=public]` | ✅ |
| `owner` | `postgres` (BYPASSRLS) | ✅ |

---

## Validación matemática v_ot_totales (OTs reales)

| OT | MO | Repuestos | Base afecta | IVA 19% | Total | Math OK |
|---|---|---|---|---|---|---|
| OT-000001 | 35.000 | 45.000 | 80.000 | 15.200 | 95.200 | ✅ |
| OT-000002 | 0 | 0 | 0 | 0 | 0 | ✅ (OT vacía) |
| OT-000003 | 4.890 | 115.910 | 120.800 | 22.952 | 143.752 | ✅ |

Fórmula SII: `base = MO + repuestos + cargos_afectos - descuentos`, `IVA = ROUND(base × 0.19)`, `total = base × 1.19 + exentos`.

---

## Validación RLS por rol

Predicados evaluados directamente con `mi_rol()` y `mi_org_id()` simulados.

| Rol | cs SELECT | cs INSERT/UPDATE | config_mo SELECT | config_mo UPDATE | cargos_ot SELECT | cargos_ot INSERT |
|---|---|---|---|---|---|---|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| jefe_taller | ✅ | ✅ | ✅ | ❌ (correcto) | ✅ | ✅ |
| recepcionista | ✅ | ❌ (correcto) | ✅ | ❌ (correcto) | ✅ | ✅ |
| mecanico | ✅ | ❌ (correcto) | ❌ (correcto) | ❌ (correcto) | ❌ (correcto) | ❌ (correcto) |

`mi_rol()` lee `auth.jwt() → app_metadata → 'role'`. Validado con `set_config`.

---

## TypeScript tipos regenerados

```
packages/database/src/generated/types.ts — 3.632 líneas
Incluye: catalogo_servicios, plantillas_trabajo, items_plantilla,
         configuracion_mano_obra, cargos_ot, v_ot_totales
Generado: supabase gen types typescript --linked
```

---

## Pipeline de calidad

| Check | Resultado |
|---|---|
| `supabase db push --dry-run` (solo 005) | ✅ |
| `supabase db push --linked --yes` | ✅ EXIT 0 |
| Tipos regenerados con tablas M005 | ✅ |
| `npx tsc --noEmit` | ✅ 0 errores |
| `npx next build` | ✅ EXIT 0 |

---

## Pendientes (no bloquean M005/M006)

| # | Item | Prioridad |
|---|---|---|
| 1 | Seeds KITMAXUSTR + KITL200: requieren repuesto_id del inventario | Media |
| 2 | `items_plantilla` sin RLS propia: aceptable MVP, revisar en SaaS multitenant | Baja |
| 3 | Confirmar `configuracion_mano_obra` tarifas con el taller (valores son TallerGP, pueden diferir) | Alta antes de usar UI |
| 4 | Validación RLS con rol session real (via app web) pendiente hasta que exista UI M005 | Post-UI |
| 5 | `1701` precio+horas: confirmar con taller (usoCount=1, REVIEW) | Media |
| 6 | `3701` precio+horas: confirmar con taller (usoCount=1, REVIEW) | Media |
| 7 | **Migration 007** — agregar `catalogo_servicios.estado` (borrador/pendiente_revision/aprobado) antes de sprint UI | Alta — previa a sprint catálogo |

Ver diseño completo en [`docs/database/CATALOGO_VIVO_STRATEGY.md`](CATALOGO_VIVO_STRATEGY.md).

---

## Estado Migration 006 (catálogo, 2026-06-30)

| Check | Resultado |
|---|---|
| `supabase db push --linked --yes` | ✅ EXIT 0 |
| `catalogo_servicios` total | ✅ 45 (41 + 4 INSERT) |
| 4 INSERTs: 1301, DPF01, RP04, SSMAC | ✅ presentes |
| 32 UPDATEs de precio/nombre/categoría | ✅ aplicados |
| RFAMS precio = 0 | ✅ intacto |
| SL0104 precio = $2.941 | ✅ corregido |
| RECTAM nombre | ✅ RECTIFICADO TAMBOR DE FRENO |
| CHECK `categoria` extendido (+frenos, +transmision) | ✅ |
| `1701` y `3701` NO modificados (REVIEW) | ✅ intencional |
| `npx tsc --noEmit` | ✅ 0 errores |
| `npx next build` | ✅ EXIT 0 |
