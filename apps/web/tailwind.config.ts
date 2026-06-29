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
        // Escala de acento completa para el tema oscuro (DMS). Independiente de
        // design-tokens.brand (que solo trae algunos tonos) para usar accent-400/500/600 libremente.
        accent: {
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          950: '#172554',
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
