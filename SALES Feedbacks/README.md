# SALES Feedbacks

Sales-feedback features, built on top of the existing Lab Portal. Everything is contained in this folder. **No file outside it is modified:** no routes, shared components, styles, configs or deploy settings.

## Run it
Run from the repo root:

```bash
npx vite --config "SALES Feedbacks/vite.config.ts"
```

Then open http://localhost:5180. It shows the real portal select screen with one extra card, **Growth Team Feedback**. That card opens this work at **`/growth`**: a copy of the Lab portal with every Sales Feedbacks feature. Sign in with any email if asked; "Use demo account" fills one in.

Everything else is the real, unchanged app, including the real **Lab Portal at `/lab`**. None of the Growth work shows up there:
- **Cases:** Growth's cases (inbox and website drafts, the Design Studio demo cases, and cases confirmed in Growth) are moved out of the shared case list when you leave `/growth`, and put back when you return (`growthIsolation.ts`).
- **Bell:** its notifications are removed when you leave `/growth`.
- **Links:** existing portal links to `/lab/...` that you click inside Growth (for example the scanner and email notices on Cases) stay inside `/growth`.
- **Moving around:** Log out and Switch portal return to portal select.

The sandbox has its own Vite entry (`index.html`, `main.tsx`, `vite.config.ts`, `tailwind.config.js`) and runs on port 5180. It's separate from the portal's `npm run dev` on 5173, which stays untouched. Because it's a different origin, its localStorage is separate too, so sandbox data never shows up in the real portal.

Type-check the folder:

```bash
npx tsc -p "SALES Feedbacks" --noEmit
```

Three errors from `src/app/components/AddPracticeModal.tsx` already exist in the repo. They aren't from this folder.

## How it reuses the portal
The portal is treated as **read-only**. Its modules are imported, never edited:

| Piece | Reused from `src/app` |
|---|---|
| Shell: sidebar, header, notifications, user menu | `components/Layout` (`portal="lab"`) |
| Lab page routing | Same URL ↔ page mapping as `LabApp.tsx`, copied into `LabPrescriptionInboxApp.tsx` |
| Overview, Invoices, Analytics, Messages, Notifications | The real pages, unchanged |
| Cases list | `pages/CasesPage` (`portal="lab"`) |
| Draft review | `pages/QuickCreateCasePage` (`prefillDraft`, `counterparty="lab"`) |
| Existing Settings tabs | `pages/SettingsPage` (`portal="lab"`) |
| AI drafts storage | `data/createdCases` (`addCreatedCase` / `removeCreatedCases`) |
| Primitives | `Button`, `Modal`, `Toggle`, `AiSparkle`, `useToast`, `useAuth` |

## Lab prescription email inbox
1. **Settings → Prescription Email Inbox.** A new tab in the lab Settings sidebar. It contains:
   - the lab's unique inbox address with a Copy button
   - send-from-phone steps
   - who currently receives draft-ready emails, with a link to manage notifications
   - an inbox activity log, with "Preview email" and "View photo" for each entry
2. **Settings → Notifications → "Prescription Email Inbox" category.** It sits under the real categories, with the same In-App / Email toggles and All / None controls. Each user sets their own preferences, so any number of people can nominate themselves:
   - **AI Draft Ready for Review:** every draft made from the inbox.
   - **Draft Ready: Photos I Sent:** drafts from photos you emailed yourself.
   - A footer shows who else on the team receives draft-ready emails.
3. **Cases.** "Email a prescription photo" simulates a lab user emailing a photo. AI "reads" it for about 2.5 seconds. A draft case (`SF-RX-…`, status Draft, source Email, with the AI badge) then appears in the real Cases list.
4. **Draft-ready email.** It's sent to everyone with that email preference on. "Last notification" previews it, including a photo thumbnail. "Review draft" opens the draft.
5. **Review.** Clicking the draft opens the existing QuickCreate screen with the AI-prefilled fields. The prescription photo viewer opens by itself the first time, and the photo dock (bottom-left) reopens it later. The viewer shows every page, with a page strip, previous / next, ←/→ keys, zoom and rotate. Submitting creates the case, and the inbox draft is removed.

"Reset demo" removes all `SF-RX-` drafts and clears the inbox log.

### Sample prescription photos
The photos are in `lab-prescription-inbox/assets/rx-<sample>-p<page>.jpg`. They're generated locally by `lab-prescription-inbox/scripts/generate-rx-photos.mjs`:
1. It draws a UK-style lab prescription pad.
2. It fills it in "by hand": handwriting fonts, ticks, circled teeth, rubber stamp, signature.
3. It "photographs" it on a desk: tilt, shadow, uneven light, grain and a fold crease.
4. It rasterises the result with macOS Quick Look and `sips`.

All names and numbers are fictional. The veneers sample has **2 pages**: the form, plus the back with a sketch.

Regenerate on macOS:

```bash
node "SALES Feedbacks/lab-prescription-inbox/scripts/generate-rx-photos.mjs"
```

## Design Studio: case-level design review and sign-off
A lab shares the link its CAD or planning software produces, such as an exocad webview, 3Shape Communicate, Medit Link, ClinCheck, Spark, uLab or Blue Sky Plan. The dentist reviews it from a secure link with **no account**:
1. They orbit the 3D view and **capture** it.
2. They mark it up with pen, highlighter, ellipse, arrow and text.
3. They comment, tag FDI teeth and **@mention** Anas, Mark or Lorna.
4. They approve or request changes.

Every submission writes an immutable sign-off record: who, when, and the version hash. For V2 onwards, the dentist gets **compare mode**: V1 is locked and V2 is live, linked orbit is on, and clicking a V1 capture flies both canvases to it. A carry-forward checklist blocks Approve until every V1 point is confirmed.

| Where | URL |
|---|---|
| Lab Studio, smile design demo | `/growth/cases/SG-2026-0481/studio?demo=1` (`?demo=1` shows the Smile design / Aligner plan switcher and Reset demo) |
| Lab Studio, aligner demo | `/growth/cases/SG-2026-0506/studio?demo=1` |
| Dentist, Case A V2 (opens in compare mid-flow) | `/review/rv_8kq2m4x9` |
| Dentist, Case B V2 (ClinCheck fallback, stage scrubber) | `/review/rv_3fp7w2c5` |
| Expired link | `/review/rv_expired01` |

There are two ways in from the lab portal:
- **Design Studio bar:** above Cases. The two demo cases also join the real Cases list, with the status Sent for Review.
- **Dock:** on the case detail page.

Submitted reviews push into the bell (`MOCK_NOTIFICATIONS`) at runtime. The lab and dentist tabs stay in step through localStorage `storage` events, so the link card flips to "Opened just now" live.

**Inside the case page.** Open any lab case with a design-type service (Clear Aligners, Veneers, Crown, Bridge or Retainer). The per-service menu (Details / Invoice / Shipping) gets a **Design review** item:
- **If a design exists,** the item shows the latest version, live link card, viewer, decision and sign-off, the dentist's captures with lab replies, and their files.
- **If there's no design yet,** it shows **No design shared yet**, with a **Share a design** button.
- It links to the full Studio page, which returns with **Back to case**.

**Sharing without a link.** The share modal has a **Paste a link | Upload files** switch:
- **File types:** STL (ASCII and binary), OBJ, PLY (ASCII and binary), PNG, JPG, WebP and PDF.
- **Size limit:** up to 50MB each. Anything else is rejected with a message.
- **Viewing:** meshes are parsed in the browser (no dependencies) and rendered in the same viewer, so orbit, capture and compare all work. Images open on an image stage where they can be captured and marked up. PDFs open in a new tab.
- **Mixed uploads:** a version with both a mesh and images gets a **3D model | Images** switch.
- **Storage:** files are stored in IndexedDB on this origin.

**Clinician uploads.** On the review link, the dentist can attach files in two ways:
- **Per capture:** with the **Attach** button, drag-and-drop, or ⌘V into an open capture.
- **For the whole review:** from **Attachments for the lab**.

The lab sees them under each capture, plus **Files from Dr. …**. Share next version lists them, with **Include in the next version**, and the bell notes how many files were attached.

**Code** (`design-studio/`):
- `data/designStudio.ts`: types, `PROVIDERS` and `detectProvider`, and the seeds
- `store/studioStore.ts`
- `viewer/`: `archModel.ts`, a procedural FDI arch; `renderArch.ts`, a canvas 2D renderer with no dependencies; `DesignViewer.tsx`, with ScanViewer's chrome copied; `StageScrubber.tsx`
- `markup/`
- `review/`: the dentist page
- `studio/`: the lab page, the share modal and the link card

## Clinician upload links
The lab asks a clinic for files on a specific case, without the clinic needing an account.

- **Where:** open a case and pick **Request files**, under Details / Invoice / Shipping / Design review. It shows on every case, and its chip reads New / Live / "N new" / Closed.
- **Creating a link:**
  - The lab ticks what it needs (CBCT / DICOM, intra-oral scan, clinical photos, X-rays, other).
  - It can add a short note, which is checked for anything that looks like a name, date of birth, NHS number, phone or email.
  - It picks an expiry (7, 14 or 30 days) and whether to require a 6-digit access code (on by default).
- **Sharing:** Copy link, Share on WhatsApp, Email, Copy message and Preview as clinic. The access code is never in the link or the message; it's sent separately.
- **The clinic's page, `/upload/:token`:** public and mobile-first.
  - It has a code gate. Five wrong codes lock the link for 15 minutes.
  - Expired, revoked and locked links show no case details at all.
  - The page reads only an allow-listed snapshot made when the link is created (`PublicCaseView` in `upload-links/uploadStore.ts`): the case ref, the patient's **initials**, the practice, the dentist, the service and the teeth, plus the lab's checklist, note and expiry date.
  - It never shows the patient's name, date of birth, contact details, clinical notes, prices or files already sent. The page is write-only.
- **What the clinic can upload:**
  - DICOM files or a whole DICOM folder. Extensionless files are detected by the `DICM` marker, and a folder becomes one "DICOM series" row. Headers are never read or shown.
  - ZIP, STL / PLY / OBJ, images and PDF, up to 500MB each.
  - The clinic ticks a box confirming it's authorised to share them.
- **The lab's side:**
  - Uploads appear in the case panel straight away, grouped by batch with the uploader's name.
  - The bell gets a "Files received" entry.
  - DICOM and ZIP files download; images and meshes open in the existing previews.
  - **New link** replaces (revokes) the old one, and **Revoke** turns it off.
- **Demo data:** SG-2026-0481 has a seeded link (code `418205`) with one batch already received.

## Website intake form
Every lab gets a standard, branded new-case form for its website.

- **Settings → Website Intake Form:**
  - Branding: logo upload (PNG / JPG / SVG / WebP, up to 2MB), the lab name, a welcome line and an accent colour.
  - Which services the form offers.
  - The form link, which you can rename (`/intake/<slug>`), plus copyable **embed code** (an iframe) and **button code**.
  - A live desktop / mobile preview, a list of recent requests, and a "Taking requests" switch.
- **The form, `/intake/:slug`:** add `?embed=1` for iframe use, which drops the page background. It has four steps:
  1. About you: name, GDC number, practice, postcode, email and phone.
  2. Patient: name, date of birth and an optional clinic reference.
  3. Prescription: the service, then the fields that service has turned on in the lab's **Prescription Builder**, plus files (the same DICOM-aware drop zone as upload links).
  4. Review & send, with a consent checkbox.
  A honeypot field and a 3-second minimum fill time quietly drop bots.
- **The result:**
  - Each submission becomes a **draft case** (`SF-WEB-…`, reference `WEB-0007` and up) in Cases. It opens in QuickCreate prefilled, with the sender pane filled in.
  - A **From your website** dock shows the dentist's details and attached files, and flags practices that aren't linked yet.
  - The bell gets an entry, and opted-in team members are emailed (simulated). Confirming the case through QuickCreate removes the draft.
- **Notifications:** managed in **Settings → Notifications**, in a "Website Intake Form" category. Each team member opts themselves in for the bell and for email ("New Case Request from Website"). The intake tab only links there. The bell entry follows the signed-in user's In-App setting, and the people to email are fixed when the request arrives.

## What's new (change log)
A sidebar item above Settings, shown only inside Growth Team Feedback (`/growth/updates`). It lists every feature and change in high-level buckets (Cases & intake, Design, Settings & notifications, Navigation), tagged **New** or **Changes the original design**.

- **Notes:** each update has a short note you can edit (pencil) or restore, saved in this browser.
- **Examples:** each update has buttons that open an example inside the portal (for example a case with `?sf=design` or `?sf=files` opens that case-page item), or the public page in a new tab.
- **Add update:** add your own entries (title, area, type, note, optional example page) as the work grows. The built-in entries live in `growth-portal/updatesStore.ts`.
- **Sidebar item:** attached at runtime above the Settings button (`growth-portal/WhatsNewNavItem.tsx`), with a badge for updates you haven't opened yet.

## Notification recipients
Under Settings → Notifications, the **Prescription Email Inbox** and **Website Intake Form** categories each have a **Notified by default** list. **Add people** picks team members from User Management, which turns the bell and email on for them; ✕ turns both off. Everyone can still adjust their own switches. Website requests start with the lab admin only.

## Known limitations
- **Settings sidebar:** `SettingsPage`'s tab list is internal to it, so `LabSettingsWithInbox` draws the same sidebar markup with one extra tab. Existing tabs render the real `SettingsPage`. `sandbox.css` hides that page's own header and sidebar, which depends on its root markup.
- **Notifications category:** it's appended under the real `NotificationPreferences`, because that catalogue is internal. The page's search box doesn't filter it.
- **In-App notifications:** the preferences are stored but nothing appears in the header bell. `Layout`'s popover reads a fixed mock list.
- **Source email pane:** QuickCreate's left pane still shows its built-in prescription mock. The real photo is in the photo dock and viewer, which sit over the unchanged QuickCreate screen.
- **Inbox bar placement:** `CasesPage` has no slot for page actions, so the inbox controls sit in a notice bar above it.
- **Clinic and dentist:** QuickCreate in lab mode doesn't pre-select them from a draft. This affects the portal's existing lab email drafts too.
- **No real email:** sending and receiving are simulated, and nothing leaves the browser.
- **Mirrored team list:** it copies Settings → User Management's mock team, because `mockMembers` isn't exported.
- **Not reachable from the main app:** the main app on port 5173 has no link to this sandbox. Wiring it in would need a route in `src/app/App.tsx` and a Tailwind content glob, which were declined to keep isolation.
- **Design Studio, 3D:** the 3D view is a procedural dental arch drawn by a small canvas renderer, because the user ruled out new dependencies. It isn't the provider's real mesh. It's flat-shaded, and sub-millimetre design changes are exaggerated so V1 and V2 look visibly different.
- **Design Studio, live embedding:** this never happens. Even "embeddable" providers show the preview, because the demo URLs aren't real. Non-embeddable providers show the "open in a new tab" note with Upload or paste a screenshot.
- **Design Studio, portal integration:**
  - CaseDetailPage can't take a new tab without editing it, so the Studio is its own page in the sandbox lab shell.
  - CasesPage can't show a Demo chip on its rows, so the chips sit on the Design Studio bar.
  - ScanViewer isn't exported, so its chrome is copied.
  - EmptyState only has two fixed types, so its markup is copied.
- **Design Studio, bell:** the popover always lists the lab's scanner reminders first, so the review notifications appear under them.
- **Design Studio, lint:** `npm run lint` can't run in this repo, because there's no ESLint config. The folder is checked with `tsc -p "SALES Feedbacks"` and the sandbox Vite build.
- **Design review on the case page:** `CaseDetailPage`'s per-service menu is internal, so the item is attached at runtime (`design-studio/studio/CaseDesignReviewSlot.tsx` + `sandbox.css`).
  - It finds the menu by its Details / Invoice / Shipping buttons, and depends on that markup. If it can't find the menu, a floating Design Studio card appears instead.
  - The review is case-level, so a multi-service case shows the same panel under each service.
- **Case status for real cases:** sharing a design on a non-demo case doesn't change its status in the Cases list. Writing it into the created-cases store would duplicate the row. The demo cases still sync.
- **Uploaded files are stored per browser.** They live in this browser's IndexedDB, so they don't follow the link to another device. The viewer says "file unavailable on this device" when that happens.
- **Uploaded meshes are flat-shaded** and decimated to about 8k faces, for the canvas renderer.
- **Upload links are simulated in the browser:** tokens, codes and lockouts all live in localStorage on this origin. A real build needs server-side tokens and code checks, rate limiting, virus scanning, audit logs and expiring storage. The prototype only proves the flow and the data-exposure rules.
- **Upload and intake files stay in this browser:** like design files, they're in IndexedDB, so the clinic's tab and the lab's tab must be the same browser profile. DICOM is stored and listed, not viewed.
- **The intake form reads the Prescription Builder in the same tab:** edits in Prescription Builder live in memory, so a form opened in a new tab uses the default fields.
- **Embedding:** the snippet works on any site that allows iframes, but the prototype's URL is localhost.
- **"Request files" item:** it uses the same runtime slot as Design review, and depends on the same Details / Invoice / Shipping markup. It has no floating fallback.
