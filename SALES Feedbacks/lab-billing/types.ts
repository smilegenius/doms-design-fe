// ── Lab Invoicing & Accounting Sync: the data model ──────────────────────────
// Mirrors the spec (Oct 2026): one invoice per case, one statement per billing
// account at month end, settings at three levels (lab → account → item).
// Everything is mock data in this browser; Xero / QuickBooks are simulated.

export type Provider = 'xero' | 'quickbooks' | 'sage' | 'freeagent';
export type Bank = 'revolut' | 'wise';
export type Currency = 'GBP' | 'EUR' | 'USD';
export type OrderKind = 'NHS' | 'Private';
export type Unit = 'per unit' | 'per arch' | 'per case' | 'per item';
export type VatTreatment = 'exempt' | 'standard' | 'zero';
export type PassRule = 'cost' | 'cost-plus' | 'fixed';

export interface LabBillingSettings {
  vatRegistered: boolean;
  vatNumber: string;
  invoiceOn: 'dispatched' | 'completed';
  approval: 'review-all' | 'auto' | 'review-30';
  statementDay: 'last-working' | 'first';
  terms: '30' | 'eom-following' | 'custom';
  customTermsDays: number;
  som: 'off' | 'all' | 'per-account';
  warrantyRemakes: 'none' | 'zero';
  prefix: string;
  /** Advanced thresholds: the assists' numbers. */
  limitWarnPct: number;
  unusualPricePct: number;
  remakeDays: number;
  notBilledDays: number;
  passThroughMarkupPct: number;
  courierAddOn: boolean;
  /** v2: how approved invoices land in the accounting tool (draft only when the lab's accountant wants to sign off there). */
  postAs: 'approved' | 'draft';
  /** v2: invoice layout. Simple = one line per case; detailed = one line per product. */
  layout: 'simple' | 'detailed';
  /** v2: features most labs don't need stay off until a lab asks. */
  promotionsOn: boolean;
  limitsOn: boolean;
}

export interface AccountLimit {
  amount: number | null;
  overdueDays: number | null;
  atLimit: 'notify' | 'pause';
  tellPractice: boolean;
  message: string;
}

export interface BillingAccount {
  id: string;
  kind: 'practice' | 'dentist';
  name: string;
  /** Dentist accounts: the practices they work at (one, or several for a dentist who floats). */
  practices?: string[];
  /** Dentist accounts: at one practice, or floating across several. */
  scope?: 'single' | 'floating';
  /** Dentist accounts: who pays their cases. Practices always pay their own. */
  payer: 'practice' | 'dentist';
  xeroContactId: string | null;
  xeroContactName?: string;
  emails: string[];
  priceListId: string | null;
  limit: AccountLimit | null;
  /** Set when the limit was reached with "pause": new cases go On hold. */
  paused: boolean;
  currency: Currency;
  country: string;
  som: 'inherit' | 'on' | 'off';
  stagedOverride?: Record<string, 'end' | 'each'>;
  bounced?: { at: string; email: string; what: string }[];
  /** v2: per case on dispatch (default), or one invoice a month from "To invoice". */
  invoiceMode?: 'per-case' | 'month-end';
  /** v2: payment terms for this account (days); empty = the lab's terms. */
  termsDays?: number | null;
  /** v2: reception gets status updates (received, accepted, delivered); invoices go to `emails` only. */
  receptionEmail?: string;
  receptionUpdates?: boolean;
  /** v2: notes from Insights' Who to call. */
  notes?: { at: string; by: string; text: string }[];
  /** V1: created automatically when a scan arrived from a practice we hadn't billed before. */
  fromScan?: boolean;
  /** V1: a person checked who to bill (email, who pays, rhythm). Until then its invoices wait. */
  confirmedAt?: string;
}

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  department: string;
  unit: Unit;
  nhs: number | null;
  priv: number | null;
  staged: 'end' | 'each';
  stages?: { name: string; price: number }[];
  passThrough?: { rule: PassRule; value: number; showPart: boolean };
  vat: VatTreatment;
  /**
   * Price changes, each from a date. `nhs` / `priv` above are the prices before
   * the first change; a case is priced as of its received date (price lock), and
   * a change can be scheduled for a future date.
   */
  priceHistory?: PriceChange[];
  /** Archived: kept for invoices that used it, not used for new pricing. */
  archived?: boolean;
}

export interface PriceChange { from: string; nhs: number | null; priv: number | null; by?: string; note?: string }

export interface Department { name: string; accountCode: string; taxRate: string }

export interface PriceList { id: string; name: string; prices: Record<string, { nhs?: number; priv?: number }> }

export interface Promotion {
  id: string;
  name: string;
  from: string;
  to: string;
  scope: { kind: 'items' | 'departments' | 'accounts' | 'all'; ids: string[] };
  type: 'percent' | 'fixed';
  value: number;
  active: boolean;
}

export interface VolumeTier { id: string; name: string; minUnits: number; percentOff: number; active: boolean }

export type PriceSource =
  | { kind: 'override'; reason: string; by: string }
  | { kind: 'price-list'; list: string }
  | { kind: 'promotion'; promo: string }
  | { kind: 'tier'; tier: string }
  | { kind: 'catalog'; locked?: boolean }
  | { kind: 'pass-through'; rule: PassRule; cost: number }
  | { kind: 'stage'; stage: string }
  | { kind: 'unmapped' }
  | { kind: 'remake' };

export interface InvoiceLine {
  id: string;
  itemId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  /** Catalog price the line would have had, for "given away" and unusual-price checks. */
  listPrice: number;
  kind: OrderKind;
  source: PriceSource;
  vat: VatTreatment;
  /** VAT % charged on the line (0 when the lab isn't VAT-registered or the line is exempt). */
  vatPct: number;
  part?: { manufacturer: string; partNo: string };
}

export type InvoiceStatus = 'draft' | 'flagged' | 'sent' | 'part-paid' | 'paid' | 'void';

export interface Flag { kind: 'unusual-price' | 'new-order-type' | 'nhs-unclear' | 'remake' | 'review' | 'design-diff'; message: string }

export interface Payment { id: string; at: string; amount: number; ref: string }

export interface CreditNote { id: string; number: string; at: string; amount: number; reason: string; full: boolean }

export interface Invoice {
  id: string;
  /** v2: a month-end invoice covers several cases (caseId is the first). */
  cases?: string[];
  /** v2: settled and cleared from view (still in statements and reports). */
  archived?: boolean;
  /** v2: an Edit (void and reissue) keeps the original issue date. */
  keepIssuedAt?: string;
  /** V2 workflow: the service line (service item id) this invoice is for. */
  lineOf?: string;
  /** v2: posted to the accounting tool as a draft for the accountant. */
  postedAsDraft?: boolean;
  /** Set on approval (numbering continues from Xero). */
  number: string | null;
  caseId: string;
  accountId: string;
  /** Snapshot of the case at invoicing (invoices never change after sending). */
  patient: string;
  dentist: string;
  practice: string;
  stage?: string;
  createdAt: string;
  issuedAt: string | null;
  dueAt: string | null;
  currency: Currency;
  lines: InvoiceLine[];
  status: InvoiceStatus;
  flags: Flag[];
  payments: Payment[];
  creditNotes: CreditNote[];
  xeroId: string | null;
  /** The lab's VAT number at sending (sent invoices never change). */
  vatNumber?: string;
  som: boolean;
  /** Void & reissue: the invoice this replaced / was replaced by. */
  replaces?: string;
  replacedBy?: string;
  emailedTo?: string[];
  timeline: { at: string; text: string }[];
}

/** An invoice that lives in Xero but not in Smile Genius (from the old system, or raised in Xero). */
export interface XeroOnlyInvoice { number: string; accountId: string; date: string; due: string; amount: number; paid: number; currency: Currency; from: 'old-system' | 'xero'; /** v2: when it was paid (statements count it on its real date). */ paidAt?: string }

export interface Statement {
  id: string;
  accountId: string;
  period: string; // YYYY-MM
  status: 'preview' | 'sent';
  createdAt: string;
  sentAt?: string;
  opening: number;
  invoices: { number: string; date: string; amount: number }[];
  credits: { number: string; date: string; amount: number }[];
  payments: { ref: string; date: string; amount: number }[];
  closing: number;
  /** v2: invoices in the month, subtotalled by dentist (practice statements). */
  byDentist?: { dentist: string; amount: number; count: number }[];
  ageing: { current: number; d30: number; d60: number; d90: number };
  currency: Currency;
}

export interface CaseBilling {
  caseId: string;
  /** A completed case from before the current case list (billing history only). */
  history?: boolean;
  /** History cases: who and what, since they're no longer in the case list. */
  info?: { patient: string; dentist: string; item: string };
  /** Account the case bills to (resolved when first seen; dentists who pay directly get their own). */
  accountId: string;
  /** In billing time (ISO date). */
  receivedAt: string;
  dispatchedAt: string | null;
  kindOverride?: OrderKind;
  kindUnclear?: boolean;
  scannerOrderType?: string;
  /** The service item the scanner order type describes (the first one). */
  scannerItemId?: string;
  held?: boolean;
  heldAt?: string;
  releasedBy?: string;
  /** Billed by the old system before the switch-over. */
  billedElsewhere?: boolean;
  /** Dispatched but held back from auto-invoicing (for the "not yet billed" assist). */
  skipAuto?: boolean;
  remakeOf?: string;
  remakeDecision?: 'no-charge' | 'charge';
  /** What a no-charge remake would have cost (for the Given away report). */
  remakeValue?: number;
  parts?: { id: string; itemId: string; manufacturer: string; partNo: string; cost: number }[];
  stagesBilled?: string[];
  stoppedAt?: string;
  lineOverrides?: Record<string, { price: number; reason: string; by: string }>;
  /**
   * What was actually designed (from the CAD integration): when set, the invoice
   * is priced from these lines instead of the case's services. `diff` lists how
   * it differs from the case, flagged for the admin until `checked`.
   */
  designOverride?: { lines: { id: string; itemId: string; fdi: number[] }[]; diff: string[]; at: string; checked?: boolean };
}

export interface SyncEntry { id: string; at: string; kind: 'post' | 'payment' | 'contact' | 'credit' | 'void' | 'read' | 'error'; text: string }

export interface EmailLog { id: string; at: string; to: string[]; subject: string; what: 'invoice' | 'statement' | 'limit' | 'monday'; ref: string; bounced?: boolean }

export interface Templates { invoice: { subject: string; body: string }; statement: { subject: string; body: string }; limit: { subject: string; body: string } }

export interface SetupState {
  provider: Provider | null;
  org: string | null;
  plan: 'standard' | 'premium';
  steps: Record<'connect' | 'import' | 'match' | 'date' | 'wip' | 'test', boolean>;
  switchOver: string | null;
  liveAt: string | null;
  testInvoiceId: string | null;
}

export interface MondaySettings { enabled: boolean; to: string; time: string }

/** v2: something the sync needs a person for (Payment reconciliation, P5). Empty on a normal day. */
export interface SyncIssue {
  id: string;
  at: string;
  kind: 'edited-in-tool' | 'voided-in-tool' | 'sync-failed' | 'connection-expired' | 'bank-unmatched';
  invoiceId?: string;
  /** edited-in-tool: what differs. */
  ours?: string;
  theirs?: string;
  theirsTotal?: number;
  /** bank-unmatched: the payment and the two likeliest matches. */
  bankPaymentId?: string;
  attempts?: number;
}

export interface BankPayment { id: string; at: string; amount: number; ref: string; payer: string; matched?: string[]; accountId?: string; credit?: number }

export interface BillingState {
  version: number;
  settings: LabBillingSettings;
  setup: SetupState;
  accounts: BillingAccount[];
  catalog: CatalogItem[];
  departments: Department[];
  priceLists: PriceList[];
  promotions: Promotion[];
  tiers: VolumeTier[];
  orderTypeMap: Record<string, string>;
  cases: Record<string, CaseBilling>;
  invoices: Invoice[];
  xeroOnly: XeroOnlyInvoice[];
  statements: Statement[];
  sync: SyncEntry[];
  emails: EmailLog[];
  templates: Templates;
  monday: MondaySettings;
  nextNumber: number;
  /** v2: credit notes have their own series (CN-0001) so invoice numbers have no gaps. */
  nextCredit: number;
  firstStatementPreviewed: boolean;
  dismissed: string[];
  /** v2: payment reconciliation. */
  issues: SyncIssue[];
  bank: Bank | null;
  bankPayments: BankPayment[];
  /** v2: payer name → account, learned from confirmed bank matches. */
  payers: Record<string, string>;
  /** v2: demo switch: who is looking (the accountant login is read-only). */
  viewAs: 'admin' | 'accountant';
}
