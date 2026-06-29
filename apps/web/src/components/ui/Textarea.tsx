import { inputClass } from './styles'

export function Textarea({ className = '', ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={`${inputClass} ${className}`} {...props} />
}
