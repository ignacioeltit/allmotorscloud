// Botón con variantes. Presentacional: usable en Server y Client Components
// (el onClick lo provee el componente cliente que lo renderiza).
import { btnPrimary, btnSecondary, btnGhost, btnLarge } from './styles'

type Variant = 'primary' | 'secondary' | 'ghost' | 'large'

const variants: Record<Variant, string> = {
  primary: btnPrimary,
  secondary: btnSecondary,
  ghost: btnGhost,
  large: btnLarge,
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: React.ComponentProps<'button'> & { variant?: Variant }) {
  return <button type={type} className={`${variants[variant]} ${className}`} {...props} />
}
