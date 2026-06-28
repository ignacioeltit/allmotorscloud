// Punto de entrada del paquete database.
// Exporta clientes, tipos generados y tipos de dominio.
// NUNCA importar client/server desde un componente cliente de Next.js.
// NUNCA importar client/browser desde un Server Component.

export * from './schema/index'
// Los clientes se importan desde sus rutas específicas para evitar
// importar cookies() (Node) en contextos que no lo soportan.
