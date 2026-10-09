// ─── Smile Genius Go — design tokens ─────────────────────────────────────────
// Single source of truth for colour. Light values are the web portals' palette
// (#4D8EF7 brand, #A59DFF lavender, #030213 ink, #E0E0E6 line); dark values are
// derived from the same hues. NativeWind classes read them as CSS variables
// (see ThemeRoot → vars()), and JS-only colour props (gradients, icons, pickers)
// read the hex values through useTheme().

export type ThemeName = 'light' | 'dark';

/** RGB channels, as in the web app's go.css. */
const RGB = {
  light: {
    bg: [246, 247, 251], surface: [255, 255, 255], raised: [248, 249, 252], line: [224, 224, 230],
    ink: [3, 2, 19], ink2: [90, 85, 104], muted: [113, 113, 130], faint: [160, 160, 176],
    brand: [77, 142, 247], 'brand-ink': [21, 101, 192], 'brand-soft': [238, 244, 255],
    lav: [165, 157, 255], violet: [124, 58, 237], 'violet-soft': [245, 243, 255],
    ok: [21, 128, 61], 'ok-soft': [240, 253, 244], warn: [180, 83, 9], 'warn-soft': [255, 247, 237],
    bad: [212, 24, 61], 'bad-soft': [255, 241, 242], teal: [0, 131, 143], 'teal-soft': [224, 247, 250],
    pink: [190, 24, 93], 'pink-soft': [253, 242, 248], shadow: [16, 24, 64], g1: [77, 142, 247], g2: [165, 157, 255],
  },
  dark: {
    bg: [7, 7, 16], surface: [16, 16, 30], raised: [23, 23, 41], line: [38, 38, 58],
    ink: [242, 242, 250], ink2: [200, 200, 216], muted: [150, 150, 172], faint: [96, 96, 120],
    brand: [107, 162, 255], 'brand-ink': [150, 190, 255], 'brand-soft': [22, 34, 64],
    lav: [178, 170, 255], violet: [180, 150, 255], 'violet-soft': [33, 26, 64],
    ok: [74, 222, 128], 'ok-soft': [14, 42, 28], warn: [251, 191, 36], 'warn-soft': [48, 34, 10],
    bad: [251, 113, 133], 'bad-soft': [54, 16, 28], teal: [45, 212, 191], 'teal-soft': [10, 42, 44],
    pink: [244, 114, 182], 'pink-soft': [54, 18, 40], shadow: [0, 0, 0], g1: [66, 120, 236], g2: [128, 112, 240],
  },
} as const satisfies Record<ThemeName, Record<string, readonly [number, number, number]>>;

export type TokenName = keyof typeof RGB.light;
export type Palette = Record<TokenName, string>;

const hex = ([r, g, b]: readonly number[]) => `#${[r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/** Hex colours per theme, for JS colour props. */
export const PALETTE: Record<ThemeName, Palette> = {
  light: Object.fromEntries(Object.entries(RGB.light).map(([k, v]) => [k, hex(v)])) as Palette,
  dark: Object.fromEntries(Object.entries(RGB.dark).map(([k, v]) => [k, hex(v)])) as Palette,
};

/** `rgba()` for a token with an alpha, e.g. alpha('brand', .15, 'light'). */
export const alpha = (name: TokenName, a: number, theme: ThemeName) => {
  const [r, g, b] = RGB[theme][name];
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/** CSS variables for NativeWind's vars(): { '--go-bg': '246 247 251', … } */
export const cssVars = (theme: ThemeName) =>
  Object.fromEntries(Object.entries(RGB[theme]).map(([k, v]) => [`--go-${k}`, v.join(' ')]));

/** Status chip gradients (Home tiles) — vivid in both themes. [light top-left, deep]. */
export const CHIP = {
  overdue: ['#FB7185', '#E11D48'],
  ready: ['#FBBF24', '#EA580C'],
  'on-hold': ['#A78BFA', '#6D28D9'],
  draft: ['#60A5FA', '#2563EB'],
  'not-approved': ['#F472B6', '#BE185D'],
  'date-changed': ['#2DD4BF', '#0D9488'],
} as const;

/** Type scale, radii and motion — see design/tokens.json in the web handover. */
export const RADIUS = { md: 12, lg: 16, card: 22, tabBar: 26, sheet: 30 } as const;
