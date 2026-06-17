import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText, Upload, Download, Search, Mail, Plus,
  CheckCircle2, Clock, AlertTriangle, XCircle, Archive,
  X, Building2, Calendar, Hash, ChevronDown, ChevronUp,
  ShieldCheck, AlertCircle, CheckCircle, Ban,
  UserCheck, Filter, RefreshCw, MessageSquare, Zap,
  SlidersHorizontal, Grid3x3, List, Trash2,
  Send, CheckCheck, Pencil, Save, Check, FolderOpen, Star, FileSpreadsheet,
  ExternalLink, ArrowLeft,
} from 'lucide-react';
import { EXPENSE_CATEGORIES, mockSuppliers, GL_ACCOUNTS, Supplier } from '../data/suppliersData';
import ModalPortal from '../components/ModalPortal';
import Button from '../components/Button';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import FilterDrawer from '../components/FilterDrawer';
import SortDropdown from '../components/SortDropdown';
import { useToast } from '../context/ToastContext';
import { useLockBodyScroll } from '../components/useLockBodyScroll';
import { Maximize2, Minimize2, ArrowRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type InvoiceStatus = 'qc_review' | 'awaiting_approval' | 'disputed' | 'rejected' | 'approved' | 'exported_for_payment' | 'payment_processed' | 'archived';
type InvoiceSource = 'email' | 'manual' | 'api';
type BilledTo = 'all' | 'clinic' | 'dentist' | 'group_hq';
// AI-detected document type. Email pulls in anything — not always an invoice.
export type DocType = 'invoice' | 'credit_note' | 'statement' | 'quote' | 'receipt' | 'other';

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  invoice:     'Invoice',
  credit_note: 'Credit Note',
  statement:   'Statement',
  quote:       'Quote',
  receipt:     'Receipt',
  other:       'Other',
};

const DOC_TYPE_TONE: Record<DocType, { bg: string; fg: string; border: string }> = {
  invoice:     { bg: 'bg-[#EEF4FF]', fg: 'text-[#1565C0]', border: 'border-[#C8D8FC]' },
  credit_note: { bg: 'bg-[#FDF4FF]', fg: 'text-[#9D174D]', border: 'border-[#F5D0FE]' },
  statement:   { bg: 'bg-[#F0FDF4]', fg: 'text-[#2E7D32]', border: 'border-[#BBF7D0]' },
  quote:       { bg: 'bg-[#FFFBEB]', fg: 'text-[#92400E]', border: 'border-[#FDE68A]' },
  receipt:     { bg: 'bg-[#F5F3FF]', fg: 'text-[#5B21B6]', border: 'border-[#DDD6FE]' },
  other:       { bg: 'bg-[#F3F4F6]', fg: 'text-[#374151]', border: 'border-[#D1D5DB]' },
};

export function DocTypeChip({ type, size = 'sm' }: { type: DocType; size?: 'sm' | 'md' }) {
  const tone = DOC_TYPE_TONE[type];
  return (
    <span className={`inline-flex items-center ${size === 'md' ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-0.5 text-[10px]'} rounded-full font-semibold whitespace-nowrap border ${tone.bg} ${tone.fg} ${tone.border}`}>
      {DOC_TYPE_LABEL[type]}
    </span>
  );
}

// Inline-editable doc type chip — click to reclassify (used in the overlay header).
function DocTypeEditor({ value, onChange }: { value: DocType; onChange: (v: DocType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  const tone = DOC_TYPE_TONE[value];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Change document type"
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full font-semibold whitespace-nowrap border hover:shadow-sm transition-shadow ${tone.bg} ${tone.fg} ${tone.border}`}
      >
        {DOC_TYPE_LABEL[value]}
        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
      </button>
      {open && (
        <div className="absolute z-40 left-0 top-full mt-1 w-44 bg-white border border-[#E0E0E6] rounded-lg shadow-xl py-1">
          {(Object.keys(DOC_TYPE_LABEL) as DocType[]).map(t => {
            const selected = t === value;
            return (
              <button
                key={t}
                onClick={() => { onChange(t); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 hover:bg-[#F8F9FC] transition-colors ${selected ? 'text-[#4D8EF7] font-medium' : 'text-[#030213]'}`}
              >
                <span className="flex items-center gap-2">
                  <DocTypeChip type={t} />
                </span>
                {selected && <Check className="w-3 h-3 text-[#4D8EF7]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface RuleResult {
  id: string; group: string; title: string;
  result: 'pass' | 'fail' | 'warn' | 'skip';
  detail: string; weight: number; type: 'score' | 'stop';
}

interface ApprovalStep {
  name: string;    // approver display name
  role: string;    // e.g. "Clinic Manager", "CFO"
  done: boolean;
  ts?: string;     // formatted timestamp when approved
}

interface TimelineStep {
  label: string; done: boolean;
  timestamp?: string; sub?: string;
  // Visual marker for where the invoice currently sits in the pipeline.
  // 'current'  — actively waiting / in progress (the dot pulses blue)
  // 'blocked'  — on hold (disputed / rejected); the dot pulses red and is filled red
  // undefined  — neutral: render the done/pending state as before
  state?: 'current' | 'blocked';
  // Multi-approval chain — shown as a sub-list inside the Approval step
  approvalChain?: ApprovalStep[];
}

// Email thread on a disputed invoice. Persists across overlay opens.
export interface DisputeEmail {
  id: string;
  direction: 'outbound' | 'inbound';
  from: string;        // display name
  fromEmail: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;      // formatted timestamp
}

// Activity log entry on an invoice — approvals, rejections, reassignments, notes.
export interface ActivityEntry {
  id: string;
  type: 'approved' | 'rejected' | 'disputed' | 'note' | 'edited' | 'archived' | 'reopened' | 'submitted';
  actor: string;
  ts: string;       // formatted timestamp
  note?: string;
  // Optional field-level diff shown for 'edited' entries
  changes?: { field: string; from: string; to: string }[];
}

interface InvoiceEditPatch {
  number: string;
  date: string;
  dueDate: string;
  categories: string[];
  billedTo: 'clinic' | 'dentist' | 'group_hq';
  billedToName: string;
  entity: string;
  lineItems: { description: string; qty: number; unitPrice: number; total: number; matchedCaseId?: string }[];
  amount: number;
  vatAmount: number;
}

export interface Invoice {
  id: string; number: string; supplier: string;
  // AI-detected document type. Defaults to 'invoice' when omitted so existing rows render unchanged.
  docType?: DocType;
  categories: string[];
  billedTo: 'clinic' | 'dentist' | 'group_hq';
  billedToName: string;
  entity: string;
  amount: number; currency: string;
  vatAmount: number;
  date: string; dueDate: string; receivedAt: string;
  source: InvoiceSource; status: InvoiceStatus;
  ragScore: number; ragColor: 'green' | 'amber' | 'red';
  aiConfidence: number;
  assignedTo?: string; approvalRule?: string;
  issues: string[];
  ruleResults: RuleResult[];
  timeline: TimelineStep[];
  lineItems?: { description: string; qty: number; unitPrice: number; total: number; matchedCaseId?: string }[];
  // Email dispute thread — when non-empty the listing shows a "thread started" indicator
  // and the overlay opens straight into the dispute modal.
  disputeEmails?: DisputeEmail[];
  // Activity timeline — approvals, rejections, reassignments, notes.
  activity?: ActivityEntry[];
  // The GL/nominal code flagged as the primary code for export (e.g. to Xero).
  defaultNominalCode?: string;
  // Multi-step approval chain: shows each required approver + their status.
  approvalChain?: ApprovalStep[];
}

// ─── Mock data ─────────────────────────────────────────────────────────────────
export const INVOICES: Invoice[] = [
  {
    id: 'inv_001', number: 'LAB-2024-4821', docType: 'invoice',
    supplier: 'Kingsbridge Dental Lab', categories: ['Dental Labs', 'Clinical'],
    billedTo: 'clinic', billedToName: 'Smile Genius Manchester', entity: 'Clinic',
    amount: 248.50, currency: 'GBP', vatAmount: 41.42,
    date: '2026-05-12', dueDate: '2026-06-12', receivedAt: '2026-05-12T09:14:00Z',
    source: 'email', status: 'payment_processed', ragScore: 92, ragColor: 'green', aiConfidence: 96,
    assignedTo: 'Auto-approved', approvalRule: 'Lab · Clinic/Dentist · £0–£300',
    issues: [],
    ruleResults: [
      { id: 'r1', group: 'Supplier Risk', title: 'Supplier not approved', result: 'pass', detail: 'Supplier is fully approved and active', weight: 12, type: 'score' },
      { id: 'r2', group: 'Supplier Risk', title: 'New supplier detected', result: 'pass', detail: 'Supplier has 24 previous invoices', weight: 2, type: 'score' },
      { id: 'r3', group: 'Supplier Risk', title: 'Supplier is paused', result: 'pass', detail: 'Supplier status: Active', weight: 0, type: 'stop' },
      { id: 'r4', group: 'Duplicate & Fraud', title: 'Duplicate Check', result: 'pass', detail: 'No duplicate invoice number found', weight: 0, type: 'stop' },
      { id: 'r5', group: 'Duplicate & Fraud', title: 'Amount Within Norm', result: 'pass', detail: 'Amount within normal range (avg £231)', weight: 0, type: 'stop' },
    ],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '12 May 2026, 09:14', sub: 'received via email' },
      { label: 'AI parsed & matched', done: true, timestamp: '12 May 2026, 09:14', sub: 'Confidence 96%' },
      { label: 'Auto-approved', done: true, timestamp: '12 May 2026, 09:15', sub: 'Rule: Lab · £0–£300' },
      { label: 'Posted to Xero', done: false },
    ],
    lineItems: [
      { description: 'Full Ceramic Crown – Upper Right 6', qty: 1, unitPrice: 98.50, total: 98.50, matchedCaseId: 'CASE-001' },
      { description: 'Zirconia Bridge 3 Unit', qty: 1, unitPrice: 150.00, total: 150.00, matchedCaseId: 'CASE-002' },
    ],
    activity: [
      { id: 'a-001-1', type: 'approved', actor: 'System (Auto rule)', ts: '12 May 2026, 09:15', note: 'Auto-approved under rule "Lab · £0–£300".' },
    ],
    defaultNominalCode: '2520',
  },
  {
    id: 'inv_002', number: 'INV-55902', docType: 'invoice',
    supplier: 'Patterson Dental UK', categories: ['Equipment', 'Clinical'],
    billedTo: 'dentist', billedToName: "Dr. James O'Connor", entity: 'Dentist',
    amount: 1340.00, currency: 'GBP', vatAmount: 223.33,
    date: '2026-05-13', dueDate: '2026-06-13', receivedAt: '2026-05-13T11:02:00Z',
    source: 'email', status: 'awaiting_approval', ragScore: 78, ragColor: 'amber', aiConfidence: 81,
    assignedTo: 'Clinic Manager', approvalRule: 'Lab · Clinic/Dentist · £300–£1500',
    issues: ['Amount 18% above 90-day average for this supplier'],
    ruleResults: [
      { id: 'r1',  group: 'Supplier Risk',            title: 'Supplier not approved',     result: 'pass', detail: 'Supplier is fully approved and active',          weight: 12, type: 'score' },
      { id: 'r2',  group: 'Supplier Risk',            title: 'New supplier detected',     result: 'pass', detail: 'Supplier has 56 previous invoices',              weight: 2,  type: 'score' },
      { id: 'r3',  group: 'Supplier Risk',            title: 'Supplier is paused',        result: 'pass', detail: 'Supplier status: Active',                        weight: 0,  type: 'stop'  },
      { id: 'r4',  group: 'Duplicate & Fraud Checks', title: 'Duplicate Check',           result: 'pass', detail: 'No duplicate found',                             weight: 0,  type: 'stop'  },
      { id: 'r5',  group: 'Duplicate & Fraud Checks', title: 'Amount Within Norm',        result: 'warn', detail: 'Amount is 18% above 90-day average (£1,136)',    weight: 0,  type: 'stop'  },
      { id: 'r7',  group: 'Invoice Compliance',       title: 'Document Is An Invoice',    result: 'pass', detail: 'Recognized invoice document',                    weight: 0,  type: 'stop'  },
      { id: 'r8',  group: 'Invoice Compliance',       title: 'Missing invoice number',    result: 'pass', detail: 'Invoice number INV-55902 detected',              weight: 10, type: 'score' },
      { id: 'r9',  group: 'Spend & Price Checks',     title: 'Line Math',                 result: 'pass', detail: 'All 3 line items balance to subtotal',           weight: 10, type: 'score' },
      { id: 'r11', group: 'Spend & Price Checks',     title: 'VAT calculation mismatch',  result: 'pass', detail: '20% VAT matches calculated £223.33',             weight: 5,  type: 'score' },
      { id: 'r13', group: 'Spend & Price Checks',     title: 'VAT number missing',        result: 'pass', detail: 'VAT No: GB 123 456 789 present',                 weight: 5,  type: 'score' },
      { id: 'r14', group: 'Clinic / Entity Matching', title: 'No addressable entity',     result: 'pass', detail: "Matched to dentist: Dr. James O'Connor",         weight: 10, type: 'score' },
      { id: 'r16', group: 'Clinic / Entity Matching', title: 'Dentist mismatch',          result: 'pass', detail: 'Dentist on file at Smile Genius Manchester',     weight: 10, type: 'score' },
      { id: 'r22', group: 'Dates & timing',           title: 'Due Date OK',               result: 'pass', detail: 'Due 13 Jun 2026 — 23 days away',                 weight: 9,  type: 'score' },
    ],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '13 May 2026, 11:02', sub: 'received via email' },
      { label: 'AI parsed & matched', done: true, timestamp: '13 May 2026, 11:03', sub: 'Confidence 81%' },
      { label: 'Awaiting Approval', done: true, timestamp: '13 May 2026, 11:03', sub: 'Assigned to Clinic Manager' },
      { label: 'Approved', done: false },
      { label: 'Posted to Xero', done: false },
    ],
    lineItems: [
      { description: 'Composite Restorative Kit', qty: 2, unitPrice: 340.00, total: 680.00, matchedCaseId: 'CASE-003' },
      { description: 'Sterilisation Pouches 200pk', qty: 3, unitPrice: 120.00, total: 360.00, matchedCaseId: 'CASE-004' },
      { description: 'Disposable Gloves Nitrile L (x1000)', qty: 1, unitPrice: 300.00, total: 300.00, matchedCaseId: 'CASE-005' },
    ],
    activity: [
      { id: 'a-002-1', type: 'submitted', actor: 'System', ts: '13 May 2026, 11:02', note: 'Received via email from Patterson Dental UK.' },
      { id: 'a-002-2', type: 'note', actor: 'Clinic Manager', ts: '14 May 2026, 09:30', note: 'Amount 18% above 90-day average — requested clarification from supplier before approving.' },
    ],
    defaultNominalCode: '3620',
    approvalChain: [
      { name: 'Sarah Chen',  role: 'Clinic Manager', done: true,  ts: '14 May 2026, 09:45' },
      { name: 'Mark Powell', role: 'Finance Lead',   done: false },
    ],
  },
  {
    id: 'inv_003', number: 'DL-9003-B', docType: 'invoice',
    supplier: 'Eurodontic Ltd', categories: ['Dental Labs', 'Implant Suppliers'],
    billedTo: 'group_hq', billedToName: 'SmileGenius Group HQ', entity: 'Group HQ',
    amount: 3200.00, currency: 'GBP', vatAmount: 533.33,
    date: '2026-05-11', dueDate: '2026-06-11', receivedAt: '2026-05-11T14:45:00Z',
    source: 'email', status: 'awaiting_approval', ragScore: 61, ragColor: 'amber', aiConfidence: 74,
    assignedTo: 'Group Finance', approvalRule: 'Lab · Dental Group · £0–£2500',
    issues: ['Invoice amount exceeds rule threshold of £2,500', 'PO number missing'],
    ruleResults: [
      { id: 'r1', group: 'Supplier Risk', title: 'Supplier not approved', result: 'pass', detail: 'Supplier is approved', weight: 12, type: 'score' },
      { id: 'r2', group: 'Supplier Risk', title: 'New supplier detected', result: 'pass', detail: 'Supplier has 8 previous invoices', weight: 2, type: 'score' },
      { id: 'r3', group: 'Supplier Risk', title: 'Supplier is paused', result: 'pass', detail: 'Supplier status: Active', weight: 0, type: 'stop' },
      { id: 'r4', group: 'Duplicate & Fraud', title: 'Duplicate Check', result: 'pass', detail: 'No duplicate found', weight: 0, type: 'stop' },
      { id: 'r5', group: 'Duplicate & Fraud', title: 'Amount Within Norm', result: 'warn', detail: 'Amount exceeds rule band max (£2,500)', weight: 0, type: 'stop' },
    ],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '11 May 2026, 14:45', sub: 'received via email' },
      { label: 'AI parsed & matched', done: true, timestamp: '11 May 2026, 14:46', sub: 'Confidence 74%' },
      { label: 'QC Review', done: true, timestamp: '11 May 2026, 14:46', sub: 'Assigned to Group Finance' },
      { label: 'Approved', done: false },
      { label: 'Posted to Xero', done: false },
    ],
    lineItems: [
      { description: 'Implant Crown PFM x8', qty: 8, unitPrice: 220.00, total: 1760.00, matchedCaseId: 'CASE-006' },
      { description: 'Nightguard Splint Hard', qty: 4, unitPrice: 210.00, total: 840.00, matchedCaseId: 'CASE-007' },
      { description: 'Impression Trays Custom x5', qty: 5, unitPrice: 120.00, total: 600.00, matchedCaseId: 'CASE-008' },
    ],
    activity: [
      { id: 'a-003-1', type: 'submitted', actor: 'System', ts: '11 May 2026, 14:45', note: 'Received via email from Eurodontic Ltd.' },
      { id: 'a-003-2', type: 'edited', actor: 'Group Finance', ts: '12 May 2026, 10:20', note: 'Corrected line item to match delivery note GD-2026-0311.', changes: [{ field: 'Line 1 · Qty', from: '10', to: '8' }, { field: 'Line 1 · Total', from: '£2,200.00', to: '£1,760.00' }, { field: 'Invoice total', from: '£3,640.00', to: '£3,200.00' }] },
      { id: 'a-003-3', type: 'note', actor: 'Group Finance', ts: '12 May 2026, 10:22', note: 'Invoice exceeds rule band max (£2,500). Escalated for dual sign-off. PO number DL-9003 requested from supplier.' },
    ],
    defaultNominalCode: '2520',
    approvalChain: [
      { name: 'Sarah Chen',   role: 'Group Finance',  done: true,  ts: '12 May 2026, 10:25' },
      { name: 'Dr. J Walsh',  role: 'Clinical Lead',  done: false },
      { name: 'Mark Powell',  role: 'CFO',            done: false },
    ],
  },
  {
    id: 'inv_004', number: 'INV-20250509-001', docType: 'invoice',
    supplier: 'FreshSmile Supplies', categories: ['Clinical', 'Raw Materials'],
    billedTo: 'clinic', billedToName: 'Smile Genius Bristol', entity: 'Clinic',
    amount: 890.00, currency: 'GBP', vatAmount: 148.33,
    date: '2026-05-09', dueDate: '2026-06-09', receivedAt: '2026-05-09T16:10:00Z',
    source: 'manual', status: 'disputed', ragScore: 34, ragColor: 'red', aiConfidence: 42,
    assignedTo: 'Group Admin', approvalRule: undefined,
    issues: ['Duplicate invoice number (matches INV-20250502-001)', 'Supplier email domain not on allow-list'],
    ruleResults: [
      { id: 'r1', group: 'Supplier Risk', title: 'Supplier not approved', result: 'fail', detail: 'Supplier is not yet approved — pending review', weight: 12, type: 'score' },
      { id: 'r2', group: 'Supplier Risk', title: 'New supplier detected', result: 'fail', detail: 'First invoice from this supplier', weight: 2, type: 'score' },
      { id: 'r3', group: 'Supplier Risk', title: 'Supplier is paused', result: 'pass', detail: 'Supplier status: Pending', weight: 0, type: 'stop' },
      { id: 'r4', group: 'Duplicate & Fraud', title: 'Duplicate Check', result: 'fail', detail: 'Duplicate of INV-20250502-001 received 2 May 2026', weight: 0, type: 'stop' },
      { id: 'r5', group: 'Duplicate & Fraud', title: 'Amount Within Norm', result: 'skip', detail: 'Skipped — no historical data for this supplier', weight: 0, type: 'stop' },
    ],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '09 May 2026, 16:10', sub: 'uploaded manually' },
      { label: 'AI parsed & matched', done: true, timestamp: '09 May 2026, 16:10', sub: 'Confidence 42%' },
      { label: 'Disputed', done: true, timestamp: '09 May 2026, 16:11', sub: '2 critical flags raised' },
      { label: 'Resolved', done: false },
    ],
    lineItems: [
      { description: 'Composite Resin A2', qty: 5, unitPrice: 98.00, total: 490.00, matchedCaseId: 'CASE-009' },
      { description: 'Bonding Agent Kit', qty: 4, unitPrice: 100.00, total: 400.00, matchedCaseId: 'CASE-010' },
    ],
    // Demo: an active dispute thread already exists for this invoice.
    disputeEmails: [
      {
        id: 'e-seed-1',
        direction: 'outbound',
        from: 'Sajid Mahmood',
        fromEmail: 'sajid@smilegenius.co.uk',
        to: 'accounts@freshsmilesupplies.com',
        subject: 'Dispute: invoice INV-20250509-001 (FreshSmile Supplies)',
        body: `Hi FreshSmile team,\n\nWe've flagged invoice INV-20250509-001 for £890.00 as a possible duplicate of INV-20250502-001 received last week.\n\nCould you confirm and resend a corrected copy if needed?\n\nThanks,\nSajid Mahmood\nSmile Genius Accounts Payable`,
        sentAt: '09 May 2026, 16:22',
      },
      {
        id: 'e-seed-2',
        direction: 'inbound',
        from: 'FreshSmile Supplies',
        fromEmail: 'accounts@freshsmilesupplies.com',
        to: 'sajid@smilegenius.co.uk',
        subject: 'Re: Dispute: invoice INV-20250509-001 (FreshSmile Supplies)',
        body: `Hi Sajid,\n\nThanks for flagging — we'll review and revert by end of day tomorrow.\n\nKind regards,\nAccounts team\nFreshSmile Supplies`,
        sentAt: '09 May 2026, 17:45',
      },
    ],
    activity: [
      { id: 'a-seed-1', type: 'disputed', actor: 'Sajid Mahmood', ts: '09 May 2026, 16:22', note: 'Possible duplicate of INV-20250502-001' },
    ],
  },
  {
    id: 'inv_005', number: 'HEN-2025-0831', docType: 'invoice',
    supplier: 'Henry Schein Dental', categories: ['Clinical', 'Equipment'],
    billedTo: 'dentist', billedToName: 'Dr. Emma Thompson', entity: 'Dentist',
    amount: 562.40, currency: 'GBP', vatAmount: 93.73,
    date: '2026-05-14', dueDate: '2026-06-14', receivedAt: '2026-05-14T08:55:00Z',
    source: 'email', status: 'awaiting_approval', ragScore: 0, ragColor: 'green', aiConfidence: 0,
    assignedTo: undefined, approvalRule: undefined, issues: [],
    ruleResults: [],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '14 May 2026, 08:55', sub: 'received via email' },
      { label: 'AI parsing…', done: false },
      { label: 'Awaiting Approval', done: false },
      { label: 'Posted to Xero', done: false },
    ],
    lineItems: [
      { description: 'Dental Mirror Set x12', qty: 1, unitPrice: 62.40, total: 62.40, matchedCaseId: 'CASE-011' },
      { description: 'Anaesthetic Cartridges Lidocaine 50pk', qty: 2, unitPrice: 110.00, total: 220.00, matchedCaseId: 'CASE-012' },
      { description: 'Barrier Film 6" x4" 1200pk', qty: 2, unitPrice: 140.00, total: 280.00 },
    ],
    activity: [
      { id: 'a-005-1', type: 'submitted', actor: 'System', ts: '14 May 2026, 08:55', note: 'Received via email from Henry Schein Dental. AI parsing in progress — rules will run once complete.' },
    ],
  },
  {
    id: 'inv_006', number: 'NLAB-0044', docType: 'invoice',
    supplier: 'Dentsply Sirona', categories: ['Equipment', 'Software'],
    billedTo: 'group_hq', billedToName: 'SmileGenius Group HQ', entity: 'Group HQ',
    amount: 7850.00, currency: 'GBP', vatAmount: 1308.33,
    date: '2026-05-10', dueDate: '2026-06-10', receivedAt: '2026-05-10T10:30:00Z',
    source: 'email', status: 'awaiting_approval', ragScore: 82, ragColor: 'green', aiConfidence: 88,
    assignedTo: 'Group Finance', approvalRule: 'Lab · Dental Group · £2500–£10000',
    issues: ['High-value invoice — requires dual sign-off'],
    ruleResults: [
      { id: 'r1', group: 'Supplier Risk', title: 'Supplier not approved', result: 'pass', detail: 'Supplier is fully approved', weight: 12, type: 'score' },
      { id: 'r2', group: 'Supplier Risk', title: 'New supplier detected', result: 'pass', detail: 'Supplier has 31 previous invoices', weight: 2, type: 'score' },
      { id: 'r3', group: 'Supplier Risk', title: 'Supplier is paused', result: 'pass', detail: 'Supplier status: Active', weight: 0, type: 'stop' },
      { id: 'r4', group: 'Duplicate & Fraud', title: 'Duplicate Check', result: 'pass', detail: 'No duplicate found', weight: 0, type: 'stop' },
      { id: 'r5', group: 'Duplicate & Fraud', title: 'Amount Within Norm', result: 'pass', detail: 'Amount within normal range for this supplier', weight: 0, type: 'stop' },
    ],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '10 May 2026, 10:30', sub: 'received via email' },
      { label: 'AI parsed & matched', done: true, timestamp: '10 May 2026, 10:31', sub: 'Confidence 88%' },
      { label: 'Awaiting Approval', done: true, timestamp: '10 May 2026, 10:31', sub: 'Assigned to Group Finance' },
      { label: 'Approved', done: false },
      { label: 'Posted to Xero', done: false },
    ],
    lineItems: [
      { description: 'CEREC Primescan AC Scanner', qty: 1, unitPrice: 7850.00, total: 7850.00 },
    ],
    activity: [
      { id: 'a-006-1', type: 'submitted', actor: 'System', ts: '10 May 2026, 10:30', note: 'Received via email from Dentsply Sirona.' },
      { id: 'a-006-2', type: 'edited', actor: 'Group Finance', ts: '10 May 2026, 15:45', note: 'Re-assigned to Group HQ — scanner is a capital asset purchased centrally, not a clinic expense.', changes: [{ field: 'Billed entity', from: 'Clinic', to: 'Group HQ' }, { field: 'Billed to', from: 'Smile Genius Manchester', to: 'SmileGenius Group HQ' }, { field: 'Category', from: 'Equipment', to: 'Equipment, Capital' }] },
      { id: 'a-006-3', type: 'note', actor: 'CFO', ts: '11 May 2026, 09:12', note: 'High-value purchase confirmed in Q2 capital plan. Pending second sign-off from Group Finance before releasing for payment.' },
    ],
    defaultNominalCode: '3620',
  },
  {
    id: 'inv_007', number: 'LAB-2024-3302', docType: 'invoice',
    supplier: 'Smile Ceramics Studio', categories: ['Dental Labs'],
    billedTo: 'clinic', billedToName: 'Smile Genius Edinburgh', entity: 'Clinic',
    amount: 185.00, currency: 'GBP', vatAmount: 30.83,
    date: '2026-05-08', dueDate: '2026-06-08', receivedAt: '2026-05-08T13:20:00Z',
    source: 'manual', status: 'exported_for_payment', ragScore: 95, ragColor: 'green', aiConfidence: 97,
    assignedTo: 'Auto-approved', approvalRule: 'Lab · Clinic/Dentist · £0–£300', issues: [],
    ruleResults: [
      { id: 'r1', group: 'Supplier Risk', title: 'Supplier not approved', result: 'pass', detail: 'Supplier is fully approved', weight: 12, type: 'score' },
      { id: 'r2', group: 'Supplier Risk', title: 'New supplier detected', result: 'pass', detail: 'Supplier has 19 previous invoices', weight: 2, type: 'score' },
      { id: 'r3', group: 'Supplier Risk', title: 'Supplier is paused', result: 'pass', detail: 'Supplier status: Active', weight: 0, type: 'stop' },
      { id: 'r4', group: 'Duplicate & Fraud', title: 'Duplicate Check', result: 'pass', detail: 'No duplicate found', weight: 0, type: 'stop' },
      { id: 'r5', group: 'Duplicate & Fraud', title: 'Amount Within Norm', result: 'pass', detail: 'Amount within normal range', weight: 0, type: 'stop' },
    ],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '08 May 2026, 13:20', sub: 'uploaded manually' },
      { label: 'AI parsed & matched', done: true, timestamp: '08 May 2026, 13:21', sub: 'Confidence 97%' },
      { label: 'Auto-approved', done: true, timestamp: '08 May 2026, 13:21', sub: 'Rule: Lab · £0–£300' },
      { label: 'Posted to Xero', done: false },
    ],
    activity: [
      { id: 'a-007-1', type: 'submitted', actor: 'System', ts: '08 May 2026, 13:20', note: 'Uploaded manually by Clinic Manager.' },
      { id: 'a-007-2', type: 'approved', actor: 'System (Auto rule)', ts: '08 May 2026, 13:21', note: 'Auto-approved under rule "Lab · £0–£300".' },
    ],
  },
  // ─── inv_008 — Credit Note (negative amount, approved) ──────────────────────────
  {
    id: 'inv_008', number: 'CN-2025-0114', docType: 'invoice',
    supplier: 'Henry Schein Dental', categories: ['Clinical'],
    billedTo: 'clinic', billedToName: 'Smile Genius Leeds', entity: 'Clinic',
    amount: -142.80, currency: 'GBP', vatAmount: -23.80,
    date: '2026-05-15', dueDate: '2026-06-15', receivedAt: '2026-05-15T10:34:00Z',
    source: 'email', status: 'approved', ragScore: 88, ragColor: 'green', aiConfidence: 92,
    assignedTo: 'Human Approved', approvalRule: 'Credit · Clinic · £0–£250',
    issues: [],
    ruleResults: [
      { id: 'r1', group: 'Supplier Risk', title: 'Supplier not approved', result: 'pass', detail: 'Supplier is fully approved and active', weight: 12, type: 'score' },
      { id: 'r4', group: 'Duplicate & Fraud', title: 'Duplicate Check', result: 'pass', detail: 'No duplicate credit note found', weight: 0, type: 'stop' },
      { id: 'r9', group: 'Spend & Price Checks', title: 'Credit value sane', result: 'pass', detail: 'Credit value is within typical refund range', weight: 8, type: 'score' },
    ],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '15 May 2026, 10:34', sub: 'received via email' },
      { label: 'AI parsed & matched', done: true, timestamp: '15 May 2026, 10:35', sub: 'Confidence 92% · Credit Note' },
      { label: 'Awaiting Approval', done: true, timestamp: '15 May 2026, 10:35', sub: 'Assigned to Clinic Manager' },
      { label: 'Approved', done: true, timestamp: '15 May 2026, 14:02', sub: 'by Sajid Mahmood' },
      { label: 'Posted to Xero', done: false },
    ],
    lineItems: [
      { description: 'Refund — overpaid PO #4391', qty: 1, unitPrice: -119.00, total: -119.00 },
    ],
    activity: [
      { id: 'a-008-1', type: 'approved', actor: 'Sajid Mahmood', ts: '15 May 2026, 14:02', note: 'Verified against original PO #4391 — credit is correct.' },
    ],
  },
  // ─── inv_009 — Statement (account statement, flagged 'Other') ───────────────────
  {
    id: 'inv_009', number: 'STMT-2025-04', docType: 'invoice',
    supplier: 'DD Group', categories: ['Implant Suppliers'],
    billedTo: 'group_hq', billedToName: 'SmileGenius Group HQ', entity: 'Group HQ',
    amount: 4250.00, currency: 'GBP', vatAmount: 708.33,
    date: '2026-05-01', dueDate: '2026-05-31', receivedAt: '2026-05-01T08:00:00Z',
    source: 'email', status: 'qc_review', ragScore: 65, ragColor: 'amber', aiConfidence: 71,
    assignedTo: 'QC Reviewer', approvalRule: 'Statement · Group HQ · >£1500',
    issues: ['Document type re-classified by AI from "Invoice" to "Statement" — please review before approving.'],
    ruleResults: [
      { id: 'r7',  group: 'Invoice Compliance', title: 'Document Is An Invoice', result: 'warn', detail: 'Document looks like a monthly statement, not an invoice', weight: 0, type: 'stop' },
      { id: 'r8',  group: 'Invoice Compliance', title: 'Missing invoice number',  result: 'pass', detail: 'Statement reference STMT-2025-04 detected', weight: 4, type: 'score' },
      { id: 'r9',  group: 'Spend & Price Checks', title: 'Line Math', result: 'pass', detail: 'Statement total matches sum of line items', weight: 10, type: 'score' },
      { id: 'r22', group: 'Dates & timing', title: 'Due Date OK', result: 'pass', detail: 'Due 31 May 2026', weight: 9, type: 'score' },
    ],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '01 May 2026, 08:00', sub: 'received via email' },
      { label: 'AI parsed & matched', done: true, timestamp: '01 May 2026, 08:01', sub: 'Confidence 71% · classified as Statement' },
      { label: 'Awaiting Approval', done: true, timestamp: '01 May 2026, 08:02', sub: 'Assigned to Finance Manager' },
      { label: 'Approved', done: false },
      { label: 'Posted to Xero', done: false },
    ],
    lineItems: [
      { description: 'April 2026 statement — outstanding balance', qty: 1, unitPrice: 4250.00, total: 4250.00 },
    ],
    activity: [
      { id: 'a-009-1', type: 'submitted', actor: 'System', ts: '01 May 2026, 08:00', note: 'Received via email from DD Group — AI re-classified from "Invoice" to "Statement".' },
      { id: 'a-009-2', type: 'note', actor: 'Finance Manager', ts: '02 May 2026, 10:15', note: 'Reviewing line items against outstanding POs before approving. Statement covers April 2026 balance.' },
    ],
  },
  // ─── inv_010 — Quote (pending review, low confidence) ───────────────────────────
  {
    id: 'inv_010', number: 'QTE-3Shape-2025-114', docType: 'invoice',
    supplier: '3Shape', categories: ['Equipment', 'Software'],
    billedTo: 'group_hq', billedToName: 'SmileGenius Group HQ', entity: 'Group HQ',
    amount: 12450.00, currency: 'GBP', vatAmount: 2075.00,
    date: '2026-05-17', dueDate: '2026-06-30', receivedAt: '2026-05-17T15:42:00Z',
    source: 'email', status: 'qc_review', ragScore: 58, ragColor: 'amber', aiConfidence: 64,
    assignedTo: 'QC Reviewer', approvalRule: 'Quote · Group HQ · >£10,000',
    issues: ['Document is a quote — does not create a payable until accepted.'],
    ruleResults: [
      { id: 'r7',  group: 'Invoice Compliance', title: 'Document Is An Invoice', result: 'warn', detail: 'Detected as Quote — not a payable invoice', weight: 0, type: 'stop' },
      { id: 'r2',  group: 'Supplier Risk', title: 'New supplier detected', result: 'pass', detail: 'Supplier has 25 previous invoices', weight: 2, type: 'score' },
      { id: 'r22', group: 'Dates & timing', title: 'Quote validity', result: 'pass', detail: 'Quote valid until 30 Jun 2026', weight: 5, type: 'score' },
    ],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '17 May 2026, 15:42', sub: 'received via email' },
      { label: 'AI parsed & matched', done: true, timestamp: '17 May 2026, 15:43', sub: 'Confidence 64% · classified as Quote' },
      { label: 'Awaiting Approval', done: true, timestamp: '17 May 2026, 15:43', sub: 'Assigned to CFO' },
      { label: 'Approved', done: false },
      { label: 'Posted to Xero', done: false },
    ],
    lineItems: [
      { description: 'TRIOS 5 Wireless Scanner — bundle x1', qty: 1, unitPrice: 9800.00, total: 9800.00 },
      { description: 'Annual care plan & training', qty: 1, unitPrice: 2650.00, total: 2650.00 },
    ],
    activity: [
      { id: 'a-010-1', type: 'submitted', actor: 'System', ts: '17 May 2026, 15:42', note: 'Received via email from 3Shape — AI classified as Quote, not a payable invoice.' },
      { id: 'a-010-2', type: 'note', actor: 'CFO', ts: '19 May 2026, 11:30', note: 'Under review. Awaiting board confirmation before accepting. Quote valid until 30 Jun 2026.' },
    ],
  },
  // ─── inv_011 — Rejected invoice (with rejection reason in activity) ─────────────
  {
    id: 'inv_011', number: 'INV-DD-7782', docType: 'invoice',
    supplier: 'DD Group', categories: ['Implant Suppliers'],
    billedTo: 'clinic', billedToName: 'Smile Genius Brighton', entity: 'Clinic',
    amount: 2980.00, currency: 'GBP', vatAmount: 496.67,
    date: '2026-05-10', dueDate: '2026-06-10', receivedAt: '2026-05-10T11:18:00Z',
    source: 'email', status: 'rejected', ragScore: 28, ragColor: 'red', aiConfidence: 39,
    assignedTo: 'Clinic Manager', approvalRule: undefined,
    issues: ['Rejected — line items do not match delivery note', 'Quantity discrepancy on line 2'],
    ruleResults: [
      { id: 'r4', group: 'Duplicate & Fraud', title: 'Duplicate Check', result: 'pass', detail: 'No duplicate found', weight: 0, type: 'stop' },
      { id: 'r9', group: 'Spend & Price Checks', title: 'Line Math', result: 'fail', detail: 'Sum of lines does not match invoice total', weight: 10, type: 'score' },
      { id: 'r16', group: 'Clinic / Entity Matching', title: 'Delivery note match', result: 'fail', detail: 'No matching delivery note found for this invoice', weight: 10, type: 'score' },
    ],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '10 May 2026, 11:18', sub: 'received via email' },
      { label: 'AI parsed & matched', done: true, timestamp: '10 May 2026, 11:19', sub: 'Confidence 39%' },
      { label: 'Awaiting Approval', done: true, timestamp: '10 May 2026, 11:19', sub: 'Assigned to Clinic Manager' },
      { label: 'Rejected', done: true, timestamp: '10 May 2026, 16:55', sub: 'by Sajid Mahmood' },
    ],
    lineItems: [
      { description: 'Implant abutments — titanium x10', qty: 10, unitPrice: 220.00, total: 2200.00 },
      { description: 'Healing caps x12 — invoiced qty does not match delivery', qty: 12, unitPrice: 65.00, total: 780.00 },
    ],
    activity: [
      { id: 'a-011-1', type: 'rejected', actor: 'Sajid Mahmood', ts: '10 May 2026, 16:55', note: 'Healing caps qty on invoice (12) does not match delivery note (8). Please re-issue with corrected qty.' },
    ],
  },
  // ─── inv_012 — Receipt (already paid, manual upload) ────────────────────────────
  {
    id: 'inv_012', number: 'RCPT-PD-9012', docType: 'invoice',
    supplier: 'Patterson Dental UK', categories: ['Equipment'],
    billedTo: 'dentist', billedToName: 'Dr. James O\'Connor', entity: 'Dentist',
    amount: 67.20, currency: 'GBP', vatAmount: 11.20,
    date: '2026-05-06', dueDate: '2026-05-06', receivedAt: '2026-05-06T09:30:00Z',
    source: 'manual', status: 'payment_processed', ragScore: 90, ragColor: 'green', aiConfidence: 88,
    assignedTo: 'Auto-approved', approvalRule: 'Receipt · Dentist · paid',
    issues: [],
    ruleResults: [
      { id: 'r1', group: 'Supplier Risk', title: 'Supplier not approved', result: 'pass', detail: 'Supplier is fully approved', weight: 12, type: 'score' },
      { id: 'r9', group: 'Spend & Price Checks', title: 'Receipt math', result: 'pass', detail: 'Receipt totals match', weight: 5, type: 'score' },
    ],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '06 May 2026, 09:30', sub: 'uploaded manually' },
      { label: 'AI parsed & matched', done: true, timestamp: '06 May 2026, 09:31', sub: 'Confidence 88% · Receipt' },
      { label: 'Auto-approved', done: true, timestamp: '06 May 2026, 09:31', sub: 'Already paid by card' },
      { label: 'Posted to Xero', done: true, timestamp: '06 May 2026, 09:32' },
    ],
    lineItems: [
      { description: 'Disposable gloves — bulk x5 boxes', qty: 5, unitPrice: 11.20, total: 56.00 },
    ],
    activity: [
      { id: 'a-012-1', type: 'submitted', actor: 'System', ts: '06 May 2026, 09:30', note: 'Uploaded manually — card payment receipt from Patterson Dental UK.' },
      { id: 'a-012-2', type: 'approved', actor: 'System (Auto rule)', ts: '06 May 2026, 09:31', note: 'Auto-approved: already paid by card — no payment action required.' },
    ],
  },
  // ─── inv_013 — Archived old invoice ──────────────────────────────────────────────
  {
    id: 'inv_013', number: 'INV-MED-2024-980', docType: 'invoice',
    supplier: 'Medit', categories: ['Equipment'],
    billedTo: 'clinic', billedToName: 'Smile Genius Birmingham', entity: 'Clinic',
    amount: 320.00, currency: 'GBP', vatAmount: 53.33,
    date: '2024-11-22', dueDate: '2024-12-22', receivedAt: '2024-11-22T12:00:00Z',
    source: 'email', status: 'archived', ragScore: 85, ragColor: 'green', aiConfidence: 91,
    assignedTo: 'Auto-approved', approvalRule: 'Equipment · Clinic · £0–£500',
    issues: [],
    ruleResults: [
      { id: 'r1', group: 'Supplier Risk', title: 'Supplier not approved', result: 'pass', detail: 'Supplier active', weight: 12, type: 'score' },
    ],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '22 Nov 2024, 12:00', sub: 'received via email' },
      { label: 'AI parsed & matched', done: true, timestamp: '22 Nov 2024, 12:01', sub: 'Confidence 91%' },
      { label: 'Auto-approved', done: true, timestamp: '22 Nov 2024, 12:01', sub: 'Auto rule' },
      { label: 'Posted to Xero', done: true, timestamp: '22 Nov 2024, 12:02' },
      { label: 'Archived', done: true, timestamp: '18 Jan 2025, 10:00', sub: 'after payment cleared' },
    ],
    activity: [
      { id: 'a-013-1', type: 'archived', actor: 'System', ts: '18 Jan 2025, 10:00', note: 'Auto-archived 60 days after payment cleared.' },
    ],
  },
  // ─── Historic payment archive — 2026 (current year, past months) ────────────────
  // Already-paid invoices for Jan–Apr 2026 so the Reports modal shows real data
  // across previous months of the current year (not just May).
  {
    id: 'inv_h26_01', number: 'PD-2026-0094', docType: 'invoice',
    supplier: 'Patterson Dental UK', categories: ['Equipment'],
    billedTo: 'clinic', billedToName: 'Smile Genius Manchester', entity: 'Clinic',
    amount: 689.40, currency: 'GBP', vatAmount: 114.90,
    date: '2026-01-15', dueDate: '2026-02-15', receivedAt: '2026-01-15T09:30:00Z',
    source: 'email', status: 'payment_processed', ragScore: 91, ragColor: 'green', aiConfidence: 93,
    assignedTo: 'Auto-approved', approvalRule: 'Equipment · Clinic · £300–£1500', issues: [],
    ruleResults: [],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '15 Jan 2026, 09:30', sub: 'received via email' },
      { label: 'Auto-approved', done: true, timestamp: '15 Jan 2026, 09:31', sub: 'Rule: Equipment · £300–£1500' },
      { label: 'Payment Processed', done: true, timestamp: '20 Jan 2026, 11:00' },
    ],
    activity: [
      { id: 'a-h26_01-1', type: 'submitted', actor: 'System', ts: '15 Jan 2026, 09:30', note: 'Received via email from Patterson Dental UK.' },
      { id: 'a-h26_01-2', type: 'approved', actor: 'System (Auto rule)', ts: '15 Jan 2026, 09:31', note: 'Auto-approved under rule "Equipment · £300–£1500".' },
    ],
  },
  {
    id: 'inv_h26_01b', number: 'KBL-2026-0102', docType: 'invoice',
    supplier: 'Kingsbridge Dental Lab', categories: ['Dental Labs'],
    billedTo: 'clinic', billedToName: 'Smile Genius Bristol', entity: 'Clinic',
    amount: 245.00, currency: 'GBP', vatAmount: 40.83,
    date: '2026-01-28', dueDate: '2026-02-28', receivedAt: '2026-01-28T14:10:00Z',
    source: 'email', status: 'payment_processed', ragScore: 95, ragColor: 'green', aiConfidence: 96,
    assignedTo: 'Auto-approved', approvalRule: 'Lab · Clinic/Dentist · £0–£300', issues: [],
    ruleResults: [],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '28 Jan 2026, 14:10', sub: 'received via email' },
      { label: 'Auto-approved', done: true, timestamp: '28 Jan 2026, 14:11', sub: 'Rule: Lab · £0–£300' },
      { label: 'Payment Processed', done: true, timestamp: '02 Feb 2026, 09:00' },
    ],
    activity: [
      { id: 'a-h26_01b-1', type: 'submitted', actor: 'System', ts: '28 Jan 2026, 14:10', note: 'Received via email from Kingsbridge Dental Lab.' },
      { id: 'a-h26_01b-2', type: 'approved', actor: 'System (Auto rule)', ts: '28 Jan 2026, 14:11', note: 'Auto-approved under rule "Lab · £0–£300".' },
    ],
  },
  {
    id: 'inv_h26_02', number: 'HEN-2026-0218', docType: 'invoice',
    supplier: 'Henry Schein Dental', categories: ['Clinical'],
    billedTo: 'dentist', billedToName: 'Dr. Emma Thompson', entity: 'Dentist',
    amount: 412.80, currency: 'GBP', vatAmount: 68.80,
    date: '2026-02-12', dueDate: '2026-03-12', receivedAt: '2026-02-12T11:45:00Z',
    source: 'email', status: 'payment_processed', ragScore: 93, ragColor: 'green', aiConfidence: 94,
    assignedTo: 'Auto-approved', approvalRule: 'Clinical · Dentist · £300–£500', issues: [],
    ruleResults: [],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '12 Feb 2026, 11:45', sub: 'received via email' },
      { label: 'Auto-approved', done: true, timestamp: '12 Feb 2026, 11:46', sub: 'Rule: Clinical · £300–£500' },
      { label: 'Payment Processed', done: true, timestamp: '18 Feb 2026, 10:20' },
    ],
    activity: [
      { id: 'a-h26_02-1', type: 'submitted', actor: 'System', ts: '12 Feb 2026, 11:45', note: 'Received via email from Henry Schein Dental.' },
      { id: 'a-h26_02-2', type: 'approved', actor: 'System (Auto rule)', ts: '12 Feb 2026, 11:46', note: 'Auto-approved under rule "Clinical · £300–£500".' },
    ],
  },
  {
    id: 'inv_h26_03', number: 'EU-2026-0317', docType: 'invoice',
    supplier: 'Eurodontic Ltd', categories: ['Dental Labs'],
    billedTo: 'group_hq', billedToName: 'SmileGenius Group HQ', entity: 'Group HQ',
    amount: 1280.00, currency: 'GBP', vatAmount: 213.33,
    date: '2026-03-04', dueDate: '2026-04-04', receivedAt: '2026-03-04T08:55:00Z',
    source: 'email', status: 'payment_processed', ragScore: 89, ragColor: 'green', aiConfidence: 91,
    assignedTo: 'Group Finance', approvalRule: 'Lab · Group HQ · £0–£2500', issues: [],
    ruleResults: [],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '04 Mar 2026, 08:55', sub: 'received via email' },
      { label: 'Approved', done: true, timestamp: '05 Mar 2026, 13:20', sub: 'by Group Finance' },
      { label: 'Payment Processed', done: true, timestamp: '12 Mar 2026, 09:45' },
    ],
    activity: [
      { id: 'a-h26_03-1', type: 'submitted', actor: 'System', ts: '04 Mar 2026, 08:55', note: 'Received via email from Eurodontic Ltd.' },
      { id: 'a-h26_03-2', type: 'approved', actor: 'Group Finance', ts: '05 Mar 2026, 13:20', note: 'Approved after reviewing delivery notes and confirming PO match.' },
    ],
  },
  {
    id: 'inv_h26_03b', number: 'SCS-2026-0331', docType: 'invoice',
    supplier: 'Smile Ceramics Studio', categories: ['Dental Labs'],
    billedTo: 'clinic', billedToName: 'Smile Genius Edinburgh', entity: 'Clinic',
    amount: 175.50, currency: 'GBP', vatAmount: 29.25,
    date: '2026-03-22', dueDate: '2026-04-22', receivedAt: '2026-03-22T16:30:00Z',
    source: 'manual', status: 'payment_processed', ragScore: 96, ragColor: 'green', aiConfidence: 97,
    assignedTo: 'Auto-approved', approvalRule: 'Lab · Clinic · £0–£300', issues: [],
    ruleResults: [],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '22 Mar 2026, 16:30', sub: 'uploaded manually' },
      { label: 'Auto-approved', done: true, timestamp: '22 Mar 2026, 16:31', sub: 'Rule: Lab · £0–£300' },
      { label: 'Payment Processed', done: true, timestamp: '27 Mar 2026, 10:15' },
    ],
    activity: [
      { id: 'a-h26_03b-1', type: 'submitted', actor: 'System', ts: '22 Mar 2026, 16:30', note: 'Uploaded manually by Clinic Manager.' },
      { id: 'a-h26_03b-2', type: 'approved', actor: 'System (Auto rule)', ts: '22 Mar 2026, 16:31', note: 'Auto-approved under rule "Lab · £0–£300".' },
    ],
  },
  {
    id: 'inv_h26_04', number: 'DSI-2026-0411', docType: 'invoice',
    supplier: 'Dentsply Sirona', categories: ['Equipment'],
    billedTo: 'group_hq', billedToName: 'SmileGenius Group HQ', entity: 'Group HQ',
    amount: 3450.00, currency: 'GBP', vatAmount: 575.00,
    date: '2026-04-08', dueDate: '2026-05-08', receivedAt: '2026-04-08T10:00:00Z',
    source: 'email', status: 'payment_processed', ragScore: 88, ragColor: 'green', aiConfidence: 90,
    assignedTo: 'Group Finance', approvalRule: 'Equipment · Group HQ · £2500–£10000', issues: [],
    ruleResults: [],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '08 Apr 2026, 10:00', sub: 'received via email' },
      { label: 'Approved', done: true, timestamp: '09 Apr 2026, 14:30', sub: 'by CFO' },
      { label: 'Payment Processed', done: true, timestamp: '15 Apr 2026, 11:00' },
    ],
    activity: [
      { id: 'a-h26_04-1', type: 'submitted', actor: 'System', ts: '08 Apr 2026, 10:00', note: 'Received via email from Dentsply Sirona.' },
      { id: 'a-h26_04-2', type: 'approved', actor: 'CFO', ts: '09 Apr 2026, 14:30', note: 'Approved following dual sign-off procedure for high-value equipment purchase.' },
    ],
  },
  {
    id: 'inv_h26_04b', number: 'PD-2026-0427', docType: 'invoice',
    supplier: 'Patterson Dental UK', categories: ['Equipment'],
    billedTo: 'dentist', billedToName: 'Dr. James O\'Connor', entity: 'Dentist',
    amount: 542.10, currency: 'GBP', vatAmount: 90.35,
    date: '2026-04-25', dueDate: '2026-05-25', receivedAt: '2026-04-25T13:15:00Z',
    source: 'email', status: 'payment_processed', ragScore: 92, ragColor: 'green', aiConfidence: 93,
    assignedTo: 'Auto-approved', approvalRule: 'Equipment · Dentist · £300–£1500', issues: [],
    ruleResults: [],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '25 Apr 2026, 13:15', sub: 'received via email' },
      { label: 'Auto-approved', done: true, timestamp: '25 Apr 2026, 13:16', sub: 'Rule: Equipment · £300–£1500' },
      { label: 'Payment Processed', done: true, timestamp: '30 Apr 2026, 09:30' },
    ],
    activity: [
      { id: 'a-h26_04b-1', type: 'submitted', actor: 'System', ts: '25 Apr 2026, 13:15', note: 'Received via email from Patterson Dental UK.' },
      { id: 'a-h26_04b-2', type: 'approved', actor: 'System (Auto rule)', ts: '25 Apr 2026, 13:16', note: 'Auto-approved under rule "Equipment · £300–£1500".' },
    ],
  },
  // ─── Historic payment archive — populates the 2025 Reports folder ───────────────
  // These are already-paid invoices spread across 2025 so the Reports modal shows
  // a realistic year of monthly payment files (not an empty archive).
  {
    id: 'inv_h25_02', number: 'LAB-2025-0211', docType: 'invoice',
    supplier: 'Kingsbridge Dental Lab', categories: ['Dental Labs'],
    billedTo: 'clinic', billedToName: 'Smile Genius Manchester', entity: 'Clinic',
    amount: 312.40, currency: 'GBP', vatAmount: 52.07,
    date: '2025-02-11', dueDate: '2025-03-11', receivedAt: '2025-02-11T10:00:00Z',
    source: 'email', status: 'payment_processed', ragScore: 94, ragColor: 'green', aiConfidence: 95,
    assignedTo: 'Auto-approved', approvalRule: 'Lab · Clinic/Dentist · £0–£500', issues: [],
    ruleResults: [],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '11 Feb 2025, 10:00', sub: 'received via email' },
      { label: 'Auto-approved', done: true, timestamp: '11 Feb 2025, 10:01', sub: 'Rule: Lab · £0–£500' },
      { label: 'Payment Processed', done: true, timestamp: '14 Feb 2025, 09:30' },
    ],
    activity: [
      { id: 'a-h25_02-1', type: 'submitted', actor: 'System', ts: '11 Feb 2025, 10:00', note: 'Received via email from Kingsbridge Dental Lab.' },
      { id: 'a-h25_02-2', type: 'approved', actor: 'System (Auto rule)', ts: '11 Feb 2025, 10:01', note: 'Auto-approved under rule "Lab · £0–£500".' },
    ],
  },
  {
    id: 'inv_h25_04', number: 'PD-2025-1188', docType: 'invoice',
    supplier: 'Patterson Dental UK', categories: ['Equipment'],
    billedTo: 'dentist', billedToName: 'Dr. James O\'Connor', entity: 'Dentist',
    amount: 845.20, currency: 'GBP', vatAmount: 140.87,
    date: '2025-04-09', dueDate: '2025-05-09', receivedAt: '2025-04-09T12:14:00Z',
    source: 'email', status: 'payment_processed', ragScore: 88, ragColor: 'green', aiConfidence: 91,
    assignedTo: 'Human Approved', approvalRule: 'Equipment · Dentist · £300–£1500', issues: [],
    ruleResults: [],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '09 Apr 2025, 12:14', sub: 'received via email' },
      { label: 'Approved', done: true, timestamp: '10 Apr 2025, 09:00', sub: 'by Sajid Mahmood' },
      { label: 'Payment Processed', done: true, timestamp: '15 Apr 2025, 14:22' },
    ],
    activity: [
      { id: 'a-h25_04-1', type: 'submitted', actor: 'System', ts: '09 Apr 2025, 12:14', note: 'Received via email from Patterson Dental UK.' },
      { id: 'a-h25_04-2', type: 'approved', actor: 'Sajid Mahmood', ts: '10 Apr 2025, 09:00', note: 'Reviewed and approved after verifying against purchase order PD-PO-2025-112.' },
    ],
  },
  {
    id: 'inv_h25_06', number: 'HEN-2025-3091', docType: 'invoice',
    supplier: 'Henry Schein Dental', categories: ['Clinical'],
    billedTo: 'clinic', billedToName: 'Smile Genius Bristol', entity: 'Clinic',
    amount: 472.10, currency: 'GBP', vatAmount: 78.68,
    date: '2025-06-18', dueDate: '2025-07-18', receivedAt: '2025-06-18T08:42:00Z',
    source: 'email', status: 'payment_processed', ragScore: 92, ragColor: 'green', aiConfidence: 93,
    assignedTo: 'Auto-approved', approvalRule: 'Clinical · Clinic · £0–£500', issues: [],
    ruleResults: [],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '18 Jun 2025, 08:42', sub: 'received via email' },
      { label: 'Auto-approved', done: true, timestamp: '18 Jun 2025, 08:43', sub: 'Rule: Clinical · £0–£500' },
      { label: 'Payment Processed', done: true, timestamp: '22 Jun 2025, 10:15' },
    ],
    activity: [
      { id: 'a-h25_06-1', type: 'submitted', actor: 'System', ts: '18 Jun 2025, 08:42', note: 'Received via email from Henry Schein Dental.' },
      { id: 'a-h25_06-2', type: 'approved', actor: 'System (Auto rule)', ts: '18 Jun 2025, 08:43', note: 'Auto-approved under rule "Clinical · £0–£500".' },
    ],
  },
  {
    id: 'inv_h25_08', number: 'EU-2025-4477', docType: 'invoice',
    supplier: 'Eurodontic Ltd', categories: ['Dental Labs'],
    billedTo: 'group_hq', billedToName: 'SmileGenius Group HQ', entity: 'Group HQ',
    amount: 1840.00, currency: 'GBP', vatAmount: 306.67,
    date: '2025-08-05', dueDate: '2025-09-05', receivedAt: '2025-08-05T15:30:00Z',
    source: 'email', status: 'payment_processed', ragScore: 86, ragColor: 'green', aiConfidence: 89,
    assignedTo: 'Group Finance', approvalRule: 'Lab · Group HQ · £0–£2500', issues: [],
    ruleResults: [],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '05 Aug 2025, 15:30', sub: 'received via email' },
      { label: 'Approved', done: true, timestamp: '06 Aug 2025, 11:18', sub: 'by Finance Manager' },
      { label: 'Payment Processed', done: true, timestamp: '12 Aug 2025, 09:45' },
    ],
    activity: [
      { id: 'a-h25_08-1', type: 'submitted', actor: 'System', ts: '05 Aug 2025, 15:30', note: 'Received via email from Eurodontic Ltd.' },
      { id: 'a-h25_08-2', type: 'approved', actor: 'Finance Manager', ts: '06 Aug 2025, 11:18', note: 'Approved after reviewing delivery schedule and confirming PO match.' },
    ],
  },
  {
    id: 'inv_h25_10', number: 'SCS-2025-0921', docType: 'invoice',
    supplier: 'Smile Ceramics Studio', categories: ['Dental Labs'],
    billedTo: 'clinic', billedToName: 'Smile Genius Edinburgh', entity: 'Clinic',
    amount: 198.50, currency: 'GBP', vatAmount: 33.08,
    date: '2025-10-14', dueDate: '2025-11-14', receivedAt: '2025-10-14T11:05:00Z',
    source: 'manual', status: 'payment_processed', ragScore: 95, ragColor: 'green', aiConfidence: 96,
    assignedTo: 'Auto-approved', approvalRule: 'Lab · Clinic · £0–£300', issues: [],
    ruleResults: [],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '14 Oct 2025, 11:05', sub: 'uploaded manually' },
      { label: 'Auto-approved', done: true, timestamp: '14 Oct 2025, 11:06', sub: 'Rule: Lab · £0–£300' },
      { label: 'Payment Processed', done: true, timestamp: '18 Oct 2025, 13:30' },
    ],
    activity: [
      { id: 'a-h25_10-1', type: 'submitted', actor: 'System', ts: '14 Oct 2025, 11:05', note: 'Uploaded manually by Clinic Manager.' },
      { id: 'a-h25_10-2', type: 'approved', actor: 'System (Auto rule)', ts: '14 Oct 2025, 11:06', note: 'Auto-approved under rule "Lab · £0–£300".' },
    ],
  },
  {
    id: 'inv_h25_12', number: 'DSI-2025-7702', docType: 'invoice',
    supplier: 'Dentsply Sirona', categories: ['Equipment'],
    billedTo: 'group_hq', billedToName: 'SmileGenius Group HQ', entity: 'Group HQ',
    amount: 2640.00, currency: 'GBP', vatAmount: 440.00,
    date: '2025-12-02', dueDate: '2026-01-02', receivedAt: '2025-12-02T09:00:00Z',
    source: 'email', status: 'payment_processed', ragScore: 90, ragColor: 'green', aiConfidence: 92,
    assignedTo: 'Group Finance', approvalRule: 'Equipment · Group HQ · £2500–£10000', issues: [],
    ruleResults: [],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '02 Dec 2025, 09:00', sub: 'received via email' },
      { label: 'Approved', done: true, timestamp: '03 Dec 2025, 14:12', sub: 'by Group Finance' },
      { label: 'Payment Processed', done: true, timestamp: '08 Dec 2025, 10:00' },
    ],
    activity: [
      { id: 'a-h25_12-1', type: 'submitted', actor: 'System', ts: '02 Dec 2025, 09:00', note: 'Received via email from Dentsply Sirona.' },
      { id: 'a-h25_12-2', type: 'approved', actor: 'Group Finance', ts: '03 Dec 2025, 14:12', note: 'Approved following dual sign-off for equipment purchase >£2,500.' },
    ],
  },
  // ─── inv_qc_demo — Low-confidence scan, marquee QC validation example ───────────
  // AI extraction confidence was low so the parser couldn't reliably read Supplier,
  // Billed-to, Entity, or Categories. The QC banner at the top of the overlay calls
  // these out as required-for-approval, each chip scroll-jumps + flashes the field,
  // and the Approve button stays disabled until they're all filled in.
  {
    id: 'inv_qc_demo', number: 'INV-2026-05821', docType: 'invoice',
    supplier: '',                         // ← missing (deliberately, for QC demo)
    categories: [],                       // ← missing
    billedTo: 'clinic', billedToName: '', // ← missing (billedToName blank)
    entity: '',                           // ← missing
    amount: 1875.00, currency: 'GBP', vatAmount: 312.50,
    date: '2026-05-25', dueDate: '2026-06-25', receivedAt: '2026-05-25T08:30:00Z',
    source: 'email', status: 'qc_review', ragScore: 41, ragColor: 'red', aiConfidence: 38,
    assignedTo: 'Pending QC',
    issues: [
      'Low OCR confidence on scanned PDF — manual QC required before approval.',
      'Supplier name unreadable on header band — please confirm.',
    ],
    ruleResults: [
      { id: 'r1',  group: 'Supplier Risk',            title: 'Supplier not approved',     result: 'fail', detail: 'Cannot match supplier — field is blank',          weight: 12, type: 'stop'  },
      { id: 'r14', group: 'Clinic / Entity Matching', title: 'No addressable entity',     result: 'fail', detail: 'Entity field empty — cannot route for approval', weight: 10, type: 'stop'  },
      { id: 'r6',  group: 'Invoice Compliance',       title: 'Category classification',   result: 'warn', detail: 'No category assigned by AI parser',               weight: 0,  type: 'stop'  },
      { id: 'r8',  group: 'Invoice Compliance',       title: 'Missing invoice number',    result: 'pass', detail: 'Invoice number INV-2026-05821 detected',          weight: 10, type: 'score' },
      { id: 'r22', group: 'Dates & timing',           title: 'Due Date OK',               result: 'pass', detail: 'Due 25 Jun 2026 — 31 days away',                  weight: 9,  type: 'score' },
    ],
    timeline: [
      { label: 'Submitted', done: true, timestamp: '25 May 2026, 08:30', sub: 'received via email' },
      { label: 'AI parsed & matched', done: true, timestamp: '25 May 2026, 08:31', sub: 'Confidence 38% · 4 fields blank' },
      { label: 'QC · Needs Review', done: true, timestamp: '25 May 2026, 08:31', sub: 'Low AI confidence — manual check required' },
      { label: 'Awaiting Approval', done: false },
      { label: 'Approved', done: false },
      { label: 'Posted to Xero', done: false },
    ],
    lineItems: [
      { description: 'Dental supplies — line item 1 (description unclear on scan)', qty: 1, unitPrice: 825.00,  total: 825.00  },
      { description: 'Dental supplies — line item 2',                                  qty: 2, unitPrice: 525.00,  total: 1050.00 },
    ],
    activity: [
      { id: 'a-qc-1', type: 'submitted', actor: 'System',  ts: '25 May 2026, 08:30', note: 'Received via email. Scan quality poor — OCR confidence 38%.' },
      { id: 'a-qc-2', type: 'note',      actor: 'AI Parser', ts: '25 May 2026, 08:31', note: 'Unable to extract Supplier, Billed to, Entity, and Categories with high confidence. Flagged for human QC.' },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmt(amount: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ─── Config ────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<InvoiceStatus, { label: string; chipClass: string; dotClass: string; icon: React.ReactNode }> = {
  qc_review:            { label: 'QC · Needs Review',   chipClass: 'bg-[#FFEBEE] text-[#D4183D]', dotClass: 'bg-[#D4183D]', icon: <AlertTriangle className="w-3 h-3" /> },
  awaiting_approval:    { label: 'Awaiting Approval',    chipClass: 'bg-[#FFF8E1] text-[#E65100]', dotClass: 'bg-[#E65100]', icon: <Clock className="w-3 h-3" /> },
  disputed:             { label: 'Disputed',             chipClass: 'bg-[#FFEBEE] text-[#C62828]', dotClass: 'bg-[#C62828]', icon: <AlertTriangle className="w-3 h-3" /> },
  rejected:             { label: 'Rejected',             chipClass: 'bg-[#FFEBEE] text-[#D4183D]', dotClass: 'bg-[#D4183D]', icon: <XCircle className="w-3 h-3" /> },
  approved:             { label: 'Approved',             chipClass: 'bg-[#E8F5E9] text-[#2E7D32]', dotClass: 'bg-[#2E7D32]', icon: <CheckCircle2 className="w-3 h-3" /> },
  exported_for_payment: { label: 'Exported for Payment', chipClass: 'bg-[#E3F2FD] text-[#1565C0]', dotClass: 'bg-[#1565C0]', icon: <Send className="w-3 h-3" /> },
  payment_processed:    { label: 'Payment Processed',    chipClass: 'bg-[#E0F7FA] text-[#00838F]', dotClass: 'bg-[#00838F]', icon: <CheckCheck className="w-3 h-3" /> },
  archived:             { label: 'Archived',             chipClass: 'bg-[#F3F3F5] text-[#717182]', dotClass: 'bg-[#717182]', icon: <Archive className="w-3 h-3" /> },
};

const RAG_CONFIG = {
  green: { barClass: 'bg-[#2E7D32]', badgeClass: 'bg-[#E8F5E9] text-[#2E7D32]' },
  amber: { barClass: 'bg-[#F57C00]', badgeClass: 'bg-[#FFF3E0] text-[#E65100]' },
  red:   { barClass: 'bg-[#C62828]', badgeClass: 'bg-[#FFEBEE] text-[#C62828]' },
};

const RESULT_CONFIG = {
  pass: { icon: <CheckCircle className="w-3.5 h-3.5 text-[#2E7D32]" />, labelClass: 'text-[#2E7D32]', label: 'Pass',    rowBg: 'bg-white' },
  fail: { icon: <XCircle     className="w-3.5 h-3.5 text-[#C62828]" />, labelClass: 'text-[#C62828]', label: 'Fail',    rowBg: 'bg-[#FFF8F8]' },
  warn: { icon: <AlertCircle className="w-3.5 h-3.5 text-[#E65100]" />, labelClass: 'text-[#E65100]', label: 'Warn',    rowBg: 'bg-[#FFFBF5]' },
  skip: { icon: <Ban         className="w-3.5 h-3.5 text-[#A0A0B0]" />, labelClass: 'text-[#A0A0B0]', label: 'Skipped', rowBg: 'bg-white' },
};

const SOURCE_LABELS: Record<InvoiceSource, string> = { email: 'Email', manual: 'Manual', api: 'API' };

// ─── Small UI atoms ────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: InvoiceStatus }) {
  const { label, chipClass, icon } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${chipClass}`}>
      {icon}{label}
    </span>
  );
}

function RagBadge({ score, color }: { score: number; color: 'green' | 'amber' | 'red' }) {
  if (score === 0) return <span className="text-xs text-[#A0A0B0]">—</span>;
  const dotColor = color === 'green' ? '#2E7D32' : color === 'amber' ? '#F57C00' : '#C62828';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${RAG_CONFIG[color].badgeClass}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
      {score}
    </span>
  );
}

// ─── Canonical approval-pipeline timeline ────────────────────────────────────
// Every invoice goes through the same five stages. Each stage is "done" based
// on the invoice's current status — Disputed/Rejected/Archived bail out after
// AI parse since the invoice is on hold.
function buildPipelineTimeline(invoice: Invoice): TimelineStep[] {
  // Pull timestamps/sub-details from the existing stored timeline so any
  // history we have (e.g. "received via email", "Confidence 96%") is preserved.
  const findStored = (...labels: string[]) =>
    invoice.timeline.find(t => labels.some(l => t.label.toLowerCase().includes(l.toLowerCase())));

  const submitted     = findStored('Submitted');
  const aiParsed      = findStored('AI parsed', 'AI parse');
  const qcReview      = findStored('QC');
  const approved      = findStored('Approved', 'Auto-approved', 'Awaiting Approval');
  const exported      = findStored('Exported', 'Posted to Xero');
  const paid          = findStored('Paid', 'Payment processed');

  const status = invoice.status;
  const onHold = status === 'disputed' || status === 'rejected' || status === 'archived';
  // Past QC = any status downstream of QC.
  const pastQC = status !== 'qc_review';

  const stages: TimelineStep[] = [
    {
      label: 'Submitted',
      done: true,
      timestamp: submitted?.timestamp,
      sub: submitted?.sub ?? 'Received',
    },
    {
      label: 'AI parsed & matched',
      done: invoice.aiConfidence > 0 || !!aiParsed?.done,
      timestamp: aiParsed?.timestamp,
      sub: aiParsed?.sub ?? (invoice.aiConfidence > 0 ? `Confidence ${invoice.aiConfidence}%` : undefined),
    },
    {
      // QC is its own first-class step before Approval. Low-confidence /
      // missing-data invoices live here until a human QC's them; everything
      // else passes through instantly (auto-passed).
      label: 'QC · Needs Review',
      done: pastQC,
      timestamp: qcReview?.timestamp,
      sub: qcReview?.sub ?? (pastQC ? 'Auto-passed' : 'Manual review required'),
    },
    {
      label: status === 'awaiting_approval'
        ? 'Awaiting Approval'
        : status === 'disputed'
          ? 'Disputed'
          : status === 'rejected'
            ? 'Rejected'
            : status === 'qc_review'
              ? 'Awaiting Approval'
              : 'Approved',
      done: !onHold && (status === 'approved' || status === 'exported_for_payment' || status === 'payment_processed'),
      timestamp: approved?.timestamp,
      sub: approved?.sub ?? (invoice.approvalRule ? `Rule: ${invoice.approvalRule}` : undefined),
      approvalChain: invoice.approvalChain,
    },
    {
      label: 'Exported for Payment',
      done: status === 'exported_for_payment' || status === 'payment_processed',
      timestamp: exported?.timestamp,
      sub: exported?.sub,
    },
    {
      label: 'Payment Processed',
      done: status === 'payment_processed',
      timestamp: paid?.timestamp,
      sub: paid?.sub,
    },
  ];

  // Tag the "current" step. With QC added the index of "approval" shifts to 3.
  if (status === 'qc_review') {
    stages[2].state = 'current';
  } else if (status === 'disputed' || status === 'rejected') {
    stages[3].state = 'blocked';
  } else if (status === 'awaiting_approval') {
    stages[3].state = 'current';
  } else if (status === 'approved') {
    stages[4].state = 'current';
  } else if (status === 'exported_for_payment') {
    stages[5].state = 'current';
  }

  return stages;
}

// ─── Inline editable row for the invoice Details table ───────────────────────
// Renders the value as a plain label until clicked, then becomes an input.
// Saves on blur (or Enter), reverts on Escape. The caller wires a toast in onSave.
function InlineEditableRow({
  label, value, onSave, editable, type = 'text', accent, display, placeholder,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  editable: boolean;
  type?: 'text' | 'date' | 'number';
  accent?: boolean;
  display?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => { setDraft(value); }, [value]);

  const inputRef = useRef<HTMLInputElement | null>(null);

  if (!editable) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-xs text-[#717182]">{label}</span>
        <span className={`text-xs text-right ${accent ? 'font-medium text-[#3B5BDB]' : 'text-[#030213]'}`}>{display ?? value}</span>
      </div>
    );
  }

  function commit() {
    setFocused(false);
    const next = draft.trim();
    if (next !== value) onSave(next);
  }

  function startEdit() {
    setFocused(true);
    // Defer focus until the input renders
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 gap-3 group hover:bg-[#FAFBFF] transition-colors">
      <span className="text-xs text-[#717182] flex-shrink-0">{label}</span>
      {focused ? (
        <input
          ref={inputRef}
          type={type}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur(); }
          }}
          className="text-xs text-right bg-white rounded px-2 py-1 border border-[#4D8EF7] outline-none ring-2 ring-[#4D8EF7]/20 min-w-0 flex-1 max-w-[60%]"
        />
      ) : (
        <button
          type="button"
          onClick={startEdit}
          title="Click to edit"
          className={`text-xs text-right rounded px-2 py-1 border border-transparent hover:border-[#E0E0E6] hover:bg-white transition-colors truncate max-w-[60%] cursor-text ${accent ? 'text-[#3B5BDB] font-medium' : 'text-[#030213]'}`}
        >
          {(display ?? value) || <span className="text-[#A0A0B0] italic">— click to add —</span>}
        </button>
      )}
    </div>
  );
}

// ─── Category → Nominal code map (exported for use in SupplierDetailPage) ────
export const CATEGORY_NOMINALS: { category: string; code: string; nominalName: string }[] = [
  { category: 'Clinical',          code: '2410', nominalName: 'Materials_Purchases' },
  { category: 'Raw Materials',     code: '2410', nominalName: 'Materials_Purchases' },
  { category: 'Dental Labs',       code: '2520', nominalName: 'Lab Costs_Private' },
  { category: 'Implant Suppliers', code: '2520', nominalName: 'Lab Costs_Private' },
  { category: 'Orthodontics',      code: '4400', nominalName: 'Lab Costs_Other Subs' },
  { category: 'Lab',               code: '2520', nominalName: 'Lab Costs_Private' },
  { category: 'Equipment',         code: '3620', nominalName: 'Equipment R&M' },
  { category: 'Capital',           code: '3620', nominalName: 'Equipment R&M' },
  { category: 'Software',          code: '3430', nominalName: 'IT Consumables' },
  { category: 'Utilities',         code: '3230', nominalName: 'Water Rates' },
  { category: 'Maintenance',       code: '3270', nominalName: 'Cleaning' },
  { category: 'Waste Disposal',    code: '3280', nominalName: 'Waste Disposal' },
  { category: 'Insurance',         code: '4345', nominalName: 'HO-SOE Subscription' },
  { category: 'Staff & Training',  code: '3100', nominalName: 'Agency Staff' },
  { category: 'Marketing',         code: '4400', nominalName: 'Lab Costs_Other Subs' },
  { category: 'Professional Fees', code: '4345', nominalName: 'HO-SOE Subscription' },
  { category: 'Finance',           code: '4345', nominalName: 'HO-SOE Subscription' },
  { category: 'Property',          code: '3230', nominalName: 'Water Rates' },
];

// ─── Billed-to entity lists ───────────────────────────────────────────────────
const BILLED_TO_ENTITIES: Record<'clinic' | 'dentist' | 'group_hq', string[]> = {
  clinic:    ['Smile Genius Manchester', 'Smile Genius Bristol', 'Smile Genius Edinburgh', 'Smile Genius Leeds', 'Smile Genius Birmingham', 'Smile Genius Brighton'],
  dentist:   ["Dr. James O'Connor", 'Dr. Emma Thompson', 'Dr. Sarah Chen', 'Dr. Raj Patel', 'Dr. Aisha Memon', 'Dr. Luke Barker'],
  group_hq:  ['SmileGenius Group HQ', 'SmileGenius North Region', 'SmileGenius South Region'],
};

// Dentist roster per practice — used when "Billed to → Dentist" is picked.
// User flow: choose practice first, then pick the dentist who works there.
const DENTISTS_BY_PRACTICE: Record<string, string[]> = {
  'Smile Genius Manchester': ["Dr. James O'Connor", 'Dr. Emma Thompson'],
  'Smile Genius Bristol':    ['Dr. Sarah Chen', 'Dr. Luke Barker'],
  'Smile Genius Edinburgh':  ['Dr. Raj Patel'],
  'Smile Genius Leeds':      ['Dr. Aisha Memon', "Dr. James O'Connor"],
  'Smile Genius Birmingham': ['Dr. Emma Thompson', 'Dr. Sarah Chen'],
  'Smile Genius Brighton':   ['Dr. Luke Barker'],
};

// ─── Searchable supplier dropdown row ────────────────────────────────────────
function InlineSupplierRow({ value, onSave, editable }: { value: string; onSave: (v: string) => void; editable: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const filtered = mockSuppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  if (!editable) return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-[#717182]">Supplier</span>
      <span className="text-xs text-[#030213]">{value}</span>
    </div>
  );

  return (
    <div ref={ref} className="relative flex items-center justify-between px-4 py-2 gap-3 group hover:bg-[#FAFBFF] transition-colors">
      <span className="text-xs text-[#717182] flex-shrink-0">Supplier</span>
      <button type="button" onClick={() => { setOpen(v => !v); setSearch(''); }}
        className="inline-flex items-center gap-1 text-xs rounded px-2 py-1 border border-transparent hover:border-[#E0E0E6] hover:bg-white transition-colors truncate max-w-[60%] text-[#030213]">
        <span className="truncate">{value}</span>
        <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute right-4 top-full mt-1 z-50 bg-white border border-[#E0E0E6] rounded-xl shadow-2xl w-64 overflow-hidden">
          <div className="px-3 py-2 border-b border-[#F0EFF6]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#A0A0B0]" />
              <input autoFocus type="text" placeholder="Search suppliers…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full text-xs pl-6 pr-2 py-1.5 rounded-lg border border-[#E0E0E6] outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20" />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0
              ? <div className="px-3 py-4 text-center text-xs text-[#A0A0B0]">No suppliers found</div>
              : filtered.map(s => (
                <button key={s.id} type="button"
                  onClick={() => { onSave(s.name); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F5F8FF] transition-colors text-left ${s.name === value ? 'bg-[#EEF4FF]' : ''}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${s.avatarColor}`}>{s.initials}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#030213] truncate">{s.name}</p>
                    <p className="text-[10px] text-[#A0A0B0] truncate">{s.categories.slice(0, 2).join(' · ')}</p>
                  </div>
                  {s.name === value && <Check className="w-3 h-3 text-[#4D8EF7] flex-shrink-0" />}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Entity dropdown row ──────────────────────────────────────────────────────
function InlineEntityDropdownRow({ value, onSave, editable }: { value: string; onSave: (v: string) => void; editable: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const OPTIONS = ['Clinic', 'Dentist', 'Group HQ'];
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  if (!editable) return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-[#717182]">Entity</span>
      <span className="text-xs text-[#030213]">{value}</span>
    </div>
  );

  return (
    <div ref={ref} className="relative flex items-center justify-between px-4 py-2 gap-3 group hover:bg-[#FAFBFF] transition-colors">
      <span className="text-xs text-[#717182] flex-shrink-0">Entity</span>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 text-xs rounded px-2 py-1 border border-transparent hover:border-[#E0E0E6] hover:bg-white transition-colors text-[#030213]">
        {value}<ChevronDown className="w-3 h-3 opacity-50" />
      </button>
      {open && (
        <div className="absolute right-4 top-full mt-1 z-50 bg-white border border-[#E0E0E6] rounded-lg shadow-xl py-1 min-w-[140px]">
          {OPTIONS.map(opt => (
            <button key={opt} type="button" onClick={() => { onSave(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[#F5F8FF] transition-colors flex items-center justify-between ${opt === value ? 'text-[#4D8EF7] font-semibold' : 'text-[#030213]'}`}>
              {opt}{opt === value && <Check className="w-3 h-3 text-[#4D8EF7]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Billed-to picker row ──
// Single modal with an explicit "Billed to:" type selector at the top
// (Practice / Dentist / Group HQ). User picks the type first, the list
// below populates with the matching options. Each dentist row still shows
// the practice they're at, so no further drill-down is needed.
function BilledToPickerRow({
  billedTo, billedToName, onSave, editable,
}: { billedTo: 'clinic' | 'dentist' | 'group_hq'; billedToName: string; onSave: (bt: 'clinic' | 'dentist' | 'group_hq', name: string) => void; editable: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Primary "Billed to" type selector — drives what shows in the list below.
  const [type, setType] = useState<'clinic' | 'dentist' | 'group_hq'>(billedTo);
  // Inside the Dentist type the user picks the practice first, then the
  // dentist. null = still on the practice-picker step.
  const [dentistPractice, setDentistPractice] = useState<string | null>(null);

  const TYPE_OPTIONS = [
    { key: 'clinic'   as const, label: 'Practice', count: BILLED_TO_ENTITIES.clinic.length },
    { key: 'dentist'  as const, label: 'Dentist',  count: Object.values(DENTISTS_BY_PRACTICE).reduce((s, ds) => s + ds.length, 0) },
    { key: 'group_hq' as const, label: 'Group HQ', count: BILLED_TO_ENTITIES.group_hq.length },
  ];

  // Flatten dentist roster so each dentist-at-practice pair is its own row.
  // Some dentists work at multiple practices and so appear more than once.
  const allDentists = useMemo(
    () => Object.entries(DENTISTS_BY_PRACTICE).flatMap(
      ([practice, ds]) => ds.map(name => ({ name, practice }))
    ),
    []
  );

  const q = search.trim().toLowerCase();
  const practiceList = BILLED_TO_ENTITIES.clinic.filter(n => n.toLowerCase().includes(q));
  const groupList    = BILLED_TO_ENTITIES.group_hq.filter(n => n.toLowerCase().includes(q));
  // (`allDentists` is no longer used directly — the Dentist branch now drills
  // through practice → roster, so we filter on the chosen practice instead.)
  void allDentists;

  function resetAndClose() {
    setOpen(false);
    setSearch('');
    setType(billedTo);
    setDentistPractice(null);
  }

  if (!editable) return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-[#717182]">Billed to</span>
      <span className="text-xs text-[#030213]">{billedToName}</span>
    </div>
  );

  // Helper for initials avatar
  const initialsOf = (name: string) => {
    const words = name.replace('Dr. ', '').split(' ');
    return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase();
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 gap-3 group hover:bg-[#FAFBFF] transition-colors cursor-pointer"
        onClick={() => { setOpen(true); setSearch(''); }}>
        <span className="text-xs text-[#717182] flex-shrink-0">Billed to</span>
        <span className="inline-flex items-center gap-1 text-xs rounded px-2 py-1 border border-transparent group-hover:border-[#E0E0E6] group-hover:bg-white transition-colors text-[#030213] truncate max-w-[60%]">
          <span className="truncate">{billedToName}</span>
          <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
        </span>
      </div>
      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={resetAndClose}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0E6]">
                <div>
                  <h3 className="text-sm font-semibold text-[#030213]">Billed To</h3>
                  <p className="text-[11px] text-[#717182] mt-0.5">Pick the type first, then choose the entity.</p>
                </div>
                <button type="button" onClick={resetAndClose} className="w-7 h-7 rounded-full hover:bg-[#F3F3F5] flex items-center justify-center"><X className="w-3.5 h-3.5 text-[#717182]" /></button>
              </div>

              {/* ── Primary "Billed to" type selector ──
                  Big segmented pill buttons. The selected one drives what list
                  populates below. */}
              <div className="px-5 pt-4 pb-3 border-b border-[#F0EFF6] bg-[#FAFBFF]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A0A0B0] mb-2">Billed to</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {TYPE_OPTIONS.map(opt => {
                    const active = type === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => { setType(opt.key); setSearch(''); setDentistPractice(null); }}
                        className={`px-2 py-2.5 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 ${
                          active
                            ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white border-transparent shadow-md shadow-[#4D8EF7]/20'
                            : 'bg-white text-[#5A5568] border-[#E0E0E6] hover:border-[#4D8EF7]/40 hover:text-[#030213]'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className={`text-[9px] font-medium ${active ? 'text-white/80' : 'text-[#A0A0B0]'}`}>{opt.count} {opt.count === 1 ? 'option' : 'options'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step indicator + breadcrumb for the Dentist two-step.
                  Practice / Group HQ types skip this block. */}
              {type === 'dentist' && (
                <div className="px-5 py-2.5 border-b border-[#F0EFF6] bg-white flex items-center gap-2">
                  {/* Step 1 chip */}
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ${
                    !dentistPractice ? 'bg-[#EEF4FF] text-[#1565C0]' : 'bg-[#E8F5E9] text-[#2E7D32]'
                  }`}>
                    {dentistPractice
                      ? <Check className="w-2.5 h-2.5" strokeWidth={3} />
                      : <span className="w-3.5 h-3.5 rounded-full bg-[#1565C0] text-white text-[8px] flex items-center justify-center font-bold">1</span>}
                    Practice
                  </span>
                  <span className="text-[#D4CEE1]">→</span>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ${
                    dentistPractice ? 'bg-[#EEF4FF] text-[#1565C0]' : 'bg-[#F3F3F5] text-[#A0A0B0]'
                  }`}>
                    <span className={`w-3.5 h-3.5 rounded-full text-white text-[8px] flex items-center justify-center font-bold ${
                      dentistPractice ? 'bg-[#1565C0]' : 'bg-[#C8C8D4]'
                    }`}>2</span>
                    Dentist
                  </span>
                  {dentistPractice && (
                    <div className="ml-auto flex items-center gap-2 text-[11px]">
                      <span className="text-[#717182]">at <span className="font-medium text-[#030213]">{dentistPractice}</span></span>
                      <button
                        type="button"
                        onClick={() => { setDentistPractice(null); setSearch(''); }}
                        className="text-[#4D8EF7] hover:text-[#3578E5] font-semibold"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Search — scoped to the selected type / sub-step */}
              <div className="px-4 py-3 border-b border-[#F0EFF6]">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0A0B0]" />
                  <input
                    autoFocus
                    type="text"
                    placeholder={
                      type === 'clinic'                          ? 'Search practices…'
                    : type === 'dentist' && !dentistPractice     ? 'Search practice the dentist works at…'
                    : type === 'dentist' && dentistPractice      ? `Search dentists at ${dentistPractice}…`
                    :                                              'Search group entities…'
                    }
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full text-sm pl-8 pr-3 py-2 rounded-lg border border-[#E0E0E6] outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
                  />
                </div>
              </div>

              {/* Populated list — switches based on the selected type */}
              <div className="flex-1 overflow-y-auto min-h-[260px]">
                {type === 'clinic' && (
                  practiceList.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#A0A0B0]">No practices match "{search}"</div>
                  ) : practiceList.map(name => {
                    const isCurrent = billedTo === 'clinic' && name === billedToName;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => { onSave('clinic', name); resetAndClose(); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F8FF] transition-colors text-left border-b border-[#F8F8F8] last:border-b-0 ${isCurrent ? 'bg-[#EEF4FF]' : ''}`}
                      >
                        <span className="w-8 h-8 rounded-full bg-[#EEF4FF] text-[#4D8EF7] flex items-center justify-center text-[10px] font-bold flex-shrink-0">{initialsOf(name)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#030213] truncate">{name}</p>
                          <p className="text-[11px] text-[#A0A0B0]">{(DENTISTS_BY_PRACTICE[name] ?? []).length} dentist{(DENTISTS_BY_PRACTICE[name] ?? []).length === 1 ? '' : 's'}</p>
                        </div>
                        {isCurrent && <Check className="w-4 h-4 text-[#4D8EF7] flex-shrink-0" />}
                      </button>
                    );
                  })
                )}

                {type === 'dentist' && !dentistPractice && (
                  // STEP 1 — pick the practice the dentist works at
                  <>
                    <div className="px-4 py-2 bg-[#FAFBFF] border-b border-[#F0EFF6]">
                      <p className="text-[11px] text-[#717182]">
                        First pick the practice — then choose the dentist who works there.
                      </p>
                    </div>
                    {practiceList.length === 0 ? (
                      <div className="py-12 text-center text-xs text-[#A0A0B0]">No practices match "{search}"</div>
                    ) : practiceList.map(name => {
                      const dentistCount = (DENTISTS_BY_PRACTICE[name] ?? []).length;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => { setDentistPractice(name); setSearch(''); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F8FF] transition-colors text-left border-b border-[#F8F8F8] last:border-b-0"
                        >
                          <span className="w-8 h-8 rounded-full bg-[#EEF4FF] text-[#4D8EF7] flex items-center justify-center text-[10px] font-bold flex-shrink-0">{initialsOf(name)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#030213] truncate">{name}</p>
                            <p className="text-[11px] text-[#A0A0B0]">{dentistCount} dentist{dentistCount === 1 ? '' : 's'}</p>
                          </div>
                          <ChevronDown className="w-4 h-4 text-[#A0A0B0] flex-shrink-0 -rotate-90" />
                        </button>
                      );
                    })}
                  </>
                )}

                {type === 'dentist' && dentistPractice && (() => {
                  // STEP 2 — pick the dentist at the chosen practice
                  const roster = (DENTISTS_BY_PRACTICE[dentistPractice] ?? []).filter(n => n.toLowerCase().includes(q));
                  return roster.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#A0A0B0]">
                      No dentists at {dentistPractice} match "{search}"
                    </div>
                  ) : roster.map(dName => {
                    const isCurrent = billedTo === 'dentist' && dName === billedToName;
                    return (
                      <button
                        key={dName}
                        type="button"
                        onClick={() => { onSave('dentist', dName); resetAndClose(); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F8FF] transition-colors text-left border-b border-[#F8F8F8] last:border-b-0 ${isCurrent ? 'bg-[#EEF4FF]' : ''}`}
                      >
                        <span className="w-8 h-8 rounded-full bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center text-[10px] font-bold flex-shrink-0">{initialsOf(dName)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#030213] truncate">{dName}</p>
                          <p className="text-[11px] text-[#A0A0B0] truncate">at {dentistPractice}</p>
                        </div>
                        {isCurrent && <Check className="w-4 h-4 text-[#4D8EF7] flex-shrink-0" />}
                      </button>
                    );
                  });
                })()}

                {type === 'group_hq' && (
                  groupList.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#A0A0B0]">No group entities match "{search}"</div>
                  ) : groupList.map(name => {
                    const isCurrent = billedTo === 'group_hq' && name === billedToName;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => { onSave('group_hq', name); resetAndClose(); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F8FF] transition-colors text-left border-b border-[#F8F8F8] last:border-b-0 ${isCurrent ? 'bg-[#EEF4FF]' : ''}`}
                      >
                        <span className="w-8 h-8 rounded-full bg-[#E0F7FA] text-[#00838F] flex items-center justify-center text-[10px] font-bold flex-shrink-0">{initialsOf(name)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#030213] truncate">{name}</p>
                        </div>
                        {isCurrent && <Check className="w-4 h-4 text-[#4D8EF7] flex-shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

// ─── Category multi-select with nominal codes + add-new ──────────────────────
function CategoryPickerRow({
  value, defaultCode, onSave, onChangeDefault, editable,
}: {
  value: string[];
  defaultCode?: string;
  onSave: (v: string[]) => void;
  onChangeDefault?: (code: string | undefined) => void;
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(value);
  const [localDefault, setLocalDefault] = useState<string | undefined>(defaultCode);
  const [search, setSearch] = useState('');
  const [extraCats, setExtraCats] = useState<{ category: string; code: string; nominalName: string }[]>([]);
  const [addMode, setAddMode] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newNominal, setNewNominal] = useState('');

  useEffect(() => { if (open) { setSelected(value); setLocalDefault(defaultCode); } }, [open]);

  const allCats = [...CATEGORY_NOMINALS, ...extraCats];
  const filtered = allCats.filter(c =>
    c.category.toLowerCase().includes(search.toLowerCase()) ||
    c.code.includes(search) ||
    c.nominalName.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(cat: string) {
    setSelected(prev => {
      const removing = prev.includes(cat);
      // Clear default if the category being deselected owns it
      if (removing) {
        const cn = allCats.find(cn => cn.category === cat);
        if (cn && cn.code === localDefault) setLocalDefault(undefined);
      }
      return removing ? prev.filter(c => c !== cat) : [...prev, cat];
    });
  }

  function addNew() {
    if (!newCat.trim()) return;
    const entry = { category: newCat.trim(), code: newCode.trim() || '—', nominalName: newNominal.trim() || newCat.trim() };
    setExtraCats(prev => [...prev, entry]);
    setSelected(prev => [...prev, entry.category]);
    setNewCat(''); setNewCode(''); setNewNominal(''); setAddMode(false);
  }

  function apply() {
    onSave(selected);
    onChangeDefault?.(localDefault);
    setOpen(false); setSearch(''); setAddMode(false);
  }

  // Chip display — default chip gets a gold star
  const defaultCatName = CATEGORY_NOMINALS.find(cn => cn.code === defaultCode)?.category
    ?? extraCats.find(cn => cn.code === defaultCode)?.category;

  if (!editable) return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-[#717182]">Categories</span>
      <div className="flex items-center gap-1 flex-wrap justify-end">
        {value.map(c => (
          <span key={c} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${c === defaultCatName ? 'bg-[#FFF8E1] text-[#92400E]' : 'bg-[#EEF4FF] text-[#1565C0]'}`}>
            {c === defaultCatName && <Star className="w-2.5 h-2.5 fill-[#F59E0B] text-[#F59E0B]" />}
            {c}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 gap-3 group hover:bg-[#FAFBFF] transition-colors cursor-pointer"
        onClick={() => { setOpen(true); setSearch(''); setAddMode(false); }}>
        <span className="text-xs text-[#717182] flex-shrink-0">Categories</span>
        <div className="flex items-center gap-1 flex-wrap justify-end max-w-[65%]">
          {value.length === 0
            ? <span className="text-xs text-[#A0A0B0] italic">— click to add —</span>
            : value.map(c => (
              <span key={c} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${c === defaultCatName ? 'bg-[#FFF8E1] text-[#92400E]' : 'bg-[#EEF4FF] text-[#1565C0]'}`}>
                {c === defaultCatName && <Star className="w-2.5 h-2.5 fill-[#F59E0B] text-[#F59E0B]" />}
                {c}
              </span>
            ))}
          <ChevronDown className="w-3 h-3 text-[#A0A0B0] flex-shrink-0" />
        </div>
      </div>
      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0E6] flex-shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-[#030213]">Categories & GL Codes</h3>
                  <p className="text-[11px] text-[#717182] mt-0.5">{selected.length} selected</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="w-7 h-7 rounded-full hover:bg-[#F3F3F5] flex items-center justify-center"><X className="w-3.5 h-3.5 text-[#717182]" /></button>
              </div>
              {/* Search */}
              <div className="px-4 py-3 border-b border-[#F0EFF6] flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#A0A0B0]" />
                  <input autoFocus type="text" placeholder="Search GL name or code…"
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full text-xs pl-7 pr-3 py-2 rounded-lg border border-[#E0E0E6] outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20" />
                </div>
              </div>
              {/* Column headers */}
              <div className="px-4 py-1.5 bg-[#F8F9FC] border-b border-[#E0E0E6] flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-4 flex-shrink-0" />
                  <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider flex-1">GL Name</span>
                  <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider w-16 text-right flex-shrink-0">Code</span>
                  <div className="w-5 flex-shrink-0" title="Flag default GL code"><Star className="w-3 h-3 text-[#D1D5DB] mx-auto" /></div>
                </div>
              </div>
              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0
                  ? <div className="py-8 text-center text-xs text-[#A0A0B0]">No matches found</div>
                  : filtered.map((c, i) => {
                    const isSel = selected.includes(c.category);
                    const isDefault = localDefault === c.code && isSel;
                    return (
                      <button key={i} type="button" onClick={() => toggle(c.category)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left border-b border-[#F8F8F8] hover:bg-[#F5F8FF] ${isDefault ? 'bg-[#FFFBEB]' : isSel ? 'bg-[#EEF4FF]' : ''}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSel ? 'bg-[#4D8EF7] border-[#4D8EF7]' : 'border-[#D1D5DB]'}`}>
                          {isSel && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </div>
                        <span className="text-xs text-[#030213] font-medium flex-1 truncate">{c.nominalName}</span>
                        <span className={`text-[11px] font-mono font-semibold w-16 text-right flex-shrink-0 ${isDefault ? 'text-[#F59E0B]' : 'text-[#4D8EF7]'}`}>{c.code}</span>
                        {/* Star flag — only visible on selected rows */}
                        <button
                          type="button"
                          title={isDefault ? 'Default — click to remove' : isSel ? 'Flag as default GL code' : ''}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isSel) return;
                            setLocalDefault(prev => prev === c.code ? undefined : c.code);
                          }}
                          className={`w-5 h-5 flex items-center justify-center flex-shrink-0 rounded transition-colors ${isSel ? 'hover:bg-[#FEF3C7]' : 'pointer-events-none opacity-0'}`}
                        >
                          <Star className={`w-3.5 h-3.5 transition-colors ${isDefault ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#D1D5DB] hover:text-[#F59E0B]'}`} />
                        </button>
                      </button>
                    );
                  })}
              </div>
              {/* Add new category */}
              <div className="border-t border-[#E0E0E6] flex-shrink-0">
                {addMode ? (
                  <div className="px-4 py-3 flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">New Category</p>
                    <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Category name"
                      className="text-xs px-2.5 py-1.5 border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7]" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="Code e.g. 3620"
                        className="text-xs px-2.5 py-1.5 border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] font-mono" />
                      <input value={newNominal} onChange={e => setNewNominal(e.target.value)} placeholder="GL name"
                        className="text-xs px-2.5 py-1.5 border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7]" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={addNew} disabled={!newCat.trim()}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-[#4D8EF7] text-white font-semibold hover:bg-[#1565C0] transition-colors disabled:opacity-40">Add</button>
                      <button type="button" onClick={() => setAddMode(false)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-[#E0E0E6] text-[#717182] hover:bg-[#F5F5F5] transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddMode(true)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-xs text-[#4D8EF7] font-semibold hover:bg-[#F5F9FF] transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add new category & code
                  </button>
                )}
              </div>
              {/* Footer */}
              <div className="px-4 py-3 border-t border-[#E0E0E6] flex items-center justify-between flex-shrink-0 bg-[#F8F9FC]">
                <button type="button" onClick={() => setSelected([])} className="text-xs text-[#717182] hover:text-[#C62828] transition-colors">Clear all</button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="text-xs px-4 py-1.5 rounded-lg border border-[#E0E0E6] text-[#717182] hover:bg-[#F5F5F5] transition-colors">Cancel</button>
                  <button type="button" onClick={apply} className="text-xs px-4 py-1.5 rounded-lg bg-[#4D8EF7] text-white font-semibold hover:bg-[#1565C0] transition-colors">Apply ({selected.length})</button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

// ─── Inline editable Line Items table ────────────────────────────────────────
type LineItem = { description: string; qty: number; unitPrice: number; total: number; matchedCaseId?: string };

function EditableLineItems({ items, editable, onOpenCase, onChange, compact = true }: {
  items: LineItem[];
  editable: boolean;
  onOpenCase?: (id: string) => void;
  onChange: (next: LineItem[]) => void;
  // Card-per-line is the canonical layout now. The legacy 5-column table is
  // still kept behind `compact={false}` so anyone who explicitly opts back in
  // can do so, but every existing caller renders the cards.
  compact?: boolean;
}) {
  function update(i: number, patch: Partial<LineItem>) {
    const next = items.map((row, idx) => {
      if (idx !== i) return row;
      const merged = { ...row, ...patch };
      merged.total = +(merged.qty * merged.unitPrice).toFixed(2);
      return merged;
    });
    onChange(next);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...items, { description: '', qty: 1, unitPrice: 0, total: 0 }]);
  }

  // ── Case-mapping picker ──
  // Tracks which line's "remap" popover is open, plus the search query inside it.
  // The available case IDs mirror the mockCases set in CasesPage (CASE-001..050).
  const AVAILABLE_CASES = useMemo(
    () => Array.from({ length: 50 }, (_, idx) => `CASE-${String(idx + 1).padStart(3, '0')}`),
    [],
  );
  const [mapPickerIdx, setMapPickerIdx] = useState<number | null>(null);
  const [mapSearch, setMapSearch] = useState('');
  useEffect(() => {
    if (mapPickerIdx === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-case-picker]') || target.closest('[data-case-picker-toggle]')) return;
      setMapPickerIdx(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mapPickerIdx]);
  const filteredCases = AVAILABLE_CASES.filter(c => c.toLowerCase().includes(mapSearch.toLowerCase()));

  function renderMatchControls(i: number, item: LineItem) {
    const isOpen = mapPickerIdx === i;
    return (
      <div className="inline-flex items-center gap-1 relative">
        {item.matchedCaseId ? (
          <>
            <button
              onClick={() => onOpenCase?.(item.matchedCaseId!)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#4D8EF7] hover:text-[#3578E5] bg-[#EEF4FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] px-2 py-0.5 rounded-full transition-colors"
              title={`Open ${item.matchedCaseId}`}
            >
              {item.matchedCaseId}
              <ArrowRight className="w-2.5 h-2.5" />
            </button>
            {editable && (
              <>
                <button
                  data-case-picker-toggle="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMapPickerIdx(isOpen ? null : i);
                    setMapSearch('');
                  }}
                  title="Map to a different case"
                  className={`w-5 h-5 inline-flex items-center justify-center rounded-full border transition-colors ${
                    isOpen
                      ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]'
                      : 'border-[#E0E0E6] text-[#5A5568] hover:border-[#4D8EF7] hover:bg-[#EEF4FF] hover:text-[#1565C0]'
                  }`}
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={() => update(i, { matchedCaseId: undefined })}
                  title="Remove case match"
                  className="w-5 h-5 inline-flex items-center justify-center rounded-full border border-[#E0E0E6] text-[#5A5568] hover:border-[#F9DCDC] hover:bg-[#FFEBEE] hover:text-[#C62828] transition-colors"
                >
                  <X className="w-2.5 h-2.5" strokeWidth={3} />
                </button>
              </>
            )}
          </>
        ) : editable ? (
          <button
            data-case-picker-toggle="true"
            onClick={(e) => {
              e.stopPropagation();
              setMapPickerIdx(isOpen ? null : i);
              setMapSearch('');
            }}
            title="Map this line to a case"
            className={`inline-flex items-center gap-1 text-[10px] font-semibold border border-dashed px-2 py-0.5 rounded-full transition-colors ${
              isOpen
                ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]'
                : 'border-[#BFDBFE] text-[#4D8EF7] bg-white hover:bg-[#EEF4FF] hover:text-[#1565C0]'
            }`}
          >
            <Plus className="w-2.5 h-2.5" />
            Map to case
          </button>
        ) : (
          <span className="text-[10px] text-[#A0A0B0] italic">Not matched</span>
        )}
        {isOpen && (
          <div
            data-case-picker="true"
            className="absolute top-full left-0 mt-1 z-50 w-44 bg-white rounded-xl shadow-[0_10px_30px_rgba(77,142,247,0.18)] border border-[#E8EAF6] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          >
            <div className="px-2 py-1.5 border-b border-[#F0EFF6] bg-[#F8F9FC]">
              <input
                autoFocus
                value={mapSearch}
                onChange={e => setMapSearch(e.target.value)}
                placeholder="Search case ID…"
                className="w-full text-[10px] px-1.5 py-1 border border-[#E0E0E6] rounded-md outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
              />
            </div>
            <div className="max-h-40 overflow-y-auto py-1">
              {filteredCases.length === 0 ? (
                <p className="px-2 py-3 text-[10px] text-[#A0A0B0] text-center italic">No matches</p>
              ) : (
                filteredCases.slice(0, 50).map(c => {
                  const isCurrent = c === item.matchedCaseId;
                  return (
                    <button
                      key={c}
                      onClick={() => {
                        update(i, { matchedCaseId: c });
                        setMapPickerIdx(null);
                        setMapSearch('');
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-[10px] font-mono transition-colors flex items-center justify-between ${
                        isCurrent ? 'bg-[#EEF4FF] text-[#1565C0] font-semibold' : 'text-[#030213] hover:bg-[#F5F8FF]'
                      }`}
                    >
                      {c}
                      {isCurrent && <Check className="w-3 h-3" strokeWidth={3} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border border-[#E0E0E6] rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-[#F8F9FC] border-b border-[#E0E0E6] flex items-center justify-between">
        <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest">Line Items</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#A0A0B0]">{items.length} {items.length === 1 ? 'line' : 'lines'}</span>
          {editable && (
            <button
              onClick={add}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#4D8EF7] hover:text-[#3578E5] transition-colors"
            >
              <Plus className="w-3 h-3" /> Add line
            </button>
          )}
        </div>
      </div>
      {/* ── Compact mode: card-per-line ──
          Each line item becomes a vertical card with the description on top,
          a qty × unit-price · total row, and the Matched Case chip / delete
          button at the bottom. No horizontal scrolling, every field always
          visible at any container width. */}
      {compact ? (
        <div className="p-3 space-y-2 bg-white text-xs">
          {items.map((item, i) => (
            <div key={i} className="border border-[#F0EFF6] rounded-lg p-3 hover:bg-[#FAFBFF] transition-colors text-xs">
              {/* Description + Total row */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0 text-xs">
                  {editable ? (
                    <span className="text-xs font-medium text-[#030213]">
                      <EditableCell value={item.description} onSave={(v) => update(i, { description: v })} />
                    </span>
                  ) : (
                    <p className="text-xs font-medium text-[#030213] break-words leading-relaxed">{item.description || <span className="text-[#A0A0B0] italic">No description</span>}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[9px] text-[#A0A0B0] uppercase tracking-wider font-semibold leading-tight">Total</p>
                  <p className="text-xs font-bold text-[#030213] tabular-nums">{fmt(item.total)}</p>
                </div>
              </div>
              {/* Qty × Unit Price breakdown */}
              <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-[#F8F8F8]">
                <div className="flex items-center gap-3 text-xs text-[#717182]">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#A0A0B0] uppercase tracking-wider font-semibold">Qty</span>
                    {editable ? (
                      <span className="min-w-[32px] text-xs"><EditableCell value={String(item.qty)} type="number" align="left" onSave={(v) => update(i, { qty: Number(v) || 0 })} /></span>
                    ) : (
                      <span className="text-xs font-medium text-[#030213]">{item.qty}</span>
                    )}
                  </div>
                  <span className="text-[#D4CEE1]">×</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#A0A0B0] uppercase tracking-wider font-semibold">Price</span>
                    {editable ? (
                      <span className="min-w-[60px] text-xs"><EditableCell value={String(item.unitPrice)} type="number" align="left" displayValue={fmt(item.unitPrice)} onSave={(v) => update(i, { unitPrice: Number(v) || 0 })} /></span>
                    ) : (
                      <span className="text-xs font-medium text-[#030213] tabular-nums">{fmt(item.unitPrice)}</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Matched case + delete row */}
              <div className="flex items-center justify-between gap-2">
                {renderMatchControls(i, item)}
                {editable && (
                  <button
                    onClick={() => remove(i)}
                    title="Remove line"
                    className="p-1 text-[#A0A0B0] hover:text-[#C62828] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
      <>
      {/* Horizontal scroll wrapper — in the collapsed overlay the right panel
          is only ~440px wide which forces the 5-column table to squash.
          Keeping the table at a sensible min-width (640px) and letting the
          wrapper scroll horizontally preserves readability of every column.
          The card's rounded border stays clean because the scroll happens
          *inside* the card, not around it. */}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-xs">
        <thead>
          <tr className="border-b border-[#F0EFF6]">
            <th className="text-left px-4 py-2.5 text-[#717182] font-semibold whitespace-nowrap">Matched Case</th>
            <th className="text-left px-4 py-2.5 text-[#717182] font-semibold">Description</th>
            <th className="text-right px-3 py-2.5 text-[#717182] font-semibold">Qty</th>
            <th className="text-right px-3 py-2.5 text-[#717182] font-semibold">Price</th>
            <th className="text-right px-4 py-2.5 text-[#717182] font-semibold">Total</th>
            {editable && <th className="w-8" />}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-[#F8F8F8] last:border-b-0 hover:bg-[#FAFBFF] transition-colors">
              <td className="px-4 py-2">
                {renderMatchControls(i, item)}
              </td>
              <td className="px-4 py-2 text-[#030213]">
                {editable ? (
                  <EditableCell value={item.description} onSave={(v) => update(i, { description: v })} />
                ) : item.description}
              </td>
              <td className="px-3 py-2 text-right text-[#717182]">
                {editable ? (
                  <EditableCell value={String(item.qty)} type="number" align="right" onSave={(v) => update(i, { qty: Number(v) || 0 })} />
                ) : item.qty}
              </td>
              <td className="px-3 py-2 text-right text-[#717182]">
                {editable ? (
                  <EditableCell value={String(item.unitPrice)} type="number" align="right" displayValue={fmt(item.unitPrice)} onSave={(v) => update(i, { unitPrice: Number(v) || 0 })} />
                ) : fmt(item.unitPrice)}
              </td>
              <td className="px-4 py-2 text-right font-semibold text-[#030213] tabular-nums">{fmt(item.total)}</td>
              {editable && (
                <td className="pr-2">
                  <button
                    onClick={() => remove(i)}
                    title="Remove line"
                    className="p-1 text-[#A0A0B0] hover:text-[#C62828] transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100"
                    style={{ opacity: 1 }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      </>
      )}
    </div>
  );
}

// Lightweight inline-editable text/number cell used inside the Line Items table.
function EditableCell({ value, onSave, type = 'text', align = 'left', displayValue }: {
  value: string;
  onSave: (v: string) => void;
  type?: 'text' | 'number';
  align?: 'left' | 'right';
  displayValue?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { setDraft(value); }, [value]);

  function commit() {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        title="Click to edit"
        className={`w-full ${align === 'right' ? 'text-right' : 'text-left'} px-2 py-1 rounded border border-transparent hover:border-[#E0E0E6] hover:bg-white transition-colors cursor-text truncate`}
      >
        {(displayValue ?? value) || <span className="text-[#A0A0B0] italic">—</span>}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur(); }
      }}
      className={`w-full ${align === 'right' ? 'text-right' : 'text-left'} px-2 py-1 rounded border border-[#4D8EF7] bg-white outline-none ring-2 ring-[#4D8EF7]/20 tabular-nums`}
    />
  );
}

// ─── Edit Invoice slide-over ──────────────────────────────────────────────────
function EditInvoicePanel({ invoice, onClose, onSave }: {
  invoice: Invoice;
  onClose: () => void;
  onSave: (patch: InvoiceEditPatch) => void;
}) {
  const [number, setNumber] = useState(invoice.number);
  const [date, setDate] = useState(invoice.date);
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [categories, setCategories] = useState<string[]>([...invoice.categories]);
  const [billedTo, setBilledTo] = useState<'clinic' | 'dentist' | 'group_hq'>(invoice.billedTo);
  const [billedToName, setBilledToName] = useState(invoice.billedToName);
  const [entity, setEntity] = useState(invoice.entity);
  const [lineItems, setLineItems] = useState(
    (invoice.lineItems ?? []).map(li => ({ ...li }))
  );
  const [vatAmount, setVatAmount] = useState(invoice.vatAmount);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setCategoryOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const subtotal = lineItems.reduce((s, li) => s + li.total, 0);
  const total = subtotal + vatAmount;

  function updateLine(i: number, patch: Partial<{ description: string; qty: number; unitPrice: number }>) {
    setLineItems(prev => prev.map((li, idx) => {
      if (idx !== i) return li;
      const next = { ...li, ...patch };
      next.total = +(next.qty * next.unitPrice).toFixed(2);
      return next;
    }));
  }
  function removeLine(i: number) {
    setLineItems(prev => prev.filter((_, idx) => idx !== i));
  }
  function addLine() {
    setLineItems(prev => [...prev, { description: '', qty: 1, unitPrice: 0, total: 0 }]);
  }
  function toggleCategory(c: string) {
    setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  function handleSave() {
    onSave({
      number: number.trim() || invoice.number,
      date, dueDate, categories,
      billedTo, billedToName: billedToName.trim() || invoice.billedToName,
      entity: entity.trim() || invoice.entity,
      lineItems,
      amount: +total.toFixed(2),
      vatAmount: +vatAmount.toFixed(2),
    });
  }

  const inputCls = 'w-full px-3 py-2 border border-[#E0E0E6] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]';
  const labelCls = 'block text-xs font-semibold text-[#717182] uppercase tracking-wide mb-1.5';

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60]" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-[60] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E6]">
          <div>
            <p className="text-sm font-semibold text-[#030213]">Edit Invoice</p>
            <p className="text-[10px] text-[#A0A0B0]">{invoice.supplier} · {invoice.number}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F0EFF6] transition-colors text-[#717182]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Invoice Identity */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-[#A0A0B0] uppercase tracking-wider">Invoice</p>
            <div>
              <label className={labelCls}>Invoice Number</label>
              <input value={number} onChange={e => setNumber(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Invoice Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Billed To */}
          <div className="space-y-4 pt-2 border-t border-[#F0EFF6]">
            <p className="text-xs font-semibold text-[#A0A0B0] uppercase tracking-wider">Billed To</p>
            <div>
              <label className={labelCls}>Type</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: 'clinic',   label: 'Clinic' },
                  { v: 'dentist',  label: 'Dentist' },
                  { v: 'group_hq', label: 'Group HQ' },
                ] as const).map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setBilledTo(opt.v)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${billedTo === opt.v ? 'bg-[#EEF4FF] text-[#4D8EF7] border-[#C8D8FC]' : 'bg-white text-[#717182] border-[#E0E0E6] hover:bg-[#F8F9FC]'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Name</label>
              <input value={billedToName} onChange={e => setBilledToName(e.target.value)} placeholder="e.g. Smile Genius Manchester" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Entity</label>
              <input value={entity} onChange={e => setEntity(e.target.value)} placeholder="e.g. Clinic, Group HQ" className={inputCls} />
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-4 pt-2 border-t border-[#F0EFF6]">
            <p className="text-xs font-semibold text-[#A0A0B0] uppercase tracking-wider">Categories</p>
            <div className="relative" ref={categoryRef}>
              <div
                onClick={() => setCategoryOpen(v => !v)}
                className={`w-full min-h-[42px] px-3 py-1.5 text-sm border rounded-lg bg-white cursor-pointer flex flex-wrap gap-1 items-center ${categoryOpen ? 'border-[#4D8EF7] ring-2 ring-[#4D8EF7]/30' : 'border-[#E0E0E6]'}`}
              >
                {categories.length === 0 && <span className="text-[#A0A0B0] py-1">Select categories</span>}
                {categories.map(c => (
                  <span key={c} className="flex items-center gap-1 px-2 py-0.5 bg-[#F0EFF6] text-[#5A5568] border border-[#D4CEE1] rounded text-[11px] font-medium">
                    {c}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); toggleCategory(c); }}
                      className="hover:text-[#C62828] transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                <ChevronDown className={`w-3.5 h-3.5 text-[#A0A0B0] ml-auto flex-shrink-0 transition-transform ${categoryOpen ? 'rotate-180' : ''}`} />
              </div>
              {categoryOpen && (
                <div className="absolute z-50 top-full mt-1 w-full bg-white border border-[#E0E0E6] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {EXPENSE_CATEGORIES.map(c => {
                    const selected = categories.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCategory(c)}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-[#F8F9FC] transition-colors ${selected ? 'text-[#4D8EF7] font-medium' : 'text-[#030213]'}`}
                      >
                        {c}
                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-[#4D8EF7]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3 pt-2 border-t border-[#F0EFF6]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#A0A0B0] uppercase tracking-wider">Line Items</p>
              <button onClick={addLine} className="flex items-center gap-1 text-xs font-medium text-[#4D8EF7] hover:underline">
                <Plus className="w-3.5 h-3.5" /> Add line
              </button>
            </div>
            {lineItems.length === 0 ? (
              <p className="text-xs text-[#A0A0B0] py-4 text-center bg-[#F8F9FC] rounded-lg">No line items — click "Add line" to start.</p>
            ) : (
              <div className="space-y-2">
                {lineItems.map((li, i) => (
                  <div key={i} className="grid grid-cols-[1fr_60px_80px_80px_auto] gap-2 items-center bg-[#F8F9FC] border border-[#E0E0E6] rounded-lg p-2">
                    <input
                      value={li.description}
                      onChange={e => updateLine(i, { description: e.target.value })}
                      placeholder="Description"
                      className="px-2 py-1.5 text-xs border border-[#E0E0E6] rounded bg-white focus:outline-none focus:border-[#4D8EF7]"
                    />
                    <input
                      type="number"
                      min={0}
                      value={li.qty}
                      onChange={e => updateLine(i, { qty: Number(e.target.value) || 0 })}
                      placeholder="Qty"
                      className="px-2 py-1.5 text-xs border border-[#E0E0E6] rounded bg-white focus:outline-none focus:border-[#4D8EF7] tabular-nums"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={li.unitPrice}
                      onChange={e => updateLine(i, { unitPrice: Number(e.target.value) || 0 })}
                      placeholder="Unit price"
                      className="px-2 py-1.5 text-xs border border-[#E0E0E6] rounded bg-white focus:outline-none focus:border-[#4D8EF7] tabular-nums"
                    />
                    <span className="text-xs font-semibold text-[#030213] text-right tabular-nums">£{li.total.toFixed(2)}</span>
                    <button onClick={() => removeLine(i)} className="p-1 text-[#A0A0B0] hover:text-[#C62828] transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            <div className="space-y-2 pt-2 border-t border-[#F0EFF6] text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#717182]">Subtotal</span>
                <span className="font-semibold text-[#030213] tabular-nums">£{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#717182]">VAT</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={vatAmount}
                  onChange={e => setVatAmount(Number(e.target.value) || 0)}
                  className="w-24 px-2 py-1.5 text-xs border border-[#E0E0E6] rounded bg-white focus:outline-none focus:border-[#4D8EF7] tabular-nums text-right"
                />
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[#F0EFF6]">
                <span className="font-semibold text-[#030213]">Total</span>
                <span className="font-bold text-[#030213] tabular-nums">£{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#E0E0E6] flex items-center gap-3">
          <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
            <Save className="w-4 h-4" /> Save Changes
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-[#E0E0E6] text-[#717182] rounded-lg text-sm font-medium hover:bg-[#F8F9FC] transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}

// ─── Dispute quick-action templates ──────────────────────────────────────────
// One-click chips that drop common AP dispute reasons into the email body so
// the user doesn't have to retype them. Tapped chips append a bullet under the
// "Reason for dispute:" section of the template.
const DISPUTE_QUICK_REASONS: { label: string; text: string }[] = [
  { label: 'Amount mismatch',     text: "The total amount doesn't match the price agreed on our PO." },
  { label: 'Line items mismatch', text: "Some line items don't match what was delivered." },
  { label: 'Quantity wrong',      text: "Quantities on the invoice don't match the goods received." },
  { label: 'Missing PO ref',      text: "This invoice is missing a valid PO reference number." },
  { label: 'Possible duplicate',  text: "We believe this duplicates an invoice already processed." },
  { label: 'VAT looks off',       text: "The VAT calculation on this invoice appears incorrect." },
  { label: 'Credit note expected',text: "We're expecting a credit note for returned goods before settling this." },
];

const REPLY_QUICK_ACTIONS: { label: string; text: string }[] = [
  { label: 'Acknowledge',         text: "Thanks for getting back so quickly — we'll review on our side and confirm next steps shortly." },
  { label: 'Request credit note', text: "Please issue a credit note for the disputed amount and resend a corrected invoice." },
  { label: 'Confirm received',    text: "Confirmed — corrected copy received. Putting this through approvals now." },
  { label: 'Close as resolved',   text: "Thanks for the quick turnaround. Happy to close this thread as resolved." },
];

// ─── Overlay Invoice Drawer ────────────────────────────────────────────────────
function InvoiceOverlay({ invoice, onClose, onApprove, onArchive, onUnarchive, onReject, onOpenCase, onEdit, onPatch }: {
  invoice: Invoice; onClose: () => void;
  onApprove: (id: string, note?: string) => void;
  onArchive: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onReject:  (id: string, note: string) => void;
  onOpenCase?: (caseId: string) => void;
  onEdit?:    (id: string, patch: InvoiceEditPatch) => void;
  onPatch?:   (id: string, patch: Partial<Invoice>) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const { toast } = useToast();
  // Default source panel to hidden on small screens — the body stacks vertically
  // on mobile so showing source on top forces a long scroll before the AI summary.
  const [showSource, setShowSource] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 768
  );
  const [rulesOpen, setRulesOpen] = useState(false);

  // ── QC validation — required fields for approval ────────────────────────────
  // Rows in the Details section that MUST be filled before the invoice can be approved.
  // Click a chip in the banner to scroll to the row + briefly flash a red ring around it.
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [flashedField, setFlashedField] = useState<string | null>(null);
  // Entity is derived from Billed to (auto-stamped when the user picks a
  // clinic/dentist/group), so it's no longer a separate required field.
  const requiredFields = [
    { key: 'supplier',   label: 'Supplier',    missing: !invoice.supplier?.trim() },
    { key: 'billedTo',   label: 'Billed to',   missing: !invoice.billedToName?.trim() },
    { key: 'categories', label: 'Categories',  missing: (invoice.categories?.length ?? 0) === 0 },
    { key: 'number',     label: 'Invoice #',   missing: !invoice.number?.trim() },
    { key: 'date',       label: 'Date',        missing: !invoice.date },
    { key: 'dueDate',    label: 'Due date',    missing: !invoice.dueDate },
  ];
  const missingFields = requiredFields.filter(f => f.missing);
  const isMissingField = (k: string) => missingFields.some(f => f.key === k);
  const scrollToField = (key: string) => {
    const el = fieldRefs.current[key];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashedField(key);
    setTimeout(() => setFlashedField(prev => (prev === key ? null : prev)), 1800);
  };
  const [maximized, setMaximized] = useState(() => {
    // Open in full-screen automatically when the URL is /supplier/invoices/<id>
    return typeof window !== 'undefined' && /\/supplier\/invoices\/[^/]+/.test(window.location.pathname);
  });

  // Sync URL with the maximized state — full-screen view gets a shareable URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const base = '/supplier/invoices';
    const fullPath = `${base}/${encodeURIComponent(invoice.id)}`;
    if (maximized) {
      if (window.location.pathname !== fullPath) {
        window.history.replaceState(null, '', fullPath);
      }
    } else {
      if (window.location.pathname.startsWith(`${base}/`)) {
        window.history.replaceState(null, '', base);
      }
    }
  }, [maximized, invoice.id]);

  // Clear the deep-linked URL when the drawer unmounts (close button, navigation)
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/supplier/invoices/')) {
        window.history.replaceState(null, '', '/supplier/invoices');
      }
    };
  }, []);
  const [approveConfirm, setApproveConfirm] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [rejectConfirm, setRejectConfirm] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  // Timeline pop-out modal (compact in header, full timeline in modal)
  const [timelineOpen, setTimelineOpen] = useState(false);
  // Multi-approval chain — collapsed by default; index of step whose chain is expanded
  const [expandedChain, setExpandedChain] = useState<number | null>(null);
  // Reset expansion + close on outside-click whenever the timeline modal opens/closes
  useEffect(() => {
    if (!timelineOpen) {
      setExpandedChain(null);
      return;
    }
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-chain-popover]') || target.closest('[data-chain-toggle]')) return;
      setExpandedChain(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [timelineOpen]);
  // Dispute → email thread (replaces in-app chat composer)
  // If the invoice already carries a thread, open the modal directly.
  const existingThread = invoice.disputeEmails ?? [];
  const [disputeOpen, setDisputeOpen] = useState(existingThread.length > 0);
  const [mailboxConnected, setMailboxConnected] = useState(existingThread.length > 0);
  const [mailboxProvider, setMailboxProvider] = useState<'gmail' | 'outlook' | 'm365' | null>(existingThread.length > 0 ? 'gmail' : null);
  // Pre-filled email template; user can edit before sending
  const defaultSubject = `Dispute: invoice ${invoice.number} (${invoice.supplier})`;
  const defaultBody = `Hi ${invoice.supplier} team,\n\nWe have flagged invoice ${invoice.number} for ${fmt(invoice.amount)} (dated ${fmtDate(invoice.date)}) for review.\n\nReason for dispute:\n  • ${(invoice.issues[0] ?? 'Please review the amount and line items on this invoice.')}\n\nCould you confirm the figures or send across a corrected copy?\n\nThanks,\nSajid Mahmood\nSmile Genius Accounts Payable`;
  const [emailTo, setEmailTo] = useState(`accounts@${invoice.supplier.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`);
  const [emailSubject, setEmailSubject] = useState(defaultSubject);
  const [emailBody, setEmailBody] = useState(defaultBody);
  const [disputeEmails, setDisputeEmails] = useState<DisputeEmail[]>(existingThread);
  const [replyBody, setReplyBody] = useState('');

  // Sync the thread back to the parent so the listing reflects the count.
  function persistDispute(next: DisputeEmail[]) {
    setDisputeEmails(next);
    onPatch?.(invoice.id, { disputeEmails: next });
  }
  // Re-run intelligence
  const [rerunning, setRerunning] = useState(false);
  const [aiConfidence, setAiConfidence] = useState(invoice.aiConfidence);

  const handleRerun = () => {
    setRerunning(true);
    setTimeout(() => {
      // Mock: nudge confidence up by 2-6% capped at 99
      const delta = Math.floor(Math.random() * 5) + 2;
      const next = Math.min(99, Math.max(60, aiConfidence + delta));
      setAiConfidence(next);
      setRerunning(false);
      toast.success(`Re-run complete — AI confidence: ${next}%`);
    }, 1500);
  };

  const fmtMailTs = () =>
    new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleConnectMailbox = (provider: 'gmail' | 'outlook' | 'm365') => {
    // Mock OAuth — in production this would redirect to the provider's consent screen.
    setMailboxProvider(provider);
    setMailboxConnected(true);
    toast.success(`Connected to ${provider === 'gmail' ? 'Gmail' : provider === 'outlook' ? 'Outlook' : 'Microsoft 365'}`);
  };

  const handleSendEmail = () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) return;
    const sent: DisputeEmail = {
      id: `e-${Date.now()}`,
      direction: 'outbound',
      from: 'Sajid Mahmood',
      fromEmail: 'sajid@smilegenius.co.uk',
      to: emailTo.trim(),
      subject: emailSubject.trim(),
      body: emailBody.trim(),
      sentAt: fmtMailTs(),
    };
    const next = [...disputeEmails, sent];
    persistDispute(next);
    toast.success(`Email sent to ${invoice.supplier}`);
    // Simulate supplier auto-reply
    setTimeout(() => {
      const reply: DisputeEmail = {
        id: `e-${Date.now()}`,
        direction: 'inbound',
        from: invoice.supplier,
        fromEmail: emailTo.trim(),
        to: 'sajid@smilegenius.co.uk',
        subject: emailSubject.trim().startsWith('Re: ') ? emailSubject.trim() : `Re: ${emailSubject.trim()}`,
        body: `Hi Sajid,\n\nThanks for flagging this — we'll review invoice ${invoice.number} and get back to you within one business day.\n\nIf the discrepancy is on our side we'll issue a corrected copy by close of business tomorrow.\n\nKind regards,\nAccounts team\n${invoice.supplier}`,
        sentAt: fmtMailTs(),
      };
      persistDispute([...next, reply]);
    }, 2500);
  };

  const handleSendReply = () => {
    if (!replyBody.trim() || disputeEmails.length === 0) return;
    const last = disputeEmails[disputeEmails.length - 1];
    const reply: DisputeEmail = {
      id: `e-${Date.now()}`,
      direction: 'outbound',
      from: 'Sajid Mahmood',
      fromEmail: 'sajid@smilegenius.co.uk',
      to: last.direction === 'inbound' ? last.fromEmail : last.to,
      subject: last.subject.startsWith('Re: ') ? last.subject : `Re: ${last.subject}`,
      body: replyBody.trim(),
      sentAt: fmtMailTs(),
    };
    persistDispute([...disputeEmails, reply]);
    setReplyBody('');
    toast.success('Reply sent');
  };

  const st = STATUS_CONFIG[invoice.status];
  const isArchived  = invoice.status === 'archived';
  const canApprove  = invoice.status === 'awaiting_approval';
  const canReject   = invoice.status === 'awaiting_approval' || invoice.status === 'disputed';
  const canArchive  = invoice.status !== 'archived' && invoice.status !== 'approved';
  // QC-specific gate — when in QC review, instead of Approve we show
  // "Send to Approval" (only enabled once all required fields are filled).
  const isQC = invoice.status === 'qc_review';

  const passCount = invoice.ruleResults.filter(r => r.result === 'pass').length;
  const failCount = invoice.ruleResults.filter(r => r.result === 'fail').length;
  const warnCount = invoice.ruleResults.filter(r => r.result === 'warn').length;
  const attentionItems = invoice.ruleResults.filter(r => r.result === 'fail' || r.result === 'warn');

  // Severity sort: fail > warn > pass > skip
  const severityRank: Record<string, number> = { fail: 0, warn: 1, pass: 2, skip: 3 };

  const ruleGroups = invoice.ruleResults.reduce<Record<string, RuleResult[]>>((acc, r) => {
    if (!acc[r.group]) acc[r.group] = [];
    acc[r.group].push(r);
    return acc;
  }, {});
  // Sort items within each group by severity
  Object.keys(ruleGroups).forEach(g => {
    ruleGroups[g].sort((a, b) => severityRank[a.result] - severityRank[b.result]);
  });
  // Sort groups so groups with fails/warns come first
  const sortedGroupEntries = Object.entries(ruleGroups).sort(([, a], [, b]) => {
    const worst = (arr: RuleResult[]) => Math.min(...arr.map(r => severityRank[r.result]));
    return worst(a) - worst(b);
  });

  const confidenceColor = aiConfidence >= 85 ? '#2E7D32' : aiConfidence >= 60 ? '#F57C00' : '#C62828';

  return (
    <>
    {editOpen && onEdit && (
      <EditInvoicePanel
        invoice={invoice}
        onClose={() => setEditOpen(false)}
        onSave={(patch) => { onEdit(invoice.id, patch); setEditOpen(false); }}
      />
    )}
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Modal panel — full-width on mobile, slides from right on md+ */}
      <div
        className={`relative md:ml-auto flex flex-col bg-white shadow-2xl transition-[width,max-width] duration-200 w-full ${
          // Mobile always full-width; md+ uses the calculated width below.
          maximized ? 'md:w-full md:max-w-full' : showSource ? 'md:w-[78%] md:max-w-[1100px]' : 'md:w-[45%] md:max-w-[640px]'
        }`}
      >

        {/* ── Top bar — compact timeline pill replaces the standalone banner ── */}
        {(() => {
        const pipeline = buildPipelineTimeline(invoice);
        const doneCount = pipeline.filter(s => s.done).length;
        // Prefer the explicitly-marked current/blocked step; fall back to the
        // last "done" step (terminal states like payment_processed/archived).
        const markedIdx = pipeline.findIndex(s => s.state === 'current' || s.state === 'blocked');
        const currentIdx = markedIdx >= 0
          ? markedIdx
          : (() => {
              for (let i = pipeline.length - 1; i >= 0; i--) {
                if (pipeline[i].done) return i;
              }
              return 0;
            })();
        const current = pipeline[currentIdx];
        const isBlocked = current.state === 'blocked';
        return (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 md:px-6 py-3 border-b border-[#E0E0E6] bg-white flex-shrink-0 gap-2 md:gap-3">
          {/* Left cluster — doc type chip in front, then number + status */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-wrap">
            <DocTypeEditor
              value={invoice.docType ?? 'invoice'}
              onChange={v => onPatch?.(invoice.id, { docType: v })}
            />
            <span className="text-sm font-bold text-[#030213] truncate max-w-[180px] md:max-w-none">{invoice.number}</span>
            <StatusChip status={invoice.status} />
          </div>

          {/* Right cluster — timeline pill + show/hide source + maximize + close */}
          <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-auto flex-wrap justify-end">
            {/* Compact timeline pill — shows the CURRENT step (with a pulse), mini
                progress dots, and opens the full timeline on click. Disputed/Rejected
                render with a red theme so the blocking state is unmistakable. */}
            <button
              onClick={() => setTimelineOpen(true)}
              title="Open full approval timeline"
              className={`inline-flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-full border hover:shadow-sm transition-all group ${
                isBlocked
                  ? 'border-[#F9DCDC] bg-gradient-to-r from-[#FFF5F5] via-white to-[#FFF5F5] hover:border-[#C62828]/40'
                  : 'border-[#E8EAF6] bg-gradient-to-r from-[#F5F8FF] via-white to-[#FAF7FF] hover:border-[#4D8EF7]/40'
              }`}
            >
              <span className="relative inline-flex items-center justify-center w-5 h-5 flex-shrink-0">
                <span className={`absolute inline-flex w-5 h-5 rounded-full opacity-40 animate-ping ${
                  isBlocked ? 'bg-[#C62828]' : 'bg-[#4D8EF7]'
                }`} />
                <span className={`relative inline-flex items-center justify-center w-5 h-5 rounded-full ${
                  isBlocked ? 'bg-[#C62828]' : 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF]'
                }`}>
                  {isBlocked
                    ? <AlertTriangle className="w-2.5 h-2.5 text-white" />
                    : <Clock className="w-2.5 h-2.5 text-white" />}
                </span>
              </span>
              <span className="flex flex-col items-start leading-tight">
                <span className={`text-[10px] font-semibold truncate max-w-[140px] ${
                  isBlocked ? 'text-[#C62828]' : 'text-[#030213]'
                }`}>
                  {isBlocked ? `You are here — ${current.label}` : current.label}
                </span>
                {current.approvalChain && current.approvalChain.length > 0
                  ? <span className="text-[9px] text-[#717182] truncate max-w-[140px]">
                      {current.approvalChain.filter(a => a.done).length}/{current.approvalChain.length} approved
                    </span>
                  : <span className="text-[9px] text-[#717182] truncate max-w-[140px]">{current.timestamp ?? '—'}</span>
                }
              </span>
              <span className="hidden sm:inline-flex items-center gap-0.5 ml-1">
                {pipeline.map((s, i) => {
                  const isCurr = i === currentIdx;
                  const blocked = s.state === 'blocked';
                  return (
                    <span
                      key={i}
                      className={`block w-1.5 h-1.5 rounded-full ${
                        isCurr
                          ? (blocked ? 'bg-[#C62828] ring-2 ring-[#C62828]/30' : 'bg-[#4D8EF7] ring-2 ring-[#4D8EF7]/30')
                          : s.done
                            ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF]'
                            : 'bg-[#E0E0E6]'
                      }`}
                    />
                  );
                })}
              </span>
              <span className="ml-1 text-[9px] font-bold text-[#5A5568] tabular-nums">{doneCount}/{pipeline.length}</span>
              <ChevronDown className="w-3 h-3 text-[#A0A0B0] group-hover:text-[#4D8EF7] transition-colors" />
            </button>
            <button
              onClick={() => setShowSource(v => !v)}
              className="hidden md:flex items-center gap-1.5 text-xs font-medium text-[#717182] border border-[#E0E0E6] px-3 py-1.5 rounded-lg hover:bg-[#F8F9FC] transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              {showSource ? 'Hide source' : 'Show source'}
            </button>
            <button
              onClick={() => setMaximized(v => !v)}
              title={maximized ? 'Exit full screen' : 'Open full screen'}
              className="hidden md:flex w-7 h-7 rounded-lg bg-[#F3F3F5] items-center justify-center hover:bg-[#E8E8EC] transition-colors"
            >
              {maximized ? <Minimize2 className="w-3.5 h-3.5 text-[#717182]" /> : <Maximize2 className="w-3.5 h-3.5 text-[#717182]" />}
            </button>
            <button onClick={onClose} className="w-8 h-8 md:w-7 md:h-7 rounded-lg bg-[#F3F3F5] flex items-center justify-center hover:bg-[#E8E8EC] transition-colors">
              <X className="w-4 h-4 md:w-3.5 md:h-3.5 text-[#717182]" />
            </button>
          </div>
        </div>
        );
        })()}

        {/* ── Approval Timeline modal — opens from the compact pill in the header ── */}
        {timelineOpen && (() => {
        const pipeline = buildPipelineTimeline(invoice);
        const blockedStep = pipeline.find(s => s.state === 'blocked');
        const currentStep = pipeline.find(s => s.state === 'current');
        return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setTimelineOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6]">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  blockedStep ? 'bg-[#C62828]' : 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF]'
                }`}>
                  {blockedStep ? <AlertTriangle className="w-3.5 h-3.5 text-white" /> : <Clock className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#030213]">Approval Timeline</h3>
                  <p className="text-[11px] text-[#717182]">{invoice.number} · {invoice.supplier}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {blockedStep && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#FFEBEE] border border-[#F9DCDC] text-[10px] font-bold text-[#C62828] uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C62828] animate-pulse" />
                    {blockedStep.label}
                  </span>
                )}
                {currentStep && !blockedStep && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#EEF4FF] border border-[#C8D8FC] text-[10px] font-bold text-[#1565C0] uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1565C0] animate-pulse" />
                    {currentStep.label}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#F8F9FC] border border-[#E0E0E6] text-[10px] font-semibold text-[#5A5568]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4D8EF7]" />
                  {pipeline.filter(s => s.done).length} of {pipeline.length} complete
                </span>
                <button onClick={() => setTimelineOpen(false)} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-[#F8FAFF] via-white to-[#FAF8FF]">
              <div className="relative rounded-xl border border-[#E8EAF6] bg-white shadow-[0_1px_2px_rgba(77,142,247,0.06)]">
                <div className="relative px-3 py-6">
                  <div
                    className="grid gap-0 w-full"
                    style={{
                      gridTemplateColumns: pipeline.map(() => 'minmax(0, 1fr)').join(' '),
                      gridAutoFlow: 'row',
                    }}
                  >
                    {pipeline.map((step, i) => {
                      const isBlockedStep = step.state === 'blocked';
                      const isCurrentStep = step.state === 'current';
                      const isLive = isBlockedStep || isCurrentStep;
                      const chain = step.approvalChain;
                      const chainDone = chain ? chain.filter(a => a.done).length : 0;
                      const isExpanded = expandedChain === i;
                      return (
                        <div key={`label-${i}`} className="relative text-center px-1.5 pb-3">
                          {isLive && (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider mb-1 ${
                              isBlockedStep
                                ? 'bg-[#FFEBEE] text-[#C62828] border border-[#F9DCDC]'
                                : 'bg-[#EEF4FF] text-[#1565C0] border border-[#C8D8FC]'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${isBlockedStep ? 'bg-[#C62828]' : 'bg-[#1565C0]'} animate-pulse`} />
                              You are here
                            </span>
                          )}
                          <p className={`text-xs font-semibold leading-tight ${
                            isBlockedStep ? 'text-[#C62828]' :
                            isCurrentStep ? 'text-[#1565C0]' :
                            step.done ? 'text-[#030213]' : 'text-[#A0A0B0]'
                          }`}>
                            {step.label}
                          </p>
                          {chain && chain.length > 0 && (
                            <button
                              type="button"
                              data-chain-toggle="true"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedChain(isExpanded ? null : i);
                              }}
                              title={isExpanded ? 'Hide approvers' : 'Show approvers'}
                              className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border transition-colors ${
                                isExpanded
                                  ? 'bg-[#EEF4FF] border-[#4D8EF7] text-[#1565C0] shadow-sm'
                                  : 'bg-[#F8F9FC] border-[#E8EAF6] text-[#5A5568] hover:border-[#4D8EF7] hover:bg-[#EEF4FF] hover:text-[#1565C0]'
                              }`}
                            >
                              <span className="text-[#4D8EF7] font-bold">{chainDone}/{chain.length}</span>
                              approved
                              <ChevronDown className={`w-2.5 h-2.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                          {step.timestamp && (
                            <p className={`text-[10px] mt-1 leading-tight ${step.done || isLive ? 'text-[#717182]' : 'text-[#C8C8D4]'}`}>
                              {step.timestamp}
                            </p>
                          )}
                          {step.sub && (
                            <p className={`text-[10px] mt-0.5 leading-tight italic ${step.done || isLive ? 'text-[#A0A0B0]' : 'text-[#D4CEE1]'}`}>
                              {step.sub}
                            </p>
                          )}
                          {/* ── Multi-approval chain popover — floats over the dot row so column heights stay equal ── */}
                          {chain && chain.length > 0 && isExpanded && (
                            <div
                              data-chain-popover="true"
                              className="absolute z-30 left-1/2 -translate-x-1/2 top-full mt-1 w-48 bg-white rounded-xl shadow-[0_10px_30px_rgba(77,142,247,0.18)] border border-[#E8EAF6] p-2 text-left animate-in fade-in slide-in-from-top-1 duration-150"
                            >
                              {/* Pointer arrow */}
                              <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-[#E8EAF6] rotate-45" />
                              <p className="relative text-[9px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-1.5 px-0.5">
                                Approval chain
                              </p>
                              <div className="relative space-y-1.5">
                                {chain.map((ap, ai) => (
                                  <div key={ai} className={`flex items-start gap-1.5 px-1.5 py-1.5 rounded-lg ${ap.done ? 'bg-[#F0FFF4] border border-[#BBF7D0]' : 'bg-[#FAFAFA] border border-[#E8EAF6]'}`}>
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                      ap.done
                                        ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF]'
                                        : 'bg-white border border-[#D4CEE1]'
                                    }`}>
                                      {ap.done && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                      <span className={`text-[10px] font-semibold truncate leading-tight ${ap.done ? 'text-[#1A5C2A]' : 'text-[#717182]'}`}>
                                        {ap.name}
                                      </span>
                                      <span className="text-[9px] text-[#A0A0B0] leading-tight">{ap.role}</span>
                                      {ap.ts && <span className="text-[9px] text-[#4D8EF7] leading-tight mt-0.5">{ap.ts}</span>}
                                      {!ap.done && (
                                        <span className="text-[9px] text-[#E65100] leading-tight mt-0.5 font-medium">Pending approval</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {pipeline.map((step, i) => {
                      const isLast = i === pipeline.length - 1;
                      const nextDone = !isLast && pipeline[i + 1].done;
                      const isBlockedStep = step.state === 'blocked';
                      const isCurrentStep = step.state === 'current';
                      const showPulse = isCurrentStep || isBlockedStep || (step.done && !nextDone && !isLast && !pipeline.some(s => s.state === 'current' || s.state === 'blocked'));
                      return (
                        <div key={`dot-${i}`} className="relative flex items-center justify-center h-6">
                          {i > 0 && (
                            <div className={`absolute left-0 right-1/2 top-1/2 -translate-y-1/2 h-0.5 ${
                              pipeline[i - 1].done && step.done ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]' :
                              pipeline[i - 1].done && isBlockedStep ? 'bg-gradient-to-r from-[#4D8EF7] to-[#C62828]' :
                              pipeline[i - 1].done && isCurrentStep ? 'bg-gradient-to-r from-[#4D8EF7] to-[#1565C0]' :
                              pipeline[i - 1].done ? 'bg-gradient-to-r from-[#4D8EF7] to-[#E8E8EC]' : 'bg-[#E8E8EC]'
                            }`} />
                          )}
                          {!isLast && (
                            <div className={`absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-0.5 ${
                              step.done && nextDone ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]' :
                              step.done ? 'bg-gradient-to-r from-[#A59DFF] to-[#E8E8EC]' : 'bg-[#E8E8EC]'
                            }`} />
                          )}
                          <div className="relative z-10 flex items-center justify-center">
                            {showPulse && (
                              <span className={`absolute inline-flex w-6 h-6 rounded-full opacity-30 animate-ping ${
                                isBlockedStep ? 'bg-[#C62828]' : 'bg-[#4D8EF7]'
                              }`} />
                            )}
                            <div className={`relative w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                              isBlockedStep
                                ? 'bg-[#C62828] border-[#C62828] shadow-sm shadow-[#C62828]/40'
                                : isCurrentStep
                                  ? 'bg-white border-[#1565C0] ring-2 ring-[#1565C0]/30'
                                  : step.done
                                    ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] border-transparent shadow-sm shadow-[#4D8EF7]/40'
                                    : 'bg-white border-[#D4CEE1]'
                            }`}>
                              {isBlockedStep
                                ? <AlertTriangle className="w-2.5 h-2.5 text-white" />
                                : isCurrentStep
                                  ? <span className="w-1.5 h-1.5 rounded-full bg-[#1565C0]" />
                                  : step.done
                                    ? <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                    : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Activity log inside the modal */}
              {(invoice.activity?.length ?? 0) > 0 && (
                <div className="mt-6">
                  <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-2">Activity</p>
                  <div className="space-y-2">
                    {invoice.activity!.slice().reverse().map(a => (
                      <div key={a.id} className="flex items-start gap-3 bg-white rounded-xl border border-[#F0EFF6] px-4 py-2.5">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          a.type === 'approved' ? 'bg-[#E8F5E9] text-[#2E7D32]' :
                          a.type === 'rejected' ? 'bg-[#FFEBEE] text-[#C62828]' :
                          a.type === 'disputed' ? 'bg-[#FFEBEE] text-[#C62828]' :
                          a.type === 'archived' ? 'bg-[#F5F5F5] text-[#616161]' :
                          'bg-[#EEF4FF] text-[#4D8EF7]'
                        }`}>
                          {a.type === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                           a.type === 'rejected' ? <XCircle className="w-3.5 h-3.5" /> :
                           a.type === 'disputed' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                           a.type === 'archived' ? <Archive className="w-3.5 h-3.5" /> :
                           <MessageSquare className="w-3.5 h-3.5" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#030213]">
                            <span className="font-semibold">{a.actor}</span>{' '}
                            <span className="text-[#717182]">{a.type === 'note' ? 'added a note' : a.type}</span>
                          </p>
                          {a.note && <p className="text-xs text-[#5A5568] mt-0.5 leading-relaxed">{a.note}</p>}
                          <p className="text-[10px] text-[#A0A0B0] mt-0.5">{a.ts}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        );
        })()}

        {/* ── Body — stacks vertically on mobile, side-by-side on md+ ── */}
        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">

          {/* LEFT — source document panel */}
          {showSource && (
            <div className="w-full md:w-[42%] md:flex-shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-[#E0E0E6] bg-[#F8F9FC]">
              {/* Amount header */}
              <div className="px-6 pt-5 pb-4 bg-white border-b border-[#E0E0E6]">
                <p className="text-3xl font-bold text-[#030213]">{fmt(invoice.amount)}</p>
                <p className="text-xs text-[#717182] mt-0.5">incl. {fmt(invoice.vatAmount)} VAT</p>
              </div>

              {/* Source document preview */}
              <div className="flex-1 flex flex-col p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest">Source Document</p>
                  <span className="text-[10px] text-[#A0A0B0]">received {fmtDate(invoice.receivedAt.split('T')[0])}</span>
                </div>
                {/* Dummy invoice document */}
                <div className="flex-1 overflow-y-auto rounded-xl border border-[#E0E0E6] bg-white shadow-sm">
                  {/* Invoice doc header */}
                  <div className="px-5 pt-5 pb-4 border-b border-[#F0EFF6]">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="w-8 h-8 rounded bg-[#030213] flex items-center justify-center mb-2">
                          <span className="text-white text-[10px] font-bold">SG</span>
                        </div>
                        <p className="text-xs font-bold text-[#030213]">{invoice.supplier}</p>
                        <p className="text-[10px] text-[#717182] mt-0.5">123 Dental House, London, EC1A 1BB</p>
                        <p className="text-[10px] text-[#717182]">VAT No: GB 123 456 789</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-[#030213] uppercase tracking-widest">Invoice</p>
                        <p className="text-[10px] text-[#717182] mt-1">{invoice.number}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#F8F9FC] rounded-lg p-2.5">
                        <p className="text-[9px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-1">Bill To</p>
                        <p className="text-[10px] font-semibold text-[#030213]">{invoice.billedToName}</p>
                        <p className="text-[10px] text-[#717182]">{invoice.entity}</p>
                      </div>
                      <div className="bg-[#F8F9FC] rounded-lg p-2.5">
                        <div className="space-y-0.5">
                          {[
                            { label: 'Date',    value: fmtDate(invoice.date) },
                            { label: 'Due',     value: fmtDate(invoice.dueDate) },
                            { label: 'Ref',     value: invoice.number },
                          ].map(r => (
                            <div key={r.label} className="flex justify-between">
                              <span className="text-[9px] text-[#A0A0B0]">{r.label}</span>
                              <span className="text-[9px] font-medium text-[#030213]">{r.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Line items */}
                  <div className="px-5 py-3">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#E0E0E6]">
                          <th className="text-left pb-1.5 text-[9px] font-bold text-[#A0A0B0] uppercase tracking-widest">Description</th>
                          <th className="text-right pb-1.5 text-[9px] font-bold text-[#A0A0B0] uppercase tracking-widest">Qty</th>
                          <th className="text-right pb-1.5 text-[9px] font-bold text-[#A0A0B0] uppercase tracking-widest">Unit</th>
                          <th className="text-right pb-1.5 text-[9px] font-bold text-[#A0A0B0] uppercase tracking-widest">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(invoice.lineItems ?? [{ description: 'Professional Services', qty: 1, unitPrice: invoice.amount, total: invoice.amount }]).map((item, i) => (
                          <tr key={i} className="border-b border-[#F8F8F8]">
                            <td className="py-2 text-[10px] text-[#030213] pr-2">{item.description}</td>
                            <td className="py-2 text-[10px] text-[#717182] text-right">{item.qty}</td>
                            <td className="py-2 text-[10px] text-[#717182] text-right">{fmt(item.unitPrice)}</td>
                            <td className="py-2 text-[10px] font-semibold text-[#030213] text-right">{fmt(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="px-5 pb-5">
                    <div className="ml-auto w-48 space-y-1.5 pt-2 border-t border-[#E0E0E6]">
                      {[
                        { label: 'Subtotal', value: fmt(invoice.amount - invoice.vatAmount) },
                        { label: `VAT (20%)`, value: fmt(invoice.vatAmount), accent: true },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between">
                          <span className="text-[10px] text-[#717182]">{r.label}</span>
                          <span className={`text-[10px] ${r.accent ? 'text-[#3B5BDB]' : 'text-[#030213]'}`}>{r.value}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-1.5 border-t border-[#E0E0E6]">
                        <span className="text-xs font-bold text-[#030213]">Total Due</span>
                        <span className="text-xs font-bold text-[#030213]">{fmt(invoice.amount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 bg-[#F8F9FC] border-t border-[#F0EFF6]">
                    <p className="text-[9px] text-[#A0A0B0] text-center">Please make payment by {fmtDate(invoice.dueDate)} · Thank you for your business</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RIGHT — extracted data panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* ── QC Required Fields banner — sits above everything; click a chip to jump to the field ── */}
              {onPatch && (
                <div className={`border rounded-xl overflow-hidden ${
                  missingFields.length > 0 ? 'border-[#FECACA] bg-gradient-to-br from-[#FFF5F5] via-[#FFF8F8] to-white' : 'border-[#BBF7D0] bg-gradient-to-br from-[#F0FFF4] via-[#F7FFFA] to-white'
                }`}>
                  <div className={`px-4 py-3 border-b flex items-center justify-between ${
                    missingFields.length > 0 ? 'border-[#FECACA]' : 'border-[#BBF7D0]'
                  }`}>
                    <div className="flex items-center gap-2">
                      {missingFields.length > 0
                        ? <AlertTriangle className="w-3.5 h-3.5 text-[#C62828]" />
                        : <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />}
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        missingFields.length > 0 ? 'text-[#C62828]' : 'text-[#15803D]'
                      }`}>
                        {missingFields.length > 0 ? 'Required for Approval' : 'Ready for Approval'}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold ${
                      missingFields.length > 0 ? 'text-[#C62828]' : 'text-[#15803D]'
                    }`}>
                      {missingFields.length > 0
                        ? `${missingFields.length} of ${requiredFields.length} missing`
                        : `${requiredFields.length} / ${requiredFields.length} complete`}
                    </span>
                  </div>
                  {missingFields.length > 0 ? (
                    <div className="px-4 py-3">
                      <p className="text-[11px] text-[#5A5568] mb-2 leading-relaxed">
                        Approval is blocked until every required field is filled. Click a chip below to jump to the row.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {missingFields.map(f => (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => scrollToField(f.key)}
                            className="group inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold bg-white border border-[#FECACA] text-[#C62828] hover:bg-[#FFE4E4] hover:border-[#C62828] transition-colors shadow-sm"
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {f.label}
                            <ArrowRight className="w-2.5 h-2.5 -translate-x-0.5 group-hover:translate-x-0 transition-transform" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-2.5">
                      <p className="text-[11px] text-[#15803D] leading-relaxed">
                        All required details are present. This invoice is eligible for approval.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* AI Confidence */}
              {aiConfidence > 0 && (
                <div className="border border-[#E0E0E6] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-[#717182]" />
                      <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest">AI Confidence</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: confidenceColor }}>{aiConfidence}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#E8E8EC] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${aiConfidence}%`, background: confidenceColor }} />
                  </div>
                </div>
              )}

              {/* Needs Attention — fail/warn rule items + free-text issues */}
              {(attentionItems.length > 0 || invoice.issues.length > 0) && (
                <div className="border border-[#FECACA] rounded-xl overflow-hidden bg-[#FFF8F8]">
                  <div className="px-4 py-3 border-b border-[#FECACA] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#C62828]" />
                      <span className="text-[10px] font-bold text-[#C62828] uppercase tracking-widest">Needs Attention</span>
                    </div>
                    <span className="text-[10px] font-bold text-[#C62828]">
                      {attentionItems.length + invoice.issues.length} {attentionItems.length + invoice.issues.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div className="divide-y divide-[#FCE8E8]">
                    {/* Free-text issues first (parser flags, anomalies) */}
                    {invoice.issues.map((msg, idx) => (
                      <div key={`issue-${idx}`} className="flex items-start gap-3 px-4 py-3">
                        <div className="mt-0.5 flex-shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#C62828]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-[#030213]">Possible issue detected</p>
                            <span className="text-[10px] font-bold flex-shrink-0 text-[#C62828]">Flag</span>
                          </div>
                          <p className="text-[11px] text-[#5A5568] mt-1 leading-relaxed">{msg}</p>
                        </div>
                      </div>
                    ))}
                    {attentionItems.map(rule => {
                      const rc = RESULT_CONFIG[rule.result];
                      return (
                        <div key={rule.id} className="flex items-start gap-3 px-4 py-3">
                          <div className="mt-0.5 flex-shrink-0">{rc.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-[#030213]">{rule.title}</p>
                              <span className={`text-[10px] font-bold flex-shrink-0 ${rc.labelClass}`}>{rc.label}</span>
                            </div>
                            <p className="text-[11px] text-[#5A5568] mt-1 leading-relaxed">{rule.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rule Checks */}
              {invoice.ruleResults.length > 0 && (
                <div className="border border-[#E0E0E6] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setRulesOpen(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-[#F8F9FC] hover:bg-[#F3F3F5] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#717182]" />
                      <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest">Rule Checks</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {passCount > 0 && <span className="text-[10px] font-bold text-[#2E7D32]">{passCount} pass</span>}
                      {warnCount > 0 && <span className="text-[10px] font-bold text-[#E65100]">{warnCount} warn</span>}
                      {failCount > 0 && <span className="text-[10px] font-bold text-[#C62828]">{failCount} fail</span>}
                      {rulesOpen ? <ChevronUp className="w-3.5 h-3.5 text-[#A0A0B0]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#A0A0B0]" />}
                    </div>
                  </button>

                  {rulesOpen && (
                    <div className="divide-y divide-[#F0EFF6]">
                      {sortedGroupEntries.map(([group, rules]) => (
                        <div key={group}>
                          <p className="px-4 py-1.5 text-[9px] font-bold text-[#A0A0B0] uppercase tracking-widest bg-[#FAFAFA]">{group}</p>
                          {rules.map(rule => {
                            const rc = RESULT_CONFIG[rule.result];
                            return (
                              <div key={rule.id} className={`flex items-start gap-3 px-4 py-3 ${rc.rowBg}`}>
                                <div className="mt-0.5 flex-shrink-0">{rc.icon}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-semibold text-[#030213]">{rule.title}</p>
                                      {rule.type === 'stop' && (
                                        <span className="text-[9px] font-bold text-[#717182] bg-[#F3F3F5] px-1.5 py-0.5 rounded mr-1">Stop</span>
                                      )}
                                      {rule.type === 'score' && (
                                        <span className="text-[9px] font-bold text-[#3B5BDB] bg-[#EEF2FF] px-1.5 py-0.5 rounded mr-1">Score</span>
                                      )}
                                    </div>
                                    <span className={`text-[10px] font-bold flex-shrink-0 ${rc.labelClass}`}>{rc.label}</span>
                                  </div>
                                  <p className="text-[11px] text-[#717182] mt-1 leading-relaxed">{rule.detail}</p>
                                  {rule.type === 'stop' && rule.result === 'fail' && (
                                    <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-bold bg-[#FFEBEE] text-[#C62828] px-1.5 py-0.5 rounded">
                                      <Ban className="w-2.5 h-2.5" /> STOP RULE
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Line Items — card-per-line layout (the only mode now,
                  for both collapsed and maximized overlay views). */}
              {invoice.lineItems && invoice.lineItems.length > 0 && (
                <EditableLineItems
                  items={invoice.lineItems}
                  editable={!!onPatch}
                  onOpenCase={onOpenCase}
                  onChange={(next) => {
                    const subtotal = next.reduce((s, li) => s + li.total, 0);
                    const amount = +(subtotal + invoice.vatAmount).toFixed(2);
                    onPatch?.(invoice.id, { lineItems: next, amount });
                  }}
                />
              )}

              {/* Details — inline editable. Focus a field, edit, then click out to save. */}
              <div className="border border-[#E0E0E6] rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#F8F9FC] border-b border-[#E0E0E6] flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest">Details</span>
                  {onPatch && (
                    <span className="text-[9px] text-[#A0A0B0] italic">Click any field to edit</span>
                  )}
                </div>
                <div className="divide-y divide-[#F8F8F8]">
                  {/* Wrap each required row with a ref + missing/flash highlight.
                      `isMissingField` tints the row when empty; `flashedField` adds a brief
                      pulsing red ring when the user clicks the row's chip in the QC banner. */}
                  <div
                    ref={el => { fieldRefs.current.supplier = el; }}
                    className={`transition-all rounded-lg ${isMissingField('supplier') ? 'bg-[#FFF8F8] ring-1 ring-inset ring-[#FECACA]' : ''} ${flashedField === 'supplier' ? 'ring-2 ring-[#C62828] animate-pulse' : ''}`}
                  >
                    <InlineSupplierRow value={invoice.supplier} onSave={v => onPatch?.(invoice.id, { supplier: v })} editable={!!onPatch} />
                  </div>
                  <div
                    ref={el => { fieldRefs.current.billedTo = el; }}
                    className={`transition-all rounded-lg ${isMissingField('billedTo') ? 'bg-[#FFF8F8] ring-1 ring-inset ring-[#FECACA]' : ''} ${flashedField === 'billedTo' ? 'ring-2 ring-[#C62828] animate-pulse' : ''}`}
                  >
                    {/* Billed-to drives Entity. When the user picks a destination,
                        we also stamp the matching entity label so the two stay in
                        sync — Entity itself becomes read-only below. */}
                    <BilledToPickerRow
                      billedTo={invoice.billedTo}
                      billedToName={invoice.billedToName}
                      onSave={(bt, name) => {
                        const entityLabel = bt === 'clinic' ? 'Clinic' : bt === 'dentist' ? 'Dentist' : 'Group HQ';
                        onPatch?.(invoice.id, { billedTo: bt, billedToName: name, entity: entityLabel });
                      }}
                      editable={!!onPatch}
                    />
                  </div>
                  {/* Entity — derived from Billed to (read-only). Picking a
                      clinic / dentist / group above auto-sets this. The row stays
                      visible for clarity but cannot be edited independently. */}
                  <div
                    ref={el => { fieldRefs.current.entity = el; }}
                    className="transition-all rounded-lg"
                  >
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#717182]">Entity</span>
                        <span className="text-[9px] text-[#C9C9D5] lowercase">auto from billed to</span>
                      </div>
                      <span className="text-xs text-[#030213]">
                        {invoice.entity || <span className="text-[#A0A0B0]">—</span>}
                      </span>
                    </div>
                  </div>
                  <div
                    ref={el => { fieldRefs.current.categories = el; }}
                    className={`transition-all rounded-lg ${isMissingField('categories') ? 'bg-[#FFF8F8] ring-1 ring-inset ring-[#FECACA]' : ''} ${flashedField === 'categories' ? 'ring-2 ring-[#C62828] animate-pulse' : ''}`}
                  >
                    <CategoryPickerRow
                      value={invoice.categories}
                      defaultCode={invoice.defaultNominalCode}
                      onSave={cats => onPatch?.(invoice.id, { categories: cats })}
                      onChangeDefault={code => onPatch?.(invoice.id, { defaultNominalCode: code })}
                      editable={!!onPatch}
                    />
                  </div>
                  <div
                    ref={el => { fieldRefs.current.number = el; }}
                    className={`transition-all rounded-lg ${isMissingField('number') ? 'bg-[#FFF8F8] ring-1 ring-inset ring-[#FECACA]' : ''} ${flashedField === 'number' ? 'ring-2 ring-[#C62828] animate-pulse' : ''}`}
                  >
                    <InlineEditableRow label="Invoice #"  value={invoice.number}       onSave={v => onPatch?.(invoice.id, { number: v })}                    editable={!!onPatch} />
                  </div>
                  <div
                    ref={el => { fieldRefs.current.date = el; }}
                    className={`transition-all rounded-lg ${isMissingField('date') ? 'bg-[#FFF8F8] ring-1 ring-inset ring-[#FECACA]' : ''} ${flashedField === 'date' ? 'ring-2 ring-[#C62828] animate-pulse' : ''}`}
                  >
                    <InlineEditableRow label="Date"       value={invoice.date}         display={fmtDate(invoice.date)}    onSave={v => onPatch?.(invoice.id, { date: v })}    editable={!!onPatch} type="date" />
                  </div>
                  <div
                    ref={el => { fieldRefs.current.dueDate = el; }}
                    className={`transition-all rounded-lg ${isMissingField('dueDate') ? 'bg-[#FFF8F8] ring-1 ring-inset ring-[#FECACA]' : ''} ${flashedField === 'dueDate' ? 'ring-2 ring-[#C62828] animate-pulse' : ''}`}
                  >
                    <InlineEditableRow label="Due"        value={invoice.dueDate}      display={fmtDate(invoice.dueDate)} onSave={v => onPatch?.(invoice.id, { dueDate: v })} editable={!!onPatch} type="date" />
                  </div>
                  {/* Subtotal — computed (read-only) */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-[#717182]">Subtotal</span>
                    <span className="text-xs text-right text-[#030213]">{fmt(invoice.amount - invoice.vatAmount)}</span>
                  </div>
                  <InlineEditableRow
                    label="VAT"
                    value={String(invoice.vatAmount)}
                    display={fmt(invoice.vatAmount)}
                    onSave={v => {
                      const n = Number(v) || 0;
                      onPatch?.(invoice.id, { vatAmount: n });
                    }}
                    editable={!!onPatch}
                    type="number"
                    accent
                  />
                  {/* Total — computed (read-only) */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-[#717182]">Total</span>
                    <span className="text-xs text-right font-bold text-[#030213]">{fmt(invoice.amount)}</span>
                  </div>
                </div>
              </div>

              {/* Activity */}
              {/* Note: action bar lives outside the scroll area (sticky footer) — see below */}
              <div className="border border-[#E0E0E6] rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#F8F9FC] border-b border-[#E0E0E6] flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest">Activity</span>
                  <span className="text-[10px] font-semibold text-[#717182]">
                    {(invoice.activity?.length ?? 0)} {(invoice.activity?.length ?? 0) === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                {(invoice.activity?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <div className="w-8 h-8 rounded-lg bg-[#F3F3F5] flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-[#A0A0B0]" />
                    </div>
                    <p className="text-xs font-medium text-[#030213]">No activity yet</p>
                    <p className="text-[10px] text-[#A0A0B0]">Edits, approvals, and system actions will appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#F0EFF6]">
                    {invoice.activity!.slice().reverse().map(a => {
                      const tone = a.type === 'approved' ? { bg: 'bg-[#E8F5E9]', fg: 'text-[#2E7D32]', label: 'approved' }
                                : a.type === 'rejected' ? { bg: 'bg-[#FFEBEE]', fg: 'text-[#C62828]', label: 'rejected' }
                                : a.type === 'disputed' ? { bg: 'bg-[#FFEBEE]', fg: 'text-[#C62828]', label: 'disputed' }
                                : a.type === 'archived' ? { bg: 'bg-[#F5F5F5]', fg: 'text-[#616161]', label: 'archived' }
                                : a.type === 'edited'   ? { bg: 'bg-[#EEF4FF]', fg: 'text-[#4D8EF7]', label: 'edited' }
                                : a.type === 'reopened'  ? { bg: 'bg-[#EEF4FF]', fg: 'text-[#4D8EF7]', label: 'reopened' }
                                : a.type === 'submitted' ? { bg: 'bg-[#F3F4F6]', fg: 'text-[#374151]', label: 'received' }
                                                        : { bg: 'bg-[#EEF4FF]', fg: 'text-[#4D8EF7]', label: 'added a note' };
                      const Icon = a.type === 'approved' ? CheckCircle2
                                : a.type === 'rejected' || a.type === 'disputed' ? AlertTriangle
                                : a.type === 'archived' ? Archive
                                : a.type === 'edited'   ? Pencil
                                : a.type === 'submitted' ? FileText
                                                         : MessageSquare;
                      return (
                        <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                          <span className={`w-6 h-6 rounded-full ${tone.bg} ${tone.fg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#030213]">
                              <span className="font-semibold">{a.actor}</span>{' '}
                              <span className="text-[#717182]">{tone.label}</span>
                            </p>
                            {a.note && (
                              <p className="text-xs text-[#5A5568] mt-0.5 leading-snug whitespace-pre-wrap">{a.note}</p>
                            )}
                            {/* Field-level diff — only shown on 'edited' entries */}
                            {a.changes && a.changes.length > 0 && (
                              <div className="mt-1.5 rounded-lg border border-[#D8E6FF] bg-[#F5F9FF] overflow-hidden">
                                <div className="px-2.5 py-1 border-b border-[#E8EEFF] flex items-center gap-1.5">
                                  <Pencil className="w-2.5 h-2.5 text-[#4D8EF7]" />
                                  <span className="text-[9px] font-bold text-[#4D8EF7] uppercase tracking-wider">Changes</span>
                                </div>
                                {a.changes.map((c, ci) => (
                                  <div key={ci} className={`flex items-center gap-2 px-2.5 py-1.5 ${ci > 0 ? 'border-t border-[#EEF4FF]' : ''}`}>
                                    <span className="text-[10px] text-[#717182] font-medium min-w-0 w-28 flex-shrink-0 truncate" title={c.field}>{c.field}</span>
                                    <span className="text-[10px] text-[#C62828] bg-[#FFF0F0] px-1 py-0.5 rounded line-through flex-shrink-0 max-w-[90px] truncate" title={c.from}>{c.from}</span>
                                    <span className="text-[9px] text-[#A0A0B0] flex-shrink-0">→</span>
                                    <span className="text-[10px] text-[#2E7D32] bg-[#F0FFF4] px-1 py-0.5 rounded font-semibold flex-shrink-0 max-w-[90px] truncate" title={c.to}>{c.to}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-[10px] text-[#A0A0B0] mt-1">{a.ts}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>

        {/* ── Sticky Action Footer — full-width, anchored to bottom of the modal ── */}
        <div className="border-t border-[#E0E0E6] bg-white flex-shrink-0 px-6 py-4">
          {isArchived ? (
            /* Archived state — only the Unarchive action is offered. All other
               actions are suppressed because the invoice is filed away. */
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#F5F5F5] flex items-center justify-center flex-shrink-0">
                  <Archive className="w-4 h-4 text-[#616161]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#030213]">This invoice is archived</p>
                  <p className="text-[11px] text-[#717182] leading-snug">
                    Unarchive to move it back into the active queue.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (onUnarchive) {
                    onUnarchive(invoice.id);
                  } else {
                    onPatch?.(invoice.id, { status: 'approved' });
                    toast.success(`${invoice.number} unarchived`);
                  }
                  onClose();
                }}
                className="inline-flex items-center justify-center gap-2 text-white text-sm font-semibold px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="w-4 h-4" />
                Unarchive
              </button>
            </div>
          ) : (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleRerun}
                disabled={rerunning}
                className="flex items-center gap-1.5 text-xs font-medium text-[#717182] border border-[#E0E0E6] px-3 py-2 rounded-lg hover:bg-[#F8F9FC] transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                {rerunning
                  ? <div className="w-3.5 h-3.5 rounded-full border-2 border-[#E0E0E6] border-t-[#4D8EF7] animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                {rerunning ? 'Running…' : 'Re-run intelligence'}
              </button>
              {canArchive && (
                <button onClick={() => onArchive(invoice.id)} className="flex items-center gap-1.5 text-xs font-medium text-[#717182] border border-[#E0E0E6] px-3 py-2 rounded-lg hover:bg-[#F8F9FC] transition-colors">
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
              )}
              <button
                onClick={() => setDisputeOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-[#717182] border border-[#E0E0E6] px-3 py-2 rounded-lg hover:bg-[#F8F9FC] transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Dispute with supplier
                {disputeEmails.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#4D8EF7] text-white text-[9px] font-bold">{disputeEmails.length}</span>
                )}
              </button>
            </div>
            {/* ── QC-specific action bar ──
                When an invoice is in QC review, Approve is replaced by
                "Send to Approval" — the QC reviewer's job is to verify the
                extracted data and then forward to the approval pipeline. */}
            {isQC && (
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setRejectConfirm(true)}
                  className="flex items-center justify-center gap-2 border border-[#F9DCDC] text-[#C62828] text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#FFF8F8] transition-colors"
                >
                  <XCircle className="w-4 h-4" /> Flag rejection
                </button>
                <button
                  onClick={() => {
                    if (missingFields.length > 0) {
                      toast.error(`Fill ${missingFields.length} required field${missingFields.length === 1 ? '' : 's'} before sending to approval`);
                      scrollToField(missingFields[0].key);
                      return;
                    }
                    // Demo: move from QC review → awaiting approval, then close the drawer
                    onPatch?.(invoice.id, { status: 'awaiting_approval' });
                    toast.success(`${invoice.number} — status changed to Awaiting Approval`);
                    onClose();
                  }}
                  disabled={missingFields.length > 0}
                  title={missingFields.length > 0 ? `${missingFields.length} required field${missingFields.length === 1 ? '' : 's'} missing` : 'Send this invoice to the Approval queue'}
                  className={`flex items-center justify-center gap-2 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-opacity ${
                    missingFields.length > 0
                      ? 'bg-[#A0A0B0] cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Move to Ready for Approval
                  {missingFields.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-white text-[#C62828]">
                      {missingFields.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {!isQC && (canApprove || canReject) && (
              <div className="flex items-center gap-2 ml-auto">
                {canReject && (
                  <button
                    onClick={() => setRejectConfirm(true)}
                    className="flex items-center justify-center gap-2 border border-[#F9DCDC] text-[#C62828] text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#FFF8F8] transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                )}
                {canApprove && (
                  <button
                    onClick={() => {
                      if (missingFields.length > 0) {
                        // Scroll to the first missing field + flash it so the user knows what's required.
                        toast.error(`Fill ${missingFields.length} required field${missingFields.length === 1 ? '' : 's'} before approving`);
                        scrollToField(missingFields[0].key);
                        return;
                      }
                      setApproveConfirm(true);
                    }}
                    disabled={missingFields.length > 0}
                    title={missingFields.length > 0 ? `${missingFields.length} required field${missingFields.length === 1 ? '' : 's'} missing` : 'Approve invoice'}
                    className={`flex items-center justify-center gap-2 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-opacity ${
                      missingFields.length > 0
                        ? 'bg-[#A0A0B0] cursor-not-allowed opacity-60'
                        : 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" /> Approve
                    {missingFields.length > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-white text-[#C62828]">
                        {missingFields.length}
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Approve confirmation — captures an optional reason / note which is appended to Activity */}
      {approveConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setApproveConfirm(false); setApproveNote(''); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-5 h-5 text-[#2E7D32]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-[#030213]">Approve invoice?</h3>
                <p className="text-sm text-[#717182] mt-1">
                  Approve <span className="font-medium text-[#030213]">{invoice.number}</span> for {fmt(invoice.amount)}. This moves the invoice forward in the approval pipeline.
                </p>
              </div>
            </div>
            <label className="block text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-1.5">
              Reason / note <span className="font-medium text-[#A0A0B0] normal-case tracking-normal">(optional, logged in Activity)</span>
            </label>
            <textarea
              value={approveNote}
              onChange={e => setApproveNote(e.target.value)}
              placeholder="e.g. matched against PO #4421, amount checked against contract."
              rows={3}
              className="w-full text-sm text-[#030213] bg-white rounded-lg px-3 py-2 border border-[#E0E0E6] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7] resize-none"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setApproveConfirm(false); setApproveNote(''); }}
                className="px-4 py-2 text-sm font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const note = approveNote.trim();
                  setApproveConfirm(false);
                  setApproveNote('');
                  onApprove(invoice.id, note || undefined);
                }}
                className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject confirmation (with note) */}
      {rejectConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRejectConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FFF1F2] flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-[#C62828]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-[#030213]">Reject invoice?</h3>
                <p className="text-sm text-[#717182] mt-1">
                  Reject <span className="font-medium text-[#030213]">{invoice.number}</span>. Add a note so the supplier and approvers know why.
                </p>
              </div>
            </div>
            <label className="block text-xs font-semibold text-[#5A5568] mb-1.5">
              Reason for rejection <span className="text-[#D4183D]">*</span>
            </label>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              autoFocus
              rows={3}
              placeholder="e.g. Amount doesn't match the PO total..."
              className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7] resize-none"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setRejectConfirm(false); setRejectNote(''); }}
                className="px-4 py-2 text-sm font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rejectNote.trim()) return;
                  const note = rejectNote.trim();
                  setRejectConfirm(false);
                  setRejectNote('');
                  onReject(invoice.id, note);
                }}
                disabled={!rejectNote.trim()}
                className="px-4 py-2 text-sm font-semibold bg-[#C62828] text-white rounded-lg hover:bg-[#A11F1F] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reject Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute with supplier — side drawer with email-based workflow */}
      {disputeOpen && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setDisputeOpen(false)} />
          <div className="relative md:ml-auto flex flex-col bg-white shadow-2xl w-full md:w-[55%] md:max-w-[680px] h-full animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6] flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-[#4D8EF7]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-[#030213] truncate">Dispute with supplier</h3>
                  <p className="text-[11px] text-[#717182] truncate">{invoice.number} · {invoice.supplier}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {mailboxConnected && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] font-semibold text-[#2E7D32]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32]" />
                    {mailboxProvider === 'gmail' ? 'Gmail' : mailboxProvider === 'outlook' ? 'Outlook' : 'Microsoft 365'}
                  </span>
                )}
                <button onClick={() => setDisputeOpen(false)} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto bg-[#FAFBFC]">
              {!mailboxConnected ? (
                /* Connect-mailbox prompt */
                <div className="flex flex-col items-center text-center px-8 py-12">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center mb-4">
                    <Mail className="w-7 h-7 text-white" />
                  </div>
                  <h4 className="text-base font-semibold text-[#030213] mb-1">Connect your mailbox</h4>
                  <p className="text-sm text-[#717182] max-w-md leading-relaxed mb-6">
                    Disputes are sent as real emails from your own address. Once connected, every reply lands back in this thread so you don't have to switch to your inbox.
                  </p>
                  <div className="grid grid-cols-3 gap-3 w-full max-w-md">
                    {([
                      { id: 'gmail',   label: 'Gmail',          color: 'text-[#EA4335]', sub: 'OAuth via Google'   },
                      { id: 'outlook', label: 'Outlook',        color: 'text-[#0078D4]', sub: 'OAuth via Microsoft'},
                      { id: 'm365',    label: 'Microsoft 365',  color: 'text-[#185ABD]', sub: 'OAuth via Microsoft'},
                    ] as const).map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleConnectMailbox(p.id)}
                        className="flex flex-col items-center gap-1.5 p-4 bg-white border border-[#E0E0E6] rounded-xl hover:border-[#4D8EF7] hover:shadow-sm transition-all"
                      >
                        <Mail className={`w-5 h-5 ${p.color}`} />
                        <span className="text-xs font-semibold text-[#030213]">{p.label}</span>
                        <span className="text-[10px] text-[#A0A0B0]">{p.sub}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#A0A0B0] mt-6 max-w-md">
                    We request read + send permission on the connected mailbox and only show messages associated with this invoice thread.
                  </p>
                </div>
              ) : disputeEmails.length === 0 ? (
                /* First-message composer — pre-filled template */
                <div className="px-6 py-5">
                  <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-[#F0EFF6] bg-[#F8F9FC] flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#717182]" />
                      <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest">New email — dispute template</span>
                    </div>
                    <div className="divide-y divide-[#F0EFF6]">
                      <div className="flex items-center gap-3 px-4 py-2">
                        <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider w-16 flex-shrink-0">From</span>
                        <span className="text-xs text-[#030213]">sajid@smilegenius.co.uk</span>
                      </div>
                      <div className="flex items-center gap-3 px-4 py-2">
                        <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider w-16 flex-shrink-0">To</span>
                        <input
                          value={emailTo}
                          onChange={e => setEmailTo(e.target.value)}
                          className="flex-1 text-xs text-[#030213] bg-transparent border-0 outline-none focus:ring-0"
                          placeholder="accounts@supplier.com"
                        />
                      </div>
                      <div className="flex items-center gap-3 px-4 py-2">
                        <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider w-16 flex-shrink-0">Subject</span>
                        <input
                          value={emailSubject}
                          onChange={e => setEmailSubject(e.target.value)}
                          className="flex-1 text-xs font-semibold text-[#030213] bg-transparent border-0 outline-none focus:ring-0"
                        />
                      </div>
                      {/* Quick-reason chips — tap to insert a bullet under "Reason for dispute:" */}
                      <div className="px-4 py-2.5 bg-[#FAFBFF]">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Zap className="w-3 h-3 text-[#4D8EF7]" />
                          <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">Quick reasons — tap to insert</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {DISPUTE_QUICK_REASONS.map(r => {
                            const inserted = emailBody.includes(r.text);
                            return (
                              <button
                                key={r.label}
                                type="button"
                                onClick={() => {
                                  setEmailBody(prev => {
                                    // Toggle off — remove the bullet line and clean up any blank gap left behind
                                    if (prev.includes(r.text)) {
                                      const bulletLine = `  • ${r.text}`;
                                      return prev
                                        .split('\n')
                                        .filter(l => l !== bulletLine && !l.includes(r.text))
                                        .join('\n')
                                        // Collapse any 3+ consecutive newlines down to 2 so spacing stays tidy
                                        .replace(/\n{3,}/g, '\n\n');
                                    }
                                    // Toggle on — splice the bullet under the "Reason for dispute:" marker
                                    const marker = 'Reason for dispute:';
                                    if (prev.includes(marker)) {
                                      const lines = prev.split('\n');
                                      const markerIdx = lines.findIndex(l => l.includes(marker));
                                      let lastBullet = markerIdx;
                                      for (let j = markerIdx + 1; j < lines.length; j++) {
                                        const t = lines[j].trim();
                                        if (t.startsWith('•') || t.startsWith('-')) lastBullet = j;
                                        else if (t === '') continue;
                                        else break;
                                      }
                                      lines.splice(lastBullet + 1, 0, `  • ${r.text}`);
                                      return lines.join('\n');
                                    }
                                    return prev + (prev.endsWith('\n') ? '' : '\n') + `  • ${r.text}\n`;
                                  });
                                }}
                                title={inserted ? `Click to remove — ${r.text}` : `Click to insert — ${r.text}`}
                                className={`group inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
                                  inserted
                                    ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#2E7D32] hover:bg-[#FEF2F2] hover:border-[#F9DCDC] hover:text-[#C62828]'
                                    : 'bg-white border-[#E0E0E6] text-[#5A5568] hover:border-[#4D8EF7] hover:bg-[#EEF4FF] hover:text-[#1565C0]'
                                }`}
                              >
                                {inserted ? (
                                  <>
                                    <Check className="w-2.5 h-2.5 group-hover:hidden" strokeWidth={3} />
                                    <X className="w-2.5 h-2.5 hidden group-hover:block" strokeWidth={3} />
                                  </>
                                ) : (
                                  <Plus className="w-2.5 h-2.5" />
                                )}
                                {r.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <textarea
                          value={emailBody}
                          onChange={e => setEmailBody(e.target.value)}
                          rows={10}
                          className="w-full text-xs leading-relaxed text-[#030213] bg-transparent border-0 outline-none focus:ring-0 resize-y font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Email thread */
                <div className="px-6 py-5 space-y-3">
                  <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
                    <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-1">Subject</p>
                    <p className="text-sm font-semibold text-[#030213]">{disputeEmails[0].subject}</p>
                  </div>
                  {disputeEmails.map(email => {
                    const outbound = email.direction === 'outbound';
                    return (
                      <div
                        key={email.id}
                        className={`bg-white border rounded-xl overflow-hidden ${outbound ? 'border-[#DBEAFE]' : 'border-[#E0E0E6]'}`}
                      >
                        <div className={`px-4 py-2.5 border-b border-[#F0EFF6] ${outbound ? 'bg-[#F5F8FF]' : 'bg-[#F8F9FC]'} flex items-center justify-between gap-2`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${outbound ? 'bg-[#4D8EF7] text-white' : 'bg-[#E65100] text-white'}`}>
                              {email.from.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#030213] truncate">{email.from}</p>
                              <p className="text-[10px] text-[#717182] truncate">{outbound ? 'to' : 'from'} {outbound ? email.to : email.fromEmail}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-[9px] font-semibold uppercase tracking-wider ${outbound ? 'text-[#4D8EF7]' : 'text-[#E65100]'}`}>{outbound ? 'Sent' : 'Received'}</span>
                            <span className="text-[10px] text-[#A0A0B0]">{email.sentAt}</span>
                          </div>
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-xs text-[#030213] whitespace-pre-wrap leading-relaxed font-mono">{email.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer / Composer */}
            {mailboxConnected && (
              <div className="border-t border-[#F0EFF6] px-6 py-3 bg-white">
                {disputeEmails.length === 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] text-[#A0A0B0]">
                      Sent from <span className="font-semibold text-[#5A5568]">sajid@smilegenius.co.uk</span> via {mailboxProvider === 'gmail' ? 'Gmail' : mailboxProvider === 'outlook' ? 'Outlook' : 'Microsoft 365'}
                    </p>
                    <button
                      onClick={handleSendEmail}
                      disabled={!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send email
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest">Reply</p>
                      <span className="text-[10px] text-[#A0A0B0]">Tap a chip to draft a reply</span>
                    </div>
                    {/* Quick-reply chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {REPLY_QUICK_ACTIONS.map(r => (
                        <button
                          key={r.label}
                          type="button"
                          onClick={() => setReplyBody(prev => (prev ? prev + '\n\n' + r.text : r.text))}
                          title={`Insert: ${r.text}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-[#F8F9FC] border border-[#E8EAF6] text-[#5A5568] hover:border-[#4D8EF7] hover:bg-[#EEF4FF] hover:text-[#1565C0] transition-colors"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          {r.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-end gap-2">
                      <textarea
                        value={replyBody}
                        onChange={e => setReplyBody(e.target.value)}
                        placeholder="Type your reply…"
                        rows={3}
                        className="flex-1 px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
                      />
                      <button
                        onClick={handleSendReply}
                        disabled={!replyBody.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Reply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </ModalPortal>
    </>
  );
}

// ─── AI Confidence bar (list + card) ──────────────────────────────────────────
function AiConfidenceBar({ score, width = 80 }: { score: number; width?: number }) {
  if (score === 0) return <span className="text-xs text-[#A0A0B0]">—</span>;
  const color = score >= 85 ? '#16A34A' : score >= 60 ? '#D97706' : '#DC2626';
  return (
    <div className="inline-flex items-center gap-1.5" title={`AI confidence ${score}%`}>
      <Zap className="w-3 h-3 flex-shrink-0" style={{ color }} />
      <div className="rounded-full bg-[#F0EFF6] overflow-hidden flex-shrink-0" style={{ width, height: 6 }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>{score}%</span>
    </div>
  );
}

// ─── Upload Invoice modal ─────────────────────────────────────────────────────
function BulkActionConfirm({ action, count, onCancel, onConfirm }: {
  action: 'approve' | 'archive';
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${action === 'approve' ? 'bg-[#E8F5E9]' : 'bg-[#F3F3F5]'}`}>
            {action === 'approve'
              ? <CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />
              : <Archive className="w-5 h-5 text-[#717182]" />}
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-[#030213]">
              {action === 'approve' ? 'Approve invoices?' : 'Archive invoices?'}
            </h3>
            <p className="text-sm text-[#717182] mt-1">
              {action === 'approve'
                ? `${count} ${count === 1 ? 'invoice' : 'invoices'} will be approved and moved to the Approved queue.`
                : `${count} ${count === 1 ? 'invoice' : 'invoices'} will be moved to Archived. You can restore them later.`}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium border border-[#E0E0E6] text-[#717182] rounded-lg hover:bg-[#F8F9FC] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90 ${action === 'approve' ? 'bg-[#2E7D32]' : 'bg-[#717182]'}`}
          >
            {action === 'approve' ? 'Approve all' : 'Archive all'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

// Max bulk-upload size — surfaced both as a hint on the drop zone and as a
// hard cap on the file picker so users can't sneak more than 5 through.
const MAX_BULK_UPLOAD = 5;

function UploadInvoiceModal({ onClose, onComplete }: {
  onClose: () => void;
  onComplete: (data: { number: string; supplier: string; amount: number; billedToName: string }) => void;
}) {
  // Files holds the batch (1..5); single-invoice flow still works when only one
  // file is dropped. The review panel always shows the first file's extracted
  // values; submit then fans those out into N invoices.
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<'select' | 'parse' | 'review'>('select');
  const [number, setNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState('');
  const [billedTo, setBilledTo] = useState('');
  const file = files[0] ?? null; // alias kept for the parsing-screen filename hint

  const onPick = (picked: File[]) => {
    // Cap at MAX_BULK_UPLOAD; anything extra is silently dropped.
    const trimmed = picked.slice(0, MAX_BULK_UPLOAD);
    if (trimmed.length === 0) return;
    setFiles(trimmed);
    setStep('parse');
    // Simulate AI parsing the whole batch
    setTimeout(() => {
      setNumber(`INV-${Date.now().toString().slice(-6)}`);
      setSupplier('Henry Schein Dental');
      setAmount('482.50');
      setBilledTo('Smile Genius Manchester');
      setStep('review');
    }, 1400);
  };

  const canSubmit = number.trim() && supplier.trim() && amount.trim() && billedTo.trim();

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6]">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#4D8EF7]" />
            <h3 className="text-base font-semibold text-[#030213]">Upload Invoice</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {step === 'select' && (
            <label className="block">
              <div className="border-2 border-dashed border-[#D4CEE1] rounded-xl px-6 py-10 text-center hover:border-[#4D8EF7] hover:bg-[#F8F9FC] transition-colors cursor-pointer">
                <div className="w-12 h-12 rounded-2xl bg-[#EEF4FF] flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6 text-[#4D8EF7]" />
                </div>
                <p className="text-sm font-semibold text-[#030213]">Drop invoices here or click to browse</p>
                <p className="text-xs text-[#717182] mt-1">PDF, PNG, JPG · Up to {MAX_BULK_UPLOAD} files at a time · 10 MB each</p>
              </div>
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg"
                multiple
                className="hidden"
                onChange={e => {
                  const fl = e.target.files;
                  if (!fl || fl.length === 0) return;
                  onPick(Array.from(fl));
                }}
              />
            </label>
          )}

          {step === 'parse' && (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-12 h-12 rounded-full border-4 border-[#EEF4FF] border-t-[#4D8EF7] animate-spin mb-4" />
              <p className="text-sm font-semibold text-[#030213]">
                AI is parsing {files.length > 1 ? `${files.length} invoices` : 'your invoice'}…
              </p>
              <p className="text-xs text-[#717182] mt-1">Extracting supplier, amount, line items, VAT.</p>
              {file && (
                <p className="text-[11px] text-[#A0A0B0] mt-2 truncate max-w-full">
                  {files.length > 1 ? `${file.name} + ${files.length - 1} more` : file.name}
                </p>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-[#2E7D32] flex-shrink-0" />
                <p className="text-xs text-[#2E7D32]">AI extracted these fields. Review and submit.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#5A5568] mb-1">Invoice number <span className="text-[#D4183D]">*</span></label>
                  <input value={number} onChange={e => setNumber(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#5A5568] mb-1">Amount (GBP) <span className="text-[#D4183D]">*</span></label>
                  <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.01" className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#5A5568] mb-1">Supplier <span className="text-[#D4183D]">*</span></label>
                <input value={supplier} onChange={e => setSupplier(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#5A5568] mb-1">Bill to <span className="text-[#D4183D]">*</span></label>
                <input value={billedTo} onChange={e => setBilledTo(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#F0EFF6]">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors">
            Cancel
          </button>
          {step === 'review' && (
            <button
              onClick={() => onComplete({ number, supplier, amount: parseFloat(amount), billedToName: billedTo })}
              disabled={!canSubmit}
              className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit invoice
            </button>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function InvoicesPage({ initialFilter, initialInvoiceId, initialSupplier, onOpenCase, onInvoiceSelected, onUpdateSupplier }: { initialFilter?: InvoiceStatus | 'low_confidence' | 'left_over' | 'not_approved' | 'unpaid' | 'overdue'; initialInvoiceId?: string; initialSupplier?: string; onOpenCase?: (caseId: string) => void; onInvoiceSelected?: (id: string | null) => void; onUpdateSupplier?: (supplierId: string, patch: Partial<Supplier>) => void }) {
  const [invoices, setInvoices] = useState<Invoice[]>(INVOICES);
  const isLowConfFilter = initialFilter === 'low_confidence';
  const isLeftOverFilter = initialFilter === 'left_over';
  const isNotApprovedFilter = initialFilter === 'not_approved';
  // Clinic AP filters: unpaid = anything the practice still owes on;
  // overdue = unpaid AND past its due date.
  const isUnpaidFilter = initialFilter === 'unpaid';
  const isOverdueFilter = initialFilter === 'overdue';
  const isPseudoFilter = isLowConfFilter || isLeftOverFilter || isNotApprovedFilter || isUnpaidFilter || isOverdueFilter;
  const [activeTab, setActiveTab] = useState<'all' | InvoiceStatus>(
    isPseudoFilter ? 'all' : (initialFilter ?? 'all')
  );
  const [lowConfOnly, setLowConfOnly] = useState(isLowConfFilter);
  const [leftOverOnly, setLeftOverOnly] = useState(isLeftOverFilter);
  // Not-approved = rejected OR disputed. Drives the analytics "Not Approved" nav.
  const [notApprovedOnly, setNotApprovedOnly] = useState(isNotApprovedFilter);
  const [unpaidOnly, setUnpaidOnly] = useState(isUnpaidFilter);
  const [overdueOnly, setOverdueOnly] = useState(isOverdueFilter);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'supplier-asc' | 'status' | 'confidence-asc'>('date-desc');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | InvoiceSource>('all');
  const [billedTo, setBilledTo] = useState<BilledTo>('all');
  const [billedToEntity, setBilledToEntity] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>(initialSupplier ?? 'all');
  const [selectedId, setSelectedIdRaw] = useState<string | null>(initialInvoiceId ?? null);
  const setSelectedId = (id: string | null) => {
    setSelectedIdRaw(id);
    onInvoiceSelected?.(id);
  };
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<null | 'approve' | 'archive'>(null);
  const [showArchived, setShowArchived] = useState(initialFilter === 'archived');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Sync local selection with URL when parent (or browser back/forward) changes initialInvoiceId
  useEffect(() => {
    if ((initialInvoiceId ?? null) !== selectedId) setSelectedIdRaw(initialInvoiceId ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInvoiceId]);

  const selectedInvoice = invoices.find(inv => inv.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: invoices.length };
    invoices.forEach(inv => { c[inv.status] = (c[inv.status] ?? 0) + 1; });
    return c;
  }, [invoices]);

  const filtered = useMemo(() => {
    // Stable ordering for the status sort (queue order — most-actionable first).
    const STATUS_ORDER: InvoiceStatus[] = [
      'disputed', 'rejected', 'awaiting_approval', 'approved', 'exported_for_payment', 'payment_processed', 'archived',
    ];
    const rows = invoices.filter(inv => {
      if (showArchived) {
        if (inv.status !== 'archived') return false;
      } else {
        if (inv.status === 'archived') return false;
        if (activeTab !== 'all' && inv.status !== activeTab) return false;
      }
      // QC filter — show ONLY invoices explicitly in the QC review queue.
      // (Was previously based on RAG colour, which bled in lots of Awaiting
      // Approval rows. Now QC is a real status so we filter on it directly.)
      if (lowConfOnly && inv.status !== 'qc_review') return false;
      // Left-over = un-approved invoices past the configured extraction date.
      // For demo, the extraction cutoff is the 25th of the current month — any
      // invoice dated before that and still not approved counts as left over.
      if (leftOverOnly) {
        const unapproved = inv.status === 'awaiting_approval' || inv.status === 'disputed' || inv.status === 'rejected';
        const invDate = new Date(inv.date);
        const cutoff = new Date();
        cutoff.setDate(25);
        cutoff.setHours(0, 0, 0, 0);
        if (!unapproved || invDate >= cutoff) return false;
      }
      // Not approved = rejected or disputed.
      if (notApprovedOnly && !(inv.status === 'rejected' || inv.status === 'disputed')) return false;
      // Unpaid = the practice still owes on it (anything not paid/archived/rejected).
      const isUnpaid = !(inv.status === 'payment_processed' || inv.status === 'archived' || inv.status === 'rejected');
      if (unpaidOnly && !isUnpaid) return false;
      // Overdue = unpaid AND past its due date.
      if (overdueOnly && (!isUnpaid || new Date(inv.dueDate) >= new Date())) return false;
      if (sourceFilter !== 'all' && inv.source !== sourceFilter) return false;
      if (billedTo !== 'all' && inv.billedTo !== billedTo) return false;
      if (billedToEntity !== 'all' && inv.billedToName !== billedToEntity) return false;
      if (supplierFilter !== 'all' && inv.supplier !== supplierFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!inv.supplier.toLowerCase().includes(q) && !inv.number.toLowerCase().includes(q) && !inv.billedToName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    // Recency uses receivedAt (when the invoice landed in our inbox), falling back to date.
    const tsOf = (i: Invoice) => new Date(i.receivedAt || i.date).getTime();
    const sorted = [...rows];
    switch (sortBy) {
      case 'date-desc':       sorted.sort((a, b) => tsOf(b) - tsOf(a)); break;
      case 'date-asc':        sorted.sort((a, b) => tsOf(a) - tsOf(b)); break;
      case 'amount-desc':     sorted.sort((a, b) => b.amount - a.amount); break;
      case 'amount-asc':      sorted.sort((a, b) => a.amount - b.amount); break;
      case 'supplier-asc':    sorted.sort((a, b) => a.supplier.localeCompare(b.supplier)); break;
      case 'confidence-asc':  sorted.sort((a, b) => a.aiConfidence - b.aiConfidence); break;
      case 'status':          sorted.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || tsOf(b) - tsOf(a)); break;
    }
    return sorted;
  }, [invoices, activeTab, lowConfOnly, leftOverOnly, notApprovedOnly, unpaidOnly, overdueOnly, sourceFilter, search, billedTo, billedToEntity, supplierFilter, showArchived, sortBy]);

  const supplierOptions = useMemo(() => {
    const names = Array.from(new Set(invoices.map(i => i.supplier))).sort();
    return [{ value: 'all', label: 'All suppliers' }, ...names.map(n => ({ value: n, label: n }))];
  }, [invoices]);

  const billToEntityOptions = useMemo(() => {
    const names = Array.from(new Set(invoices.map(i => i.billedToName))).sort();
    return [{ value: 'all', label: 'All bill-to entities' }, ...names.map(n => ({ value: n, label: n }))];
  }, [invoices]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filtered, currentPage, itemsPerPage]
  );

  const { toast } = useToast();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [paymentDownloadOpen, setPaymentDownloadOpen] = useState(false);

  // Deep link — `?paymentFolder=YYYY-MM` opens the Monthly Payment Exports
  // modal with that folder expanded. This is the URL the Dental Group's
  // email "View export" button points at. We seed the modal's initial folder
  // from the param and auto-open on load.
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentFolderParam = searchParams.get('paymentFolder');
  useEffect(() => {
    if (paymentFolderParam) setPaymentDownloadOpen(true);
  }, [paymentFolderParam]);
  const closePaymentFolder = () => {
    setPaymentDownloadOpen(false);
    // Drop the deep-link param so a later manual open starts clean.
    if (searchParams.has('paymentFolder')) {
      const next = new URLSearchParams(searchParams);
      next.delete('paymentFolder');
      setSearchParams(next, { replace: true });
    }
  };

  function downloadPaymentCsv(from: string, to: string, label: string) {
    const start = new Date(from);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    const inWindow = invoices.filter(inv => {
      const d = new Date(inv.date);
      const paymentRelated = inv.status === 'exported_for_payment' || inv.status === 'payment_processed';
      return paymentRelated && d >= start && d <= end;
    });
    if (inWindow.length === 0) {
      toast.error?.(`No payment data found for ${label}`) ?? toast.success(`No payment data found for ${label}`);
      return;
    }
    const headers = [
      'Invoice #', 'Supplier', 'Date', 'Due Date',
      'Bill To Type', 'Bill To Name', 'Entity',
      'Currency', 'Subtotal', 'VAT', 'Total',
      'Status', 'Approval Rule', 'Categories',
    ];
    const rows = inWindow.map(inv => {
      const billToTypeLabel = inv.billedTo === 'clinic' ? 'Clinic' : inv.billedTo === 'dentist' ? 'Dentist' : 'Group HQ';
      return [
        inv.number,
        inv.supplier,
        inv.date,
        inv.dueDate,
        billToTypeLabel,
        inv.billedToName,
        inv.entity,
        inv.currency,
        (inv.amount - inv.vatAmount).toFixed(2),
        inv.vatAmount.toFixed(2),
        inv.amount.toFixed(2),
        STATUS_CONFIG[inv.status].label,
        inv.approvalRule ?? '',
        inv.categories.join('; '),
      ];
    });
    const escape = (v: any) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    link.href = url;
    link.download = `payment-data-${slug}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${inWindow.length} ${inWindow.length === 1 ? 'invoice' : 'invoices'} for ${label}`);
    setPaymentDownloadOpen(false);
  }

  function handleExportCsv() {
    if (filtered.length === 0) {
      toast.error?.('No invoices to export') ?? toast.success('No invoices to export');
      return;
    }
    const headers = [
      'Invoice #', 'Supplier', 'Categories',
      'Bill To Type', 'Bill To Name', 'Entity',
      'Date', 'Due Date', 'Received At',
      'Currency', 'Subtotal', 'VAT', 'Total',
      'Status', 'Source',
      'AI Confidence', 'RAG Score', 'RAG Color',
      'Assigned To', 'Approval Rule',
      'Issues', 'Line Items',
    ];
    const rows = filtered.map(inv => {
      const subtotal = inv.amount - inv.vatAmount;
      const billToTypeLabel = inv.billedTo === 'clinic' ? 'Clinic' : inv.billedTo === 'dentist' ? 'Dentist' : 'Group HQ';
      const lineItemsText = (inv.lineItems ?? [])
        .map(li => `${li.qty}× ${li.description} @ ${li.unitPrice.toFixed(2)} = ${li.total.toFixed(2)}`)
        .join(' | ');
      return [
        inv.number,
        inv.supplier,
        inv.categories.join('; '),
        billToTypeLabel,
        inv.billedToName,
        inv.entity,
        inv.date,
        inv.dueDate,
        inv.receivedAt,
        inv.currency,
        subtotal.toFixed(2),
        inv.vatAmount.toFixed(2),
        inv.amount.toFixed(2),
        STATUS_CONFIG[inv.status].label,
        SOURCE_LABELS[inv.source],
        inv.aiConfidence,
        inv.ragScore,
        inv.ragColor,
        inv.assignedTo ?? '',
        inv.approvalRule ?? '',
        inv.issues.join('; '),
        lineItemsText,
      ];
    });
    const escape = (v: any) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `invoices-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} ${filtered.length === 1 ? 'invoice' : 'invoices'} to CSV`);
  }

  function handleUploadComplete(data: { number: string; supplier: string; amount: number; billedToName: string }) {
    const today = new Date().toISOString().split('T')[0];
    const due = new Date(); due.setMonth(due.getMonth() + 1);
    const dueIso = due.toISOString().split('T')[0];
    const newInv: Invoice = {
      id: `inv_${Date.now()}`,
      number: data.number,
      supplier: data.supplier,
      categories: ['Clinical'],
      billedTo: 'clinic',
      billedToName: data.billedToName,
      entity: 'Clinic',
      amount: data.amount,
      currency: 'GBP',
      vatAmount: +(data.amount * 0.2).toFixed(2),
      date: today,
      dueDate: dueIso,
      receivedAt: new Date().toISOString(),
      source: 'manual',
      status: 'awaiting_approval',
      ragScore: 75,
      ragColor: 'amber',
      aiConfidence: 82,
      assignedTo: 'Clinic Manager',
      issues: [],
      ruleResults: [],
      timeline: [
        { label: 'Submitted', done: true, timestamp: new Date().toLocaleString('en-GB'), sub: 'uploaded manually' },
        { label: 'AI parsed & matched', done: true, timestamp: new Date().toLocaleString('en-GB'), sub: 'Confidence 82%' },
        { label: 'Awaiting Approval', done: true, sub: 'Assigned to Clinic Manager' },
        { label: 'Approved', done: false },
        { label: 'Posted to Xero', done: false },
      ],
    };
    setInvoices(prev => [newInv, ...prev]);
    setActiveTab('awaiting_approval');
    setShowArchived(false);
    setCurrentPage(1);
    setUploadModalOpen(false);
    toast.success(`Invoice ${data.number} uploaded`);
  }

  // Logged-in user — mock value used as the actor on activity entries.
  const CURRENT_USER = 'Sajid Mahmood';

  function fmtActivityTs() {
    return new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function appendActivity(id: string, entry: Omit<ActivityEntry, 'id' | 'ts'>) {
    setInvoices(prev => prev.map(i => i.id === id
      ? { ...i, activity: [...(i.activity ?? []), { ...entry, id: `a-${Date.now()}`, ts: fmtActivityTs() }] }
      : i
    ));
  }

  function handleApprove(id: string, note?: string) {
    const inv = invoices.find(i => i.id === id);
    setInvoices(prev => prev.map(i => i.id === id
      ? {
          ...i,
          status: 'approved',
          assignedTo: 'Human Approved',
          activity: [
            ...(i.activity ?? []),
            { id: `a-${Date.now()}`, type: 'approved', actor: CURRENT_USER, ts: fmtActivityTs(), note },
          ],
        }
      : i
    ));
    setSelectedId(null);
    setActiveTab('approved');
    setShowArchived(false);
    setCurrentPage(1);
    toast.success(`Invoice ${inv?.number ?? ''} approved${note ? ' with note' : ''}`);
  }
  function handleArchive(id: string) {
    const inv = invoices.find(i => i.id === id);
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'archived' } : i));
    appendActivity(id, { type: 'archived', actor: CURRENT_USER });
    setSelectedId(null);
    toast.success(`Invoice ${inv?.number ?? ''} archived`);
  }
  function handleUnarchive(id: string) {
    const inv = invoices.find(i => i.id === id);
    // Restore to the most useful active state — Approved sits in the main queue
    // without forcing the user back through QC or approval again.
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'approved' } : i));
    appendActivity(id, { type: 'reopened', actor: CURRENT_USER, note: 'Unarchived — moved back into the Approved queue.' });
    setSelectedId(null);
    setShowArchived(false);
    setActiveTab('approved');
    toast.success(`Invoice ${inv?.number ?? ''} unarchived`);
  }
  function handleEditInvoice(id: string, patch: InvoiceEditPatch) {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    toast.success(`Invoice ${patch.number} updated`);
  }
  function handlePatchInvoice(id: string, patch: Partial<Invoice>) {
    // Get the current invoice before update (for supplier sync)
    const currentInv = invoices.find(i => i.id === id);
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    // Use the first changed key as the toast label
    const key = Object.keys(patch)[0] ?? 'Invoice';
    const friendly = key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
    toast.success(`${friendly} updated`);

    // ── Supplier GL sync ──────────────────────────────────────────────────────
    // If categories or defaultNominalCode changed, propagate to the matching supplier
    const hasCatChange = 'categories' in patch;
    const hasCodeChange = 'defaultNominalCode' in patch;
    if (currentInv && (hasCatChange || hasCodeChange) && onUpdateSupplier) {
      const supplier = mockSuppliers.find(s => s.name === currentInv.supplier);
      if (supplier) {
        const newCategories = hasCatChange ? (patch.categories ?? currentInv.categories) : currentInv.categories;
        const newDefaultCode = hasCodeChange ? patch.defaultNominalCode : currentInv.defaultNominalCode;
        // Resolve GL code: prefer the default code lookup, else derive from first category
        const codeEntry = newDefaultCode
          ? CATEGORY_NOMINALS.find(cn => cn.code === newDefaultCode)
          : CATEGORY_NOMINALS.find(cn => newCategories.includes(cn.category));
        const glCodePatch = codeEntry
          ? { code: codeEntry.code, nominalName: codeEntry.nominalName }
          : supplier.glMapping?.glCode ?? { code: '', nominalName: '' };
        const categoryPatch = newCategories[0] ?? supplier.glMapping?.category ?? '';
        const updatedGLMapping = {
          ...(supplier.glMapping ?? { workflow: 'Auto Approve' as const, paymentTerms: 'Net 30' }),
          glCode: glCodePatch,
          category: categoryPatch,
        };
        onUpdateSupplier(supplier.id, { glMapping: updatedGLMapping });
        toast.success(`${supplier.name} GL mapping synced from invoice`);
      }
    }
  }
  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearSelected() { setSelectedIds(new Set()); }
  function applyBulkAction() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ts = fmtActivityTs();
    if (bulkAction === 'approve') {
      setInvoices(prev => prev.map(i => ids.includes(i.id)
        ? {
            ...i,
            status: 'approved' as const,
            assignedTo: 'Human Approved',
            activity: [...(i.activity ?? []), { id: `a-${Date.now()}-${i.id}`, type: 'approved' as const, actor: CURRENT_USER, ts, note: 'Bulk approved' }],
          }
        : i
      ));
      toast.success(`${ids.length} ${ids.length === 1 ? 'invoice' : 'invoices'} approved`);
    } else if (bulkAction === 'archive') {
      setInvoices(prev => prev.map(i => ids.includes(i.id)
        ? {
            ...i,
            status: 'archived' as const,
            activity: [...(i.activity ?? []), { id: `a-${Date.now()}-${i.id}`, type: 'archived' as const, actor: CURRENT_USER, ts, note: 'Bulk archived' }],
          }
        : i
      ));
      toast.success(`${ids.length} ${ids.length === 1 ? 'invoice' : 'invoices'} archived`);
    }
    setBulkAction(null);
    clearSelected();
  }
  function handleReject(id: string, note: string) {
    const inv = invoices.find(i => i.id === id);
    setInvoices(prev => prev.map(i => i.id === id
      ? {
          ...i,
          status: 'rejected',
          issues: [note, ...i.issues],
          activity: [...(i.activity ?? []), { id: `a-${Date.now()}`, type: 'rejected', actor: CURRENT_USER, ts: fmtActivityTs(), note }],
        }
      : i
    ));
    setSelectedId(null);
    toast.success(`Invoice ${inv?.number ?? ''} rejected`);
  }

  const totalValue = invoices.reduce((sum, inv) => sum + inv.amount, 0);

  // QC = invoices that need a human eye: low-confidence parse OR active issues
  // QC needs review = explicit qc_review status only (matches the filter).
  const qcCount = invoices.filter(inv => inv.status === 'qc_review').length;

  const statCards = [
    { id: 'all',                  label: 'Total Invoices',       value: counts.total ?? 0,                icon: <FileText className="w-5 h-5 text-[#4D8EF7]" />,      iconBg: 'bg-[#4D8EF7]/10', accent: '#4D8EF7', gradient: true },
    { id: 'qc',                   label: 'QC · Needs Review',    value: qcCount,                          icon: <AlertTriangle className="w-5 h-5 text-[#D4183D]" />, iconBg: 'bg-[#D4183D]/10', accent: '#D4183D' },
    { id: 'awaiting_approval',    label: 'Awaiting Approval',    value: counts.awaiting_approval ?? 0,    icon: <Clock className="w-5 h-5 text-[#E65100]" />,         iconBg: 'bg-[#E65100]/10', accent: '#E65100' },
    { id: 'approved',             label: 'Approved',             value: counts.approved ?? 0,             icon: <CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />,  iconBg: 'bg-[#2E7D32]/10', accent: '#2E7D32' },
    { id: 'exported_for_payment', label: 'Exported for Payment', value: counts.exported_for_payment ?? 0, icon: <Send className="w-5 h-5 text-[#1565C0]" />,          iconBg: 'bg-[#1565C0]/10', accent: '#1565C0' },
    { id: 'payment_processed',    label: 'Payment Processed',    value: counts.payment_processed ?? 0,    icon: <CheckCheck className="w-5 h-5 text-[#00838F]" />,    iconBg: 'bg-[#00838F]/10', accent: '#00838F' },
  ] as { id: 'all' | InvoiceStatus | 'qc'; label: string; value: number; icon: React.ReactNode; iconBg: string; accent: string; gradient?: boolean }[];

  return (
    <>
      {/* Overlay drawer */}
      {selectedInvoice && (
        <InvoiceOverlay
          invoice={selectedInvoice}
          onClose={() => setSelectedId(null)}
          onApprove={handleApprove}
          onArchive={handleArchive}
          onUnarchive={handleUnarchive}
          onReject={handleReject}
          onEdit={handleEditInvoice}
          onPatch={handlePatchInvoice}
          onOpenCase={onOpenCase ? (caseId) => { setSelectedId(null); onOpenCase(caseId); } : undefined}
        />
      )}

      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] mb-2">Invoices</h1>
            <p className="text-sm sm:text-base text-[#717182]">
              Track every invoice from inbox to accounting — AI parses, scores, and routes to the right queue.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 flex-wrap">
            <Button variant="outline" icon={<FolderOpen className="w-5 h-5" />} className="whitespace-nowrap flex-1 sm:flex-initial justify-center" onClick={() => setPaymentDownloadOpen(true)}>
              <span className="hidden sm:inline">Monthly Payment Exports</span>
              <span className="sm:hidden">Exports</span>
            </Button>
            <Button variant="primary" icon={<Upload className="w-5 h-5" />} className="whitespace-nowrap flex-1 sm:flex-initial justify-center" onClick={() => setUploadModalOpen(true)}>
              <span className="hidden sm:inline">Upload Invoice</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards — pipeline view */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {statCards.map(card => {
            const isActive = card.id === 'qc'
              ? (lowConfOnly && !showArchived)
              : (activeTab === card.id && !showArchived && !lowConfOnly);
            return (
              <button
                key={card.id}
                onClick={() => {
                  if (card.id === 'qc') {
                    setLowConfOnly(true);
                    setActiveTab('all');
                  } else {
                    setLowConfOnly(false);
                    setActiveTab(card.id as 'all' | InvoiceStatus);
                  }
                  setShowArchived(false);
                  setCurrentPage(1);
                }}
                className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md text-left ${
                  isActive && !card.gradient ? 'ring-2' : ''
                } ${!isActive ? 'border-[#E0E0E6]' : card.gradient ? 'border-transparent' : ''}`}
                style={
                  isActive && card.gradient
                    ? { background: 'linear-gradient(white,white) padding-box, linear-gradient(to right,#4D8EF7,#A59DFF) border-box', border: '2px solid transparent' }
                    : isActive
                    ? { borderColor: card.accent, '--tw-ring-color': card.accent + '33' } as React.CSSProperties
                    : {}
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-[#717182] mb-1">{card.label}</div>
                    <div className="text-xl font-semibold text-[#030213]">{card.value}</div>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${card.iconBg}`}>
                    {card.icon}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Archived banner */}
        {showArchived && (
          <div className="flex items-center justify-between bg-[#F3F3F5] border border-[#E0E0E6] rounded-lg px-4 py-2.5 mb-6">
            <div className="flex items-center gap-2 text-sm text-[#5A5568]">
              <Archive className="w-4 h-4 text-[#717182]" />
              <span className="font-medium">Viewing archived invoices</span>
              <span className="text-[#A0A0B0]">· {counts.archived ?? 0} total</span>
            </div>
            <button
              onClick={() => { setShowArchived(false); setCurrentPage(1); }}
              className="text-sm font-medium text-[#4D8EF7] hover:text-[#3578E5] transition-colors"
            >
              Back to active
            </button>
          </div>
        )}

        {/* Search + filters */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <SearchInput
              placeholder="Search supplier, invoice number or practice…"
              value={search}
              onChange={v => { setSearch(v); setCurrentPage(1); }}
            />
            <SortDropdown
              value={sortBy}
              onChange={v => { setSortBy(v as typeof sortBy); setCurrentPage(1); }}
              options={[
                { value: 'date-desc',      label: 'Most recent' },
                { value: 'date-asc',       label: 'Oldest first' },
                { value: 'status',         label: 'By status (queue)' },
                { value: 'amount-desc',    label: 'Amount: High–Low' },
                { value: 'amount-asc',     label: 'Amount: Low–High' },
                { value: 'supplier-asc',   label: 'Supplier A–Z' },
                { value: 'confidence-asc', label: 'Confidence: Low–High' },
              ]}
            />
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'card' : 'list')}
              className="p-3 bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] rounded-lg transition-colors flex-shrink-0"
              title={viewMode === 'list' ? 'Switch to card view' : 'Switch to list view'}
            >
              {viewMode === 'list' ? (
                <Grid3x3 className="w-5 h-5 text-[#717182]" />
              ) : (
                <List className="w-5 h-5 text-[#717182]" />
              )}
            </button>
            <button
              onClick={() => setFilterDrawerOpen(true)}
              className="p-3 bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 rounded-lg transition-opacity flex-shrink-0"
            >
              <Filter className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Active filter chips */}
          {(sourceFilter !== 'all' || billedTo !== 'all' || billedToEntity !== 'all' || supplierFilter !== 'all' || lowConfOnly || leftOverOnly || notApprovedOnly || unpaidOnly || overdueOnly) && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-sm text-[#717182]">Active Filters:</span>
              {overdueOnly && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FFEBEE] text-[#D4183D] rounded-full text-sm">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Overdue · past due date</span>
                  <button onClick={() => { setOverdueOnly(false); setCurrentPage(1); }} className="hover:text-[#B71C1C] transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {unpaidOnly && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#EEF4FF] text-[#1565C0] rounded-full text-sm">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Outstanding · not yet paid</span>
                  <button onClick={() => { setUnpaidOnly(false); setCurrentPage(1); }} className="hover:text-[#0D47A1] transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {leftOverOnly && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FFEBEE] text-[#D4183D] rounded-full text-sm">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Deferred to next cycle</span>
                  <button onClick={() => { setLeftOverOnly(false); setCurrentPage(1); }} className="hover:text-[#B71C1C] transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {notApprovedOnly && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FFEBEE] text-[#D4183D] rounded-full text-sm">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Not approved · rejected or disputed</span>
                  <button onClick={() => { setNotApprovedOnly(false); setCurrentPage(1); }} className="hover:text-[#B71C1C] transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {sourceFilter !== 'all' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E3F2FD] text-[#1565C0] rounded-full text-sm">
                  <span>Source: {SOURCE_LABELS[sourceFilter as InvoiceSource]}</span>
                  <button onClick={() => { setSourceFilter('all'); setCurrentPage(1); }} className="hover:text-[#D4183D] transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {supplierFilter !== 'all' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E3F2FD] text-[#1565C0] rounded-full text-sm">
                  <span>Supplier: {supplierFilter}</span>
                  <button onClick={() => { setSupplierFilter('all'); setCurrentPage(1); }} className="hover:text-[#D4183D] transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {billedToEntity !== 'all' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E3F2FD] text-[#1565C0] rounded-full text-sm">
                  <span>Bill to: {billedToEntity}</span>
                  <button onClick={() => { setBilledToEntity('all'); setCurrentPage(1); }} className="hover:text-[#D4183D] transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {billedTo !== 'all' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E3F2FD] text-[#1565C0] rounded-full text-sm">
                  <span>Bill to type: {billedTo === 'clinic' ? 'Clinics' : billedTo === 'dentist' ? 'Dentists' : 'Group HQ'}</span>
                  <button onClick={() => { setBilledTo('all'); setCurrentPage(1); }} className="hover:text-[#D4183D] transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {lowConfOnly && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FFEBEE] text-[#C62828] rounded-full text-sm">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>QC · Needs Review</span>
                  <button onClick={() => setLowConfOnly(false)} className="hover:text-[#D4183D] transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <button
                onClick={() => { setSourceFilter('all'); setBilledTo('all'); setBilledToEntity('all'); setSupplierFilter('all'); setLowConfOnly(false); setLeftOverOnly(false); setNotApprovedOnly(false); setUnpaidOnly(false); setOverdueOnly(false); setCurrentPage(1); }}
                className="text-sm text-[#717182] hover:text-[#030213] font-medium px-2 py-1 transition-colors"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 bg-[#EEF4FF] border border-[#C8D8FC] rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1565C0]">
              {selectedIds.size} {selectedIds.size === 1 ? 'invoice' : 'invoices'} selected
            </span>
            <button
              onClick={clearSelected}
              className="text-xs text-[#717182] hover:text-[#030213] underline"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkAction('approve')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2E7D32] bg-white border border-[#A5D6A7] hover:bg-[#F1FBF2] transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approve
            </button>
            <button
              onClick={() => setBulkAction('archive')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#717182] bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </button>
          </div>
        </div>
      )}

      {/* Bulk action confirmation */}
      {bulkAction && (
        <BulkActionConfirm
          action={bulkAction}
          count={selectedIds.size}
          onCancel={() => setBulkAction(null)}
          onConfirm={applyBulkAction}
        />
      )}

      {/* CARD VIEW */}
      {viewMode === 'card' && (
        <div>
          {filtered.length === 0 ? (
            <div className="bg-white rounded-lg border border-[#E0E0E6] flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F3F3F5] flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#A0A0B0]" />
              </div>
              <p className="text-sm font-semibold text-[#030213]">No invoices found</p>
              <p className="text-xs text-[#717182]">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginated.map(invoice => (
                <div
                  key={invoice.id}
                  onClick={() => setSelectedId(invoice.id)}
                  className={`bg-white rounded-xl border cursor-pointer hover:shadow-md transition-all relative ${
                    selectedId === invoice.id ? 'border-[#4D8EF7] ring-2 ring-[#4D8EF7]/20' : selectedIds.has(invoice.id) ? 'border-[#4D8EF7]/50 ring-1 ring-[#4D8EF7]/15' : 'border-[#E0E0E6] hover:border-[#C8C0F0]'
                  }`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${invoice.number}`}
                    checked={selectedIds.has(invoice.id)}
                    onChange={() => toggleSelected(invoice.id)}
                    onClick={e => e.stopPropagation()}
                    className="absolute top-3 left-3 w-4 h-4 rounded accent-[#4D8EF7] cursor-pointer z-10"
                  />
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2 pl-7">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#030213] truncate">{invoice.number}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[10px] text-[#A0A0B0]">{fmtShort(invoice.date)}</p>
                          <DocTypeChip type={invoice.docType ?? 'invoice'} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <StatusChip status={invoice.status} />
                        {(invoice.disputeEmails?.length ?? 0) > 0 && (
                          <span
                            title={`Dispute thread — ${invoice.disputeEmails!.length} message${invoice.disputeEmails!.length === 1 ? '' : 's'}.`}
                            className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#FFEBEE] border border-[#F9DCDC]"
                          >
                            <Mail className="w-3 h-3 text-[#C62828]" />
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#D4183D] ring-2 ring-white" />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#030213] truncate">{invoice.supplier}</p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {invoice.categories.slice(0, 2).map(cat => (
                          <span key={cat} className="px-1.5 py-0.5 bg-[#F0EFF6] text-[#5A5568] rounded text-[10px] whitespace-nowrap">
                            {cat}
                          </span>
                        ))}
                        {invoice.categories.length > 2 && (
                          <span className="px-1.5 py-0.5 bg-[#E0E0E6] text-[#717182] rounded text-[10px]">
                            +{invoice.categories.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-[#F0EFF6] pt-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#A0A0B0]">Billed to</span>
                        <span className="text-[10px] font-medium text-[#030213] truncate max-w-[120px]">{invoice.billedToName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#A0A0B0]">Amount</span>
                        <span className="text-xs font-bold text-[#030213]">{fmt(invoice.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#A0A0B0]">AI confidence</span>
                        <AiConfidenceBar score={invoice.aiConfidence} width={70} />
                      </div>
                    </div>
                    {invoice.issues.length > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#FFF8F8] rounded-lg">
                        <AlertTriangle className="w-3 h-3 text-[#C62828] flex-shrink-0" />
                        <span className="text-[10px] text-[#C62828] font-medium truncate">{invoice.issues[0]}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-lg border border-[#E0E0E6] overflow-hidden">
          {/* Table header — desktop only; on mobile each row stacks its own labels */}
          <div className="bg-[#F8F9FC] border-b border-[#E0E0E6] hidden md:block">
            <div className="grid gap-4 px-6 py-3 items-center" style={{ gridTemplateColumns: '32px 1.5fr 2fr 2fr 1.2fr 1.4fr' }}>
              <input
                type="checkbox"
                aria-label="Select all on this page"
                checked={paginated.length > 0 && paginated.every(inv => selectedIds.has(inv.id))}
                ref={el => { if (el) el.indeterminate = paginated.some(inv => selectedIds.has(inv.id)) && !paginated.every(inv => selectedIds.has(inv.id)); }}
                onChange={e => {
                  setSelectedIds(prev => {
                    const next = new Set(prev);
                    if (e.target.checked) paginated.forEach(inv => next.add(inv.id));
                    else paginated.forEach(inv => next.delete(inv.id));
                    return next;
                  });
                }}
                className="w-4 h-4 rounded accent-[#4D8EF7] cursor-pointer"
              />
              {['Invoice', 'Supplier', 'Bill to', 'Amount', 'Status'].map(col => (
                <p key={col} className="text-xs font-semibold text-[#717182] uppercase tracking-wider">{col}</p>
              ))}
            </div>
          </div>

          {/* Rows — grid on md+, stacked card on mobile */}
          <div className="flex flex-col">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#F3F3F5] flex items-center justify-center">
                  <FileText className="w-6 h-6 text-[#A0A0B0]" />
                </div>
                <p className="text-sm font-semibold text-[#030213]">No invoices found</p>
                <p className="text-xs text-[#717182]">Try adjusting your filters or search term.</p>
              </div>
            ) : (
              paginated.map(invoice => {
                const isSelected = selectedId === invoice.id;
                const isChecked = selectedIds.has(invoice.id);
                return (
                  <div
                    key={invoice.id}
                    onClick={() => setSelectedId(invoice.id)}
                    className={`flex flex-col gap-3 px-4 py-4 md:grid md:gap-4 md:px-6 md:items-center cursor-pointer transition-colors border-b border-[#F0EFF6] last:border-b-0 ${
                      isSelected ? 'bg-[#F0F4FF]' : isChecked ? 'bg-[#FAFBFF]' : 'bg-white hover:bg-[#F8F9FC]'
                    }`}
                    style={{ gridTemplateColumns: '32px 1.5fr 2fr 2fr 1.2fr 1.4fr' }}
                  >
                    {/* Mobile-only top row: checkbox + invoice number + amount + status */}
                    <div className="flex items-start justify-between gap-3 md:hidden">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          aria-label={`Select ${invoice.number}`}
                          checked={isChecked}
                          onChange={() => toggleSelected(invoice.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 mt-0.5 rounded accent-[#4D8EF7] cursor-pointer flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#030213] truncate">{invoice.number}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <p className="text-xs text-[#A0A0B0]">{fmtShort(invoice.date)}</p>
                            <DocTypeChip type={invoice.docType ?? 'invoice'} />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <p className="text-sm font-semibold text-[#030213] whitespace-nowrap">{fmt(invoice.amount)}</p>
                        <div className="flex items-center gap-1.5">
                          <StatusChip status={invoice.status} />
                          {(invoice.disputeEmails?.length ?? 0) > 0 && (
                            <span
                              title={`Dispute thread — ${invoice.disputeEmails!.length} message${invoice.disputeEmails!.length === 1 ? '' : 's'}.`}
                              className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#FFEBEE] border border-[#F9DCDC]"
                            >
                              <Mail className="w-3 h-3 text-[#C62828]" />
                              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#D4183D] ring-2 ring-white" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mobile-only meta row: supplier + bill-to */}
                    <div className="md:hidden grid grid-cols-2 gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider mb-0.5">Supplier</p>
                        <p className="text-[13px] font-medium text-[#030213] truncate">{invoice.supplier}</p>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {invoice.categories.slice(0, 2).map(cat => (
                            <span key={cat} className="px-1.5 py-0.5 bg-[#F0EFF6] text-[#5A5568] rounded text-[10px] whitespace-nowrap">{cat}</span>
                          ))}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider mb-0.5">Bill to</p>
                        <p className="text-[13px] text-[#030213] truncate">{invoice.billedToName}</p>
                        <p className="text-[10px] text-[#A0A0B0] mt-0.5">{invoice.entity}</p>
                      </div>
                    </div>

                    {/* Mobile-only footer row: AI confidence + issues */}
                    <div className="md:hidden flex items-center justify-between gap-3">
                      <AiConfidenceBar score={invoice.aiConfidence} width={80} />
                      {invoice.issues.length > 0 && (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-[#C62828]" />
                          <span className="text-[10px] text-[#C62828] font-medium">
                            {invoice.issues.length} {invoice.issues.length === 1 ? 'issue' : 'issues'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ── Desktop cells (md+) ────────────────────────────────── */}
                    <input
                      type="checkbox"
                      aria-label={`Select ${invoice.number}`}
                      checked={isChecked}
                      onChange={() => toggleSelected(invoice.id)}
                      onClick={e => e.stopPropagation()}
                      className="hidden md:block w-4 h-4 rounded accent-[#4D8EF7] cursor-pointer"
                    />
                    {/* Invoice # + date + doc type */}
                    <div className="min-w-0 hidden md:block">
                      <p className="text-sm font-semibold text-[#030213] truncate">{invoice.number}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-[#A0A0B0]">{fmtShort(invoice.date)}</p>
                        <DocTypeChip type={invoice.docType ?? 'invoice'} />
                      </div>
                    </div>

                    {/* Supplier */}
                    <div className="min-w-0 hidden md:block">
                      <p className="text-sm font-medium text-[#030213] truncate">{invoice.supplier}</p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {invoice.categories.slice(0, 2).map(cat => (
                          <span key={cat} className="px-1.5 py-0.5 bg-[#F0EFF6] text-[#5A5568] rounded text-[10px] whitespace-nowrap">
                            {cat}
                          </span>
                        ))}
                        {invoice.categories.length > 2 && (
                          <span className="px-1.5 py-0.5 bg-[#E0E0E6] text-[#717182] rounded text-[10px]">
                            +{invoice.categories.length - 2}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Billed to */}
                    <div className="min-w-0 hidden md:block">
                      <p className="text-sm text-[#030213] truncate">{invoice.billedToName}</p>
                      <p className="text-xs text-[#A0A0B0] mt-0.5">{invoice.entity}</p>
                    </div>

                    {/* Amount + AI confidence */}
                    <div className="min-w-0 hidden md:block">
                      <p className="text-sm font-semibold text-[#030213]">{fmt(invoice.amount)}</p>
                      <div className="mt-1">
                        <AiConfidenceBar score={invoice.aiConfidence} width={80} />
                      </div>
                    </div>

                    {/* Status (+ issue indicator) */}
                    <div className="hidden md:flex flex-col gap-1 items-start min-w-0">
                      <div className="flex items-center gap-1.5">
                        <StatusChip status={invoice.status} />
                        {(invoice.disputeEmails?.length ?? 0) > 0 && (
                          <span
                            title={`Dispute thread — ${invoice.disputeEmails!.length} message${invoice.disputeEmails!.length === 1 ? '' : 's'}. Click to open.`}
                            className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#FFEBEE] border border-[#F9DCDC]"
                          >
                            <Mail className="w-3 h-3 text-[#C62828]" />
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#D4183D] ring-2 ring-white" />
                          </span>
                        )}
                      </div>
                      {invoice.issues.length > 0 && (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-[#C62828]" />
                          <span className="text-[10px] text-[#C62828] font-medium">
                            {invoice.issues.length} {invoice.issues.length === 1 ? 'issue' : 'issues'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Bottom bar — secondary status toggles (Disputed, Rejected, Archived) + pagination */}
      <div className="mt-6 bg-white rounded-lg border border-[#E0E0E6]">
        <div className="px-6 py-3 border-b border-[#F0EFF6] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setActiveTab(activeTab === 'disputed' && !showArchived ? 'all' : 'disputed'); setShowArchived(false); setCurrentPage(1); }}
              className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'disputed' && !showArchived
                  ? 'bg-[#C62828] text-white hover:bg-[#B71C1C]'
                  : 'text-[#C62828] hover:bg-[#FFEBEE] border border-[#F9DCDC]'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              {activeTab === 'disputed' && !showArchived ? 'Hide Disputed' : `Disputed (${counts.disputed ?? 0})`}
            </button>
            <button
              onClick={() => { setActiveTab(activeTab === 'rejected' && !showArchived ? 'all' : 'rejected'); setShowArchived(false); setCurrentPage(1); }}
              className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'rejected' && !showArchived
                  ? 'bg-[#D4183D] text-white hover:bg-[#B71C1C]'
                  : 'text-[#D4183D] hover:bg-[#FFEBEE] border border-[#F9DCDC]'
              }`}
            >
              <XCircle className="w-4 h-4" />
              {activeTab === 'rejected' && !showArchived ? 'Hide Rejected' : `Rejected (${counts.rejected ?? 0})`}
            </button>
            <button
              onClick={() => { setShowArchived(s => !s); setCurrentPage(1); }}
              className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                showArchived
                  ? 'bg-[#4D8EF7] text-white hover:bg-[#3578E5]'
                  : 'text-[#5A5568] hover:bg-[#F3F3F5] border border-[#E0E0E6]'
              }`}
            >
              <Archive className="w-4 h-4" />
              {showArchived ? 'Hide Archived' : `View Archived (${counts.archived ?? 0})`}
            </button>
          </div>
          <span className="text-xs text-[#717182]">
            {filtered.length} {filtered.length === 1 ? 'invoice' : 'invoices'}
          </span>
        </div>
        {filtered.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filtered.length}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(items) => { setItemsPerPage(items); setCurrentPage(1); }}
          />
        )}
      </div>
      </div>

      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={[
          {
            label: 'Supplier',
            value: supplierFilter,
            options: supplierOptions,
            onChange: v => { setSupplierFilter(v); setCurrentPage(1); },
          },
          {
            label: 'Bill to',
            value: billedToEntity,
            options: billToEntityOptions,
            onChange: v => { setBilledToEntity(v); setCurrentPage(1); },
          },
          {
            label: 'Bill to type',
            value: billedTo,
            options: [
              { value: 'all', label: 'All types' },
              { value: 'clinic', label: 'Clinics' },
              { value: 'dentist', label: 'Dentists' },
              { value: 'group_hq', label: 'Group HQ' },
            ],
            onChange: v => { setBilledTo(v as BilledTo); setCurrentPage(1); },
          },
          {
            label: 'Source',
            value: sourceFilter,
            options: [
              { value: 'all', label: 'All sources' },
              { value: 'email', label: 'Email' },
              { value: 'manual', label: 'Manual' },
              { value: 'api', label: 'API' },
            ],
            onChange: v => { setSourceFilter(v as 'all' | InvoiceSource); setCurrentPage(1); },
          },
          {
            label: 'Special',
            value: leftOverOnly ? 'left_over' : lowConfOnly ? 'low_confidence' : 'all',
            options: [
              { value: 'all', label: 'None' },
              { value: 'left_over', label: 'Left Over · past extraction date' },
              { value: 'low_confidence', label: 'QC · Needs Review' },
            ],
            onChange: v => {
              setLeftOverOnly(v === 'left_over');
              setLowConfOnly(v === 'low_confidence');
              setCurrentPage(1);
            },
          },
        ]}
        onApply={() => setFilterDrawerOpen(false)}
        onReset={() => { setSourceFilter('all'); setBilledTo('all'); setBilledToEntity('all'); setSupplierFilter('all'); setLeftOverOnly(false); setLowConfOnly(false); setCurrentPage(1); }}
      />

      {uploadModalOpen && (
        <UploadInvoiceModal
          onClose={() => setUploadModalOpen(false)}
          onComplete={handleUploadComplete}
        />
      )}

      {paymentDownloadOpen && (
        <PaymentDataFolderModal
          onClose={closePaymentFolder}
          invoices={invoices}
          onDownload={downloadPaymentCsv}
          initialFolder={paymentFolderParam}
        />
      )}
    </>
  );
}

// ─── Payment Data Download — month or custom range ───────────────────────────
function PaymentDataDownloadModal({ onClose, onDownload }: {
  onClose: () => void;
  onDownload: (from: string, to: string, label: string) => void;
}) {
  useLockBodyScroll();
  const today = new Date();
  const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const monthEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().split('T')[0];
  const monthLabel = (d: Date) => d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  const currentMonthStart = monthStart(today);
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const last3Start = monthStart(new Date(today.getFullYear(), today.getMonth() - 2, 1));

  const presets: { id: string; label: string; sub: string; from: string; to: string }[] = [
    { id: 'this', label: `This month (${monthLabel(today)})`,         sub: 'from start of month to today',         from: iso(currentMonthStart), to: iso(today) },
    { id: 'last', label: `Last month (${monthLabel(lastMonth)})`,     sub: 'full calendar month',                  from: iso(monthStart(lastMonth)), to: iso(monthEnd(lastMonth)) },
    { id: 'last3',label: 'Last 3 months',                              sub: `${monthLabel(last3Start)} → ${monthLabel(today)}`, from: iso(last3Start), to: iso(today) },
  ];

  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [selected, setSelected] = useState('last');
  const [customFrom, setCustomFrom] = useState(iso(monthStart(lastMonth)));
  const [customTo, setCustomTo] = useState(iso(today));

  function handleDownload() {
    if (mode === 'preset') {
      const p = presets.find(p => p.id === selected);
      if (p) onDownload(p.from, p.to, p.label);
    } else {
      if (!customFrom || !customTo || customFrom > customTo) return;
      const fromDate = new Date(customFrom);
      const toDate = new Date(customTo);
      const label = `${fromDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${toDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      onDownload(customFrom, customTo, label);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-[#4D8EF7]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#030213]">Download payment data</h3>
              <p className="text-[11px] text-[#717182]">Exports invoices that were sent for payment in the selected window.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="px-6 pt-4">
          <div className="inline-flex items-center gap-1 bg-[#F3F3F5] rounded-lg p-1">
            <button
              onClick={() => setMode('preset')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${mode === 'preset' ? 'bg-white text-[#030213] shadow-sm' : 'text-[#717182] hover:text-[#030213]'}`}
            >
              Monthly preset
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${mode === 'custom' ? 'bg-white text-[#030213] shadow-sm' : 'text-[#717182] hover:text-[#030213]'}`}
            >
              Custom range
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {mode === 'preset' ? (
            <div className="space-y-2">
              {presets.map(p => {
                const active = selected === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={`w-full flex items-start gap-3 text-left p-3 rounded-xl border transition-colors ${active ? 'border-[#4D8EF7] bg-[#EEF4FF]' : 'border-[#E0E0E6] hover:border-[#C8D8FC] hover:bg-[#F8F9FC]'}`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${active ? 'border-[#4D8EF7] bg-[#4D8EF7]' : 'border-[#D4CEE1]'}`}>
                      {active && <div className="w-1.5 h-1.5 m-auto mt-[3px] rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#030213]">{p.label}</p>
                      <p className="text-[11px] text-[#717182] mt-0.5">{p.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#717182] uppercase tracking-wide mb-1">From</label>
                  <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#717182] uppercase tracking-wide mb-1">To</label>
                  <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]" />
                </div>
              </div>
              <p className="text-[11px] text-[#717182]">Pick any range — invoices with status "Exported for Payment" or "Payment Processed" in the window will be downloaded.</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#F0EFF6] flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-[#E0E0E6] text-[#717182] rounded-lg hover:bg-[#F8F9FC] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={mode === 'custom' && (!customFrom || !customTo || customFrom > customTo)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reports — Folder Browser ────────────────────────────────────────────────
// Folder/file-style modal: years on the left, monthly reports on the right.
// Shows ALL months in past years and Jan→current month for the current year,
// regardless of whether invoices exist (a real archive lists every period).
// Each month has a folder icon; clicking Download builds a CSV for that window.
function PaymentDataFolderModal({ onClose, invoices, onDownload, initialFolder }: {
  onClose: () => void;
  invoices: Invoice[];
  onDownload: (from: string, to: string, label: string) => void;
  /** Deep-link target `YYYY-MM` — opens with this folder's year active and the
      month expanded (the Dental Group email's "View export" link lands here). */
  initialFolder?: string | null;
}) {
  useLockBodyScroll();
  const { toast } = useToast();
  // Parse the deep-link folder into year + month-key once.
  const [linkYear, linkMonth] = (initialFolder ?? '').split('-');
  // Which folder's mock "group email" is being previewed (month-key) or null.
  const [emailPreview, setEmailPreview] = useState<string | null>(null);

  // Index payment-related invoices by year/month for quick lookup.
  const buckets = useMemo(() => {
    const map = new Map<string, Map<string, Invoice[]>>();
    for (const inv of invoices) {
      if (inv.status !== 'exported_for_payment' && inv.status !== 'payment_processed') continue;
      const d = new Date(inv.date);
      if (isNaN(d.getTime())) continue;
      const y = String(d.getFullYear());
      const m = String(d.getMonth() + 1).padStart(2, '0');
      if (!map.has(y)) map.set(y, new Map());
      const yearMap = map.get(y)!;
      if (!yearMap.has(m)) yearMap.set(m, []);
      yearMap.get(m)!.push(inv);
    }
    return map;
  }, [invoices]);

  // Build the year list: every year from the earliest invoice up to "today".
  // Falls back to last year + current year if no invoices yet.
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12
  const earliestYear = useMemo(() => {
    let y = currentYear - 1;
    for (const key of buckets.keys()) y = Math.min(y, Number(key));
    return y;
  }, [buckets, currentYear]);
  const years = useMemo(() => {
    const out: string[] = [];
    for (let y = currentYear; y >= earliestYear; y--) out.push(String(y));
    return out;
  }, [currentYear, earliestYear]);

  // Seed the active year + expanded month from the deep link when present, so
  // arriving from the email's "View export" button lands on the right folder.
  const [activeYear, setActiveYear] = useState<string>(
    linkYear && years.includes(linkYear) ? linkYear : years[0]
  );
  const [expandedMonth, setExpandedMonth] = useState<string | null>(
    linkYear && linkMonth ? `${linkYear}-${linkMonth}` : null
  );

  // Shareable deep link for a folder — this is exactly what the View button
  // in the Dental Group's email points to.
  const folderLink = (year: string, month: string) =>
    `${window.location.origin}/supplier/invoices?paymentFolder=${year}-${month}`;

  // Most recent month that actually has data — the footer demo previews the
  // email for this folder (the latest export the group would have received).
  const latestFolderWithData = useMemo(() => {
    let best: string | null = null;
    for (const [y, yearMap] of buckets) {
      for (const m of yearMap.keys()) {
        const key = `${y}-${m}`;
        if (!best || key > best) best = key; // "YYYY-MM" sorts lexicographically
      }
    }
    return best;
  }, [buckets]);

  const monthLabel = (m: string) => {
    const idx = Number(m) - 1;
    return new Date(2000, idx, 1).toLocaleString('en-GB', { month: 'long' });
  };

  // All 12 months for past years; only Jan→current month for the current year.
  function monthsForYear(year: string): string[] {
    const upper = Number(year) === currentYear ? currentMonth : 12;
    const out: string[] = [];
    for (let m = 1; m <= upper; m++) out.push(String(m).padStart(2, '0'));
    return out;
  }
  function monthRows(year: string, month: string): Invoice[] {
    return buckets.get(year)?.get(month) ?? [];
  }
  function totalForYear(year: string) {
    const yearMap = buckets.get(year);
    if (!yearMap) return 0;
    let total = 0;
    for (const arr of yearMap.values()) total += arr.length;
    return total;
  }
  function totalAmountFor(rows: Invoice[]) {
    const sum = rows.reduce((a, b) => a + b.amount, 0);
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(sum);
  }
  // Two report variants are generated per month: a "Monthly Payment Export"
  // (the full payment register that flows out to accounting) and a
  // "Pay Period Data" file (the raw cycle data the export was built from).
  // Both pull the same date range — only the human label differs so the
  // existing onDownload handler can render either flavour.
  type ReportVariant = 'monthly-payment-export' | 'pay-period-data';
  function handleDownloadReport(year: string, month: string, variant: ReportVariant) {
    const from = `${year}-${month}-01`;
    const last = new Date(Number(year), Number(month), 0).getDate();
    const to = `${year}-${month}-${String(last).padStart(2, '0')}`;
    const monthName = monthLabel(month);
    const label = variant === 'monthly-payment-export'
      ? `${monthName} ${year} — Monthly Payment Export`
      : `${monthName} ${year} — Pay Period Data`;
    onDownload(from, to, label);
  }

  const activeMonths = monthsForYear(activeYear);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center">
                <FolderOpen className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#030213]">Monthly Payment Exports</h3>
                <p className="text-[11px] text-[#717182] mt-0.5">
                  Generated on the day set in <span className="font-medium text-[#5A5568]">Spend Settings → Schedule Monthly Payment Extraction</span>.
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body — 2 columns: year folders + month files */}
          <div className="flex-1 grid grid-cols-[180px_1fr] overflow-hidden">
            {/* Year folders */}
            <div className="border-r border-[#F0EFF6] bg-[#FAFBFC] overflow-y-auto p-3 space-y-1">
              <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest px-2 pb-1">Years</p>
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => setActiveYear(y)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                    activeYear === y ? 'bg-white border border-[#C8D8FC] shadow-sm' : 'hover:bg-white'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <FolderOpen className={`w-4 h-4 flex-shrink-0 ${activeYear === y ? 'text-[#4D8EF7]' : 'text-[#A0A0B0]'}`} />
                    <span className={`text-sm font-semibold ${activeYear === y ? 'text-[#030213]' : 'text-[#5A5568]'}`}>{y}</span>
                  </span>
                  <span className="text-[10px] text-[#A0A0B0] tabular-nums">{totalForYear(y)}</span>
                </button>
              ))}
            </div>

            {/* Month folders — each expands to show two Excel report files */}
            <div className="overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-[#717182]">
                  <span className="font-medium text-[#030213]">{activeYear}</span> · {activeMonths.length} {activeMonths.length === 1 ? 'folder' : 'folders'}
                </p>
                <span className="text-[11px] text-[#A0A0B0]">{totalForYear(activeYear)} payment-related invoices</span>
              </div>
              <div className="space-y-2">
                {activeMonths.map((m) => {
                  const rows = monthRows(activeYear, m);
                  const hasData = rows.length > 0;
                  const monthKey = `${activeYear}-${m}`;
                  const isOpen = expandedMonth === monthKey;
                  return (
                    <div
                      key={m}
                      className={`rounded-lg border transition-colors ${
                        isOpen ? 'border-[#C8D8FC] bg-[#F8FBFF]' : 'border-[#E0E0E6] hover:border-[#C8D8FC] hover:bg-[#F8FBFF]'
                      }`}
                    >
                      {/* Month folder header */}
                      <button
                        type="button"
                        onClick={() => setExpandedMonth(prev => prev === monthKey ? null : monthKey)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                            hasData ? 'bg-[#FFF8E1] border-[#FDE68A]' : 'bg-[#F8F9FC] border-[#E8E8EC]'
                          }`}>
                            <FolderOpen className={`w-4 h-4 ${hasData ? 'text-[#B45309]' : 'text-[#A0A0B0]'}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#030213] truncate">
                              {monthLabel(m)} {activeYear}
                            </p>
                            <p className="text-[11px] text-[#717182] mt-0.5">
                              {hasData
                                ? `${rows.length} ${rows.length === 1 ? 'invoice' : 'invoices'} · ${totalAmountFor(rows)} · 2 reports`
                                : 'No invoices in this period · 2 empty reports'}
                            </p>
                          </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-[#A0A0B0] flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Two Excel report files — only rendered when the month folder is open */}
                      {isOpen && (
                        <div className="border-t border-[#E8EAF6] bg-white rounded-b-lg divide-y divide-[#F0EFF6]">
                          {/* Report 1 — Monthly Payment Export */}
                          <div className="flex items-center justify-between gap-3 px-3 py-2.5 pl-12 hover:bg-[#F8FBFF] transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg border border-[#BBF7D0] bg-[#F0FFF4] flex items-center justify-center flex-shrink-0">
                                <FileSpreadsheet className="w-3.5 h-3.5 text-[#15803D]" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-[#030213] truncate">
                                  {monthLabel(m)} Monthly Payment Export
                                </p>
                                <p className="text-[10px] text-[#717182] mt-0.5">
                                  {monthLabel(m).toLowerCase()}-payment-export-{activeYear}.xlsx · sent to accounting
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownloadReport(activeYear, m, 'monthly-payment-export'); }}
                              disabled={!hasData}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#15803D] border border-[#BBF7D0] bg-white hover:bg-[#F0FFF4] transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                            >
                              <Download className="w-3 h-3" />
                              .xlsx
                            </button>
                          </div>

                          {/* Report 2 — Pay Period Data */}
                          <div className="flex items-center justify-between gap-3 px-3 py-2.5 pl-12 hover:bg-[#F8FBFF] transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg border border-[#C8D8FC] bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                                <FileSpreadsheet className="w-3.5 h-3.5 text-[#1565C0]" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-[#030213] truncate">
                                  {monthLabel(m)} Pay Period Data
                                </p>
                                <p className="text-[10px] text-[#717182] mt-0.5">
                                  {monthLabel(m).toLowerCase()}-pay-period-data-{activeYear}.xlsx · raw cycle data
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownloadReport(activeYear, m, 'pay-period-data'); }}
                              disabled={!hasData}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#1565C0] border border-[#C8D8FC] bg-white hover:bg-[#EEF4FF] transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                            >
                              <Download className="w-3 h-3" />
                              .xlsx
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-[#F0EFF6] flex items-center justify-between gap-3 bg-white">
            <button
              onClick={() => latestFolderWithData && setEmailPreview(latestFolderWithData)}
              disabled={!latestFolderWithData}
              title="See the email the Dental Group receives when an export is ready"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#7C3AED] to-[#A59DFF] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Mail className="w-4 h-4" />
              Preview group email
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-[#E0E0E6] text-[#717182] rounded-lg hover:bg-[#F8F9FC] transition-colors">
              Close
            </button>
          </div>
        </div>

        {/* ── Full-page group-email preview ── a demo of the message the Dental
            Group receives in their inbox. The "View export" button redirects
            back to this popup with the folder expanded. */}
        {emailPreview && (() => {
          const [ey, em] = emailPreview.split('-');
          const rows = monthRows(ey, em);
          const viewExport = () => { setActiveYear(ey); setExpandedMonth(emailPreview); setEmailPreview(null); };
          return (
            <div className="fixed inset-0 z-[120] bg-[#EEF0F4] flex flex-col">
              {/* Inbox-style top bar */}
              <div className="flex-shrink-0 bg-white border-b border-[#E0E0E6] px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                <button
                  onClick={() => setEmailPreview(null)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5A5568] hover:text-[#030213] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to exports
                </button>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F5F3FF] text-[#7C3AED] border border-[#E9D5FF]">
                  <Mail className="w-3 h-3" />
                  Dental Group inbox · demo
                </span>
                <button onClick={() => setEmailPreview(null)} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Opened email — centred on a full-page canvas */}
              <div className="flex-1 overflow-y-auto py-6 sm:py-10 px-4">
                <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-[#E0E0E6] shadow-sm overflow-hidden">
                  {/* Subject + sender */}
                  <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-[#F0EFF6]">
                    <h2 className="text-xl font-bold text-[#030213] leading-snug">Your {monthLabel(em)} {ey} payment export is ready</h2>
                    <div className="flex items-center gap-3 mt-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">SG</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#030213]">SmileGenius Spend Management <span className="text-[#A0A0B0] font-normal">&lt;noreply@smilegenius.co.uk&gt;</span></p>
                        <p className="text-xs text-[#717182]">to accounts@smilegenius.co.uk</p>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-6 sm:px-8 py-6 space-y-4">
                    <p className="text-sm text-[#5A5568] leading-relaxed">Hi team,</p>
                    <p className="text-sm text-[#5A5568] leading-relaxed">
                      Your monthly payment export for <span className="font-semibold text-[#030213]">{monthLabel(em)} {ey}</span> has been generated and is ready to view. It includes the Monthly Payment Export and the Pay Period Data report for the period.
                    </p>

                    {/* Export summary card */}
                    <div className="rounded-xl border border-[#C8D8FC] bg-[#F8FBFF] p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white border border-[#C8D8FC] flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="w-5 h-5 text-[#4D8EF7]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#030213]">{monthLabel(em)} {ey} — Payment Export</p>
                        <p className="text-xs text-[#1565C0] mt-0.5">
                          {rows.length} payment-related {rows.length === 1 ? 'invoice' : 'invoices'} · {totalAmountFor(rows)} · 2 reports
                        </p>
                      </div>
                    </div>

                    {/* View export — redirects to the folder popup, expanded */}
                    <button
                      onClick={viewExport}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity shadow-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View export
                    </button>
                    <p className="text-[11px] text-[#A0A0B0] break-all leading-snug">
                      Button links to: {folderLink(ey, em)}
                    </p>

                    <div className="pt-3 border-t border-[#F0EFF6] text-sm text-[#717182] leading-relaxed">
                      <p>Kind regards,</p>
                      <p className="font-medium text-[#5A5568]">SmileGenius Spend Management</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[#A0A0B0] text-center mt-4">
                  Demo — clicking <span className="font-semibold text-[#5A5568]">View export</span> opens the {monthLabel(em)} {ey} folder expanded.
                </p>
              </div>
            </div>
          );
        })()}
      </div>
    </ModalPortal>
  );
}
