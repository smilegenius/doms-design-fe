import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Inbox } from 'lucide-react';
import Toggle from '../../../src/app/components/Toggle';
import { useAuth } from '../../../src/app/context/AuthContext';
import { teamMemberFor } from '../data';
import { Channel, RxPrefKey, setRxPref, useRxInbox } from '../inboxStore';
import DefaultRecipients from './DefaultRecipients';

// ─── "Prescription Email Inbox" notification category ────────────────────────
// Shown under the real categories on Settings → Notifications → Notification
// Preferences. Markup copied from the category card in
// src/app/pages/NotificationPreferencesPage.tsx, whose catalogue is internal.
// Like the rest of that page, each user sets their own preferences, so any
// number of people can nominate themselves for draft-ready emails.

const CHANNEL_LABEL: Record<Channel, string> = { inApp: 'In-App', email: 'Email' };

const ITEMS: { id: RxPrefKey; label: string; description: string }[] = [
  {
    id: 'draftReady',
    label: 'AI Draft Ready for Review',
    description: 'A prescription photo emailed to your lab inbox was read by AI and a draft case is ready.',
  },
  {
    id: 'mySubmissions',
    label: 'Draft Ready: Photos I Sent',
    description: 'Notify me about drafts made from prescriptions I emailed, even if the above is off.',
  },
];

export default function RxInboxNotificationCategory({ focus = false }: { focus?: boolean }) {
  const { user } = useAuth();
  const { prefs } = useRxInbox();
  const me = teamMemberFor(user?.email);
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focus]);

  if (!me) return null;
  const mine = prefs[me.email];

  function categoryChannelState(channel: Channel): 'all' | 'none' | 'mixed' {
    const onCount = ITEMS.filter(i => mine?.[i.id][channel]).length;
    return onCount === 0 ? 'none' : onCount === ITEMS.length ? 'all' : 'mixed';
  }
  function setCategoryChannel(channel: Channel, value: boolean) {
    ITEMS.forEach(i => setRxPref(me!.email, i.id, channel, value));
  }


  return (
    <div
      ref={ref}
      id="rx-inbox-notifications"
      className={`bg-white rounded-xl border overflow-hidden transition-shadow ${focus ? 'border-[#BFDBFE] ring-2 ring-[#4D8EF7]/20' : 'border-[#E0E0E6]'}`}
    >
      <div
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-[#FAFBFF] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#EEF4FF' }}>
            <Inbox className="w-5 h-5" style={{ color: '#1565C0' }} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#030213] truncate">Prescription Email Inbox</h3>
              <span className="px-1.5 py-px rounded-full bg-[#F3F3F5] text-[10px] font-medium text-[#717182] tabular-nums">{ITEMS.length}</span>
            </div>
            <p className="text-xs text-[#717182] truncate">AI draft cases made from prescription photos emailed to your lab.</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {(['inApp', 'email'] as Channel[]).map(channel => {
            const state = categoryChannelState(channel);
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
                    onClick={() => setCategoryChannel(channel, true)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                      state === 'all' ? 'bg-white text-[#1565C0] font-semibold shadow-sm' : 'text-[#717182] font-medium hover:text-[#030213]'
                    }`}
                  >
                    All
                  </button>
                  <button
                    aria-pressed={state === 'none'}
                    title={`Disable All ${CHANNEL_LABEL[channel]}`}
                    onClick={() => setCategoryChannel(channel, false)}
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
            onClick={() => setOpen(o => !o)}
            className={`w-4 h-4 text-[#717182] cursor-pointer transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {open && (
        <div className="border-t border-[#F0EFF6]">
          <div className="grid grid-cols-[1fr_90px_90px] gap-3 px-5 py-2 bg-[#F8F9FC] border-b border-[#F0EFF6]">
            <span />
            <span className="text-[11px] font-medium text-[#717182] uppercase tracking-wide text-center">In-App</span>
            <span className="text-[11px] font-medium text-[#717182] uppercase tracking-wide text-center">Email</span>
          </div>
          <div className="divide-y divide-[#F0EFF6]">
            {ITEMS.map(item => (
              <div key={item.id} className="grid grid-cols-[1fr_90px_90px] gap-3 px-5 py-3.5 items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#030213]">{item.label}</p>
                  <p className="text-xs text-[#717182] mt-0.5">{item.description}</p>
                </div>
                {(['inApp', 'email'] as Channel[]).map(channel => (
                  <div key={channel} className="flex justify-center">
                    <Toggle
                      on={mine?.[item.id][channel] ?? false}
                      onChange={() => setRxPref(me.email, item.id, channel, !mine?.[item.id][channel])}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <DefaultRecipients
            meEmail={me.email}
            label="Draft-ready alerts by default"
            isOn={e => !!(prefs[e]?.draftReady.inApp || prefs[e]?.draftReady.email)}
            channels={e => [prefs[e]?.draftReady.inApp && 'Bell', prefs[e]?.draftReady.email && 'Email'].filter(Boolean).join(' + ')}
            onAdd={m => { setRxPref(m.email, 'draftReady', 'inApp', true); setRxPref(m.email, 'draftReady', 'email', true); }}
            onRemove={m => { setRxPref(m.email, 'draftReady', 'inApp', false); setRxPref(m.email, 'draftReady', 'email', false); }}
          />
        </div>
      )}
    </div>
  );
}
