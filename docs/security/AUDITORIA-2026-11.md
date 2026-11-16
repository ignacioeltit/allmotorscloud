# Auditoría de seguridad — All Motors Cloud (2026-11)

**Fecha:** 2026-11-16 · **Tipo:** solo lectura (migraciones 001–056, `apps/web`, historial git de 184 commits) · **Herramientas:** agentes ECC `database-reviewer` y `security-reviewer`; los hallazgos Crítico y Alto se verificaron a mano contra el SQL.

La auditoría no se conectó a Supabase. Los resultados del Paso 0 y de A4 los verificó el usuario en el proyecto `ixnugbxetmkmxfwutxbz` el 2026-11-16.

## Resumen
- **Sin hallazgos en:**
  - Secretos: no hay en el repo ni en el historial.
  - Service role: no se usa en `apps/web`.
  - RLS: habilitado en las 38 tablas, sin ninguna policy `FOR ALL`.
  - Vistas: las 3 tienen `security_invoker`.
  - Migración 049: no rompe el aislamiento por org.
- **Problemas reales:**
  - Dos RPC `SECURITY DEFINER` confían en un `p_org_id` recibido como parámetro. Ya están corregidas en producción; falta la migración 057.
  - Los costos solo se ocultan en la UI; la BD se los entrega al mecánico.
  - Los buckets de Storage son públicos y no tienen aislamiento por org.

### Paso 0 — consulta de verificación (solo lectura, en SQL Editor)
```sql
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef ORDER BY 1;
```

**Resultado en producción (2026-11-16):**
- `fn_audit_insert` tenía `anon=true`. C2 era más grave de lo previsto: cualquiera con la anon key pública podía escribir en el `audit_log`.
- Las funciones de trigger aparecen con `anon=true`, pero no se pueden invocar por RPC (devuelven `trigger`), así que no es un hallazgo.
- Después de los REVOKE aplicados a mano, `fn_importar_ot_historica` y `fn_audit_insert` quedaron con `anon=false`, `authenticated=false` y `service_role=true`.
- Los buckets `evidencias` y `branding` están confirmados con `public=true` (A2).

## CRÍTICO

### C1. `fn_importar_ot_historica` acepta cualquier org — ✅ Corregido en prod 2026-11-16 (pendiente migración 057)
- **Dónde:** `supabase/migrations/013_importar_ot_historica.sql:17-25`.
  - Es SECURITY DEFINER y recibe `p_org_id` y `p_user_id` como parámetros.
  - En `:135` solo hace `REVOKE ... FROM PUBLIC`.
- **Evidencia:**
  - No llama a `mi_org_id()` ni a `mi_rol()`.
  - En Supabase, `REVOKE FROM PUBLIC` no quita los grants directos a `anon` ni a `authenticated`.
- **Impacto:** quien tenga EXECUTE puede crear OTs cerradas, eventos, reparaciones e ítems en la org que elija, suplantando al usuario `p_user_id`. Corrompe el historial técnico.
  - Como mínimo, cualquier usuario logueado, incluido `mecanico`.
  - Si `anon` también tiene EXECUTE, cualquiera con la anon key pública.
- **Corrección:** `REVOKE ALL ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;`. Solo la usan los scripts de migración.

### C2. `fn_audit_insert` permite falsificar el audit_log — ✅ Corregido en prod 2026-11-16 (pendiente migración 057)
- **Confirmado en BD:** antes del arreglo tenía `anon=true`.
- **Dónde:** `001_initial_schema.sql:127-140`.
  - Es SECURITY DEFINER.
  - Ninguna migración entre 001 y 056 le hace REVOKE.
- **Evidencia:** inserta en `audit_log` con `p_actor_id`, `p_actor_rol` y `p_org_id` arbitrarios.
- **Impacto:**
  - Cualquiera con EXECUTE puede insertar entradas de auditoría falsas en cualquier org, haciéndose pasar por otro usuario.
  - Rompe el principio 6 (trazabilidad).
- **Corrección:** `REVOKE ALL ON FUNCTION fn_audit_insert(...) FROM PUBLIC, anon, authenticated;`. Solo la llaman triggers del mismo owner.

## ALTO

### A1. "Costos solo para gestión" se cumple solo en la UI
`puedeVerCostos` (`apps/web/src/app/(taller)/repair-orders/[id]/page.tsx:140`) solo oculta elementos de la interfaz. Un mecánico obtiene costos por estas vías:

1. **PostgREST con su propio JWT:**
   - `GET /rest/v1/repuestos?select=precio_costo`: columna en `004_inventory.sql:46`; la policy de `:196-198` no filtra por rol.
   - `GET /rest/v1/items_reparacion?select=costo_compra_unitario`: columna en `009:7`, policy en `003:1034-1039`. El comentario `003:1030` ("DT-1") lo reconoce y promete una `v_items_reparacion_mecanico` que nunca se creó.
   - `movimientos_stock.costo_unitario` (`004:81`, `:230`).
   - `presupuestos_tallergp`, con líneas y totales (`040:31-36`).
   - `ventas_mostrador` e `items_venta_mostrador` (`045:40-46`).
2. **RPC:** `fn_aceite_sugerido` (`055:8`, grant en `:92`) y `fn_filtros_sugeridos` (`056:8`, grant en `:95`).
   - Son DEFINER y no comprueban el rol.
   - Devuelven `costo_compra_unitario`.
   - También devuelven precios de `items_presupuesto`, una tabla que RLS le niega al mecánico.
3. **Payload RSC:** `apps/web/src/modules/reparaciones/queries.ts:12` selecciona `costo_compra_unitario` para todos los roles. El dato viaja serializado hasta `TrabajosSection`, un componente cliente.
4. **`/inventory` sin guard de rol:**
   - `app/(taller)/inventory/page.tsx` e `inventory/[id]` no verifican rol.
   - `RepuestoDetailClient.tsx:441-446` muestra costo, margen y valor de stock.

**Impacto:** un mecánico ve el costo de compra y el margen de cada repuesto y trabajo. Lo mismo valdría para `cliente_portal` si se activa.

**Corrección:**
- `REVOKE SELECT (precio_costo) ON repuestos FROM authenticated`, y lo mismo para `costo_compra_unitario` y `movimientos_stock.costo_unitario`.
- Exponer esas columnas a gestión con una vista o RPC que valide `mi_rol()`.
- Hacer que las RPC de sugeridos omitan los costos cuando el rol no es de gestión.
- Restringir por rol los SELECT de `presupuestos_tallergp` y de ventas.
- En la app, armar la query según el rol y agregar guard de rol en `/inventory`.

### A2. Storage: buckets públicos, listables y sin aislamiento por org
- **Dónde:**
  - `034_fotos_avance_ot.sql:28-41`, bucket `evidencias`: `public=true` y `SELECT TO public`; INSERT y DELETE solo exigen `bucket_id`.
  - `033_branding_storage.sql:9-30`, bucket `branding`, con el mismo esquema.
- **Impacto:**
  - Sin login, cualquiera puede listar y descargar todas las fotos, incluidas las no aprobadas (`visible_cliente=false`, flujo de la migración 047).
  - Cualquier usuario logueado, de cualquier rol u org, puede borrar o subir evidencias y reemplazar el logo de otro taller.
- **Corrección:**
  - Hacer privado el bucket `evidencias` y servir las fotos con signed URLs.
  - Policies con `(storage.foldername(name))[1] = mi_org_id()::text` y control de rol.
  - `branding`: lectura pública, escritura solo para el `admin` de su org.

### A3. El mecánico puede editar costos, precios y campos sensibles de la OT
- **Dónde:** `items_reparacion_update` (`003:1049-1056`) y `ordenes_trabajo_update` (`003:896-909`) solo exigen org y OT abierta.
- **Impacto:**
  - Vía API, el mecánico puede cambiar `costo_unitario` y `costo_compra_unitario`, falseando la utilidad.
  - También puede cambiar `estado`, `numero_ot`, `vehiculo_id` y `token_avance` de cualquier OT.
  - Además, `soft_delete` lo autoriza a borrar `ordenes_trabajo` (`004:290`).
- **Corrección:**
  - Un trigger BEFORE UPDATE que limite las columnas editables por rol, o RPCs para las acciones del mecánico.
  - Quitar `ordenes_trabajo` de la lista del mecánico en `soft_delete`.

## MEDIO

### M1. El trigger de stock no filtra por org
- **Dónde:**
  - `004:150-165` hace `UPDATE repuestos ... WHERE id = NEW.repuesto_id` sin filtrar por `org_id`.
  - `movimientos_stock_insert` (`004:234-239`) no valida que el repuesto pertenezca a la org.
- **Impacto:**
  - Con un UUID ajeno se altera el stock de otra org.
  - El mecánico puede registrar ajustes y salidas arbitrarios.
- **Corrección:**
  - Agregar `AND org_id = NEW.org_id` al trigger.
  - Validar el repuesto padre en la policy de INSERT.
  - Dejar los ajustes solo para gestión.

### M2. `soft_delete` deja pasar un rol NULL
- **Dónde:** `004:298`. Con `v_rol` NULL, `NOT (NULL = ANY(...))` da NULL y no lanza la excepción.
- **Corrección:** `IF v_rol IS NULL OR NOT (...)`.

### M3. Las FK padre no se validan entre orgs en varios INSERT y UPDATE
- **Dónde:**
  - INSERT sin validación del padre:
    - `evidencias_insert` (`003:1087`).
    - `propietarios_vehiculo` (`002:758`).
    - `reparaciones` (`003:1006`).
    - `eventos` (`002:818`).
    - `movimientos_financieros` (`027:92`).
    - `recomendaciones_vehiculo` (`041`).
  - UPDATE de `presupuestos` (`003:958`).
- **Impacto:**
  - Una fila puede apuntar a un cliente, vehículo u OT de otra org.
  - En ese caso, `fn_cotizacion_publica` y `fn_avance_ot` mostrarían datos ajenos por el link público.
- **Corrección:** triggers como `fn_validar_org_cargos_ot` (`005:476-499`).

### M4. `cliente_portal` lee todo el tenant (latente)
- **Dónde:**
  - Las policies SELECT sin filtro de rol de `002`, `003`, `004`, `040`, `041`, `044` y `045`.
  - La `v_clientes_portal` prometida en `002:643` no existe.
- **Impacto:** un usuario `cliente_portal` vería clientes, vehículos, OTs y costos de toda la org. Hoy es latente porque ese rol no se usa.
- **Corrección:** policies con listas explícitas de roles antes de activar el portal.

### M5. Los links públicos no expiran ni se pueden revocar
- **Dónde:** `token_publico` y `token_avance` (migraciones 019, 024, 025 y 046).
- **Impacto:**
  - Quien tenga un link reenviado puede autorizar la cotización y hacer avanzar la OT (`025:55-60`).
  - `fn_avance_ot` muestra fotos y notas de inspección (`046:73-76`) que no pasan por el flujo de aprobación de la 047.
  - `p_nota` no tiene límite de largo.
- **Nota:** los tokens son UUID v4, no enumerables.
- **Corrección:**
  - Agregar expiración y un botón para regenerar el token.
  - `length(p_nota) <= 500`.
  - Rate limit.

### M6. Sin headers de seguridad
- **Dónde:** `apps/web/next.config.ts` y `vercel.json`.
- **Impacto:** en `/cotizacion/*` y `/avance/*`:
  - El token puede filtrarse por la cabecera `Referer`.
  - El botón "Autorizar" queda expuesto a clickjacking.
- **Corrección:**
  - En esas rutas: `Referrer-Policy: no-referrer` y `frame-ancestors 'none'`.
  - Además: HSTS, `nosniff` y CSP.

### M7. Falta auditoría en tablas sensibles
- **Dónde:**
  - No hay trigger de auditoría en `ventas_mostrador`, `items_venta_mostrador`, `movimientos_financieros`, `entregas`, `configuracion_mano_obra`, `inspecciones_ot` ni `recomendaciones_vehiculo`.
  - El UPDATE directo de totales en ventas (`045:42-45`) no limita columnas.
  - `evidencias_delete` (`034:18-20`) hace DELETE físico sin auditoría.
- **Corrección:**
  - Agregar triggers de auditoría a esas tablas.
  - Reemplazar el UPDATE directo de ventas por una RPC de anulación.
  - Cambiar el borrado de evidencias a soft delete.

### M8. Las particiones de auditoría terminan el 2027-04-01
- **Dónde:**
  - `audit_log` y `transiciones_evento` tienen particiones hasta esa fecha (`001:455-456`, `:500-501`).
  - No hay partición DEFAULT.
- **Impacto:**
  - Desde esa fecha fallarán los INSERT en esas tablas.
  - También fallará toda escritura que dispare auditoría.
- **Corrección:**
  - Crear las particiones nuevas antes de esa fecha.
  - Al crearlas, repetir el REVOKE de `030:22-37`.

### M9. `/api/vehiculos/enriquecer` sin control de rol ni rate limit
- **Dónde:** `apps/web/src/app/api/vehiculos/enriquecer/route.ts:15-21` exige sesión, pero no verifica rol ni limita la tasa.
- **Impacto:** cualquier usuario logueado puede agotar la cuota pagada de GetAPI.cl.
- **Corrección:** chequeo de rol y rate limit.

## BAJO
- **L1.** `mi_org_id()` y `mi_rol()` (`001:62-87`) leen solo el JWT. Un usuario dado de baja sigue operando hasta que expire su token.
- **L2.** `fn_editar_detalle_foto` (`035:8-24`) valida la org pero no el rol. El texto editado aparece en el link público.
- **L3.** `GRANT ... DELETE ON movimientos_financieros TO authenticated` (`027:108`) sobra, porque no hay policy DELETE.
- **L4.** `usuarios_select` (`001:646`) expone el email y el teléfono de todo el personal a cualquier rol.
- **L5.** Datos que parecen reales en archivos versionados. Conviene reemplazarlos por datos sintéticos, aunque el historial los conserva:
  - RUT `16.218.807-0` en `apps/web/.../identificadores.test.ts:18` y `038:3`, con dígito verificador válido.
  - RUT `77406890-2` en `migration-toolkit/src/scripts/customer-report.ts:7`, también con DV válido.
  - VINs de la flota en `apps/web/tests/vin-year.test.ts:12-13`.
  - Patentes `SRDV88`, `HDCX10` y `PDFC21`.
- **L6.** UUIDs de org y usuario hardcodeados en los scripts Python de `migration-toolkit` (`importar-ots-masivo.py:17-18`). Facilitan explotar C1.
- **L7.** El middleware (`apps/web/src/lib/auth/middleware.ts`, cerca de la línea 36) falla abierto si faltan variables de entorno. RLS sigue protegiendo los datos.
- **L8.** `puedeVerCostos` incluye a `recepcionista` (`page.tsx:140`, `027:46`). Hay que confirmar en la Product Bible si recepción cuenta como "gestión".
- **L9.** Integridad:
  - Sin `chk_presupuestos_atribuible` (`049:12`) puede haber cotizaciones huérfanas.
  - Algunas FK usan `SET NULL` o `CASCADE`: `034:14`, `044:10`, `045:10/25/28` y `027:61-62`.
  - `fn_registrar_venta_mostrador` calcula el folio con `MAX+1` sin lock (`045:92`).
- **L11 (antes A4). Credencial de seed en el repo público.**
  - **Dónde:** `scripts/dev/seed-dev.mjs:30-31` y `scripts/dev/README.md:29` definen `admin@allmotors.local` con contraseña `Admin123!`.
  - **Verificado en BD (2026-11-16):** el usuario existe en producción con rol admin y su último login fue el 2026-10-29. Su contraseña ya no es `Admin123!`: `crypt` devolvió false. Por eso baja de Alto a Bajo.
  - **Pendiente:** que `seed-dev.mjs` exija `SEED_ADMIN_PASSWORD` y no traiga una contraseña por defecto.
- **L10.** Higiene del repo:
  - `.next/` y `package-lock` se commitearon en `ad02cb4` y `cea7a0b`. No contienen secretos, solo pesan.
  - Falta agregar `*.bak*` al `.gitignore`.

## Verificado sin hallazgo
- **Secretos en el historial:** no hay JWT, `sb_secret_`, `sbp_`, `sk-`, `ghp_` ni claves AKIA en `git log -p --all` ni en los blobs de `.next/`.
- **Archivos sensibles:** no hay `.env`, CSV, XLSX ni dumps en el historial, y el `.gitignore` es correcto.
- **App web:**
  - No hay service role en `apps/web` ni secretos en variables `NEXT_PUBLIC_*`.
  - No hay server actions.
  - No hay SSRF en los proveedores de enriquecimiento.
- **RLS:**
  - Está activo en las 38 tablas, sin policies `FOR ALL`.
  - `USING(true)` aparece solo en los catálogos `roles` y `tipos_evento_base`.
  - Todas las policies UPDATE fijan `org_id = mi_org_id()` en el WITH CHECK.
- **Vistas:** las 3 tienen `security_invoker` (`016`, `030:18-19`).
- **Funciones DEFINER:** todas tienen `SET search_path = public`.
- **Migración 049:** valida la org de cada referencia opcional.
- **Migraciones 050–056:** no abren policies nuevas.
- **RPC expuestas a `anon` a propósito:** `fn_cotizacion_publica`, `fn_responder_cotizacion` y `fn_avance_ot`, accesibles solo con un token UUID v4.

## Orden sugerido de corrección
1. ✅ C1 y C2 están corregidos en producción. Falta versionar la migración `057_revoke_rpc_internas.sql` para que el repo coincida con la base.
2. A2 (Storage) y A1 (costos en BD, RPC y app).
3. A3, M1 y M2: triggers y correcciones de una línea.
4. M8, antes de marzo de 2027.
5. M4, antes de activar `cliente_portal`. El resto de los Medios y Bajos, según la prioridad del negocio.
