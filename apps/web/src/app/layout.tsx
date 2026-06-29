// Root layout del App Router. Requerido por Next.js 15.
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'All Motors Cloud',
  description: 'ERP para talleres mecánicos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
