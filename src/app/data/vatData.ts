// VAT Hub data — VAT return periods for the Dental Group portal.
//
// The return follows the UK HMRC 9-box structure, simplified to the boxes that
// matter here:
//   Box 1 — VAT due on sales (output VAT)          → MOCK (app has no sales data)
//   Box 4 — VAT reclaimed on purchases (input VAT) → REAL, derived from INVOICES
//   Box 5 — Net VAT to pay / reclaim = Box 1 − Box 4
//   Box 6 — Total sales ex-VAT                     → MOCK
//   Box 7 — Total purchases ex-VAT                 → REAL, derived from INVOICES
//
// Input-VAT figures are derived directly from the invoice-processing data
// (each invoice already carries `vatAmount` and gross `amount`), so they stay
// in sync with the Invoices screen. Output/sales figures are mocked per period
// because the prototype has no sales pipeline.

import { INVOICES, Invoice } from '../pages/InvoicesPage';

export type VatPeriodStatus = 'open' | 'ready' | 'submitted';

export interface VatPeriod {
  id: string;
  label: string;            // e.g. "Apr – Jun 2026"
  start: string;            // ISO date, inclusive
  end: string;              // ISO date, inclusive
  dueDate: string;          // ISO date — HMRC filing deadline
  status: VatPeriodStatus;
  outputVat: number;        // Box 1 (mock)
  salesNet: number;         // Box 6 (mock)
  receiptRef?: string;      // present once submitted
  submittedDate?: string;   // ISO date, present once submitted
}

// Calendar-quarter VAT periods. "Today" in the prototype is 2026-07-23, so
// Jul–Sep 2026 is still open, Apr–Jun 2026 has closed and is ready to file,
// and everything before that has already been submitted.
export const VAT_PERIODS: VatPeriod[] = [
  {
    id: '2026-q3', label: 'Jul – Sep 2026',
    start: '2026-07-01', end: '2026-09-30', dueDate: '2026-11-07',
    status: 'open', outputVat: 9600, salesNet: 48000,
  },
  {
    id: '2026-q2', label: 'Apr – Jun 2026',
    start: '2026-04-01', end: '2026-06-30', dueDate: '2026-08-07',
    status: 'ready', outputVat: 28400, salesNet: 142000,
  },
  {
    id: '2026-q1', label: 'Jan – Mar 2026',
    start: '2026-01-01', end: '2026-03-31', dueDate: '2026-05-07',
    status: 'submitted', outputVat: 27700, salesNet: 138500,
    receiptRef: 'HMRC-2026Q1-A8842', submittedDate: '2026-04-30',
  },
  {
    id: '2025-q4', label: 'Oct – Dec 2025',
    start: '2025-10-01', end: '2025-12-31', dueDate: '2026-02-07',
    status: 'submitted', outputVat: 25800, salesNet: 129000,
    receiptRef: 'HMRC-2025Q4-A7615', submittedDate: '2026-01-31',
  },
  {
    id: '2025-q3', label: 'Jul – Sep 2025',
    start: '2025-07-01', end: '2025-09-30', dueDate: '2025-11-07',
    status: 'submitted', outputVat: 24300, salesNet: 121500,
    receiptRef: 'HMRC-2025Q3-A6320', submittedDate: '2025-10-31',
  },
];

// Input VAT (Box 4) and purchases-net (Box 7) derived from real invoices whose
// date falls in the period. Rejected invoices are excluded; credit notes carry
// negative amounts/VAT, so they net off correctly.
export function computeInputVat(start: string, end: string): {
  inputVat: number;
  purchasesNet: number;
  invoices: Invoice[];
} {
  const invoices = INVOICES.filter(
    inv => inv.date >= start && inv.date <= end && inv.status !== 'rejected',
  );
  const inputVat = invoices.reduce((sum, inv) => sum + inv.vatAmount, 0);
  const purchasesNet = invoices.reduce((sum, inv) => sum + (inv.amount - inv.vatAmount), 0);
  return { inputVat, purchasesNet, invoices };
}

export interface VatReturn {
  box1: number;  // output VAT (sales)
  box4: number;  // input VAT (purchases) — reclaimable
  box5: number;  // net VAT: box1 − box4 (positive = pay HMRC, negative = reclaim)
  box6: number;  // total sales ex-VAT
  box7: number;  // total purchases ex-VAT
  invoices: Invoice[];
}

export function computeReturn(period: VatPeriod): VatReturn {
  const { inputVat, purchasesNet, invoices } = computeInputVat(period.start, period.end);
  const box1 = period.outputVat;
  const box4 = inputVat;
  return {
    box1,
    box4,
    box5: box1 - box4,
    box6: period.salesNet,
    box7: purchasesNet,
    invoices,
  };
}

export interface VatFlag {
  invoiceId: string;
  invoiceNumber: string;
  supplier: string;
  title: string;
  detail: string;
}

// The VAT quality checks mirror the invoice-processing rulebook
// (SpendSettingsPage r11 "VAT calculation mismatch", r13 "VAT number missing").
// We surface a flag when either (a) the invoice's own rule result failed, or
// (b) the numbers don't stand up to a computed check — VAT missing on a taxable
// invoice, or VAT that isn't ~20% of the net. Credit notes and statements are
// skipped (they legitimately carry no reclaimable VAT here).
const VAT_RULE_TITLES = ['VAT number missing', 'VAT calculation mismatch'];

export function vatFlagsForInvoices(invoices: Invoice[]): VatFlag[] {
  const flags: VatFlag[] = [];
  const push = (inv: Invoice, title: string, detail: string) => {
    if (flags.some(f => f.invoiceId === inv.id && f.title === title)) return;
    flags.push({ invoiceId: inv.id, invoiceNumber: inv.number, supplier: inv.supplier, title, detail });
  };

  for (const inv of invoices) {
    // (a) rulebook results already flagged during processing
    for (const r of inv.ruleResults) {
      if (VAT_RULE_TITLES.includes(r.title) && (r.result === 'fail' || r.result === 'warn')) {
        push(inv, r.title, r.detail);
      }
    }
    for (const issue of inv.issues) {
      if (/vat/i.test(issue)) push(inv, issue, 'Flagged during invoice processing');
    }

    // (b) computed checks — only on positive-value invoice documents
    const isInvoiceDoc = (inv.docType ?? 'invoice') === 'invoice';
    if (isInvoiceDoc && inv.amount > 0) {
      const net = inv.amount - inv.vatAmount;
      if (inv.vatAmount === 0) {
        push(inv, 'VAT number missing', 'No VAT recorded on a taxable invoice — VAT cannot be reclaimed');
      } else {
        const expected = net * 0.2;
        const tolerance = Math.max(0.5, expected * 0.02);
        if (Math.abs(inv.vatAmount - expected) > tolerance) {
          push(inv, 'VAT calculation mismatch', `VAT £${inv.vatAmount.toFixed(2)} is not 20% of net £${net.toFixed(2)}`);
        }
      }
    }
  }
  return flags;
}
