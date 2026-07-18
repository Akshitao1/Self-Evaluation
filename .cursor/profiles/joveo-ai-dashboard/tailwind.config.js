const { fontFamily } = require("tailwindcss/defaultTheme");
const designSystem = require("./design.json");

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        'joveo': {
          header: designSystem.designTokens.colors.primary.header,
          blue: designSystem.designTokens.colors.primary.blue,
          'secondary-blue': designSystem.designTokens.colors.primary.secondaryBlue,
          success: designSystem.designTokens.colors.primary.success,
          text: designSystem.designTokens.colors.primary.text,
          content: designSystem.designTokens.colors.primary.content,
        },
        'chart': {
          primary: designSystem.designTokens.colors.charts.primary,
          secondary: designSystem.designTokens.colors.charts.secondary,
          accent: designSystem.designTokens.colors.charts.accent,
        },
        'status': {
          success: designSystem.designTokens.colors.status.success,
          warning: designSystem.designTokens.colors.status.warning,
        }
      },
      fontFamily: {
        'sf-pro': [designSystem.designTokens.typography.fontFamily.primary, ...fontFamily.sans],
      },
      fontSize: {
        'joveo': {
          h1: designSystem.designTokens.typography.styles.h1.fontSize,
          h2: designSystem.designTokens.typography.styles.h2.fontSize,
          h3: designSystem.designTokens.typography.styles.h3.fontSize,
          body: designSystem.designTokens.typography.styles.body.fontSize,
          label: designSystem.designTokens.typography.styles.label.fontSize,
        }
      },
      lineHeight: {
        'joveo': {
          h1: designSystem.designTokens.typography.styles.h1.lineHeight,
          h2: designSystem.designTokens.typography.styles.h2.lineHeight,
          h3: designSystem.designTokens.typography.styles.h3.lineHeight,
          body: designSystem.designTokens.typography.styles.body.lineHeight,
          label: designSystem.designTokens.typography.styles.label.lineHeight,
        }
      },
      spacing: designSystem.designTokens.spacing.scale,
    },
  },
}
