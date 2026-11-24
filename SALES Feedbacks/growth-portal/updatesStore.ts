import { useSyncExternalStore } from 'react';

// ── What's new: the Growth Team Feedback change log ──────────────────────────
// A high-level log of what this sandbox adds or changes, bucketed by area.
// Each update has a short note (editable, saved in this browser) and links to
// an example of the change. Anyone can also add their own update.

export type UpdateTag = 'new' | 'changed';

export interface UpdateExample {
  label: string;
  /** In-app path (stays in Growth Team Feedback), or a public page opened in a new tab. */
  to: string;
  newTab?: boolean;
  /** Subsection the link is listed under; worked out from the link when not set. */
  group?: string;
}

export interface Update {
  id: string;
  bucket: string;
  title: string;
  tag: UpdateTag;
  note: string;
  /** One short line shown on the page; the note sits behind "Details". */
  summary?: string;
  examples: UpdateExample[];
  custom?: boolean;
}

export const BUCKETS = ['Cases & intake', 'Case workflow (V2)', 'Billing', 'Design & CAD', 'Settings & notifications', 'Navigation'] as const;

export const BUILT_IN: Update[] = [
  {
    id: 'rx-inbox', bucket: 'Cases & intake', title: 'Prescription email inbox', tag: 'new',
    note: 'Each lab gets an inbox address. Lab staff email a photo of a paper prescription and AI creates a pre-filled draft case, with the photo viewable page by page inside the draft.',
    examples: [{ label: 'Inbox bar on Cases', to: '/growth/cases' }, { label: 'Inbox settings tab', to: '/growth/settings?tab=rx-inbox' }],
  },
  {
    id: 'lablink', bucket: 'Cases & intake', title: 'LabLink', tag: 'new',
    note: 'One branded link each lab puts on its website, in email signatures and auto-replies, in place of WeTransfer, Dropbox and the old per-case upload links. Dentists send either a new case or files for an existing case. A new case (with a delivery address) becomes a draft that shows the submitted order form, attachments and sender checks; once confirmed, the LabLink form sits as a tab next to the Smile Genius order form. Files quoting the case ID or scanner ref sync straight into the case; otherwise they wait on a Match files screen with the likely cases and why, and if the case can\'t be found the lab creates a new case from them. Everything lands in the case\'s Attachment files / Scans section, filterable by type and source.',
    examples: [
      { label: 'New-case draft (WEB-0005)', to: '/growth/cases/quick-new/SF-WEB-DEMO05' },
      { label: 'Confirmed case + order form (SG-2026-0519)', to: '/growth/cases/SG-2026-0519?sf=order' },
      { label: 'Files to match (WEB-0009)', to: '/growth/cases/quick-new/SF-WEB-F0009' },
      { label: 'Files synced into CASE-RS-2002', to: '/growth/cases/CASE-RS-2002?sf=attachments' },
      { label: 'No case found? Create one (WEB-0009)', to: '/growth/cases/quick-new/SF-WEB-F0009' },
      { label: 'LabLink form tab (SG-2026-0519)', to: '/growth/cases/SG-2026-0519?sf=order' },
      { label: 'LabLink settings', to: '/growth/settings?tab=intake-form' },
      { label: 'Dentist view: new case', to: '/lablink/smile-genius-lab?mode=new', newTab: true },
      { label: 'Dentist view: files for a case', to: '/lablink/smile-genius-lab?mode=files', newTab: true },
    ],
  },
  {
    id: 'bulk-actions', bucket: 'Cases & intake', title: 'Bulk Actions', tag: 'new',
    note: 'Everything works on the cases you tick. "Accept" moves ticked cases to In Production through the portal\'s own status update, with its override rules. Drafts can be ticked too, and moved to Received or Accepted in one go. Download files puts only the ticked cases in a ZIP; choose what to include (scans, CBCT, photos, documents, order forms, file list), how folders are named, and one ZIP or one per practice. Print order forms asks once: Smile Genius form, the original (scanner, LabLink or email), or both. Each lab user\'s choices are remembered, and are in Settings → Bulk Actions.',
    examples: [
      { label: 'Tick drafts on Cases', to: '/growth/cases?bulk=drafts' },
      { label: 'Download 2 cases', to: '/growth/cases?bulk=download&ids=CASE-RS-2002,SG-2026-0519' },
      { label: 'Print scanner + LabLink + email cases', to: '/growth/cases?bulk=print&ids=CASE-RS-2002,SG-2026-0519,SG-2026-0527' },
      { label: 'Your Bulk Actions defaults', to: '/growth/settings?tab=bulk-actions' },
    ],
  },
  {
    id: 'lab-documents', bucket: 'Cases & intake', title: 'Lab-branded order form, conformity statement and case label', tag: 'new',
    note: 'From the "Lab-branded order form & patient statement" spec (11 Nov): labs asked for their logo instead of ours, a statement at the bottom, and a signature, so they stop double-printing. A new Settings › Order form tab, with a live preview you can switch to any case. Branding: upload the lab logo and it replaces our mark at the top, with the lab\'s name, address and phone taken from Lab info, plus optional MHRA and DAMAS numbers; "Powered by Smile Genius", with our logo at a readable size, moves to the footer (also bigger on LabLink, invoices and the partner page). Field emphasis (dentist, patient, delivery date, instructions) is on by default. Conformity statement: one short, generic statement for every product, naming the UK Medical Devices Regulations 2002 and/or EU MDR 2017/745, printed at the bottom of the order form when switched on. UK and EU versions are set up separately; EU needs every manufacturing site and an EU authorised representative. It\'s signed with the signatory\'s typed name in a handwriting style, or a blank line to sign in ink, and ends with "a full statement is available from the lab on request". For those requests, the lab can preview, download or print a blank full statement from settings, with its own details filled in, and complete and sign it in wet ink. Case label (optional, off by default): a 62 × 100 or 102 × 152 mm delivery label with the dentist, practice and full address first, patient and product, the lab and its logo as sender, the case ID as a small reference, "custom-made device" and "Powered by Smile Genius". On a case, the order form\'s own Print button prints the form as set up here (no extra clicks); with labels on, "Print case label" sits in the bottom-right corner of the order form. Also from the print preview (any case) and Bulk Actions. The statement wording is not legal advice; Graham to review.',
    examples: [
      { label: 'Settings › Order form (with live preview)', to: '/growth/settings?tab=order-form', group: 'Settings' },
      { label: 'Branding: logo, MHRA, DAMAS, emphasis', to: '/growth/settings?tab=order-form&group=branding', group: 'Settings' },
      { label: 'Conformity statement: UK and EU', to: '/growth/settings?tab=order-form&group=statement', group: 'Settings' },
      { label: 'Full statement (blank, for wet ink)', to: '/growth/settings?tab=order-form&group=full', group: 'Settings' },
      { label: 'Case label (optional)', to: '/growth/settings?tab=order-form&group=label', group: 'Settings' },
      { label: 'A · Nothing set up (today\'s form)', to: '/growth/order-form/samples?config=A', group: 'Samples' },
      { label: 'B · Lab logo', to: '/growth/order-form/samples?config=B', group: 'Samples' },
      { label: 'C · Logo and UK statement, typed signature', to: '/growth/order-form/samples?config=C', group: 'Samples' },
      { label: 'D · UK and EU statements, signed in ink', to: '/growth/order-form/samples?config=D', group: 'Samples' },
      { label: 'E · EU without a representative', to: '/growth/order-form/samples?config=E', group: 'Samples' },
      { label: 'F · Case label', to: '/growth/order-form/samples?config=F', group: 'Samples' },
      { label: 'Print preview (pick any case)', to: '/growth/order-form/CASE-RS-2002', group: 'On a case' },
      { label: 'Print from the case (CASE-RS-2002)', to: '/growth/cases/CASE-RS-2002', group: 'On a case' },
      { label: 'Bulk print 2 cases', to: '/growth/cases?bulk=print&ids=CASE-RS-2002,CASE-RS-2003', group: 'On a case' },
    ],
  },
  {
    id: 'forwarded-emails', bucket: 'Cases & intake', title: 'Forwarded emails', tag: 'new',
    note: 'Lab staff forward any dentist email to the same inbox address as prescription photos. Every email becomes a draft in Cases, filled with what was read from it (patient, practice, service, teeth, shade, material, order type, needed-by date). Opening the draft shows the email: create a new case from it, where QuickCreate shows the real email, sets the order type and picks the clinic when only one matches; or add it to an existing case, where its files and text join the case\'s attachments. A case made from an email gets an Email tab next to the order form.',
    examples: [
      { label: 'Email draft → new case (Liam Foster)', to: '/growth/cases/quick-new/SF-FE-0005' },
      { label: 'Email draft → existing case (Isabella Hughes)', to: '/growth/cases/quick-new/SF-FE-0004' },
      { label: 'Case made from an email (SG-2026-0527)', to: '/growth/cases/SG-2026-0527?sf=email' },
      { label: 'All email drafts', to: '/growth/cases/emails' },
      { label: 'Forward an email', to: '/growth/cases?forward=1' },
    ],
  },
  {
    id: 'v2-workflow', bucket: 'Case workflow (V2)', title: 'V2: case handoff workflow (on top of V0)', tag: 'new',
    note: 'From the spec "Lab Case Handoff Workflow" (23 Nov). Switch versions with V0 · V1 · V2 at the bottom of every Growth page: V0 is the foundation, V1 adds the simpler Billing, V2 adds this workflow (with V0\'s Billing). After a case is Accepted, every service line (not the case) moves through its service\'s route of stages (Crown: Model → Design → Mill → Sinter → Ceramics → Quality Control), with one owner at a time. Done → next is one tap and the next person is assigned automatically (the stage\'s default person, or the same person continues; otherwise it waits In Queue for the team). Several lines can be pushed on at once. Block puts a line On Hold (Lab), with a reason, or On Hold (Practice), which notifies the practice; releasing returns it to where it was. Send back returns a line to an earlier stage with a reason (logged as rework); Skip passes a stage that isn\'t needed. The stage is a label on In Queue / In Production, so no new statuses; the clinic keeps seeing Submitted until Shipped.',
    examples: [
      { label: 'Dashboard: work in the lab today', to: '/growth?v=v2' },
      { label: 'A case\'s workflow (lines, notes, timeline)', to: '/growth/cases/CASE-053?sf=workflow&v=v2' },
    ],
  },
  {
    id: 'v2-queue', bucket: 'Case workflow (V2)', title: 'My queue, notes you must read, bench mode', tag: 'new',
    note: 'My queue (sidebar) opens to what you\'re working on and what\'s coming to you, by due date, with a red dot for unread notes and overdue in red; the intake owner sees To accept first. "Viewing as" switches person for the demo. Notes are either internal (amber) or to the dentist (blue), for the whole case or one line, and can be pinned to a stage ("for Ceramics"). With note acknowledgement on (a lab setting, Simply C&B\'s tick-box), the new owner ticks unread notes before the line can move; a dentist reply that changes the prescription counts as unread. Each docket line has a QR (Scan, in the demo) that opens bench mode on a tablet or phone: pick your name, enter a 4-digit PIN (Maria\'s is 4444 in the demo), then big buttons: Pick up, Done, Block, Mark shipped. Picking up a line someone else holds asks first and logs a takeover.',
    examples: [
      { label: 'My queue', to: '/growth/queue?v=v2' },
      { label: 'Overdue lines', to: '/growth/queue?filter=overdue&v=v2' },
      { label: 'Bench mode (a docket QR)', to: '/growth/bench/CASE-053%3Arr-s1?v=v2' },
    ],
  },
  {
    id: 'v2-calendar', bucket: 'Case workflow (V2)', title: 'Delivery calendar and dashboard blocks', tag: 'new',
    note: 'The delivery calendar (sidebar) shows one card per service line on its requested delivery date, week or month, with No date set on the left and Completed on the right; overdue lines roll forward to today with a badge; Not Approved and Cancelled are hidden behind a one-line banner. Filters: assigned (Me, a person, everyone), service, practice, status. Click a card to open it in place (date, reassign, the line\'s actions). On Overview, V2 adds the spec\'s blocks above the existing dashboard: Immediate Actions (overdue, due today + tomorrow, to accept with "on the way", on hold split Practice / Lab with the oldest hold, no delivery date), Work in the lab (In Queue / In Production per stage, plus Unassigned), This week (due per day) and Case processing (time to production, turnaround in days). Every number opens the lines behind it; all counts are service lines. The sandbox\'s Overview is a different screen from the one in the spec, so the blocks sit above it rather than inside it.',
    examples: [
      { label: 'Delivery calendar', to: '/growth/calendar?v=v2' },
      { label: 'Month view', to: '/growth/calendar?view=month&v=v2' },
      { label: 'Work in the lab: unassigned lines', to: '/growth/queue?filter=unassigned&v=v2' },
    ],
  },
  {
    id: 'v2-settings', bucket: 'Case workflow (V2)', title: 'Settings › Workflow, and invoicing per service line', tag: 'new',
    note: 'Admins only: every service gets a simple default route, editable (rename, reorder, add or remove stages; Quality Control stays last) with a default person per stage, "same person continues" or "anyone". Route edits apply forward to lines already in flight. Also: which route each service follows, the intake owner, note acknowledgement, the due-date buffer (requested delivery minus N days), shipping lines one at a time, the bench PIN, and assignment notifications (in-app and email per person). Billing in V2 is V0\'s, with one change from the spec: an invoice per service line, raised when the clinic marks the line received (Delivered), instead of one per case on Shipped.',
    examples: [
      { label: 'Settings › Workflow', to: '/growth/settings?tab=workflow&v=v2' },
    ],
  },
  {
    id: 'billing-v1', bucket: 'Billing', title: 'Billing V1: the simpler design', tag: 'new',
    note: 'Billing rebuilt around the lab\'s three jobs (get the bill out, get paid, know who\'s slipping) in four places: Home, Invoices, Practices, Settings. Same data and rules as before; nothing was removed, most of it now appears only when it matters. Find (⌘K, top of Billing) answers "how do I…" in the lab\'s own words and shows the path as well as going there, so labs find things without asking us. Demo-only controls (view as accountant, pretend Xero or bank events, a scan from a new practice, reset) moved into a Demo button, bottom left. The earlier design is V0: "Design: V1 · back to V0" in the Billing header switches back (and "try V1" returns).',
    examples: [
      { label: 'Billing (V1)', to: '/growth/billing?v=v1' },
      { label: 'Find: try "refund", "own prices" or "Leeds"', to: '/growth/billing?v=v1' },
    ],
  },
  {
    id: 'billing-home', bucket: 'Billing', title: 'Home: the month in three steps, and Needs you', tag: 'changed',
    note: 'Three numbers (owed, invoiced this month, paid this month), then the month in three steps: invoice the practices billed monthly, send statements (one check screen, then Send all), payments in. Below, one Needs you list with no sections: most money first, each item a sentence and a button (a practice new from a scan, something changed in Xero, invoices ready to send as one "Send all", an invoice to check, cases on hold, a bounced email, who\'s sending less). Empty means all clear. A "How do I…" strip links the common jobs.',
    examples: [
      { label: 'Home', to: '/growth/billing?v=v1' },
    ],
  },
  {
    id: 'billing-invoices', bucket: 'Billing', title: 'Invoices: one list, and Fix this invoice', tag: 'changed',
    note: 'One list with chips: Waiting for you · Unpaid · Overdue · Paid · All, plus search and Download. Statuses are plain words (Ready to send, Needs a look, Sent, Overdue, Paid). Tick invoices and the actions appear: Approve & send, Send a copy (to the practice or any address), Mark paid (no accounting tool), Archive (paid or cancelled; Show archived brings them back). Practices billed monthly show as one banner ("3 shipped cases ready") instead of a tab. On an invoice, one button, Fix this invoice, asks what\'s wrong in plain words and does the right correction: a price or line is wrong (corrected copy, same date and prices), wrong practice (moves it), give money back (credit note, CN series), or they paid.',
    examples: [
      { label: 'Unpaid invoices', to: '/growth/billing/invoices?show=unpaid&v=v1' },
      { label: 'Overdue', to: '/growth/billing/invoices?show=overdue&v=v1' },
      { label: 'Ready to invoice (monthly practice)', to: '/growth/billing/invoices?show=to-invoice&v=v1' },
      { label: 'Paid: tick and Archive', to: '/growth/billing/invoices?show=paid&v=v1' },
    ],
  },
  {
    id: 'billing-practices', bucket: 'Billing', title: 'Practices: accounts and insights in one place', tag: 'new',
    note: 'Accounts and Insights merged. The list shows each practice\'s health (New, Growing, Steady, Slowing, Gone quiet, against its own history), this month vs usual, what it owes and how fast it pays, with filters (owe money, overdue, slowing, billed monthly), a Dentists view, and Download (the list, billing by practice and dentist with the NHS / private split, and the reports). "Worth a call" sits on top. Practices that arrived with a scan show apart as New from scans: the practice was created so the case isn\'t held up, and its invoices wait until someone answers three questions (billing email, per case or monthly, terms). Each practice has one page: Send statement (any of the last three months, preview first), Send invoices (pick which, to any address), Add a note; then Overview, Invoices & statements, Dentists (who pays), Prices and Setup. Each dentist has a page too: send their invoices, or their statement if they pay directly.',
    examples: [
      { label: 'Practices', to: '/growth/billing/practices?v=v1' },
      { label: 'A practice that is slowing (Leeds)', to: '/growth/billing/practices/acc-p-smile-genius-leeds?v=v1' },
      { label: 'Monthly practice (London Central)', to: '/growth/billing/practices/acc-p-smile-genius-london-central?v=v1' },
      { label: 'Overseas, EUR, 45-day terms (Dublin)', to: '/growth/billing/practices/acc-p-smile-genius-dublin?tab=setup&v=v1' },
      { label: 'Dentist who pays directly (Dr. Campbell)', to: '/growth/billing/dentists/Dr.%20Campbell?v=v1' },
      { label: 'Dentists', to: '/growth/billing/practices?view=dentists&v=v1' },
    ],
  },
  {
    id: 'billing-pricing', bucket: 'Billing', title: 'Prices: per practice, standard, promotions', tag: 'changed',
    note: 'Account-based pricing lives on the practice\'s page › Prices: start from a % off everything, copy another practice\'s prices, or type their price on a few items (empty = your standard price), with the difference shown per item and one click back to standard prices. Your standard prices (catalog, dated price changes, bulk changes, import) are in Settings › Prices, with a list of practices that have their own. Promotions and volume discounts sit under Settings › More options: off until switched on, then two quick starts (10% off this month, 5% off over 50 units) and the full editor.',
    examples: [
      { label: 'A practice\'s own prices (London Central)', to: '/growth/billing/practices/acc-p-smile-genius-london-central?tab=prices&v=v1' },
      { label: 'Give Leeds its own prices', to: '/growth/billing/practices/acc-p-smile-genius-leeds?tab=prices&v=v1' },
      { label: 'Standard prices', to: '/growth/billing/settings/prices?v=v1' },
      { label: 'Promotions and volume discounts', to: '/growth/billing/settings/promotions?v=v1' },
    ],
  },
  {
    id: 'billing-case', bucket: 'Billing', title: 'Billing tab on the case', tag: 'changed',
    note: 'Lines priced from the account\'s list with where each price came from, NHS or private, stages billed so far, bought-in parts, the invoice number and status once billed (or "In To invoice" for practices billed monthly), Bill now, a possible-remake question and the on-hold banner. Remakes, NHS-or-private-unclear and scanner order types are checked on every new case.',
    examples: [
      { label: 'Staged denture (billed each stage)', to: '/growth/cases/CASE-DN-3001?sf=billing' },
      { label: 'Possible remake', to: '/growth/cases/CASE-RS-2002?sf=billing' },
    ],
  },
  {
    id: 'billing-setup', bucket: 'Billing', title: 'Settings: three questions, then More options', tag: 'changed',
    note: 'The basics are three questions: where do you keep your books (Xero, QuickBooks, Sage, FreeAgent, or none, then optionally Revolut or Wise), how do most practices pay (per case or monthly, with a confirm before it changes every practice), and when should they pay. Everything else has a default and one plain sentence under More options: check invoices before they\'re sent, let the accountant check them in Xero first, invoice layout, invoice on ship or completion, warranty remakes, statement of manufacture, statement day, promotions, credit limits, the Monday email and the thresholds that flag problems. "Where things live" points to the practice page for anything one practice does differently. Simulated: the tools, the bank and their notices.',
    examples: [
      { label: 'The basics', to: '/growth/billing/settings?v=v1' },
      { label: 'More options', to: '/growth/billing/settings/more?v=v1' },
    ],
  },
  {
    id: 'cad-board', bucket: 'Design & CAD', title: 'Design board (exocad & 3Shape)', tag: 'new',
    note: 'A new Design item in the sidebar. Every digital case becomes a CAD order in exocad or 3Shape (by restoration type), with the case details and scans filled in, and moves across the board: CAD order created, In design, With a partner, Awaiting dentist, Ready to manufacture, Manufacturing, Finishing, Dispatched. Cards show patient, teeth, due date, technician or partner and CAD, with overdue, waiting-on-dentist, queued and duplicate flags. Drag a card onto a technician to assign it, or along the lab columns (Dispatched starts the invoice). The connector is simulated until exocad and 3Shape partner access is agreed.',
    examples: [
      { label: 'Design board', to: '/growth/design' },
      { label: 'Partners', to: '/growth/design/partners' },
    ],
  },
  {
    id: 'cad-case', bucket: 'Design & CAD', title: 'CAD design tab on the case', tag: 'new',
    note: 'Next to Order form and Billing: the order as sent to CAD (reference, patient, client, due date, teeth, indication and material from the mapping, shade, implant), the scans with a one-click scan pack, and Open in CAD. Finished designs come back by hand for now: paste the exocad webview or 3Shape Communicate link, or upload the STL and screenshots, and confirm what was designed. Differences from the case (an extra unit, a crown that became an onlay) reprice the invoice draft and flag it. Send for approval creates a Design Studio review link; the dentist\'s answer moves the case on, with reminders, round history and the approved version on record.',
    examples: [
      { label: 'Veneers waiting on the dentist', to: '/growth/cases/SG-2026-0481?sf=cad' },
      { label: 'Possible duplicate order', to: '/growth/cases/CASE-051?sf=cad' },
      { label: 'Design differs from the case', to: '/growth/cases/CASE-001?sf=cad' },
    ],
  },
  {
    id: 'cad-partners', bucket: 'Design & CAD', title: 'Outsourced design and milling partners', tag: 'new',
    note: 'Send any case to a design or milling partner from the case. They get a secure link (no account) to download the scans and order details and upload the design, or confirm dispatch with a tracking number; the result lands on the same case. Late partners are flagged and reminded, and the case can be reassigned.',
    examples: [
      { label: 'Partners and late jobs', to: '/growth/design/partners' },
      { label: 'Partner\'s page (design, late)', to: '/partner/pt_demo01', newTab: true },
      { label: 'Partner\'s page (milling, shipped)', to: '/partner/pt_demo02', newTab: true },
    ],
  },
  {
    id: 'cad-settings', bucket: 'Design & CAD', title: 'Settings: CAD & design', tag: 'new',
    note: 'The ten CAD settings with defaults (CAD per restoration type, when to create the order, patient details, approval rules, reminder, partners, assignment), the indication and material mapping table, and the desktop connector: a guided setup (download, sign in, find exocad / 3Shape folders, where it runs, test order) and health per connector, with offline orders queued and delivered on reconnect.',
    examples: [
      { label: 'CAD & design settings', to: '/growth/settings?tab=cad' },
    ],
  },
  {
    id: 'design-studio', bucket: 'Design & CAD', title: 'Design Studio', tag: 'new',
    note: 'The lab shares a design with the dentist through a link. The dentist turns the 3D model, captures views, marks up and comments, then approves or requests changes. The lab replies point by point and shares the next version.',
    examples: [{ label: 'Lab\'s Design Studio', to: '/growth/cases/SG-2026-0481/studio?demo=1' }, { label: 'The dentist\'s review link', to: '/review/rv_8kq2m4x9', newTab: true }],
  },
  {
    id: 'design-on-case', bucket: 'Design & CAD', title: 'Design review inside the case', tag: 'changed',
    note: 'A new "Design review" item next to Details / Invoice / Shipping on the case page. Cases with no design get a button to share one, by link or by uploading files. Dentists can attach their own files for the lab.',
    examples: [{ label: 'A case with a design', to: '/growth/cases/SG-2026-0481?sf=design' }],
  },
  {
    id: 'notif-categories', bucket: 'Settings & notifications', title: 'New notification categories', tag: 'changed',
    note: 'Settings → Notifications gains "Prescription Email Inbox" and "LabLink" categories (LabLink has two: new case request, files for an existing case). Each person sets their own bell and email alerts, and admins can add default recipients from User Management.',
    examples: [{ label: 'Prescription inbox category', to: '/growth/settings?tab=notifications&focus=rx-inbox' }, { label: 'LabLink category', to: '/growth/settings?tab=notifications&focus=intake-form' }],
  },
  {
    id: 'settings-tabs', bucket: 'Settings & notifications', title: 'New Settings tabs', tag: 'changed',
    note: 'The Settings sidebar gets "Prescription Email Inbox", "LabLink (website form)", "Bulk Actions", "CAD & design" and "Order form" tabs below the existing ones. Every existing tab is unchanged.',
    examples: [
      { label: 'Prescription Email Inbox', to: '/growth/settings?tab=rx-inbox' },
      { label: 'LabLink', to: '/growth/settings?tab=intake-form' },
      { label: 'Bulk Actions', to: '/growth/settings?tab=bulk-actions' },
      { label: 'CAD & design', to: '/growth/settings?tab=cad' },
      { label: 'Order form', to: '/growth/settings?tab=order-form' },
    ],
  },
  {
    id: 'growth-portal', bucket: 'Navigation', title: 'Growth Team Feedback portal', tag: 'new',
    note: 'A card on the portal select screen opens this separate copy of the Lab portal. The real Lab, Clinic and DSO portals never show any of this work.',
    examples: [{ label: 'Portal select', to: '/portal-select' }],
  },
  {
    id: 'whats-new', bucket: 'Navigation', title: 'What\'s new log', tag: 'new',
    note: 'This page: a sidebar item above Settings that lists each change with a note and an example you can open.',
    examples: [{ label: 'You are here', to: '/growth/updates' }],
  },
];

/** The one-liners shown on the page (the full notes stay behind "Details"). */
const SUMMARY: Record<string, string> = {
  'rx-inbox': 'Email a photo of a paper prescription; AI makes a pre-filled draft case.',
  lablink: 'One link on the lab website for new cases and files; files match to the right case.',
  'bulk-actions': 'Tick cases or drafts to accept, download or print them, with saved defaults.',
  'lab-documents': 'Lab logo on the order form, a short conformity statement and a case label.',
  'forwarded-emails': 'Forwarded emails become drafts: make a new case or add to an existing one.',
  'v2-workflow': 'Service lines move through stages with one-tap handoffs; switch V0 · V1 · V2 at the bottom.',
  'v2-queue': 'My queue, notes to tick before starting, and bench mode with a PIN.',
  'v2-calendar': 'Delivery calendar by due date, and Work in the lab on the dashboard.',
  'v2-settings': 'Routes and default people per stage; one invoice per service line on Delivered.',
  'billing-v1': 'Billing in four places, ⌘K Find for "how do I…", and a switch back to V0.',
  'billing-home': 'The month in three steps, and one Needs you list (most money first).',
  'billing-invoices': 'One list with chips; Fix this invoice asks what\'s wrong in plain words.',
  'billing-practices': 'Accounts + insights: send statements or invoices from any practice or dentist.',
  'billing-case': 'Prices, NHS/private, stages and parts on the case, with Bill now.',
  'billing-pricing': 'Per-practice prices in a few clicks; promotions under More options.',
  'billing-setup': 'Three questions to set up; everything else under More options.',
  'cad-board': 'Every digital case as a CAD order, tracked across a drag-and-drop board.',
  'cad-case': 'The CAD order on the case: bring the design back, send it for approval.',
  'cad-partners': 'Send a case to a design or milling partner through a no-login link.',
  'cad-settings': 'CAD choices, approval rules, mapping table and the desktop connector.',
  'design-studio': 'Share a design with the dentist; they mark it up, approve or ask for changes.',
  'design-on-case': 'The design review sits on the case page, next to the case details.',
  'notif-categories': 'Notification categories for the inbox and LabLink, with default recipients.',
  'settings-tabs': 'New Settings tabs for the sandbox features.',
  'growth-portal': 'A separate copy of the Lab portal; the real portals never show this work.',
  'whats-new': 'This page.',
};

interface State { notes: Record<string, string>; custom: Update[]; seen: string[] }
const LS_KEY = 'salesFeedbacks.updates.v1';

function load(): State {
  try {
    const p = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null');
    if (p) return { notes: p.notes ?? {}, custom: p.custom ?? [], seen: p.seen ?? [] };
  } catch { /* corrupt or blocked */ }
  return { notes: {}, custom: [], seen: [] };
}
let state: State = load();
const listeners = new Set<() => void>();
function commit(next: State) {
  state = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* keep in memory */ }
  listeners.forEach(l => l());
}
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function useUpdates() {
  const s = useSyncExternalStore(subscribe, () => state);
  const all: Update[] = [...BUILT_IN.map(u => ({ ...u, summary: u.summary ?? SUMMARY[u.id], note: s.notes[u.id] ?? u.note })), ...s.custom];
  return { all, seen: s.seen, unseen: all.filter(u => !s.seen.includes(u.id)).length };
}
export function setNote(id: string, note: string) {
  if (state.custom.some(u => u.id === id)) commit({ ...state, custom: state.custom.map(u => (u.id === id ? { ...u, note } : u)) });
  else commit({ ...state, notes: { ...state.notes, [id]: note } });
}
export function addUpdate(u: Omit<Update, 'id' | 'custom'>) {
  commit({ ...state, custom: [{ ...u, id: `custom-${Date.now().toString(36)}`, custom: true }, ...state.custom] });
}
export function removeUpdate(id: string) { commit({ ...state, custom: state.custom.filter(u => u.id !== id) }); }
export function resetNote(id: string) { const n = { ...state.notes }; delete n[id]; commit({ ...state, notes: n }); }
export function markAllSeen() {
  const ids = [...BUILT_IN.map(u => u.id), ...state.custom.map(u => u.id)];
  if (ids.every(i => state.seen.includes(i))) return;
  commit({ ...state, seen: ids });
}
export const isEdited = (id: string) => id in state.notes;
