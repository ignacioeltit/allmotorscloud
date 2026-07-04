// Detalle de Orden de Trabajo — vista operativa completa.
// 9 secciones: cabecera, acciones, cliente/vehículo, motivo, diagnóstico,
// trabajos, presupuesto, totales, historial.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { getOrdenTrabajoById } from '@/modules/repair-orders/queries'
import { getVehiculoById } from '@/modules/vehicles/queries'
import { getPropietarioActivoByVehiculo } from '@/modules/customers/queries'
import { listEventosByOrdenTrabajo, getTipoEventoBySlug } from '@/modules/events/queries'
import { getHistoriaByVehiculoId } from '@/modules/technical-history/queries'
import { listReparacionesByOT } from '@/modules/reparaciones/queries'
import { getPresupuestoActivoByOT } from '@/modules/estimates/queries'
import { getCitasActivasPorVehiculo } from '@/modules/agenda/queries'
import { listMecanicosByOrg } from '@/modules/users/queries'
import { getConfiguracionManoObra } from '@/modules/taller/queries'
import { getOrganizacion } from '@/modules/org/queries'
import { getEntregaByOT, getTotalesOT } from '@/modules/entregas/queries'
import { load } from '@/lib/ui/load'
import { Notice } from '@/components/ui/Notice'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { OrdenTrabajoActions } from '@/components/repair-orders/OrdenTrabajoActions'
import { KmIngresoInline } from '@/components/repair-orders/KmIngresoInline'
import { DiagnosticoSection } from '@/components/repair-orders/DiagnosticoSection'
import { EntregaSection } from '@/components/repair-orders/EntregaSection'
import { TrabajosSection } from '@/components/repair-orders/TrabajosSection'
import { PresupuestoSection } from '@/components/repair-orders/PresupuestoSection'
import { OtTabs, type OtTab } from '@/components/repair-orders/OtTabs'
import { card, sectionLabel, linkClass } from '@/components/ui/styles'

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtCLP(n: number): string {
  return n.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  })
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-neutral-600">{label}</p>
      <p className="mt-0.5 text-sm text-neutral-200">{value || '—'}</p>
    </div>
  )
}

export default async function OrdenTrabajoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab: tabInicial } = await searchParams

  const result = await load(async () => {
    const supabase = await createClient()

    const { rol } = await getAuthContext(supabase)
    const orden = await getOrdenTrabajoById(supabase, id)
    const [vehiculo, cliente, eventos, historia, tipoEvento, tipoDiagnostico, reparaciones, presupuesto, mecanicos, configuracion, taller, citasActivas] =
      await Promise.all([
        getVehiculoById(supabase, orden.vehiculo_id),
        getPropietarioActivoByVehiculo(supabase, orden.vehiculo_id),
        listEventosByOrdenTrabajo(supabase, orden.id),
        getHistoriaByVehiculoId(supabase, orden.vehiculo_id),
        getTipoEventoBySlug(supabase, 'reparacion'),
        getTipoEventoBySlug(supabase, 'diagnostico'),
        listReparacionesByOT(supabase, orden.id),
        getPresupuestoActivoByOT(supabase, orden.id),
        listMecanicosByOrg(supabase),
        getConfiguracionManoObra(supabase),
        getOrganizacion(supabase),
        getCitasActivasPorVehiculo(supabase, [orden.vehiculo_id]),
      ])
    const [entrega, totales] = await Promise.all([
      getEntregaByOT(supabase, orden.id),
      getTotalesOT(supabase, orden.id),
    ])

    return { orden, vehiculo, cliente, eventos, historia, tipoEvento, tipoDiagnostico, reparaciones, presupuesto, mecanicos, configuracion, taller, citasActivas, entrega, totales, rol }
  })

  if (!result.ok) {
    return (
      <div>
        <Notice tone={result.isAuth ? 'warning' : 'error'} title={result.error}>
          {result.isAuth
            ? 'Inicia sesión para ver la OT.'
            : 'No se pudo cargar la orden de trabajo.'}
        </Notice>
        <p className="mt-4">
          <Link href="/dashboard" className={linkClass}>
            ← Volver al dashboard
          </Link>
        </p>
      </div>
    )
  }

  const { orden, vehiculo, cliente, eventos, historia, tipoEvento, tipoDiagnostico, reparaciones, presupuesto, mecanicos, configuracion, taller, citasActivas, entrega, totales, rol } =
    result.data

  // Costos (compra, utilidad, margen) solo para admin, jefe de taller y asesor
  // de servicio (recepción). Los mecánicos NO ven costos ni rentabilidad.
  const puedeVerCostos = rol === 'admin' || rol === 'jefe_taller' || rol === 'recepcionista'

  const diagnosticos = tipoDiagnostico
    ? eventos.filter((e) => e.tipo_evento_id === tipoDiagnostico.id).reverse()
    : []

  const recepcionEvento =
    eventos.find((e) => e.titulo?.toLowerCase().includes('recepci')) ??
    eventos[eventos.length - 1]

  const vehiculoLabel = vehiculo
    ? [vehiculo.patente, vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' · ')
    : null
  const citaActivaVehiculo = citasActivas[orden.vehiculo_id] ?? null

  // Totales desde reparaciones cargadas (evita un query extra)
  let totalMO = 0
  let totalRep = 0
  let totalOtros = 0
  let costoCompra = 0 // lo que costó comprar los repuestos (no lo que se cobra)
  for (const rep of reparaciones) {
    for (const item of rep.items) {
      if (item.tipo === 'mano_obra') totalMO += item.costo_total
      else if (item.tipo === 'otros') totalOtros += item.costo_total
      else totalRep += item.costo_total
      if (item.tipo === 'repuesto') costoCompra += (item.costo_compra_unitario ?? 0) * item.cantidad
    }
  }
  const totalOT = totalMO + totalRep + totalOtros
  const utilidad = totalOT - costoCompra
  const margen = totalOT > 0 ? Math.round((utilidad / totalOT) * 100) : 0

  // Indicadores para las pestañas
  const presupuestoPendiente =
    presupuesto != null && (presupuesto.estado === 'borrador' || presupuesto.estado === 'enviado')
  const entregaLista = orden.estado === 'lista_para_entrega'

  const tabs: OtTab[] = [
    {
      id: 'resumen',
      label: 'Resumen',
      content: (
        <div className="space-y-6">
          {/* ── Cliente + Vehículo ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className={card}>
              <p className={sectionLabel}>Cliente</p>
              {cliente ? (
                <div className="mt-3 space-y-3">
                  <p className="text-base font-semibold text-neutral-50">{cliente.nombre}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Info label="RUT" value={cliente.rut} />
                    <Info label="Teléfono" value={cliente.telefono} />
                    <Info label="Email" value={cliente.email} />
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-neutral-500">Sin propietario asignado.</p>
              )}
            </section>

            <section className={card}>
              <p className={sectionLabel}>Vehículo</p>
              <div className="mt-3 space-y-3">
                <p className="text-base font-semibold tracking-wide text-neutral-50">
                  {vehiculo.patente}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Marca" value={vehiculo.marca} />
                  <Info label="Modelo" value={vehiculo.modelo} />
                  <Info label="Año" value={vehiculo.anio?.toString()} />
                  <Info label="Color" value={vehiculo.color} />
                  <Info label="VIN" value={vehiculo.vin} />
                </div>
              </div>
            </section>
          </div>

          {/* ── Motivo cliente ── */}
          {(orden.notas || recepcionEvento?.descripcion) && (
            <section className={card}>
              <p className={sectionLabel}>Motivo de ingreso</p>
              {orden.notas && (
                <p className="mt-3 text-sm leading-relaxed text-neutral-200">{orden.notas}</p>
              )}
              {recepcionEvento?.descripcion && (
                <div className={orden.notas ? 'mt-4 border-t border-black/[0.06] pt-3' : 'mt-3'}>
                  <p className={`${sectionLabel} mb-2`}>Detalle de recepción</p>
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-neutral-400">
                    {recepcionEvento.descripcion}
                  </pre>
                </div>
              )}
            </section>
          )}

          {/* ── Diagnóstico del mecánico ── */}
          <DiagnosticoSection
            ordenTrabajoId={orden.id}
            historiaId={historia.id}
            tipoEventoDiagnosticoId={tipoDiagnostico?.id ?? null}
            estadoOT={orden.estado}
            diagnosticos={diagnosticos}
            mecanicos={mecanicos}
          />
        </div>
      ),
    },
    {
      id: 'trabajos',
      label: 'Trabajos',
      badge: reparaciones.length || null,
      content: (
        <div className="space-y-6">
          {/* ── Trabajos (Client Component con formularios) ──
               El estado de compra de cada repuesto (En taller / Por comprar /
               Comprado / Recibido) y su costo se gestionan inline en cada ítem.
               Las acciones de compra (orden imprimible / WhatsApp) van al pie. */}
          <TrabajosSection
            ordenTrabajoId={orden.id}
            historiaId={historia.id}
            tipoEventoReparacionId={tipoEvento?.id ?? null}
            initialReparaciones={reparaciones}
            mecanicos={mecanicos}
            configuracion={configuracion}
            motivoOT={orden.notas}
            puedeVerCostos={puedeVerCostos}
            numeroOt={orden.numero_ot}
            vehiculoLabel={vehiculoLabel}
          />

          {/* ── Totales de trabajos registrados ── */}
          {totalOT > 0 && (
            <section className="rounded-xl border border-black/[0.06] bg-neutral-900/30 px-5 py-4">
              <p className={`${sectionLabel} mb-3`}>Totales de trabajos</p>
              <div className={`grid gap-4 ${totalOtros > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <div>
                  <p className="text-[11px] text-neutral-600 uppercase tracking-wider">Mano de obra</p>
                  <p className="mt-0.5 text-sm font-semibold text-neutral-200">{fmtCLP(totalMO)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-neutral-600 uppercase tracking-wider">Repuestos</p>
                  <p className="mt-0.5 text-sm font-semibold text-neutral-200">{fmtCLP(totalRep)}</p>
                </div>
                {totalOtros > 0 && (
                  <div>
                    <p className="text-[11px] text-neutral-600 uppercase tracking-wider">Otros</p>
                    <p className="mt-0.5 text-sm font-semibold text-neutral-200">{fmtCLP(totalOtros)}</p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] text-neutral-600 uppercase tracking-wider">Total</p>
                  <p className="mt-0.5 text-base font-bold text-accent-400">{fmtCLP(totalOT)}</p>
                </div>
              </div>
            </section>
          )}
        </div>
      ),
    },
    {
      id: 'presupuesto',
      label: 'Presupuesto',
      alert: presupuestoPendiente,
      content: (
        <PresupuestoSection
          ordenTrabajoId={orden.id}
          initialPresupuesto={presupuesto}
          tallerNombre={taller?.nombre ?? 'el taller'}
          clienteNombre={cliente?.nombre ?? null}
          clienteTelefono={cliente?.telefono ?? null}
          vehiculoLabel={vehiculoLabel}
          citaActiva={citaActivaVehiculo}
          historiaId={historia?.id ?? null}
          tipoEventoReparacionId={tipoEvento?.id ?? null}
          yaEnTrabajos={
            presupuesto != null &&
            reparaciones.some((r) =>
              r.items.some(
                (i) =>
                  i.item_presupuesto_id != null &&
                  presupuesto.items.some((pi) => pi.id === i.item_presupuesto_id),
              ),
            )
          }
        />
      ),
    },
    {
      id: 'entrega',
      label: 'Entrega y cobro',
      alert: entregaLista,
      content: (
        <div className="space-y-6">
          {/* ── Costos y rentabilidad (solo admin / jefe / asesor) ── */}
          {puedeVerCostos && totalOT > 0 && (
            <section className="rounded-xl border border-black/[0.06] bg-neutral-900/30 px-5 py-4">
              <p className={`${sectionLabel} mb-3`}>Costos y rentabilidad</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-neutral-600">Venta (neto)</p>
                  <p className="mt-0.5 text-sm font-semibold text-neutral-200">{fmtCLP(totalOT)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-neutral-600">Costo compra repuestos</p>
                  <p className="mt-0.5 text-sm font-semibold text-neutral-200">{fmtCLP(costoCompra)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-neutral-600">Utilidad</p>
                  <p className={`mt-0.5 text-base font-bold ${utilidad >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtCLP(utilidad)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-neutral-600">Margen</p>
                  <p className="mt-0.5 text-base font-bold text-neutral-100">{margen}%</p>
                </div>
              </div>
              {costoCompra === 0 && (
                <p className="mt-2 text-xs text-neutral-500">
                  Aún no ingresas costos de compra de repuestos (sección «Repuestos y compras»). La
                  utilidad no descuenta esos costos todavía.
                </p>
              )}
            </section>
          )}

          {/* ── Entrega y comprobante ── */}
          <EntregaSection
            ordenTrabajoId={orden.id}
            estadoOT={orden.estado}
            entrega={entrega}
            totales={totales}
          />
        </div>
      ),
    },
    {
      id: 'historial',
      label: 'Historial',
      content: (
        <section>
          <p className={sectionLabel}>Historial de la OT</p>
          {eventos.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-600">Sin eventos registrados.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {eventos.map((ev) => (
                <li key={ev.id} className={`${card} flex items-start gap-4 py-3`}>
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-neutral-100">{ev.titulo ?? 'Evento'}</p>
                      <span className="shrink-0 text-xs text-neutral-600">{fmt(ev.creado_en)}</span>
                    </div>
                    {ev.descripcion && (
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{ev.descripcion}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      ),
    },
  ]

  return (
    <div className="space-y-6">

      {/* ── Cabecera ── */}
      <div>
        <Link href="/dashboard" className={`${linkClass} text-sm`}>
          ← Dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">
                {orden.numero_ot}
              </h1>
              <StatusBadge estado={orden.estado} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-neutral-600">
              <span>Abierta {fmt(orden.creado_en)}</span>
              {orden.km_ingreso != null ? (
                <span>Km ingreso: {orden.km_ingreso.toLocaleString('es-CL')}</span>
              ) : orden.estado !== 'cerrada' && orden.estado !== 'cancelada' ? (
                <KmIngresoInline ordenId={orden.id} />
              ) : null}
              {orden.fecha_prometida_entrega && (
                <span>Entrega prometida: {orden.fecha_prometida_entrega}</span>
              )}
              {orden.cerrado_en && <span>Cerrada: {fmt(orden.cerrado_en)}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href={`/repair-orders/${orden.id}/imprimir`}
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-3.5 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-black/[0.06]"
            >
              🖨 Imprimir OT
            </Link>
            <Link href={`/vehicles/${orden.vehiculo_id}`} className={`${linkClass} text-sm`}>
              Ver ficha vehículo →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Acciones ── */}
      <div className="rounded-xl border border-black/[0.06] bg-neutral-900/50 p-4">
        <p className={`${sectionLabel} mb-2.5`}>Acciones</p>
        <OrdenTrabajoActions id={orden.id} estado={orden.estado} vehiculoId={orden.vehiculo_id} />
      </div>

      <OtTabs tabs={tabs} initial={tabInicial} />
    </div>
  )
}
