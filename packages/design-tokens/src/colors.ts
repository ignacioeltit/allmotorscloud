export const colors = {
  brand: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    900: '#1e3a5f',
  },
  success: { 500: '#22c55e', 600: '#16a34a' },
  warning: { 500: '#f59e0b', 600: '#d97706' },
  danger: { 500: '#ef4444', 600: '#dc2626' },
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    500: '#64748b',
    700: '#334155',
    900: '#0f172a',
  },
} as const

export type ColorToken = keyof typeof colors
