# Porting rules (web prototype → React Native)

The web prototype in `../smile-genius-go` is the **approved design**. Port screens 1:1: same layout, same copy (word for word), same behaviour. Do not redesign. If something can't work on a phone the same way, use the closest native equivalent and say so in a code comment.

## Project map

```
src/app/            Expo Router routes ONLY (thin files that render a screen from src/screens)
src/screens/        Screen components (ported from ../smile-genius-go/src/app/go/screens)
src/components/ui.tsx      UI kit — same names/props as the web kit (Screen, TopBar, Card, Btn, Sheet, PickerField, Pill…)
src/components/icons.tsx   Icons — same names as web (Bell, Truck, …). Import icons ONLY from here.
src/components/status.tsx  STATUS_STYLE, HERO, StatusChip, statusShort
src/data/data.ts           Domain types, seed data, rules (identical to web)
src/lib/caseForm.ts        Create-case form model + buildCase/buildDraft (identical logic to web)
src/lib/readSource.ts, readCase.ts   Audio / photo read types + canned read
src/store/store.tsx        useGo(), useScoped(), FEATURES, ME
src/theme/                 tokens.ts (colours), ThemeRoot (useTheme())
```

## Element mapping

| Web | React Native |
|---|---|
| `div`, `span` (layout) | `View` (flex is **column** by default: add `flex-row` where the web had `flex` horizontal) |
| any text, `p`, `h1`, `span` with text | `<T className=…>` from ui.tsx. **Every string must be inside `<T>`.** Never use RN `<Text>` directly |
| `button` | `Pressable` (+ `accessibilityRole="button"`, `accessibilityLabel` from aria-label), `onPress` not `onClick` |
| `input` | `Input` / `TextArea` / `SearchBox` from ui.tsx (`onChangeText`) |
| `input type="date"` | `DateField` (value / onChange as yyyy-mm-dd) |
| `input type="file"` | `expo-image-picker` / `expo-document-picker` (store the file name like the web did) |
| `<svg>` | `react-native-svg` |
| `useNavigate()` | `router` from expo-router: `router.push('/work/SG-1')`, `router.replace(...)`, `router.back()` |
| `useParams()` / `useSearchParams()` | `useLocalSearchParams<{ id: string; f?: string }>()`; update query with `router.setParams({ f: 'overdue' })` (pass `undefined` to clear) |
| `navigate(x, { state })` | not possible — use the store (e.g. `setPendingRead`) |
| `/go/...` paths | drop the `/go` prefix: `/home`, `/work`, `/work/[id]`, `/work/[id]/dispatch`, `/new/manual`, `/new/audio`, `/new/capture`, `/invoices`, `/account`, `/account/appearance`, `/notifications` |
| `createPortal`, `sheetRoot` | `Sheet` (a Modal) |
| `useBack()` | `useBack(fallback)` from ui.tsx |

## Styling (NativeWind)

- `className` works with the same `go-*` colour classes (`bg-go-surface`, `text-go-muted`, `border-go-line`, `/40` opacity). Light/dark is automatic.
- **Icons:** size and colour via className: `<Bell className="w-5 h-5 text-go-brand" />` or props `size` / `color`. RN icons do **not** inherit colour from parent text — always give a colour class (on gradient/primary backgrounds use `text-white`).
- **Not supported natively — replace:**
  - `space-y-*` / `space-x-*` → `gap-*` (with `flex-row` for horizontal)
  - `divide-y divide-go-line` → `<Rows>` from ui.tsx
  - `go-grad` → `<Grad>`; `bg-gradient-to-*` → `LinearGradient` from expo-linear-gradient with colours from `useTheme().c`
  - `go-card-shadow` → `style={useCardShadow()}` (Card already has it)
  - `blur-*`, `backdrop-blur-*`, `ring-*`, `hover:*`, `transition`, `focus-within:*`, CSS keyframes (`go-rise`, `go-pulse`, `go-scanline`) → drop, or use `react-native-reanimated` (e.g. `entering={FadeInUp}`) for entrances
  - `truncate`, `line-clamp-N` on `<T>` work (T maps them to numberOfLines)
  - `tracking-[0.14em]` → px: `tracking-[1.5px]`; `leading-relaxed/snug` → px: `leading-[20px]`
  - `inline-flex` → `flex-row` on a View with `self-start`
  - `aspect-[4/3]` works; `min-w-0` works; `whitespace-nowrap` → `numberOfLines={1}`
  - `active:scale-[.98]` → `active:opacity-90` on Pressable
- Colours needed in JS (gradient colours, Switch, pickers, Svg fills): `const { c, alpha } = useTheme(); c.brand`, `alpha('brand', .15)`.
- Absolute decorative glows (`blur-3xl` blobs) → omit, or a soft `LinearGradient`. Keep the screen readable first.

## Behaviour

- Keep all copy exactly as in the web source (UK English, agreed terms — see the web CLAUDE.md).
- Keep `FEATURES` checks (invoices off → "Coming soon"; card view off).
- Lists that can grow (Lab work) may use `FlatList`; small fixed lists can map inside a ScrollView.
- Keyboard: `Screen` wraps a KeyboardAvoidingView; forms should still scroll.
- Haptics are optional (`expo-haptics`) — light impact on primary actions is fine, not required.

## Done means

`npx tsc --noEmit` passes with no errors, and the screen renders on web (`npm run web`) without console errors.
