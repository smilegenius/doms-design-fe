# Smile Genius Go — instructions for AI coding assistants

This repo began as the **approved UI prototype** of Smile Genius Go, the mobile app for dental practices. The screens, components, tokens, copy and flows here are signed off. The job now is to make it real: wire up the API, auth, camera, mic and push notifications. **Do not redesign.** Before you change any layout, wording or flow, ask the designer (Sajid, sajid@smilegeniusdental.co.uk).

## Product in one paragraph

Dental practices send lab work (crowns, bridges, dentures, aligners…) to dental labs. Go lets **practice managers and nurses** (the main users; dentists are the prescribers) create lab work by **voice, by photographing the paper lab form, or manually**. They track every case against the patient's appointment, dispatch work to the lab, mark it as received, reply to lab comments, and review lab invoices. The app is a mobile companion to the Smile Genius web portals (clinic / lab / DSO) and uses the same vocabulary and palette. The demo user is "John Carter, Practice manager".

## Stack

React 18 + TypeScript + Vite + Tailwind 3 + React Router 7. Icons: Heroicons **solid** (via `src/app/go/icons.tsx`). Font: Poppins. There is no other UI library.

If you port this to React Native or Expo, keep the component names and props from `ui.tsx` and the tokens from `design/tokens.json`. The screen files are then the visual spec to rebuild against.

## File map

```
src/app/go/
  GoApp.tsx        App shell: routes, auth guard, desktop phone frame + reviewer side panel (prototype only)
  ui.tsx           THE component kit: Screen, TopBar, TabBar, Card, Btn, Input, Sheet, PickerField, Pill… (use these)
  icons.tsx        The only place icons are imported from
  store.tsx        Global state (React context): theme, auth, practice scope, cases, invoices, notices, toasts
  data.ts          Domain types + seed data + business rules (readiness, attention, statuses, formatters)
  catalogue.ts     Service catalogue + option lists (shared verbatim with the web portal's Create Case form)
  Keyboard.tsx     Simulated iOS keyboard for the desktop frame (prototype only, delete in a native build)
  screens/
    Auth.tsx       Sign in, forgot password
    Home.tsx       Practice switcher, 4 status hero tiles, "Also needs a look", invoices strip, latest comments
    LabWork.tsx    Lab work list (flat, by delivery date) + Case detail (tabs: Details, Activity, Comments, Files) + receive sheet
    Logistics.tsx  Dispatch (print label, courier), legacy receive route
    Capture.tsx    Audio dictation + photo capture → hands a prefilled form to ManualCase
    ReadSource.tsx Voice note / form photo + transcript shown on step 1 of the form
    ManualCase.tsx The 4-step create case form (used by all three creation methods), drafts
    Finance.tsx    Invoices list, invoice detail, statement detail
    Account.tsx    Account, settings, notifications
src/styles/go.css  Design tokens (CSS vars, light + dark), gradients, shadows, animations
design/tokens.json The same tokens in a platform-neutral form (generated from go.css)
```

## Styling rules (non-negotiable)

1. **Use only `go-*` colours**: `bg-go-surface`, `text-go-ink`, `border-go-line`, `bg-go-brand-soft text-go-brand-ink`, `text-go-bad`… They switch automatically between light and dark through CSS variables on `.go-theme[data-theme]`. **Never write raw hex or Tailwind palette colours** (`bg-blue-500`, `#4D8EF7`). Only four things are fixed by design: the printed dispatch label, the camera viewfinder (always dark), the phone bezel, and the status chip gradients in go.css (`.go-chip-*`, vivid in both themes).
2. **Opacity** works on tokens: `bg-go-brand/15`, `border-go-line/80`.
3. **Every screen must work in light AND dark.** Check both before you finish.
4. **Compose from `ui.tsx` before you write new markup.** If something is missing, add it to `ui.tsx` in the same style. Don't style it inline in a screen.
5. Text sizes follow the scale in `design/tokens.json` (11 / 12.5 / 13.5 / 15 / 20px). Radii: buttons and inputs 16px, cards 22px, sheets 30px.
6. Interaction feel: press = `active:scale-[.98]`, sheets slide up from the bottom (`Sheet`), confirmations use `toast()` from the store, not alerts.
7. **Background:** every screen sits on the phone-level `.go-wash` (go.css): `go-bg` with a very light lavender/blue glow rising from the bottom centre, around the + button. `Screen` is transparent by default; sticky headers use `bg-go-bg/80 backdrop-blur-xl`. Don't give screens a solid background.
8. **Icons are filled.** Import from `./icons` (or `../icons`), never from `lucide-react` or `@heroicons` directly. If you need a new icon, map a Heroicons solid icon in `icons.tsx`.
9. After you edit `tailwind.config.js`, restart the dev server. New colours don't hot-reload.

## Core components (ui.tsx)

| Component | Use |
|---|---|
| `Screen({header, footer, tabs})` | Every screen. `tabs` shows the floating tab bar, and `footer` is the sticky action area |
| `TopBar({title, sub, back, right, large})` | Screen header. `back` uses history with a fallback (`useBack`) |
| `TabBar` | Home · Lab work · (+) · Invoices · Account. The centre (+) opens `NewWorkSheet` |
| `Card`, `Section`, `KV` | Content surfaces. KV = label/value rows |
| `Btn({variant, size, block, icon})` | Buttons: lg 52px, md 40px |
| `Input`, `TextArea`, `Label({optional, hint})`, `SearchBox`, `PickerField` | Forms. PickerField opens a searchable bottom sheet |
| `Chips`, `Segmented`, `Toggle`, `Stepper`, `CheckRow` | Selection controls |
| `Sheet({title, sub, footer, tall})` | Bottom sheet (portal into the phone root) |
| `Pill({tone})`, `IconTile`, `ActionTile`, `Avatar`, `EmptyState` | Display. `Tone` = brand / violet / ok / warn / bad / teal / pink / neutral |
| `StagePill`, `ReadinessPill`, `ProgressRail`, `CaseFlags` | Case-specific display |
| `GoMark`, `BrandWordmark`, `BrandSwoosh` | Logo (inline SVG) |

## Domain rules (decided with the client — keep them)

**Wording.** Use these exact terms:
- "Lab work", not "orders". "Comments", never "chat". "**Mark as received**", never "check in".
- "**Delivery date**" is the date the lab returns the work. "**Additional information required**" (short form: "Info required") means the lab is asking the practice something.
- "**Invoices**", never "Finance" (route `/go/invoices`; `/go/finance` redirects).
- The create sheet is titled "Create lab work" with the options **By audio → By photo → Manually**, in that order.

**Dates only, no times.** The app doesn't capture times. Appointments and delivery dates are days, and readiness compares days.

**Creating a case**
- All three methods end in the **same 4-step form** (`ManualCase.tsx`). Audio and photo only capture and read, then navigate to `/go/new/manual` with `state: { prefill, read }`.
- **Required fields:** Patient, Dentist, Lab, and at least one service. Everything else is optional (order type, delivery date, case source, and every field within a service). Fields the AI read unclearly are left empty and highlighted with "You said …. Please check." They never block submission. Audio and photo flows label the final button "Confirm".
- Patient search is by name or ID, and the user can create a new patient on the spot. Lab search works the same way, and the user can add an **offline lab** on the spot. A case can have several services, each with category-specific extra fields (`detailFields()` in data.ts).
- A voice note is **never** attached to the case. A form photo **is** attached.
- "Save draft" is in the form header. A draft is `stage: 'draft'` with `draftForm`, and it reopens at `/go/new/manual?draft=ID`.

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
- **Demo cases (also in the side panel):** SG-28526 (upper full + lower partial denture in stages + crown), SG-28497 (partial denture), SG-28488 (full denture at Try In), SG-28520 (aligner phases + retainer), and draft SG-D1012 (denture stages + aligner phases + crown, for the create form).

**Mark as received** is a confirm sheet: "<lab> will be notified, if active", optional Delivery notes (max 1000 characters), and Cancel / "Yes, received". It has no checklist.

**Home** has **no case list** and **no section headings**. Up to six statuses are hero tiles in one grid, in this order: **Overdue · To dispatch · On hold · Draft · Not approved · Date changed**.
- **What a tile shows:**
  - a tinted gradient in its status colour
  - a glossy gradient icon chip: `.go-chip` + `.go-chip-overdue|ready|hold|draft|rejected|date` in go.css, with icons Clock · Truck · Pause · PenLine · XCircle · CalendarClock
  - a big count, the short label and up to 3 patient initials
- **There is no sub-text line** on the tiles. How late a case is shows on its own status pill in Lab work ("2 days late" instead of "Late").
- Tapping a tile opens `/go/work?f=<status>`.
- **Only statuses that have work get a tile.** The tiles sit in two columns; when the count is odd, the first (most urgent) tile spans the full width.
- If cases exist but none need action, show a slim "All clear" card instead.
- **A brand-new practice with no lab work at all** sees only one card: "No lab work yet / Create your lab work ›", with By audio · By photo · Manually. Tapping it opens the Create lab work sheet. All other Home sections are hidden in this state.

Home has **no "Also needs a look" section** (Not approved and Date changed are tiles now) and **no Latest comments section**; both were removed at the client's request. Comments are read and answered on each case's Comments tab. The Invoices strip is hidden, because invoices are switched off (see Feature flags below). If the user belongs to only one practice, show the practice name with no dropdown.

**Invoices: switched off for now (`FEATURES.invoices = false`).**
- While invoices are off:
  - the Invoices tab shows a quiet notice (`InvoicesComingSoon` in Finance.tsx): a web (Monitor) icon, "Coming soon to the app" and "For now, you can view and approve invoices on the Smile Genius web portal." There is no badge.
  - invoice and statement links redirect to that screen
  - invoice and statement notifications are hidden
  - the Home strip is hidden
  - the reviewer panel hides its Invoices group
- The full invoice screens are built and kept in the code. Setting the flag to `true` brings everything back.

When it is on: main statuses are swipeable count tiles: QC · Needs review, Duplicates, Awaiting approval, Approved, Sent to Xero, Payment processed. Secondary statuses sit behind the filter button. A row shows the number, amount, supplier · date · INVOICE/CREDIT NOTE, Bill to, the status, "N issues", and an AI confidence bar (orange below 90, green at 90 or above).

**Account** is a short list of settings. Each one opens its own page, and nothing is expanded on the main screen:
- **Appearance** (`/go/account/appearance`)
- **Your practices** (`/go/account/practices`)
- **Notifications** (`/go/account/notifications`): Additional information required, Lab work on its way, Overdue lab work
- **Home screen order** (`/go/account/dashboard`):
  - Reorder the 6 Home status tiles with up/down buttons (bigger targets than dragging, kinder for older users), or put them back to the usual order.
  - Saved as `dashOrder` in the store (localStorage `sg-go-dash-order`).
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
| `SEED_CASES`, `SEED_INVOICES`, `SEED_STATEMENTS`, `PATIENTS`, `LABS`, `CLINICIANS`, `PRACTICES` in data.ts | API calls. The **types** in data.ts are the intended data contract, so keep them and adapt as needed |
| `store.tsx` holds everything in React state | Server state (e.g. TanStack Query) + mutations. Keep `useGo()` for UI-only state (theme, toasts, sheet root) |
| Auth: any password works, flag in `sessionStorage` (`sg-go-auth`) | Real auth (same identity as the web portals). Google / Microsoft buttons are visual only |
| `Capture.tsx`: fake recorder, canned `TRANSCRIPT`, canned OCR prefill + flags | Real mic and camera, speech-to-text and form OCR returning `{ prefill, flags }` in the same shape |
| `FakeCode` QR on the dispatch label | Real barcode or QR for the case ID, plus real printing |
| Case IDs from `Math.random()` | IDs issued by the server |
| `GoApp.tsx`: desktop phone frame, status bar, `SidePanel` "Jump to screen" + scenarios, "All portals" link | Delete for production. The `JUMPS` list is a handy index of every screen state to test against |
| `demoFill` in store.tsx (Home side-panel scenarios: Filled 1 / 2 / 3 / All, Empty) filters the seed data | Delete. Real data drives these states |
| `FEATURES` flags in store.tsx (invoices, labCardView) | Your real feature-flag system, or delete once the client decides |
| `Keyboard.tsx` simulated keyboard | Delete. Use the native keyboard and safe areas |
| `addLab` / `addPatient` mutate module arrays | API create endpoints |
| Theme preference in `localStorage` (`sg-go-theme`) | Fine to keep, or use device storage |
| Notifications list | Push notifications + inbox API |

## Reviewing screens

`npm run dev`, then open http://localhost:5173/go. On desktop, the side panel lists every screen and scenario (multi-service case, on hold, at risk, single practice, and so on). Each one is a deep link, so you can use the list as the acceptance checklist.
