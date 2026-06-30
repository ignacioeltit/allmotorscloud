# Reglas de Desarrollo — All Motors ERP

**Versión:** 1.0
**Fecha:** 2026-06-30
**Estado:** Vigente

Estas reglas son obligatorias para cualquier persona que trabaje en el proyecto.
Son el resultado de decisiones tomadas con contexto real del negocio y de la implementación.
No son sugerencias.

---

## REGLA 1 — Validar contra ERP_MASTER antes de implementar

Antes de escribir una sola línea de código para una funcionalidad nueva, el desarrollador debe verificar que el comportamiento esperado está descrito en:

`docs/erp-master/ERP_MASTER_v1.0.md`

Si está descrito: implementar exactamente lo que dice el documento.

Si no está descrito: **no implementar todavía**. Primero proponer la especificación, obtener aprobación del product owner, actualizar el ERP_MASTER, y recién entonces implementar.

**Por qué:** el código que no tiene especificación funcional aprobada es el origen de la mayoría de los conflictos entre lo que se construyó y lo que el negocio necesitaba.

---

## REGLA 2 — Ante contradicción entre implementación y documento: detener el desarrollo

Si durante el desarrollo se descubre que la implementación actual contradice lo que dice ERP_MASTER:

1. **Detener el desarrollo de la funcionalidad nueva**
2. **Documentar la contradicción** (en qué divergen, cuál es el comportamiento actual vs el esperado)
3. **Decidir** junto al product owner: ¿se corrige el código o se actualiza el documento?
4. **Actuar** solo después de esa decisión

No continuar construyendo sobre una base inconsistente.

**Por qué:** construir funcionalidades encima de un modelo inconsistente multiplica la deuda técnica. Es más barato parar ahora que refactorizar después.

---

## REGLA 3 — Toda modificación funcional importante actualiza tres documentos

Si se aprueba un cambio al modelo funcional (una nueva funcionalidad, un cambio de comportamiento, un módulo nuevo), antes de hacer commit a producción deben estar actualizados:

1. `docs/erp-master/ERP_MASTER_v1.0.md` (o la versión más reciente) — con el nuevo comportamiento descrito
2. `docs/erp-master/CHANGELOG.md` — con la entrada de la versión correspondiente
3. `docs/erp-master/ROADMAP.md` — si el cambio afecta los planes de versiones futuras

Los tres deben actualizarse en el mismo PR o commit que la implementación, no después.

**Por qué:** la documentación que se actualiza "después" no se actualiza nunca.

---

## REGLA 4 — Las decisiones arquitectónicas importantes se documentan con un ADR

Cuando se toma una decisión que:
- Afecta la estructura del sistema de manera que no es fácilmente reversible
- Involucra un trade-off significativo entre alternativas
- Cambia una convención establecida en el proyecto
- Resuelve un problema que volverá a aparecer en el futuro

...se crea un nuevo Architecture Decision Record en `docs/decisions/`.

El número del ADR es secuencial: ADR-0001, ADR-0002, ADR-0003...

Un ADR nunca se modifica ni se borra. Si una decisión es revertida, se crea un nuevo ADR que supersede al anterior.

**Por qué:** las decisiones sin contexto son indistinguibles de errores. Un ADR documenta por qué se tomó la decisión, no solo qué se decidió.

---

## REGLA 5 — No usar Server Actions para mutaciones de licitaciones de Supabase

Las mutaciones a la base de datos desde componentes React deben usar el cliente browser de Supabase directamente. Los Server Actions fallan silenciosamente en Vercel serverless porque el contexto de cookies no se transmite correctamente.

```typescript
// CORRECTO
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
const { error } = await supabase.from('ordenes_trabajo').update({ ... }).eq('id', id)

// INCORRECTO — no usar Server Actions para mutaciones a Supabase
```

**Por qué:** las actualizaciones nunca llegan a la DB sin error visible. Este bug ya causó pérdida de datos en una versión anterior.

---

## REGLA 6 — No usar upsert en el endpoint de sincronización

El endpoint `/api/sync/` usa **insert primero, luego update de solo metadatos** cuando ya existe (error 23505). Nunca usar `upsert` porque sobrescribe `estado` y `resultado` que el usuario ya definió.

**Por qué:** el upsert en sync destruye datos operacionales del usuario. Este comportamiento fue descubierto en producción.

---

## REGLA 7 — Siempre encadenar `.select()` y verificar filas afectadas

Toda mutación con `supabase.update()` debe encadenar `.select('id')` y verificar que `data.length > 0`:

```typescript
const { data, error } = await supabase
  .from('tabla')
  .update({ campo: valor })
  .eq('id', id)
  .select('id')

if (!data || data.length === 0) {
  throw new Error('No se actualizó ningún registro. RLS puede estar bloqueando la operación o la sesión expiró.')
}
```

**Por qué:** RLS puede bloquear la operación silenciosamente. Sin esta verificación, el sistema puede dar feedback de éxito al usuario cuando la operación no se completó.

---

## REGLA 8 — El cliente Supabase correcto según el contexto

| Contexto | Cliente | Archivo |
|---|---|---|
| Componente React (cliente) | `createBrowserClient` | `@/lib/supabase/client` |
| Route Handler / Middleware | `createServerClient` | `@/lib/supabase/server` |
| Server Component | `createServerClient` | `@/lib/supabase/server` |

Nunca importar `client.ts` desde un Server Component ni viceversa.

---

## REGLA 9 — Los documentos no se borran; se marcan como obsoletos

Si un documento de `docs/` queda desactualizado o es supersedido por otro:

1. Agregar al inicio del documento una nota: `> ⚠️ Obsoleto. Ver [nombre del sucesor](ruta).`
2. Actualizar el índice en `docs/README.md` para indicar que está obsoleto
3. No borrar el archivo

**Por qué:** el historial documental tiene valor. La razón por la que una decisión fue tomada a veces está en el documento que la precedió.

---

## REGLA 10 — El historial técnico del vehículo es inmutable

Los registros en `historias_tecnicas`, `eventos` y `transiciones_evento` son append-only. Nunca se modifican retroactivamente. Si hay un error, se agrega una corrección documentada como nuevo evento.

**Por qué:** el historial técnico tiene valor legal y comercial. Un vehículo con historial modificable no es confiable.

---

## REGLA 11 — TypeScript estricto, siempre

Todo nuevo código debe pasar `npx tsc --noEmit` sin errores antes de hacer commit. No se acepta el uso de `any` salvo casos excepcionales justificados en un comentario.

**Por qué:** el sistema tiene capas de datos entre Supabase y la UI. Los errores de tipo en ese camino han causado bugs silenciosos en producción.

---

## Proceso para agregar una regla nueva

1. Identificar la regla a partir de un problema real o una decisión significativa
2. Describir el problema que la regla resuelve (la sección "Por qué")
3. Agregar la regla a este documento con número secuencial
4. Si la regla tiene impacto arquitectónico, crear también un ADR

---

## Historial de este documento

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 2026-06-30 | Creación inicial con 11 reglas |
