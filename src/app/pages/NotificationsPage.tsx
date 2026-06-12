import { useState } from 'react';
import { Search, Settings as SettingsIcon, Clock } from 'lucide-react';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
}

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
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
}

export default function NotificationsPage({ onOpenSettings }: NotificationsPageProps) {
  const [tab, setTab] = useState<'all' | 'unread' | 'read'>('all');
  const [search, setSearch] = useState('');

  const filtered = MOCK_NOTIFICATIONS.filter(n => {
    if (tab === 'unread' && n.read) return false;
    if (tab === 'read' && !n.read) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const allCount = MOCK_NOTIFICATIONS.length;
  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length;
  const readCount = MOCK_NOTIFICATIONS.filter(n => n.read).length;

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
          filtered.map(n => (
            <div
              key={n.id}
              className="bg-white rounded-lg border border-[#E0E0E6] px-5 py-4 flex items-start justify-between gap-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#030213] mb-1">{n.title}</p>
                <p className="text-xs text-[#717182] leading-relaxed">{n.body}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#A0A0B0] flex-shrink-0 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5" />
                {n.timestamp}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
