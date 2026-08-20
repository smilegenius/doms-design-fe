import { useMemo, useState } from 'react';
import { Search, Settings as SettingsIcon, Clock, Bell, AlertTriangle, ShieldAlert, Plug, PlayCircle, RefreshCw } from 'lucide-react';
import { ScannerReconnectFlow, useScannerReconnectFlow } from '../components/ScannerReconnect';
import {
  HELP_VIDEO_LABEL,
  RECONNECT_LABEL,
  allReminders,
  formatTimestamp,
  resolvePlaceholders,
  useScannerConnections,
} from '../data/scannerConnections';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  // Urgent chat notifications (immediate + 2/4/6/8h reminders) render with a
  // red alert chip; escalations (reminders exhausted, routed to the contact
  // from the Escalation Matrix) get an orange shield; scanner token-expiry
  // reminders get the teal plug (red once the token has actually lapsed);
  // everything else keeps the neutral bell.
  type?: 'urgent-message' | 'urgent-reminder' | 'escalation' | 'scanner-expiry' | 'scanner-expired';
  /** Scanner this notification is about — drives its Reconnect Scanner action. */
  scannerId?: string;
  /** Action buttons rendered under the body. Scanner reminders carry both. */
  actions?: ('reconnect' | 'video')[];
}

// Icon chip per notification type — shared by this page and the bell popover.
export function notificationIcon(type?: NotificationItem['type']) {
  if (type === 'urgent-message' || type === 'urgent-reminder') {
    return { Icon: AlertTriangle, bg: '#FEF2F2', color: '#DC2626' };
  }
  if (type === 'escalation') {
    return { Icon: ShieldAlert, bg: '#FFF7ED', color: '#E65100' };
  }
  if (type === 'scanner-expired') {
    return { Icon: AlertTriangle, bg: '#FEF2F2', color: '#B91C1C' };
  }
  if (type === 'scanner-expiry') {
    return { Icon: Plug, bg: '#ECFEFF', color: '#0F766E' };
  }
  return { Icon: Bell, bg: '#F3F3F5', color: '#717182' };
}

// ─── Scanner token-expiry reminders ───────────────────────────────────────────
// Derived live from the lab's scanner connections rather than stored, so the
// feed reflects exactly what the reminder workflow has sent for the CURRENT
// token cycle — and empties the instant a scanner is reconnected (AC4).
// Lab portal only; the other portals pass enabled = false.
export function useScannerNotificationItems(enabled: boolean): NotificationItem[] {
  const connections = useScannerConnections();
  return useMemo(() => {
    if (!enabled) return [];
    return allReminders(connections).map(r => ({
      id: r.id,
      title: resolvePlaceholders(r.copy.emailSubject, { scannerName: r.scannerName, userName: '' }),
      body: resolvePlaceholders(r.copy.inApp, { scannerName: r.scannerName, userName: '' }),
      timestamp: formatTimestamp(r.firedAt),
      read: false,
      type: r.stage === 'expired' ? ('scanner-expired' as const) : ('scanner-expiry' as const),
      scannerId: r.scannerId,
      actions: ['reconnect', 'video'] as ('reconnect' | 'video')[],
    }));
  }, [connections, enabled]);
}

/** The Reconnect Scanner / Watch Video CTAs every expiry notification carries. */
export function NotificationActions({ item, flow, size = 'md' }: {
  item: NotificationItem;
  flow: ScannerReconnectFlow;
  size?: 'sm' | 'md';
}) {
  const connections = useScannerConnections();
  if (!item.actions?.length) return null;
  const connection = connections.find(c => c.id === item.scannerId);
  const pad = size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]';
  return (
    <div className="flex items-center gap-2 mt-2">
      {item.actions.includes('reconnect') && connection && (
        <button
          onClick={() => flow.openReconnect(connection)}
          className={`inline-flex items-center gap-1.5 rounded-lg font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity ${pad}`}
        >
          <RefreshCw className="w-3 h-3" /> {RECONNECT_LABEL}
        </button>
      )}
      {item.actions.includes('video') && (
        <button
          onClick={flow.openVideo}
          className={`inline-flex items-center gap-1.5 rounded-lg font-semibold text-[#030213] bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors ${pad}`}
        >
          <PlayCircle className="w-3 h-3" /> {HELP_VIDEO_LABEL}
        </button>
      )}
    </div>
  );
}

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n0-escalation',
    type: 'escalation',
    title: 'Escalation: Action Required for Scanner Disconnected',
    body: 'An unresolved Scanner Disconnected event has been escalated to you. Please review and take the necessary action. Reference: iTero Element 5D · Laburnum Dental.',
    timestamp: '20-May-2026, 02:00 PM',
    read: false,
  },
  {
    id: 'n0-reminder',
    type: 'urgent-reminder',
    title: 'Reminder: Urgent message awaiting your response',
    body: 'An urgent message from Laburnum Dental is still awaiting your response. Please respond as soon as possible to ensure timely communication.',
    timestamp: '20-May-2026, 01:15 PM',
    read: false,
  },
  {
    id: 'n0-urgent',
    type: 'urgent-message',
    title: 'Urgent message received from Laburnum Dental',
    body: 'You have received an urgent message from Laburnum Dental regarding Case CASE-051. Please review and respond as soon as possible.',
    timestamp: '20-May-2026, 11:15 AM',
    read: false,
  },
  {
    id: 'n1',
    title: '7 days till monthly pay period auto-extraction',
    body: 'The monthly pay period auto-extraction for May is due in 7 days. Please ensure all invoices are cleared for payment to be included in the extraction file.',
    timestamp: '18-May-2026, 11:00 AM',
    read: false,
  },
  {
    id: 'n2',
    title: '7 days till monthly pay period auto-extraction',
    body: 'The monthly pay period auto-extraction for May is due in 7 days. Please ensure all invoices are cleared for payment to be included in the extraction file.',
    timestamp: '18-May-2026, 11:00 AM',
    read: false,
  },
  {
    id: 'n3',
    title: '7 days till monthly pay period auto-extraction',
    body: 'The monthly pay period auto-extraction for May is due in 7 days. Please ensure all invoices are cleared for payment to be included in the extraction file.',
    timestamp: '18-May-2026, 11:00 AM',
    read: false,
  },
  {
    id: 'n4',
    title: '1 day till monthly pay period auto-extraction',
    body: 'The monthly pay period auto-extraction for March is due tomorrow. Please ensure all invoices are cleared for payment to be included in the extraction file.',
    timestamp: '24-Mar-2026, 11:00 AM',
    read: false,
  },
  {
    id: 'n5',
    title: '7 days till monthly pay period auto-extraction',
    body: 'The monthly pay period auto-extraction for March is due in 7 days. Please ensure all invoices are cleared for payment to be included in the extraction file.',
    timestamp: '18-Mar-2026, 11:00 AM',
    read: false,
  },
];

interface NotificationsPageProps {
  onOpenSettings: () => void;
  /** Lab portal also receives the scanner token-expiry reminders. */
  portal?: 'supplier' | 'clinic' | 'lab';
}

export default function NotificationsPage({ onOpenSettings, portal = 'supplier' }: NotificationsPageProps) {
  const [tab, setTab] = useState<'all' | 'unread' | 'read'>('all');
  const [search, setSearch] = useState('');
  const flow = useScannerReconnectFlow();
  const scannerItems = useScannerNotificationItems(portal === 'lab');

  // Scanner reminders are the newest thing in the feed while a token is
  // lapsing, so they sit on top of the seeded mock notifications.
  const allItems = useMemo(() => [...scannerItems, ...MOCK_NOTIFICATIONS], [scannerItems]);

  const filtered = allItems.filter(n => {
    if (tab === 'unread' && n.read) return false;
    if (tab === 'read' && !n.read) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const allCount = allItems.length;
  const unreadCount = allItems.filter(n => !n.read).length;
  const readCount = allItems.filter(n => n.read).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] mb-2">Notifications</h1>
          <p className="text-sm sm:text-base text-[#717182]">
            View and manage all system notifications triggered by activity on your cases
          </p>
        </div>
        <button
          onClick={onOpenSettings}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#030213] hover:text-[#4D8EF7] transition-colors"
        >
          <SettingsIcon className="w-4 h-4" />
          Notification settings
        </button>
      </div>

      {/* Search + tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717182]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or description"
            className="w-full pl-11 pr-4 py-3 bg-white border border-[#E0E0E6] rounded-lg text-sm text-[#030213] placeholder:text-[#A0A0B0] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-[#F3F3F5] rounded-lg">
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'all'
                ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white shadow-sm'
                : 'text-[#717182] hover:text-[#030213]'
            }`}
          >
            All ({allCount})
          </button>
          <button
            onClick={() => setTab('unread')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'unread' ? 'bg-white text-[#030213] shadow-sm' : 'text-[#717182] hover:text-[#030213]'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setTab('read')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'read' ? 'bg-white text-[#030213] shadow-sm' : 'text-[#717182] hover:text-[#030213]'
            }`}
          >
            Read ({readCount})
          </button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-[#E0E0E6] py-16 text-center">
            <p className="text-sm text-[#717182]">No notifications found</p>
          </div>
        ) : (
          filtered.map(n => {
            const { Icon, bg, color } = notificationIcon(n.type);
            return (
              <div
                key={n.id}
                className="bg-white rounded-lg border border-[#E0E0E6] px-5 py-4 flex items-start justify-between gap-4 hover:shadow-sm transition-shadow"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: bg }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#030213] mb-1">{n.title}</p>
                  <p className="text-xs text-[#717182] leading-relaxed">{n.body}</p>
                  <NotificationActions item={n} flow={flow} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#A0A0B0] flex-shrink-0 whitespace-nowrap">
                  <Clock className="w-3.5 h-3.5" />
                  {n.timestamp}
                </div>
              </div>
            );
          })
        )}
      </div>

      {flow.modals}
    </div>
  );
}
