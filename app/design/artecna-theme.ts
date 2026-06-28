export const artecnaTheme = {
  dark: {
    background: '#020617',
    backgroundSoft: '#0f172a',
    surface: 'rgba(15, 23, 42, 0.72)',
    surfaceStrong: 'rgba(15, 23, 42, 0.9)',
    surfaceSoft: 'rgba(30, 41, 59, 0.68)',
    text: '#f8fafc',
    muted: '#94a3b8',
    border: 'rgba(148, 163, 184, 0.22)',
    primary: '#22c55e',
    primaryStrong: '#16a34a',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    purple: '#a855f7',
    radius: {
      sm: 12,
      md: 18,
      lg: 24,
      pill: 999,
    },
    shadow: {
      cockpit: '0 24px 70px rgba(15, 23, 42, 0.34)',
      glowGreen: '0 14px 35px rgba(34, 197, 94, 0.32)',
    },
  },

  light: {
    background: '#f8fafc',
    backgroundSoft: '#eef2ff',
    surface: '#ffffff',
    surfaceStrong: '#ffffff',
    surfaceSoft: '#f1f5f9',
    text: '#0f172a',
    muted: '#64748b',
    border: '#e2e8f0',
    primary: '#16a34a',
    primaryStrong: '#15803d',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    info: '#0891b2',
    purple: '#7e22ce',
    radius: {
      sm: 12,
      md: 18,
      lg: 24,
      pill: 999,
    },
    shadow: {
      cockpit: '0 18px 45px rgba(15, 23, 42, 0.12)',
      glowGreen: '0 12px 28px rgba(22, 163, 74, 0.22)',
    },
  },
} as const

export type ArtecnaThemeMode = keyof typeof artecnaTheme
export type ArtecnaTheme = (typeof artecnaTheme)[ArtecnaThemeMode]