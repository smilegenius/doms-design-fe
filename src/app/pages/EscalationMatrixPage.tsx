import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Bell, Check, CreditCard, Eye, FolderOpen, Mail,
  MessageSquare, Plug, Search, ShieldAlert, User, X,
} from 'lucide-react';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Toggle from '../components/Toggle';

// ─── Escalation Settings (lab + clinic) ──────────────────────────────────────
// Settings → Notifications → Escalation Matrix, in BOTH portals. Escalations
// are configured at the CATEGORY level (not per notification event): each
// category carries
//   • Enable Escalation  — the category on/off switch
//   • Escalation Contact — an existing user within the organization
//   • Escalation Trigger — where applicable (the lab's Case Management follows
//     the product-defined reminder workflow and exposes no timing config)
// Each portal has its own category catalogue, user roster, copy and
// persistence key; the page structure is shared. When an escalation fires,
// the contact receives an Email AND an In-App notification — escalations
// notify the appropriate stakeholder, they do NOT transfer ownership of the
// underlying task. Email + in-app copy below is the product spec's, verbatim.

export interface OrgMember {
  id: string;
  name: string;
  role: string;
  email: string;
}

// Existing users within the organization (superset of Settings → User
// Management roster — mock, self-contained per page convention).
const LAB_MEMBERS: OrgMember[] = [
  { id: '1', name: 'Riverdale Admin', role: 'Super Admin',      email: 'super_admin_riverdale_dev@yopmail.com' },
  { id: '2', name: 'Sajid Mahmood',   role: 'Admin',            email: 'sajid@smilegenius.com' },
  { id: '3', name: 'Sophie Wilson',   role: 'Practice Manager', email: 'sophie@smilegenius.com' },
  { id: '4', name: 'Dr. Murphy',      role: 'Dentist',          email: 'murphy@smilegenius.com' },
  { id: '5', name: 'James Carter',    role: 'Lab Manager',      email: 'james.carter@smilegenius.com' },
  { id: '6', name: 'Priya Sharma',    role: 'Operations Lead',  email: 'priya.sharma@smilegenius.com' },
  { id: '7', name: 'Tom Bradley',     role: 'Technician',       email: 'tom.bradley@smilegenius.com' },
  { id: '8', name: 'Elena Rossi',     role: 'Front Desk',       email: 'elena.rossi@smilegenius.com' },
];

// Existing clinic users (mirrors the clinic's User Management roster). Also
// used by the Case Scoring escalation config — the contact intervening when a
// dentist doesn't respond is a clinic user associated with the case.
export const CLINIC_MEMBERS: OrgMember[] = [
  { id: '1', name: 'Riverdale Admin',  role: 'Super Admin',           email: 'super_admin_riverdale_dev@yopmail.com' },
  { id: '2', name: 'Sajid Mahmood',    role: 'Admin',                 email: 'sajid@smilegenius.com' },
  { id: '3', name: 'Sophie Wilson',    role: 'Practice Manager',      email: 'sophie@smilegenius.com' },
  { id: '4', name: 'Dr. Murphy',       role: 'Dentist',               email: 'murphy@smilegenius.com' },
  { id: '5', name: 'Dr. Amelia Hart',  role: 'Dentist',               email: 'amelia.hart@smilegenius.com' },
  { id: '6', name: 'Grace Okafor',     role: 'Treatment Coordinator', email: 'grace.okafor@smilegenius.com' },
  { id: '7', name: 'Daniel Reyes',     role: 'Practice Coordinator',  email: 'daniel.reyes@smilegenius.com' },
  { id: '8', name: 'Elena Rossi',      role: 'Front Desk',            email: 'elena.rossi@smilegenius.com' },
];

function memberInitials(name: string) {
  return name.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Category catalogue ───────────────────────────────────────────────────────
interface TriggerOption { id: string; label: string; }

interface EscalationCategoryDef {
  id: string;
  label: string;
  description: string;
  icon: typeof Plug;
  iconBg: string;
  iconColor: string;
  /** "Select the user responsible for …" — PM copy per category. */
  contactHint: string;
  /** Category trigger — a single-choice schedule, a fixed (product-defined)
      workflow, or a set of independently-toggleable events (billing). */
  trigger:
    | { kind: 'select'; label: string; options: TriggerOption[]; defaultId: string; appliesTo?: { label: string; items: string[] }; notes?: string[]; conditions?: string[] }
    | { kind: 'fixed'; text: string; examples: string[] }
    | { kind: 'events'; label: string; options: TriggerOption[] };
  email: {
    subject: string;
    intro: string;
    fields: [string, string][];
    /** Paragraphs after the fields; "Escalated Because:" gets bold treatment. */
    lines: string[];
    cta: string;
    /** Sign-off lines rendered after the CTA (clinic emails only). */
    closing?: string[];
  };
  inApp: { text: string; action: string };
}

const LAB_CATEGORIES: EscalationCategoryDef[] = [
  {
    id: 'scanner', label: 'Scanner & Integrations', icon: Plug,
    description: 'Scanner connection and token issues left unresolved.',
    iconBg: '#ECFEFF', iconColor: '#0F766E',
    contactHint: 'Select the user responsible for scanner and integration issues.',
    trigger: {
      kind: 'select',
      label: 'Escalate if the scanner has not been reconnected:',
      options: [
        { id: 'expiry-30d',  label: '30 days before token expiry' },
        { id: 'expiry-15d',  label: '15 days before token expiry' },
        { id: 'expiry-7d',   label: '7 days before token expiry' },
        { id: 'expiry-5bd',  label: '5 business days before token expiry' },
        { id: 'expiry-3bd',  label: '3 business days before token expiry' },
        { id: 'expiry-1bd',  label: '1 business day before token expiry' },
        { id: 'expiry-on',   label: 'On token expiry' },
      ],
      defaultId: 'expiry-7d',
    },
    email: {
      subject: 'Action Required: Scanner Integration Issue Escalated',
      intro: 'A scanner integration issue has remained unresolved and has now been escalated to you.',
      fields: [
        ['Lab', '{{Lab Name}}'],
        ['Scanner', '{{Scanner Name}}'],
        ['Issue', '{{Issue}}'],
      ],
      lines: [
        'Escalated Because: The issue has not been resolved within the configured escalation timeframe.',
        'Failure to resolve this issue may prevent your lab from receiving new scanner cases.',
      ],
      cta: 'View Scanner Settings',
    },
    inApp: {
      text: 'Scanner integration issue escalated to you. Immediate action is recommended to avoid interruption to case imports.',
      action: 'View Scanner Settings',
    },
  },
  {
    id: 'cases', label: 'Case Management', icon: FolderOpen,
    description: 'Case actions still outstanding after every reminder.',
    iconBg: '#FFF7ED', iconColor: '#E65100',
    contactHint: 'Select the user responsible for operational case management.',
    trigger: {
      kind: 'fixed',
      text: 'Escalation occurs automatically after the configured reminder workflow has been exhausted. This timing is defined by the product and is not configurable.',
      examples: [
        'Clinic has not responded to an On Hold request.',
        'Lab has not completed the required action after all reminder notifications.',
      ],
    },
    email: {
      subject: 'Action Required: Case Management Issue Escalated',
      intro: 'A case management issue has remained unresolved and has now been escalated to you.',
      fields: [
        ['Case ID', '{{Case ID}}'],
        ['Patient', '{{Patient Name}}'],
        ['Current Status', '{{Status}}'],
      ],
      lines: [
        'Escalated Because: The required action has not been completed within the configured escalation timeframe.',
        'Please review the case to help prevent delays in treatment and delivery.',
      ],
      cta: 'View Case',
    },
    inApp: {
      text: 'A case requiring attention has been escalated to you. Please review it to avoid further delays.',
      action: 'View Case',
    },
  },
  {
    id: 'messages', label: 'Messages', icon: MessageSquare,
    description: 'Conversations awaiting a response near the case due date.',
    iconBg: '#F3EEFF', iconColor: '#7C3AED',
    contactHint: 'Select the user responsible for communication management.',
    trigger: {
      kind: 'select',
      label: 'Escalate if a message requiring a response remains unanswered:',
      options: [
        { id: 'due-5d', label: '5 days before the case due date' },
        { id: 'due-3d', label: '3 days before the case due date' },
        { id: 'due-2d', label: '2 days before the case due date' },
        { id: 'due-1d', label: '1 day before the case due date' },
        { id: 'due-on', label: 'On the case due date' },
      ],
      defaultId: 'due-3d',
      notes: [
        'If the remaining time until the due date is already less than this threshold when the message is sent, the escalation occurs immediately.',
      ],
      conditions: [
        'The message is still awaiting a response.',
        'The case has not been completed.',
        'The case has not been cancelled.',
      ],
    },
    email: {
      subject: 'Action Required: Unanswered Message Escalated',
      intro: 'A conversation requiring a response has remained unanswered and has now been escalated to you.',
      fields: [
        ['Case ID', '{{Case ID}}'],
        ['Sender', '{{Sender Name}}'],
        ['Due Date', '{{Due Date}}'],
      ],
      lines: [
        'This conversation is approaching the case due date and requires attention to help avoid delays in case completion.',
      ],
      cta: 'Open Conversation',
    },
    inApp: {
      text: 'An unanswered conversation has been escalated to you because it is approaching the case due date.',
      action: 'Open Conversation',
    },
  },
  {
    id: 'billing', label: 'Billing & Subscription', icon: CreditCard,
    description: 'Plan usage and billing thresholds that risk service interruption.',
    iconBg: '#F0FDF4', iconColor: '#2E7D32',
    contactHint: 'Select the user responsible for subscription and billing management.',
    trigger: {
      kind: 'events',
      label: 'Escalate when:',
      options: [
        { id: 'usage-5', label: 'Remaining plan usage reaches 5%' },
        { id: 'grace',   label: 'Grace Period Starts' },
      ],
    },
    email: {
      subject: 'Action Required: Billing & Subscription Issue Escalated',
      intro: 'A billing or subscription event has reached the configured escalation threshold.',
      fields: [
        ['Organisation', '{{Organisation Name}}'],
        ['Event', '{{Event}}'],
        ['Current Status', '{{Status}}'],
      ],
      lines: [
        'Please review the account to help avoid any interruption to Smile Genius services.',
      ],
      cta: 'View Subscription',
    },
    inApp: {
      text: 'A billing or subscription event has been escalated to you and requires your attention.',
      action: 'View Subscription',
    },
  },
];

// Clinic catalogue — two reminder-driven workflow categories, both escalating
// against the case due date. Copy is the clinic spec's, verbatim.
const CLINIC_DUE_DATE_OPTIONS: TriggerOption[] = [
  { id: 'due-5d', label: '5 days before the case due date' },
  { id: 'due-3d', label: '3 days before the case due date' },
  { id: 'due-2d', label: '2 days before the case due date' },
  { id: 'due-1d', label: '1 day before the case due date' },
  { id: 'due-on', label: 'On the case due date' },
];

const CLINIC_CATEGORIES: EscalationCategoryDef[] = [
  {
    id: 'cases', label: 'Case Management', icon: FolderOpen,
    description: 'Reminder-driven case workflows still awaiting a clinic response.',
    iconBg: '#FFF7ED', iconColor: '#E65100',
    contactHint: 'Select the user responsible for case management escalations.',
    trigger: {
      kind: 'select',
      label: 'Escalate unresolved case management workflows:',
      options: CLINIC_DUE_DATE_OPTIONS,
      defaultId: 'due-3d',
      appliesTo: {
        label: 'Applies to all reminder-driven case workflows, including but not limited to:',
        items: [
          'On Hold requests awaiting a clinic response.',
          'Additional Information requests awaiting a clinic response.',
          'Any future workflow requiring user action before the case due date.',
        ],
      },
      notes: [
        'If the remaining time until the case due date is already less than this threshold when the workflow begins, the escalation occurs immediately.',
      ],
      conditions: [
        'The required response or action is still pending.',
        'The case has not been completed.',
        'The case has not been cancelled.',
      ],
    },
    email: {
      subject: 'Escalation: Case Requires Immediate Attention',
      intro: 'A case has been escalated to you because the required action has not been completed within the configured escalation timeframe.',
      fields: [
        ['Case ID', '{{Case ID}}'],
        ['Patient', '{{Patient Name}}'],
        ['Current Status', '{{Case Status}}'],
        ['Due Date', '{{Due Date}}'],
      ],
      lines: [
        'Please review the case and take the necessary action to help prevent delays in treatment or delivery.',
      ],
      cta: 'View Case',
      closing: ['Thank you,', 'Smile Genius Team'],
    },
    inApp: {
      text: 'Case {{Case ID}} has been escalated to you because the required action is still pending. Please review the case to help prevent delays.',
      action: 'View Case',
    },
  },
  {
    id: 'messages', label: 'Messages', icon: MessageSquare,
    description: 'Conversations awaiting a response near the case due date.',
    iconBg: '#F3EEFF', iconColor: '#7C3AED',
    contactHint: 'Select the user responsible for communication escalations.',
    trigger: {
      kind: 'select',
      label: 'Escalate unanswered messages:',
      options: CLINIC_DUE_DATE_OPTIONS,
      defaultId: 'due-3d',
      notes: [
        'If the remaining time until the case due date is already less than this threshold when the message is sent, the escalation occurs immediately.',
      ],
      conditions: [
        'The message is still awaiting a response.',
        'The case has not been completed.',
        'The case has not been cancelled.',
      ],
    },
    email: {
      subject: 'Escalation: Conversation Awaiting Response',
      intro: 'A conversation has been escalated to you because it remains unanswered and is approaching the configured escalation threshold.',
      fields: [
        ['Case ID', '{{Case ID}}'],
        ['Message From', '{{Sender Name}}'],
        ['Due Date', '{{Due Date}}'],
      ],
      lines: [
        'Please review the conversation and ensure the required response is provided to avoid delays to the associated case.',
      ],
      cta: 'Open Conversation',
      closing: ['Thank you,', 'Smile Genius Team'],
    },
    inApp: {
      text: 'A conversation for Case {{Case ID}} has been escalated to you because it remains unanswered and requires attention.',
      action: 'Open Conversation',
    },
  },
];

type Portal = 'lab' | 'clinic';
const PORTALS: Record<Portal, { categories: EscalationCategoryDef[]; members: OrgMember[]; lsKey: string }> = {
  lab:    { categories: LAB_CATEGORIES,    members: LAB_MEMBERS,    lsKey: 'org.escalationSettings' },
  clinic: { categories: CLINIC_CATEGORIES, members: CLINIC_MEMBERS, lsKey: 'clinic.escalationSettings' },
};

// ─── Recipient search select ──────────────────────────────────────────────────
// Searchable member picker — same pattern as the patient / dentist search
// selects on Quick Create. Shows the selected member as a card with their
// details; searching filters by name, role or email.
export function RecipientSearchSelect({ members, selected, onChange }: {
  members: OrgMember[];
  selected?: OrgMember;
  onChange: (memberId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Opening always starts from a blank query so the full roster shows.
  useEffect(() => {
    if (open) { setQuery(''); inputRef.current?.focus(); }
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return members;
    return members.filter(m =>
      m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [q, members]);

  return (
    <div ref={wrapperRef} className="relative">
      {selected && !open ? (
        // Selected member card — details at a glance; click to change, X to clear.
        <div
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-[#E0E0E6] bg-white cursor-pointer hover:border-[#C8D8FC] transition-colors"
          title="Change escalation contact"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#EEF4FF] to-[#F3EEFF] flex items-center justify-center text-[10px] font-bold text-[#4D8EF7] flex-shrink-0">
            {memberInitials(selected.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#030213] truncate">{selected.name}</p>
            <p className="text-[10px] text-[#717182] truncate" title={`${selected.role} · ${selected.email}`}>
              {selected.role} · {selected.email}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            title="Remove escalation contact"
            className="p-1 rounded-md text-[#A0A0B0] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-[#F3F3F5] flex items-center justify-center pointer-events-none">
            <User className="w-3 h-3 text-[#A0A0B0]" />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search name, role or email…"
            className="w-full h-[38px] pl-9 py-2 pr-7 text-xs text-[#030213] placeholder-[#A0A0B0] border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
          />
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md hover:bg-[#F8F9FC] flex items-center justify-center text-[#A0A0B0]"
            title="Browse organization members"
          >
            <Search className="w-3 h-3" />
          </button>
        </div>
      )}

      {open && (
        <div className="absolute z-30 mt-1 left-0 right-0 bg-white border border-[#E8EAF6] rounded-xl shadow-[0_10px_30px_rgba(77,142,247,0.15)] overflow-hidden">
          <div className="px-3 py-2 border-b border-[#F0EFF6] bg-[#F8F9FC] flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">Organization members</span>
            <span className="text-[10px] font-bold text-[#5A5568] tabular-nums">{matches.length}</span>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {matches.length === 0 ? (
              <p className="px-3 py-4 text-xs text-[#A0A0B0] italic text-center">No members match “{query}”.</p>
            ) : matches.map(m => {
              const isSelected = selected?.id === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { onChange(m.id); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[#F5F8FF] ${isSelected ? 'bg-[#F5F8FF]' : ''}`}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#EEF4FF] to-[#F3EEFF] flex items-center justify-center text-[10px] font-bold text-[#4D8EF7] flex-shrink-0">
                    {memberInitials(m.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#030213] truncate">{m.name}</p>
                    <p className="text-[10px] text-[#717182] truncate">{m.role} · {m.email}</p>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#4D8EF7] flex-shrink-0" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-[#F0EFF6] bg-[#F8F9FC]">
            <p className="text-[10px] text-[#717182]">Members are managed in Settings → User Management.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Per-category state — persisted on every change ──────────────────────────
interface CategoryConfig {
  enabled: boolean;
  contactId: string;
  /** Selected trigger option id — select-kind categories only. */
  trigger?: string;
  /** Enabled event ids — events-kind categories (billing) only. */
  events?: string[];
}
type EscalationState = Record<string, CategoryConfig>;

// Defaults derive from the catalogue: escalation off, no contact, the def's
// default trigger option (select) or every event enabled (events).
function defaultStateFor(categories: EscalationCategoryDef[]): EscalationState {
  return Object.fromEntries(categories.map(c => [c.id, {
    enabled: false,
    contactId: '',
    ...(c.trigger.kind === 'select' ? { trigger: c.trigger.defaultId } : {}),
    ...(c.trigger.kind === 'events' ? { events: c.trigger.options.map(o => o.id) } : {}),
  }]));
}

function loadState(portal: Portal): EscalationState {
  const { categories, lsKey } = PORTALS[portal];
  const defaults = defaultStateFor(categories);
  let stored: Partial<EscalationState> = {};
  try { stored = JSON.parse(localStorage.getItem(lsKey) ?? '{}') ?? {}; } catch { /* corrupt — fall back to defaults */ }
  return Object.fromEntries(categories.map(c => [c.id, { ...defaults[c.id], ...(stored[c.id] ?? {}) }]));
}

// Inline {{placeholder}} chip — same treatment as the case scoring email previews.
function Placeholder({ text }: { text: string }) {
  return (
    <span className="px-1 py-px rounded bg-[#EEF4FF] border border-[#BFDBFE] text-[10px] font-mono font-semibold text-[#1565C0]">
      {text}
    </span>
  );
}

// Text with inline {{placeholders}} rendered as chips (in-app notification copy).
function MergeInline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{\{[^}]+\}\})/g).map((p, i) =>
        /^\{\{[^}]+\}\}$/.test(p) ? <Placeholder key={i} text={p} /> : <span key={i}>{p}</span>
      )}
    </>
  );
}

export default function EscalationMatrix({ portal = 'lab' }: { portal?: Portal } = {}) {
  const { categories, members, lsKey } = PORTALS[portal];
  const [state, setState] = useState<EscalationState>(() => loadState(portal));
  const [previewCat, setPreviewCat] = useState<EscalationCategoryDef | null>(null);

  function update(id: string, patch: Partial<CategoryConfig>) {
    const next = { ...state, [id]: { ...state[id], ...patch } };
    setState(next);
    try { localStorage.setItem(lsKey, JSON.stringify(next)); } catch { /* storage blocked — keep in-memory */ }
  }

  const contactFor = (id: string) => members.find(m => m.id === state[id]?.contactId);
  // A category counts as configured once it's enabled AND has a contact.
  const activeCount = categories.filter(c => state[c.id].enabled && state[c.id].contactId).length;

  const previewContact = previewCat ? contactFor(previewCat.id) : undefined;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#030213]">Escalation Settings</h2>
          <p className="text-sm text-[#717182] mt-0.5">
            {portal === 'lab'
              ? 'Configure escalation contacts and triggers per business-critical category, so unresolved issues reach the right person before they impact day-to-day operations. Changes save automatically.'
              : 'Configure escalation contacts and timing for critical workflows, so unresolved issues are escalated before they impact patient treatment or case delivery. Escalations notify the contact — they do not transfer ownership of the task. Changes save automatically.'}
          </p>
        </div>
        <span className={`self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
          activeCount === categories.length
            ? 'bg-[#F0FDF4] text-[#2E7D32] border-[#BBF7D0]'
            : 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]'
        }`}>
          <ShieldAlert className="w-3.5 h-3.5" />
          {activeCount}/{categories.length} categories active
        </span>
      </div>

      {/* Notification behaviour — what the escalation contact receives */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-[#BFDBFE] bg-[#EEF4FF]">
        <span className="w-6 h-6 rounded-lg bg-white border border-[#BFDBFE] text-[#1565C0] flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bell className="w-3.5 h-3.5" />
        </span>
        <p className="text-xs text-[#3B6BAE] leading-relaxed">
          <span className="font-bold text-[#1565C0]">When an escalation is triggered</span> the contact receives an{' '}
          <span className="font-semibold">Email</span> and an <span className="font-semibold">In-App notification</span>{' '}
          {portal === 'lab'
            ? 'that clearly identify the affected category, the impacted case, scanner or subscription, why the escalation occurred, the action required, and a direct link to the relevant screen.'
            : 'that clearly communicate the workflow that has been escalated, the associated Case ID, the reason for escalation, the current status, the case due date, and a direct link to the case or conversation.'}
        </p>
      </div>

      {categories.map(cat => {
        const Icon = cat.icon;
        const conf = state[cat.id];
        const contact = contactFor(cat.id);
        const needsContact = conf.enabled && !conf.contactId;
        return (
          <div key={cat.id} className="bg-white rounded-xl border border-[#E0E0E6]">
            {/* Category header — name + status + Enable Escalation toggle */}
            <div className="px-5 py-4 flex items-center justify-between gap-4 rounded-t-xl">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cat.iconBg }}>
                  <Icon className="w-5 h-5" style={{ color: cat.iconColor }} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-[#030213]">{cat.label}</h3>
                    {conf.enabled && conf.contactId && (
                      <span className="inline-flex items-center px-1.5 py-px rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[9px] font-bold uppercase tracking-wider text-[#15803D]">Active</span>
                    )}
                    {needsContact && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-[#FFF8E1] border border-[#FDE68A] text-[9px] font-bold uppercase tracking-wider text-[#B45309]">
                        <AlertTriangle className="w-2.5 h-2.5" /> Contact required
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#717182] truncate">{cat.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[11px] font-semibold ${conf.enabled ? 'text-[#15803D]' : 'text-[#A0A0B0]'}`}>
                  {conf.enabled ? 'Escalation enabled' : 'Escalation disabled'}
                </span>
                <Toggle on={conf.enabled} onChange={() => update(cat.id, { enabled: !conf.enabled })} title="Enable Escalation" />
              </div>
            </div>

            {conf.enabled && (
              <div className="border-t border-[#F0EFF6] px-5 py-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                  {/* Escalation Contact */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0]">Escalation Contact</p>
                    <p className="text-xs text-[#717182] mt-0.5 mb-2">{cat.contactHint}</p>
                    <RecipientSearchSelect
                      members={members}
                      selected={contact}
                      onChange={(memberId) => update(cat.id, { contactId: memberId })}
                    />
                    <button
                      onClick={() => setPreviewCat(cat)}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#4D8EF7] hover:text-[#3578E5] transition-colors"
                    >
                      <Eye className="w-3 h-3" /> Preview email &amp; in-app notification
                    </button>
                  </div>

                  {/* Escalation Trigger */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0]">Escalation Trigger</p>
                    {cat.trigger.kind === 'select' && (
                      <>
                        <p className="text-xs text-[#717182] mt-0.5 mb-2">{cat.trigger.label}</p>
                        <select
                          value={conf.trigger}
                          onChange={(e) => update(cat.id, { trigger: e.target.value })}
                          className="w-full max-w-xs px-3 py-2 text-xs font-medium text-[#030213] bg-white border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] cursor-pointer"
                        >
                          {cat.trigger.options.map(o => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </select>
                        {cat.trigger.appliesTo && (
                          <div className="mt-2">
                            <p className="text-[11px] font-semibold text-[#5A5568]">{cat.trigger.appliesTo.label}</p>
                            <ul className="mt-1 space-y-0.5">
                              {cat.trigger.appliesTo.items.map(item => (
                                <li key={item} className="flex items-start gap-1.5 text-[11px] text-[#717182]">
                                  <span className="w-1 h-1 rounded-full bg-[#A0A0B0] mt-1.5 flex-shrink-0" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {cat.trigger.notes?.map(n => (
                          <p key={n} className="text-[11px] text-[#A0A0B0] leading-relaxed mt-2">{n}</p>
                        ))}
                        {cat.trigger.conditions && (
                          <div className="mt-2">
                            <p className="text-[11px] font-semibold text-[#5A5568]">Escalation only occurs when:</p>
                            <ul className="mt-1 space-y-0.5">
                              {cat.trigger.conditions.map(c => (
                                <li key={c} className="flex items-start gap-1.5 text-[11px] text-[#717182]">
                                  <span className="w-1 h-1 rounded-full bg-[#A0A0B0] mt-1.5 flex-shrink-0" />
                                  {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                    {cat.trigger.kind === 'fixed' && (
                      <div className="mt-1.5 rounded-lg border border-[#F0EFF6] bg-[#F8F9FC] px-3 py-2.5">
                        <p className="text-[11px] text-[#5A5568] leading-relaxed">{cat.trigger.text}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0] mt-2 mb-1">Examples</p>
                        <ul className="space-y-0.5">
                          {cat.trigger.examples.map(ex => (
                            <li key={ex} className="flex items-start gap-1.5 text-[11px] text-[#717182]">
                              <span className="w-1 h-1 rounded-full bg-[#A0A0B0] mt-1.5 flex-shrink-0" />
                              {ex}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {cat.trigger.kind === 'events' && (
                      <>
                        <p className="text-xs text-[#717182] mt-0.5 mb-2">{cat.trigger.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {cat.trigger.options.map(o => {
                            const on = conf.events?.includes(o.id) ?? false;
                            return (
                              <button
                                key={o.id}
                                onClick={() => update(cat.id, {
                                  events: on ? (conf.events ?? []).filter(e => e !== o.id) : [...(conf.events ?? []), o.id],
                                })}
                                role="checkbox"
                                aria-checked={on}
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                  on ? 'bg-[#EEF4FF] text-[#1565C0] border-[#C8D8FC]' : 'bg-white text-[#717182] border-[#E0E0E6] hover:border-[#4D8EF7]'
                                }`}
                              >
                                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  on ? 'bg-[#4D8EF7] border-[#4D8EF7]' : 'bg-white border-[#D4CEE1]'
                                }`}>
                                  {on && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                </span>
                                {o.label}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Escalation notification preview — email + in-app, PM copy verbatim */}
      <Modal
        isOpen={previewCat !== null}
        onClose={() => setPreviewCat(null)}
        title={previewCat ? `${previewCat.label} — escalation preview` : 'Escalation preview'}
        size="md"
        footer={<Button variant="outline" onClick={() => setPreviewCat(null)}>Close</Button>}
      >
        {previewCat && (
          <div className="space-y-4">
            {/* Email */}
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-1.5">
                <Mail className="w-3 h-3" /> Email
              </p>
              <div className="rounded-lg bg-[#F8F9FC] border border-[#F0EFF6] px-4 py-2.5 mb-3">
                <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-0.5">Subject</p>
                <p className="text-sm font-semibold text-[#030213]">{previewCat.email.subject}</p>
              </div>
              <div className="text-sm text-[#030213] leading-relaxed space-y-3">
                <p>Hi {previewContact ? previewContact.name : <Placeholder text="{{Recipient Name}}" />},</p>
                <p className="text-[#5A5568]">{previewCat.email.intro}</p>
                <div className="rounded-lg border border-[#E0E0E6] divide-y divide-[#F0EFF6] text-xs">
                  {previewCat.email.fields.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 px-3 py-2">
                      <span className="font-medium text-[#717182]">{k}</span>
                      <Placeholder text={v} />
                    </div>
                  ))}
                </div>
                {previewCat.email.lines.map(line =>
                  line.startsWith('Escalated Because:') ? (
                    <p key={line} className="text-[#5A5568]">
                      <span className="font-semibold text-[#030213]">Escalated Because:</span>
                      {line.slice('Escalated Because:'.length)}
                    </p>
                  ) : (
                    <p key={line} className="text-[#5A5568]">{line}</p>
                  )
                )}
                <span className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]">
                  {previewCat.email.cta}
                </span>
                {previewCat.email.closing && (
                  <p className="text-[#5A5568]">
                    {previewCat.email.closing.map(line => (
                      <span key={line} className="block">{line}</span>
                    ))}
                  </p>
                )}
              </div>
            </div>

            {/* In-app */}
            <div className="border-t border-[#F0EFF6] pt-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-1.5">
                <Bell className="w-3 h-3" /> In-App Notification
              </p>
              <div className="rounded-lg border border-[#E0E0E6] px-4 py-3 flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: previewCat.iconBg }}>
                  <previewCat.icon className="w-3.5 h-3.5" style={{ color: previewCat.iconColor }} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-[#030213] leading-relaxed"><MergeInline text={previewCat.inApp.text} /></p>
                  <p className="text-[11px] font-semibold text-[#4D8EF7] mt-1">Action: {previewCat.inApp.action}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
