/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      // Smile Genius Go tokens — themed via CSS variables in src/styles/go.css
      // so one class (e.g. bg-go-surface) works in both light and dark.
      colors: {
        go: Object.fromEntries(
          ['bg', 'surface', 'raised', 'line', 'ink', 'ink2', 'muted', 'faint',
           'brand', 'brand-ink', 'brand-soft', 'lav', 'violet', 'violet-soft',
           'ok', 'ok-soft', 'warn', 'warn-soft', 'bad', 'bad-soft',
           'teal', 'teal-soft', 'pink', 'pink-soft']
            .map(k => [k, `rgb(var(--go-${k}) / <alpha-value>)`]),
        ),
      },
    },
  },
  plugins: [],
}
