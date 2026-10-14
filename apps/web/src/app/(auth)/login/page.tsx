// Ruta /login — inicio de sesión con panel de marca (oscuro) + formulario.
import { LoginForm } from '@/components/forms/LoginForm'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Panel de marca */}
      <div
        className="relative flex flex-col items-center justify-center gap-7 px-8 py-12 md:w-1/2 md:py-0"
        style={{
          backgroundColor: '#111417',
          backgroundImage:
            'radial-gradient(120% 90% at 50% 0%, rgba(249,115,22,0.10), transparent 60%), radial-gradient(80% 80% at 80% 100%, rgba(255,255,255,0.05), transparent 55%)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-allmotors.jpg"
          alt="All Motors — Servicio Automotriz"
          className="w-56 max-w-[72%] rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-white/10 md:w-80"
        />
        <div className="text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-neutral-400">
            Servicio Automotriz
          </p>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-neutral-500">
            Gestión profesional de tu taller: órdenes de trabajo, presupuestos y clientes en un solo lugar.
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <LoginForm />
      </div>
    </div>
  )
}
