import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, ImagePlus, Paperclip, Truck, X } from '../icons';
import { ME, useGo } from '../store';
import {
  CLINICIANS, LABS, LabCase, allItems, MATERIALS, PATIENTS, PRACTICES, PracticeId, SERVICES, SHADES, clinicianName, fmtDate, labName, nowIso,
  patientById, practiceName,
} from '../data';
import { Btn, Card, Chips, GoMark, Input, KV, Label, PickerField, Screen, Segmented, Section, TextArea, TopBar, cx } from '../ui';

// ─── Shared form model ──────────────────────────────────────────────────────

export interface CaseForm {
  practice: PracticeId | null;
  clinician: string | null;
  patientId: string | null;
  lab: string | null;
  service: string | null;
  funding: 'NHS' | 'Private';
  teeth: string[];
  material: string | null;
  shade: string | null;
  stumpShade: string;
  returnBy: string;
  instructions: string;
  attachments: string[];
  apptDate: string;
  apptTime: string;
  apptKind: 'Fit' | 'Try-in' | 'Issue';
}

const plusDays = (n: number) => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10); };
export const emptyForm = (): CaseForm => ({
  practice: 'cds', clinician: 'reed', patientId: null, lab: null, service: null, funding: 'Private', teeth: [], material: null,
  shade: null, stumpShade: '', returnBy: plusDays(7), instructions: '', attachments: [], apptDate: plusDays(8), apptTime: '10:00', apptKind: 'Fit',
});

export function buildCase(f: CaseForm, source: LabCase['source']): LabCase {
  const ret = new Date(f.returnBy); ret.setHours(17, 0, 0, 0);
  return {
    id: `SG-${28500 + Math.floor(Math.random() * 400)}`,
    patientId: f.patientId!, practice: f.practice!, lab: f.lab!, clinician: f.clinician!, createdBy: ME.name,
    service: f.service!, teeth: f.teeth, material: f.material!, shade: f.shade ?? undefined, stumpShade: f.stumpShade || undefined,
    funding: f.funding, instructions: f.instructions || 'No extra instructions.', returnBy: ret.toISOString(), stage: 'ready',
    attachments: f.attachments.length ? f.attachments : ['Prescription.pdf'], source,
    events: [{ stage: 'authorised', at: nowIso(), by: clinicianName(f.clinician!) }], messages: [],
    appointment: f.apptDate ? { at: new Date(`${f.apptDate}T${f.apptTime || '09:00'}`).toISOString(), kind: f.apptKind, room: 'Surgery 1' } : undefined,
  };
}

// ─── Tooth picker (UK Palmer-style notation: UR6, LL5…) ─────────────────────

const ARCHES = ['Upper arch', 'Lower arch', 'Both arches'] as const;
const QUADS = [
  { id: 'UR', label: 'Upper right', order: [8, 7, 6, 5, 4, 3, 2, 1] },
  { id: 'UL', label: 'Upper left', order: [1, 2, 3, 4, 5, 6, 7, 8] },
  { id: 'LR', label: 'Lower right', order: [8, 7, 6, 5, 4, 3, 2, 1] },
  { id: 'LL', label: 'Lower left', order: [1, 2, 3, 4, 5, 6, 7, 8] },
] as const;

export function ToothPicker({ value, onChange, invalid }: { value: string[]; onChange: (v: string[]) => void; invalid?: boolean }) {
  const [quad, setQuad] = useState<(typeof QUADS)[number]['id']>('UR');
  const q = QUADS.find(x => x.id === quad)!;
  const isArch = value.some(v => (ARCHES as readonly string[]).includes(v));
  const toggle = (t: string) => {
    const base = value.filter(v => !(ARCHES as readonly string[]).includes(v));
    onChange(base.includes(t) ? base.filter(x => x !== t) : [...base, t]);
  };
  return (
    <div className={cx('rounded-[22px] border p-3.5 bg-go-surface', invalid ? 'border-go-warn ring-4 ring-go-warn/15' : 'border-go-line')}>
      <Chips options={ARCHES} value={isArch ? value[0] : null} onChange={(a: string) => onChange(value[0] === a ? [] : [a])} />
      <div className="flex items-center gap-2 my-3"><span className="h-px flex-1 bg-go-line" /><span className="text-[11px] text-go-faint">or individual teeth</span><span className="h-px flex-1 bg-go-line" /></div>
      <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-go-raised">
        {QUADS.map(x => {
          const n = value.filter(v => v.startsWith(x.id)).length;
          return (
            <button key={x.id} onClick={() => setQuad(x.id)} className={cx('h-9 rounded-xl text-[12.5px] font-semibold relative transition', quad === x.id ? 'bg-go-surface text-go-ink go-card-shadow' : 'text-go-muted')}>
              {x.id}{n > 0 && <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-go-brand" />}
            </button>
          );
        })}
      </div>
      <p className="text-[11.5px] text-go-muted text-center mt-2.5">{q.label} · {q.order[0] === 8 ? 'back → front' : 'front → back'}</p>
      <div className="grid grid-cols-8 gap-1.5 mt-2">
        {q.order.map(n => {
          const t = `${q.id}${n}`;
          const on = value.includes(t);
          return (
            <button key={t} onClick={() => toggle(t)} aria-pressed={on} aria-label={t}
              className={cx('aspect-[3/4] rounded-xl text-[14px] font-bold transition flex items-center justify-center',
                on ? 'go-grad text-white go-glow' : 'bg-go-raised text-go-ink2 border border-go-line')}>
              {n}
            </button>
          );
        })}
      </div>
      {!!value.length && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-go-line">
          <span className="text-[12px] text-go-muted mr-1 self-center">Selected</span>
          {value.map(t => (
            <button key={t} onClick={() => onChange(value.filter(x => x !== t))} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full bg-go-brand-soft text-go-brand-ink text-[12px] font-semibold">
              {t}<X className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Success ────────────────────────────────────────────────────────────────

export function CaseCreated({ c }: { c: LabCase }) {
  const navigate = useNavigate();
  return (
    <Screen>
      <div className="relative flex flex-col items-center text-center px-6 pt-16">
        <div className="absolute top-0 w-80 h-80 rounded-full bg-go-brand/20 blur-3xl" />
        <div className="relative go-rise"><GoMark size={84} /></div>
        <span className="relative mt-6 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-go-ok-soft text-go-ok text-[12px] font-semibold"><CheckCircle2 className="w-4 h-4" />Prescription authorised</span>
        <h1 className="relative text-[26px] font-bold text-go-ink tracking-tight mt-3">Lab work created</h1>
        <p className="relative text-[14px] text-go-muted mt-1.5 leading-relaxed">
          <span className="font-mono font-semibold text-go-ink">{c.id}</span> is ready to dispatch to {labName(c.lab)}.
        </p>
      </div>
      <div className="px-4 mt-8">
        <Card className="px-4 py-1">
          <KV rows={[
            ['Patient', patientById(c.patientId).name],
            ...allItems(c).map((it, i, all) => [all.length > 1 ? `Item ${i + 1}` : 'Service', `${it.service} · ${it.teeth.join(', ')} · ${it.material}`] as [string, string]),
            ['Return by', fmtDate(c.returnBy)],
          ]} />
        </Card>
      </div>
      <div className="px-4 mt-6 space-y-2.5">
        <Btn block icon={<Truck className="w-5 h-5" />} onClick={() => navigate(`/go/work/${c.id}/dispatch`, { replace: true })}>Print label & dispatch</Btn>
        <Btn block variant="secondary" onClick={() => navigate(`/go/work/${c.id}`, { replace: true })}>View lab work</Btn>
        <Btn block variant="ghost" size="md" onClick={() => navigate('/go/home', { replace: true })}>Back to home</Btn>
      </div>
      <p className="text-center text-[12px] text-go-faint mt-4">Demo only. Nothing is sent to a laboratory.</p>
    </Screen>
  );
}

// ─── Manual create ──────────────────────────────────────────────────────────

const STEPS = ['Lab and prescription', 'Return and attachments', 'Review and submit'];

export default function ManualCaseScreen() {
  const { addCase } = useGo();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<CaseForm>(emptyForm);
  const [tried, setTried] = useState(false);
  const [created, setCreated] = useState<LabCase | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof CaseForm>(k: K, v: CaseForm[K]) => setF(s => ({ ...s, [k]: v }));

  const step1Ok = !!(f.practice && f.clinician && f.patientId && f.lab && f.service && f.teeth.length && f.material);
  const step2Ok = !!f.returnBy;
  const ok = step === 0 ? step1Ok : step === 1 ? step2Ok : true;
  const bad = (v: unknown) => tried && !v;

  const next = () => {
    if (!ok) { setTried(true); return; }
    setTried(false);
    if (step < 2) { setStep(step + 1); return; }
    const c = buildCase(f, 'manual');
    addCase(c);
    setCreated(c);
  };

  if (created) return <CaseCreated c={created} />;

  return (
    <Screen
      header={
        <div>
          <TopBar back fallback="/go/home" title="Create a case" sub={`Step ${step + 1} of 3 · ${STEPS[step]}`} />
          <div className="flex gap-1.5 px-4 pb-3 bg-go-bg/85 backdrop-blur-xl">
            {STEPS.map((s, i) => <span key={s} className={cx('h-1 flex-1 rounded-full transition', i <= step ? 'go-grad' : 'bg-go-line')} />)}
          </div>
        </div>
      }
      footer={
        <div className="flex gap-2.5">
          {step > 0 && <Btn variant="secondary" onClick={() => setStep(step - 1)}>Back</Btn>}
          <Btn block onClick={next} icon={step === 2 ? <Check className="w-5 h-5" /> : undefined}>
            {step === 2 ? 'Authorise & create' : 'Continue'}
          </Btn>
        </div>
      }>
      {step === 0 && (
        <div className="px-4 pt-2 space-y-5">
          {tried && !step1Ok && <p className="text-[13px] text-go-warn font-medium px-1">Complete the highlighted details to continue.</p>}
          <PickerField label="Practice" value={f.practice} onChange={v => set('practice', v as PracticeId)} invalid={bad(f.practice)}
            options={PRACTICES.map(p => ({ value: p.id, label: p.name }))} />
          <PickerField label="Prescribing clinician" value={f.clinician} onChange={v => set('clinician', v)} placeholder="Select dentist" invalid={bad(f.clinician)}
            options={CLINICIANS.map(c => ({ value: c.id, label: c.name, sub: `GDC ${c.gdc}` }))} />
          <PickerField label="Patient" value={f.patientId} onChange={v => set('patientId', v)} placeholder="Select patient" searchable invalid={bad(f.patientId)}
            options={PATIENTS.map(p => ({ value: p.id, label: p.name, sub: `DOB ${p.dob} · ${p.id}` }))} />
          <PickerField label="Dental laboratory" value={f.lab} onChange={v => set('lab', v)} placeholder="Select laboratory" invalid={bad(f.lab)}
            options={LABS.map(l => ({ value: l.id, label: l.name, sub: l.town }))} />
          <PickerField label="Service" value={f.service} onChange={v => set('service', v)} placeholder="Select service" invalid={bad(f.service)}
            options={SERVICES.map(s => ({ value: s, label: s }))} />
          <div>
            <Label>NHS / Private</Label>
            <Segmented value={f.funding} onChange={v => set('funding', v)} options={[{ value: 'NHS', label: 'NHS' }, { value: 'Private', label: 'Private' }]} />
          </div>
          <div><Label>Teeth or arch</Label><ToothPicker value={f.teeth} onChange={v => set('teeth', v)} invalid={bad(f.teeth.length)} /></div>
          <PickerField label="Material" value={f.material} onChange={v => set('material', v)} placeholder="Select material" invalid={bad(f.material)}
            options={MATERIALS.map(m => ({ value: m, label: m }))} />
          <div><Label optional>Shade (VITA classical)</Label><Chips options={SHADES} value={f.shade} onChange={v => set('shade', v)} wrap={false} /></div>
          <div><Label optional>Stump shade</Label><Input value={f.stumpShade} onChange={e => set('stumpShade', e.target.value)} placeholder="e.g. ND3" /></div>
        </div>
      )}

      {step === 1 && (
        <div className="px-4 pt-2 space-y-5">
          <div>
            <Label optional>Patient appointment</Label>
            <div className="flex gap-2">
              <Input type="date" value={f.apptDate} onChange={e => set('apptDate', e.target.value)} className="flex-1" />
              <Input type="time" value={f.apptTime} onChange={e => set('apptTime', e.target.value)} className="!w-[118px]" />
            </div>
            <div className="mt-2"><Chips options={['Fit', 'Try-in', 'Issue'] as const} value={f.apptKind} onChange={v => set('apptKind', v)} /></div>
            {f.apptDate && f.returnBy >= f.apptDate && <p className="text-[12px] text-go-bad mt-2 px-1">The lab is due back on or after the appointment. Ask for an earlier return date.</p>}
          </div>
          <div><Label>Requested return date</Label><Input type="date" value={f.returnBy} min={plusDays(1)} onChange={e => set('returnBy', e.target.value)} /></div>
          <div className="flex gap-2 -mt-2">
            {[5, 7, 10, 14].map(n => (
              <button key={n} onClick={() => set('returnBy', plusDays(n))}
                className={cx('flex-1 h-9 rounded-xl text-[12.5px] font-semibold border transition', f.returnBy === plusDays(n) ? 'border-go-brand bg-go-brand-soft text-go-brand-ink' : 'border-go-line text-go-ink2')}>
                +{n} days
              </button>
            ))}
          </div>
          <div><Label optional>Case instructions</Label><TextArea rows={5} value={f.instructions} onChange={e => set('instructions', e.target.value)} placeholder="Margins, contacts, occlusion, characterisation…" /></div>
          <div>
            <Label optional>Attachments</Label>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
              onChange={e => { set('attachments', [...f.attachments, ...Array.from(e.target.files ?? []).map(x => x.name)]); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()}
              className="w-full h-24 rounded-[22px] border-2 border-dashed border-go-line hover:border-go-brand/60 text-go-muted flex flex-col items-center justify-center gap-1.5 transition">
              <ImagePlus className="w-6 h-6 text-go-brand" />
              <span className="text-[13px] font-semibold text-go-ink">Add photo or document</span>
              <span className="text-[11.5px]">Scans, shade photos, signed Rx</span>
            </button>
            {!!f.attachments.length && (
              <div className="mt-3 space-y-2">
                {f.attachments.map((a, i) => (
                  <div key={a + i} className="flex items-center gap-2.5 h-11 px-3.5 rounded-2xl bg-go-surface border border-go-line">
                    <Paperclip className="w-4 h-4 text-go-muted" /><span className="flex-1 truncate text-[13px] text-go-ink">{a}</span>
                    <button onClick={() => set('attachments', f.attachments.filter((_, j) => j !== i))} aria-label={`Remove ${a}`}><X className="w-4 h-4 text-go-muted" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <>
          <Section title="Lab and prescription" className="!mt-2" action={<button onClick={() => setStep(0)} className="text-[12.5px] font-semibold text-go-brand">Edit</button>}>
            <Card className="px-4 py-1">
              <KV rows={[
                ['Practice', practiceName(f.practice!)],
                ['Prescribing clinician', clinicianName(f.clinician!)],
                ['Patient', patientById(f.patientId!).name],
                ['Laboratory', labName(f.lab!)],
                ['Service', `${f.service} · ${f.funding}`],
                ['Teeth / arch', f.teeth.join(', ')],
                ['Material', f.material!],
                ['Shade', [f.shade, f.stumpShade && `stump ${f.stumpShade}`].filter(Boolean).join(' · ') || '—'],
              ]} />
            </Card>
          </Section>
          <Section title="Return and attachments" action={<button onClick={() => setStep(1)} className="text-[12.5px] font-semibold text-go-brand">Edit</button>}>
            <Card className="px-4 py-1">
              <KV rows={[
                ['Appointment', f.apptDate ? `${f.apptKind} · ${fmtDate(new Date(f.apptDate).toISOString())} ${f.apptTime}` : 'Not booked'],
                ['Return by', fmtDate(new Date(f.returnBy).toISOString())],
                ['Attachments', f.attachments.length ? `${f.attachments.length} file${f.attachments.length > 1 ? 's' : ''}` : 'None'],
              ]} />
              {f.instructions && <p className="text-[13.5px] text-go-ink py-3 border-t border-go-line leading-relaxed">{f.instructions}</p>}
            </Card>
          </Section>
          <p className="px-5 mt-4 text-[12px] text-go-muted leading-relaxed">
            By creating this case you authorise the prescription as {clinicianName(f.clinician!)} (GDC {CLINICIANS.find(c => c.id === f.clinician)!.gdc}).
          </p>
        </>
      )}
    </Screen>
  );
}
