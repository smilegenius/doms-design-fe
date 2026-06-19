import { useMemo, useState } from 'react';
import {
  Sliders, Gauge, FileText, RotateCcw, CheckCircle2, Info, Sparkles, Save,
  ChevronDown, AlertTriangle, Plus, X, FolderKanban, Mail, Copy, Check,
} from 'lucide-react';
import ModalPortal from '../components/ModalPortal';
import { useToast } from '../context/ToastContext';
import { useCaseScoring } from '../context/CaseScoringContext';
import { SCOREABLE_SERVICE_TYPES, SERVICE_GROUPS, TIER_BAND, ScoreBand, SCORE_FIELD_DEF_MAP, MISSING_INFO_EMAIL, MISSING_INFO_EMAIL_PLACEHOLDERS } from '../data/caseScoring';
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

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
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

function AddOption({ onAdd }: { onAdd: (v: string) => void }) {
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

export default function LabScoringSettingsPage() {
  const { toast } = useToast();
  const {
    config, thresholds, prescription,
    setPrescriptionEnabled, setPrescriptionRequired, addPrescriptionOption, removePrescriptionOption,
    staleFieldsForService, isServiceStale,
    toggleField, setFieldWeight, clearService, resetDefaults, setServiceScoringEnabled,
    setThresholdUpTo, toggleThreshold, setThresholdLabel,
  } = useCaseScoring();

  const [section, setSection] = useState<Section>('prescription');
  const [scoringTab, setScoringTab] = useState<'weights' | 'thresholds' | 'email'>('weights');
  const [activeService, setActiveService] = useState<string>(SCOREABLE_SERVICE_TYPES[0]);

  // ── Auto-email config (local — prototype) ──
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailSubject, setEmailSubject] = useState(MISSING_INFO_EMAIL.subject);
  const [emailBody, setEmailBody] = useState(MISSING_INFO_EMAIL.body);
  const [emailTemplateOpen, setEmailTemplateOpen] = useState(false);
  const [triggerIncomplete, setTriggerIncomplete] = useState(true);
  const [triggerAttention, setTriggerAttention] = useState(true);
  const [markSentForReview, setMarkSentForReview] = useState(true);
  const emailIsDefault = emailSubject === MISSING_INFO_EMAIL.subject && emailBody === MISSING_INFO_EMAIL.body;
  // Step 1 — the mailbox that sends the emails + receives replies. Connect any
  // of 3 providers (mirrors the Invoices dispute module).
  const [mailboxConnected, setMailboxConnected] = useState(false);
  const [mailboxProvider, setMailboxProvider] = useState<'gmail' | 'outlook' | 'm365' | null>(null);
  const [connectDrawerOpen, setConnectDrawerOpen] = useState(false);
  const connectedEmail = 'lab.replies@smilegenius.co.uk';
  const providerLabel = (p: typeof mailboxProvider) => p === 'gmail' ? 'Gmail' : p === 'outlook' ? 'Outlook' : p === 'm365' ? 'Microsoft 365' : '';
  const connectMailbox = (p: 'gmail' | 'outlook' | 'm365') => {
    setMailboxProvider(p);
    setMailboxConnected(true);
    setConnectDrawerOpen(false);
    toast.success(`Connected to ${providerLabel(p)}`);
  };

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
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#030213]">Configuration</h1>
          <p className="text-sm text-[#717182] mt-0.5">
            Build the prescription form and decide how cases are scored. Scoring is driven by the fields you enable here.
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
        {/* Left menu — a single "Cases" section */}
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

        {/* Panel */}
        <section className="flex-1 min-w-0 space-y-4">
          {/* Horizontal tabs — Prescription Builder · Case Scoring (matches invoice config) */}
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

          {/* ── PRESCRIPTION BUILDER ── */}
          {section === 'prescription' && (
            <>
              <div className="bg-gradient-to-br from-[#EEF4FF] to-[#F5F3FF] border border-[#DBEAFE] rounded-xl p-4 flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-white border border-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-[#4D8EF7]" />
                </span>
                <div className="text-xs text-[#3A4A63] leading-relaxed">
                  <span className="font-semibold text-[#1565C0]">Prescription Builder.</span>{' '}
                  These are the fields a clinic fills in when creating a case. Turn fields on/off, mark them
                  required, and edit the dropdown values. Fields tagged <span className="font-semibold">Scored</span> feed Case Scoring.
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                {serviceSelector}
                <div className="flex-1 min-w-0 bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#F0EFF6] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#030213]">{activeService}</p>
                      <p className="text-[11px] text-[#717182] mt-0.5">
                        {SERVICE_CASE_COUNTS[activeService] ?? 0} case{(SERVICE_CASE_COUNTS[activeService] ?? 0) === 1 ? '' : 's'} ·{' '}
                        {fields.filter(f => f.enabled).length} of {fields.length} fields on
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-[#F6F6F9]">
                    {fields.map((field) => {
                      const weighted = isWeighted(field.id);
                      return (
                        <div key={field.id} className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Toggle
                              on={field.enabled}
                              onClick={() => {
                                const turningOff = field.enabled;
                                if (turningOff && field.scoreable && weighted) {
                                  toast.error(`"${field.label}" is used in Case Scoring — scoring for ${activeService} will go out of sync.`);
                                }
                                setPrescriptionEnabled(activeService, field.id, !field.enabled);
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm ${field.enabled ? 'text-[#030213] font-medium' : 'text-[#A0A0B0]'}`}>{field.label}</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F3F3F5] text-[#8B8B9E]">{TYPE_LABEL[field.type]}</span>
                                {field.scoreable && weighted && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#EEF4FF] text-[#1565C0] border border-[#C8D8FC]">Scored</span>
                                )}
                              </div>
                              {field.hint && <span className="block text-[10px] text-[#A0A0B0] mt-0.5">{field.hint}</span>}
                            </div>
                            {/* Required / Optional */}
                            <button
                              type="button"
                              disabled={!field.enabled}
                              onClick={() => setPrescriptionRequired(activeService, field.id, !field.required)}
                              className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors flex-shrink-0 ${
                                !field.enabled
                                  ? 'opacity-40 cursor-not-allowed border-[#EEEEF2] text-[#C0C0CC]'
                                  : field.required
                                    ? 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA] hover:bg-[#FFEDD5]'
                                    : 'bg-[#F8F9FC] text-[#717182] border-[#E0E0E6] hover:border-[#4D8EF7]'
                              }`}
                            >
                              {field.required ? 'Required' : 'Optional'}
                            </button>
                          </div>

                          {/* Dropdown options editor */}
                          {field.enabled && (field.type === 'select' || field.type === 'multiselect') && field.options && (
                            <div className="mt-2 ml-12 flex flex-wrap gap-1.5 items-center">
                              {field.options.map((opt) => (
                                <span key={opt} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[#F3F3F5] text-[#5A5568] border border-[#E8E8EC]">
                                  {opt}
                                  <button type="button" onClick={() => removePrescriptionOption(activeService, field.id, opt)} className="text-[#A0A0B0] hover:text-[#D4183D]" title="Remove value">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </span>
                              ))}
                              <AddOption onAdd={(v) => addPrescriptionOption(activeService, field.id, v)} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-5 py-3 border-t border-[#F0EFF6] flex items-center gap-1.5 text-[11px] text-[#717182]">
                    <Info className="w-3.5 h-3.5 text-[#A0A0B0]" />
                    Disabling a <span className="font-semibold text-[#1565C0]">Scored</span> field affects Case Scoring — you'll be alerted.
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── CASE SCORING ── */}
          {section === 'scoring' && (
            <>
              {/* Inner tabs: Weights | Bands | Auto-Email — full width */}
              <div className="flex items-center gap-1 p-1 bg-white border border-[#E0E0E6] rounded-lg">
                {([['weights', 'Field Weights'], ['thresholds', 'Score Bands'], ['email', 'Auto-Email']] as const).map(([id, label]) => (
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

              {scoringTab === 'email' && (
                <>
                  {/* Intro */}
                  <div className="bg-gradient-to-br from-[#EEF4FF] to-[#F5F3FF] border border-[#DBEAFE] rounded-xl p-4 flex items-start gap-3">
                    <span className="w-9 h-9 rounded-lg bg-white border border-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-[#4D8EF7]" />
                    </span>
                    <div className="text-xs text-[#3A4A63] leading-relaxed">
                      <span className="font-semibold text-[#1565C0]">Auto-email the dentist.</span>{' '}
                      When a case is missing required info, email the dentist the missing items automatically so they can update the case. Replies show up on the case.
                    </div>
                  </div>

                  {/* Step 1 — connect the mailbox that sends emails + receives replies */}
                  <div className="bg-white border border-[#E0E0E6] rounded-xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-lg bg-[#EEF4FF] border border-[#C8D8FC] flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-[#1565C0]" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">Step 1 · Mailbox</p>
                        {mailboxConnected ? (
                          <p className="text-sm font-medium text-[#030213] flex items-center gap-1.5 flex-wrap">
                            <CheckCircle2 className="w-4 h-4 text-[#15803D]" /> Connected ·
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] font-semibold text-[#2E7D32]"><span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32]" />{providerLabel(mailboxProvider)}</span>
                            <span className="font-mono text-[#1565C0]">{connectedEmail}</span>
                          </p>
                        ) : (
                          <p className="text-sm font-medium text-[#030213]">Connect the inbox that receives dentist replies</p>
                        )}
                        <p className="text-[11px] text-[#717182] mt-0.5">Emails are sent from — and replies are read in — this mailbox.</p>
                      </div>
                    </div>
                    {mailboxConnected ? (
                      <button onClick={() => { setMailboxConnected(false); setMailboxProvider(null); toast.success('Mailbox disconnected'); }} className="text-[11px] font-semibold text-[#B91C1C] hover:underline flex-shrink-0">Disconnect</button>
                    ) : (
                      <button onClick={() => setConnectDrawerOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity flex-shrink-0">
                        <Mail className="w-4 h-4" /> Connect mailbox
                      </button>
                    )}
                  </div>

                  <div className={`bg-white border border-[#E0E0E6] rounded-xl p-5 space-y-4 ${!mailboxConnected ? 'opacity-60' : ''}`}>
                    {/* Master toggle */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#030213]">Send missing-info email</p>
                        <p className="text-xs text-[#717182] mt-0.5 leading-relaxed">
                          {!mailboxConnected ? 'Connect a mailbox above to enable auto-emails.' : emailEnabled ? 'Sent automatically to the dentist when an incoming case is missing required info.' : 'Paused — no automatic emails are sent.'}
                        </p>
                      </div>
                      <Toggle on={emailEnabled && mailboxConnected} disabled={!mailboxConnected} onClick={() => { setEmailEnabled(!emailEnabled); toast.success(`Auto-email ${!emailEnabled ? 'enabled' : 'paused'}`); }} />
                    </div>

                    {mailboxConnected && emailEnabled && (
                      <>
                        {/* Trigger */}
                        <div className="pt-4 border-t border-[#F0EFF6]">
                          <p className="text-[11px] font-semibold text-[#5A5568] uppercase tracking-wider mb-2">Send when a case is</p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { on: triggerIncomplete, set: setTriggerIncomplete, label: 'Incomplete', dot: '#EF4444' },
                              { on: triggerAttention, set: setTriggerAttention, label: 'Need Attention', dot: '#F59E0B' },
                            ].map((t) => (
                              <button
                                key={t.label}
                                onClick={() => t.set(!t.on)}
                                role="checkbox"
                                aria-checked={t.on}
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                  t.on ? 'bg-[#EEF4FF] text-[#1565C0] border-[#C8D8FC]' : 'bg-white text-[#717182] border-[#E0E0E6] hover:border-[#4D8EF7]'
                                }`}
                              >
                                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  t.on ? 'bg-[#4D8EF7] border-[#4D8EF7]' : 'bg-white border-[#D4CEE1]'
                                }`}>
                                  {t.on && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                </span>
                                <span className="w-2 h-2 rounded-full" style={{ background: t.dot }} />
                                {t.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-[#A0A0B0] mt-1.5">Complete cases never trigger an email.</p>
                        </div>

                        {/* Template editor */}
                        <div className="border border-[#E0E0E6] rounded-lg overflow-hidden">
                          <button onClick={() => setEmailTemplateOpen(o => !o)} className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-[#FAFBFC] hover:bg-[#F3F4F8] transition-colors">
                            <span className="flex items-center gap-2 min-w-0">
                              <Mail className="w-3.5 h-3.5 text-[#717182] flex-shrink-0" />
                              <span className="text-sm font-medium text-[#030213]">Email template</span>
                              {!emailIsDefault && <span className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider bg-[#EEF4FF] text-[#1565C0] border border-[#BFDBFE]">Customised</span>}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-[#717182] flex-shrink-0">
                              {emailTemplateOpen ? 'Hide' : 'Edit'}
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${emailTemplateOpen ? 'rotate-180' : ''}`} />
                            </span>
                          </button>
                          {emailTemplateOpen && (
                            <div className="p-3.5 space-y-3 border-t border-[#F0EFF6]">
                              <div>
                                <label className="block text-[11px] font-semibold text-[#5A5568] uppercase tracking-wider mb-1">Subject</label>
                                <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/15" />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-[#5A5568] uppercase tracking-wider mb-1">Body</label>
                                <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={11} className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/15 font-mono leading-relaxed resize-y" />
                              </div>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex flex-wrap gap-1">
                                  {MISSING_INFO_EMAIL_PLACEHOLDERS.map((p) => (
                                    <button key={p} onClick={() => { navigator.clipboard?.writeText(`{{${p}}}`); toast.success(`Copied {{${p}}}`); }} title="Click to copy" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-[#BFDBFE] text-[10px] font-mono font-semibold text-[#1565C0] hover:bg-[#EEF4FF]">
                                      {`{{${p}}}`}<Copy className="w-2.5 h-2.5" />
                                    </button>
                                  ))}
                                </div>
                                <button disabled={emailIsDefault} onClick={() => { setEmailSubject(MISSING_INFO_EMAIL.subject); setEmailBody(MISSING_INFO_EMAIL.body); toast.success('Template reset to default'); }} className="text-[11px] font-medium text-[#717182] hover:text-[#030213] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0">Reset to default</button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Post-send action */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#030213]">Set status to "Sent for Review"</p>
                            <p className="text-xs text-[#717182] mt-0.5">After the email goes out, move the case to Sent for Review.</p>
                          </div>
                          <Toggle on={markSentForReview} onClick={() => setMarkSentForReview(!markSentForReview)} />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Connect-mailbox drawer (Step 1) — same 3-provider flow as the Invoices dispute module.
                      Rendered through ModalPortal (document root) so the backdrop covers the FULL
                      viewport — the page's animated scroll container would otherwise clip a plain
                      fixed child to itself. */}
                  {connectDrawerOpen && (
                    <ModalPortal>
                    <div className="fixed inset-0 z-[120] flex">
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setConnectDrawerOpen(false)} />
                      <div className="relative md:ml-auto flex flex-col bg-white shadow-2xl w-full md:w-[55%] md:max-w-[680px] h-full animate-in slide-in-from-right duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6] flex-shrink-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#EEF4FF] flex items-center justify-center flex-shrink-0"><Mail className="w-4 h-4 text-[#4D8EF7]" /></div>
                            <div className="min-w-0">
                              <h3 className="text-base font-semibold text-[#030213] truncate">Connect mailbox</h3>
                              <p className="text-[11px] text-[#717182] truncate">Missing-info emails &amp; dentist replies</p>
                            </div>
                          </div>
                          <button onClick={() => setConnectDrawerOpen(false)} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-[#FAFBFC]">
                          <div className="flex flex-col items-center text-center px-8 py-12">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center mb-4"><Mail className="w-7 h-7 text-white" /></div>
                            <h4 className="text-base font-semibold text-[#030213] mb-1">Connect your mailbox</h4>
                            <p className="text-sm text-[#717182] max-w-md leading-relaxed mb-6">
                              Missing-info emails are sent as real emails from your own address. Once connected, every dentist reply lands back on the case so you don't have to switch to your inbox.
                            </p>
                            <div className="grid grid-cols-3 gap-3 w-full max-w-md">
                              {([
                                { id: 'gmail',   label: 'Gmail',         color: 'text-[#EA4335]', sub: 'OAuth via Google' },
                                { id: 'outlook', label: 'Outlook',       color: 'text-[#0078D4]', sub: 'OAuth via Microsoft' },
                                { id: 'm365',    label: 'Microsoft 365', color: 'text-[#185ABD]', sub: 'OAuth via Microsoft' },
                              ] as const).map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => connectMailbox(p.id)}
                                  className="flex flex-col items-center gap-1.5 p-4 bg-white border border-[#E0E0E6] rounded-xl hover:border-[#4D8EF7] hover:shadow-sm transition-all"
                                >
                                  <Mail className={`w-5 h-5 ${p.color}`} />
                                  <span className="text-xs font-semibold text-[#030213]">{p.label}</span>
                                  <span className="text-[10px] text-[#A0A0B0]">{p.sub}</span>
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-[#A0A0B0] mt-6 max-w-md">
                              We request read + send permission on the connected mailbox and only show messages associated with case threads. Demo only — no real account is connected.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    </ModalPortal>
                  )}
                </>
              )}
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
    </div>
  );
}
