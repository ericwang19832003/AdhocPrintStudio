// Typed mirror of tokens.css for code that needs values in JS.
// Keep in sync with tokens.css.

export const tokens = {
  color: {
    ink: {
      900: "#0b1220", 700: "#1f2937", 500: "#4b5563",
      300: "#9ca3af", 150: "#e5e7eb",  50: "#f8fafc",
    },
    accent: {
      base:  "#b3502f", hover: "#9a4326",
      ink:   "#7a3318", soft:  "#fdeee6",
    },
    status: {
      success: "#0f7a55", warn: "#b45309",
      danger:  "#b42318", info: "#1d5fbe",
    },
    text: {
      primary:   "#0b1220", secondary: "#4b5563",
      muted:     "#9ca3af", inverse:   "#ffffff",
    },
    surface: {
      page:    "#f8fafc", card:    "#ffffff",
      sunken:  "#e5e7eb", overlay: "rgba(11, 18, 32, 0.55)",
    },
    border: { subtle: "#e5e7eb", strong: "#9ca3af" },
  },
  space:  { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },
  radius: { xs: 4, sm: 6, md: 8, lg: 12, pill: 999 },
  shadow: {
    sm: "0 1px 2px rgba(11, 18, 32, 0.06), 0 1px 1px rgba(11, 18, 32, 0.04)",
    md: "0 6px 16px rgba(11, 18, 32, 0.08), 0 2px 4px rgba(11, 18, 32, 0.04)",
    lg: "0 24px 48px rgba(11, 18, 32, 0.18), 0 8px 16px rgba(11, 18, 32, 0.08)",
  },
  fontSize:   { xs: 11, sm: 12, base: 13, md: 14, lg: 16, xl: 20, "2xl": 28 },
  lineHeight: { xs: 16, sm: 16, base: 18, md: 20, lg: 22, xl: 26, "2xl": 34 },
  motion:     { fast: 120, base: 180, slow: 280 },
  ease: {
    standard:   "cubic-bezier(0.2, 0, 0, 1)",
    emphasized: "cubic-bezier(0.3, 0, 0, 1.2)",
  },
  focusRing: { color: "#b3502f", width: 2, offset: 2 },
} as const;
