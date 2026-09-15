import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plug, RefreshCw, Loader2, Users, Stethoscope, MapPin, AlertTriangle, CheckCircle2, ShieldCheck, ArrowRight, ChevronRight } from 'lucide-react';
import PracticeMappingDrawer from './PracticeMappingDrawer';
import { useToast } from '../../context/ToastContext';
import { mockPractices } from '../../data/clinicsData';
import {
  careStackFigures, formatStamp, locationForPractice, simulateSync, unmappedPatients,
  useAllCaseCareStack, useCareStackSettings, useCareStackSyncing,
} from '../../data/carestack';
import { ghostBtn } from './shared';

// ─── Settings → Integrations (Clinic + DSO portals) ─────────────────────────
// Read-only view of the group's CareStack integration: connection + last
// sync, the mapping figures, and this practice's own location mapping. The
// only action is "Sync now" — enabling the integration and editing the
// mappings is done by the Smile Genius admin at group level.

/** The clinic the demo user belongs to (matches the seeded demo cases). */
const CLINIC_PRACTICE = 'Smile Genius Manchester';

const PILL = {
  on:  'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]',
  off: 'bg-[#F3F3F5] text-[#717182] border-[#E0E0E6]',
  warn: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]',
};

export default function CareStackStatusCard({ portal }: { portal: 'clinic' | 'supplier' }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const settings = useCareStackSettings();
  const syncing = useCareStackSyncing();
  const records = useAllCaseCareStack();
  const practiceNames = [...mockPractices.slice(0, 10).map(p => p.name), 'Smile Genius Cardiff'];
  const figures = careStackFigures(records, practiceNames);
  // Practice explorer drawer — the whole group (DSO) or just this clinic.
  const [explorer, setExplorer] = useState<{ open: boolean; practice?: string }>({ open: false });
  const unmapped = unmappedPatients(records);
  const clinicLoc = locationForPractice(CLINIC_PRACTICE);
  const enabled = settings.enabled;
  const who = portal === 'clinic' ? 'your practice' : 'your group';

  const sync = async () => {
    await simulateSync();
    toast.success('CareStack master data synchronised');
  };

  return (
    <div className="space-y-5">
      {/* Connection */}
      <div className="border border-[#E0E0E6] rounded-xl p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <span className="w-11 h-11 rounded-xl bg-[#ECFEFF] text-[#0F766E] flex items-center justify-center flex-shrink-0">
            <Plug className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-[#030213] flex items-center gap-2 flex-wrap">
              CareStack
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${enabled ? PILL.on : PILL.off}`}>
                {enabled ? (settings.connection === 'connected' ? 'Enabled · Connected' : 'Enabled · Disconnected') : 'Not enabled'}
              </span>
            </h3>
            <p className="text-xs text-[#717182] mt-0.5 leading-relaxed">
              {enabled
                ? `Patient, provider and appointment sync is on for ${who}. Every lab work case is validated against CareStack, its appointment is linked, and lab milestones are posted to the appointment as notes.`
                : `CareStack has not been enabled for ${who}. Cases show no CareStack mapping or appointment status until the Smile Genius admin turns it on.`}
            </p>
            <p className="inline-flex items-center gap-1.5 text-[11px] text-[#5A5568] mt-2 bg-[#F8F9FC] border border-[#F0EFF6] rounded-lg px-2.5 py-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#7C3AED]" />
              Managed by the Smile Genius Group admin — contact them to change the integration or its mappings.
            </p>
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-3 text-[11px] text-[#5A5568]">
              <span>Last sync <span className="font-semibold text-[#030213] tabular-nums">{enabled ? formatStamp(settings.lastSyncAt) : '—'}</span></span>
              <span className="text-[#A0A0B0]">·</span>
              <span>Sync cadence <span className="font-semibold text-[#030213]">Initial + nightly delta</span></span>
            </div>
          </div>
          <button onClick={sync} disabled={!enabled || syncing} className={ghostBtn}>
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>

      {enabled && (
        <>
          {/* Figures */}
          <div className="border border-[#E0E0E6] rounded-xl p-5">
            <h3 className="text-base font-bold text-[#030213]">Mapping status</h3>
            <p className="text-xs text-[#717182] mt-0.5">Smile Genius stores the CareStack ID against each record. Exact, one-to-one matching — unmapped records are flagged, never duplicated.</p>
            <div className={`grid grid-cols-1 gap-3 mt-4 ${portal === 'clinic' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
              {/* Group-wide location figures only make sense at DSO level; a
                  clinic just sees its own mapping (below). Click-through
                  opens the practice explorer (dentists + patients per practice). */}
              {portal === 'supplier' && (
                <Figure
                  icon={<MapPin className="w-4 h-4 text-[#7C3AED]" />}
                  label="Practices / locations"
                  onClick={() => setExplorer({ open: true })}
                  rows={[
                    { label: 'Mapped', value: figures.locations.mapped, tone: 'ok' },
                    { label: 'Unmapped', value: figures.locations.unmapped, tone: figures.locations.unmapped ? 'warn' : 'muted' },
                    { label: 'CareStack only', value: figures.locations.csOnly, tone: 'muted' },
                  ]}
                />
              )}
              <Figure
                icon={<Users className="w-4 h-4 text-[#1565C0]" />}
                label="Patients"
                rows={[
                  { label: 'Mapped', value: figures.patients.mapped, tone: 'ok' },
                  { label: 'Unmapped — needs review', value: figures.patients.unmapped, tone: figures.patients.unmapped ? 'warn' : 'muted' },
                ]}
              />
              <Figure
                icon={<Stethoscope className="w-4 h-4 text-[#0F766E]" />}
                label="Dentists / providers"
                rows={[
                  { label: 'Mapped & active', value: figures.providers.mapped, tone: 'ok' },
                  { label: 'Inactive in CareStack', value: figures.providers.inactive, tone: figures.providers.inactive ? 'warn' : 'muted' },
                  { label: 'Unmapped', value: figures.providers.unmapped, tone: figures.providers.unmapped ? 'warn' : 'muted' },
                ]}
              />
            </div>

            {portal === 'clinic' && (
              <button
                onClick={() => setExplorer({ open: true, practice: CLINIC_PRACTICE })}
                title="See the dentists and patients at your practice with their CareStack status"
                className="mt-4 w-full flex items-center gap-3 flex-wrap rounded-xl border border-[#F0EFF6] bg-[#F8F9FC] px-4 py-3 text-left hover:border-[#C8D8FC] hover:bg-[#EEF4FF]/40 transition-colors"
              >
                <MapPin className="w-4 h-4 text-[#717182] flex-shrink-0" />
                <p className="text-xs text-[#5A5568] flex-1 min-w-0">
                  Your practice <span className="font-semibold text-[#030213]">{CLINIC_PRACTICE}</span>
                  {clinicLoc ? <> ↔ CareStack location <span className="font-semibold text-[#030213]">{clinicLoc.name}</span> <span className="font-mono text-[#A0A0B0]">{clinicLoc.id}</span></> : <> has no CareStack location mapped</>}
                </p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${clinicLoc ? PILL.on : PILL.warn}`}>
                  {clinicLoc ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {clinicLoc ? 'Mapped' : 'Unmapped'}
                </span>
                <ChevronRight className="w-4 h-4 text-[#A0A0B0] flex-shrink-0" />
              </button>
            )}
          </div>

          {/* Unmapped patients */}
          <div className="border border-[#E0E0E6] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-[#F8F9FC] border-b border-[#F0EFF6]">
              <p className="text-sm font-bold text-[#030213]">Patients needing review</p>
              <p className="text-[11px] text-[#717182]">Resolved from the case (Correct details → retry lookup). Smile Genius never creates patients in CareStack.</p>
            </div>
            {unmapped.length === 0 ? (
              <p className="text-xs text-[#A0A0B0] italic text-center py-6">Every validated patient is mapped.</p>
            ) : (
              <div className="divide-y divide-[#F0EFF6]">
                {unmapped.map(u => (
                  <div key={u.caseId} className="px-5 py-3 flex items-start gap-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#030213]">{u.caseId}</p>
                      {u.reason && <p className="text-[11px] text-[#717182] mt-0.5 leading-relaxed">{u.reason}</p>}
                    </div>
                    <button
                      onClick={() => navigate(`/${portal}/cases/${encodeURIComponent(u.caseId)}`)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7] hover:underline flex-shrink-0"
                    >
                      Open case <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <PracticeMappingDrawer
        open={explorer.open}
        onClose={() => setExplorer({ open: false })}
        practiceNames={practiceNames}
        initialPractice={explorer.practice}
        onOpenCase={id => navigate(`/${portal}/cases/${encodeURIComponent(id)}`)}
      />
    </div>
  );
}

function Figure({ icon, label, rows, onClick }: { icon: React.ReactNode; label: string; rows: { label: string; value: number; tone: 'ok' | 'warn' | 'muted' }[]; onClick?: () => void }) {
  const toneCls = { ok: 'text-[#15803D]', warn: 'text-[#B45309]', muted: 'text-[#717182]' };
  const Tag: 'button' | 'div' = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      title={onClick ? 'Open the practice explorer' : undefined}
      className={`rounded-xl border border-[#E0E0E6] px-4 py-3 text-left ${onClick ? 'w-full hover:border-[#C8D8FC] hover:shadow-sm transition-all group' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider">{label}</p>
        {onClick && <ChevronRight className="w-3.5 h-3.5 text-[#A0A0B0] ml-auto group-hover:text-[#4D8EF7] transition-colors" />}
      </div>
      <div className="space-y-1">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-[#5A5568]">{r.label}</span>
            <span className={`text-sm font-bold tabular-nums ${toneCls[r.tone]}`}>{r.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Tag>
  );
}
