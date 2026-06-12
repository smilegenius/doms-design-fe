import { useState } from 'react';
import { ArrowLeft, Search, Plus, Paperclip, Send, Download, Eye, Info, Building2, Package } from 'lucide-react';

type ConversationType = 'Clinic' | 'Lab' | 'Supplier';

interface Attachment {
  filename: string;
  sizeKb: number;
}

interface Message {
  id: string;
  fromName: string;
  time: string;
  text?: string;
  attachment?: Attachment;
  dateLabel?: string;
}

interface Conversation {
  id: string;
  name: string;
  type: ConversationType;
  unread: number;
  lastMessage: string;
  lastDate: string;
  initials: string;
  email: string;
  phone: string;
  address: string;
  messages: (Message | { dateLabel: string })[];
}

const CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    name: 'Laburnum Dental',
    type: 'Clinic',
    unread: 14,
    lastMessage: 'hahfsd',
    lastDate: '12/8/2025',
    initials: 'LD',
    email: 'ttt-test-clinic-2@yopmail.com',
    phone: '7868104189',
    address: 'delhi',
    messages: [
      { id: 'm1', fromName: 'Laburnum Dental', time: '12:56 PM', text: '----->' },
      { id: 'm2', fromName: 'Laburnum Dental', time: '02:02 PM', attachment: { filename: 'Untitled.pages', sizeKb: 90.4 } },
      { id: 'm3', fromName: 'Laburnum Dental', time: '02:59 PM', attachment: { filename: 'Untitled.pages', sizeKb: 90.4 } },
      { dateLabel: 'Mon, Dec 8' },
      { id: 'm4', fromName: 'Laburnum Dental', time: '12:19 PM', attachment: { filename: 'Untitled.pages', sizeKb: 90.4 } },
      { id: 'm5', fromName: 'Laburnum Dental', time: '12:27 PM', text: 'hahfsd' },
    ],
  },
  {
    id: 'c2',
    name: 'S4S',
    type: 'Lab',
    unread: 9,
    lastMessage: 'hye',
    lastDate: '12/4/2025',
    initials: 'S',
    email: 's4s-lab@yopmail.com',
    phone: '7868100000',
    address: 'manchester',
    messages: [
      { id: 'm1', fromName: 'S4S', time: '10:21 AM', text: 'hye' },
    ],
  },
];

function typeChip(type: ConversationType) {
  switch (type) {
    case 'Clinic':   return 'bg-[#FFE4E6] text-[#BE123C]';
    case 'Lab':      return 'bg-[#EEF4FF] text-[#1565C0]';
    case 'Supplier': return 'bg-[#F0FDF4] text-[#2E7D32]';
  }
}

interface MessagesPageProps {
  onClose: () => void;
}

export default function MessagesPage({ onClose }: MessagesPageProps) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [activeId, setActiveId] = useState<string>(CONVERSATIONS[0].id);
  const [draft, setDraft] = useState('');
  const [contactInfoOpen, setContactInfoOpen] = useState(false);

  const filtered = CONVERSATIONS.filter(c => {
    if (tab === 'unread' && c.unread === 0) return false;
    if (search.trim() && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const active = CONVERSATIONS.find(c => c.id === activeId)!;
  const unreadCount = CONVERSATIONS.filter(c => c.unread > 0).length;

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FC]">
      {/* Top bar with back button */}
      <header className="flex-shrink-0 h-14 bg-white border-b border-[#F0EFF6] flex items-center px-4 gap-3 z-30">
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#5A5568] hover:text-[#030213] hover:bg-[#F8F9FC] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="h-6 w-px bg-[#E0E0E6]" />
        <h1 className="text-base font-semibold text-[#030213]">Messages</h1>
      </header>

      <div className="flex flex-1 min-h-0">
      {/* Conversations list */}
      <aside className="w-[300px] flex-shrink-0 bg-white border-r border-[#F0EFF6] flex flex-col">
        <div className="px-4 pt-4 pb-3 border-b border-[#F0EFF6]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-[#030213]">Conversations</h2>
            <button
              className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white flex items-center justify-center hover:opacity-90 transition-opacity"
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0A0B0]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Clinics..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-[#E0E0E6] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
            />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                tab === 'all' ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white' : 'text-[#717182] hover:bg-[#F3F3F5]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTab('unread')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                tab === 'unread' ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white' : 'text-[#717182] hover:bg-[#F3F3F5]'
              }`}
            >
              Unread
              {unreadCount > 0 && (
                <span className={`px-1.5 rounded-full text-[10px] font-bold ${
                  tab === 'unread' ? 'bg-white/20 text-white' : 'bg-[#D4183D] text-white'
                }`}>{unreadCount}</span>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map(c => {
            const isActive = c.id === activeId;
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full px-4 py-3 border-b border-[#F8F8FC] flex items-start gap-3 text-left transition-colors ${
                  isActive ? 'bg-[#EEF4FF]' : 'hover:bg-[#F8F9FC]'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-[#F3F3F5] flex items-center justify-center text-xs font-semibold text-[#5A5568]">
                    {c.initials}
                  </div>
                  {c.unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D4183D] text-white text-[10px] font-bold flex items-center justify-center">
                      {c.unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-medium text-[#030213] truncate">{c.name}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${typeChip(c.type)}`}>
                        {c.type}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#A0A0B0] flex-shrink-0">{c.lastDate}</span>
                  </div>
                  <p className="text-xs text-[#717182] truncate mt-0.5">{c.lastMessage}</p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Active conversation */}
      <section className="flex-1 flex flex-col min-w-0 bg-white">
        <div className="flex-shrink-0 h-14 px-5 border-b border-[#F0EFF6] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#F3F3F5] flex items-center justify-center text-[11px] font-semibold text-[#5A5568]">
            {active.initials}
          </div>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold text-[#030213] truncate">{active.name}</p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeChip(active.type)}`}>
              {active.type === 'Supplier'
                ? <Package className="w-3 h-3" />
                : <Building2 className="w-3 h-3" />}
              {active.type === 'Clinic' || active.type === 'Lab' ? 'Practice' : 'Supplier'} · {active.type}
            </span>
          </div>
          <button
            onClick={() => setContactInfoOpen(o => !o)}
            title={contactInfoOpen ? 'Hide contact info' : 'Show contact info'}
            className={`p-2 rounded-lg transition-colors ${contactInfoOpen ? 'bg-[#EEF4FF] text-[#4D8EF7]' : 'text-[#717182] hover:text-[#030213] hover:bg-[#F8F9FC]'}`}
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-[#FAFBFC]">
          {active.messages.map((m, i) => {
            if ('dateLabel' in m && !('id' in m)) {
              return (
                <div key={`d-${i}`} className="flex items-center justify-center">
                  <span className="px-3 py-1 text-[10px] text-[#717182] bg-white border border-[#E0E0E6] rounded-full">
                    {m.dateLabel}
                  </span>
                </div>
              );
            }
            const msg = m as Message;
            return (
              <div key={msg.id} className="max-w-md">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-[#5A5568]">{msg.fromName}</span>
                  <span className="text-[10px] text-[#A0A0B0]">{msg.time}</span>
                </div>
                <div className="bg-white border border-[#E0E0E6] rounded-xl px-3 py-2.5">
                  {msg.text && <p className="text-sm text-[#030213]">{msg.text}</p>}
                  {msg.attachment && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#030213] mb-2">
                        <Paperclip className="w-3.5 h-3.5 text-[#717182]" />
                        Attachment
                      </div>
                      <div className="border border-[#F0EFF6] rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-2">
                          <Paperclip className="w-3.5 h-3.5 text-[#717182]" />
                          <span className="text-xs font-semibold text-[#030213] truncate">{msg.attachment.filename}</span>
                          <span className="text-[10px] text-[#A0A0B0]">{msg.attachment.sizeKb} KB</span>
                        </div>
                        <div className="flex items-center gap-3 pt-2 border-t border-[#F0EFF6]">
                          <button className="flex items-center gap-1 text-[11px] font-medium text-[#717182] hover:text-[#030213]">
                            <Download className="w-3 h-3" /> Download
                          </button>
                          <button className="flex items-center gap-1 text-[11px] font-medium text-[#4D8EF7] hover:text-[#3578E5]">
                            <Eye className="w-3 h-3" /> Preview
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <div className="flex-shrink-0 border-t border-[#F0EFF6] p-3">
          <div className="flex items-center gap-2 border border-[#E0E0E6] rounded-xl px-3 py-2">
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Write a message..."
              className="flex-1 text-sm text-[#030213] bg-transparent outline-none placeholder-[#A0A0B0]"
            />
            <button className="p-1.5 text-[#717182] hover:text-[#030213] rounded transition-colors">
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              disabled={!draft.trim()}
              onClick={() => setDraft('')}
              className="p-1.5 text-[#4D8EF7] hover:text-[#3578E5] rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Contact info — collapsed by default, toggle via Info button */}
      {contactInfoOpen && (
      <aside className="w-[280px] flex-shrink-0 bg-white border-l border-[#F0EFF6] flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-[#F0EFF6]">
          <h2 className="text-base font-semibold text-[#030213]">Contact Info</h2>
        </div>
        <div className="flex flex-col items-center px-5 py-6 border-b border-[#F0EFF6]">
          <div className="w-16 h-16 rounded-full bg-[#F3F3F5] flex items-center justify-center text-lg font-semibold text-[#5A5568] mb-3">
            {active.initials}
          </div>
          <p className="text-base font-semibold text-[#030213]">{active.name}</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${typeChip(active.type)}`}>
            {active.type}
          </span>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-1">Email</p>
            <p className="text-xs text-[#030213] break-all">{active.email}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-1">Phone</p>
            <p className="text-xs text-[#030213]">{active.phone}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-1">Address</p>
            <p className="text-xs text-[#030213]">{active.address}</p>
          </div>
        </div>
      </aside>
      )}
      </div>
    </div>
  );
}
