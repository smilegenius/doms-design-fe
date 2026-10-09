# Smile Genius Go (React Native · Expo) — instructions for AI coding assistants

This is the **React Native / Expo** build of Smile Genius Go, the mobile app for UK dental practices. It is a 1:1 port of the **approved web prototype** (`../smile-genius-go`). The screens, components, tokens, copy and flows are signed off. The job now is to make it real: wire up the API, auth, speech-to-text / prescription reading and push notifications. **Do not redesign.** Before you change any layout, wording or flow, ask the designer (Sajid, sajid@smilegeniusdental.co.uk).

Also read `AGENTS.md` (Expo changes every SDK: check the versioned docs before using an Expo API) and `PORTING.md` (how web markup maps to React Native in this codebase).

## Product in one paragraph

Dental practices send lab work (crowns, bridges, dentures, aligners…) to dental labs. Go lets **practice managers and nurses** (the main users; dentists are the prescribers) create lab work **by audio, by photo of a written prescription, or manually**. They track every case against the patient's appointment, dispatch work to the lab, mark it as received and reply to lab comments. The app is a mobile companion to the Smile Genius web portals (clinic / lab / DSO) and uses the same vocabulary and palette. The demo user is "John Carter, Practice manager".

## Stack

- **App:** Expo SDK 57, React Native 0.86, React 19, TypeScript (strict).
- **Navigation:** Expo Router. Routes are in `src/app/`; the tabs are Home · Lab work · (+) · Invoices · Account.
- **Styling:** NativeWind 4 (Tailwind 3 classes on React Native) with the `go-*` design tokens.
- **Native pieces:**
  - expo-linear-gradient for gradients and react-native-svg for the logo and wash
  - @react-native-community/datetimepicker for dates
  - expo-camera, expo-audio, expo-image-picker and expo-document-picker for capture and files
  - AsyncStorage for preferences
  - react-native-reanimated for sheet and toast motion
- **Icons and font:** Heroicons **solid** (react-native-heroicons) and Poppins (@expo-google-fonts/poppins).

## File map

```
src/app/                    Routes only (thin files → src/screens)
  _layout.tsx               Fonts, store, ThemeRoot, auth redirect, toasts
  (tabs)/_layout.tsx        Tabs with the custom floating TabBar
  (tabs)/home|work|invoices|account.tsx
  work/[id]/index.tsx       Case detail (params: tab, receive)
  work/[id]/dispatch.tsx    Print label and dispatch
  new/manual|audio|capture.tsx
  account/appearance|practices|notifications|dashboard|review.tsx
  notifications.tsx, signin.tsx, forgot.tsx
src/screens/                Screen components (Home, LabWork, Logistics, ManualCase, Capture, ReadSource, Account, Auth, Invoices, Review)
src/components/ui.tsx       THE component kit (same names/props as the web kit) — use it
src/components/icons.tsx    The only place icons are imported from
src/components/status.tsx   Status labels, icons, colours, Home tile styling, glossy StatusChip
src/data/data.ts            Domain types + seed data + business rules (identical to the web prototype)
src/data/catalogue.ts       Service catalogue + option lists (shared with the web portal's Create Case form)
src/lib/caseForm.ts         Create-case form model, per-service / stage / phase dates, buildCase / buildDraft
src/lib/readSource.ts, readCase.ts   Audio / photo read types + the canned read (replace with the real service)
src/store/store.tsx         useGo(), useScoped(), FEATURES, ME
src/theme/tokens.ts         Colour tokens (light + dark), status chip gradients, radii
src/theme/ThemeRoot.tsx     Sets the go-* CSS variables (NativeWind vars()), useTheme(), and paints the background wash
```

## Styling rules (non-negotiable)

1. **Use only `go-*` colours**: `bg-go-surface`, `text-go-ink`, `border-go-line`, `bg-go-brand-soft`, `text-go-bad`… They switch between light and dark through CSS variables set by `ThemeRoot`. **Never write raw hex or Tailwind palette colours**. For JS colour props use `useTheme().c.brand` / `alpha('brand', .15)`. Only three things are fixed by design: the printed dispatch label, the camera view (always dark), and the status chip gradients (`CHIP` in tokens.ts, vivid in both themes).
2. **Every screen must work in light AND dark.** Check both before you finish.
3. **Compose from `ui.tsx` before you write new markup.** If something is missing, add it to `ui.tsx` in the same style.
4. **All text goes in `<T>`** (maps weights to the Poppins files, `truncate` / `line-clamp-N` to numberOfLines). Never use RN `<Text>` directly.
5. **Icons:** filled, imported from `src/components/icons.tsx`, coloured with a class (`<Bell className="w-5 h-5 text-go-brand" />`). RN icons don't inherit colour.
6. **Not available natively:** `space-y` (use `gap`), `divide-y` (use `<Rows>`), CSS gradients (use `<Grad>` / LinearGradient), blur, ring, hover. See PORTING.md.
7. Text sizes: 11 / 12.5 / 13.5 / 15 / 20px. Radii: buttons and inputs 16, cards 22, sheets 30. Use px for tracking and leading.
8. Interaction: Pressable with `active:opacity-90`, sheets slide up (`Sheet`), confirmations use `toast()` from the store, not alerts.
9. **Background:** `ThemeRoot` paints `go-bg` with a very light lavender/blue glow rising from the bottom centre (around the +). `Screen` is transparent; headers use `bg-go-bg/80`. Don't give screens a solid background.
10. After editing `tailwind.config.js`, restart Metro with `npx expo start -c`.

## Core components (ui.tsx)

| Component | Use |
|---|---|
| `Screen({header, footer, tabs, scroll})` | Every screen. Safe areas, keyboard avoiding, scrolling body, sticky `footer`. `tabs` leaves room for the tab bar |
| `TopBar({title, sub, back, fallback, right, large})` | Screen header. `back` uses router history with a fallback (`useBack`) |
| `TabBar` / `NewWorkSheet` | Floating tab bar; the centre (+) opens "Create lab work" |
| `T`, `Grad`, `Rows`, `useCardShadow` | Text, brand gradient, divided rows, card shadow |
| `Card`, `Section`, `KV` | Content surfaces. KV = label/value rows |
| `Btn({variant, size, block, icon})` | Buttons: lg 52px, md 40px |
| `Input`, `TextArea`, `Label({optional, hint})`, `SearchBox`, `PickerField`, `DateField` | Forms. PickerField opens a searchable sheet. DateField uses yyyy-mm-dd |
| `Chips`, `Segmented`, `Toggle`, `Stepper`, `CheckRow` | Selection controls |
| `Sheet({title, sub, footer, tall})` | Bottom sheet (Modal) |
| `Pill({tone})`, `IconTile`, `ActionTile`, `Avatar`, `EmptyState` | Display. `Tone` = brand / violet / ok / warn / bad / teal / pink / neutral |
| `StagePill`, `ReadinessPill`, `ProgressRail`, `CaseFlags` | Case-specific display |
| `GoMark`, `BrandWordmark`, `BrandSwoosh` | Logo (SVG) |

## Domain rules (decided with the client — keep them)

**Wording.** Use these exact terms:
- "Lab work", not "orders". "Comments", never "chat". "**Mark as received**", never "check in".
- "**Delivery date**" is the date the lab returns the work. "**Additional information required**" (short form: "Info required") means the lab is asking the practice something.
- "**Invoices**", never "Finance" (route `/invoices`).
- The create sheet is titled "Create lab work" with the options **By audio → By photo → Manually**, in that order.

**Dates only, no times.** The app doesn't capture times. Appointments and delivery dates are days, and readiness compares days.

**Creating a case**
- All three methods end in the **same 4-step form** (`ManualCase.tsx`). Audio and photo only capture and read, hand `{ prefill, read }` to the form through the store (`setPendingRead`), then open `/new/manual`.
- **Required fields:** Patient, Dentist, Lab, and at least one service. Everything else is optional (order type, delivery date, case source, and every field within a service). Fields the AI read unclearly are left empty and highlighted with "You said …. Please check." They never block submission. Audio and photo flows label the final button "Confirm".
- Patient search is by name or ID, and the user can create a new patient on the spot. Lab search works the same way, and the user can add an **offline lab** on the spot. A case can have several services, each with category-specific extra fields (`detailFields()` in data.ts).
- A voice note is **never** attached to the case. A form photo **is** attached.
- "Save draft" is in the form header. A draft is `stage: 'draft'` with `draftForm`, and it reopens at `/new/manual?draft=ID`.

**Statuses**
- The practice-side stage moves through draft → ready (to dispatch) → dispatched → at-lab → production → shipped → received.
- **The lab owns the lab status** (Received, Under Review, On Hold (Lab/Practice), Accepted, In Queue, In Production, Quality Control, Shipped, Delivered, Not Approved, Cancelled). It is **read-only** for the practice. Never give the practice a status-change or "take off hold" action.
- **On hold** is set only by the lab. If it is On Hold (Practice), offer "Reply" in Comments. If it is On Hold (Lab), show information only.
- The statuses always appear in this order: **Overdue · To dispatch · On hold · Draft** (Home tiles and Lab work filters).
- Readiness (`readiness()` in data.ts) answers "will the work be back before the patient's appointment?" Its levels are at-risk / attention / arriving / on-track / in-practice.

**Lab work list** is a plain list of cases, with **no timeline and no grouping by day**. It is sorted by delivery date, soonest first, and cases with no date (such as drafts) go last.
- **List only, for now.** Each row has:
  - the patient's initials, the patient and case ID
  - the dentist (blue User icon) and lab (violet beaker icon), with no service
  - a status pill. An overdue case's pill says how late it is, e.g. "2 days late", via `pillLabel`.
  - the delivery date
- A **card view** exists but is **switched off**: `FEATURES.labCardView = false` in store.tsx. If it is turned on, a list/grid toggle appears in the header (`?view=cards`). Keep it off unless the client asks for it.
- The **search box is always visible** under the title, not behind an icon. It matches **only patient, dentist and lab names**, and nothing else (no case ID, tooth or service).
- The status chips stay. The **filter sheet** (funnel button, with a badge counting active filters) has:
  - **Status:** all statuses, with counts. It shares `?f=` with the chips.
  - **Dentist** and **Lab**
  - **Creation date:** preset chips Any time · Last 7 days · Last 2 weeks · Last 30 days, then Custom. Custom shows From/To date fields, pre-filled with the last week. It is stored as `?created=7|14|30|custom&from=&to=`, and the active range shows as a removable chip above the list.
  - A case's creation date is `createdOn(c)` in data.ts: `createdAt` (set on drafts), otherwise its first event.
  - **Clear** resets all of these in one update.

**Delivery dates live on each service, not on the case** (as on the web portal).
- **Normal service:** one delivery date (`RxItem.returnBy`), with +7/+10/+14/+21 day shortcuts in the service sheet.
- **Denture (Full / Partial / Immediate):** ordered in **stages**: Special Tray, Bite Registration, Try In, Retry, Finish (`STAGE_NAMES`). The service has no date of its own, only a date per chosen stage. A stage dated in the past is marked "Done earlier", meaning it happened before the case reached Smile Genius.
- **Clear aligners with Phasing = Yes:** ordered in **phases**: Phase 1, Phase 2… each with its own date, plus "Add phase". With Phasing = No, it is a normal single date.
- **Case-level date:** `LabCase.returnBy` is the **soonest open date** across all services, stages and phases (`soonestDate`). Readiness, Overdue and sorting all use it.
- **Lab work list:** shows "Next: Try In" under the dentist/lab line when that date belongs to a stage or phase (`dueLabel`).
- **Case detail:** a Services card shows every service with its delivery, and staged services list each stage or phase with Done earlier / Received / Due / Late.
- **Ordering later:** **Order next stage** (denture, picks from the remaining stages) and **Order Phase N** (aligners) add to the **same case** with their own dates, stamped `orderedAt`, and logged in Activity. The real system should create a stage order for the lab.
- **Data:**
  - `RxItem.staged` ('stage' | 'phase') and `RxItem.stages: StageLine[]` (name, date, state 'done-earlier' | 'received', orderedAt).
  - The first service's values sit on `LabCase.firstReturnBy / firstStaged / firstStages`. Use `allItems(c)` to read every service uniformly, and `patchItemStages` to update one.
- **Multi-service + stages:** any mix works on one case. Each staged service has its own stage/phase list and its own "Order next stage" button. Ordered denture stages are kept in natural order. "Next:" names the service when there are several ("Try In · Partial denture"), and a normal first service keeps its own date (`firstReturnBy` is pinned) when other services change.
- **Demo cases (also in Review scenarios):** SG-28526 (upper full + lower partial denture in stages + crown), SG-28497 (partial denture), SG-28488 (full denture at Try In), SG-28520 (aligner phases + retainer), and draft SG-D1012 (denture stages + aligner phases + crown, for the create form).

**Mark as received** is a confirm sheet: "We’ll let <lab> know, if they use Smile Genius", optional Delivery notes (max 1000 characters), and Cancel / "Yes, received". It has no checklist.

**Home** has **no case list** and **no section headings**. Up to six statuses are hero tiles in one grid, in this order: **Overdue · To dispatch · On hold · Draft · Not approved · Date changed**.
- **What a tile shows:**
  - a tinted gradient in its status colour
  - a glossy gradient icon chip (`StatusChip` in status.tsx, colours `CHIP` in tokens.ts), with icons Clock · Truck · Pause · PenLine · XCircle · CalendarClock
  - a big count, the short label and up to 3 patient initials
- **There is no sub-text line** on the tiles. How late a case is shows on its own status pill in Lab work ("2 days late" instead of "Late").
- Tapping a tile opens `/work?f=<status>`.
- **Only statuses that have work get a tile.** The tiles sit in two columns; when the count is odd, the first (most urgent) tile spans the full width.
- If cases exist but none need action, show a slim "All clear" card instead.
- **A brand-new practice with no lab work at all** sees only one card: "Create your lab work ›" (no "No lab work yet" line), with By audio · By photo · Manually. Tapping it opens the Create lab work sheet. All other Home sections are hidden in this state.

Home has **no "Also needs a look" section** (Not approved and Date changed are tiles now) and **no Latest comments section**; both were removed at the client's request. Comments are read and answered on each case's Comments tab. The Invoices strip is hidden, because invoices are switched off (see Feature flags below). If the user belongs to only one practice, show the practice name with no dropdown.

**Invoices: switched off for now (`FEATURES.invoices = false`).**
- While invoices are off:
  - the Invoices tab shows a quiet notice (`src/screens/Invoices.tsx`): a web (Monitor) icon, "Coming soon to the app" and "For now, you can view and approve invoices on the Smile Genius web portal." There is no badge.
  - invoice and statement links redirect to that screen
  - invoice and statement notifications are hidden
  - the Home strip is hidden
  - Review scenarios hides its Invoices group
- The full invoice screens exist in the web prototype (`Finance.tsx`) and need porting before the flag can be turned on.

When it is on: main statuses are swipeable count tiles: QC · Needs review, Duplicates, Awaiting approval, Approved, Sent to Xero, Payment processed. Secondary statuses sit behind the filter button. A row shows the number, amount, supplier · date · INVOICE/CREDIT NOTE, Bill to, the status, "N issues", and an AI confidence bar (orange below 90, green at 90 or above).

**Account** is a short list of settings. Each one opens its own page, and nothing is expanded on the main screen:
- **Appearance** (`/account/appearance`)
- **Your practices** (`/account/practices`)
- **Notifications** (`/account/notifications`): Additional information required, Lab work on its way, Overdue lab work
- **Home screen order** (`/account/dashboard`):
  - Reorder the 6 Home status tiles with up/down buttons (bigger targets than dragging, kinder for older users), or put them back to the usual order.
  - Saved as `dashOrder` in the store (AsyncStorage `sg-go-dash-order`).
  - Home renders the tiles in this order, and the first one becomes the wide tile when the count is odd.

## Feature flags

`FEATURES` in store.tsx holds features that are built but switched off for now. There is no switch in the UI. Flip one to `true` only when the client asks.
- `invoices: false`: everything invoice-related is hidden, and the tab says "Coming soon".
- `labCardView: false`: Lab work is list only.

## Writing style (all copy)

The users are UK practice receptionists, nurses, practice managers and dentists, many older and not tech-savvy.
- **Language:** plain, warm UK English and UK spelling. Use short sentences and everyday words. Avoid jargon such as AI, OCR, Rx, sync or "flagged".
- **Buttons and messages:** buttons are clear verbs. Errors and empty states are polite and reassuring ("Please check…", "Nothing here yet").
- **No demo wording:** never show "demo", "prototype" or sample wording to users.
- Keep the agreed terms listed under Wording exactly as they are.

## Prototype-only — replace when building for real

| Prototype | Replace with |
|---|---|
| `SEED_CASES`, `SEED_INVOICES`, `SEED_STATEMENTS`, `PATIENTS`, `LABS`, `CLINICIANS`, `PRACTICES` in data.ts | API calls. The **types** in data.ts are the intended data contract — keep them and adapt as needed |
| `store.tsx` holds everything in React state | Server state (e.g. TanStack Query) + mutations. Keep `useGo()` for UI-only state (theme, toasts) |
| Sign in: any password works; signed-in flag in AsyncStorage (`sg-go-auth`) | Real auth (same identity as the web portals), tokens in expo-secure-store. Google / Microsoft buttons are visual only |
| `src/lib/readCase.ts`: canned transcript and canned prescription read + flags | Real speech-to-text and prescription reading, returning `{ form, flags }` in the same shape. Capture already records real audio / takes a real photo — see the `PROTOTYPE` comment in `src/screens/Capture.tsx` |
| `FakeCode` QR on the dispatch label | Real barcode or QR for the case ID, plus real printing |
| Case IDs from `Math.random()` | IDs issued by the server |
| `demoFill`, `soloPractice` and the dev-only Account › **Review scenarios** screen | Delete for production (it only shows in development builds). It is the handy index of every screen state to test against |
| `FEATURES` flags in store.tsx (invoices, labCardView) | Your real feature-flag system, or delete once the client decides |
| `addLab` / `addPatient` mutate module arrays | API create endpoints |
| Notifications list | Push notifications (expo-notifications) + inbox API |
| Invoice screens | Only the "Coming soon" screen is ported (invoices are off). The full screens are in the web prototype's `Finance.tsx` — port them when `FEATURES.invoices` is turned on |

## Running and reviewing

```bash
npm install
npx expo start          # press i / a for a simulator, or scan the QR with a development build
npm run web             # quick review in the browser
npx tsc --noEmit        # typecheck
```

The app uses native modules (camera, audio, date picker), so use a **development build** (`npx expo run:ios|android`, or `eas build --profile development`) rather than Expo Go for real device testing. In development, Account › **Review scenarios** lists every screen and scenario (empty dashboard, filled statuses, single practice, multi-service with stages, drafts…) as deep links — use it as the acceptance checklist.
