// ─── Theme root ──────────────────────────────────────────────────────────────
// Sets the go-* CSS variables for the whole app (NativeWind vars()), exposes the
// hex palette to JS via useTheme(), and paints the app background: go-bg with a
// very light lavender / blue glow rising from the bottom centre (around the +).
import { createContext, useContext, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { vars } from 'nativewind';
import { PALETTE, Palette, ThemeName, alpha, cssVars } from './tokens';
import { useGo } from '../store/store';

interface ThemeCtx { theme: ThemeName; c: Palette; alpha: (name: keyof Palette, a: number) => string }
const Ctx = createContext<ThemeCtx>({ theme: 'light', c: PALETTE.light, alpha: (n, a) => alpha(n, a, 'light') });

/** Current theme + hex palette, for props that can't take a className (gradients, icons, pickers). */
export const useTheme = () => useContext(Ctx);

export function ThemeRoot({ children }: { children: React.ReactNode }) {
  const { theme } = useGo();
  const value = useMemo<ThemeCtx>(() => ({ theme, c: PALETTE[theme], alpha: (n, a) => alpha(n, a, theme) }), [theme]);
  const c = PALETTE[theme];
  return (
    <Ctx.Provider value={value}>
      <View style={[styles.root, { backgroundColor: c.bg }, vars(cssVars(theme))]}>
        {/* The wash: two radial glows from the bottom centre + a soft fade */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="lav" cx="50%" cy="100%" rx="85%" ry="38%">
              <Stop offset="0" stopColor={c.lav} stopOpacity={0.26} />
              <Stop offset="1" stopColor={c.lav} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="brand" cx="50%" cy="100%" rx="60%" ry="26%">
              <Stop offset="0" stopColor={c.brand} stopOpacity={0.12} />
              <Stop offset="1" stopColor={c.brand} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#lav)" />
          <Rect width="100%" height="100%" fill="url(#brand)" />
        </Svg>
        {children}
      </View>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
