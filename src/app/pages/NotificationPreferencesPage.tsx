import { useMemo, useState } from 'react';
import {
  ChevronDown, FolderOpen, MessageSquare, ShieldCheck,
} from 'lucide-react';
import Toggle from '../components/Toggle';
import SearchInput from '../components/SearchInput';
import EmptyState from '../components/EmptyState';

// ─── Lab Notification Preferences ────────────────────────────────────────────
// Per-notification In-App + Email controls, grouped by category, rendered as
// the Notifications tab of Lab Settings. Built entirely from the app's base
// components (Toggle, Button, SearchInput, EmptyState) — the PO reference
// design informed layout/behaviour only.
//
// ONLY non-critical (informational) notifications are configurable, and only
// they appear here. Business-critical notifications — anything requiring
// immediate action to prevent operational disruption (Scanner Disconnected,
// Scanner Token Expiry Reminders, Scanner Connection Expired, Clinic Responded
// to an On Hold Request, 5% Plan Buffer Reached, Grace Period Started, …) —
// are always enabled, cannot be disabled, and are deliberately ABSENT from
// this page. The footer note below the categories explains that to the user.
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

// Configurable (non-critical) notifications ONLY. Business-critical types —
// Scanner Disconnected, Scanner Token Expiry Reminders, Scanner Connection
// Expired, Clinic Responded to an On Hold Request, 5% Plan Buffer Reached,
// Grace Period Started, and anything else requiring immediate action — are
// always delivered and intentionally have no entry here.
const CATEGORIES: NotificationCategory[] = [
  {
    id: 'messages', label: 'Messages', icon: MessageSquare,
    description: 'Chat activity across your cases.',
    iconBg: '#F3EEFF', iconColor: '#7C3AED',
    items: [
      { id: 'msg-new',     label: 'New Chat Message',      description: 'Notify me about new messages in my case chats.',      supports: BOTH },
      { id: 'msg-mention', label: 'Someone Mentioned You', description: 'Notify me when I am @-mentioned in a conversation.',  supports: BOTH },
    ],
  },
  {
    id: 'case-updates', label: 'Case Updates', icon: FolderOpen,
    description: 'Receive notifications about case lifecycle changes.',
    iconBg: '#EEF4FF', iconColor: '#4D8EF7',
    items: [
      { id: 'case-draft-scanner', label: 'Draft Case Created (via Scanner API)', description: 'A draft case arrived from a connected scanner.',            supports: IN_APP_ONLY },
      { id: 'case-created',       label: 'Case Created',                         description: 'Notify me when a new case is created.',                     supports: BOTH },
      { id: 'case-info-received', label: 'Additional Information Received',      description: 'Requested files or details have arrived on a case.',       supports: BOTH },
      { id: 'case-due-change',    label: 'Due Date Changed',                     description: 'Notify me when a case due date moves.',                     supports: BOTH },
      { id: 'case-cancelled',     label: 'Case Cancelled',                       description: 'Notify me when a case is cancelled.',                       supports: BOTH },
      { id: 'case-general',       label: 'General Case Updates',                 description: 'Case activity not covered by the notification types above.', supports: IN_APP_ONLY },
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

// PM copy, verbatim: "This notification is only available via {{Email/In-App}} notifications."
function unsupportedTooltip(supportedChannel: Channel): string {
  return `This notification is only available via ${CHANNEL_LABEL[supportedChannel]} notifications.`;
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

  // Live state of a category's channel, driving the All/None segmented control:
  // 'all' / 'none' light up their segment; 'mixed' lights neither. Only
  // notifications that support the channel count.
  function categoryChannelState(cat: NotificationCategory, channel: Channel): 'all' | 'none' | 'mixed' {
    const supported = cat.items.filter(i => i.supports[channel]);
    const onCount = supported.filter(i => prefs[i.id]?.[channel]).length;
    return onCount === 0 ? 'none' : onCount === supported.length ? 'all' : 'mixed';
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
                {/* All/None per channel — a stateful segmented control: the
                    segment matching the category's live state lights up (a
                    partial mix lights neither), and it updates as individual
                    toggles change. */}
                {(['inApp', 'email'] as Channel[]).map(channel => {
                  const state = categoryChannelState(cat, channel);
                  return (
                    <div key={channel} className="flex flex-col items-center gap-1">
                      <span className="text-[11px] font-medium text-[#717182] uppercase tracking-wide">{CHANNEL_LABEL[channel]}</span>
                      <div
                        className="inline-flex p-0.5 bg-[#F3F3F5] rounded-lg"
                        title={state === 'mixed' ? `Some ${CHANNEL_LABEL[channel]} notifications are on` : undefined}
                      >
                        <button
                          aria-pressed={state === 'all'}
                          title={`Enable All ${CHANNEL_LABEL[channel]}`}
                          onClick={() => setCategoryChannel(cat, channel, true)}
                          className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                            state === 'all' ? 'bg-white text-[#1565C0] font-semibold shadow-sm' : 'text-[#717182] font-medium hover:text-[#030213]'
                          }`}
                        >
                          All
                        </button>
                        <button
                          aria-pressed={state === 'none'}
                          title={`Disable All ${CHANNEL_LABEL[channel]}`}
                          onClick={() => setCategoryChannel(cat, channel, false)}
                          className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                            state === 'none' ? 'bg-white text-[#1565C0] font-semibold shadow-sm' : 'text-[#717182] font-medium hover:text-[#030213]'
                          }`}
                        >
                          None
                        </button>
                      </div>
                    </div>
                  );
                })}
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

      {/* Business-critical notifications are always on — they don't appear
          above, and this note explains their absence so users don't hunt for
          the missing toggles. Hidden while searching (it would read as a
          confusing non-result). */}
      {!q && (
        <div className="rounded-xl border border-[#BFDBFE] bg-[#EEF4FF] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-white border border-[#BFDBFE] text-[#1565C0] flex items-center justify-center flex-shrink-0 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#1565C0]">Business-critical notifications are always on</p>
              <p className="text-[11px] text-[#3B6BAE] leading-relaxed mt-0.5">
                Notifications that require immediate action to prevent operational disruption — such as{' '}
                <span className="font-semibold">Scanner Disconnected</span>,{' '}
                <span className="font-semibold">Scanner Token Expiry Reminders</span>,{' '}
                <span className="font-semibold">Scanner Connection Expired</span>,{' '}
                <span className="font-semibold">Clinic Responded to an On Hold Request</span>,{' '}
                <span className="font-semibold">5% Plan Buffer Reached</span> and{' '}
                <span className="font-semibold">Grace Period Started</span> — are always delivered and cannot be
                disabled, so they aren't listed here.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
