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
      },
    },
  },
  plugins: [],
}

export default config
