# Smile Genius Go — UI handover

The approved UI for **Smile Genius Go**, the mobile app for dental practices. Every screen, component, token, piece of copy and flow is built and working on demo data. What's left is the real backend, auth and device features.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173/go. On a desktop it shows inside a phone frame, with a side panel that jumps to every screen and scenario. On a phone it runs full screen. You can sign in with any password.

`npm run build` typechecks and builds. `npm run typecheck` only typechecks.

## What's in the box

| Path | What |
|---|---|
| `CLAUDE.md` | **Read this first.** Design rules, wording, business rules agreed with the client, and the list of prototype-only parts to replace. AI assistants such as Claude Code load it automatically |
| `design/tokens.json` | Colours (light + dark), type scale, radii, sizes, shadows, motion in a platform-neutral format, for native or other stacks |
| `src/styles/go.css` | The token source of truth (CSS variables) + animations |
| `tailwind.config.js` | Maps the tokens to `go-*` Tailwind colours |
| `src/app/go/ui.tsx` | Component kit |
| `src/app/go/data.ts` | Domain types (the intended data contract), seed data, business rules |
| `src/app/go/catalogue.ts` | Service catalogue shared with the web portal |
| `src/app/go/screens/` | All screens |
| `public/favicon.svg` | App mark |

## Screens

| Route | Screen |
|---|---|
| `/go/signin`, `/go/forgot` | Sign in, forgot password |
| `/go/home` | Home: practice switcher and up to 6 status tiles (order set in Account) |
| `/go/notifications` | Notifications |
| `/go/work` (`?f=overdue\|ready\|on-hold\|draft\|arriving\|questions`, `?day=`, `?r=`) | Lab work list |
| `/go/work/:id` (`?tab=messages`, `?receive=1`) | Case detail + Mark as received |
| `/go/work/:id/dispatch` | Print label and dispatch |
| `/go/new/audio`, `/go/new/capture` (`?rx=multi\|clean`) | Create by audio / photo |
| `/go/new/manual` (`?draft=ID`) | 4-step create form (also used after audio and photo); delivery dates per service / denture stage / aligner phase |
| `/go/invoices/invoice/:id`, `/go/invoices/statement/:id` | Invoice and statement detail (only when invoices are switched on) |
| `/go/account` (`/appearance`, `/practices`, `/notifications`, `/dashboard`) | Account: a settings list, each opening its own page |
| `/go/invoices` | "Coming soon" while invoices are switched off (`FEATURES.invoices`) |

## Suggested build order

1. Keep `ui.tsx`, `icons.tsx`, `go.css`, tokens and screens as they are.
2. Replace `store.tsx` data with API calls and keep the types from `data.ts` as the contract.
3. Add real auth, then camera and mic + speech-to-text and OCR (return the same `{ prefill, flags }` shape that `Capture.tsx` passes to the form).
4. Remove the desktop frame, side panel and simulated keyboard from `GoApp.tsx`. Wrap the app in Capacitor or port it to React Native using `design/tokens.json`.

Questions about the design: Sajid, sajid@smilegeniusdental.co.uk
