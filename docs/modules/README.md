# Módulos del ERP — All Motors

Esta carpeta contiene la documentación específica de cada módulo implementado del ERP.

A diferencia del `ERP_MASTER_v1.0.md` (que describe el comportamiento funcional desde el punto de vista del negocio), los documentos en esta carpeta describen la **implementación** de cada módulo: estructura de archivos, contratos de API interna, decisiones de diseño específicas, y guías para desarrolladores.

---

## Convención de nombrado

Cada módulo tiene su propia subcarpeta:

```
modules/
├── reception/
│   └── README.md
├── repair-orders/
│   └── README.md
├── catalog/
│   └── README.md
├── inventory/
│   └── README.md
├── estimates/
│   └── README.md
├── invoicing/
│   └── README.md
├── warranties/
│   └── README.md
├── customers/
│   └── README.md
├── vehicles/
│   └── README.md
└── reports/
    └── README.md
```

---

## Estado actual

Esta carpeta está pendiente de ser poblada. Los módulos en producción son:

| Módulo | Estado de implementación | Documentación |
|---|---|---|
| Recepción | ✅ Implementado | Pendiente |
| Órdenes de Trabajo | ✅ Implementado | Pendiente |
| Catálogo de Servicios | ✅ Implementado (M007) | Pendiente |
| Inventario | ✅ Implementado (M004) | Pendiente |
| Presupuestos | ✅ Implementado | Pendiente |
| Facturación | 🕐 Stubs (no implementado) | — |
| Garantías | 🕐 Stubs | — |
| CRM | 🕐 Parcial | — |
| Vehículos | ✅ Implementado | Pendiente |
| Clientes | ✅ Implementado | Pendiente |

---

## Referencia

La especificación funcional de cada módulo está en:
`docs/erp-master/ERP_MASTER_v1.0.md`

La documentación en esta carpeta complementa el ERP_MASTER con el detalle de implementación; no lo reemplaza.
