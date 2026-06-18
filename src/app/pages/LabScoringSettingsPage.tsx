import { useMemo, useState } from 'react';
import {
  Sliders, Gauge, FileText, RotateCcw, CheckCircle2, Info, Sparkles, Save,
  ChevronRight, AlertTriangle, Plus, X, FolderKanban,
} from 'lucide-react';
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
    toggleField, setFieldWeight, clearService, resetDefaults,
    setThresholdUpTo, toggleThreshold, setThresholdLabel,
  } = useCaseScoring();

  const [section, setSection] = useState<Section>('prescription');
  const [scoringTab, setScoringTab] = useState<'weights' | 'thresholds'>('weights');
  const [activeService, setActiveService] = useState<string>(SCOREABLE_SERVICE_TYPES[0]);

  const anyStale = useMemo(() => SCOREABLE_SERVICE_TYPES.some(s => isServiceStale(s)), [isServiceStale]);

  const statusFor = (service: string): ServiceStatus => {
    if (isServiceStale(service)) return 'stale';
    return (config[service] ?? []).some(f => f.weight > 0) ? 'scored' : 'unscored';
  };

  // ── Shared vertical service selector — grouped by category like case creation ──
  const renderServiceButton = (service: string) => {
    const active = service === activeService;
    const status = statusFor(service);
    return (
      <button
        key={service}
        onClick={() => setActiveService(service)}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 mb-0.5 rounded-lg text-left transition-colors ${
          active ? 'bg-[#EEF4FF] text-[#030213]' : 'text-[#5A5568] hover:bg-[#F8F9FC]'
        }`}
      >
        <StatusDot status={status} />
        <span className="flex-1 min-w-0">
          <span className={`block text-sm truncate ${active ? 'font-semibold' : 'font-medium'}`}>{service}</span>
          <span className={`block text-[10px] ${status === 'stale' ? 'text-[#B45309]' : 'text-[#A0A0B0]'}`}>
            {status === 'stale' ? 'Out of sync' : status === 'scored' ? 'Scored' : 'No score'}
          </span>
        </span>
        {active && <ChevronRight className="w-3.5 h-3.5 text-[#4D8EF7] flex-shrink-0" />}
      </button>
    );
  };
  const serviceSelector = (
    <div className="sm:w-56 flex-shrink-0">
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
  const weightOf = (id: string) => config[activeService]?.find(f => f.id === id)?.weight ?? 0;
  const isWeighted = (id: string) => weightOf(id) > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#030213]">Cases</h1>
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
              {/* Inner tabs: Weights | Thresholds */}
              <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E0E0E6] rounded-lg">
                {([['weights', 'Field Weights'], ['thresholds', 'Score Bands']] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setScoringTab(id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      scoringTab === id ? 'bg-[#EEF4FF] text-[#1565C0]' : 'text-[#717182] hover:text-[#030213]'
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
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#030213]">{activeService}</p>
                          <p className="text-[11px] text-[#717182] mt-0.5">Weight the enabled fields · score = earned ÷ total</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border flex-shrink-0 ${
                          effectiveTotal > 0 ? 'bg-[#ECFEFF] text-[#0F766E] border-[#A5F3FC]' : 'bg-[#F3F3F5] text-[#A0A0B0] border-[#E0E0E6]'
                        }`}>
                          {effectiveTotal > 0 ? `Total ${effectiveTotal}` : 'No score'}
                        </span>
                      </div>

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
                              return (
                                <div key={field.id} className="contents">
                                  <label className="flex items-center gap-2.5 py-2 border-b border-[#F6F6F9] cursor-pointer">
                                    <Toggle on={on} onClick={() => toggleField(activeService, field.id, !on)} />
                                    <span className="min-w-0">
                                      <span className={`block text-sm ${on ? 'text-[#030213] font-medium' : 'text-[#717182]'}`}>{field.label}</span>
                                      {field.required && <span className="block text-[10px] text-[#C2410C]">Required in prescription</span>}
                                    </span>
                                  </label>
                                  <div className="flex items-center justify-end gap-2 py-2 border-b border-[#F6F6F9]">
                                    {on && effectiveTotal > 0 && <span className="text-[10px] text-[#A0A0B0] tabular-nums w-9 text-right">{pct}%</span>}
                                    <input
                                      type="number" min={0} max={100}
                                      value={on ? w : ''}
                                      disabled={!on}
                                      placeholder="0"
                                      onChange={(e) => setFieldWeight(activeService, field.id, parseInt(e.target.value || '0', 10))}
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
                          <div className="flex items-center gap-1.5 text-[11px] text-[#717182]">
                            <Info className="w-3.5 h-3.5 text-[#A0A0B0]" />
                            Fields come from the Prescription Builder. Turn one on and set a weight.
                          </div>
                          {effectiveTotal > 0 && (
                            <button
                              onClick={() => { clearService(activeService); toast.success(`${activeService} scoring cleared`); }}
                              className="text-[11px] font-semibold text-[#B91C1C] hover:underline"
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
                      Decide up to what percentage each band applies. A score lands in the first enabled band it doesn't
                      exceed. Turn a band off to merge its range into the next one up.
                    </div>
                  </div>

                  {/* Band preview */}
                  <div className="bg-white border border-[#E0E0E6] rounded-xl p-5">
                    <p className="text-xs font-semibold text-[#030213] mb-3">Band preview</p>
                    {(() => {
                      const enabled = thresholds.filter(t => t.enabled).slice().sort((a, b) => a.upTo - b.upTo);
                      let prev = 0;
                      const segs = enabled.map(t => { const from = prev; prev = t.upTo; return { id: t.id, label: t.label, from, to: t.upTo, width: Math.max(0, t.upTo - from) }; });
                      return (
                        <>
                          <div className="flex w-full h-7 rounded-lg overflow-hidden border border-[#E8E8EC]">
                            {segs.map(s => (
                              <div key={s.id} style={{ width: `${s.width}%`, background: BAND_UI[TIER_BAND[s.id]].solid }} className="flex items-center justify-center" title={`${s.label}: ${s.from}–${s.to}%`}>
                                {s.width >= 12 && <span className="text-[10px] font-bold text-white">{s.label}</span>}
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
                      <span>Enabled</span><span>Band</span><span className="text-right">Up to</span>
                    </div>
                    {thresholds.map((t) => {
                      const ui = BAND_UI[TIER_BAND[t.id]];
                      const isComplete = t.id === 'complete';
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
                          <div className="flex items-center justify-end gap-1">
                            {isComplete ? (
                              <span className="text-sm font-semibold text-[#030213] tabular-nums w-16 text-right pr-2">100%</span>
                            ) : (
                              <>
                                <input
                                  type="number" min={0} max={100}
                                  value={t.upTo}
                                  disabled={!t.enabled}
                                  onChange={(e) => setThresholdUpTo(t.id, parseInt(e.target.value || '0', 10))}
                                  className={`w-16 px-2 py-1.5 rounded-lg border text-sm text-right tabular-nums transition-colors ${
                                    t.enabled ? 'border-[#C8D8FC] bg-white text-[#030213] focus:border-[#4D8EF7] focus:outline-none' : 'border-[#EEEEF2] bg-[#F8F9FC] text-[#C0C0CC]'
                                  }`}
                                />
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
            </>
          )}

          {/* Save bar */}
          <div className="flex items-center justify-between gap-3 bg-white border border-[#E0E0E6] rounded-xl px-5 py-3.5">
            <div className="flex items-center gap-2 text-xs text-[#717182]">
              <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
              Changes apply live — the form and scores update across the lab and clinic instantly.
            </div>
            <button
              onClick={() => toast.success('Configuration saved')}
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
