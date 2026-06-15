import { useEffect, useState } from 'react';
import {
  Plus, Trash2, GripVertical, Plug, CheckCircle2,
  Mail, Copy, Eye, Shield, Globe,
  FileCheck, GitMerge, ChevronDown, Pencil, X,
  Bell, Zap, CornerDownRight, AtSign, Check,
  Building2, Users, UserCheck, Layers, Circle, Sliders,
  CalendarClock, Info, Upload, Download, Send,
  Link2, ClipboardCheck, Beaker, Package,
} from 'lucide-react';
import { useSupplierFields, OrgSupplierField } from '../context/SupplierFieldsContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/Button';
import { GL_ACCOUNTS } from '../data/suppliersData';

type Tab = 'fields' | 'workflows' | 'extraction' | 'integrations';
type InvoiceTab = 'inbox' | 'rag' | 'rules' | 'approval' | 'po';
type SupplierTab = 'fields' | 'email';
type ExtractionTab = 'setup' | 'email';

const TABS: { id: Tab; label: string; description: string; icon: any }[] = [
  { id: 'fields',       label: 'Supplier',               description: 'Onboarding fields & email templates', icon: Sliders },
  { id: 'workflows',    label: 'Invoice Setup',          description: 'Inbox, scoring & approvals',   icon: FileCheck },
  { id: 'extraction',   label: 'Schedule Monthly Payment Extraction',  description: 'When monthly exports run',     icon: CalendarClock },
  { id: 'integrations', label: 'Accounting Integration', description: 'Xero, QuickBooks, Sage',       icon: Plug },
];

const SUPPLIER_TABS: { id: SupplierTab; label: string; icon: React.ReactNode }[] = [
  { id: 'fields', label: 'Supplier Fields',  icon: <Sliders className="w-3.5 h-3.5" /> },
  { id: 'email',  label: 'Email Templates',  icon: <Mail className="w-3.5 h-3.5" /> },
];

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
const EXTRACTION_DAYS = [
  ...Array.from({ length: 31 }, (_, i) => ordinal(i + 1)),
  'Last day of month',
];

const INVOICE_TABS: { id: InvoiceTab; label: string; icon: React.ReactNode }[] = [
  { id: 'inbox',    label: 'Email Inbox',       icon: <Mail className="w-3.5 h-3.5" /> },
  { id: 'rag',      label: 'RAG Scoring',       icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'rules',    label: 'Rules Engine',      icon: <Shield className="w-3.5 h-3.5" /> },
  { id: 'approval', label: 'Approval Workflow', icon: <GitMerge className="w-3.5 h-3.5" /> },
  { id: 'po',       label: 'PO Matching',       icon: <Link2 className="w-3.5 h-3.5" /> },
];

// Inner tabs for Schedule Monthly Payment Extraction — Setup (schedule +
// share list) and Email (the dental-group reminder + its template).
const EXTRACTION_TABS: { id: ExtractionTab; label: string; icon: React.ReactNode }[] = [
  { id: 'setup', label: 'Setup', icon: <CalendarClock className="w-3.5 h-3.5" /> },
  { id: 'email', label: 'Email', icon: <Mail className="w-3.5 h-3.5" /> },
];

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-[#4D8EF7]' : 'bg-[#D4CEE1]'}`}
      role="switch"
      aria-checked={on}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

// ── Slider ────────────────────────────────────────────────────────────────────
function Slider({ value, min, max, onChange, color }: {
  value: number; min: number; max: number;
  onChange: (v: number) => void; color: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative h-5 flex items-center">
      {/* Track — pointer-events-none so the input behind captures all events */}
      <div className="w-full h-1.5 rounded-full bg-[#E8E8EC] relative pointer-events-none">
        <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      {/* Actual range input sits on top and is fully interactive */}
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="absolute w-full h-full opacity-0 cursor-pointer z-10"
      />
      {/* Visual thumb — pointer-events-none so it never blocks the input */}
      <div
        className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none z-0"
        style={{ left: `calc(${pct}% - 8px)`, background: color }}
      />
    </div>
  );
}

// ── FieldRow ──────────────────────────────────────────────────────────────────
function FieldRow({ field, onUpdate, onRemove }: {
  field: OrgSupplierField;
  onUpdate: (updates: Partial<OrgSupplierField>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-[#E0E0E6] rounded-lg">
      <GripVertical className="w-4 h-4 text-[#D4CEE1] flex-shrink-0" />
      <input
        value={field.label}
        onChange={e => onUpdate({ label: e.target.value })}
        placeholder="Field label"
        className="flex-1 text-sm text-[#030213] border-none outline-none bg-transparent"
      />
      <input
        value={field.placeholder}
        onChange={e => onUpdate({ placeholder: e.target.value })}
        placeholder="e.g. 1 Week, Net 15, Net 30"
        className="w-44 text-xs text-[#717182] border border-[#E0E0E6] rounded px-2 py-1 bg-[#FAFAFA] focus:outline-none focus:border-[#4D8EF7]"
      />
      <label className="flex items-center gap-1.5 cursor-pointer select-none flex-shrink-0">
        <Toggle on={field.required} onChange={v => onUpdate({ required: v })} />
        <span className="text-xs text-[#717182]">Required</span>
      </label>
      <button onClick={onRemove} className="p-1 text-[#D4CEE1] hover:text-[#C62828] transition-colors flex-shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Mock data ─────────────────────────────────────────────────────────────────
interface RagRule {
  id: string; group: string; title: string; description: string;
  type: 'score' | 'stop'; weight: number; defaultWeight: number;
  enabled: boolean; required?: boolean; alwaysOn?: boolean;
  // Optional numeric parameters for specific rules
  paramLabel?: string;
  paramUnit?: string;
  paramValue?: number;
  paramDefault?: number;
}

const INITIAL_RULES: RagRule[] = [
  // ── Supplier Risk ─────────────────────────────────────────────────
  { id: 'r1',  group: 'Supplier Risk',          title: 'Supplier not approved',     description: "Invoice from a supplier that hasn't been approved",                                                                       type: 'score', weight: 12, defaultWeight: 12, enabled: true  },
  { id: 'r2',  group: 'Supplier Risk',          title: 'New supplier detected',     description: 'First time we see invoices from this supplier',                                                                            type: 'score', weight: 2,  defaultWeight: 2,  enabled: true  },
  { id: 'r3',  group: 'Supplier Risk',          title: 'Supplier is paused',        description: 'Supplier is currently paused or on hold',                                                                                  type: 'stop',  weight: 0,  defaultWeight: 0,  enabled: true  },

  // ── Duplicate & Fraud Checks ──────────────────────────────────────
  { id: 'r4',  group: 'Duplicate & Fraud Checks', title: 'Duplicate Check',         description: 'Duplicate invoice number found',                                                                                           type: 'stop',  weight: 0,  defaultWeight: 0,  enabled: true,  required: true, alwaysOn: true },
  { id: 'r5',  group: 'Duplicate & Fraud Checks', title: 'Amount Within Norm',      description: 'Unusual amount for this supplier',                                                                                         type: 'stop',  weight: 0,  defaultWeight: 0,  enabled: false },
  { id: 'r6',  group: 'Duplicate & Fraud Checks', title: 'Tax ID Valid',            description: 'Tax ID mismatch / missing',                                                                                                type: 'score', weight: 4,  defaultWeight: 4,  enabled: false },

  // ── Invoice Compliance ────────────────────────────────────────────
  { id: 'r7',  group: 'Invoice Compliance',     title: 'Document Is An Invoice',    description: "This document doesn't look like an invoice",                                                                                type: 'stop',  weight: 0,  defaultWeight: 0,  enabled: true,  required: true, alwaysOn: true },
  { id: 'r8',  group: 'Invoice Compliance',     title: 'Missing invoice number',    description: "Invoice doesn't have a clearly identifiable invoice number",                                                               type: 'score', weight: 10, defaultWeight: 10, enabled: true  },

  // ── Spend & Price Checks ──────────────────────────────────────────
  { id: 'r9',  group: 'Spend & Price Checks',   title: 'Line Math',                 description: "A line item doesn't balance",                                                                                              type: 'score', weight: 10, defaultWeight: 10, enabled: true  },
  { id: 'r10', group: 'Spend & Price Checks',   title: 'Totals Match',              description: "Subtotal + VAT doesn't match Total",                                                                                       type: 'score', weight: 10, defaultWeight: 10, enabled: false },
  { id: 'r11', group: 'Spend & Price Checks',   title: 'VAT calculation mismatch',  description: "VAT total doesn't match calculated VAT from line items",                                                                   type: 'score', weight: 5,  defaultWeight: 5,  enabled: true  },
  { id: 'r12', group: 'Spend & Price Checks',   title: 'Round-number Amount',       description: 'Total is a suspiciously round number',                                                                                     type: 'score', weight: 3,  defaultWeight: 3,  enabled: false },
  { id: 'r13', group: 'Spend & Price Checks',   title: 'VAT number missing',        description: "Supplier VAT number isn't on the invoice",                                                                                 type: 'score', weight: 5,  defaultWeight: 5,  enabled: true  },

  // ── Clinic / Entity Matching ──────────────────────────────────────
  { id: 'r14', group: 'Clinic / Entity Matching', title: 'No addressable entity detected', description: "Invoice doesn't reference any known clinic, dentist or dental group — we can't determine where to allocate this spend", type: 'score', weight: 10, defaultWeight: 10, enabled: true  },
  { id: 'r15', group: 'Clinic / Entity Matching', title: 'Clinic mismatch',         description: "Invoice is addressed to a clinic, but the address or name doesn't match a known clinic in the group",                     type: 'score', weight: 10, defaultWeight: 10, enabled: true  },
  { id: 'r16', group: 'Clinic / Entity Matching', title: 'Dentist mismatch',        description: "Invoice references a dentist that isn't on file or isn't assigned to the billed clinic. Common on lab invoices",          type: 'score', weight: 10, defaultWeight: 10, enabled: true  },
  { id: 'r17', group: 'Clinic / Entity Matching', title: 'Dental Group mismatch',   description: "Invoice is addressed to the dental group, but the billed entity name or registration doesn't match the group on file",     type: 'score', weight: 10, defaultWeight: 10, enabled: true  },
  { id: 'r18', group: 'Clinic / Entity Matching', title: 'Lab invoice missing dentist', description: "Lab invoice doesn't reference a dentist — required so the case can be linked back to the right clinician",           type: 'score', weight: 10, defaultWeight: 10, enabled: false },
  { id: 'r19', group: 'Clinic / Entity Matching', title: 'Lab invoice missing clinic',  description: "Lab invoice doesn't reference a clinic — needed so the cost can be allocated to the right practice",                 type: 'score', weight: 10, defaultWeight: 10, enabled: false },

  // ── Dates & timing ────────────────────────────────────────────────
  { id: 'r20', group: 'Dates & timing',         title: 'Current Month',             description: "Invoice date is too far ahead of today's date",                                                                            type: 'score', weight: 10, defaultWeight: 10, enabled: false, paramLabel: 'Tolerance',    paramUnit: 'days', paramValue: 0,   paramDefault: 0   },
  { id: 'r21', group: 'Dates & timing',         title: 'Recent Invoice',            description: 'Invoice is older than the configured threshold',                                                                           type: 'score', weight: 3,  defaultWeight: 3,  enabled: false, paramLabel: 'Trigger after', paramUnit: 'days', paramValue: 180, paramDefault: 180 },
  { id: 'r22', group: 'Dates & timing',         title: 'Due Date OK',               description: 'Due date has already passed',                                                                                              type: 'score', weight: 9,  defaultWeight: 9,  enabled: true  },
];

interface ApprovalRule {
  id: string; title: string; description: string; amountLabel: string;
  tags: { label: string; color: string }[]; approvers: { label: string; color: string }[];
  anyOne: boolean; autoApprove: boolean; enabled: boolean;
}

const APPROVAL_RULE_COLORS: Record<string, string> = {
  CLINIC: 'bg-[#E3F2FD] text-[#1565C0]',
  DENTIST: 'bg-[#FCE4EC] text-[#AD1457]',
  LAB: 'bg-[#E8F5E9] text-[#2E7D32]',
  'AUTO-APPROVE': 'bg-[#E0F7FA] text-[#00838F]',
  'GROUP HQ': 'bg-[#EDE7F6] text-[#6A1B9A]',
  'ANY ONE': 'bg-[#FFF3E0] text-[#E65100]',
};

const INITIAL_APPROVAL_RULES: ApprovalRule[] = [
  { id: 'a1', title: 'Lab · Clinic/Dentist · £0–£300',     description: 'Lab invoices billed to a clinic or dentist, low value — auto-approved.',    amountLabel: 'Total £0.00 – £300.00',    tags: ['CLINIC','DENTIST','LAB','AUTO-APPROVE'].map(l => ({ label: l, color: APPROVAL_RULE_COLORS[l] })), approvers: [], anyOne: false, autoApprove: true,  enabled: true  },
  { id: 'a2', title: 'Lab · Clinic/Dentist · £300–£1500',  description: 'Lab invoices in the mid band — Practice Manager signs off.',                amountLabel: 'Total £300.00 – £1,500.00', tags: ['CLINIC','DENTIST','LAB'].map(l => ({ label: l, color: APPROVAL_RULE_COLORS[l] })), approvers: [{ label: 'Clinic Manager', color: 'bg-[#E3F2FD] text-[#1565C0]' }], anyOne: false, autoApprove: false, enabled: true  },
  { id: 'a3', title: 'Lab · Clinic/Dentist · £1500+',      description: 'Lab invoices above £1500 — Finance Team or Head of Finance signs off.',     amountLabel: 'Total > £1,500.00',         tags: ['CLINIC','DENTIST','LAB','ANY ONE'].map(l => ({ label: l, color: APPROVAL_RULE_COLORS[l] })), approvers: [{ label: 'Group Finance', color: 'bg-[#E8F5E9] text-[#2E7D32]' }, { label: 'Group Admin', color: 'bg-[#FFF3E0] text-[#E65100]' }], anyOne: true, autoApprove: false, enabled: true  },
  { id: 'a4', title: 'Lab · Dental Group · £0–£2500',      description: 'Lab invoices billed at Dental Group level (no clinic/dentist on invoice).', amountLabel: 'Total £0.00 – £2,500.00',  tags: ['GROUP HQ','LAB'].map(l => ({ label: l, color: APPROVAL_RULE_COLORS[l] })), approvers: [{ label: 'Group Finance', color: 'bg-[#E8F5E9] text-[#2E7D32]' }], anyOne: false, autoApprove: false, enabled: true  },
  { id: 'a5', title: 'Lab · Dental Group · £2500–£10000',  description: 'Lab invoices to Dental Group in the mid band.',                             amountLabel: 'Total £2,500.00 – £10,000.00', tags: ['GROUP HQ','LAB','ANY ONE'].map(l => ({ label: l, color: APPROVAL_RULE_COLORS[l] })), approvers: [{ label: 'Group Finance', color: 'bg-[#E8F5E9] text-[#2E7D32]' }, { label: 'Group Admin', color: 'bg-[#FFF3E0] text-[#E65100]' }], anyOne: true, autoApprove: false, enabled: true  },
];

const INITIAL_ALLOW_LIST = [
  { icon: 'email', email: 'accounts@smilegenius.co.uk',        label: 'Group accounts inbox' },
  { icon: 'email', email: 'ap@smilegenius.co.uk',              label: 'Accounts Payable' },
  { icon: 'domain',email: '*@smilegenius.co.uk',               label: 'Any internal sender' },
  { icon: 'email', email: 'marylebone-admin@smilegenius.co.uk', label: 'Marylebone clinic admin' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-tab panels
// ─────────────────────────────────────────────────────────────────────────────

function EmailInboxTab() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const emailAddr = 'invoices+smilegroup@app.smilegenius.co.uk';
  const [allowList, setAllowList] = useState(INITIAL_ALLOW_LIST);
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  // Email-logs modal — chronologically ordered receipt-and-routing events that
  // the parser actually records when invoices arrive in the inbox.
  const [logsOpen, setLogsOpen] = useState(false);
  const emailLogs = [
    { id: 'l1', icon: 'in',   actor: 'patterson@accounts.com',  subject: 'INV-55902 — Patterson Dental UK',     status: 'parsed',    detail: 'AI confidence 81% · matched to supplier Patterson Dental UK',  ts: '25 May 2026, 09:14' },
    { id: 'l2', icon: 'in',   actor: 'billing@kingsbridge.com', subject: 'LAB-2024-4821 — Lab invoice',         status: 'parsed',    detail: 'Auto-approved · routed to AP queue',                            ts: '25 May 2026, 08:31' },
    { id: 'l3', icon: 'fail', actor: 'sales@unknown-sender.io', subject: 'Promotional newsletter',              status: 'rejected',  detail: 'Sender not on allow-list — bounced with reply template',        ts: '24 May 2026, 17:02' },
    { id: 'l4', icon: 'in',   actor: 'accounts@3shape.com',     subject: 'QTE-3Shape-2025-114 — Quote',         status: 'parsed',    detail: 'AI flagged as Quote (not payable) · sent to CFO review',         ts: '24 May 2026, 15:42' },
    { id: 'l5', icon: 'out',  actor: 'noreply@app.smilegenius', subject: 'Bounce reply to sales@unknown-sender', status: 'sent',     detail: 'Auto-reply template "Sender not authorised"',                   ts: '24 May 2026, 17:02' },
    { id: 'l6', icon: 'in',   actor: 'finance@eurodontic.ie',   subject: 'DL-9003-B — Implant crowns',          status: 'parsed',    detail: 'AI confidence 74% · flagged: amount exceeds rule threshold',     ts: '24 May 2026, 14:45' },
    { id: 'l7', icon: 'in',   actor: 'no-attachment@dental.co', subject: 'Re: invoice question',                status: 'skipped',   detail: 'No PDF or invoice attachment found · skipped',                  ts: '23 May 2026, 11:18' },
    { id: 'l8', icon: 'in',   actor: 'support@dd-group.ie',     subject: 'INV-DD-7782 — Implant supplies',      status: 'parsed',    detail: 'Auto-approved · 92% confidence · routed to AP',                 ts: '23 May 2026, 09:55' },
  ];

  function copy() {
    navigator.clipboard.writeText(emailAddr).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Inbox address copied to clipboard');
  }
  function addAllowEntry() {
    if (!newEmail.trim()) return;
    const isDomain = newEmail.includes('*');
    const entry = { icon: isDomain ? 'domain' : 'email', email: newEmail.trim(), label: newLabel.trim() };
    setAllowList(prev => [...prev, entry]);
    setNewEmail(''); setNewLabel('');
    toast.success(`Added ${entry.email} to allow-list`);
  }
  function removeAllowEntry(i: number) {
    const removed = allowList[i];
    setAllowList(prev => prev.filter((_, j) => j !== i));
    toast.success(`Removed ${removed.email} from allow-list`);
  }

  return (
    <div className="space-y-4">
      {/* Hero card — gradient accent */}
      <div className="rounded-2xl overflow-hidden border border-[#E0E0E6]">
        <div className="bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white/70 uppercase tracking-widest">Your unique invoice inbox</p>
            <p className="text-sm font-semibold text-white mt-0.5">Forward supplier invoices here — AI handles the rest</p>
          </div>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-[#F8F9FC] rounded-xl border border-[#E0E0E6]">
              <Mail className="w-3.5 h-3.5 text-[#A0A0B0] flex-shrink-0" />
              <span className="text-sm text-[#030213] truncate font-mono">{emailAddr}</span>
            </div>
            <button
              onClick={copy}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                copied
                  ? 'bg-[#F0FDF4] text-[#2E7D32] border-[#BBF7D0]'
                  : 'bg-white text-[#5A5568] border-[#E0E0E6] hover:bg-[#F8F9FC]'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-[#717182] leading-relaxed">
            Set this as the default invoice email with each supplier, or auto-forward from your accounts inbox. Every invoice received is parsed by AI in under 30 seconds — OCR, line-item extraction, supplier match, and RAG scoring.
          </p>
        </div>
      </div>

      {/* 3 feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon: <CornerDownRight className="w-4 h-4 text-[#4D8EF7]" />,
            iconBg: 'bg-[#EEF4FF]',
            border: 'border-[#DBEAFE]',
            title: 'Auto-forward setup',
            desc: 'Add a forwarding rule in Gmail / Outlook / Microsoft 365 from your accounts inbox to the address above.',
          },
          {
            icon: <Shield className="w-4 h-4 text-[#7C3AED]" />,
            iconBg: 'bg-[#F5F3FF]',
            border: 'border-[#EDE9FE]',
            title: 'Source allow-list',
            desc: 'Only emails forwarded from your allow-listed inboxes or domains are auto-processed. Manage in the section below.',
          },
          {
            icon: <Zap className="w-4 h-4 text-[#2E7D32]" />,
            iconBg: 'bg-[#F0FDF4]',
            border: 'border-[#BBF7D0]',
            title: '≤ 30 sec to parse',
            desc: 'OCR, line-item extraction, supplier match, RAG scoring and entity routing all happen in under 30 seconds.',
          },
        ].map(({ icon, iconBg, border, title, desc }) => (
          <div key={title} className={`bg-white border ${border} rounded-xl p-4 hover:shadow-md transition-shadow`}>
            <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
              {icon}
            </div>
            <p className="text-sm font-semibold text-[#030213] mb-1.5">{title}</p>
            <p className="text-xs text-[#717182] leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Auto-forwarding setup */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EFF6] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#030213]">Set up auto-forwarding</p>
            <p className="text-xs text-[#717182] mt-0.5">Route invoices from your email client directly to the inbox above.</p>
          </div>
          <button
            onClick={() => setLogsOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#5A5568] border border-[#E0E0E6] px-3 py-1.5 rounded-lg hover:bg-[#F8F9FC] transition-colors whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5" /> View email logs
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#F0EFF6]">
          {[
            { client: 'Gmail', color: 'text-[#EA4335]', steps: ['Open Settings (gear icon)', 'Forwarding and POP/IMAP', 'Add a forwarding address → paste above'] },
            { client: 'Outlook', color: 'text-[#0078D4]', steps: ['Settings → Mail → Forwarding', 'Enable forwarding', 'Paste your inbox address'] },
            { client: 'Microsoft 365', color: 'text-[#185ABD]', steps: ['Admin centre → Exchange', 'Mail flow → Rules', 'Forward all invoices to above address'] },
          ].map(({ client, color, steps }) => (
            <div key={client} className="p-5">
              <p className={`text-xs font-bold mb-3 ${color}`}>{client}</p>
              <ol className="space-y-2.5">
                {steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span className="text-xs text-[#5A5568] leading-relaxed">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {/* Email allow-list — logically belongs here under Email Inbox */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#F0EFF6] flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EEF4FF] border border-[#DBEAFE] flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4 text-[#4D8EF7]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#030213]">Email allow-list</h3>
            <p className="text-xs text-[#717182] mt-0.5">Only invoices forwarded from these inboxes (or domains) are trusted. Anything else is flagged.</p>
          </div>
        </div>
        <div className="p-5">
          <div className="divide-y divide-[#F8F9FC] mb-4">
            {allowList.map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <div className="w-7 h-7 rounded-full bg-[#F3F3F5] flex items-center justify-center flex-shrink-0">
                  {e.icon === 'domain' ? <Globe className="w-3.5 h-3.5 text-[#717182]" /> : <AtSign className="w-3.5 h-3.5 text-[#717182]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#030213] truncate">{e.email}</p>
                  {e.label && <p className="text-[10px] text-[#717182]">{e.label}</p>}
                </div>
                <button onClick={() => removeAllowEntry(i)} className="text-[#D4CEE1] hover:text-[#C62828] transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-[#F0EFF6]">
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAllowEntry()}
              placeholder="email or *@domain.co.uk"
              className="flex-1 px-3 py-2 border border-[#E0E0E6] rounded-lg text-xs focus:outline-none focus:border-[#4D8EF7] bg-white" />
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (optional)"
              className="w-40 px-3 py-2 border border-[#E0E0E6] rounded-lg text-xs focus:outline-none focus:border-[#4D8EF7] bg-white" />
            <button onClick={addAllowEntry}
              className="flex items-center gap-1 px-3 py-2 text-xs font-medium bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>
      </div>

      {/* ── Email logs modal — opens from the "View email logs" button above ── */}
      {logsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setLogsOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center">
                  <Mail className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#030213]">Email inbox activity</h3>
                  <p className="text-[11px] text-[#717182] mt-0.5">Every message that hit <span className="font-mono font-medium text-[#5A5568]">{emailAddr}</span> and how the parser routed it.</p>
                </div>
              </div>
              <button onClick={() => setLogsOpen(false)} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-2">
                {emailLogs.map(log => {
                  const isIn = log.icon === 'in';
                  const isOut = log.icon === 'out';
                  const isFail = log.icon === 'fail';
                  const statusClass =
                    log.status === 'parsed'   ? 'bg-[#E8F5E9] text-[#2E7D32]'
                  : log.status === 'sent'     ? 'bg-[#EEF4FF] text-[#1565C0]'
                  : log.status === 'rejected' ? 'bg-[#FFEBEE] text-[#C62828]'
                  :                              'bg-[#F3F3F5] text-[#717182]';
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-3 py-3 rounded-xl border border-[#F0EFF6] hover:bg-[#FAFBFF] transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isIn ? 'bg-[#E8F5E9] text-[#2E7D32]' : isOut ? 'bg-[#EEF4FF] text-[#1565C0]' : isFail ? 'bg-[#FFEBEE] text-[#C62828]' : 'bg-[#F3F3F5] text-[#717182]'
                      }`}>
                        {isOut ? <Send className="w-3.5 h-3.5" /> : isFail ? <X className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-[#030213] truncate">{log.subject}</p>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusClass}`}>{log.status}</span>
                        </div>
                        <p className="text-[11px] text-[#717182] mt-0.5 truncate">{log.actor}</p>
                        <p className="text-[11px] text-[#5A5568] mt-1 leading-relaxed">{log.detail}</p>
                        <p className="text-[10px] text-[#A0A0B0] mt-1">{log.ts}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-6 py-3 border-t border-[#F0EFF6] bg-[#FAFBFF] flex items-center justify-between">
              <span className="text-[11px] text-[#717182]">Showing {emailLogs.length} most recent events · full logs retained for 90 days</span>
              <button onClick={() => setLogsOpen(false)} className="px-4 py-1.5 text-xs font-medium border border-[#E0E0E6] rounded-lg hover:bg-white transition-colors text-[#5A5568]">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RagScoringTab() {
  const { toast } = useToast();
  const [green, setGreen] = useState(81);
  const [amber, setAmber] = useState(70);
  const [autoLimit, setAutoLimit] = useState(500);
  const [notifyQC, setNotifyQC] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [ragEditing, setRagEditing] = useState(false);
  const [ragSaved, setRagSaved] = useState(false);
  const [qcSaved, setQcSaved] = useState(false);

  function handleRagSave() {
    setRagEditing(false);
    setRagSaved(true);
    setTimeout(() => setRagSaved(false), 2000);
    toast.success('RAG thresholds saved');
  }

  return (
    <div className="space-y-4">
      {/* RAG score thresholds */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#F0EFF6] flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4D8EF7]/10 to-[#A59DFF]/10 border border-[#DBEAFE] flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-[#4D8EF7]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#030213]">RAG score thresholds</h3>
              <p className="text-xs text-[#717182] mt-0.5">Set AI confidence bands. Invoices are colour-coded so your team knows at a glance what needs attention.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {ragEditing ? (
              <>
                <button
                  onClick={() => { setGreen(81); setAmber(70); setAutoLimit(500); }}
                  className="text-xs text-[#717182] hover:text-[#030213] border border-[#E0E0E6] px-3 py-1.5 rounded-lg transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={handleRagSave}
                  className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Save changes
                </button>
              </>
            ) : (
              <button
                onClick={() => setRagEditing(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-[#5A5568] border border-[#E0E0E6] px-3 py-1.5 rounded-lg hover:bg-[#F8F9FC] transition-colors"
              >
                <Pencil className="w-3 h-3" />
                {ragSaved ? '✓ Saved' : 'Edit'}
              </button>
            )}
          </div>
        </div>

        {/* Colour band cards — always visible */}
        <div className="p-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl overflow-hidden border border-[#BBF7D0] bg-[#F0FDF4]">
              <div className="h-1.5 bg-[#2E7D32]" />
              <div className="p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2E7D32]" />
                  <span className="text-[10px] font-bold text-[#2E7D32] uppercase tracking-wider">Green</span>
                </div>
                <p className="text-2xl font-bold text-[#030213] mb-1">≥ {green} <span className="text-base font-semibold">pts</span></p>
                <p className="text-xs text-[#2E7D32] font-medium">Auto-approval eligible</p>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden border border-[#FED7AA] bg-[#FFF7ED]">
              <div className="h-1.5 bg-[#F57C00]" />
              <div className="p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F57C00]" />
                  <span className="text-[10px] font-bold text-[#F57C00] uppercase tracking-wider">Amber</span>
                </div>
                <p className="text-2xl font-bold text-[#030213] mb-1">{amber}–{green - 1} <span className="text-base font-semibold">pts</span></p>
                <p className="text-xs text-[#E65100] font-medium">Manual review needed</p>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden border border-[#FECACA] bg-[#FFF1F2]">
              <div className="h-1.5 bg-[#C62828]" />
              <div className="p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C62828]" />
                  <span className="text-[10px] font-bold text-[#C62828] uppercase tracking-wider">Red</span>
                </div>
                <p className="text-2xl font-bold text-[#030213] mb-1">&lt; {amber} <span className="text-base font-semibold">pts</span></p>
                <p className="text-xs text-[#C62828] font-medium">Always flagged for review</p>
              </div>
            </div>
          </div>
        </div>

        {/* Edit panel — only visible in edit mode */}
        {ragEditing && (
          <div className="px-5 pb-5 border-t border-[#F0EFF6] space-y-5 pt-5">
            {/* Green threshold */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-[#030213]">Green threshold</p>
                <span className="text-sm font-semibold text-[#2E7D32]">{green}%</span>
              </div>
              <Slider value={green} min={50} max={100} onChange={v => setGreen(Math.max(v, amber + 1))} color="#2E7D32" />
              <p className="text-xs text-[#717182] mt-2">Invoices at or above this confidence are eligible for automatic approval.</p>
            </div>

            {/* Amber threshold */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-[#030213]">Amber threshold</p>
                <span className="text-sm font-semibold text-[#F57C00]">{amber}%</span>
              </div>
              <Slider value={amber} min={0} max={green - 1} onChange={v => setAmber(v)} color="#F57C00" />
              <p className="text-xs text-[#717182] mt-2">Below this, invoices are flagged red and always require manual review.</p>
            </div>

            {/* Auto-approve limit */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-[#030213]">Auto-approve below</p>
                <div className="flex items-center gap-1 border border-[#E0E0E6] rounded-lg overflow-hidden">
                  <span className="px-2 py-1.5 text-xs text-[#717182] bg-[#F8F9FC] border-r border-[#E0E0E6]">£</span>
                  <input
                    type="number" value={autoLimit}
                    onChange={e => setAutoLimit(Number(e.target.value))}
                    className="w-20 px-2 py-1.5 text-xs text-[#030213] focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-xs text-[#717182]">Green-rated invoices under this amount skip manual approval entirely. Set to 0 to disable auto-approval.</p>
              <div className="mt-2 px-3 py-2 bg-[#F8F9FC] border border-[#E0E0E6] rounded-lg flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-[#2E7D32]" />
                <p className="text-xs text-[#2E7D32]">Currently auto-approving green invoices under £{autoLimit.toLocaleString()}.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QC Workflow */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#F0EFF6] flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center flex-shrink-0">
              <FileCheck className="w-5 h-5 text-[#2E7D32]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#030213]">QC workflow</h3>
              <p className="text-xs text-[#717182] mt-0.5">Notification preferences for invoices in the QC queue.</p>
            </div>
          </div>
          <button
            onClick={() => { setQcSaved(true); setTimeout(() => setQcSaved(false), 2000); toast.success('QC notification preferences saved'); }}
            className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
          >
            {qcSaved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Notify on new QC item */}
          <div className="p-4 border border-[#E0E0E6] rounded-xl flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F3F3F5] flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-[#030213]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#030213]">Notify on new QC item</p>
                <p className="text-[10px] text-[#717182] mt-0.5 leading-relaxed">Send an email when an invoice enters the QC queue, so reviewers know to take a look.</p>
              </div>
            </div>
            <Toggle on={notifyQC} onChange={setNotifyQC} />
          </div>

          {/* Weekly digest */}
          <div className="p-4 border border-[#E0E0E6] rounded-xl flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F3F3F5] flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-[#030213]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#030213]">Weekly digest email</p>
                <p className="text-[10px] text-[#717182] mt-0.5 leading-relaxed">Monday-morning summary of all pending QC items and weekly spend. Useful for owners and DSO finance teams.</p>
              </div>
            </div>
            <Toggle on={weeklyDigest} onChange={setWeeklyDigest} />
          </div>
        </div>
      </div>
    </div>
  );
}

function RulesEngineTab() {
  const { toast } = useToast();
  const [rules, setRules] = useState<RagRule[]>(INITIAL_RULES);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [thresholdsEditing, setThresholdsEditing] = useState(false);
  const [thresholdsSaved, setThresholdsSaved] = useState(false);
  const [lookback, setLookback] = useState(90);
  const [anomalyTol, setAnomalyTol] = useState(30);
  const [restrictPeriod, setRestrictPeriod] = useState(false);
  const [requireSender, setRequireSender] = useState(true);
  const [ragInfoOpen, setRagInfoOpen] = useState(false);

  function updateRule(id: string, updates: Partial<RagRule>) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }
  function handleSave() {
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast.success('RAG rules saved');
  }
  function handleReset() {
    setLookback(90); setAnomalyTol(30);
    setRestrictPeriod(false); setRequireSender(true);
    setRules(INITIAL_RULES);
    toast.success('RAG rules reset to defaults');
  }

  const activeCount  = rules.filter(r => r.enabled).length;
  const totalWeight  = rules.filter(r => r.enabled && r.type === 'score').reduce((s, r) => s + r.weight, 0);
  const criticalCount = rules.filter(r => r.enabled && r.weight >= 10).length;
  const blockingCount = rules.filter(r => r.enabled && r.type === 'stop').length;
  const groups = Array.from(new Set(rules.map(r => r.group)));

  return (
    <div className="space-y-4">

      {/* Stats header — always visible */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#F0EFF6] flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F5F3FF] border border-[#EDE9FE] flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-[#7C3AED]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#030213]">RAG scoring engine</h3>
              <button
                onClick={() => setRagInfoOpen(o => !o)}
                className="text-[11px] font-medium text-[#4D8EF7] hover:text-[#3578E5] transition-colors"
              >
                {ragInfoOpen ? 'Hide info' : 'How it works'}
              </button>
            </div>
            <p className="text-xs text-[#717182] mt-0.5 leading-relaxed">
              Each failed rule deducts its weight from 100 — final score lands in Green, Amber, or Red.
            </p>
            {ragInfoOpen && (
              <div className="mt-3 px-3 py-2.5 bg-[#F8F9FC] border border-[#E0E0E6] rounded-lg text-xs text-[#5A5568] leading-relaxed max-w-2xl">
                Every invoice starts at 100. Each failed <span className="font-semibold text-[#030213]">Score</span> rule subtracts its weight from the total. The final score lands in Green (auto-approval eligible), Amber (manual review), or Red (always flagged). Any rule with action <span className="font-semibold text-[#C62828]">Block</span> stops the invoice immediately regardless of the score.
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-[#F0EFF6]">
          {[
            { label: 'Active rules',           value: `${activeCount}`, suffix: ` / ${rules.length}`, accent: '#4D8EF7', bg: '#EEF4FF', icon: CheckCircle2 },
            { label: 'Deduction weight',       value: `${totalWeight}`, suffix: ' pts',               accent: '#7C3AED', bg: '#F5F3FF', icon: Zap },
            { label: 'Critical rules',         value: String(criticalCount), accent: '#E65100', bg: '#FFF7ED', icon: Shield },
            { label: 'Blocking rules',         value: String(blockingCount), accent: '#C62828', bg: '#FFF1F2', icon: X },
          ].map(({ label, value, suffix, accent, bg, icon: Icon }) => (
            <div key={label} className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon className="w-4 h-4" style={{ color: accent }} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-[#717182] uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-lg font-semibold text-[#030213] leading-none">
                  {value}
                  {suffix && <span className="text-xs font-normal text-[#A0A0B0] ml-0.5">{suffix}</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
        {/* Per-group breakdown — quick at-a-glance summary */}
        <div className="px-5 py-3 border-t border-[#F0EFF6] bg-[#FAFBFC] flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mr-1">By category</span>
          {groups.map(g => {
            const groupRules = rules.filter(r => r.group === g);
            const active = groupRules.filter(r => r.enabled).length;
            return (
              <span key={g} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#E0E0E6] rounded-full text-[11px] text-[#5A5568]">
                <span className="font-medium text-[#030213]">{g}</span>
                <span className="text-[#A0A0B0]">·</span>
                <span className="text-[#2E7D32] font-semibold">{active}</span>
                <span className="text-[#A0A0B0]">/ {groupRules.length}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Detection thresholds */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#F0EFF6] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#030213]">Detection thresholds</p>
            <p className="text-xs text-[#717182] mt-0.5">Fine-tune how strict the duplicate, anomaly, and period checks are.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {thresholdsEditing ? (
              <>
                <button
                  onClick={() => { setLookback(90); setAnomalyTol(30); setRestrictPeriod(false); setRequireSender(true); }}
                  className="text-xs text-[#717182] hover:text-[#030213] border border-[#E0E0E6] px-3 py-1.5 rounded-lg transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => { setThresholdsEditing(false); setThresholdsSaved(true); setTimeout(() => setThresholdsSaved(false), 2000); toast.success('Thresholds saved'); }}
                  className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Save changes
                </button>
              </>
            ) : (
              <button
                onClick={() => setThresholdsEditing(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-[#5A5568] border border-[#E0E0E6] px-3 py-1.5 rounded-lg hover:bg-[#F8F9FC] transition-colors"
              >
                <Pencil className="w-3 h-3" />
                {thresholdsSaved ? '✓ Saved' : 'Edit'}
              </button>
            )}
          </div>
        </div>

        {/* VIEW — summary chips */}
        {!thresholdsEditing && (
          <div className="p-5 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-[#F8F9FC] border border-[#E0E0E6] rounded-xl">
              <span className="text-[10px] font-semibold text-[#717182] uppercase tracking-wider">Lookback</span>
              <span className="text-sm font-bold text-[#030213]">{lookback} days</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#F8F9FC] border border-[#E0E0E6] rounded-xl">
              <span className="text-[10px] font-semibold text-[#717182] uppercase tracking-wider">Anomaly tolerance</span>
              <span className="text-sm font-bold text-[#030213]">±{anomalyTol}%</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${restrictPeriod ? 'bg-[#F8F9FC] border-[#E0E0E6]' : 'bg-[#F8F9FC] border-[#E0E0E6]'}`}>
              <span className="text-[10px] font-semibold text-[#717182] uppercase tracking-wider">Period lock</span>
              <span className={`text-xs font-semibold ${restrictPeriod ? 'text-[#030213]' : 'text-[#A0A0B0]'}`}>{restrictPeriod ? 'On' : 'Off'}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#F8F9FC] border border-[#E0E0E6] rounded-xl">
              <span className="text-[10px] font-semibold text-[#717182] uppercase tracking-wider">Sender match</span>
              <span className={`text-xs font-semibold ${requireSender ? 'text-[#030213]' : 'text-[#A0A0B0]'}`}>{requireSender ? 'On' : 'Off'}</span>
            </div>
          </div>
        )}

        {/* EDIT — sliders + toggles */}
        {thresholdsEditing && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-[#030213]">Duplicate lookback window</p>
                  <span className="text-xs font-semibold text-[#030213]">{lookback} days</span>
                </div>
                <Slider value={lookback} min={7} max={365} onChange={setLookback} color="#4D8EF7" />
                <p className="text-[10px] text-[#717182] mt-2 leading-relaxed">An invoice is flagged as a duplicate if the same supplier + invoice number + amount appeared within this window.</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-[#030213]">Amount anomaly tolerance</p>
                  <span className="text-xs font-semibold text-[#030213]">±{anomalyTol}%</span>
                </div>
                <Slider value={anomalyTol} min={5} max={100} onChange={setAnomalyTol} color="#4D8EF7" />
                <p className="text-[10px] text-[#717182] mt-2 leading-relaxed">Invoices outside this band of the supplier's 90-day average are flagged for human review.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Restrict to current accounting period', desc: 'Auto-flag invoices dated outside the current month.', value: restrictPeriod, set: setRestrictPeriod },
                { label: 'Require original sender match', desc: 'Beyond the forwarder, validate the invoice came from a known supplier domain.', value: requireSender, set: setRequireSender },
              ].map(({ label, desc, value, set }) => (
                <div key={label} className="flex items-start justify-between gap-3 p-3.5 border border-[#E0E0E6] rounded-xl">
                  <div>
                    <p className="text-xs font-medium text-[#030213]">{label}</p>
                    <p className="text-[10px] text-[#717182] mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                  <Toggle on={value} onChange={set} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RAG rules library */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#F0EFF6] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#030213]">RAG rules library</h3>
            <p className="text-xs text-[#717182] mt-0.5">Enable or disable rules and adjust weights to control how strictly invoices are scored.</p>
          </div>
          {/* Edit bar in header */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {editing ? (
              <>
                <button onClick={handleReset} className="text-xs text-[#717182] hover:text-[#030213] border border-[#E0E0E6] px-3 py-1.5 rounded-lg transition-colors">Reset</button>
                <button onClick={handleSave} className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity">Save changes</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-[#5A5568] border border-[#E0E0E6] px-3 py-1.5 rounded-lg hover:bg-[#F8F9FC] transition-colors">
                <Pencil className="w-3 h-3" />
                {saved ? '✓ Saved' : 'Edit'}
              </button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-6">
          {groups.map(group => {
            const groupRules = rules.filter(r => r.group === group);
            return (
              <div key={group}>
                <p className="text-xs font-semibold text-[#5A5568] uppercase tracking-wider mb-3">
                  {group} <span className="normal-case font-normal text-[#A0A0B0]">· {groupRules.length} rules</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {groupRules.map(rule => (
                    <div key={rule.id} className="border border-[#E0E0E6] rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#030213]">{rule.title}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${rule.type === 'stop' ? 'bg-[#FFEBEE] text-[#C62828] border-[#EF9A9A]' : 'bg-[#E8F0FE] text-[#4D8EF7] border-[#90CAF9]'}`}>
                            {rule.type === 'stop' ? '● Stop' : '● Score'}
                          </span>
                          {rule.alwaysOn && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F3F3F5] text-[#717182] border border-[#E0E0E6]">🔒 Always on</span>}
                        </div>
                        <Toggle on={rule.enabled} onChange={v => !rule.required && updateRule(rule.id, { enabled: v })} />
                      </div>
                      <p className="text-xs text-[#717182] mb-3 leading-relaxed">{rule.description}</p>
                      {rule.type === 'stop' && rule.required && <p className="text-[10px] text-[#A0A0B0] italic mb-2">Required check — cannot be turned off.</p>}

                      {/* Optional numeric parameter (e.g. tolerance days, trigger after) */}
                      {rule.paramLabel !== undefined && (
                        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-[#F8F9FC] border border-[#E0E0E6] rounded-lg">
                          <Sliders className="w-3 h-3 text-[#A0A0B0]" />
                          <span className="text-[10px] font-semibold text-[#717182] uppercase tracking-wider">{rule.paramLabel}</span>
                          {editing ? (
                            <input
                              type="number"
                              value={rule.paramValue ?? 0}
                              onChange={e => updateRule(rule.id, { paramValue: Number(e.target.value) })}
                              className="ml-auto w-16 px-2 py-1 text-xs text-[#030213] border border-[#E0E0E6] rounded bg-white focus:outline-none focus:border-[#4D8EF7]"
                            />
                          ) : (
                            <span className="ml-auto text-xs font-bold text-[#030213] tabular-nums">{rule.paramValue ?? 0}</span>
                          )}
                          <span className="text-[10px] text-[#A0A0B0]">{rule.paramUnit}</span>
                        </div>
                      )}

                      {/* Action — comes first; controls whether Weight is relevant */}
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider mb-1.5">Action</p>
                        {editing && !rule.alwaysOn ? (
                          <div className="relative">
                            <select
                              value={rule.type}
                              onChange={e => updateRule(rule.id, { type: e.target.value as 'score' | 'stop' })}
                              className="w-full appearance-none px-3 py-2 pr-8 border border-[#E0E0E6] rounded-lg bg-white text-xs text-[#030213] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7] cursor-pointer"
                            >
                              <option value="score">Score (deduct weight)</option>
                              <option value="stop">Stop (block invoice)</option>
                            </select>
                            <ChevronDown className="w-3 h-3 text-[#A0A0B0] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        ) : (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${rule.type === 'stop' ? 'bg-[#FFEBEE] text-[#C62828] border-[#EF9A9A]' : 'bg-[#E8F0FE] text-[#4D8EF7] border-[#90CAF9]'}`}>
                            {rule.type}
                          </span>
                        )}
                      </div>

                      {/* Weight — only when action is Score */}
                      {rule.type === 'score' && (
                        <div className="mb-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider">Weight</p>
                            <span className="text-sm font-bold text-[#030213]">{rule.weight}</span>
                          </div>
                          {editing && (
                            <Slider value={rule.weight} min={0} max={20} onChange={v => updateRule(rule.id, { weight: v })} color="#4D8EF7" />
                          )}
                        </div>
                      )}
                      {rule.type === 'stop' && (
                        <p className="text-[10px] text-[#A0A0B0] italic">Stop rules block the invoice regardless of score — weight is not applied.</p>
                      )}

                      {editing && rule.type === 'score' && (
                        <button onClick={() => updateRule(rule.id, { weight: rule.defaultWeight })} className="mt-2 text-[10px] text-[#717182] hover:text-[#030213] hover:underline transition-colors">reset to default</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Role definitions ──────────────────────────────────────────────────────────
const ALL_ROLES = [
  { id: 'gsa', label: 'Group Super Admin', color: 'bg-[#FFEBEE] text-[#C62828] border-[#EF9A9A]' },
  { id: 'ga',  label: 'Group Admin',       color: 'bg-[#FFF3E0] text-[#E65100] border-[#FFCC80]' },
  { id: 'gm',  label: 'Group Manager',     color: 'bg-[#E8F0FE] text-[#4D8EF7] border-[#90CAF9]' },
  { id: 'gf',  label: 'Group Finance',     color: 'bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]' },
  { id: 'ca',  label: 'Clinic Admin',      color: 'bg-[#EDE7F6] text-[#6A1B9A] border-[#CE93D8]' },
  { id: 'cm',  label: 'Clinic Manager',    color: 'bg-[#E3F2FD] text-[#1565C0] border-[#90CAF9]' },
  { id: 'cf',  label: 'Clinic Finance',    color: 'bg-[#E0F7FA] text-[#00838F] border-[#80DEEA]' },
];

// ── Accordion section ─────────────────────────────────────────────────────────
function AccordionSection({ title, summary, open, onToggle, children }: {
  title: string; summary?: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border border-[#E0E0E6] rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAFAFA] transition-colors text-left"
      >
        <div>
          <p className="text-sm font-semibold text-[#030213]">{title}</p>
          {summary && !open && <p className="text-xs text-[#717182] mt-0.5">{summary}</p>}
        </div>
        <ChevronDown className={`w-4 h-4 text-[#A0A0B0] transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-[#F0EFF6]">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}

// ── New Rule Modal ────────────────────────────────────────────────────────────
function NewRuleModal({ onClose, onSave, rule }: { onClose: () => void; onSave: (rule: ApprovalRule) => void; rule?: ApprovalRule }) {
  const isEdit = !!rule;

  // Reverse-map tags → scopes
  const initScopes: string[] = rule ? [
    ...(rule.tags.some(t => t.label === 'CLINIC')    ? ['Clinic invoice']      : []),
    ...(rule.tags.some(t => t.label === 'GROUP HQ')  ? ['Group HQ invoice']    : []),
    ...(rule.tags.some(t => t.label === 'DENTIST')   ? ['Dentist invoice']     : []),
  ] : ['Clinic invoice'];

  const initSupplierType: 'Either' | 'Lab' | 'Non-Lab' = rule?.tags.some(t => t.label === 'LAB')
    ? 'Lab' : rule?.tags.some(t => t.label === 'NON-LAB') ? 'Non-Lab' : 'Either';

  // Reverse-map amountLabel → fire mode / amount fields
  let initFireMode: 'amount' | 'supplier' | 'both' = 'amount';
  let initAmountMode: 'above' | 'between' = 'above';
  let initAmountAbove = '';
  let initAmountFrom  = '';
  let initAmountTo    = '';
  if (rule) {
    if (rule.amountLabel === 'Specific suppliers') {
      initFireMode = 'supplier';
    } else {
      const aboveMatch   = rule.amountLabel.match(/Total > £([\d,]+)/);
      const betweenMatch = rule.amountLabel.match(/Total £([\d,.]+) – £([\d,.]+)/);
      if (aboveMatch)   { initAmountMode = 'above';   initAmountAbove = aboveMatch[1].replace(/,/g,''); }
      if (betweenMatch) { initAmountMode = 'between'; initAmountFrom  = betweenMatch[1].replace(/,/g,''); initAmountTo = betweenMatch[2].replace(/,/g,''); }
    }
  }

  // Reverse-map approvers → role IDs
  const initRoles = rule ? ALL_ROLES.filter(r => rule.approvers.some(a => a.label === r.label)).map(r => r.id) : [];

  const initApprovalType: 'auto' | 'single' | 'multi' = rule?.autoApprove ? 'auto'
    : (rule?.approvers?.length ?? 0) > 1 ? 'multi' : 'single';

  const [name, setName]                   = useState(rule?.title ?? '');
  const [desc, setDesc]                   = useState(rule?.description ?? '');
  const [scopes, setScopes]               = useState<string[]>(initScopes.length ? initScopes : ['Clinic invoice']);
  const [supplierType, setSupplierType]   = useState<'Either' | 'Lab' | 'Non-Lab'>(initSupplierType);
  const [fireMode, setFireMode]           = useState<'amount' | 'supplier' | 'both'>(initFireMode);
  const [amountMode, setAmountMode]       = useState<'above' | 'between'>(initAmountMode);
  const [amountAbove, setAmountAbove]     = useState(initAmountAbove);
  const [amountFrom, setAmountFrom]       = useState(initAmountFrom);
  const [amountTo, setAmountTo]           = useState(initAmountTo);
  const [approvalType, setApprovalType]   = useState<'auto' | 'single' | 'multi'>(initApprovalType);
  const [autoPush, setAutoPush]           = useState(true);
  const [completion, setCompletion]       = useState<'all' | 'any'>(rule?.anyOne ? 'any' : 'all');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(initRoles);
  const [rejectionReview, setRejectionReview] = useState(true);
  const [fallbackRoles, setFallbackRoles] = useState<string[]>([]);

  // Which accordion is open
  const [openSection, setOpenSection] = useState<string>('basics');
  function toggle(id: string) { setOpenSection(prev => prev === id ? '' : id); }

  function toggleScope(s: string) {
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }
  function toggleRole(id: string) {
    setSelectedRoles(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleFallback(id: string) {
    setFallbackRoles(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleCreate() {
    if (!name.trim()) return;
    const approvers = ALL_ROLES.filter(r => selectedRoles.includes(r.id)).map(r => ({ label: r.label, color: r.color }));
    const scopeTags = scopes.map(s => ({
      label: s === 'Clinic invoice' ? 'CLINIC' : s === 'Group HQ invoice' ? 'GROUP HQ' : 'DENTIST',
      color: APPROVAL_RULE_COLORS[s === 'Clinic invoice' ? 'CLINIC' : s === 'Group HQ invoice' ? 'GROUP HQ' : 'DENTIST'] ?? 'bg-[#F3F3F5] text-[#717182]',
    }));
    if (supplierType !== 'Either') scopeTags.push({ label: supplierType.toUpperCase(), color: APPROVAL_RULE_COLORS['LAB'] ?? 'bg-[#E8F5E9] text-[#2E7D32]' });
    if (completion === 'any' && approvers.length > 0) scopeTags.push({ label: 'ANY ONE', color: APPROVAL_RULE_COLORS['ANY ONE'] });
    if (approvalType === 'auto') scopeTags.push({ label: 'AUTO-APPROVE', color: APPROVAL_RULE_COLORS['AUTO-APPROVE'] });
    const amountLabel = amountMode === 'above'
      ? `Total > £${amountAbove || '0'}`
      : `Total £${amountFrom || '0'} – £${amountTo || '0'}`;
    onSave({
      id: rule?.id ?? `a_${Date.now()}`, title: name, description: desc,
      amountLabel: fireMode !== 'supplier' ? amountLabel : 'Specific suppliers',
      tags: scopeTags, approvers, anyOne: completion === 'any',
      autoApprove: approvalType === 'auto', enabled: rule?.enabled ?? true,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-7 pt-6 pb-4 border-b border-[#F0EFF6] flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[#030213]">{isEdit ? 'Edit approval rule' : 'New approval rule'}</h2>
            <p className="text-xs text-[#717182] mt-1 leading-relaxed max-w-lg">When an invoice matches every condition you set, the listed roles must all approve before it's released.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#A0A0B0] hover:text-[#030213] hover:bg-[#F0EFF6] rounded-lg transition-colors flex-shrink-0 ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-7 py-5 space-y-3">

          {/* 1 — Basics */}
          <AccordionSection title="Name & description" summary={name || 'Untitled rule'} open={openSection === 'basics'} onToggle={() => toggle('basics')}>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#030213] block mb-2">Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Standard clinic invoices"
                  className="w-full px-4 py-3 border border-[#E0E0E6] rounded-xl text-sm focus:outline-none focus:border-[#4D8EF7] text-[#030213] placeholder:text-[#D4CEE1]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#030213] block mb-2">Description <span className="font-normal text-[#A0A0B0]">(optional)</span></label>
                <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Clinic invoice £500 – £2,500"
                  className="w-full px-4 py-3 border border-[#E0E0E6] rounded-xl text-sm focus:outline-none focus:border-[#4D8EF7] text-[#030213] placeholder:text-[#D4CEE1]" />
              </div>
            </div>
          </AccordionSection>

          {/* 2 — Scope */}
          <AccordionSection
            title="Scope"
            summary={scopes.length ? scopes.join(' · ') : 'Not set'}
            open={openSection === 'scope'} onToggle={() => toggle('scope')}
          >
            <p className="text-xs text-[#717182] mb-4">Pick every routing this rule covers. A rule like "amount over £5,000" usually applies to all three.</p>
            <div className="grid grid-cols-3 gap-3">
              {['Clinic invoice', 'Group HQ invoice', 'Dentist invoice'].map(s => (
                <button key={s} onClick={() => toggleScope(s)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium border transition-all flex items-center justify-between gap-2 ${
                    scopes.includes(s) ? 'border-[#4D8EF7] bg-[#E8F0FE] text-[#4D8EF7]' : 'border-[#E0E0E6] text-[#5A5568] hover:bg-[#F8F9FC]'
                  }`}>
                  {s}
                  {scopes.includes(s) && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </AccordionSection>

          {/* 3 — Supplier type */}
          <AccordionSection
            title="Supplier type"
            summary={supplierType}
            open={openSection === 'supplier'} onToggle={() => toggle('supplier')}
          >
            <p className="text-xs text-[#717182] mb-4">Restrict this rule to lab suppliers (crowns, prosthetics, lab bureaus) or non-lab suppliers (everyone else). 'Either' covers both — useful for a Group QC fallback.</p>
            <div className="flex items-center gap-3">
              {(['Either', 'Lab', 'Non-Lab'] as const).map(t => (
                <button key={t} onClick={() => setSupplierType(t)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    supplierType === t ? 'border-[#4D8EF7] bg-[#E8F0FE] text-[#4D8EF7]' : 'border-[#E0E0E6] text-[#5A5568] hover:bg-[#F8F9FC]'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </AccordionSection>

          {/* 4 — When does this fire? */}
          <AccordionSection
            title="When does this fire?"
            summary={fireMode === 'amount' ? `By amount · ${amountMode === 'above' ? `Above £${amountAbove || '—'}` : `£${amountFrom || '—'} – £${amountTo || '—'}`}` : fireMode === 'supplier' ? 'By supplier' : 'Amount + supplier'}
            open={openSection === 'fire'} onToggle={() => toggle('fire')}
          >
            <p className="text-xs text-[#717182] mb-4">Pick whether the rule keys off invoice amount, a specific supplier, or both.</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { id: 'amount',   icon: <Layers className="w-5 h-5" />,   label: 'By amount',        sub: 'Total at or below £X' },
                { id: 'supplier', icon: <Building2 className="w-5 h-5" />, label: 'By supplier',      sub: 'From specific suppliers' },
                { id: 'both',     icon: <Users className="w-5 h-5" />,    label: 'Amount + supplier', sub: 'Both must match' },
              ].map(({ id, icon, label, sub }) => (
                <button key={id} onClick={() => setFireMode(id as typeof fireMode)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    fireMode === id ? 'border-[#4D8EF7] bg-[#E8F0FE]' : 'border-[#E0E0E6] hover:bg-[#F8F9FC]'
                  }`}>
                  <div className={`mb-2 ${fireMode === id ? 'text-[#4D8EF7]' : 'text-[#A0A0B0]'}`}>{icon}</div>
                  <p className={`text-sm font-semibold ${fireMode === id ? 'text-[#4D8EF7]' : 'text-[#030213]'}`}>{label}</p>
                  <p className="text-xs text-[#A0A0B0] mt-0.5">{sub}</p>
                </button>
              ))}
            </div>
            {(fireMode === 'amount' || fireMode === 'both') && (
              <div className="bg-[#F8F9FC] border border-[#E0E0E6] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  {['above', 'between'].map(m => (
                    <button key={m} onClick={() => setAmountMode(m as typeof amountMode)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        amountMode === m ? 'border-[#4D8EF7] bg-[#E8F0FE] text-[#4D8EF7]' : 'border-[#E0E0E6] bg-white text-[#5A5568]'
                      }`}>
                      {m === 'above' ? 'Above £X' : 'Between £X and £Y'}
                    </button>
                  ))}
                </div>
                {amountMode === 'above' ? (
                  <div>
                    <label className="text-xs text-[#717182] block mb-2">Apply when total is above (£)</label>
                    <input value={amountAbove} onChange={e => setAmountAbove(e.target.value)} placeholder="e.g. 2500"
                      className="w-full px-4 py-3 border border-[#E0E0E6] rounded-xl text-sm bg-white focus:outline-none focus:border-[#4D8EF7]" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#717182] block mb-2">From (£)</label>
                      <input value={amountFrom} onChange={e => setAmountFrom(e.target.value)} placeholder="e.g. 300"
                        className="w-full px-4 py-3 border border-[#E0E0E6] rounded-xl text-sm bg-white focus:outline-none focus:border-[#4D8EF7]" />
                    </div>
                    <div>
                      <label className="text-xs text-[#717182] block mb-2">To (£)</label>
                      <input value={amountTo} onChange={e => setAmountTo(e.target.value)} placeholder="e.g. 1500"
                        className="w-full px-4 py-3 border border-[#E0E0E6] rounded-xl text-sm bg-white focus:outline-none focus:border-[#4D8EF7]" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </AccordionSection>

          {/* 5 — Approval stage */}
          <AccordionSection
            title="Approval stage"
            summary={approvalType === 'auto' ? 'Auto-approve' : approvalType === 'single' ? `Single stage · ${selectedRoles.length} role${selectedRoles.length !== 1 ? 's' : ''}` : 'Multi-stage'}
            open={openSection === 'approval'} onToggle={() => toggle('approval')}
          >
            <p className="text-xs text-[#717182] mb-4">Pick who needs to sign off — or auto-approve without humans.</p>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { id: 'auto',   icon: <CheckCircle2 className="w-5 h-5" />, label: 'Auto-approve', sub: 'No human click — invoice released immediately.' },
                { id: 'single', icon: <UserCheck className="w-5 h-5" />,    label: 'Single stage', sub: 'One group of roles with any/all completion.' },
                { id: 'multi',  icon: <Layers className="w-5 h-5" />,       label: 'Multi-stage',  sub: 'Ordered chain — each stage opens after the prior.' },
              ].map(({ id, icon, label, sub }) => (
                <button key={id} onClick={() => setApprovalType(id as typeof approvalType)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    approvalType === id ? 'border-[#4D8EF7] bg-[#E8F0FE]' : 'border-[#E0E0E6] hover:bg-[#F8F9FC]'
                  }`}>
                  <div className={`mb-2 ${approvalType === id ? 'text-[#4D8EF7]' : 'text-[#A0A0B0]'}`}>{icon}</div>
                  <p className={`text-sm font-semibold ${approvalType === id ? 'text-[#4D8EF7]' : 'text-[#030213]'}`}>{label}</p>
                  <p className="text-xs text-[#A0A0B0] mt-0.5 leading-snug">{sub}</p>
                </button>
              ))}
            </div>

            {/* Auto-push */}
            <div className={`p-4 rounded-xl border flex items-start gap-3 mb-4 transition-colors ${autoPush ? 'border-[#4D8EF7]/40 bg-[#E8F0FE]/50' : 'border-[#E0E0E6]'}`}>
              <Toggle on={autoPush} onChange={setAutoPush} />
              <div>
                <p className="text-sm font-semibold text-[#4D8EF7]">Auto-push to accounting</p>
                <p className="text-xs text-[#717182] mt-0.5 leading-relaxed">
                  After the final approver signs off, the bill is pushed automatically to your connected accounting provider (Xero or QuickBooks).{' '}
                  <span className="text-[#4D8EF7] cursor-pointer hover:underline">Configure under Settings → Integrations</span>.
                </p>
              </div>
            </div>

            {approvalType !== 'auto' && (
              <div className="bg-[#F8F9FC] border border-[#E0E0E6] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  {[{ id: 'all', label: 'All must approve' }, { id: 'any', label: 'Any one approves' }].map(({ id, label }) => (
                    <button key={id} onClick={() => setCompletion(id as typeof completion)}
                      className={`px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                        completion === id ? 'border-[#4D8EF7] bg-[#E8F0FE] text-[#4D8EF7]' : 'border-[#E0E0E6] bg-white text-[#5A5568]'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#717182] mb-4">{completion === 'all' ? 'Every selected role must approve before release.' : 'Any one of the selected roles can approve to release.'}</p>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_ROLES.map(role => (
                    <button key={role.id} onClick={() => toggleRole(role.id)}
                      className={`px-4 py-2.5 rounded-full text-xs font-semibold border text-left transition-all ${
                        selectedRoles.includes(role.id) ? role.color : 'border-[#E0E0E6] bg-white text-[#A0A0B0] hover:bg-[#F8F9FC]'
                      }`}>
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </AccordionSection>

          {/* 6 — Rejection review */}
          <AccordionSection
            title="Rejection review"
            summary={rejectionReview ? `Enabled · ${fallbackRoles.length} fallback reviewer${fallbackRoles.length !== 1 ? 's' : ''}` : 'Disabled — rejects terminate immediately'}
            open={openSection === 'rejection'} onToggle={() => toggle('rejection')}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <p className="text-xs text-[#717182] leading-relaxed">
                When on, an approver's reject opens a review — a configured reviewer confirms, overturns, override-approves, or converts to a dispute. When off, rejects terminate immediately regardless of the tenant-wide setting.
              </p>
              <Toggle on={rejectionReview} onChange={setRejectionReview} />
            </div>

            {rejectionReview && (
              <div className="bg-[#F8F9FC] border border-[#E0E0E6] rounded-xl p-4">
                <p className="text-xs text-[#A0A0B0] mb-3">
                  No routing rows — rejections fall through to fallback / tenant default.{' '}
                  <button className="text-[#4D8EF7] hover:underline font-medium">+ Add row</button>
                </p>
                <p className="text-xs font-semibold text-[#5A5568] mb-3">
                  Fallback reviewer <span className="font-normal text-[#A0A0B0]">(used when no row above matches)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_ROLES.map(role => (
                    <button key={role.id} onClick={() => toggleFallback(role.id)}
                      className={`px-4 py-2.5 rounded-full text-xs font-semibold border text-left transition-all ${
                        fallbackRoles.includes(role.id) ? role.color : 'border-[#E0E0E6] bg-white text-[#A0A0B0] hover:bg-[#F8F9FC]'
                      }`}>
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </AccordionSection>

        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-[#F0EFF6] flex items-center justify-end gap-3 flex-shrink-0 bg-[#FAFBFC] rounded-b-2xl">
          <button onClick={onClose} className="flex items-center gap-1.5 px-5 py-2.5 border border-[#E0E0E6] text-sm font-medium text-[#717182] rounded-xl hover:bg-white transition-colors">
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {isEdit ? 'Save changes' : 'Create rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Approval Workflow Tab ─────────────────────────────────────────────────────
function ApprovalWorkflowTab() {
  const [rules, setRules] = useState<ApprovalRule[]>(INITIAL_APPROVAL_RULES);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);

  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
      <div className="p-5 border-b border-[#F0EFF6] flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F3F3F5] flex items-center justify-center flex-shrink-0">
            <GitMerge className="w-5 h-5 text-[#030213]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#030213]">Approval workflow</h3>
            <p className="text-xs text-[#717182] mt-0.5 max-w-lg">Define who must approve invoices based on amount, scope, and supplier. The most-specific matching rule wins; all required approvers must click through before the invoice is released.</p>
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> New rule
        </button>
      </div>

      <div className="divide-y divide-[#F8F9FC]">
        {rules.map(rule => (
          <div key={rule.id} className="p-5 hover:bg-[#FAFBFC] transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-[#030213]">{rule.title}</p>
                  {rule.tags.map(t => (
                    <span key={t.label} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${t.color}`}>{t.label}</span>
                  ))}
                </div>
                <p className="text-xs text-[#717182] mb-2">{rule.description}</p>
                <p className="text-xs text-[#A0A0B0] mb-2">{rule.amountLabel}</p>
                {rule.autoApprove ? (
                  <p className="text-xs text-[#2E7D32] italic">Auto-approves with no human click — used for low-risk tiers.</p>
                ) : rule.approvers.length > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-[#A0A0B0] uppercase tracking-wider font-semibold">{rule.anyOne ? 'Any one of' : 'Required'}</span>
                    {rule.approvers.map(a => (
                      <span key={a.label} className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${a.color}`}>{a.label}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Toggle on={rule.enabled} onChange={v => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: v } : r))} />
                <button onClick={() => setEditingRule(rule)} className="p-1.5 text-[#A0A0B0] hover:text-[#030213] hover:bg-[#F0EFF6] rounded-lg transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setRules(prev => prev.filter(r => r.id !== rule.id))} className="p-1.5 text-[#A0A0B0] hover:text-[#C62828] hover:bg-[#FFEBEE] rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <NewRuleModal
          onClose={() => setModalOpen(false)}
          onSave={r => { setRules(prev => [r, ...prev]); setModalOpen(false); }}
        />
      )}
      {editingRule && (
        <NewRuleModal
          rule={editingRule}
          onClose={() => setEditingRule(null)}
          onSave={r => { setRules(prev => prev.map(x => x.id === r.id ? r : x)); setEditingRule(null); }}
        />
      )}
    </div>
  );
}

// ── PO Matching Tab ───────────────────────────────────────────────────────────
// Two policy toggles that decide whether Smile Genius enforces purchase-order
// matching for (a) lab invoices and (b) everything else. When enabled, the
// invoice pipeline will block an item from leaving QC until an approved PO
// with matching supplier / lines / amount is attached.
function POMatchingTab() {
  const [enforceLab, setEnforceLab] = useState(true);
  const [enforceOther, setEnforceOther] = useState(false);
  const { toast } = useToast();

  const handleEnforceLab = (v: boolean) => {
    setEnforceLab(v);
    toast.success(`PO matching for lab invoices ${v ? 'enabled' : 'disabled'}`);
  };
  const handleEnforceOther = (v: boolean) => {
    setEnforceOther(v);
    toast.success(`PO matching for non-lab invoices ${v ? 'enabled' : 'disabled'}`);
  };

  // Toggle card — mirrors the visual rhythm used in RAG Scoring and Approval
  // Workflow tabs (icon tile + title + description + Toggle on the right).
  type Card = {
    icon: React.ReactNode;
    tone: 'lab' | 'other';
    title: string;
    description: string;
    examples: string[];
    on: boolean;
    onChange: (v: boolean) => void;
  };
  const CARDS: Card[] = [
    {
      icon: <Beaker className="w-5 h-5 text-[#1565C0]" />,
      tone: 'lab',
      title: 'Enforce PO matching for Lab invoices',
      description: 'Lab invoices (crowns, dentures, aligners, implants) must reference a valid open PO with matching supplier, line items, and amount.',
      examples: ['Crowns', 'Dentures', 'Aligners', 'Implants'],
      on: enforceLab,
      onChange: handleEnforceLab,
    },
    {
      icon: <Package className="w-5 h-5 text-[#7C3AED]" />,
      tone: 'other',
      title: 'Enforce PO matching for other non-lab invoices',
      description: 'Consumables, equipment, and service invoices must reference an approved PO. Useful for tighter spend control across non-lab procurement.',
      examples: ['Consumables', 'Equipment', 'Services'],
      on: enforceOther,
      onChange: handleEnforceOther,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F3F3F5] flex items-center justify-center flex-shrink-0">
            <Link2 className="w-5 h-5 text-[#030213]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[#030213]">Purchase order matching</h3>
            <p className="text-xs text-[#717182] mt-0.5 max-w-2xl">
              Decide which invoice categories must be backed by an open purchase order before they move past QC. Enforced invoices that don't match a PO are flagged for review and cannot be exported.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
            <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">Policies active</span>
            <span className="text-base font-bold text-[#030213] tabular-nums">{[enforceLab, enforceOther].filter(Boolean).length}<span className="text-sm text-[#A0A0B0] font-medium">/2</span></span>
          </div>
        </div>
      </div>

      {/* Policy toggle cards */}
      <div className="grid gap-3 md:grid-cols-2">
        {CARDS.map(card => (
          <div
            key={card.title}
            className={`relative bg-white border rounded-xl p-5 transition-colors ${
              card.on ? 'border-[#BFDBFE] shadow-[0_1px_2px_rgba(77,142,247,0.06)]' : 'border-[#E0E0E6]'
            }`}
          >
            {/* Active ribbon */}
            {card.on && (
              <span className="absolute top-0 left-5 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EEF4FF] border border-[#BFDBFE] text-[9px] font-bold uppercase tracking-wider text-[#1565C0]">
                <span className="w-1 h-1 rounded-full bg-[#4D8EF7] animate-pulse" />
                Enforced
              </span>
            )}
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                card.tone === 'lab' ? 'bg-[#EEF4FF]' : 'bg-[#F3EEFF]'
              }`}>
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-[#030213] leading-snug">{card.title}</h4>
                <p className="text-xs text-[#717182] mt-1 leading-relaxed">{card.description}</p>
              </div>
              <Toggle on={card.on} onChange={card.onChange} />
            </div>
            {/* Example chips */}
            <div className="pl-[52px] flex flex-wrap gap-1.5">
              {card.examples.map(ex => (
                <span
                  key={ex}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    card.tone === 'lab'
                      ? 'bg-[#EEF4FF] text-[#1565C0] border border-[#BFDBFE]'
                      : 'bg-[#F3EEFF] text-[#5B21B6] border border-[#DDD6FE]'
                  }`}
                >
                  {ex}
                </span>
              ))}
            </div>
            {/* Behaviour line — what happens when on/off */}
            <div className="mt-3 pt-3 border-t border-[#F0EFF6] pl-[52px] flex items-start gap-2">
              {card.on ? (
                <>
                  <ClipboardCheck className="w-3.5 h-3.5 text-[#2E7D32] mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-[#5A5568] leading-snug">
                    Invoices without a matching PO are <span className="font-semibold text-[#C62828]">held in QC</span> and cannot be exported.
                  </p>
                </>
              ) : (
                <>
                  <Info className="w-3.5 h-3.5 text-[#A0A0B0] mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-[#A0A0B0] italic leading-snug">
                    PO match is optional — invoices flow through the normal pipeline.
                  </p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Note row */}
      <div className="bg-[#F8F9FC] border border-[#E8EAF6] rounded-xl px-4 py-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-[#4D8EF7] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-[#5A5568] leading-relaxed">
          PO matching uses the supplier, line-item description, and the invoice total. Tolerances are configured per supplier on the Supplier Detail page. Disabled categories skip the PO check entirely but still run through RAG scoring and Rules Engine.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Accounting Integration tab — two sub-tabs:
//   1. Nominal Codes — CSV upload + editable Code/Name table
//   2. Integrations — Xero / QuickBooks / Sage connectors (Coming soon)
// ─────────────────────────────────────────────────────────────────────────────
interface NominalRow { id: string; code: string; name: string }

function AccountingIntegrationTab() {
  const { toast } = useToast();
  type SubTab = 'codes' | 'connectors';
  const [sub, setSub] = useState<SubTab>('codes');

  // Seed with the canonical GL_ACCOUNTS so users see realistic rows on first load.
  const [rows, setRows] = useState<NominalRow[]>(() => GL_ACCOUNTS.map((g, i) => ({
    id: `gl-${i}`, code: g.code, name: g.nominalName,
  })));

  // ── Accounting connector state ──────────────────────────────────────────
  // Single-provider lock: only ONE accounting system can be live at a time
  // (Xero or QuickBooks). The connect flow walks through a realistic OAuth
  // popup (login → 2FA → authorise → tenant pick) before our app's mapping
  // and first-sync steps.
  type Provider = 'xero' | 'quickbooks' | 'sage';
  type ConnStep =
    | 'idle'
    | 'opening'         // "Opening secure window…"
    | 'popup-login'     // popup screen: provider sign-in
    | 'popup-2fa'       // popup screen: 6-digit code
    | 'popup-consent'   // popup screen: authorise SmileGenius
    | 'org'             // app: pick tenant/company
    | 'mapping'         // app: review mapping
    | 'syncing'         // app: first sync spinner
    | 'connected';      // app: connected state
  const [conn, setConn] = useState<{
    provider: Provider | null;
    step: ConnStep;
    org: string | null;
    lastSync: string | null;
    syncing: boolean;
  }>({ provider: null, step: 'idle', org: null, lastSync: null, syncing: false });

  // Dummy credentials pre-filled so reviewers can click through quickly
  const [oauthEmail, setOauthEmail] = useState('sajid.zahid@smilegenius.co.uk');
  const [oauthPassword, setOauthPassword] = useState('demo-password-2026');
  const [oauthCode, setOauthCode] = useState('482 913');

  const PROVIDER_INFO: Record<Provider, {
    name: string;
    color: string;
    badgeBg: string;
    badgeFg: string;
    short: string;
    orgs: string[];
    available: boolean;
  }> = {
    xero: {
      name: 'Xero',
      color: '#13B5EA',
      badgeBg: '#E0F4FB',
      badgeFg: '#0F8FBC',
      short: 'XERO',
      orgs: ['Smile Genius Group · GB', 'Smile Genius Manchester · GB', 'Smile Genius Ireland · IE'],
      available: true,
    },
    quickbooks: {
      name: 'QuickBooks',
      color: '#2CA01C',
      badgeBg: '#E0F5DD',
      badgeFg: '#1F7F14',
      short: 'QB',
      orgs: ['Smile Genius Holdings Ltd', 'Smile Genius Practice Group'],
      available: true,
    },
    sage: {
      name: 'Sage',
      color: '#00DC00',
      badgeBg: '#E0FAE0',
      badgeFg: '#0F8B0F',
      short: 'SAGE',
      orgs: [],
      available: false,
    },
  };

  // Start the OAuth-style flow. Single-provider lock: blocks if another
  // provider is already live.
  function startConnect(provider: Provider) {
    if (conn.provider && conn.step === 'connected' && conn.provider !== provider) {
      toast.error?.(`Disconnect ${PROVIDER_INFO[conn.provider].name} first to connect a different provider.`)
        ?? toast.success(`Disconnect ${PROVIDER_INFO[conn.provider].name} first.`);
      return;
    }
    setConn(s => ({ ...s, provider, step: 'opening' }));
    // Brief "opening popup" beat → then drop into the simulated login screen
    setTimeout(() => setConn(s => ({ ...s, step: 'popup-login' })), 650);
  }
  function cancelConnect() {
    setConn(s => ({ ...s, step: 'idle', provider: null }));
  }
  function submitLogin() {
    // Xero adds a 2FA step; QuickBooks goes straight to consent
    setConn(s => ({ ...s, step: s.provider === 'xero' ? 'popup-2fa' : 'popup-consent' }));
  }
  function submit2fa() {
    setConn(s => ({ ...s, step: 'popup-consent' }));
  }
  function approveConsent() {
    setConn(s => ({ ...s, step: 'org' }));
  }
  function selectOrg(org: string) {
    setConn(s => ({ ...s, org, step: 'mapping' }));
  }
  function confirmMapping() {
    setConn(s => ({ ...s, step: 'syncing', syncing: true }));
    // Simulate first-sync work
    setTimeout(() => {
      setConn(s => ({
        ...s,
        step: 'connected',
        syncing: false,
        lastSync: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      }));
      toast.success(`${conn.provider ? PROVIDER_INFO[conn.provider].name : 'Provider'} connected · GL codes synced`);
    }, 1500);
  }
  function disconnect() {
    setConn({ provider: null, step: 'idle', org: null, lastSync: null, syncing: false });
    toast.success('Connector disconnected');
  }
  function manualSync() {
    setConn(s => ({ ...s, syncing: true }));
    setTimeout(() => {
      setConn(s => ({
        ...s,
        syncing: false,
        lastSync: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      }));
      toast.success('Synced from accounting system');
    }, 1100);
  }

  // Import preview / merge-or-replace flow
  const [importPreview, setImportPreview] = useState<{ rows: NominalRow[]; fileName: string } | null>(null);

  function updateRow(id: string, patch: Partial<NominalRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }
  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
  }
  function addRow() {
    setRows(prev => [...prev, { id: `gl-${Date.now()}`, code: '', name: '' }]);
  }

  // CSV parser — accepts "Code,Name" header and any number of rows.
  // Instead of immediately overwriting, opens a preview modal so the user can
  // confirm the parse and choose Merge vs Replace when rows already exist.
  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? '');
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        toast.error?.('CSV looks empty') ?? toast.success('CSV looks empty');
        return;
      }
      const start = /code/i.test(lines[0]) && /name/i.test(lines[0]) ? 1 : 0;
      const parsed: NominalRow[] = [];
      for (let i = start; i < lines.length; i++) {
        const m = lines[i].match(/^("[^"]*"|[^,]*),(.*)$/);
        if (!m) continue;
        const code = m[1].replace(/^"|"$/g, '').trim();
        const name = (m[2] ?? '').replace(/^"|"$/g, '').trim();
        if (code || name) parsed.push({ id: `gl-import-${i}-${Date.now()}`, code, name });
      }
      if (parsed.length === 0) {
        toast.error?.('No valid rows found in CSV') ?? toast.success('No valid rows found in CSV');
        return;
      }
      setImportPreview({ rows: parsed, fileName: file.name });
    };
    reader.readAsText(file);
  }

  function applyImport(mode: 'merge' | 'replace') {
    if (!importPreview) return;
    const incoming = importPreview.rows;
    if (mode === 'replace') {
      setRows(incoming);
      toast.success(`Replaced — loaded ${incoming.length} GL code${incoming.length === 1 ? '' : 's'} from ${importPreview.fileName}`);
    } else {
      // Merge — update existing codes with the same number, append new ones.
      setRows((prev) => {
        const byCode = new Map(prev.map((r) => [r.code.toLowerCase(), r]));
        let updated = 0;
        let added = 0;
        for (const inc of incoming) {
          const key = inc.code.toLowerCase();
          if (byCode.has(key)) {
            const existing = byCode.get(key)!;
            existing.name = inc.name || existing.name;
            updated++;
          } else {
            byCode.set(key, inc);
            added++;
          }
        }
        const result = Array.from(byCode.values());
        toast.success(`Merged — ${added} added, ${updated} updated from ${importPreview.fileName}`);
        return result;
      });
    }
    setImportPreview(null);
  }

  function downloadTemplate() {
    const csv = 'Code,Name\n2410,Materials_Purchases\n3240,Gas\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nominal-codes-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Sub-tab nav — matches the gradient pill style used in Invoice Setup */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-[#F3F3F5] rounded-xl">
        {([
          { id: 'codes',      label: 'GL Codes', icon: <FileCheck className="w-3.5 h-3.5" /> },
          { id: 'connectors', label: 'Integrations',  icon: <Plug className="w-3.5 h-3.5" /> },
        ] as { id: SubTab; label: string; icon: React.ReactNode }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              sub === t.id
                ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white shadow-sm'
                : 'text-[#717182] hover:text-[#030213] hover:bg-white/60'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'codes' && (
        <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F0EFF6] flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-[#030213]">GL Code / GL Name</h2>
              <p className="text-xs text-[#717182] mt-0.5">
                The chart of accounts you map suppliers and invoices to. Upload a CSV with <span className="font-medium text-[#5A5568]">Code, Name</span> columns or edit rows inline.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#5A5568] border border-[#E0E0E6] rounded-lg hover:bg-[#F8F9FC] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                CSV template
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] rounded-lg hover:opacity-90 transition-opacity cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          {/* Editable table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8F9FC] border-b border-[#F0EFF6]">
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[#717182] uppercase tracking-widest w-[180px]">Code</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[#717182] uppercase tracking-widest">GL name</th>
                  <th className="w-12 px-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EFF6]">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-[#FAFBFF] transition-colors">
                    <td className="px-4 py-2">
                      <input
                        value={r.code}
                        onChange={e => updateRow(r.id, { code: e.target.value })}
                        placeholder="e.g. 2410"
                        className="w-full px-2 py-1.5 text-sm border border-transparent hover:border-[#E0E0E6] focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20 rounded outline-none bg-transparent focus:bg-white tabular-nums"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={r.name}
                        onChange={e => updateRow(r.id, { name: e.target.value })}
                        placeholder="e.g. Materials_Purchases"
                        className="w-full px-2 py-1.5 text-sm border border-transparent hover:border-[#E0E0E6] focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20 rounded outline-none bg-transparent focus:bg-white"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => removeRow(r.id)}
                        title="Remove row"
                        className="p-1.5 text-[#A0A0B0] hover:text-[#C62828] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-[#A0A0B0]">
                      No GL codes yet. Upload a CSV or click <span className="font-semibold text-[#4D8EF7]">+ Add row</span> below to start.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-3 border-t border-[#F0EFF6] flex items-center justify-between flex-wrap gap-3">
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4D8EF7] hover:text-[#3578E5] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add row
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#717182]">{rows.length} {rows.length === 1 ? 'code' : 'codes'}</span>
              <button
                onClick={() => toast.success(`Saved ${rows.length} nominal ${rows.length === 1 ? 'code' : 'codes'}`)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] rounded-lg hover:opacity-90 transition-opacity"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {sub === 'connectors' && (
        <div className="space-y-5">
          {/* ── Pinned single-provider notice — always visible at the top.
              When connected: green "X is currently linked" + sync info.
              When not connected: neutral lock explaining the rule. */}
          {conn.step === 'connected' && conn.provider ? (
            <div className="bg-gradient-to-r from-[#E8F5E9] via-[#F0FDF4] to-white border border-[#BBF7D0] rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs" style={{ background: PROVIDER_INFO[conn.provider].color }}>
                  {PROVIDER_INFO[conn.provider].short}
                </div>
                {/* Push-pin badge to visualise "this provider is currently pinned/active" */}
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#15803D] flex items-center justify-center shadow-md">
                  <Check className="w-3 h-3 text-white" strokeWidth={3.5} />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#15803D]">
                  {PROVIDER_INFO[conn.provider].name} is currently linked
                </p>
                <p className="text-[11px] text-[#5A5568]">
                  Only one accounting connector can be active at a time. Disconnect {PROVIDER_INFO[conn.provider].name} below to switch to another provider.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#FAFBFF] border border-dashed border-[#D4CEE1] rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-[#4D8EF7]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#030213]">Single-provider mode</p>
                <p className="text-[11px] text-[#717182] mt-0.5">
                  You can connect to <span className="font-semibold text-[#030213]">Xero</span> <span className="text-[#A0A0B0]">or</span> <span className="font-semibold text-[#030213]">QuickBooks</span> — one at a time. Picking the second one will lock the first until you disconnect.
                </p>
              </div>
            </div>
          )}

          {/* ── Detailed connected state card with KPI tiles ── */}
          {conn.step === 'connected' && conn.provider && (
            <div className="bg-white border border-[#BBF7D0] rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#F0FDF4] bg-[#F0FDF4] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs" style={{ background: PROVIDER_INFO[conn.provider].color }}>
                    {PROVIDER_INFO[conn.provider].short}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#030213]">{PROVIDER_INFO[conn.provider].name} connected</h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#15803D]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] animate-pulse" />
                        Live
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5A5568] mt-0.5">{conn.org} · Last sync {conn.lastSync ?? 'just now'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={manualSync}
                    disabled={conn.syncing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#E0E0E6] text-[#5A5568] rounded-lg hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-wait"
                  >
                    {conn.syncing ? (
                      <span className="w-3 h-3 rounded-full border-2 border-[#E0E0E6] border-t-[#4D8EF7] animate-spin" />
                    ) : (
                      <CornerDownRight className="w-3.5 h-3.5 rotate-180" />
                    )}
                    {conn.syncing ? 'Syncing…' : 'Sync now'}
                  </button>
                  <button onClick={disconnect} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#C62828] hover:bg-[#FFEBEE] border border-transparent hover:border-[#FECACA] rounded-lg transition-colors">
                    <X className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                </div>
              </div>
              <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border border-[#F0EFF6] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-[#A0A0B0] font-semibold">GL Codes</p>
                  <p className="text-sm font-semibold text-[#030213] mt-0.5">17 mapped</p>
                  <p className="text-[10px] text-[#717182] mt-0.5">All categories synced</p>
                </div>
                <div className="rounded-lg border border-[#F0EFF6] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-[#A0A0B0] font-semibold">Suppliers</p>
                  <p className="text-sm font-semibold text-[#030213] mt-0.5">13 linked</p>
                  <p className="text-[10px] text-[#717182] mt-0.5">By vendor ID</p>
                </div>
                <div className="rounded-lg border border-[#F0EFF6] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-[#A0A0B0] font-semibold">Auto-export</p>
                  <p className="text-sm font-semibold text-[#030213] mt-0.5">Enabled</p>
                  <p className="text-[10px] text-[#717182] mt-0.5">On invoice approval</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Provider list ── */}
          <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#F0EFF6]">
              <h2 className="text-base font-semibold text-[#030213]">Accounting connectors</h2>
              <p className="text-xs text-[#717182] mt-0.5">
                One connector is active at a time. Approved invoices are exported automatically to the connected accounting system.
              </p>
            </div>
            <div className="divide-y divide-[#F0EFF6]">
              {(['xero', 'quickbooks', 'sage'] as Provider[]).map(key => {
                const p = PROVIDER_INFO[key];
                const isConnected = conn.step === 'connected' && conn.provider === key;
                const otherConnected = conn.step === 'connected' && conn.provider && conn.provider !== key;
                return (
                  <div key={key} className="px-6 py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs flex-shrink-0" style={{ background: p.available ? p.color : '#A0A0B0' }}>
                        {p.short}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#030213]">{p.name}</p>
                          {isConnected && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#DCFCE7] text-[#15803D]">
                              <Check className="w-2.5 h-2.5" />
                              Connected
                            </span>
                          )}
                          {!p.available && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[#F3F3F5] text-[#A0A0B0]">Coming soon</span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#717182] mt-0.5 truncate">
                          {isConnected
                            ? `${conn.org} · synced ${conn.lastSync}`
                            : key === 'xero'      ? 'OAuth via Xero · supports multi-tenant orgs'
                            : key === 'quickbooks'? 'OAuth via Intuit · single-company QBO accounts'
                            :                       'OAuth via Sage Business Cloud'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isConnected ? (
                        <button onClick={disconnect} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#FECACA] text-[#C62828] hover:bg-[#FFF8F8] rounded-lg transition-colors">
                          Disconnect
                        </button>
                      ) : otherConnected ? (
                        // Locked button — single-provider rule. The "group/lock" Tailwind
                        // peer is the wrapper, so the explainer popover only appears
                        // when this specific row is hovered (not other locked rows).
                        <div className="relative group/lock">
                          <button
                            disabled
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F3F3F5] text-[#A0A0B0] cursor-not-allowed border border-[#E0E0E6]"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            Locked
                          </button>
                          {/* Custom dark popover so the explanation is actually readable
                              (browser-native title tooltips are tiny and slow). */}
                          <div className="absolute right-0 top-full mt-2 w-64 bg-[#030213] text-white text-[11px] leading-relaxed rounded-lg shadow-xl px-3 py-2 z-30 opacity-0 group-hover/lock:opacity-100 pointer-events-none transition-opacity">
                            <div className="flex items-start gap-2">
                              <Shield className="w-3 h-3 text-[#A59DFF] flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-semibold text-white">Only one connector can be active</p>
                                <p className="text-[#D4CEE1] mt-0.5">
                                  Disconnect <span className="font-semibold text-white">{PROVIDER_INFO[conn.provider!].name}</span> to switch to <span className="font-semibold text-white">{p.name}</span>.
                                </p>
                              </div>
                            </div>
                            {/* Tiny pointer triangle at the top */}
                            <span className="absolute -top-1 right-4 w-2 h-2 rotate-45 bg-[#030213]" />
                          </div>
                        </div>
                      ) : !p.available ? (
                        <button
                          disabled
                          title="Coming soon"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F3F3F5] text-[#A0A0B0] cursor-not-allowed border border-[#E0E0E6]"
                        >
                          <Plug className="w-3.5 h-3.5" />
                          Coming soon
                        </button>
                      ) : (
                        <button
                          onClick={() => startConnect(key)}
                          title={`Connect ${p.name}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-opacity bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white hover:opacity-90"
                        >
                          <Plug className="w-3.5 h-3.5" />
                          Connect
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-3 border-t border-[#F0EFF6] bg-[#FAFBFF] flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-[#4D8EF7] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#717182] leading-relaxed">
                We use read-only OAuth for first sync and then write-back permission only for new invoice exports. You can disconnect at any time — historical data stays in this portal.
              </p>
            </div>
          </div>

          {/* ── Connect workflow ──
              "Opening / popup-login / popup-2fa / popup-consent" steps render as
              a faux browser window simulating real OAuth (Xero or Intuit hosted
              login). After consent the popup "closes" and we drop back into our
              own app UI for tenant pick → mapping → sync. */}
          {conn.step !== 'idle' && conn.step !== 'connected' && conn.provider && (() => {
            const p = PROVIDER_INFO[conn.provider];
            const isPopup = conn.step === 'opening' || conn.step === 'popup-login' || conn.step === 'popup-2fa' || conn.step === 'popup-consent';
            const popupUrl = conn.provider === 'xero'
              ? (conn.step === 'popup-login' ? 'https://login.xero.com/identity/connect/login'
                : conn.step === 'popup-2fa'   ? 'https://login.xero.com/identity/two-step'
                :                                'https://login.xero.com/identity/connect/authorize')
              : (conn.step === 'popup-login' ? 'https://accounts.intuit.com/Account/sign-in'
                : conn.step === 'popup-2fa'   ? 'https://accounts.intuit.com/auth/multi-factor'
                :                                'https://appcenter.intuit.com/connect/oauth2');
            return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40" onClick={cancelConnect} />

              {/* ─── In-app modal (org / mapping / syncing) ─── */}
              {!isPopup && (
                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[88vh] flex flex-col overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#F0EFF6] flex items-center gap-3" style={{ background: p.badgeBg }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs flex-shrink-0" style={{ background: p.color }}>
                      {p.short}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-[#030213]">Connect {p.name}</h3>
                      <p className="text-[11px] mt-0.5" style={{ color: p.badgeFg }}>
                        {conn.step === 'org' ? 'Step 3 of 4 · Choose organisation'
                        : conn.step === 'mapping' ? 'Step 4 of 4 · Review mapping'
                        : 'Step 4 of 4 · First sync'}
                      </p>
                    </div>
                    <button onClick={cancelConnect} className="w-7 h-7 rounded-lg hover:bg-white/40 flex items-center justify-center text-[#5A5568]">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 py-2 bg-white border-b border-[#F0EFF6]">
                    {(['login', 'consent', 'org', 'mapping/syncing'] as const).map((label, i) => {
                      const reached = (label === 'login') || (label === 'consent') || (label === 'org' && (conn.step === 'org' || conn.step === 'mapping' || conn.step === 'syncing')) || (label === 'mapping/syncing' && (conn.step === 'mapping' || conn.step === 'syncing'));
                      const active = (label === 'org' && conn.step === 'org') || (label === 'mapping/syncing' && (conn.step === 'mapping' || conn.step === 'syncing'));
                      return (
                        <span key={i} className={`h-1 rounded-full transition-all ${active ? 'w-6 bg-[#4D8EF7]' : reached ? 'w-2 bg-[#4D8EF7]' : 'w-2 bg-[#E0E0E6]'}`} />
                      );
                    })}
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    {conn.step === 'org' && (
                      <>
                        <p className="text-sm font-semibold text-[#030213] mb-1">Pick which {p.name} {conn.provider === 'xero' ? 'tenant' : 'company'} to link</p>
                        <p className="text-[11px] text-[#717182] mb-3">SmileGenius will sync only the selected org.</p>
                        <div className="space-y-2">
                          {p.orgs.map(org => (
                            <button key={org} onClick={() => selectOrg(org)} className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-[#E0E0E6] hover:border-[#4D8EF7] hover:bg-[#F8FBFF] transition-colors text-left">
                              <div className="flex items-center gap-2 min-w-0">
                                <Building2 className="w-4 h-4 text-[#717182] flex-shrink-0" />
                                <span className="text-xs font-medium text-[#030213] truncate">{org}</span>
                              </div>
                              <CornerDownRight className="w-3.5 h-3.5 text-[#A0A0B0] flex-shrink-0 -rotate-90" />
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {conn.step === 'mapping' && (
                      <>
                        <p className="text-sm font-semibold text-[#030213] mb-1">Review mapping for {conn.org}</p>
                        <p className="text-[11px] text-[#717182] mb-3">SmileGenius will sync the categories below into {p.name} GL codes. You can edit any mapping after connecting.</p>
                        <div className="rounded-lg border border-[#F0EFF6] overflow-hidden">
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3 py-2 bg-[#F8F9FC] text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0]">
                            <span>SmileGenius category</span>
                            <span className="px-3"> </span>
                            <span className="text-right">{p.name} GL code</span>
                          </div>
                          {[
                            { cat: 'Clinical',          code: '2410 · Materials_Purchases' },
                            { cat: 'Dental Labs',       code: '2520 · Lab Costs_Private' },
                            { cat: 'Equipment',         code: '3620 · Equipment R&M' },
                            { cat: 'Implant Suppliers', code: '2520 · Lab Costs_Private' },
                            { cat: 'Software',          code: '3430 · IT Consumables' },
                          ].map(m => (
                            <div key={m.cat} className="grid grid-cols-[1fr_auto_1fr] items-center px-3 py-2 border-t border-[#F0EFF6] text-xs">
                              <span className="text-[#030213]">{m.cat}</span>
                              <span className="px-3 text-[#D4CEE1]"><CornerDownRight className="w-3 h-3 -rotate-90" /></span>
                              <span className="text-right font-mono text-[11px] text-[#5A5568]">{m.code}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {conn.step === 'syncing' && (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="w-12 h-12 rounded-full border-4 border-[#EEF4FF] border-t-[#4D8EF7] animate-spin mb-4" />
                        <p className="text-sm font-semibold text-[#030213]">Performing first sync…</p>
                        <p className="text-[11px] text-[#717182] mt-1">Importing GL codes, suppliers, and current AP register from {p.name}.</p>
                      </div>
                    )}
                  </div>
                  <div className="px-6 py-3 border-t border-[#F0EFF6] flex items-center justify-between gap-2 bg-[#FAFBFF]">
                    {conn.step !== 'syncing' ? (
                      <>
                        <button onClick={cancelConnect} className="px-3 py-1.5 text-xs font-medium text-[#5A5568] hover:bg-white border border-transparent hover:border-[#E0E0E6] rounded-lg transition-colors">Cancel</button>
                        {conn.step === 'mapping' && (
                          <button onClick={confirmMapping} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 rounded-lg transition-opacity">
                            Looks good · Sync now
                            <CornerDownRight className="w-3.5 h-3.5 rotate-180" />
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-[#A0A0B0] mx-auto">Please don't close this window.</span>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Simulated popup window (login / 2fa / consent) ─── */}
              {isPopup && (
                <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#D4CEE1] flex flex-col">
                  {/* Faux browser chrome */}
                  <div className="bg-[#F3F3F5] border-b border-[#E0E0E6] px-3 py-2 flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                      <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                      <span className="w-3 h-3 rounded-full bg-[#28C840]" />
                    </div>
                    <div className="flex-1 mx-2 px-3 py-1 bg-white border border-[#E0E0E6] rounded-md flex items-center gap-2 min-w-0">
                      <Shield className="w-3 h-3 text-[#15803D] flex-shrink-0" />
                      <span className="text-[10px] font-mono text-[#5A5568] truncate">{popupUrl}</span>
                    </div>
                    <button onClick={cancelConnect} title="Close window" className="w-6 h-6 rounded hover:bg-[#E8E8EC] flex items-center justify-center text-[#717182]">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Provider brand bar inside the popup */}
                  <div className="px-6 py-4 border-b border-[#F0EFF6]" style={{ background: conn.provider === 'xero' ? '#FFFFFF' : '#FFFFFF' }}>
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-xs flex-shrink-0" style={{ background: p.color }}>
                        {p.short}
                      </div>
                      <span className="text-lg font-semibold" style={{ color: p.color }}>{p.name}</span>
                    </div>
                  </div>

                  {/* Popup body */}
                  <div className="flex-1 px-6 py-6">
                    {conn.step === 'opening' && (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="w-10 h-10 rounded-full border-3 border-[#E0E0E6] border-t-[#4D8EF7] animate-spin" />
                        <p className="text-sm font-medium text-[#5A5568]">Opening secure window…</p>
                      </div>
                    )}

                    {conn.step === 'popup-login' && (
                      <>
                        <h3 className="text-base font-semibold text-[#030213] text-center mb-1">
                          {conn.provider === 'xero' ? 'Login to Xero' : 'Sign in'}
                        </h3>
                        <p className="text-[11px] text-[#717182] text-center mb-5">
                          {conn.provider === 'xero' ? 'Use your Xero account' : 'One account. Everything Intuit.'}
                        </p>
                        <form onSubmit={(e) => { e.preventDefault(); submitLogin(); }} className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-[#5A5568] mb-1">Email address</label>
                            <input
                              type="email"
                              value={oauthEmail}
                              onChange={(e) => setOauthEmail(e.target.value)}
                              className="w-full px-3 py-2.5 text-sm border-2 border-[#E0E0E6] rounded-lg focus:outline-none focus:border-[#4D8EF7] transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-[#5A5568] mb-1">Password</label>
                            <input
                              type="password"
                              value={oauthPassword}
                              onChange={(e) => setOauthPassword(e.target.value)}
                              className="w-full px-3 py-2.5 text-sm border-2 border-[#E0E0E6] rounded-lg focus:outline-none focus:border-[#4D8EF7] transition-colors"
                            />
                          </div>
                          <button
                            type="submit"
                            className="w-full text-sm font-semibold text-white py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                            style={{ background: p.color }}
                          >
                            {conn.provider === 'xero' ? 'Log in' : 'Sign in'}
                          </button>
                          <p className="text-center text-[11px]" style={{ color: p.color }}>Forgot password?</p>
                          <div className="bg-[#FFF8E1] border border-[#FDE68A] rounded-lg px-3 py-2 mt-4 text-[10px] text-[#92400E] leading-snug">
                            <strong>Demo mode:</strong> credentials are pre-filled. Click <strong>{conn.provider === 'xero' ? 'Log in' : 'Sign in'}</strong> to continue the OAuth flow.
                          </div>
                        </form>
                      </>
                    )}

                    {conn.step === 'popup-2fa' && (
                      <>
                        <h3 className="text-base font-semibold text-[#030213] text-center mb-1">Two-step verification</h3>
                        <p className="text-[11px] text-[#717182] text-center mb-5">
                          Enter the 6-digit code from your authenticator app
                        </p>
                        <form onSubmit={(e) => { e.preventDefault(); submit2fa(); }} className="space-y-3">
                          <div>
                            <input
                              type="text"
                              value={oauthCode}
                              onChange={(e) => setOauthCode(e.target.value)}
                              maxLength={7}
                              className="w-full px-3 py-3 text-lg text-center font-mono tracking-widest border-2 border-[#E0E0E6] rounded-lg focus:outline-none focus:border-[#4D8EF7] transition-colors"
                            />
                          </div>
                          <button
                            type="submit"
                            className="w-full text-sm font-semibold text-white py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                            style={{ background: p.color }}
                          >
                            Verify and continue
                          </button>
                          <p className="text-center text-[11px]" style={{ color: p.color }}>Use backup code instead</p>
                        </form>
                      </>
                    )}

                    {conn.step === 'popup-consent' && (
                      <>
                        <div className="flex items-center justify-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center text-white text-xs font-bold">SG</div>
                          <CornerDownRight className="w-4 h-4 text-[#A0A0B0] rotate-180" />
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-xs" style={{ background: p.color }}>
                            {p.short}
                          </div>
                        </div>
                        <h3 className="text-sm font-semibold text-[#030213] text-center mb-1">
                          SmileGenius wants to access your {p.name} {conn.provider === 'xero' ? 'organisation' : 'company file'}
                        </h3>
                        <p className="text-[11px] text-[#717182] text-center mb-4">
                          Signed in as <span className="font-medium text-[#030213]">{oauthEmail}</span>
                        </p>
                        <div className="space-y-2 mb-4">
                          {[
                            { label: 'View your chart of accounts (GL codes)' },
                            { label: 'View your suppliers / vendors' },
                            { label: 'Create and update bills / expenses' },
                            { label: 'View your organisation profile' },
                          ].map((scope, i) => (
                            <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#FAFBFF] border border-[#F0EFF6]">
                              <Check className="w-3.5 h-3.5 text-[#15803D] flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-[#030213]">{scope.label}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-[#A0A0B0] text-center mb-4">
                          You can revoke access at any time in your {p.name} account settings.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={cancelConnect}
                            className="flex-1 px-3 py-2.5 text-sm font-medium text-[#5A5568] border-2 border-[#E0E0E6] rounded-lg hover:bg-[#F8F9FC] transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={approveConsent}
                            className="flex-1 px-3 py-2.5 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                            style={{ background: p.color }}
                          >
                            Allow access
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Faux popup footer */}
                  <div className="px-6 py-2 border-t border-[#F0EFF6] bg-[#FAFBFF] flex items-center justify-between text-[10px] text-[#A0A0B0]">
                    <span>© {conn.provider === 'xero' ? 'Xero Limited' : 'Intuit Inc.'}</span>
                    <span className="flex items-center gap-2">
                      <span>Privacy</span>
                      <span>Terms</span>
                      <span>Help</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
            );
          })()}
        </div>
      )}

      {/* ── CSV import preview ─────────────────────────────────────────── */}
      {importPreview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setImportPreview(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col">
            <div className="flex items-start justify-between px-6 py-4 border-b border-[#F0EFF6]">
              <div>
                <h3 className="text-base font-semibold text-[#030213]">Import preview</h3>
                <p className="text-xs text-[#717182] mt-0.5">
                  Parsed <span className="font-semibold text-[#030213]">{importPreview.rows.length}</span> nominal{' '}
                  {importPreview.rows.length === 1 ? 'code' : 'codes'} from <span className="font-medium text-[#5A5568]">{importPreview.fileName}</span>.
                </p>
              </div>
              <button onClick={() => setImportPreview(null)} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-[#F8F9FC] border-b border-[#F0EFF6]">
                    <th className="text-left px-6 py-2.5 text-[10px] font-bold text-[#717182] uppercase tracking-widest w-[180px]">Code</th>
                    <th className="text-left px-6 py-2.5 text-[10px] font-bold text-[#717182] uppercase tracking-widest">GL name</th>
                    <th className="text-right px-6 py-2.5 text-[10px] font-bold text-[#717182] uppercase tracking-widest w-[120px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFF6]">
                  {importPreview.rows.map((r) => {
                    const existing = rows.find((x) => x.code.toLowerCase() === r.code.toLowerCase());
                    const status: 'new' | 'update' | 'unchanged' = !existing
                      ? 'new'
                      : existing.name.toLowerCase() === r.name.toLowerCase()
                        ? 'unchanged'
                        : 'update';
                    return (
                      <tr key={r.id}>
                        <td className="px-6 py-2 text-sm font-mono tabular-nums text-[#030213]">{r.code || <span className="text-[#A0A0B0] italic">—</span>}</td>
                        <td className="px-6 py-2 text-sm text-[#030213]">{r.name || <span className="text-[#A0A0B0] italic">—</span>}</td>
                        <td className="px-6 py-2 text-right">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            status === 'new'
                              ? 'bg-[#F0FDF4] text-[#2E7D32] border border-[#BBF7D0]'
                              : status === 'update'
                                ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
                                : 'bg-[#F8F9FC] text-[#717182] border border-[#E0E0E6]'
                          }`}>
                            {status === 'new' ? 'New' : status === 'update' ? 'Update' : 'Unchanged'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer — merge / replace choice */}
            <div className="px-6 py-4 border-t border-[#F0EFF6] bg-white">
              {rows.length > 0 ? (
                <>
                  <p className="text-xs text-[#717182] mb-3">
                    You already have <span className="font-semibold text-[#030213]">{rows.length}</span> nominal{' '}
                    {rows.length === 1 ? 'code' : 'codes'}. How would you like to apply this import?
                  </p>
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    <button
                      onClick={() => setImportPreview(null)}
                      className="px-3 py-2 text-xs font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => applyImport('replace')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#C62828] border border-[#F9DCDC] rounded-lg hover:bg-[#FFF8F8] transition-colors"
                    >
                      Replace all
                    </button>
                    <button
                      onClick={() => applyImport('merge')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Merge with existing
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setImportPreview(null)}
                    className="px-3 py-2 text-xs font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => applyImport('replace')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Import {importPreview.rows.length} {importPreview.rows.length === 1 ? 'code' : 'codes'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function SpendSettingsPage() {
  const { toast } = useToast();
  const { fields, addField, updateField, removeField } = useSupplierFields();
  const [activeTab, setActiveTab] = useState<Tab>('fields');
  const [invoiceTab, setInvoiceTab] = useState<InvoiceTab>('inbox');
  const [supplierTab, setSupplierTab] = useState<SupplierTab>('fields');
  const [extractionTab, setExtractionTab] = useState<ExtractionTab>('setup');
  const [saved, setSaved] = useState(false);

  // Pay Period Extraction state — two dates now:
  //   • extractionDay  → when reports are generated
  //   • cutoffMonth + cutoffDay → after this point invoices not yet
  //     approved slip to the next month's payment run
  // Cut-off can sit in the same month (must be ≥ extraction day) or the
  // next month (any day). A useEffect repairs the cut-off if the user
  // pushes the extraction date past it.
  const [extractionDay, setExtractionDay] = useState('25th');
  const [cutoffMonth, setCutoffMonth] = useState<'same' | 'next'>('same');
  const [cutoffDay, setCutoffDay]     = useState('28th');

  // Numeric rank for any EXTRACTION_DAYS value — 'Last day of month' sorts
  // after every numbered day so comparisons stay correct.
  const dayRank = (d: string) => d === 'Last day of month' ? 32 : parseInt(d, 10);
  // List of cut-off-day options, filtered by current extraction day when
  // the cut-off is in the same month.
  const cutoffDayOptions = cutoffMonth === 'same'
    ? EXTRACTION_DAYS.filter(d => dayRank(d) >= dayRank(extractionDay))
    : EXTRACTION_DAYS;
  // Keep the cut-off valid as the extraction day or month-of-cut-off
  // changes. Runs as an effect so we don't setState during render.
  useEffect(() => {
    if (cutoffMonth === 'same' && dayRank(cutoffDay) < dayRank(extractionDay)) {
      setCutoffDay(extractionDay);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractionDay, cutoffMonth]);
  const [completedTabs, setCompletedTabs] = useState<Set<Tab>>(
    () => new Set(fields.length > 0 ? (['fields'] as Tab[]) : [])
  );

  function handleSave() {
    setSaved(true);
    if (fields.length > 0) setCompletedTabs(prev => new Set([...prev, 'fields']));
    setTimeout(() => setSaved(false), 2000);
    toast.success('Supplier fields saved');
  }

  const isComplete = (id: Tab) => completedTabs.has(id);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] mb-2">Spend Management Settings</h1>
        <p className="text-sm sm:text-base text-[#717182]">Configure supplier fields, approval workflows, and accounting integrations</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Vertical menu (matches General Settings) ─────────────────────── */}
        <aside className="lg:w-64 flex-shrink-0">
          <nav className="bg-white border border-[#E0E0E6] rounded-xl p-2 lg:sticky lg:top-6">
            {/* Progress summary — at top */}
            <div className="px-3 pt-2 pb-3 mb-2 border-b border-[#F0EFF6]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-medium text-[#717182] uppercase tracking-wide">Setup progress</span>
                <span className="text-[11px] font-semibold text-[#030213]">{completedTabs.size}/{TABS.length}</span>
              </div>
              <div className="h-1 rounded-full bg-[#F3F3F5] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] transition-all"
                  style={{ width: `${(completedTabs.size / TABS.length) * 100}%` }}
                />
              </div>
            </div>

            {TABS.map(({ id, label, description, icon: Icon }) => {
              const active = id === activeTab;
              const done = isComplete(id);
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 mb-0.5 rounded-lg text-left transition-all relative ${
                    active
                      ? 'bg-gradient-to-r from-[#EEF4FF] to-[#F5F3FF] text-[#030213]'
                      : 'text-[#5A5568] hover:bg-[#F8F9FC]'
                  }`}
                >
                  {active && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF]" />
                  )}
                  <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${active ? 'text-[#4D8EF7]' : 'text-[#717182]'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium leading-tight ${active ? 'text-[#030213]' : 'text-[#5A5568]'}`}>{label}</p>
                      {done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32] flex-shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-[#D4CEE1] flex-shrink-0" />
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-tight ${done ? 'text-[#2E7D32]' : 'text-[#A0A0B0]'}`}>
                      {done ? 'Configured' : description}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Content panel ────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Supplier — sub-tabs: Supplier Fields + Email Templates. Same
              tab-strip pattern as Invoice Setup so the chrome stays
              consistent across the spend-settings page. */}
          {activeTab === 'fields' && (
            <div>
              <div className="mb-5 p-1 bg-[#F3F3F5] rounded-xl overflow-x-auto">
                <div className="flex gap-1 min-w-max md:min-w-0">
                  {SUPPLIER_TABS.map(({ id, label, icon }) => (
                    <button
                      key={id}
                      onClick={() => setSupplierTab(id)}
                      className={`flex-shrink-0 md:flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        supplierTab === id
                          ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white shadow-sm'
                          : 'text-[#717182] hover:text-[#030213] hover:bg-white/60'
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {supplierTab === 'fields' && (
                <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#F0EFF6]">
                    <h2 className="text-base font-semibold text-[#030213]">Supplier Fields Settings</h2>
                    <p className="text-xs text-[#717182] mt-0.5">Define additional fields your team must fill in when onboarding a new supplier. These appear as Step 2 in the "Add Supplier" flow.</p>
                  </div>
                  <div className="p-6">
                    {fields.length === 0 ? (
                      <div className="text-center py-8 text-[#A0A0B0]">
                        <p className="text-sm">No custom fields yet.</p>
                        <p className="text-xs mt-1">Add fields to collect org-specific data when onboarding suppliers.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 mb-4">
                        {fields.map(f => (
                          <FieldRow key={f.id} field={f} onUpdate={u => updateField(f.id, u)} onRemove={() => removeField(f.id)} />
                        ))}
                      </div>
                    )}
                    <button onClick={() => addField({ label: '', required: false, placeholder: '' })} className="flex items-center gap-2 text-sm text-[#4D8EF7] hover:text-[#3578e5] transition-colors mt-2">
                      <Plus className="w-4 h-4" /> Add field
                    </button>
                  </div>
                  <div className="px-6 py-4 border-t border-[#F0EFF6] flex items-center justify-between bg-[#FAFBFC]">
                    <p className="text-xs text-[#A0A0B0]">
                      {fields.length} field{fields.length !== 1 ? 's' : ''} configured
                      {fields.filter(f => f.required).length > 0 && ` · ${fields.filter(f => f.required).length} required`}
                    </p>
                    <Button variant="primary" size="sm" onClick={handleSave}>{saved ? '✓ Saved' : 'Save changes'}</Button>
                  </div>
                </div>
              )}

              {supplierTab === 'email' && <SupplierEmailTemplatesTab />}
            </div>
          )}

          {/* Invoice Setup */}
          {activeTab === 'workflows' && (
            <div>
              {/* Horizontal sub-tabs — one row at all widths. On md+ the tabs share
                  the container width via flex-1; below md the row scrolls horizontally
                  so adding new tabs never wraps the strip onto two lines. */}
              <div className="mb-5 p-1 bg-[#F3F3F5] rounded-xl overflow-x-auto">
                <div className="flex gap-1 min-w-max md:min-w-0">
                  {INVOICE_TABS.map(({ id, label, icon }) => (
                    <button
                      key={id}
                      onClick={() => setInvoiceTab(id)}
                      className={`flex-shrink-0 md:flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        invoiceTab === id
                          ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white shadow-sm'
                          : 'text-[#717182] hover:text-[#030213] hover:bg-white/60'
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {invoiceTab === 'inbox'    && <EmailInboxTab />}
              {invoiceTab === 'rag'      && <RagScoringTab />}
              {invoiceTab === 'rules'    && <RulesEngineTab />}
              {invoiceTab === 'approval' && <ApprovalWorkflowTab />}
              {invoiceTab === 'po'       && <POMatchingTab />}
            </div>
          )}

          {/* Schedule Monthly Payment Extraction */}
          {activeTab === 'extraction' && (
            <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#F0EFF6]">
                <h2 className="text-base font-semibold text-[#030213]">Schedule Monthly Payment Extraction</h2>
                <p className="text-xs text-[#717182] mt-0.5">Configure when invoice extraction reports are generated, who receives them, and the reminder email sent to the dental group.</p>
              </div>
              {/* Inner tabs — Setup holds the schedule + share list; Email
                  holds the dental-group reminder (recipient, lead time and
                  the editable template). */}
              <div className="px-6 pt-4">
                <div className="p-1 bg-[#F3F3F5] rounded-xl flex gap-1">
                  {EXTRACTION_TABS.map(({ id, label, icon }) => (
                    <button
                      key={id}
                      onClick={() => setExtractionTab(id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        extractionTab === id
                          ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white shadow-sm'
                          : 'text-[#717182] hover:text-[#030213] hover:bg-white/60'
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {extractionTab === 'email' && (
                <ExtractionEmailTab
                  extractionDay={extractionDay}
                  cutoffDay={cutoffDay}
                  cutoffMonth={cutoffMonth}
                />
              )}

              {extractionTab === 'setup' && (
              <>
              <div className="p-6 space-y-5">
                {/* Two-column layout — extraction date on the left,
                    cut-off date on the right. The cut-off day options are
                    filtered against the extraction day when both sit in
                    the same month so the user can't pick an impossible
                    date (cut-off before extraction). */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-[#030213] mb-1.5">Payment Extraction</label>
                    <div className="relative">
                      <select
                        value={extractionDay}
                        onChange={(e) => setExtractionDay(e.target.value)}
                        className="w-full appearance-none pl-4 pr-10 py-2.5 border border-[#E0E0E6] rounded-lg text-sm text-[#030213] bg-white hover:bg-[#F8F9FC] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
                      >
                        {EXTRACTION_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <ChevronDown className="w-4 h-4 text-[#717182] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <div className="flex items-start gap-2 mt-2.5 px-3 py-2 bg-[#EEF4FF] border border-[#DBEAFE] rounded-lg">
                      <Info className="w-3.5 h-3.5 text-[#4D8EF7] flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-[#1565C0] leading-relaxed">
                        Reports are generated every month on this date. If it doesn't occur (e.g. 31st in February), extraction runs on the last day of the month.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#030213] mb-1.5">Payment Processing</label>
                    {/* Month toggle — same-month vs next-month. Cut-off
                        day options re-filter when this changes. */}
                    <div className="grid grid-cols-2 gap-1 p-1 bg-[#F3F3F5] rounded-lg mb-2">
                      {(['same', 'next'] as const).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCutoffMonth(m)}
                          className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            cutoffMonth === m
                              ? 'bg-white text-[#030213] shadow-sm'
                              : 'text-[#717182] hover:text-[#030213]'
                          }`}
                        >
                          {m === 'same' ? 'Same month' : 'Next month'}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <select
                        value={cutoffDay}
                        onChange={(e) => setCutoffDay(e.target.value)}
                        className="w-full appearance-none pl-4 pr-10 py-2.5 border border-[#E0E0E6] rounded-lg text-sm text-[#030213] bg-white hover:bg-[#F8F9FC] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
                      >
                        {cutoffDayOptions.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <ChevronDown className="w-4 h-4 text-[#717182] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <div className="flex items-start gap-2 mt-2.5 px-3 py-2 bg-[#FFF7ED] border border-[#FED7AA] rounded-lg">
                      <Info className="w-3.5 h-3.5 text-[#C2410C] flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-[#9A3412] leading-relaxed">
                        Invoices approved by <span className="font-semibold">{cutoffDay} {cutoffMonth === 'next' ? '(next month)' : '(same month)'}</span> go into this month's payment run. Anything not approved by then slips to the next month — and the supplier is notified via the <span className="font-semibold">Payment Schedule Update</span> email.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Footer — mirrors the Email tab so Save is always in reach */}
              <div className="px-6 py-4 border-t border-[#F0EFF6] flex items-center justify-between bg-[#FAFBFC]">
                <p className="text-xs text-[#A0A0B0]">
                  Extraction on the <span className="font-semibold text-[#030213]">{extractionDay}</span> · processing by <span className="font-semibold text-[#030213]">{cutoffDay} {cutoffMonth === 'next' ? '(next month)' : '(same month)'}</span>
                </p>
                <Button variant="primary" size="sm" onClick={() => toast.success('Payment schedule saved')}>Save changes</Button>
              </div>
              </>
              )}
            </div>
          )}

          {/* Accounting Integration */}
          {activeTab === 'integrations' && <AccountingIntegrationTab />}

        </div>
      </div>
    </div>
  );
}

// ─── Extraction email tab ────────────────────────────────────────────────────
// "Email" tab inside Schedule Monthly Payment Extraction. Two concerns:
//   1. Share Extraction With — who has access / receives the monthly report.
//   2. Payment Reminder — an automatic email sent ahead of the EXTRACTION
//      date to everyone with access, so pending invoices get approved in time.
// Kept deliberately minimal: the reminder leads with a single toggle row,
// and the template editor stays collapsed until the user asks for it.
const EXTRACTION_REMINDER_DEFAULT = {
  subject: 'Reminder: review invoices before the {{extractionDate}} payment extraction',
  body: `Hi team,

This is an automated reminder from your spend management schedule.

The monthly payment extraction runs on **{{extractionDate}}**. Please review and approve any pending invoices before then so they're included in this run.

{{pendingCount}} invoices are still awaiting approval — anything not approved before the extraction rolls into next month's run.

Review pending invoices: {{portalLink}}

Kind regards,

SmileGenius Spend Management`,
};
const EXTRACTION_REMINDER_PLACEHOLDERS = ['extractionDate', 'pendingCount', 'portalLink'];

function ExtractionEmailTab({ extractionDay }: {
  extractionDay: string;
  cutoffDay: string;
  cutoffMonth: 'same' | 'next';
}) {
  const { toast } = useToast();
  // Extraction report recipients — everyone with access. The reminder below
  // goes to this same list (people with access to the extraction).
  const [shareEmails, setShareEmails] = useState<string[]>(['finance@smilegenius.com']);
  const [emailInput, setEmailInput]   = useState('');
  const addShareEmail = () => {
    if (emailInput && !shareEmails.includes(emailInput)) {
      setShareEmails([...shareEmails, emailInput]);
      setEmailInput('');
    }
  };
  // Payment reminder settings. The reminder fires ahead of the EXTRACTION
  // date (not the processing cut-off) and is sent to everyone with access.
  const [leadDays, setLeadDays]         = useState('3');
  const [enabled, setEnabled]           = useState(true);
  const [subject, setSubject]           = useState(EXTRACTION_REMINDER_DEFAULT.subject);
  const [body, setBody]                 = useState(EXTRACTION_REMINDER_DEFAULT.body);
  const [templateOpen, setTemplateOpen] = useState(false);
  const isDefaultTemplate =
    subject === EXTRACTION_REMINDER_DEFAULT.subject && body === EXTRACTION_REMINDER_DEFAULT.body;
  return (
    <div>
      <div className="p-6 space-y-5">
        {/* Share Extraction With — these addresses receive the monthly
            extraction report generated on the Setup date. */}
        <div>
          <label className="block text-sm font-medium text-[#030213] mb-1.5">Share Extraction With</label>
          <div className="flex items-center gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717182]" />
              <input
                type="email"
                placeholder="Enter email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addShareEmail(); } }}
                className="w-full pl-9 pr-4 py-2.5 border border-[#E0E0E6] rounded-lg text-sm text-[#030213] bg-white placeholder-[#B0B0C0] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
              />
            </div>
            <button
              onClick={addShareEmail}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Member
            </button>
          </div>

          {shareEmails.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {shareEmails.map((email) => (
                <span key={email} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#F3F3F5] text-[#5A5568] border border-[#E0E0E6]">
                  <Mail className="w-3 h-3 text-[#717182]" />
                  {email}
                  <button
                    onClick={() => setShareEmails(shareEmails.filter((e) => e !== email))}
                    className="hover:text-[#D4183D] transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Payment reminder — one toggle row up top; the fields and the
            template only surface when the reminder is on. */}
        <div className="pt-5 border-t border-[#F0EFF6] space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#030213]">Payment Reminder Email</p>
              <p className="text-xs text-[#717182] mt-0.5 leading-relaxed">
                {enabled ? (
                  <>
                    Sent automatically <span className="font-medium text-[#030213]">{leadDays} day{leadDays === '1' ? '' : 's'} before the payment extraction</span> — {extractionDay} — to everyone with access.
                  </>
                ) : (
                  'Paused — recipients with access will not get this reminder.'
                )}
              </p>
            </div>
            <Toggle on={enabled} onChange={(v) => {
              setEnabled(v);
              toast.success(`Payment reminder ${v ? 'enabled' : 'paused'}`);
            }} />
          </div>

          {enabled && (
            <>
              {/* Recipients note — the reminder goes to everyone with access
                  (the Share Extraction With list above), not a single inbox. */}
              <div className="rounded-lg border border-[#BFDBFE] bg-[#EEF4FF] px-3 py-2.5 flex items-start gap-2">
                <Users className="w-4 h-4 text-[#1565C0] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#1E3A8A] leading-snug">
                  This reminder is sent to <span className="font-semibold">everyone with access to the extraction</span> — the {shareEmails.length} recipient{shareEmails.length === 1 ? '' : 's'} listed under <span className="font-semibold">Share Extraction With</span> above.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#030213] mb-1.5">Send Reminder</label>
                <div className="relative max-w-xs">
                  <select
                    value={leadDays}
                    onChange={(e) => setLeadDays(e.target.value)}
                    className="w-full appearance-none pl-4 pr-10 py-2.5 border border-[#E0E0E6] rounded-lg text-sm text-[#030213] bg-white hover:bg-[#F8F9FC] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
                  >
                    {['1', '2', '3', '5', '7'].map(d => (
                      <option key={d} value={d}>{d} day{d === '1' ? '' : 's'} before extraction</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#717182] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-xs text-[#717182] mt-1.5">Counted back from the extraction date ({extractionDay}).</p>
              </div>

              {/* Template — collapsed by default to keep the tab light.
                  Expanding reveals subject + body + merge placeholders. */}
              <div className="border border-[#E0E0E6] rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTemplateOpen(o => !o)}
                  className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-[#FAFBFC] hover:bg-[#F3F4F8] transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Mail className="w-3.5 h-3.5 text-[#717182] flex-shrink-0" />
                    <span className="text-sm font-medium text-[#030213]">Email template</span>
                    {!isDefaultTemplate && (
                      <span className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider bg-[#EEF4FF] text-[#1565C0] border border-[#BFDBFE]">
                        Customised
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-[#717182] flex-shrink-0">
                    {templateOpen ? 'Hide' : 'Edit'}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${templateOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {templateOpen && (
                  <div className="p-3.5 space-y-3 border-t border-[#F0EFF6]">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5A5568] uppercase tracking-wider mb-1">Subject</label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/15"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5A5568] uppercase tracking-wider mb-1">Body</label>
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={10}
                        className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/15 font-mono leading-relaxed resize-y"
                      />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-1">
                        {EXTRACTION_REMINDER_PLACEHOLDERS.map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`{{${p}}}`);
                              toast.success(`Copied {{${p}}}`);
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-[#BFDBFE] text-[10px] font-mono font-semibold text-[#1565C0] hover:bg-[#EEF4FF]"
                            title="Click to copy"
                          >
                            {`{{${p}}}`}
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={isDefaultTemplate}
                        onClick={() => {
                          setSubject(EXTRACTION_REMINDER_DEFAULT.subject);
                          setBody(EXTRACTION_REMINDER_DEFAULT.body);
                          toast.info('Template reset to default');
                        }}
                        className="text-[11px] font-medium text-[#717182] hover:text-[#030213] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0"
                      >
                        Reset to default
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#F0EFF6] flex items-center justify-between bg-[#FAFBFC]">
        <p className="text-xs text-[#A0A0B0]">
          {shareEmails.length} recipient{shareEmails.length === 1 ? '' : 's'} with access
          {enabled && ' · reminder on'}
        </p>
        <Button variant="primary" size="sm" onClick={() => toast.success('Email settings saved')}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

// ─── Supplier Email Templates tab ───────────────────────────────────────────
// Two pre-seeded templates teams send to suppliers:
//   1. Invoice Received   — confirms receipt + the scheduled payment date
//   2. Payment Schedule Update — explains slipped invoices into the next run
// Templates support {{merge}} placeholders. Edits are local-state for the
// prototype; production would persist them to the org template store.
const SUPPLIER_EMAIL_TEMPLATES: {
  id: string; name: string; subject: string; body: string;
  placeholders: string[];
  // Plain-English summary of WHEN the template auto-sends to suppliers.
  trigger: string;
  triggerTone: 'blue' | 'amber';
  // Master on/off for the template — when false the AP system stops
  // firing this message even if the trigger condition matches. Lets the
  // team pause comms during a system migration or pricing update without
  // losing the template body.
  enabled: boolean;
}[] = [
  {
    id: 'invoice-received',
    name: 'Invoice Received',
    subject: 'Invoice Received – {{invoiceNumber}}',
    placeholders: ['supplierName', 'invoiceNumber', 'paymentDate', 'companyName'],
    trigger: 'Sent automatically every time a new invoice is received from the supplier.',
    triggerTone: 'blue',
    enabled: true,
    body: `Dear {{supplierName}},

Thank you for sending your invoice {{invoiceNumber}}.

We have successfully received your invoice and it is currently being processed by our team.

Provided all required checks and approvals are completed successfully, payment is scheduled to be made on **{{paymentDate}}**.

No further action is required from you at this time. If we need any additional information, a member of our team will contact you.

Thank you for your continued support.

Kind regards,

{{companyName}}
Accounts Payable Team`,
  },
  {
    id: 'payment-schedule-update',
    name: 'Payment Schedule Update',
    subject: 'Payment Schedule Update – {{invoiceNumber}}',
    placeholders: ['supplierName', 'invoiceNumber', 'cutoffDate', 'nextPaymentDate', 'companyName'],
    trigger: 'Sent automatically if an invoice is NOT approved by the payment processing cut-off date — the invoice rolls into the next month\'s payment run.',
    triggerTone: 'amber',
    enabled: true,
    body: `Dear {{supplierName}},

We are writing to provide an update regarding invoice {{invoiceNumber}}.

Unfortunately, this invoice was not fully processed and posted to our accounting system before the payment cycle cutoff date of **{{cutoffDate}}**.

As a result, payment for this invoice will be included in our next payment run and is currently scheduled for **{{nextPaymentDate}}**.

No action is required from you at this time. We apologise for any inconvenience and appreciate your patience and understanding.

If you have any questions regarding this invoice, please contact our Accounts Payable team.

Kind regards,

{{companyName}}
Accounts Payable Team`,
  },
];

function SupplierEmailTemplatesTab() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState(SUPPLIER_EMAIL_TEMPLATES);
  const [activeId, setActiveId] = useState(templates[0].id);
  const active = templates.find(t => t.id === activeId)!;
  const update = (patch: Partial<typeof active>) =>
    setTemplates(prev => prev.map(t => t.id === active.id ? { ...t, ...patch } : t));
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#F0EFF6]">
        <h2 className="text-base font-semibold text-[#030213]">Supplier Email Templates</h2>
        <p className="text-xs text-[#717182] mt-0.5">
          Auto-sent messages your AP system fires off to suppliers. Each template has its own trigger
          (see the blue / amber pill above the subject). Placeholders like
          <code className="mx-1 px-1 rounded bg-[#F0EFF6] text-[#1565C0] font-mono text-[10px]">{`{{invoiceNumber}}`}</code>
          are filled in automatically when the message goes out.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] min-h-[420px]">
        {/* Left rail — template list */}
        <div className="border-r border-[#F0EFF6] bg-[#FAFBFC] p-3 space-y-1">
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                t.id === activeId
                  ? 'bg-white border-[#BFDBFE] shadow-sm'
                  : 'bg-transparent border-transparent hover:bg-white hover:border-[#E0E0E6]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                  t.id === activeId ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white' : 'bg-[#F0EFF6] text-[#5A5568]'
                }`}>
                  <Mail className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-semibold truncate ${t.id === activeId ? 'text-[#030213]' : 'text-[#5A5568]'}`}>{t.name}</p>
                    {!t.enabled && (
                      <span className="inline-flex items-center px-1 py-px rounded text-[8px] font-bold uppercase tracking-wider bg-[#FFF1F2] text-[#BE123C] border border-[#FECACA] flex-shrink-0">
                        Off
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#A0A0B0] truncate">{t.subject}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Right pane — editor */}
        <div className="p-5 space-y-4">
          {/* On/off toggle — master switch for whether this template
              auto-sends. When off, the AP system stops firing this
              message even if the trigger condition is met. The form
              below stays editable so the team can prep copy while
              the template is paused. */}
          <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
            active.enabled
              ? 'bg-[#F0FDF4] border-[#BBF7D0]'
              : 'bg-[#FFF1F2] border-[#FECACA]'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                active.enabled ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-white text-[#BE123C] border border-[#FECACA]'
              }`}>
                <Mail className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className={`text-xs font-bold leading-tight ${
                  active.enabled ? 'text-[#14532D]' : 'text-[#7F1D1D]'
                }`}>
                  {active.enabled ? 'Auto-send is ON' : 'Auto-send is OFF'}
                </p>
                <p className={`text-[11px] leading-snug mt-0.5 ${
                  active.enabled ? 'text-[#15803D]' : 'text-[#BE123C]'
                }`}>
                  {active.enabled
                    ? 'Suppliers will receive this email when the trigger fires.'
                    : 'Suppliers will NOT receive this email — template is paused.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={active.enabled}
              onClick={() => {
                const next = !active.enabled;
                update({ enabled: next });
                toast.success(`${active.name} ${next ? 'enabled' : 'paused'}`);
              }}
              className={`relative inline-flex items-center flex-shrink-0 h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                active.enabled
                  ? 'bg-[#16A34A] focus:ring-[#16A34A]'
                  : 'bg-[#E0E0E6] focus:ring-[#A0A0B0]'
              }`}
              title={active.enabled ? 'Turn off auto-send for this template' : 'Turn on auto-send for this template'}
            >
              <span
                className={`inline-block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  active.enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          {/* When-this-sends explainer — surfaces the auto-send trigger
              so the AP team knows exactly when each template is fired. */}
          <div className={`rounded-lg border px-3 py-2 flex items-start gap-2 transition-opacity ${
            !active.enabled ? 'opacity-60' : ''
          } ${
            active.triggerTone === 'amber'
              ? 'bg-[#FFF7ED] border-[#FED7AA]'
              : 'bg-[#EEF4FF] border-[#BFDBFE]'
          }`}>
            <CalendarClock className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
              active.triggerTone === 'amber' ? 'text-[#C2410C]' : 'text-[#1565C0]'
            }`} />
            <div className="min-w-0">
              <p className={`text-[10px] font-bold uppercase tracking-wider ${
                active.triggerTone === 'amber' ? 'text-[#9A3412]' : 'text-[#1E3A8A]'
              }`}>
                When this is sent
              </p>
              <p className={`text-xs leading-snug mt-0.5 ${
                active.triggerTone === 'amber' ? 'text-[#9A3412]' : 'text-[#1E3A8A]'
              }`}>
                {active.trigger}
              </p>
            </div>
          </div>
          <div className={`transition-opacity ${!active.enabled ? 'opacity-60' : ''}`}>
            <label className="block text-[11px] font-semibold text-[#5A5568] uppercase tracking-wider mb-1">Subject</label>
            <input
              type="text"
              value={active.subject}
              onChange={(e) => update({ subject: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/15"
            />
          </div>
          <div className={`transition-opacity ${!active.enabled ? 'opacity-60' : ''}`}>
            <label className="block text-[11px] font-semibold text-[#5A5568] uppercase tracking-wider mb-1">Body</label>
            <textarea
              value={active.body}
              onChange={(e) => update({ body: e.target.value })}
              rows={14}
              className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/15 font-mono leading-relaxed resize-y"
            />
          </div>
          {/* Placeholders cheat-sheet */}
          <div className={`rounded-lg border border-[#E8EAF6] bg-[#FAFBFF] p-3 transition-opacity ${!active.enabled ? 'opacity-60' : ''}`}>
            <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-1.5">Available placeholders</p>
            <div className="flex flex-wrap gap-1">
              {active.placeholders.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`{{${p}}}`);
                    toast.success(`Copied {{${p}}}`);
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-[#BFDBFE] text-[10px] font-mono font-semibold text-[#1565C0] hover:bg-[#EEF4FF]"
                  title="Click to copy"
                >
                  {`{{${p}}}`}
                  <Copy className="w-2.5 h-2.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="px-6 py-4 border-t border-[#F0EFF6] flex items-center justify-between bg-[#FAFBFC]">
        <p className="text-xs text-[#A0A0B0]">
          {templates.length} template{templates.length !== 1 ? 's' : ''} · Editing <span className="font-semibold text-[#030213]">{active.name}</span>
        </p>
        <Button variant="primary" size="sm" onClick={() => toast.success(`${active.name} template saved`)}>Save changes</Button>
      </div>
    </div>
  );
}
