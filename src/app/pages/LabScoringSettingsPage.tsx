import { useMemo, useState } from 'react';
import {
  Sliders, Gauge, FileText, RotateCcw, CheckCircle2, Info, Sparkles, Save,
  ChevronDown, AlertTriangle, Plus, X, FolderKanban, Mail, Copy, Check, Pencil,
} from 'lucide-react';
import ServiceConfigDrawer from './ServiceConfigDrawer';
import CaseScoringEmailsSettings from './CaseScoringEmailsSettingsPage';
import { useToast } from '../context/ToastContext';
import { useCaseScoring } from '../context/CaseScoringContext';
import { SCOREABLE_SERVICE_TYPES, SERVICE_GROUPS, TIER_BAND, ScoreBand, SCORE_FIELD_DEF_MAP } from '../data/caseScoring';
import type { PrescriptionField } from '../data/prescriptionBuilder';
import { scoreableFieldsFor } from '../data/prescriptionBuilder';
import { mockCases } from './CasesPage';

// ─── Lab Portal — Cases configuration ────────────────────────────────────────
// Two linked sections under "Cases":
//   1) Prescription Builder — the fields shown in case creation. Enable/disable,
//      required/optional, and edit dropdown values.
//   2) Case Scoring — weight the fields (which COME FROM the Prescription
//      Builder) + set the bands. Disable a weighted field in the builder and the
//      scoring goes "out of sync": a banner shows here and cases read
//      "Score unavailable" until the lab updates it.

const SERVICE_CASE_COUNTS: Record<string, number> = (() => {
  const counts: Record<string, number> = {};
  for (const c of mockCases) for (const si of c.serviceItems ?? []) counts[si.name] = (counts[si.name] ?? 0) + 1;
  return counts;
})();

const BAND_UI: Record<ScoreBand, { text: string; solid: string }> = {
  green: { text: 'text-[#047857]', solid: '#22C55E' },
  amber: { text: 'text-[#B45309]', solid: '#F59E0B' },
  red:   { text: 'text-[#B91C1C]', solid: '#EF4444' },
};

const TYPE_LABEL: Record<PrescriptionField['type'], string> = {
  teeth: 'Teeth', select: 'Dropdown', multiselect: 'Multi-select', toggle: 'Toggle', text: 'Text', files: 'Upload', date: 'Date',
};

type Section = 'prescription' | 'scoring';
type ServiceStatus = 'stale' | 'scored' | 'unscored';

export function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className={`w-9 h-5 rounded-full flex-shrink-0 relative transition-colors ${on ? 'bg-[#4D8EF7]' : 'bg-[#D4CEE1]'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

function StatusDot({ status }: { status: ServiceStatus }) {
  const cls = status === 'stale' ? 'bg-[#F59E0B] ring-2 ring-[#FEF3C7]' : status === 'scored' ? 'bg-[#10B981]' : 'bg-[#D4CEE1]';
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls}`} />;
}

export function AddOption({ onAdd }: { onAdd: (v: string) => void }) {
  const [v, setV] = useState('');
  const commit = () => { if (v.trim()) { onAdd(v.trim()); setV(''); } };
  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        placeholder="Add value…"
        className="w-28 px-2 py-1 rounded-md border border-dashed border-[#C8D8FC] text-[11px] focus:border-[#4D8EF7] focus:outline-none"
      />
      <button type="button" onClick={commit} className="p-1 rounded-md text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors" title="Add value">
        <Plus className="w-3 h-3" />
      </button>
    </span>
  );
}

export default function LabScoringSettingsPage({ embedded = false, fixedSection, initialScoringTab }: {
  /** Rendered inside a Settings tab (the live portal's home for this config):
      skips the page padding since the settings shell provides it. */
  embedded?: boolean;
  /** Lock the page to ONE section — the live portal keeps Prescription
      Builder and Case Scoring as SEPARATE Settings entries, so each tab
      renders just its own section (no section switcher, no side menu). */
  fixedSection?: Section;
  /** Deep-link straight onto a Case Scoring inner tab (e.g. the "Connect
      Email" banner opens 'email' — the Case Scoring Emails tab). */
  initialScoringTab?: 'weights' | 'thresholds' | 'email';
} = {}) {
  const { toast } = useToast();
  const {
    config, thresholds, prescription, serviceOffered,
    setPrescriptionEnabled, setPrescriptionRequired, addPrescriptionOption, removePrescriptionOption,
    setPrescriptionOptions, addPrescriptionField, removePrescriptionField, setServiceOffered,
    staleFieldsForService, isServiceStale,
    toggleField, setFieldWeight, clearService, resetDefaults, setServiceScoringEnabled,
    setThresholdUpTo, toggleThreshold, setThresholdLabel,
  } = useCaseScoring();

  const [section, setSection] = useState<Section>(fixedSection ?? (initialScoringTab ? 'scoring' : 'prescription'));
  const [scoringTab, setScoringTab] = useState<'weights' | 'thresholds' | 'email'>(initialScoringTab ?? 'weights');
  const [activeService, setActiveService] = useState<string>(SCOREABLE_SERVICE_TYPES[0]);
  // The service whose "Configure" drawer is open (null = closed).
  const [configService, setConfigService] = useState<string | null>(null);

  const anyStale = useMemo(() => SCOREABLE_SERVICE_TYPES.some(s => isServiceStale(s)), [isServiceStale]);

  // Effective [from–to] range for each enabled band (ascending by upper bound):
  // each band starts one above the previous enabled band's upper bound.
  const bandRanges = useMemo(() => {
    const map: Record<string, { from: number; to: number }> = {};
    const enabled = thresholds.filter(t => t.enabled).slice().sort((a, b) => a.upTo - b.upTo);
    let prev = -1;
    for (const t of enabled) { map[t.id] = { from: prev + 1, to: t.upTo }; prev = t.upTo; }
    return map;
  }, [thresholds]);

  const statusFor = (service: string): ServiceStatus => {
    if (isServiceStale(service)) return 'stale';
    return (config[service] ?? []).some(f => f.weight > 0) ? 'scored' : 'unscored';
  };

  // ── Shared vertical service selector — grouped by category like case creation ──
  const renderServiceButton = (service: string) => {
    const active = service === activeService;
    const status = statusFor(service);
    const isScored = status !== 'unscored';
    return (
      <div
        key={service}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 mb-0.5 rounded-lg transition-colors ${
          active ? 'bg-[#EEF4FF]' : 'hover:bg-[#F8F9FC]'
        }`}
      >
        <button onClick={() => setActiveService(service)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
          <StatusDot status={status} />
          <span className="flex-1 min-w-0">
            <span className={`block text-sm truncate ${active ? 'font-semibold text-[#030213]' : 'font-medium text-[#5A5568]'}`}>{service}</span>
            <span className={`block text-[10px] ${status === 'stale' ? 'text-[#B45309]' : 'text-[#A0A0B0]'}`}>
              {status === 'stale' ? 'Out of sync' : status === 'scored' ? 'Scored' : 'No score'}
            </span>
          </span>
        </button>
        {/* On/off scoring for this service, right in the list */}
        <Toggle on={isScored} onClick={() => setServiceScoringEnabled(service, !isScored)} />
      </div>
    );
  };
  const serviceSelector = (
    <div className="sm:w-64 flex-shrink-0">
      <div className="bg-white border border-[#E0E0E6] rounded-xl p-2 sm:sticky sm:top-6 sm:max-h-[78vh] sm:overflow-y-auto">
        {SERVICE_GROUPS.map((group) => (
          <div key={group.category} className="mb-1.5 last:mb-0">
            <p className="px-2 pt-1.5 pb-1 text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest">{group.category}</p>
            {group.services.map(renderServiceButton)}
          </div>
        ))}
      </div>
    </div>
  );

  const fields = prescription[activeService] ?? [];
  const scoreable = scoreableFieldsFor(activeService, prescription);
  const staleIds = staleFieldsForService(activeService);
  const effectiveTotal = scoreable.reduce((s, f) => s + (config[activeService]?.find(c => c.id === f.id)?.weight ?? 0), 0);
  const scored = (config[activeService] ?? []).some(f => f.weight > 0);
  const weightOf = (id: string) => config[activeService]?.find(f => f.id === id)?.weight ?? 0;
  const isWeighted = (id: string) => weightOf(id) > 0;

  // The 3D-scan slots (Upper / Lower / Bite Scan / Bite Scan 2) get a master
  // toggle: turning it on enables all of them (sharing whatever budget is free
  // up to 100), turning it off clears them all.
  const scanSlots = scoreable.filter(f => f.id.startsWith('scan_'));
  const anyScanOn = scanSlots.some(f => isWeighted(f.id));
  const setAllScanSlots = (on: boolean) => {
    if (!on) { scanSlots.forEach(f => toggleField(activeService, f.id, false)); return; }
    // Distribute the free budget across the slots that aren't already weighted.
    let remaining = Math.max(0, 100 - effectiveTotal);
    scanSlots.forEach(f => {
      if (isWeighted(f.id)) return;
      const give = Math.min(10, remaining);
      setFieldWeight(activeService, f.id, give);
      remaining -= give;
    });
  };

  // Any service whose scoring weights don't total 100 — Save is blocked (with a
  // toast) until every scored service reaches exactly 100.
  const invalidScoringServices = SCOREABLE_SERVICE_TYPES.filter(svc => {
    const sc = scoreableFieldsFor(svc, prescription);
    const total = sc.reduce((acc, f) => acc + (config[svc]?.find(c => c.id === f.id)?.weight ?? 0), 0);
    return total > 0 && total !== 100;
  });

  return (
    <div className={embedded ? 'space-y-5' : 'p-4 sm:p-6 lg:p-8 space-y-5'}>
      {/* Header — title tracks the locked section when this page is embedded
          as a single-purpose Settings tab. */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#030213]">
            {fixedSection === 'prescription' ? 'Prescription Builder'
              : fixedSection === 'scoring' ? 'Case Scoring'
              : 'Configuration'}
          </h1>
          <p className="text-sm text-[#717182] mt-0.5">
            {fixedSection === 'prescription'
              ? 'Build the prescription form shown in case creation — services, fields and dropdown values. Fields tagged Scored feed Case Scoring.'
              : fixedSection === 'scoring'
                ? 'Decide how cases are scored — field weights, score bands and automated case scoring emails.'
                : 'Build the prescription form and decide how cases are scored. Scoring is driven by the fields you enable here.'}
          </p>
        </div>
        <button
          onClick={() => { resetDefaults(); toast.success('Configuration reset to defaults'); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] bg-white hover:border-[#4D8EF7] hover:text-[#1565C0] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to defaults
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left menu — a single "Cases" section. Hidden when the page is
            locked to one section (the Settings nav already provides it). */}
        {!fixedSection && (
        <aside className="lg:w-60 flex-shrink-0">
          <nav className="bg-white border border-[#E0E0E6] rounded-xl p-2 lg:sticky lg:top-6">
            <div className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left relative bg-gradient-to-r from-[#EEF4FF] to-[#F5F3FF]">
              <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF]" />
              <FolderKanban className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#4D8EF7]" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium leading-tight text-[#030213]">Cases</p>
                  {anyStale && <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] flex-shrink-0" title="Some scoring is out of sync" />}
                </div>
                <p className="text-[11px] mt-0.5 leading-tight text-[#A0A0B0]">Prescription &amp; scoring</p>
              </div>
            </div>
          </nav>
        </aside>
        )}

        {/* Panel */}
        <section className="flex-1 min-w-0 space-y-4">
          {/* Horizontal tabs — Prescription Builder · Case Scoring. Hidden when
              locked to one section: the live portal exposes each as its own
              Settings entry, so the switcher would duplicate that nav. */}
          {!fixedSection && (
          <div className="p-1 bg-[#F3F3F5] rounded-xl">
            <div className="flex gap-1">
              {([
                { id: 'prescription' as Section, label: 'Prescription Builder', icon: <FileText className="w-4 h-4" /> },
                { id: 'scoring' as Section,      label: 'Case Scoring',         icon: <Sliders className="w-4 h-4" /> },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSection(t.id)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    section === t.id ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white shadow-sm' : 'text-[#717182] hover:text-[#030213] hover:bg-white/60'
                  }`}
                >
                  {t.icon}
                  {t.label}
                  {t.id === 'scoring' && anyStale && <span className={`w-1.5 h-1.5 rounded-full ${section === 'scoring' ? 'bg-white' : 'bg-[#F59E0B]'}`} />}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* ── PRESCRIPTION BUILDER ── */}
          {section === 'prescription' && (
            <>
              <div className="bg-gradient-to-br from-[#EEF4FF] to-[#F5F3FF] border border-[#DBEAFE] rounded-xl p-4 flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-white border border-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-[#4D8EF7]" />
                </span>
                <div className="text-xs text-[#3A4A63] leading-relaxed">
                  <span className="font-semibold text-[#1565C0]">Prescription Builder.</span>{' '}
                  Turn the services your lab offers on or off. Click <span className="font-semibold">Edit</span> (or a service)
                  to configure its prescription — fields, material types, implant brands and custom questions.
                  Fields tagged <span className="font-semibold">Scored</span> feed Case Scoring.
                </div>
              </div>

              {/* Offered-services list — click a service (or Edit) to configure it. */}
              <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#F0EFF6] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#030213]">Services</p>
                    <p className="text-[11px] text-[#717182] mt-0.5">
                      {SCOREABLE_SERVICE_TYPES.filter(s => serviceOffered[s] !== false).length} of {SCOREABLE_SERVICE_TYPES.length} offered
                    </p>
                  </div>
                  <button
                    onClick={() => setConfigService(SCOREABLE_SERVICE_TYPES.find(s => serviceOffered[s] !== false) ?? SCOREABLE_SERVICE_TYPES[0])}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity flex-shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                </div>
                <div className="p-3 space-y-3">
                  {SERVICE_GROUPS.map((group) => (
                    <div key={group.category}>
                      <p className="px-1 pb-1.5 text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest">{group.category}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.services.map((service) => {
                          const offered = serviceOffered[service] !== false;
                          const flds = prescription[service] ?? [];
                          const onCount = flds.filter(f => f.enabled).length;
                          const scored = (config[service] ?? []).some(f => f.weight > 0);
                          const stale = isServiceStale(service);
                          return (
                            <div
                              key={service}
                              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${
                                offered ? 'border-[#E0E0E6] bg-white hover:border-[#C8D8FC]' : 'border-[#EEEEF2] bg-[#FAFBFC] opacity-70'
                              }`}
                            >
                              <button onClick={() => setConfigService(service)} className="flex-1 min-w-0 flex items-center gap-2.5 text-left">
                                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#EEF4FF] to-[#F5F3FF] border border-[#DBEAFE] flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-[#4D8EF7]">
                                  {service.charAt(0)}
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium text-[#030213] truncate">{service}</span>
                                  <span className="block text-[10px] text-[#A0A0B0]">
                                    {onCount} field{onCount === 1 ? '' : 's'} on
                                    {scored && <span className="text-[#1565C0] font-semibold"> · Scored</span>}
                                    {stale && <span className="text-[#B45309] font-semibold"> · Out of sync</span>}
                                  </span>
                                </span>
                              </button>
                              <button
                                onClick={() => setConfigService(service)}
                                title="Configure prescription"
                                className="p-1.5 rounded-lg text-[#717182] hover:text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors flex-shrink-0"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <Toggle on={offered} onClick={() => setServiceOffered(service, !offered)} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── CASE SCORING ── */}
          {section === 'scoring' && (
            <>
              {/* Inner tabs: Weights | Bands | Auto-Email — full width */}
              <div className="flex items-center gap-1 p-1 bg-white border border-[#E0E0E6] rounded-lg">
                {([['weights', 'Field Weights'], ['thresholds', 'Score Bands'], ['email', 'Case Scoring Emails']] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setScoringTab(id)}
                    className={`flex-1 text-center px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                      scoringTab === id ? 'bg-[#EEF4FF] text-[#1565C0]' : 'text-[#717182] hover:text-[#030213] hover:bg-[#F8F9FC]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {scoringTab === 'weights' && (
                <div className="flex flex-col sm:flex-row gap-4">
                  {serviceSelector}
                  <div className="flex-1 min-w-0 space-y-4">
                    {/* Out-of-sync banner */}
                    {staleIds.length > 0 && (
                      <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-[#C2410C] flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#9A3412]">Scoring is out of sync with the Prescription Builder</p>
                            <p className="text-xs text-[#B45309] mt-0.5 leading-relaxed">
                              These weighted fields were turned off in the builder, so {activeService} cases now read{' '}
                              <span className="font-semibold">"Score unavailable"</span>:
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {staleIds.map((id) => (
                                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white text-[#C2410C] border border-[#FED7AA]">
                                  {SCORE_FIELD_DEF_MAP[id]?.label ?? id}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                              <button
                                onClick={() => { staleIds.forEach(id => toggleField(activeService, id, false)); toast.success('Removed out-of-sync fields from scoring'); }}
                                className="text-[11px] font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] px-2.5 py-1.5 rounded-md transition-colors"
                              >
                                Remove from scoring
                              </button>
                              <button
                                onClick={() => setSection('prescription')}
                                className="text-[11px] font-semibold text-[#C2410C] hover:underline"
                              >
                                Re-enable in Prescription Builder
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Weights editor */}
                    <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-[#F0EFF6] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#030213]">{activeService}</p>
                            <p className="text-[11px] text-[#717182] mt-0.5">
                              {scored ? 'Scoring on · score = earned ÷ total' : 'Scoring off — toggle it on in the list'}
                            </p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border flex-shrink-0 ${
                          effectiveTotal === 0 ? 'bg-[#F3F3F5] text-[#A0A0B0] border-[#E0E0E6]'
                            : effectiveTotal === 100 ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
                            : 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]'
                        }`}>
                          {effectiveTotal === 0 ? 'No score' : `Total ${effectiveTotal} / 100`}
                        </span>
                      </div>

                      {/* Prominent reminder when the weights don't total 100 — this must be
                          resolved before the configuration can be saved. */}
                      {effectiveTotal > 0 && effectiveTotal !== 100 && (
                        <div className={`flex items-start gap-2 px-5 py-2.5 border-b text-xs font-semibold ${
                          effectiveTotal > 100
                            ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
                            : 'bg-[#FFF8E1] border-[#FDE68A] text-[#B45309]'
                        }`}>
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            {effectiveTotal > 100
                              ? `Weights total ${effectiveTotal} — over by ${effectiveTotal - 100}. Remove ${effectiveTotal - 100} point${effectiveTotal - 100 === 1 ? '' : 's'} so ${activeService} totals 100 before saving.`
                              : `Weights total ${effectiveTotal} — add ${100 - effectiveTotal} more point${100 - effectiveTotal === 1 ? '' : 's'} so ${activeService} reaches 100 before saving.`}
                          </span>
                        </div>
                      )}

                      <div className="px-5 py-3">
                        {scoreable.length === 0 ? (
                          <p className="text-sm text-[#717182] py-6 text-center">
                            No scoreable fields enabled for {activeService}. Enable fields in the Prescription Builder first.
                          </p>
                        ) : (
                          <div className="grid grid-cols-[1fr_auto] gap-x-4 items-center">
                            <div className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">Field (from Prescription Builder)</div>
                            <div className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider text-right">Weight</div>
                            {scoreable.map((field) => {
                              const on = isWeighted(field.id);
                              const w = weightOf(field.id);
                              const pct = on && effectiveTotal > 0 ? Math.round((w / effectiveTotal) * 100) : 0;
                              const isScanSlot = field.id.startsWith('scan_');
                              return (
                                <div key={field.id} className="contents">
                                  {/* Group header + master toggle above the first scan slot.
                                      Toggling it enables/disables all four scan types at once. */}
                                  {field.id === 'scan_upper' && (
                                    <div className="col-span-2 pt-3 pb-1 flex items-center justify-between gap-2">
                                      <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">3D scan files — by scan type</p>
                                      <span className="flex items-center gap-2">
                                        <span className="text-[10px] font-medium text-[#A0A0B0]">{anyScanOn ? 'All on' : 'All off'}</span>
                                        <Toggle on={anyScanOn} onClick={() => setAllScanSlots(!anyScanOn)} />
                                      </span>
                                    </div>
                                  )}
                                  <label className={`flex items-center gap-2.5 py-2 border-b border-[#F6F6F9] cursor-pointer ${isScanSlot ? 'pl-7' : ''}`}>
                                    <Toggle on={on} onClick={() => {
                                      if (on) { toggleField(activeService, field.id, false); }
                                      // Seed with up to 10 — but never more than the budget left to 100.
                                      else { setFieldWeight(activeService, field.id, Math.min(10, Math.max(0, 100 - effectiveTotal))); }
                                    }} />
                                    <span className="min-w-0">
                                      <span className={`block text-sm ${on ? 'text-[#030213] font-medium' : 'text-[#717182]'}`}>{field.label}</span>
                                    </span>
                                  </label>
                                  <div className="flex items-center justify-end gap-2 py-2 border-b border-[#F6F6F9]">
                                    {on && effectiveTotal > 0 && <span className="text-[10px] text-[#A0A0B0] tabular-nums w-9 text-right">{pct}%</span>}
                                    <input
                                      type="number" min={0} max={100 - (effectiveTotal - w)}
                                      value={on ? w : ''}
                                      disabled={!on}
                                      placeholder="0"
                                      onChange={(e) => {
                                        // Keep the per-service total within 100 — a field can take at
                                        // most whatever budget the other fields leave free.
                                        const raw = parseInt(e.target.value || '0', 10);
                                        const maxAllowed = 100 - (effectiveTotal - w);
                                        setFieldWeight(activeService, field.id, Math.min(Math.max(0, raw), maxAllowed));
                                      }}
                                      className={`w-16 px-2 py-1.5 rounded-lg border text-sm text-right tabular-nums transition-colors ${
                                        on ? 'border-[#C8D8FC] bg-white text-[#030213] focus:border-[#4D8EF7] focus:outline-none' : 'border-[#EEEEF2] bg-[#F8F9FC] text-[#C0C0CC]'
                                      }`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F0EFF6]">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {effectiveTotal === 100 ? (
                              <><Check className="w-3.5 h-3.5 text-[#15803D]" /><span className="text-[#15803D] font-medium">Weights total 100 — ready.</span></>
                            ) : effectiveTotal > 100 ? (
                              <><AlertTriangle className="w-3.5 h-3.5 text-[#B91C1C]" /><span className="text-[#B91C1C] font-medium">Over by {effectiveTotal - 100} — reduce weights to total 100.</span></>
                            ) : effectiveTotal > 0 ? (
                              <><AlertTriangle className="w-3.5 h-3.5 text-[#B45309]" /><span className="text-[#B45309] font-medium">Add {100 - effectiveTotal} more {100 - effectiveTotal === 1 ? 'point' : 'points'} to reach 100.</span></>
                            ) : (
                              <><Info className="w-3.5 h-3.5 text-[#A0A0B0]" /><span className="text-[#717182]">Turn a field on and set a weight (total must reach 100).</span></>
                            )}
                          </div>
                          {effectiveTotal > 0 && (
                            <button
                              onClick={() => { clearService(activeService); toast.success(`${activeService} scoring cleared`); }}
                              className="text-[11px] font-semibold text-[#B91C1C] hover:underline flex-shrink-0"
                            >
                              Clear scoring
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {scoringTab === 'thresholds' && (
                <>
                  <div className="bg-gradient-to-br from-[#EEF4FF] to-[#F5F3FF] border border-[#DBEAFE] rounded-xl p-4 flex items-start gap-3">
                    <span className="w-9 h-9 rounded-lg bg-white border border-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                      <Gauge className="w-4 h-4 text-[#4D8EF7]" />
                    </span>
                    <div className="text-xs text-[#3A4A63] leading-relaxed">
                      <span className="font-semibold text-[#1565C0]">Score bands.</span>{' '}
                      Each band covers a percentage range. Set the upper end of a band — the next band starts one above it.
                      Turn a band off to merge its range into the next one up.
                    </div>
                  </div>

                  {/* Band preview */}
                  <div className="bg-white border border-[#E0E0E6] rounded-xl p-5">
                    <p className="text-xs font-semibold text-[#030213] mb-3">Band preview</p>
                    {(() => {
                      const enabled = thresholds.filter(t => t.enabled).slice().sort((a, b) => a.upTo - b.upTo);
                      let prev = -1;
                      const segs = enabled.map(t => { const from = prev + 1; const width = t.upTo - Math.max(prev, 0); prev = t.upTo; return { id: t.id, label: t.label, from, to: t.upTo, width: Math.max(0, width) }; });
                      return (
                        <>
                          <div className="flex w-full h-9 rounded-lg overflow-hidden border border-[#E8E8EC]">
                            {segs.map(s => (
                              <div key={s.id} style={{ width: `${s.width}%`, background: BAND_UI[TIER_BAND[s.id]].solid }} className="flex flex-col items-center justify-center px-0.5 leading-tight" title={`${s.label}: ${s.from}–${s.to}%`}>
                                {s.width >= 14 && <span className="text-[10px] font-bold text-white truncate max-w-full">{s.label}</span>}
                                {s.width >= 14 && <span className="text-[9px] font-semibold text-white/90 tabular-nums">{s.from}–{s.to}%</span>}
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between mt-1 text-[10px] text-[#A0A0B0] tabular-nums"><span>0%</span><span>50%</span><span>100%</span></div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Tier rows */}
                  <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 px-5 py-2.5 border-b border-[#F0EFF6] text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">
                      <span>Enabled</span><span>Band</span><span className="text-right">Range (%)</span>
                    </div>
                    {thresholds.map((t) => {
                      const ui = BAND_UI[TIER_BAND[t.id]];
                      const isComplete = t.id === 'complete';
                      const from = bandRanges[t.id]?.from ?? 0;
                      return (
                        <div key={t.id} className="grid grid-cols-[auto_1fr_auto] gap-x-4 items-center px-5 py-3 border-b border-[#F6F6F9] last:border-b-0">
                          <div className="flex items-center">
                            {isComplete
                              ? <span className="text-[10px] font-semibold text-[#A0A0B0] px-2 py-1 rounded-md bg-[#F3F3F5]">Always on</span>
                              : <Toggle on={t.enabled} onClick={() => toggleThreshold(t.id, !t.enabled)} />}
                          </div>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ui.solid }} />
                            <input
                              value={t.label}
                              onChange={(e) => setThresholdLabel(t.id, e.target.value)}
                              disabled={!t.enabled}
                              className={`min-w-0 flex-1 px-2 py-1.5 rounded-lg border text-sm transition-colors ${
                                t.enabled ? 'border-transparent hover:border-[#E0E0E6] focus:border-[#4D8EF7] focus:outline-none text-[#030213] font-medium' : 'border-transparent text-[#A0A0B0]'
                              }`}
                            />
                          </div>
                          {/* Explicit From – To range */}
                          <div className="flex items-center justify-end gap-1.5">
                            {!t.enabled ? (
                              <span className="text-xs text-[#A0A0B0] italic">Off · merged up</span>
                            ) : (
                              <>
                                <span className="text-sm font-semibold text-[#030213] tabular-nums w-7 text-right">{from}</span>
                                <span className="text-[#C0C0CC]">–</span>
                                {isComplete ? (
                                  <span className="text-sm font-semibold text-[#030213] tabular-nums w-14 text-center">100</span>
                                ) : (
                                  <input
                                    type="number" min={from} max={100}
                                    value={t.upTo}
                                    onChange={(e) => setThresholdUpTo(t.id, parseInt(e.target.value || '0', 10))}
                                    className="w-14 px-2 py-1.5 rounded-lg border text-sm text-center tabular-nums border-[#C8D8FC] bg-white text-[#030213] focus:border-[#4D8EF7] focus:outline-none"
                                  />
                                )}
                                <span className="text-xs text-[#A0A0B0]">%</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}


              {/* Case Scoring Emails — the full Automated Case Scoring Emails
                  module (email integration, per-outcome automation, template
                  selection + custom templates). Replaces the old Auto-Email
                  prototype so this inner tab IS the feature's single home. */}
              {scoringTab === 'email' && <CaseScoringEmailsSettings />}
            </>
          )}

          {/* Save bar — sticks to the bottom of the viewport on long pages */}
          <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 bg-white border border-[#E0E0E6] rounded-xl px-5 py-3.5 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.15)]">
            <div className="flex items-center gap-2 text-xs text-[#717182]">
              <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
              Changes apply live — the form and scores update across the lab and clinic instantly.
            </div>
            <button
              onClick={() => {
                if (invalidScoringServices.length > 0) {
                  toast.error(`Weights must total 100 before saving. Fix: ${invalidScoringServices.join(', ')}.`);
                  // Jump to the first offending service so the fix is one click away.
                  setActiveService(invalidScoringServices[0]);
                  return;
                }
                toast.success('Configuration saved');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
            >
              <Save className="w-4 h-4" />
              Save changes
            </button>
          </div>
        </section>
      </div>

      {/* Configure services & prescriptions — side drawer (opened from the list) */}
      {configService && (
        <ServiceConfigDrawer
          service={configService}
          onSelectService={setConfigService}
          onClose={() => setConfigService(null)}
        />
      )}
    </div>
  );
}
