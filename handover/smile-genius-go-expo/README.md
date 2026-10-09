# Smile Genius Go: React Native (Expo) handover

The approved Smile Genius Go mobile app, built in **React Native with Expo and TypeScript**. Every screen, component, colour token, piece of copy and flow from the signed-off prototype is here and running on demo data. What's left is the real backend, auth, speech-to-text / prescription reading and push notifications.

## Run it

```bash
npm install
npx expo start
```

- **iOS / Android:** this app uses native modules (camera, microphone, date picker), so use a development build: `npx expo run:ios` / `npx expo run:android`, or `eas build --profile development`. Expo Go may work for most screens, but camera and audio need the development build.
- **Browser (quick review):** `npm run web`
- **Typecheck:** `npx tsc --noEmit`

Sign in with any email and password (prototype).

## What's in the box

| Path | What |
|---|---|
| `CLAUDE.md` | **Read this first.** Design rules, wording, business rules agreed with the client, and the list of prototype-only parts to replace. AI assistants such as Claude Code load it automatically |
| `PORTING.md` | How the web prototype maps to React Native here (elements, styling, navigation) |
| `AGENTS.md` | Expo's own guidance: check the SDK 57 docs before using an Expo API |
| `design/tokens.json` | Colours (light + dark), type scale, radii, sizes, motion, in a platform-neutral format |
| `src/app/` | Routes (Expo Router) |
| `src/screens/` | All screens |
| `src/components/ui.tsx` | Component kit |
| `src/theme/` | Tokens and theme (light / dark / follow the phone) |
| `src/data/` | Domain types (the intended data contract), demo data, business rules, service catalogue |
| `src/lib/` | Create-case form logic and the audio / photo read |
| `src/store/` | App state |

## Screens

| Route | Screen |
|---|---|
| `/signin`, `/forgot` | Sign in, forgot password |
| `/home` | Home: practice switcher and up to 6 status tiles (order set in Account) |
| `/notifications` | Notifications |
| `/work` (params `f`, `dentist`, `lab`, `created`, `from`, `to`, `day`, `r`) | Lab work list with search and filters |
| `/work/[id]` (params `tab`, `receive`) | Case detail, Mark as received, Order next stage / phase |
| `/work/[id]/dispatch` | Print label and dispatch |
| `/new/audio`, `/new/capture` (param `rx`) | Create by audio / by photo (real mic and camera) |
| `/new/manual` (param `draft`) | 4-step create form (also used after audio and photo); delivery dates per service / denture stage / aligner phase |
| `/invoices` | "Coming soon to the app" while invoices are switched off (`FEATURES.invoices`) |
| `/account` and `/account/appearance`, `/practices`, `/notifications`, `/dashboard` | Account: a settings list, each opening its own page |
| `/account/review` | Development builds only: every screen and scenario as a deep link |

## Suggested build order

1. Keep `ui.tsx`, `icons.tsx`, the theme, and the screens as they are.
2. Replace the store's demo data with API calls, keeping the types from `src/data/data.ts` as the contract.
3. Add real auth, then speech-to-text and prescription reading. Capture already records the real audio file and takes the real photo; return the same `{ form, flags }` shape as `src/lib/readCase.ts`.
4. Add push notifications, then remove the Review scenarios screen and the demo-only state.

Questions about the design: Sajid, sajid@smilegeniusdental.co.uk
