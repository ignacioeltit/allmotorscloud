import { inputClass } from './styles'

export function Input({ className = '', ...props }: React.ComponentProps<'input'>) {
  return <input className={`${inputClass} ${className}`} {...props} />
}
