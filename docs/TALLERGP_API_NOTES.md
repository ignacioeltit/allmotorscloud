# TallerGP API — Notas Técnicas

Última actualización: 2026-06-26

## URL Base
`https://api.tallergp.com`

## Autenticación
- **Tipo**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <ACCESS_TOKEN>`
- **Flujo OAuth2**: `POST /oauth/token` con `grant_type=client_credentials`
  - Body: `client_id`, `client_secret` (urlencoded)
  - Respuesta: `{ access_token, expires_in }`
- **Alternativa**: Token fijo generado desde el portal (sin flujo OAuth)
- **Portal de generación**: Cuenta TallerGP → Configuración → API → Acceso general

## Paginación
Todas las listas usan el mismo esquema:
```json
{
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total_count": 847,
    "total_pages": 85
  },
  "data": [...]
}
```
Parámetros de query: `?page=N&per_page=N`

## Rate Limits
Pendiente confirmar con documentación oficial. Por precaución usamos máx 3 req/seg.

## Endpoints GET confirmados (spec OpenAPI)

| Endpoint | Descripción |
|---|---|
| `GET /customers` | Lista clientes |
| `GET /customers/{id}` | Detalle cliente |
| `GET /customers/{id}/vehicles` | Vehículos del cliente |
| `GET /vehicles` | Lista vehículos |
| `GET /vehicles/{id}` | Detalle vehículo |
| `GET /repair-orders` | Lista órdenes de reparación |
| `GET /repair-orders/{entry_id}` | Detalle OT |
| `GET /budgets` | Lista presupuestos |
| `GET /budgets/{id}` | Detalle presupuesto |
| `GET /invoices` | Lista facturas |
| `GET /invoices/{id}` | Detalle factura |
| `GET /materials` | Lista materiales/inventario |
| `GET /materials/{id}` | Detalle material |
| `GET /materials/{id}/movements` | Movimientos de stock |
| `GET /suppliers` | Proveedores |
| `GET /employees` | Empleados |
| `GET /appointments` | Citas |
| `GET /brands` | Marcas |
| `GET /brands/{id}/models` | Modelos por marca |
| `GET /insurers` | Aseguradoras |
| `GET /purchase-delivery-notes` | Albaranes de compra |
| `GET /purchase-invoices` | Facturas de compra |
| `GET /tyres` | Neumáticos |

## Campos clave por entidad

Ver `src/api/tallergp/endpoints/*.ts` para los tipos TypeScript completos.

## Notas de uso
- El campo de ID en OTs es `entry_id` (no `id`)
- El campo de ID en presupuestos es `budget_id` (no `id`)
- Vehículo tiene `client_id` como FK al cliente
- OT tiene `client_id`, `vehicle_id` como FKs
