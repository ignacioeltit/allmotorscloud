// Superficie base del tema oscuro. `padded` controla el padding interno (para tablas usar padded={false}).
export function Card({
  className = '',
  padded = true,
  ...props
}: React.ComponentProps<'div'> & { padded?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-white/[0.06] bg-neutral-900/50 ${padded ? 'p-5' : ''} ${className}`}
      {...props}
    />
  )
}
