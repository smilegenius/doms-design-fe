/** @type {import('tailwindcss').Config} */
// Smile Genius Go design tokens as Tailwind colours. Values come from CSS
// variables set by <ThemeRoot> (src/theme) via NativeWind vars(), so one class
// (e.g. bg-go-surface) works in light and dark.
const GO = ['bg', 'surface', 'raised', 'line', 'ink', 'ink2', 'muted', 'faint',
  'brand', 'brand-ink', 'brand-soft', 'lav', 'violet', 'violet-soft',
  'ok', 'ok-soft', 'warn', 'warn-soft', 'bad', 'bad-soft',
  'teal', 'teal-soft', 'pink', 'pink-soft'];

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Light/dark comes from the go-* variables (ThemeRoot), not dark: classes
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins_400Regular'],
        medium: ['Poppins_500Medium'],
        semibold: ['Poppins_600SemiBold'],
        bold: ['Poppins_700Bold'],
      },
      colors: {
        go: Object.fromEntries(GO.map(k => [k, `rgb(var(--go-${k}) / <alpha-value>)`])),
      },
    },
  },
  plugins: [],
};
