// Raíz: redirige al dashboard del taller.
import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/dashboard')
}
