import { ReactNode, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Send } from 'lucide-react';
import { useCaseScoring } from '../../src/app/context/CaseScoringContext';
import { DEFAULT_PRESCRIPTION_CONFIG, PrescriptionField } from '../../src/app/data/prescriptionBuilder';
import FdiPicker, { ToothChips } from '../design-studio/markup/FdiPicker';
import { FileDropZone, FileList } from '../design-studio/components/FileChips';
import type { DesignFile } from '../design-studio/data/designStudio';
import { CLINICAL_HINT, storeClinicalFiles } from '../upload-links/clinicalFiles';
import { accentFor, IntakeConfig, IntakeSubmission, submitIntake } from './intakeStore';

// ── The lab's intake form ────────────────────────────────────────────────────
// Shared by the public page (/intake/:slug, optionally embedded in an iframe)
// and the live preview in Settings. The prescription step shows the enabled
// fields of the lab's own Prescription Builder for the chosen service.

const STEPS = ['About you', 'Patient', 'Prescription', 'Review & send'] as const;
const MIN_FILL_MS = 3000;

const inputCls = 'w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm text-[#030213] bg-white focus:outline-none focus:border-[#4D8EF7]';
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export function LabMark({ config, size = 40 }: { config: IntakeConfig; size?: number }) {
  const a = accentFor(config.accent);
  if (config.logo) return <img src={config.logo} alt={config.labName} style={{ height: size, maxWidth: size * 4 }} className="object-contain object-left max-w-full" />;
  const initials = config.labName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
  return (
    <span style={{ width: size, height: size, background: `linear-gradient(135deg, ${a.from}, ${a.to})` }} className="rounded-xl text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
      {initials}
    </span>
  );
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[#030213] mb-1">{label}{required && <span className="text-[#D4183D]"> *</span>}</span>
      {children}
      {hint && <span className="block text-[11px] text-[#A0A0B0] mt-1">{hint}</span>}
    </label>
  );
}

interface Values {
  dentist: string; gdc: string; practice: string; postcode: string; email: string; phone: string;
  patientName: string; patientDob: string; patientRef: string;
  service: string; teeth: number[]; fields: Record<string, string>; multi: Record<string, string[]>;
}

const EMPTY: Values = {
  dentist: '', gdc: '', practice: '', postcode: '', email: '', phone: '',
  patientName: '', patientDob: '', patientRef: '', service: '', teeth: [], fields: {}, multi: {},
};

export default function IntakeForm({ config, preview = false }: { config: IntakeConfig; preview?: boolean }) {
  const { prescription } = useCaseScoring();
  const a = accentFor(config.accent);
  const grad = { background: `linear-gradient(90deg, ${a.from}, ${a.to})` };
  const started = useRef(Date.now());
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Values>(EMPTY);
  const [files, setFiles] = useState<DesignFile[]>([]);
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<IntakeSubmission | 'quiet' | null>(null);

  const set = (patch: Partial<Values>) => { setV(x => ({ ...x, ...patch })); setErrors([]); };
  const setField = (id: string, val: string) => set({ fields: { ...v.fields, [id]: val } });

  const fields: PrescriptionField[] = useMemo(() => {
    const cfg = prescription[v.service] ?? DEFAULT_PRESCRIPTION_CONFIG[v.service] ?? [];
    return cfg.filter(f => f.enabled && f.type !== 'files');
  }, [prescription, v.service]);
  const wantsFiles = (prescription[v.service] ?? DEFAULT_PRESCRIPTION_CONFIG[v.service] ?? []).some(f => f.enabled && f.type === 'files');

  function validate(s: number): string[] {
    const e: string[] = [];
    if (s === 0) {
      if (!v.dentist.trim()) e.push('Your name');
      if (!v.gdc.trim()) e.push('GDC number');
      if (!v.practice.trim()) e.push('Practice name');
      if (!emailOk(v.email)) e.push('A valid email');
      if (!v.phone.trim()) e.push('Phone');
    }
    if (s === 1) {
      if (!v.patientName.trim()) e.push("Patient's name");
      if (!v.patientDob) e.push('Date of birth');
    }
    if (s === 2) {
      if (!v.service) e.push('Service');
      for (const f of fields) {
        if (!f.required) continue;
        const has = f.type === 'teeth' ? v.teeth.length > 0 : f.type === 'multiselect' ? (v.multi[f.id]?.length ?? 0) > 0 : f.type === 'toggle' ? true : !!v.fields[f.id];
        if (!has) e.push(f.label);
      }
    }
    if (s === 3 && !consent) e.push('Confirm you can share these details');
    return e;
  }

  function next() {
    const e = validate(step);
    if (e.length) { setErrors(e); return; }
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  }

  function submit() {
    const e = validate(3);
    if (e.length) { setErrors(e); return; }
    if (preview) return;
    // Bots fill the hidden field or submit instantly: accept quietly, create nothing.
    if (honeypot || Date.now() - started.current < MIN_FILL_MS) { setDone('quiet'); return; }
    const extras: Record<string, string> = {};
    for (const f of fields) {
      if (['teeth', 'material', 'shade', 'orderType', 'delivery', 'instructions'].includes(f.id)) continue;
      const val = f.type === 'multiselect' ? (v.multi[f.id] ?? []).join(', ') : v.fields[f.id];
      if (val) extras[f.label] = val;
    }
    setDone(submitIntake({
      dentist: v.dentist, gdc: v.gdc, practice: v.practice, postcode: v.postcode, email: v.email, phone: v.phone,
      patientName: v.patientName, patientDob: v.patientDob, patientRef: v.patientRef,
      service: v.service, teeth: v.teeth,
      material: v.fields.material, shade: v.fields.shade, orderType: v.fields.orderType,
      delivery: v.fields.delivery, instructions: v.fields.instructions, extras, files,
    }));
  }

  function renderField(f: PrescriptionField) {
    if (f.type === 'teeth') {
      return (
        <Field key={f.id} label={f.label} required={f.required}>
          <div className="flex flex-wrap items-center gap-1.5">
            <ToothChips teeth={v.teeth} onRemove={t => set({ teeth: v.teeth.filter(x => x !== t) })} />
            <FdiPicker teeth={v.teeth} onChange={teeth => set({ teeth })} />
          </div>
        </Field>
      );
    }
    if (f.type === 'multiselect') {
      const cur = v.multi[f.id] ?? [];
      return (
        <Field key={f.id} label={f.label} required={f.required}>
          <div className="flex flex-wrap gap-1.5">
            {(f.options ?? []).map(o => {
              const on = cur.includes(o);
              return (
                <button type="button" key={o} onClick={() => set({ multi: { ...v.multi, [f.id]: on ? cur.filter(x => x !== o) : [...cur, o] } })}
                  className={`px-2.5 py-1 rounded-full text-xs border ${on ? 'text-white border-transparent' : 'bg-white text-[#5A5568] border-[#E0E0E6]'}`} style={on ? grad : undefined}>
                  {o}
                </button>
              );
            })}
          </div>
        </Field>
      );
    }
    if (f.type === 'select' && f.id !== 'brand') {
      return (
        <Field key={f.id} label={f.label} required={f.required}>
          <select value={v.fields[f.id] ?? ''} onChange={e => setField(f.id, e.target.value)} className={inputCls}>
            <option value="">Select…</option>
            {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      );
    }
    if (f.type === 'date') {
      return (
        <Field key={f.id} label={f.label} required={f.required}>
          <input type="date" value={v.fields[f.id] ?? ''} min={new Date().toISOString().slice(0, 10)} onChange={e => setField(f.id, e.target.value)} className={inputCls} />
        </Field>
      );
    }
    if (f.type === 'toggle') {
      return (
        <label key={f.id} className="flex items-center gap-2 text-sm text-[#030213]">
          <input type="checkbox" checked={v.fields[f.id] === 'Yes'} onChange={e => setField(f.id, e.target.checked ? 'Yes' : '')} className="accent-[#4D8EF7]" /> {f.label}
        </label>
      );
    }
    const long = f.id === 'instructions' || f.answerType === 'long';
    return (
      <Field key={f.id} label={f.id === 'brand' ? 'Implant system (brand, platform)' : f.label} required={f.required && f.id !== 'brand'}>
        {long
          ? <textarea rows={4} value={v.fields[f.id] ?? ''} onChange={e => setField(f.id, e.target.value)} className={`${inputCls} resize-none`} placeholder="Anything the lab should know" />
          : <input value={v.fields[f.id] ?? ''} onChange={e => setField(f.id, e.target.value)} className={inputCls} />}
      </Field>
    );
  }

  // Logo on the left, lab name + tag on the right, welcome line underneath.
  const header = (
    <div>
      <div className="h-1" style={grad} />
      <div className="px-5 sm:px-8 pt-6 pb-5 border-b border-[#F0EFF6]">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 max-w-[50%] flex-shrink"><LabMark config={config} size={44} /></div>
          <div className="min-w-0 text-right">
            <p className="text-base sm:text-lg font-semibold text-[#030213] leading-tight break-words">{config.labName}</p>
            <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ color: a.from, background: `${a.from}14` }}>New case request</span>
          </div>
        </div>
        {config.welcome && <p className="text-sm text-[#5A5568] leading-relaxed mt-4 pt-4 border-t border-dashed border-[#F0EFF6]">{config.welcome}</p>}
      </div>
    </div>
  );

  if (!config.enabled && !preview) {
    return (
      <div className="bg-white border border-[#E0E0E6] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
        {header}
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-semibold text-[#030213]">This form isn't taking new cases right now</p>
          <p className="text-xs text-[#717182] mt-1">Please contact {config.labName} directly.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-white border border-[#E0E0E6] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
        {header}
        <div className="px-6 py-10 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: a.from }} />
          <p className="text-lg font-semibold text-[#030213]">Thanks, {config.labName} has your request</p>
          <p className="text-sm text-[#717182] mt-1">
            {done === 'quiet' ? 'We\'ll be in touch soon.' : <>Your reference is <span className="font-mono font-semibold text-[#030213]">{done.ref}</span>. They'll be in touch at {done.email}.</>}
          </p>
          <button onClick={() => { setDone(null); setStep(0); setV(EMPTY); setFiles([]); setConsent(false); started.current = Date.now(); }} className="mt-5 text-sm font-medium" style={{ color: a.from }}>Send another case</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E0E0E6] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      {header}
      <div className="px-5 sm:px-8 py-4 border-b border-[#F0EFF6] bg-[#FAFBFD]">
        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((s, i) => (
            <li key={s} className="min-w-0">
              <div className="h-1 rounded-full mb-2" style={i <= step ? grad : { background: '#E9E9EF' }} />
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${i <= step ? 'text-white' : 'bg-white border border-[#E0E0E6] text-[#A0A0B0]'}`} style={i <= step ? grad : undefined}>{i < step ? '✓' : i + 1}</span>
                <span className={`hidden sm:inline text-xs truncate ${i === step ? 'font-semibold text-[#030213]' : i < step ? 'text-[#5A5568]' : 'text-[#A0A0B0]'}`}>{s}</span>
              </div>
            </li>
          ))}
        </ol>
        <p className="sm:hidden mt-2 text-xs text-[#717182]">Step {step + 1} of {STEPS.length} · <span className="font-semibold text-[#030213]">{STEPS[step]}</span></p>
      </div>

      <div className="px-5 sm:px-8 py-6 space-y-4">
        {/* Honeypot: hidden from people, irresistible to bots. */}
        <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={honeypot} onChange={e => setHoneypot(e.target.value)} name="website" className="absolute -left-[9999px] w-px h-px opacity-0" />

        {step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Your name" required><input value={v.dentist} onChange={e => set({ dentist: e.target.value })} className={inputCls} placeholder="Dr. Jane Smith" /></Field>
            <Field label="GDC number" required><input value={v.gdc} onChange={e => set({ gdc: e.target.value.replace(/[^\d]/g, '').slice(0, 7) })} inputMode="numeric" className={inputCls} placeholder="123456" /></Field>
            <Field label="Practice name" required><input value={v.practice} onChange={e => set({ practice: e.target.value })} className={inputCls} placeholder="Riverside Dental" /></Field>
            <Field label="Practice postcode"><input value={v.postcode} onChange={e => set({ postcode: e.target.value.toUpperCase() })} className={inputCls} placeholder="SW1A 1AA" /></Field>
            <Field label="Email" required><input type="email" value={v.email} onChange={e => set({ email: e.target.value })} className={inputCls} placeholder="you@practice.co.uk" /></Field>
            <Field label="Phone" required><input type="tel" value={v.phone} onChange={e => set({ phone: e.target.value })} className={inputCls} placeholder="020 7946 0123" /></Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Patient's full name" required><input value={v.patientName} onChange={e => set({ patientName: e.target.value })} className={inputCls} /></Field>
            <Field label="Date of birth" required><input type="date" value={v.patientDob} max={new Date().toISOString().slice(0, 10)} onChange={e => set({ patientDob: e.target.value })} className={inputCls} /></Field>
            <Field label="Your patient reference" hint="Optional: your practice system's ID, so the lab can quote it back."><input value={v.patientRef} onChange={e => set({ patientRef: e.target.value })} className={inputCls} /></Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="Service" required>
              <div className="flex flex-wrap gap-1.5">
                {config.services.map(s => (
                  <button type="button" key={s} onClick={() => set({ service: s, fields: {}, multi: {} })}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${v.service === s ? 'text-white border-transparent' : 'bg-white text-[#5A5568] border-[#E0E0E6] hover:bg-[#F8F9FC]'}`} style={v.service === s ? grad : undefined}>
                    {s}
                  </button>
                ))}
              </div>
            </Field>
            {v.service && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fields.map(f => <div key={f.id} className={f.type === 'teeth' || f.type === 'multiselect' || f.id === 'instructions' ? 'sm:col-span-2' : ''}>{renderField(f)}</div>)}
              </div>
            )}
            {v.service && (
              <div>
                <p className="text-xs font-medium text-[#030213] mb-1">Files {wantsFiles ? '' : '(optional)'}</p>
                <FileDropZone uploadedBy="clinician" store={storeClinicalFiles} accept="" folder compact title="Scans, CBCT / DICOM, photos" hint={CLINICAL_HINT} onAdded={f => setFiles(x => [...x, ...f])} />
                {files.length > 0 && <div className="mt-2"><FileList files={files} onRemove={id => setFiles(x => x.filter(f => f.id !== id))} /></div>}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            {[
              ['From', `${v.dentist} · GDC ${v.gdc} · ${v.practice}${v.postcode ? `, ${v.postcode}` : ''}`],
              ['Contact', `${v.email} · ${v.phone}`],
              ['Patient', `${v.patientName} · born ${v.patientDob ? new Date(`${v.patientDob}T12:00:00`).toLocaleDateString('en-GB') : '—'}${v.patientRef ? ` · ref ${v.patientRef}` : ''}`],
              ['Service', [v.service, v.teeth.length ? `teeth ${[...v.teeth].sort((x, y) => x - y).join(', ')}` : '', v.fields.material, v.fields.shade].filter(Boolean).join(' · ')],
              ['Files', files.length ? `${files.length} item${files.length === 1 ? '' : 's'}` : 'None'],
            ].map(([k, val]) => (
              <div key={k} className="flex gap-3 text-sm"><span className="w-20 flex-shrink-0 text-xs text-[#717182] pt-0.5">{k}</span><span className="text-[#030213] min-w-0 break-words">{val}</span></div>
            ))}
            {v.fields.instructions && <p className="text-sm text-[#030213] bg-[#F8F9FC] border border-[#F0EFF6] rounded-lg px-3 py-2 whitespace-pre-wrap">{v.fields.instructions}</p>}
            <label className="flex items-start gap-2 cursor-pointer pt-1">
              <input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setErrors([]); }} className="mt-0.5" style={{ accentColor: a.from }} />
              <span className="text-xs text-[#5A5568]">I confirm the patient has agreed to their details and records being shared with {config.labName} to make this appliance.</span>
            </label>
          </div>
        )}

        {errors.length > 0 && (
          <p className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">Please fill in: {errors.join(', ')}.</p>
        )}
      </div>

      <div className="px-5 sm:px-8 py-4 border-t border-[#F0EFF6] bg-[#FAFBFD] flex items-center justify-between gap-3">
        {step > 0
          ? <button type="button" onClick={() => setStep(s => s - 1)} className="inline-flex items-center gap-1 text-sm font-medium text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-4 h-4" /> Back</button>
          : <span />}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-95" style={grad}>Continue <ArrowRight className="w-4 h-4" /></button>
        ) : (
          <button type="button" onClick={submit} disabled={preview} title={preview ? 'Preview only' : undefined} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50" style={grad}>
            <Send className="w-4 h-4" /> {preview ? 'Send (preview)' : 'Send to the lab'}
          </button>
        )}
      </div>
      <p className="px-6 py-3 text-center text-[10px] text-[#A0A0B0] border-t border-[#F0EFF6]">Powered by Smile Genius · Your details go only to {config.labName}.</p>
    </div>
  );
}
