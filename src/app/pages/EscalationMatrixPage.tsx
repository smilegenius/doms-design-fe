import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Clock, Eye, FolderOpen, MessageSquare, Plug, Search, ShieldAlert, User, X } from 'lucide-react';
import Modal from '../components/Modal';
import Button from '../components/Button';

// ─── Escalation Matrix ────────────────────────────────────────────────────────
// Settings → Notifications → Escalation Matrix. An administrator routes
// business-critical events to a designated contact once every scheduled
// reminder has been sent with no response. The catalogue mirrors the
// Notification Preferences structure so new event types slot in without
// layout changes (AC4): add an event to a category (or a new category) and it
// renders with its own reminder schedule, recipient picker and email preview.

interface OrgMember {
  id: string;
  name: string;
  role: string;
  email: string;
}

// Existing users within the organization (superset of Settings → User
// Management roster — mock, self-contained per page convention).
const ORG_MEMBERS: OrgMember[] = [
  { id: '1', name: 'Riverdale Admin', role: 'Super Admin',      email: 'super_admin_riverdale_dev@yopmail.com' },
  { id: '2', name: 'Sajid Mahmood',   role: 'Admin',            email: 'sajid@smilegenius.com' },
  { id: '3', name: 'Sophie Wilson',   role: 'Practice Manager', email: 'sophie@smilegenius.com' },
  { id: '4', name: 'Dr. Murphy',      role: 'Dentist',          email: 'murphy@smilegenius.com' },
  { id: '5', name: 'James Carter',    role: 'Lab Manager',      email: 'james.carter@smilegenius.com' },
  { id: '6', name: 'Priya Sharma',    role: 'Operations Lead',  email: 'priya.sharma@smilegenius.com' },
  { id: '7', name: 'Tom Bradley',     role: 'Technician',       email: 'tom.bradley@smilegenius.com' },
  { id: '8', name: 'Elena Rossi',     role: 'Front Desk',       email: 'elena.rossi@smilegenius.com' },
];

function memberInitials(name: string) {
  return name.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

interface EscalationEvent {
  id: string;
  label: string;
  description: string;
  // Human summary of the reminder schedule that must be exhausted first.
  schedule: string;
  // Example reference used in the escalation email preview.
  reference: string;
}

interface EscalationCategory {
  id: string;
  label: string;
  description: string;
  icon: typeof Plug;
  iconBg: string;
  iconColor: string;
  items: EscalationEvent[];
}

const CATEGORIES: EscalationCategory[] = [
  {
    id: 'scanner', label: 'Scanner & Integrations', icon: Plug,
    description: 'Connection issues left unresolved after every reminder.',
    iconBg: '#ECFEFF', iconColor: '#0F766E',
    items: [
      {
        id: 'scan-disconnected',
        label: 'Scanner Disconnected',
        description: 'Scanner disconnected and not reconnected after all reminder notifications.',
        schedule: 'Escalates once the daily reconnect reminders go unanswered',
        reference: 'iTero Element 5D · Laburnum Dental',
      },
      {
        id: 'scan-token-expired',
        label: 'Scanner Token Expired',
        description: 'Scanner token expired and the connection was not reauthorised after all reminder notifications.',
        schedule: 'Escalates after the 5, 3 and 1 business-day expiry warnings lapse',
        reference: 'iTero Element 5D · Laburnum Dental',
      },
    ],
  },
  {
    id: 'cases', label: 'Case Responses', icon: FolderOpen,
    description: 'Case requests still waiting on the other side.',
    iconBg: '#FFF7ED', iconColor: '#E65100',
    items: [
      {
        id: 'on-hold-no-response',
        label: 'On Hold Request Unanswered',
        description: 'Clinic has not responded to an On Hold request after all reminder notifications.',
        schedule: 'Escalates after 5 days of reminder emails go unanswered',
        reference: 'Case CASE-052 · Smile Genius Sheffield',
      },
    ],
  },
  {
    id: 'messages', label: 'Messages', icon: MessageSquare,
    description: 'Conversations that never received a reply.',
    iconBg: '#F3EEFF', iconColor: '#7C3AED',
    items: [
      {
        id: 'msg-urgent-no-response',
        label: 'Urgent Message Without Response',
        description: 'Lab has not responded to an urgent message after all reminder notifications.',
        schedule: 'Escalates after the 2, 4, 6 and 8-hour urgent reminders go unanswered',
        reference: 'Case CASE-051 · Laburnum Dental',
      },
      {
        id: 'msg-standard-no-response',
        label: 'Standard Message Without Response',
        description: 'Lab has not responded to a standard message after all reminder notifications.',
        schedule: 'Escalates after 3 daily reminders go unanswered',
        reference: 'Case CASE-054 · Harley Street Dental',
      },
    ],
  },
];

// ─── Recipient search select ──────────────────────────────────────────────────
// Searchable member picker — same pattern as the patient / dentist search
// selects on Quick Create (a native <select> hides role + email and doesn't
// scale to a real staff roster). Shows the selected member as a card with
// their details; searching filters by name, role or email.
function RecipientSearchSelect({ selected, onChange }: {
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
    if (!q) return ORG_MEMBERS;
    return ORG_MEMBERS.filter(m =>
      m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [q]);

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

// ── Assignment state — eventId → memberId, persisted on every change ─────────
type Matrix = Record<string, string>;
const LS_KEY = 'org.escalationMatrix';

function loadMatrix(): Matrix {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') ?? {}; } catch { return {}; }
}

export default function EscalationMatrix() {
  const [matrix, setMatrix] = useState<Matrix>(loadMatrix);
  const [previewEvent, setPreviewEvent] = useState<EscalationEvent | null>(null);

  function assign(eventId: string, memberId: string) {
    const next = { ...matrix, [eventId]: memberId };
    setMatrix(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage blocked — keep in-memory */ }
  }

  const memberFor = (eventId: string) => ORG_MEMBERS.find(m => m.id === matrix[eventId]);
  const totalEvents = CATEGORIES.reduce((n, c) => n + c.items.length, 0);
  const configured = CATEGORIES.reduce((n, c) => n + c.items.filter(i => matrix[i.id]).length, 0);

  const previewRecipient = previewEvent ? memberFor(previewEvent.id) : undefined;
  const previewName = previewRecipient?.name ?? '{{Recipient Name}}';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#030213]">Escalation Matrix</h2>
          <p className="text-sm text-[#717182] mt-0.5">
            Choose who is alerted when a critical event stays unresolved after every reminder. Changes save automatically.
          </p>
        </div>
        <span className={`self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
          configured === totalEvents
            ? 'bg-[#F0FDF4] text-[#2E7D32] border-[#BBF7D0]'
            : 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]'
        }`}>
          <ShieldAlert className="w-3.5 h-3.5" />
          {configured}/{totalEvents} events configured
        </span>
      </div>

      {/* How escalation triggers — the rule every event below follows */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-[#FDE68A] bg-[#FFF8E1]">
        <ShieldAlert className="w-4 h-4 text-[#B45309] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#92610A] leading-relaxed">
          An escalation fires only after <span className="font-semibold">all reminder notifications have been sent</span> and
          the event is <span className="font-semibold">still unresolved</span>. On the next scheduled cycle the escalation
          contact receives an email and an in-app notification instead of another reminder to the original recipient.
        </p>
      </div>

      {CATEGORIES.map(cat => {
        const Icon = cat.icon;
        const catConfigured = cat.items.filter(i => matrix[i.id]).length;
        return (
          <div key={cat.id} className="bg-white rounded-xl border border-[#E0E0E6] overflow-hidden">
            {/* Category header — same treatment as Notification Preferences */}
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cat.iconBg }}>
                  <Icon className="w-5 h-5" style={{ color: cat.iconColor }} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#030213] truncate">{cat.label}</h3>
                    <span className="px-1.5 py-px rounded-full bg-[#F3F3F5] text-[10px] font-medium text-[#717182] tabular-nums">{cat.items.length}</span>
                  </div>
                  <p className="text-xs text-[#717182] truncate">{cat.description}</p>
                </div>
              </div>
              <span className="text-[11px] font-medium text-[#717182] tabular-nums flex-shrink-0">
                {catConfigured}/{cat.items.length} configured
              </span>
            </div>

            <div className="border-t border-[#F0EFF6]">
              <div className="grid grid-cols-[1fr_280px] gap-3 px-5 py-2 bg-[#F8F9FC] border-b border-[#F0EFF6]">
                <span className="text-[11px] font-medium text-[#717182] uppercase tracking-wide">Event</span>
                <span className="text-[11px] font-medium text-[#717182] uppercase tracking-wide">Escalation contact</span>
              </div>
              <div className="divide-y divide-[#F0EFF6]">
                {cat.items.map(event => {
                  const assigned = memberFor(event.id);
                  return (
                    <div key={event.id} className="grid grid-cols-[1fr_280px] gap-3 px-5 py-3.5 items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-[#030213]">{event.label}</p>
                          {assigned ? (
                            <span className="inline-flex items-center px-1.5 py-px rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[9px] font-bold uppercase tracking-wider text-[#15803D]">Active</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-[#FFF8E1] border border-[#FDE68A] text-[9px] font-bold uppercase tracking-wider text-[#B45309]">
                              <AlertTriangle className="w-2.5 h-2.5" /> Not configured
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#717182] mt-0.5">{event.description}</p>
                        <p className="flex items-center gap-1 text-[11px] text-[#A0A0B0] mt-1">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          {event.schedule}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <RecipientSearchSelect
                          selected={assigned}
                          onChange={(memberId) => assign(event.id, memberId)}
                        />
                        <button
                          onClick={() => setPreviewEvent(event)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4D8EF7] hover:text-[#3578E5] transition-colors"
                        >
                          <Eye className="w-3 h-3" /> Preview escalation email
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      <p className="text-[11px] text-[#A0A0B0] px-1">
        New event types can be added to this matrix as they are introduced — each event carries its own
        reminder schedule and escalation contact.
      </p>

      {/* Escalation email preview — suggested template with the event filled in */}
      <Modal
        isOpen={previewEvent !== null}
        onClose={() => setPreviewEvent(null)}
        title="Escalation email preview"
        size="md"
        footer={<Button variant="outline" onClick={() => setPreviewEvent(null)}>Close</Button>}
      >
        {previewEvent && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#F8F9FC] border border-[#F0EFF6] px-4 py-2.5">
              <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-0.5">Subject</p>
              <p className="text-sm font-semibold text-[#030213]">Escalation: Action Required for {previewEvent.label}</p>
            </div>
            <div className="text-sm text-[#030213] leading-relaxed space-y-3">
              <p>Hi {previewName},</p>
              <p className="text-[#5A5568]">
                The following issue has remained unresolved despite all scheduled reminder notifications
                and has now been escalated to you.
              </p>
              <div className="rounded-lg border border-[#E0E0E6] divide-y divide-[#F0EFF6] text-xs">
                {[
                  ['Event', previewEvent.label],
                  ['Reference', previewEvent.reference],
                  ['Current Status', 'Unresolved — all reminders sent'],
                  ['Pending Since', '08-Aug-2026'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 px-3 py-2">
                    <span className="font-medium text-[#717182]">{k}</span>
                    <span className="font-semibold text-[#030213] text-right">{v}</span>
                  </div>
                ))}
              </div>
              <p className="text-[#5A5568]">Please review the issue and take the appropriate action.</p>
              <span className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]">
                View Details
              </span>
            </div>
            <p className="text-[11px] text-[#A0A0B0]">
              The in-app notification reads: “An unresolved {previewEvent.label} has been escalated to you.
              Please review and take the necessary action.”
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
