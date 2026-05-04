// lib/tokens.js — JS-side design tokens (autocomplete + refactor-safe)
// Source of truth for values: css.js (:root). This file mirrors them for JS usage.
// Squad colors (constants.js) are DATA, not tokens — intentionally excluded.

export const C = {
  bg: "var(--bg)", bg2: "var(--bg2)", bg3: "var(--bg3)", bg4: "var(--bg4)",
  tx: "var(--tx)", tx2: "var(--tx2)", tx3: "var(--tx3)", border: "var(--border)",
  red: "var(--red)", green: "var(--green)", yellow: "var(--yellow)",
  orange: "var(--orange)", blue: "var(--blue)", purple: "var(--purple)",
  cyan: "var(--cyan)", pink: "var(--pink)",
  shadow: "var(--shadow)", shadowLg: "var(--shadow-lg)",
};

export const TS = {
  "2xs": "var(--ts-2xs)", xs: "var(--ts-xs)", sm: "var(--ts-sm)",
  base: "var(--ts-base)", md: "var(--ts-md)", lg: "var(--ts-lg)",
  xl: "var(--ts-xl)", display: "var(--ts-display)", hero: "var(--ts-hero)",
};

export const R = {
  "2xs": "var(--r-2xs)", xs: "var(--r-xs)", sm: "var(--r-sm)",
  default: "var(--r)", lg: "var(--r-lg)", full: "var(--r-full)",
};

export const F = {
  mono: "var(--mono)",
  sans: "var(--sans)",
};
