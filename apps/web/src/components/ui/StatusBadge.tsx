// Badge de estado de OT, con color y etiqueta legible según el estado del dominio.
import { otEstadoBadge, otEstadoLabel } from './styles'

export function StatusBadge({ estado }: { estado: string }) {
  return <span className={otEstadoBadge(estado)}>{otEstadoLabel(estado)}</span>
}
