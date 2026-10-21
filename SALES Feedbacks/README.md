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

## LabLink (the lab's website form)
LabLink is one branded link that each lab puts on its website, in email signatures and in auto-replies. It replaces the per-case clinician upload links, which have been removed. The aim is to stop dentists using WeTransfer and Dropbox. A dentist first picks what they're sending.

**A new case** (four steps):
1. About you: name, GDC number, practice, email and phone, plus the **delivery address** (practice address, town / city and postcode, all required).
2. Patient: name, date of birth and an optional clinic reference.
3. Prescription: the service, then the fields that service has turned on in the lab's **Prescription Builder**, plus files.
4. Review & send, with a consent checkbox.

It becomes a **draft** for the lab to check and confirm (see the next section).

**Files for an existing case** (two short steps):
1. **Details:** your name and the patient's name are required. Practice, email, a **case or scan reference** and the service are optional.
2. **Files & notes:** at least one file and a note are both required. Sending confirms the dentist can share them; there's no checkbox.

**"Other":** both modes always offer it as a service, for something the lab hasn't listed. A new case then asks "What do you need?", which is saved as "Requested item" on the order form.

Where the files go (`intake-form/fileMatching.ts`):
- **Exact reference:** the files **sync straight into that case**, and the bell says so. If a practice is given it must match; without one, the patient's name must match the case.
- **Anything less certain:** a **draft** row appears in Cases (`SF-WEB-F…`, service "Additional files"). Opening it shows the **Match files** screen (`intake-form/MatchFilesPage.tsx`):
  - what was sent, and the sender checks
  - up to three likely cases, each with its score and "Matched because" reasons. These use the portal's own `RescanMatchCard`, unchanged.
  - a search box for any other case
  - **Attach to {case}**, **Not a match**, or **Create a new case from these**. Use the last one when the original case never arrived (e.g. the scan didn't come through). It makes a LabLink new-case draft prefilled with the patient, dentist, practice, notes and files, marked "from WEB-…".
- **Like rescan detection,** nothing fuzzy is ever attached automatically.
- **Scoring:**
  - patient name (typos allowed): 35
  - practice ("SG Manchester" matches "Smile Genius Manchester"): 20
  - dentist surname: 15
  - service: 10
  - teeth: 10
  - case still open: 10
  - Equal scores go to the most recent case.

Applies to both kinds:
- **Files accepted:** DICOM files or folders, ZIP, STL / PLY / OBJ, images and PDF, up to 500MB each.
- **Spam checks:** a honeypot field and a 3-second minimum fill time quietly drop bots.
- **Address:** `/lablink/:slug`; `?mode=files` opens on "files" and `?embed=1` is for iframes. The old `/intake/:slug` redirects.

**Settings → LabLink (website form):**
- branding: logo, name, welcome line and accent colour
- which services are offered
- the link, embed code and button code
- a live preview
- recent requests, with their status (Draft, Confirmed, Synced by reference, Matched by the lab, Waiting to be matched)

**Case attachments** (`intake-form/CaseAttachmentsOverlay.tsx`):
- **What it lists:** the case page's **Attachment files / Scans** card shows the case's own files, labelled by where they came from (e.g. "iTero scanner"), plus everything LabLink added. Each LabLink file is labelled with the sender and how it was matched.
- **Filters:** by type (Scans · CBCT / DICOM · Photos · Documents) and by source (Scanner · LabLink · Lab).
- **Notes:** the dentist's notes sit above the list.
- **Deep link:** `?sf=attachments` scrolls to the card.

**Examples:**
- **WEB-0009:** files for "Marcus Reid", with no reference, waiting to be matched. The likely cases are CASE-RS-2004 and CASE-RS-2003.
- **WEB-0010:** files quoting ITR-CASE-55984, synced into **CASE-RS-2002**: a shade photo, a CBCT series and a PDF.

## LabLink new cases: draft to confirmed case
- **Example requests:** two are added automatically (`intake-form/intakeDemo.ts`):
  - **WEB-0005**, a draft that has just come in: a zirconia crown LL6 from an unverified dentist at an unknown practice, with lower and upper arch scans and a pre-op photo.
  - **WEB-0004**, already confirmed as case **SG-2026-0519**: six e.max veneers 13–23 from Dr. Murphy, with arch scans, smile and shade-tab photos and a signed mock-up approval PDF.
- **Draft screen:** the draft opens on the usual draft screen, but its source pane shows what was actually submitted instead of the email mock:
  - the checks to do first (GDC register, new practice)
  - the **Smile Genius order form**
  - the attachments
  The header pill reads "Website draft" and the tab reads "Website form" (`intake-form/IntakeFilesDock.tsx` + `sandbox.css`).
- **Confirming:** when the lab confirms with **Create case**, the draft becomes a real case. On that case, the order form panel gets a **LabLink form** tab next to the Smile Genius **Order form** and **Lab Documents**, with its own Print (`intake-form/CaseOrderFormTab.tsx`).
- **Deep links:** `/growth/cases/<id>?sf=order | design | files` opens that case-page item. What's new links to the draft, the confirmed case and its order form.

## Bulk Actions (`bulk-actions/`)
Everything works on what's ticked.
- **Cases:** tick rows and the list's own blue bulk bar gains three buttons.
  - **Accept:** opens the portal's own bulk status modal with **In Production** ("Accepted by Lab") picked, so its override reasons, CareStack hooks and confirmation apply.
  - **Download files.**
  - **Print order forms.**
- **Drafts:** the list can't select drafts, so the sandbox adds its own checkbox to draft rows (`DraftCheckboxes.tsx`). Ticked drafts get a blue bar with **Move to Received** / **Accept** (each makes a real case as New or In Production), plus Download and Print. Drafts and cases are never ticked together, and "Select all drafts" is on the top bar.
- **Download** (`BulkDialogs.tsx`, `zip.ts`): only the ticked cases. Choose:
  - what to include: scans, CBCT / DICOM, photos, documents, the Smile Genius form, the original form, the file list
  - folder names: Case ID, Case ID + patient, or Practice / Case ID
  - one ZIP, or one per practice

  The button shows the file count and approximate size.
- **Print:** only the ticked cases, with one question: the Smile Genius form, the original order form, or both. The original is the scanner order form (built from the case's scanner details), the LabLink form, the email, or the prescription photo. Cases with no original print their SG form or are skipped, and the order can be set.
- **Lab-branded SG order form** (`printForms.tsx`): the lab's logo top left and name top right (from Settings → LabLink; initials on the lab's colour without a logo), a small Smile Genius mark at the bottom. It's laid out as a table, so the header and footer repeat on every printed page. The same form goes into downloads.
- **Saved defaults** (`bulkDefaults.ts`, per lab user): every dialog has "Remember these choices" and opens with them next time. **Settings → Bulk Actions** shows, edits and resets them.
- **Deep links:** `?bulk=drafts` ticks every draft; `?bulk=download|print&ids=A,B` opens that dialog.

## Forwarded emails (`forwarded-email/`)
- **Every email becomes a draft:** the prescription inbox address takes any dentist email; photos of paper prescriptions still become AI drafts. Each other email becomes a **draft** in Cases straight away (`SF-FE-…`), filled with what was read from it: patient, practice, service, teeth, shade, material, order type, and a needed-by date from phrases like "end of next week".
- **Opening the draft** shows the **Email draft** screen (`EmailDraftPage.tsx`):
  - **Create a new case:** opens QuickCreate, whose source pane shows the **real email** (sender, forwarder, text, attachments, what was read), with no mock prescription and no LabLink. The order type is set from the email. The clinic is picked when exactly one matches the practice; otherwise the pane lists the matches for the lab to choose. On Create case, the case is linked to its email and gets an **Email** tab next to Order form / Lab Documents. The email's files show under Attachment files / Scans → Email, and bulk print uses the email as its original.
  - **Add to an existing case:** the email's files and text go to that case's attachments and the draft is removed. A reference in the email (case ID or scanner ref) matches the case directly; otherwise suggestions use the LabLink matching.
  - **Dismiss.**
- **All email drafts** are listed at `/growth/cases/emails`.
- **Examples:**
  - Isabella Hughes: a draft to add to CASE-RS-2002
  - Liam Foster: a draft to make into a new case
  - Hannah Price: already added to SG-2026-0519
  - Chloe Bennett: already made into SG-2026-0527, with its Email tab
  - "please see attached": search or dismiss

## Billing: lab invoicing and accounting sync (`lab-billing/`)
A **Billing** sidebar item (after Invoices, which stays the payables inbox) at `/growth/billing`, built from the "Lab Invoicing & Accounting Sync" spec. Every case is invoiced on dispatch, posted to Xero and emailed, payments are read back from Xero, and one statement per billing account goes out at month end. Admins only (Super Admin / Admin).

- **Billing home:** paid, pending and owed totals; flagged invoices with bulk approve; the On hold queue (release one case or lift the account's hold); smart-assist nudges; the month-end countdown with statement preview and send.
- **Case billing panel:** a **Billing** tab next to Order form / Lab Documents (`?sf=billing`). It shows the lines and where each price came from, the NHS / private toggle, stages billed so far, bought-in parts, the invoice, "Bill now", the remake question and the on-hold banner.
- **Invoice detail:** a lab-branded PDF preview (logo and name from Settings → LabLink) with an optional statement of manufacture. It has the timeline, Xero payments, a typed price with a reason, credit notes (partial or full), void & reissue (only when nothing is paid), resend and print.
- **Accounts:** three shapes of billing account: a practice, a dentist at one practice, or a dentist who floats across several practices (`practices[]`, `scope`).
  - **Add account** (practice or dentist; Xero contact matched or created), and on each account: who pays, the dentist's practices / the practice's dentists (add, remove), price list, emails, currency, statement of manufacture, staged billing overrides, limit with forecast and pause, balance and ageing, invoices, statements, bounced emails.
  - Cases not invoiced yet follow whoever pays (`reassignCases` in `ops.ts`); a dentist who pays directly takes the cases from their linked practices only. "Unlinked dentists" lists cases from practices a dentist isn't linked to.
- **Catalog:** add and edit items in full, archive them, and change prices from a date (today, back-dated or scheduled) with a price history (`priceHistory`); "Change prices" applies a % to a department or everything with rounding and a preview. Cases are priced as of their received date. Also VAT treatment (when VAT-registered), staged and component pricing, account codes per department, CSV import with a gap preview, and order types mapped once.
- **Promotions and tiers:** optional, with a who-qualifies preview. Which price wins: typed price, then the price list, promotion, volume tier, and finally the catalog price.
- **Billing settings:**
  - connect or disconnect Xero / QuickBooks (simulated sign-in); invoices approved while disconnected post on reconnecting
  - the nine lab settings with the spec's defaults, plus the advanced thresholds
  - email templates with the lab logo
  - the Xero connection, sync log and email log
- **Reports:** unbilled work, account trends, given away, remakes, product and price mix, and cash forecast. They share filters and export to CSV, plus a Monday email preview.
- **Engine:**
  - `engine.ts`: pricing, invoice lines, flags, limits, statements
  - `ops.ts`: create, approve, pay, holds, sync with the case list
  - `insights.ts`: assists and reports
  - `billingStore.ts`: state and actions in localStorage, under `salesFeedbacks.billing.v1`
- **Demo data:** `seed.ts`.
  - **Timeline:** the lab went live 90 days ago. Five months of completed cases (no longer in the case list) give the history, and the Growth case list gives the current work.
  - **Exceptions:** an unusual price, an unclear NHS/private case, an unmapped order type, two dispatched cases not yet billed, two possible remakes, an account on hold, one approaching its limit, a slow payer, a declining account, a dentist who pays directly, a EUR practice and a bounced email.
  - **Reset demo:** reseeds everything.

## CAD integration: exocad & 3Shape (`cad-integration/`)
From the "CAD Integration (exocad & 3Shape)" spec. Every digital case becomes a CAD order with its details and scans, and is tracked through design, dentist approval (through Design Studio) and manufacture. It's only in Growth Team Feedback.

- **Design board** (`/growth/design`, a new **Design** sidebar item after Cases): status columns, cards with patient, teeth, due date, technician or partner and CAD, and attention flags. Drag onto a technician to assign; drag along Ready → Manufacturing → Finishing → Dispatched (Dispatched starts the invoice in Billing). The columns the connector or dentist set aren't drop targets, but every card has a "Set status" override. The offline-connector banner sits above it, and there are demo buttons for Simulate 24h and Reset demo.
- **CAD design tab on the case** (`?sf=cad`, via `OrderPanelTab`):
  - the order sheet from the mapping, Open in CAD, scans and a scan-pack ZIP with standard names
  - edge cases: queued, waiting for scans, 3Shape inbox link, duplicate order (which to keep), unmapped indication (pick it and save it as a rule), call the dentist, cancelled
  - **Bring in the design** (manual for now): paste the exocad webview / 3Shape Communicate link, or upload files, then confirm what was designed. Differences go to Billing (`applyDesignToBilling` → `designOverride` on the billing case, a `design-diff` flag on the draft).
  - **Send for approval**: creates a Design Studio review link (`shareDesign`); `syncCad` reads the dentist's decision back (approved → Ready to manufacture; changes → In design with the comments in the CAD order notes; a third round flags a call). Reminders at the set hours, then a lab alert.
- **Partners** (`/growth/design/partners`) and the public **partner page** (`/partner/:token`, no login): download the pack, upload the design or confirm dispatch, late alerts, remind, reassign.
- **Settings → CAD & design:** the ten settings, the indication and material mapping table (catalog item → CAD indication and material for each CAD), connectors with health checks, and a guided connector setup.
- **Engine:** `engine.ts` (order mapping, which CAD, approval rules, design diff), `cadStore.ts` (state in localStorage `salesFeedbacks.cad.v1`, actions, `syncCad`, `cad-` bell events), `seed.ts` (both CADs, one connector offline, about 14 orders across the statuses and edge cases, two partners).

## What's new (change log)
A sidebar item above Settings, shown only inside Growth Team Feedback (`/growth/updates`). It lists every feature and change in high-level buckets (Cases & intake, Billing, Design & CAD, Design, Settings & notifications, Navigation), tagged **New** or **Changes the original design**.

- **Notes:** each update has a short note you can edit (pencil) or restore, saved in this browser.
- **Examples:** each update has buttons that open an example inside the portal (for example a case with `?sf=design` or `?sf=files` opens that case-page item), or the public page in a new tab.
- **Add update:** add your own entries (title, area, type, note, optional example page) as the work grows. The built-in entries live in `growth-portal/updatesStore.ts`.
- **Sidebar item:** attached at runtime above the Settings button (`growth-portal/WhatsNewNavItem.tsx`), with a badge for updates you haven't opened yet.

## Notification recipients
Under Settings → Notifications, the **Prescription Email Inbox** and **Website Intake Form** categories each have a **Notified by default** list. **Add people** picks team members from User Management, which turns the bell and email on for them; ✕ turns both off. Everyone can still adjust their own switches. Website requests start with the lab admin only.

## Known limitations
- **CAD integration is simulated:**
  - **No vendor access yet:** the connector (install, CAD detection, order creation, reading "in design", health) is a mock until exocad and 3Shape partner access is agreed.
  - **Designs come back by hand:** a share link or uploaded files. Screenshots aren't captured automatically.
  - **Approval comments:** the dentist approves on the existing Design Studio review page, which has no voice notes, so comments are text and pinned captures.
  - **Lab statuses stay in the CAD store:** Manufacturing, Finishing and Dispatched on the board don't change the case's status in the case list (that lives in `src/`).
  - **Scan files:** the scans in the scan pack are placeholders for files that live on the scanner portal; real uploaded files are included.
- **Billing is simulated:**
  - **Xero / QuickBooks:** the connection is mocked. Payments arrive with the "Payment arrives in Xero" buttons, and no email or PDF file is produced (Print gives the browser's PDF).
  - **Practice side:** nothing yet. The practice's invoice view and the on-hold banner are a follow-up.
  - **Data:** billing history cases aren't in the case list. The lab address on documents is a placeholder, and statement days and the Monday email don't run on a schedule.
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
- **LabLink is simulated in the browser:** a real build needs a server for submissions and matching, resumable uploads for multi-GB CBCT, virus scanning, UK data hosting, retention rules and audit logs. Dentist notifications ("we've matched your files") are simulated too.
- **Upload and intake files stay in this browser:** like design files, they're in IndexedDB, so the clinic's tab and the lab's tab must be the same browser profile. DICOM is stored and listed, not viewed.
- **The intake form reads the Prescription Builder in the same tab:** edits in Prescription Builder live in memory, so a form opened in a new tab uses the default fields.
- **Embedding:** the snippet works on any site that allows iframes, but the prototype's URL is localhost.
- **Attachments card overlay:** it depends on CaseDetailPage's "Attachment files / Scans" markup. The case's own files are still the portal's placeholders (scan-1.stl…) and can't be opened; LabLink files open in the real previews.
- **Website drafts reuse the email-draft screen:** a website request is saved like an email draft (status Draft, source Email), so it follows the portal's draft rules unchanged. It shows "Need Attention", nothing goes into production until the lab confirms it in QuickCreate, and confirming removes the draft. The existing screens also label it with the "AI" chip and an "enriched using AI" banner, and QuickCreate shows its built-in prescription mock, which can't be changed without editing `src/`. The **From your website** panel has the real details, including the "Sender not verified" check (GDC register link). The sender's name is kept exactly as typed.
- **Growth cases are saved continuously:** while `/growth` is open, its cases are saved to the Growth store every time the list changes. A page reload therefore restores exactly what's there, and never brings back a draft that was already confirmed.
- **Generated example scans** are simple lathed tooth shapes laid out as an arch: placeholders for real intra-oral scans.
- **Bulk selection is read from the page:** the ticked rows in the Cases table view (table view only). Draft checkboxes are added to the table's empty checkbox cells. Seeded drafts turned into cases are hidden only inside `/growth`.
- **The scanner order form** is built from the case's scanner details, not the scanner's own PDF.
- **The clinic is picked in QuickCreate only when exactly one clinic matches the practice name,** because the portal's clinic list uses names like "Smile Genius Belfast 1".
- **Forwarded-email reading is simple pattern matching,** standing in for the real AI step.
