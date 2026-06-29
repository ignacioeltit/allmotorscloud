// Layout del ERP del taller. El middleware protege estas rutas; RLS protege los datos.
import { AppShell } from '@/components/shell/AppShell'

export default function TallerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
