export interface EntityConfig {
  key: string
  label: string
  endpoint: string
  idField: string
  detailPath: string | null
  listParams?: Record<string, string | number>
  notes?: string
}

export const ENTITIES: EntityConfig[] = [
  {
    key: 'customers',
    label: 'Clientes',
    endpoint: '/customers',
    idField: 'id',
    detailPath: '/customers/{id}',
  },
  {
    key: 'vehicles',
    label: 'Vehículos',
    endpoint: '/vehicles',
    idField: 'id',
    detailPath: '/vehicles/{id}',
  },
  {
    key: 'repair-orders',
    label: 'Órdenes de Reparación',
    endpoint: '/repair-orders',
    idField: 'entry_id',
    detailPath: '/repair-orders/{id}',
  },
  {
    key: 'budgets',
    label: 'Presupuestos',
    endpoint: '/budgets',
    idField: 'budget_id',
    detailPath: '/budgets/{id}',
  },
  {
    key: 'invoices',
    label: 'Facturas',
    endpoint: '/invoices',
    idField: 'invoice_id',
    detailPath: '/invoices/{id}',
  },
  {
    key: 'materials',
    label: 'Materiales / Inventario',
    endpoint: '/materials',
    idField: 'material_id',
    detailPath: '/materials/{id}',
  },
  {
    key: 'suppliers',
    label: 'Proveedores',
    endpoint: '/suppliers',
    idField: 'id',
    detailPath: '/suppliers/{id}',
  },
  {
    key: 'employees',
    label: 'Empleados',
    endpoint: '/employees',
    idField: 'id',
    detailPath: '/employees/{id}',
  },
  {
    key: 'appointments',
    label: 'Citas',
    endpoint: '/appointments',
    idField: 'id',
    detailPath: null,
    notes: 'Sin endpoint de detalle confirmado en OpenAPI spec',
  },
  {
    key: 'vehicle-intakes',
    label: 'Resguardos (Vehicle Intakes)',
    endpoint: '/vehicle-intakes',
    idField: 'intake_id',
    detailPath: '/vehicle-intakes/{id}',
  },
  {
    key: 'brands',
    label: 'Marcas',
    endpoint: '/brands',
    idField: 'id',
    detailPath: null,
    notes: 'Modelos disponibles en /brands/{id}/models',
  },
  {
    key: 'insurers',
    label: 'Aseguradoras',
    endpoint: '/insurers',
    idField: 'id',
    detailPath: null,
  },
  {
    key: 'purchase-delivery-notes',
    label: 'Albaranes de Compra',
    endpoint: '/purchase-delivery-notes',
    idField: 'id',
    detailPath: '/purchase-delivery-notes/{id}',
  },
  {
    key: 'purchase-invoices',
    label: 'Facturas de Compra',
    endpoint: '/purchase-invoices',
    idField: 'id',
    detailPath: '/purchase-invoices/{id}',
  },
  {
    key: 'tyres',
    label: 'Neumáticos',
    endpoint: '/tyres',
    idField: 'id',
    detailPath: null,
  },
]
