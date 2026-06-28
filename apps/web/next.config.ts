import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@allmotors/ui',
    '@allmotors/database',
    '@allmotors/shared',
    '@allmotors/utils',
    '@allmotors/design-tokens',
  ],
  experimental: {
    // Activar cuando se necesite
  },
}

export default nextConfig
