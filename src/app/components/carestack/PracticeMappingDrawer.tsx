import { useEffect, useMemo, useState } from 'react';
import { MapPin, ArrowLeft, ChevronRight, Stethoscope, Users, CheckCircle2, AlertTriangle, Clock, Search } from 'lucide-react';
import SideDrawer from '../SideDrawer';
import { practiceDirectory, useAllCaseCareStack } from '../../data/carestack';
import type { PracticeDirectoryEntry } from '../../data/carestack';

// ─── Practice explorer ───────────────────────────────────────────────────────
// Group-level drill-down: every practice with its CareStack location status;
// open one to see the dentists / providers available there and the patients
// on its cases, each with their mapping state. Read-only — used from the
// clinic + DSO status cards and the Super Admin Integrations tab.

const PILL = {
  ok:   'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]',
  warn: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]',
  bad:  'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
  muted:'bg-[#F3F3F5] text-[#717182] border-[#E0E0E6]',
};
const pill = (cls: string, text: string, icon?: React.ReactNode) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${cls}`}>{icon}{text}</span>
);

export default function PracticeMappingDrawer({
  open, onClose, practiceNames, initialPractice, onOpenCase,
}: {
  open: boolean;
  onClose: () => void;
  practiceNames: string[];
  /** Open straight onto one practice (the clinic portal's own practice). */
  initialPractice?: string;
  onOpenCase?: (caseId: string) => void;
}) {
  const records = useAllCaseCareStack();
  const entries = useMemo(() => practiceDirectory(practiceNames, records), [practiceNames, records]);
  const [selected, setSelected] = useState<string | null>(initialPractice ?? null);
  const [query, setQuery] = useState('');
  useEffect(() => { if (open) setSelected(initialPractice ?? null); }, [open, initialPractice]);

  const current = entries.find(e => e.name === selected);
  const filtered = entries.filter(e => !query.trim() || e.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={current ? current.name : 'Practices & locations'}
      subtitle={current
        ? (current.location ? `CareStack location ${current.location.name} · ${current.location.id}` : 'No CareStack location mapped')
        : `${entries.filter(e => e.location).length} of ${entries.length} practices mapped to a CareStack location`}
      icon={<MapPin className="w-4 h-4 text-[#7C3AED]" />}
      iconBg="bg-[#F3EEFF]"
    >
      {current ? (
        <PracticeDetail entry={current} onBack={initialPractice ? undefined : () => setSelected(null)} onOpenCase={onOpenCase} />
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#A0A0B0] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search practices…"
              className="w-full text-xs pl-8 pr-2.5 py-2 rounded-lg border border-[#E0E0E6] bg-white outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
            />
          </div>
          <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden divide-y divide-[#F0EFF6]">
            {filtered.map(e => {
              const unmappedPatients = e.patients.filter(p => p.status === 'unmapped').length;
              const inactive = e.providers.filter(p => !p.active).length;
              return (
                <button
                  key={e.name}
                  onClick={() => setSelected(e.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F8F9FC] transition-colors"
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${e.location ? 'bg-[#F3EEFF] text-[#7C3AED]' : 'bg-[#FFF8E1] text-[#B45309]'}`}>
                    <MapPin className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-[#030213]">{e.name}</span>
                      {e.location ? pill(PILL.ok, 'Mapped', <CheckCircle2 className="w-3 h-3" />) : pill(PILL.warn, 'Unmapped', <AlertTriangle className="w-3 h-3" />)}
                    </span>
                    <span className="block text-[11px] text-[#717182] mt-0.5">
                      {e.location ? <span className="font-mono">{e.location.id}</span> : 'Ask the Smile Genius admin to map this practice'}
                      {' · '}{e.providers.length} dentist{e.providers.length === 1 ? '' : 's'}{inactive ? ` (${inactive} inactive)` : ''}
                      {' · '}{e.patients.length} patient{e.patients.length === 1 ? '' : 's'}{unmappedPatients ? ` (${unmappedPatients} unmapped)` : ''}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#A0A0B0] flex-shrink-0" />
                </button>
              );
            })}
            {filtered.length === 0 && <p className="text-xs text-[#A0A0B0] italic text-center py-8">No practices match “{query}”.</p>}
          </div>
        </div>
      )}
    </SideDrawer>
  );
}

function PracticeDetail({ entry, onBack, onOpenCase }: { entry: PracticeDirectoryEntry; onBack?: () => void; onOpenCase?: (id: string) => void }) {
  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4D8EF7] hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" />All practices
        </button>
      )}

      {/* Location */}
      <div className={`rounded-xl border px-4 py-3 flex items-start gap-2.5 ${entry.location ? 'border-[#BBF7D0] bg-[#F0FDF4]' : 'border-[#FDE68A] bg-[#FFF8E1]'}`}>
        <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${entry.location ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF3C7] text-[#B45309]'}`}>
          <MapPin className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0">
          <p className={`text-xs font-bold ${entry.location ? 'text-[#166534]' : 'text-[#92400E]'}`}>
            {entry.location ? `Mapped to ${entry.location.name}` : 'No CareStack location mapped'}
          </p>
          <p className={`text-[11px] mt-0.5 ${entry.location ? 'text-[#15803D]' : 'text-[#A16207]'}`}>
            {entry.location
              ? <>{entry.location.address} · <span className="font-mono">{entry.location.id}</span> · PM {entry.location.practiceManager.name} · Reception {entry.location.receptionist.name}</>
              : 'Cases from this practice cannot be validated or linked until the Smile Genius admin maps it to a CareStack location.'}
          </p>
        </div>
      </div>

      {/* Dentists */}
      <Section icon={<Stethoscope className="w-3.5 h-3.5 text-[#0F766E]" />} title="Dentists / providers" count={entry.providers.length}>
        {entry.providers.length === 0 && <Empty text="No CareStack providers at this location." />}
        {entry.providers.map(p => (
          <Row
            key={p.id}
            title={p.name}
            sub={<><span className="font-mono">{p.id}</span>{p.locationId === '*' ? ' · all locations' : ''}{p.sgName ? ` · Smile Genius: ${p.sgName}` : ''}</>}
            pills={<>
              {p.active ? pill(PILL.ok, 'Active') : pill(PILL.bad, 'Inactive')}
              {p.sgName ? pill(PILL.ok, 'Mapped', <CheckCircle2 className="w-3 h-3" />) : pill(PILL.warn, 'Unmapped', <AlertTriangle className="w-3 h-3" />)}
            </>}
          />
        ))}
      </Section>

      {/* Patients */}
      <Section icon={<Users className="w-3.5 h-3.5 text-[#1565C0]" />} title="Patients" count={entry.patients.length}>
        {entry.patients.length === 0 && <Empty text="No patients seen at this practice yet." />}
        {entry.patients.map(p => (
          <Row
            key={p.name}
            title={p.name}
            sub={<>
              {p.csId ? <span className="font-mono">{p.csId}</span> : 'No CareStack ID'}
              {p.caseId && <> · <button onClick={() => onOpenCase?.(p.caseId as string)} className="text-[#4D8EF7] font-semibold hover:underline">{p.caseId}</button></>}
              {p.status === 'unmapped' && p.reason && <span className="block text-[#B91C1C] mt-0.5">{p.reason}</span>}
            </>}
            pills={
              p.status === 'mapped' ? pill(PILL.ok, 'Mapped', <CheckCircle2 className="w-3 h-3" />)
              : p.status === 'unmapped' ? pill(PILL.bad, 'Not found', <AlertTriangle className="w-3 h-3" />)
              : pill(PILL.muted, 'Checking', <Clock className="w-3 h-3" />)
            }
          />
        ))}
      </Section>
    </div>
  );
}

function Section({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-[#F8F9FC] border-b border-[#F0EFF6] flex items-center gap-2">
        {icon}
        <p className="text-xs font-semibold text-[#030213]">{title}</p>
        <span className="text-[10px] font-bold text-[#A0A0B0] tabular-nums">({count})</span>
      </div>
      <div className="divide-y divide-[#F0EFF6]">{children}</div>
    </div>
  );
}

function Row({ title, sub, pills }: { title: string; sub: React.ReactNode; pills: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[#030213]">{title}</p>
        <p className="text-[11px] text-[#717182] mt-0.5 leading-relaxed">{sub}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">{pills}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-[#A0A0B0] italic text-center py-5">{text}</p>;
}
