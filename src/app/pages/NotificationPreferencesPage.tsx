import { useMemo, useState } from 'react';
import {
  ChevronDown, FolderOpen, AlertTriangle, MessageSquare, Plug, CreditCard,
} from 'lucide-react';
import Toggle from '../components/Toggle';
import Button from '../components/Button';
import SearchInput from '../components/SearchInput';
import EmptyState from '../components/EmptyState';

// ─── Lab Notification Preferences ────────────────────────────────────────────
// Per-notification In-App + Email controls, grouped by category, rendered as
// the Notifications tab of Lab Settings. Built entirely from the app's base
// components (Toggle, Button, SearchInput, EmptyState) — the PO reference
// design informed layout/behaviour only.
//
// The catalogue below is data-driven: adding a notification (or a whole
// category) is a new array entry — the page structure, bulk actions, search,
// and persistence all pick it up untouched.
//
// A notification that supports only one channel renders the other toggle
// disabled with an explanatory hover tooltip (PM copy verbatim).
// Preferences persist to localStorage immediately on change — no save button.

type Channel = 'inApp' | 'email';

interface NotificationDef {
  id: string;
  label: string;
  description: string;
  /** Which delivery channels this notification can use. */
  supports: Record<Channel, boolean>;
}

interface NotificationCategory {
  id: string;
  label: string;
  description: string;
  icon: typeof FolderOpen;
  /** Tint pair for the category icon chip. */
  iconBg: string;
  iconColor: string;
  items: NotificationDef[];
}

const BOTH: Record<Channel, boolean> = { inApp: true, email: true };
const IN_APP_ONLY: Record<Channel, boolean> = { inApp: true, email: false };
const EMAIL_ONLY: Record<Channel, boolean> = { inApp: false, email: true };

const CATEGORIES: NotificationCategory[] = [
  {
    id: 'case-updates', label: 'Case Updates', icon: FolderOpen,
    description: 'Receive notifications about case lifecycle changes.',
    iconBg: '#EEF4FF', iconColor: '#4D8EF7',
    items: [
      { id: 'case-assigned',   label: 'New Case Assigned', description: 'Notify me when a new case is assigned.',        supports: BOTH },
      { id: 'case-updated',    label: 'Case Updated',      description: 'Notify me when case details or files change.',  supports: BOTH },
      { id: 'case-cancelled',  label: 'Case Cancelled',    description: 'Notify me when a case is cancelled.',           supports: BOTH },
      { id: 'case-on-hold',    label: 'Case Put On Hold',  description: 'Notify me when a case is placed on hold.',      supports: BOTH },
      { id: 'case-due-change', label: 'Due Date Changed',  description: 'Notify me when a case due date moves.',         supports: BOTH },
    ],
  },
  {
    id: 'attention', label: 'Requires My Attention', icon: AlertTriangle,
    description: 'Items waiting on a response from you.',
    iconBg: '#FFF7ED', iconColor: '#E65100',
    items: [
      { id: 'att-hold-response', label: 'Clinic Responded to On Hold Request', description: 'The clinic replied to a case you put on hold.', supports: BOTH },
      { id: 'att-info-received', label: 'Additional Information Received',     description: 'Requested files or details have arrived.',      supports: BOTH },
      { id: 'att-approval',      label: 'Approval Required',                   description: 'A case is waiting on your approval.',           supports: BOTH },
    ],
  },
  {
    id: 'messages', label: 'Messages', icon: MessageSquare,
    description: 'Chat activity across your cases.',
    iconBg: '#F3EEFF', iconColor: '#7C3AED',
    items: [
      { id: 'msg-new',      label: 'New Chat Message',     description: 'Notify me about new messages in my case chats.',       supports: BOTH },
      { id: 'msg-urgent',   label: 'Urgent Chat Message',  description: 'A message was flagged urgent by the sender. Reminders repeat at 2, 4, 6 and 8 hours until you reply.', supports: BOTH },
      { id: 'msg-mention',  label: 'Someone Mentioned You', description: 'Notify me when I am @-mentioned in a conversation.',  supports: BOTH },
      { id: 'msg-reminder', label: 'Chat Reminder',        description: 'A digest of chats still waiting on your reply.',       supports: EMAIL_ONLY },
    ],
  },
  {
    id: 'scanner', label: 'Scanner & Integrations', icon: Plug,
    description: 'Connection health for your intra-oral scanners.',
    iconBg: '#ECFEFF', iconColor: '#0F766E',
    items: [
      { id: 'scan-disconnected', label: 'Scanner Disconnected',            description: 'A connected scanner dropped its connection.',  supports: IN_APP_ONLY },
      { id: 'scan-token-5d',     label: 'Token Expires in 5 Business Days', description: 'Early warning to reauthorise the connection.', supports: EMAIL_ONLY },
      { id: 'scan-token-3d',     label: 'Token Expires in 3 Business Days', description: 'Follow-up warning before the token lapses.',   supports: EMAIL_ONLY },
      { id: 'scan-token-1d',     label: 'Token Expires in 1 Business Day',  description: 'Final warning before the token expires.',      supports: BOTH },
      { id: 'scan-expired',      label: 'Scanner Connection Expired',       description: 'The connection lapsed and needs reauthorising.', supports: BOTH },
    ],
  },
  {
    id: 'billing', label: 'Billing & Subscription', icon: CreditCard,
    description: 'Plan usage and billing thresholds.',
    iconBg: '#F0FDF4', iconColor: '#2E7D32',
    items: [
      { id: 'bill-buffer', label: '5% Plan Buffer Reached', description: 'Your plan usage entered its final 5% buffer.', supports: BOTH },
      { id: 'bill-grace',  label: 'Grace Period Started',   description: 'Your subscription entered its grace period.',  supports: EMAIL_ONLY },
    ],
  },
];

// ── Preference state — persisted immediately on every change ─────────────────
type Prefs = Record<string, Record<Channel, boolean>>;
const LS_KEY = 'lab.notificationPrefs';

// Default: every supported channel enabled. Stored values overlay defaults, so
// notifications added to the catalogue later simply start at their default.
function loadPrefs(): Prefs {
  let stored: Prefs = {};
  try { stored = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') ?? {}; } catch { /* corrupt — fall back to defaults */ }
  const prefs: Prefs = {};
  for (const cat of CATEGORIES) {
    for (const item of cat.items) {
      prefs[item.id] = {
        inApp: item.supports.inApp && (stored[item.id]?.inApp ?? true),
        email: item.supports.email && (stored[item.id]?.email ?? true),
      };
    }
  }
  return prefs;
}

const CHANNEL_LABEL: Record<Channel, string> = { inApp: 'In-App', email: 'Email' };

function unsupportedTooltip(supportedChannel: Channel): string {
  return `This notification is only available via ${CHANNEL_LABEL[supportedChannel]} notifications and cannot be delivered through this channel.`;
}

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [search, setSearch] = useState('');
  // First category open by default; the rest start collapsed.
  const [openIds, setOpenIds] = useState<string[]>([CATEGORIES[0].id]);

  function persist(next: Prefs) {
    setPrefs(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage blocked — keep in-memory */ }
  }

  function setChannel(itemId: string, channel: Channel, value: boolean) {
    persist({ ...prefs, [itemId]: { ...prefs[itemId], [channel]: value } });
  }

  // Bulk: only notifications that support the channel change; the rest stay put.
  function setCategoryChannel(cat: NotificationCategory, channel: Channel, value: boolean) {
    const next = { ...prefs };
    for (const item of cat.items) {
      if (item.supports[channel]) next[item.id] = { ...next[item.id], [channel]: value };
    }
    persist(next);
  }

  function toggleOpen(id: string) {
    setOpenIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
  }

  // Search filters notifications by name; matching categories auto-expand.
  const q = search.trim().toLowerCase();
  const visibleCats = useMemo(() => {
    if (!q) return CATEGORIES;
    return CATEGORIES
      .map(cat => ({ ...cat, items: cat.items.filter(i => i.label.toLowerCase().includes(q)) }))
      .filter(cat => cat.items.length > 0);
  }, [q]);

  return (
    <div className="space-y-4">
      {/* Header — title + search */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#030213]">Notification Preferences</h2>
          <p className="text-sm text-[#717182] mt-0.5">
            Manage how you'd like to receive notifications. Changes save automatically.
          </p>
        </div>
        <div className="sm:w-80 flex-shrink-0">
          <SearchInput value={search} onChange={setSearch} placeholder="Search notifications..." />
        </div>
      </div>

      {visibleCats.length === 0 && (
        <div className="bg-white rounded-xl border border-[#E0E0E6]">
          <EmptyState type="no-results" onAction={() => setSearch('')} />
        </div>
      )}

      {visibleCats.map(cat => {
        const Icon = cat.icon;
        const open = q ? true : openIds.includes(cat.id);
        return (
          <div key={cat.id} className="bg-white rounded-xl border border-[#E0E0E6] overflow-hidden">
            {/* Category header — click to collapse; bulk controls stop
                propagation. A div (not a button) because the bulk actions are
                buttons themselves and buttons can't nest. */}
            <div
              onClick={() => toggleOpen(cat.id)}
              className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-[#FAFBFF] transition-colors"
            >
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
              <div className="flex items-center gap-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                {(['inApp', 'email'] as Channel[]).map(channel => (
                  <div key={channel} className="flex flex-col items-center gap-1">
                    <span className="text-[11px] font-medium text-[#717182] uppercase tracking-wide">{CHANNEL_LABEL[channel]}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="!px-2.5 !py-1 !text-xs" onClick={() => setCategoryChannel(cat, channel, true)}>All</Button>
                      <Button variant="ghost" size="sm" className="!px-2.5 !py-1 !text-xs" onClick={() => setCategoryChannel(cat, channel, false)}>None</Button>
                    </div>
                  </div>
                ))}
                <ChevronDown
                  onClick={() => toggleOpen(cat.id)}
                  className={`w-4 h-4 text-[#717182] cursor-pointer transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </div>
            </div>

            {open && (
              <div className="border-t border-[#F0EFF6]">
                {/* Column headers — same header treatment as the clinic
                    notification tables in Settings. */}
                <div className="grid grid-cols-[1fr_90px_90px] gap-3 px-5 py-2 bg-[#F8F9FC] border-b border-[#F0EFF6]">
                  <span />
                  <span className="text-[11px] font-medium text-[#717182] uppercase tracking-wide text-center">In-App</span>
                  <span className="text-[11px] font-medium text-[#717182] uppercase tracking-wide text-center">Email</span>
                </div>
                <div className="divide-y divide-[#F0EFF6]">
                  {cat.items.map(item => (
                    <div key={item.id} className="grid grid-cols-[1fr_90px_90px] gap-3 px-5 py-3.5 items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#030213]">{item.label}</p>
                        <p className="text-xs text-[#717182] mt-0.5">{item.description}</p>
                      </div>
                      <div className="flex justify-center">
                        <Toggle
                          on={prefs[item.id]?.inApp ?? false}
                          disabled={!item.supports.inApp}
                          title={!item.supports.inApp ? unsupportedTooltip('email') : undefined}
                          onChange={() => setChannel(item.id, 'inApp', !prefs[item.id]?.inApp)}
                        />
                      </div>
                      <div className="flex justify-center">
                        <Toggle
                          on={prefs[item.id]?.email ?? false}
                          disabled={!item.supports.email}
                          title={!item.supports.email ? unsupportedTooltip('inApp') : undefined}
                          onChange={() => setChannel(item.id, 'email', !prefs[item.id]?.email)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
