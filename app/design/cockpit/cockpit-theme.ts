import { artecnaTheme } from '../artecna-theme'

const dark = artecnaTheme.dark
const light = artecnaTheme.light

export const cockpitTheme = {
  dark: {
    container: {
      background:
        'radial-gradient(circle at top left, #0f766e 0, #020617 34%, #020617 100%)',
      color: dark.text,
      border: `1px solid ${dark.border}`,
      borderRadius: dark.radius.lg,
      boxShadow: dark.shadow.cockpit,
      padding: 18,
    },

    mainCard: {
      background: dark.surfaceStrong,
      borderRadius: dark.radius.lg,
      color: dark.text,
    },

    miniCard: {
      background: dark.surface,
      borderRadius: dark.radius.md,
      color: dark.text,
    },
  },

  light: {
    container: {
      background: light.background,
      color: light.text,
      border: `1px solid ${light.border}`,
      borderRadius: light.radius.lg,
      boxShadow: light.shadow.cockpit,
      padding: 18,
    },

    mainCard: {
      background: light.surfaceStrong,
      borderRadius: light.radius.lg,
      color: light.text,
    },

    miniCard: {
      background: light.surface,
      borderRadius: light.radius.md,
      color: light.text,
    },
  },
} as const