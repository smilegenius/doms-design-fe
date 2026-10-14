import { Globe, Users } from 'lucide-react';
import Toggle from '../../../src/app/components/Toggle';
import { useAuth } from '../../../src/app/context/AuthContext';
import { LAB_TEAM, teamMemberFor } from '../data';
import { IntakePrefs, setIntakePref, useIntake } from '../../intake-form/intakeStore';

// ─── "Website Intake Form" notification category ─────────────────────────────
// Same card markup as RxInboxNotificationCategory (copied from
// src/app/pages/NotificationPreferencesPage.tsx). Each user opts themselves in.

const CHANNELS: { id: keyof IntakePrefs; label: string }[] = [{ id: 'inApp', label: 'In-App' }, { id: 'email', label: 'Email' }];

export default function IntakeNotificationCategory() {
  const { user } = useAuth();
  const { prefs } = useIntake();
  const me = teamMemberFor(user?.email);
  if (!me) return null;
  const mine = prefs[me.email];
  const others = LAB_TEAM.filter(m => m.email !== me.email && prefs[m.email]?.email);

  return (
    <div className="bg-white rounded-xl border border-[#E0E0E6] overflow-hidden">
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
            <p className="text-xs text-[#717182] mt-0.5">A dentist submitted your intake form and a draft case is ready to check.</p>
          </div>
          {CHANNELS.map(c => (
            <div key={c.id} className="flex justify-center">
              <Toggle on={mine?.[c.id] ?? false} onChange={() => setIntakePref(me.email, c.id, !mine?.[c.id])} />
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-[#F0EFF6] bg-[#F8F9FC] flex items-start gap-2">
          <Users className="w-3.5 h-3.5 text-[#717182] flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#717182] leading-relaxed">
            {others.length
              ? <>Also emailed about website requests: <span className="font-medium text-[#5A5568]">{others.map(m => m.name).join(', ')}</span>.</>
              : 'No one else on your team is emailed about website requests yet.'}
          </p>
        </div>
      </div>
    </div>
  );
}
