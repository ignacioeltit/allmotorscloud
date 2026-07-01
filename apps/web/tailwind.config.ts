import type { Config } from 'tailwindcss'
import { colors } from '@allmotors/design-tokens'

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        success: colors.success,
        warning: colors.warning,
        danger: colors.danger,
        // Escala de acento — ámbar/naranja (tema claro "acero de taller").
        // 300/400 se usan como texto (links, badges) sobre fondo claro, por eso
        // son más oscuros que 500/600 (fondos sólidos de botón).
        accent: {
          200: '#7c2d12',
          300: '#9a3412',
          400: '#c2410c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          950: '#431407',
        },
        // Paleta neutral invertida para el tema claro "acero de taller":
        // los mismos nombres de clase (bg-neutral-950, text-neutral-100, etc.)
        // que antes daban un tema oscuro ahora resuelven a un tema claro,
        // sin tener que tocar cada componente que ya usa estas clases.
        //   950/900 → superficies (950 = fondo de página gris acero, 900 = tarjetas claras)
        //   50-700  → texto, de más a menos prominente
        neutral: {
          50: '#0a0a0b',
          100: '#18181b',
          200: '#27272a',
          300: '#3f3f46',
          400: '#52525b',
          500: '#71717a',
          600: '#94949c',
          700: '#b4b4ba',
          900: '#f6f7f8',
          950: '#d9dce0',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}

export default config
