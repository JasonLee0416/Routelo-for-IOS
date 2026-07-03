// LUCENT design tokens — a functional-glass system for Routelo.
// Radius + glass strength are managed as semantic tokens so every control layer
// references a token, never a raw number. Colors live in the app Palette
// (LIGHT/DARK), which mirror iOS system colors.

// ---- RADIUS (Apple-style continuous-corner scale) ----
export const RADIUS = {
  none: 0,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  pill: 999,
  // semantic
  smallButton: 12,
  button: 16,
  largeButton: 20,
  chip: 999,
  input: 16,
  searchBar: 20,
  card: 24,
  glassCard: 28,
  modal: 32,
  bottomSheet: 32,
  floatingNav: 36,
  fab: 999,
} as const;

// Apple concentric rule: childRadius = parentRadius - padding.
export const concentricRadius = (parentRadius: number, padding: number) =>
  Math.max(0, parentRadius - padding);

// ---- GLASS STRENGTH (semantic, mirrors SwiftUI .glassEffect tiers) ----
export type GlassStrength =
  | 'none'
  | 'subtle'
  | 'regular'
  | 'prominent'
  | 'clear';

export type GlassRecipe = {
  blur: number;
  bgOpacity: number;
  tintOpacity: number;
  strokeOpacity: number;
  shadowOpacity: number;
  highlightOpacity: number;
};

// 'none' is a solid surface (no recipe) — used for important data cards.
export const GLASS: Record<Exclude<GlassStrength, 'none'>, GlassRecipe> = {
  subtle: {
    blur: 12,
    bgOpacity: 0.72,
    tintOpacity: 0.06,
    strokeOpacity: 0.16,
    shadowOpacity: 0.1,
    highlightOpacity: 0.1,
  },
  regular: {
    blur: 20,
    bgOpacity: 0.58,
    tintOpacity: 0.1,
    strokeOpacity: 0.22,
    shadowOpacity: 0.16,
    highlightOpacity: 0.16,
  },
  prominent: {
    blur: 28,
    bgOpacity: 0.46,
    tintOpacity: 0.14,
    strokeOpacity: 0.3,
    shadowOpacity: 0.24,
    highlightOpacity: 0.22,
  },
  clear: {
    blur: 36,
    bgOpacity: 0.28,
    tintOpacity: 0.08,
    strokeOpacity: 0.34,
    shadowOpacity: 0.28,
    highlightOpacity: 0.28,
  },
};

// Which glass strength each control layer uses by default.
export const GLASS_ROLE = {
  search: 'subtle',
  toolbar: 'regular',
  modal: 'regular',
  bottomSheet: 'regular',
  filterChip: 'regular',
  bottomNav: 'prominent',
  fab: 'prominent',
  decorative: 'clear',
  contentCard: 'none',
} as const satisfies Record<string, GlassStrength>;
