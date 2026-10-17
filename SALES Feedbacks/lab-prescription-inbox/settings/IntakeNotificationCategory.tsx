import { useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';
import Toggle from '../../../src/app/components/Toggle';
import { useAuth } from '../../../src/app/context/AuthContext';
import { teamMemberFor } from '../data';
import { IntakePrefs, LabLinkNotice, setIntakePref, useIntake } from '../../intake-form/intakeStore';
import DefaultRecipients from './DefaultRecipients';

// ─── "LabLink" notification category ─────────────────────────────────────────
// Same card markup as RxInboxNotificationCategory (copied from
// src/app/pages/NotificationPreferencesPage.tsx). Two notifications, each with
// its own bell / email switches per person; admins can add people by default.

const CHANNELS: { id: keyof IntakePrefs; label: string }[] = [{ id: 'inApp', label: 'In-App' }, { id: 'email', label: 'Email' }];
const ITEMS: { id: LabLinkNotice; label: string; description: string }[] = [
  { id: 'newCase', label: 'New Case Request', description: 'A dentist sent a new case through LabLink and a draft is ready to check.' },
  { id: 'files', label: 'Files for an Existing Case', description: 'A dentist sent files or notes for a case: synced by reference, or waiting for you to match.' },
];

export default function IntakeNotificationCategory({ focus = false }: { focus?: boolean }) {
  const { user } = useAuth();
  const { prefs } = useIntake();
  const me = teamMemberFor(user?.email);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focus) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [focus]);
  if (!me) return null;
  const mine = prefs[me.email];
  const any = (e: string) => ITEMS.some(i => prefs[e]?.[i.id]?.inApp || prefs[e]?.[i.id]?.email);
  const channels = (e: string) => {
    const on = (c: keyof IntakePrefs) => ITEMS.some(i => prefs[e]?.[i.id]?.[c]);
    return [on('inApp') && 'Bell', on('email') && 'Email'].filter(Boolean).join(' + ');
  };
  const setAll = (e: string, v: boolean) => ITEMS.forEach(i => CHANNELS.forEach(c => setIntakePref(e, i.id, c.id, v)));

  return (
    <div ref={ref} id="intake-notifications" className={`bg-white rounded-xl border overflow-hidden transition-shadow ${focus ? 'border-[#BFDBFE] ring-2 ring-[#4D8EF7]/20' : 'border-[#E0E0E6]'}`}>
      <div className="px-5 py-4 flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#EEF4FF' }}>
          <Globe className="w-5 h-5" style={{ color: '#1565C0' }} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#030213] truncate">LabLink</h3>
            <span className="px-1.5 py-px rounded-full bg-[#F3F3F5] text-[10px] font-medium text-[#717182] tabular-nums">{ITEMS.length}</span>
          </div>
          <p className="text-xs text-[#717182] truncate">New cases and files dentists send through your LabLink.</p>
        </div>
      </div>
      <div className="border-t border-[#F0EFF6]">
        <div className="grid grid-cols-[1fr_90px_90px] gap-3 px-5 py-2 bg-[#F8F9FC] border-b border-[#F0EFF6]">
          <span />
          {CHANNELS.map(c => <span key={c.id} className="text-[11px] font-medium text-[#717182] uppercase tracking-wide text-center">{c.label}</span>)}
        </div>
        <div className="divide-y divide-[#F0EFF6]">
          {ITEMS.map(item => (
            <div key={item.id} className="grid grid-cols-[1fr_90px_90px] gap-3 px-5 py-3.5 items-center">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#030213]">{item.label}</p>
                <p className="text-xs text-[#717182] mt-0.5">{item.description}</p>
              </div>
              {CHANNELS.map(c => (
                <div key={c.id} className="flex justify-center">
                  <Toggle on={mine?.[item.id]?.[c.id] ?? false} onChange={() => setIntakePref(me.email, item.id, c.id, !mine?.[item.id]?.[c.id])} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <DefaultRecipients meEmail={me.email} isOn={any} channels={channels} onAdd={m => setAll(m.email, true)} onRemove={m => setAll(m.email, false)} />
      </div>
    </div>
  );
}
