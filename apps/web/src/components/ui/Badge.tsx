import { badge } from './styles'

export function Badge({ className = '', ...props }: React.ComponentProps<'span'>) {
  return <span className={`${badge} ${className}`} {...props} />
}
