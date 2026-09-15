import { useMemo, useState } from 'react';
import { Plug, RefreshCw, Loader2, MapPin, Stethoscope, Users, CheckCircle2, AlertTriangle, Link2, ChevronRight } from 'lucide-react';
import Toggle from '../Toggle';
import PracticeMappingDrawer from './PracticeMappingDrawer';
import { useToast } from '../../context/ToastContext';
import type { Practice, StaffMember } from '../../data/clinicsData';
import {
  CS_LOCATIONS, CS_PATIENTS, CS_PROVIDERS, careStackFigures, formatStamp, setCareStackEnabled, simulateSync,
  unmappedPatients, useAllCaseCareStack, useCareStackSettings, useCareStackSyncing,
} from '../../data/carestack';
import { ghostBtn } from './shared';

// ─── Admin → Organization → Integrations (dental groups) ─────────────────────
// CareStack is configured once per group, never per clinic. The tab shows the
// enable switch (the single flag the whole clinic experience keys off), the
// connection / sync state, and the three mapping tables Smile Genius keeps
// between its own entities and CareStack's: Practice ↔ Location, Dentist ↔
// Provider (with active/inactive) and Patients (mapping status only — a
// patient that cannot be mapped is flagged, never duplicated).

type MapTab = 'locations' | 'providers' | 'patients';

const PILL = {
  mapped:   'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]',
  unmapped: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]',
  csOnly:   'bg-[#F3F3F5] text-[#5A5568] border-[#E0E0E6]',
  active:   'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]',
  inactive: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
};
const pill = (cls: string, text: string) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${cls}`}>{text}</span>
);

export default function CareStackIntegrationsTab({
  org, clinics, dentists,
}: {
  org: { id: string; name: string };
  clinics: Practice[];
  dentists: StaffMember[];
}) {
  const { toast } = useToast();
  const settings = useCareStackSettings();
  const syncing = useCareStackSyncing();
  const records = useAllCaseCareStack();
  const provisioned = org.id === settings.orgId;
  const [tab, setTab] = useState<MapTab>('locations');
  // Demo-only local mapping of an unmapped practice → CS location.
  const [localMap, setLocalMap] = useState<Record<string, string>>({});
  // Practice explorer — click a practice row to see its dentists + patients.
  const [explorer, setExplorer] = useState<{ open: boolean; practice?: string }>({ open: false });

  // Practices shown = the group's clinics that have a CareStack counterpart
  // or sit in the generated case data, plus a handful more for realism.
  const practiceRows = useMemo(() => {
    const byName = new Map(CS_LOCATIONS.filter(l => l.sgPracticeName).map(l => [l.sgPracticeName as string, l]));
    const names = new Set<string>();
    CS_LOCATIONS.forEach(l => { if (l.sgPracticeName) names.add(l.sgPracticeName); });
    clinics.slice(0, 10).forEach(c => names.add(c.name));
    names.add('Smile Genius Cardiff');
    return [...names].map(name => {
      const loc = byName.get(name) ?? CS_LOCATIONS.find(l => l.id === localMap[name]);
      const practice = clinics.find(c => c.name === name);
      return { name, code: practice?.practiceCode ?? '—', loc };
    });
  }, [clinics, localMap]);
  const csOnly = CS_LOCATIONS.filter(l => !l.sgPracticeName && !Object.values(localMap).includes(l.id));
  const unmappedLocations = csOnly;

  const providerRows = useMemo(() => CS_PROVIDERS.map(p => {
    const sg = p.sgName ? dentists.find(d => d.name === p.sgName || d.performerName === p.sgName) : undefined;
    return { ...p, sgDentist: p.sgName, performerCode: sg?.performerCode };
  }), [dentists]);

  const unmapped = unmappedPatients(records);
  const mappedPatientCount = careStackFigures(records).patients.mapped;

  const toggle = () => {
    setCareStackEnabled(!settings.enabled);
    toast.success(settings.enabled ? `CareStack disabled for ${org.name}` : `CareStack enabled for ${org.name}`);
  };
  const sync = async () => {
    await simulateSync();
    toast.success('CareStack master data synchronised');
  };

  return (
    <div className="space-y-5">
      {/* ── Connection card ── */}
      <div className="border border-[#E0E0E6] rounded-xl p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <span className="w-11 h-11 rounded-xl bg-[#ECFEFF] text-[#0F766E] flex items-center justify-center flex-shrink-0">
            <Plug className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-[#030213] flex items-center gap-2 flex-wrap">
              CareStack
              {provisioned
                ? pill(settings.connection === 'connected' ? PILL.active : PILL.inactive, settings.connection === 'connected' ? 'Connected' : 'Disconnected')
                : pill(PILL.csOnly, 'Not provisioned')}
            </h3>
            <p className="text-xs text-[#717182] mt-0.5 leading-relaxed">
              Practice-management integration configured at group level. When enabled, every Lab Work case from this group’s clinics is validated against CareStack (patient, provider, location), its appointment is looked up and linked, and lab-work milestones are mirrored onto the appointment as notes.
            </p>
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-3 text-[11px] text-[#5A5568]">
              <span>Last sync <span className="font-semibold text-[#030213] tabular-nums">{provisioned ? formatStamp(settings.lastSyncAt) : '—'}</span></span>
              <span className="text-[#A0A0B0]">·</span>
              <span>Sync cadence <span className="font-semibold text-[#030213]">Initial + nightly delta</span> <span className="text-[#A0A0B0]">(mechanism &amp; frequency to be confirmed by Engineering)</span></span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={sync} disabled={!provisioned || syncing} className={ghostBtn}>
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#030213]">{settings.enabled && provisioned ? 'Enabled' : 'Disabled'}</span>
              <Toggle
                on={settings.enabled && provisioned}
                onChange={toggle}
                disabled={!provisioned}
                title={provisioned ? undefined : 'CareStack is not provisioned for this group — contact CareStack to obtain API access first.'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mapping card ── */}
      <div className="border border-[#E0E0E6] rounded-xl overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <h3 className="text-lg font-bold text-[#030213]">Entity mapping</h3>
          <p className="text-xs text-[#717182] mt-0.5">
            Smile Genius stores the CareStack ID against each of its own records. Exact, one-to-one mapping — nothing is matched by similarity, and unmapped records are flagged rather than duplicated.
          </p>
        </div>
        <div className="px-5 flex flex-wrap items-center gap-2">
          {([
            { id: 'locations', label: 'Practice ↔ Location', count: practiceRows.length + csOnly.length, icon: MapPin },
            { id: 'providers', label: 'Dentist ↔ Provider',  count: providerRows.length, icon: Stethoscope },
            { id: 'patients',  label: 'Patients',            count: unmapped.length, icon: Users },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                tab === t.id ? 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]' : 'bg-white text-[#5A5568] border-[#E0E0E6] hover:border-[#BFDBFE] hover:text-[#1565C0]'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              <span className="text-[10px] font-bold tabular-nums opacity-70">({t.id === 'patients' ? `${t.count} unmapped` : t.count})</span>
            </button>
          ))}
        </div>

        <div className="mt-4 border-t border-[#F0EFF6] overflow-x-auto">
          {tab === 'locations' && (
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="bg-[#F8F9FC] [&>th]:px-5 [&>th]:py-2.5 [&>th]:text-[10px] [&>th]:font-semibold [&>th]:text-[#A0A0B0] [&>th]:uppercase [&>th]:tracking-wider [&>th]:border-b [&>th]:border-[#F0EFF6]">
                  <th>Smile Genius practice</th><th>Code</th><th>CareStack location</th><th>Location ID</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EFF6]">
                {practiceRows.map(r => (
                  <tr
                    key={r.name}
                    onClick={() => setExplorer({ open: true, practice: r.name })}
                    title="Open this practice — dentists and patients with their CareStack status"
                    className="[&>td]:px-5 [&>td]:py-2.5 [&>td]:text-xs cursor-pointer hover:bg-[#F8F9FC] transition-colors"
                  >
                    <td className="font-semibold text-[#030213]">{r.name}</td>
                    <td className="text-[#717182] font-mono text-[11px]">{r.code}</td>
                    <td className="text-[#5A5568]">
                      {r.loc ? r.loc.name : (
                        <select
                          value=""
                          onChange={e => { if (e.target.value) { setLocalMap(m => ({ ...m, [r.name]: e.target.value })); toast.success(`${r.name} mapped to ${CS_LOCATIONS.find(l => l.id === e.target.value)?.name}`); } }}
                          className="text-[11px] px-2 py-1 rounded-lg border border-[#E0E0E6] bg-white text-[#5A5568] outline-none focus:border-[#4D8EF7]"
                          onClick={e => e.stopPropagation()}
                        >
                          <option value="">Map to CareStack location…</option>
                          {unmappedLocations.map(l => <option key={l.id} value={l.id}>{l.name} · {l.id}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="font-mono text-[11px] text-[#717182]">{r.loc?.id ?? '—'}</td>
                    <td>{r.loc ? pill(PILL.mapped, 'Mapped') : pill(PILL.unmapped, 'Unmapped')}</td>
                    <td className="text-right"><ChevronRight className="w-4 h-4 text-[#A0A0B0] inline-block" /></td>
                  </tr>
                ))}
                {csOnly.map(l => (
                  <tr key={l.id} className="[&>td]:px-5 [&>td]:py-2.5 [&>td]:text-xs bg-[#FAFAFC]">
                    <td className="text-[#A0A0B0] italic">No Smile Genius practice</td>
                    <td className="text-[#A0A0B0]">—</td>
                    <td className="text-[#5A5568]">{l.name}</td>
                    <td className="font-mono text-[11px] text-[#717182]">{l.id}</td>
                    <td>{pill(PILL.csOnly, 'CareStack only')}</td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'providers' && (
            <table className="w-full text-left min-w-[680px]">
              <thead>
                <tr className="bg-[#F8F9FC] [&>th]:px-5 [&>th]:py-2.5 [&>th]:text-[10px] [&>th]:font-semibold [&>th]:text-[#A0A0B0] [&>th]:uppercase [&>th]:tracking-wider [&>th]:border-b [&>th]:border-[#F0EFF6]">
                  <th>CareStack provider</th><th>Provider ID</th><th>Location</th><th>Provider status</th><th>Smile Genius dentist</th><th>Mapping</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EFF6]">
                {providerRows.map(p => (
                  <tr key={p.id} className="[&>td]:px-5 [&>td]:py-2.5 [&>td]:text-xs">
                    <td className="font-semibold text-[#030213]">{p.name}</td>
                    <td className="font-mono text-[11px] text-[#717182]">{p.id}</td>
                    <td className="text-[#5A5568]">{p.locationId === '*' ? 'All locations' : CS_LOCATIONS.find(l => l.id === p.locationId)?.name ?? p.locationId}</td>
                    <td>{p.active ? pill(PILL.active, 'Active') : pill(PILL.inactive, 'Inactive')}</td>
                    <td className="text-[#5A5568]">
                      {p.sgDentist ? <>{p.sgDentist}{p.performerCode && <span className="text-[#A0A0B0] font-mono text-[10px]"> · {p.performerCode}</span>}</> : <span className="text-[#A0A0B0] italic">—</span>}
                    </td>
                    <td>{p.sgDentist ? pill(PILL.mapped, 'Mapped') : pill(PILL.unmapped, 'Unmapped')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'patients' && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Stat icon={<CheckCircle2 className="w-4 h-4 text-[#15803D]" />} label="Mapped patients" value={mappedPatientCount.toLocaleString()} sub="CareStack patient ID stored on the Smile Genius record" />
                <Stat icon={<AlertTriangle className="w-4 h-4 text-[#B45309]" />} label="Unmapped — needs review" value={String(unmapped.length)} sub="Flagged on the case; never auto-created" />
                <Stat icon={<Link2 className="w-4 h-4 text-[#1565C0]" />} label="CareStack patients on file" value={CS_PATIENTS.length.toLocaleString() + '+'} sub="Available for exact matching at case creation" />
              </div>
              <div className="border border-[#E0E0E6] rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-[#F8F9FC] border-b border-[#F0EFF6]">
                  <p className="text-xs font-semibold text-[#030213]">Unmapped patients</p>
                  <p className="text-[10px] text-[#717182]">Resolved from the case by the practice (Correct details → retry lookup). Smile Genius does not create patients in CareStack.</p>
                </div>
                {unmapped.length === 0 ? (
                  <p className="text-xs text-[#A0A0B0] italic text-center py-6">Every validated patient is mapped.</p>
                ) : (
                  <div className="divide-y divide-[#F0EFF6]">
                    {unmapped.map(u => (
                      <div key={u.caseId} className="px-4 py-2.5 flex items-start gap-2.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#030213]">{u.caseId} <span className="font-normal text-[#717182]">· awaiting correction in case</span></p>
                          {u.reason && <p className="text-[10px] text-[#717182] mt-0.5 leading-relaxed">{u.reason}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <PracticeMappingDrawer
        open={explorer.open}
        onClose={() => setExplorer({ open: false })}
        practiceNames={practiceRows.map(r => r.name)}
        initialPractice={explorer.practice}
      />
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-[#E0E0E6] px-4 py-3">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl font-bold text-[#030213] tabular-nums mt-1">{value}</p>
      <p className="text-[10px] text-[#717182] mt-0.5">{sub}</p>
    </div>
  );
}
