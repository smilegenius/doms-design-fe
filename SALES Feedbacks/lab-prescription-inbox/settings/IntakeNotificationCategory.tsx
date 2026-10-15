import { useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';
import Toggle from '../../../src/app/components/Toggle';
import { useAuth } from '../../../src/app/context/AuthContext';
import { teamMemberFor } from '../data';
import { IntakePrefs, setIntakePref, useIntake } from '../../intake-form/intakeStore';
import DefaultRecipients from './DefaultRecipients';

// ─── "Website Intake Form" notification category ─────────────────────────────
// Same card markup as RxInboxNotificationCategory (copied from
// src/app/pages/NotificationPreferencesPage.tsx). Each user opts themselves in.

const CHANNELS: { id: keyof IntakePrefs; label: string }[] = [{ id: 'inApp', label: 'In-App' }, { id: 'email', label: 'Email' }];

export default function IntakeNotificationCategory({ focus = false }: { focus?: boolean }) {
  const { user } = useAuth();
  const { prefs } = useIntake();
  const me = teamMemberFor(user?.email);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focus) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [focus]);
  if (!me) return null;
  const mine = prefs[me.email];

  return (
    <div ref={ref} id="intake-notifications" className={`bg-white rounded-xl border overflow-hidden transition-shadow ${focus ? 'border-[#BFDBFE] ring-2 ring-[#4D8EF7]/20' : 'border-[#E0E0E6]'}`}>
      <div className="px-5 py-4 flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#EEF4FF' }}>
          <Globe className="w-5 h-5" style={{ color: '#1565C0' }} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#030213] truncate">Website Intake Form</h3>
            <span className="px-1.5 py-px rounded-full bg-[#F3F3F5] text-[10px] font-medium text-[#717182] tabular-nums">1</span>
          </div>
          <p className="text-xs text-[#717182] truncate">New cases dentists send through the form on your website.</p>
        </div>
      </div>
      <div className="border-t border-[#F0EFF6]">
        <div className="grid grid-cols-[1fr_90px_90px] gap-3 px-5 py-2 bg-[#F8F9FC] border-b border-[#F0EFF6]">
          <span />
          {CHANNELS.map(c => <span key={c.id} className="text-[11px] font-medium text-[#717182] uppercase tracking-wide text-center">{c.label}</span>)}
        </div>
        <div className="grid grid-cols-[1fr_90px_90px] gap-3 px-5 py-3.5 items-center">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#030213]">New Case Request from Website</p>
            <p className="text-xs text-[#717182] mt-0.5">A dentist sent a case through your website form and a draft is ready to check. Each team member chooses this for themselves.</p>
          </div>
          {CHANNELS.map(c => (
            <div key={c.id} className="flex justify-center">
              <Toggle on={mine?.[c.id] ?? false} onChange={() => setIntakePref(me.email, c.id, !mine?.[c.id])} />
            </div>
          ))}
        </div>
        <DefaultRecipients
          meEmail={me.email}
          isOn={e => !!(prefs[e]?.inApp || prefs[e]?.email)}
          channels={e => [prefs[e]?.inApp && 'Bell', prefs[e]?.email && 'Email'].filter(Boolean).join(' + ')}
          onAdd={m => { setIntakePref(m.email, 'inApp', true); setIntakePref(m.email, 'email', true); }}
          onRemove={m => { setIntakePref(m.email, 'inApp', false); setIntakePref(m.email, 'email', false); }}
        />
      </div>
    </div>
  );
}
