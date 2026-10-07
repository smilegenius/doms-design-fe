// ─── Lab work — schedule, board and case ─────────────────────────────────────
// Clinicians plan lab work around patients, not around lab stages, so the
// default view is a schedule grouped by appointment day with one dense row
// per case. "Board" is the lab-stage view for when you want the pipeline.
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CalendarClock, CheckCircle2, ClipboardCheck, Clock, FileText, FlaskConical, Image as ImageIcon, Inbox, MessageSquare, PackageCheck,
  Paperclip, Pause, Search, Send, Truck, X, Hammer, Building, Filter,
} from '../icons';
import { ME, useGo, useScoped } from '../store';
import { ReceiveSheet } from './Logistics';
import {
  ATTENTION, Attention, CLINICIANS, labStatusOf, LABS, LabCase, READINESS_ORDER, matchesAttention, allItems, caseTitle, ReadinessLevel, STAGES, Stage, clinicianName, dayOffset, fmtDate, fmtDateTime, labName, nextAction, nowIso,
  patientById, practiceName, readiness, relDay, shortName, stageIndex,
} from '../data';
import { Btn, Card, Chips, EmptyState, IconTile, Pill, PickerField, READINESS_DOT, READINESS_TONE, Screen, SearchBox, Segmented, Sheet, TextArea, TopBar, Tone, cx } from '../ui';

// ─── Rows ───────────────────────────────────────────────────────────────────

function ScheduleRow({ c }: { c: LabCase }) {
  const navigate = useNavigate();
  const r = readiness(c);
  const p = patientById(c.patientId);
  const a = c.appointment;
  const d = a ? new Date(a.at) : null;
  return (
    <button onClick={() => navigate(c.stage === 'draft' ? `/go/new/manual?draft=${c.id}` : `/go/work/${c.id}`)} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-go-raised transition">
      <span className="w-11 flex-shrink-0 text-center">
        {d ? (
          <>
            <span className="block text-[10px] font-semibold uppercase text-go-muted leading-none">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
            <span className="block text-[17px] font-bold text-go-ink tabular-nums leading-tight">{d.getDate()}</span>
          </>
        ) : <span className="block text-[11px] text-go-faint">—</span>}
      </span>
      <span className={cx('w-1 h-9 rounded-full flex-shrink-0', READINESS_DOT[r.level])} />
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-go-ink truncate">
          {shortName(p.name)} <span className="font-normal text-go-muted">· {a ? a.kind : 'No appointment'}</span>
        </span>
        <span className="block text-[12px] text-go-muted truncate">{caseTitle(c)} · {labName(c.lab).replace(/ (Dental )?(Lab|Laboratory|Works)$/, '')}</span>
      </span>
      <span className="flex flex-col items-end flex-shrink-0">
        <Pill tone={READINESS_TONE[r.level]} className="!h-[22px] !px-2">{r.label}</Pill>
        <span className="text-[10.5px] text-go-faint mt-0.5 font-mono">{c.id}</span>
      </span>
    </button>
  );
}


// ─── List ───────────────────────────────────────────────────────────────────

type RFilter = 'all' | ReadinessLevel;
const R_FILTERS: { id: RFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'at-risk', label: 'At risk' },
  { id: 'attention', label: 'Action needed' },
  { id: 'arriving', label: 'Arriving' },
  { id: 'on-track', label: 'On track' },
  { id: 'in-practice', label: 'In practice' },
];

const bucket = (c: LabCase) => {
  if (c.stage === 'draft') return 'Drafts';
  if (!c.appointment) return c.stage === 'received' ? 'Done' : 'No appointment yet';
  const o = dayOffset(c.appointment.at);
  if (o < 0) return 'Done';
  if (o === 0) return 'Today';
  if (o === 1) return 'Tomorrow';
  if (o <= 7) return 'Next 7 days';
  return 'Later';
};
const BUCKETS = ['Drafts', 'Today', 'Tomorrow', 'Next 7 days', 'Later', 'No appointment yet', 'Done'];

export function LabWorkScreen() {
  const { cases } = useScoped();
  const [params, setParams] = useSearchParams();
  const day = params.get('day') ? Number(params.get('day')) : null;
  // Status filter from the Home tiles: ready | arriving | questions | overdue
  const status = ATTENTION.find(a => a.id === params.get('f'))?.id ?? null;
  // Readiness filter lives in the URL (?r=at-risk) so scenarios can deep-link to it
  const rf = (params.get('r') as RFilter) || 'all';
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Dentist / lab filters (URL so they survive navigation)
  const dentist = params.get('dentist');
  const labF = params.get('lab');
  const nFilters = (dentist ? 1 : 0) + (labF ? 1 : 0);

  const base = useMemo(() => cases.filter(c => {
    const hay = `${c.id} ${patientById(c.patientId).name} ${labName(c.lab)} ${allItems(c).map(it => `${it.service} ${it.teeth.join(' ')}`).join(' ')}`.toLowerCase();
    return hay.includes(q.toLowerCase()) && (day === null || (c.appointment && dayOffset(c.appointment.at) === day))
      && (!status || matchesAttention(c, status))
      && (!dentist || c.clinician === dentist) && (!labF || c.lab === labF);
  }), [cases, q, day, status, dentist, labF]);
  const baseNoStatus = useMemo(() => cases.filter(c => {
    const hay = `${c.id} ${patientById(c.patientId).name} ${labName(c.lab)} ${allItems(c).map(it => `${it.service} ${it.teeth.join(' ')}`).join(' ')}`.toLowerCase();
    return hay.includes(q.toLowerCase()) && (day === null || (c.appointment && dayOffset(c.appointment.at) === day))
      && (!dentist || c.clinician === dentist) && (!labF || c.lab === labF);
  }), [cases, q, day, dentist, labF]);
  const shown = base.filter(c => rf === 'all' || readiness(c).level === rf);
  const setParam = (k: string, v: string | null) => {
    const n = new URLSearchParams(params);
    if (v === null) n.delete(k); else n.set(k, v);
    setParams(n, { replace: true });
  };

  return (
    <Screen tabs header={
      <div className="bg-go-bg/85 backdrop-blur-xl px-4 pt-3 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-[24px] font-bold text-go-ink tracking-tight">Lab work <span className="text-go-faint font-semibold text-[18px]">{cases.length}</span></h1>
          <div className="flex items-center gap-2">
          <button onClick={() => setFiltersOpen(true)} aria-label="Filter by dentist or lab"
            className={cx('relative w-10 h-10 rounded-full flex items-center justify-center border transition', nFilters ? 'bg-go-brand-soft text-go-brand border-go-brand/30' : 'bg-go-surface text-go-ink border-go-line')}>
            <Filter className="w-[18px] h-[18px]" />
            {!!nFilters && <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full go-grad text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-go-bg">{nFilters}</span>}
          </button>
          <button onClick={() => { setSearching(s => !s); setQ(''); }} aria-label="Search"
            className={cx('w-10 h-10 rounded-full flex items-center justify-center border transition', searching ? 'bg-go-ink text-go-bg border-go-ink' : 'bg-go-surface text-go-ink border-go-line')}>
            {searching ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>
          </div>
        </div>
        {searching && <SearchBox value={q} onChange={setQ} placeholder="Patient, case ID, lab or tooth" />}
      </div>
    }>
        <>
          <div className="flex gap-2 overflow-x-auto go-scroll px-4 pb-1">
            {dentist && (
              <button onClick={() => setParam('dentist', null)} className="h-8 pl-3 pr-2 rounded-full text-[12.5px] font-semibold bg-go-brand text-white inline-flex items-center gap-1 flex-shrink-0">
                {clinicianName(dentist)}<X className="w-3.5 h-3.5" />
              </button>
            )}
            {labF && (
              <button onClick={() => setParam('lab', null)} className="h-8 pl-3 pr-2 rounded-full text-[12.5px] font-semibold bg-go-brand text-white inline-flex items-center gap-1 flex-shrink-0">
                {labName(labF)}<X className="w-3.5 h-3.5" />
              </button>
            )}
            {day !== null && (
              <button onClick={() => setParam('day', null)} className="h-8 pl-3 pr-2 rounded-full text-[12.5px] font-semibold bg-go-brand text-white inline-flex items-center gap-1 flex-shrink-0">
                {fmtDate(new Date(Date.now() + day * 864e5).toISOString())}<X className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Status chips — same four statuses as the Home tiles */}
            {[{ id: null as Attention | null, label: 'All' }, ...ATTENTION.filter(x => x.home || x.id === status).map(x => ({ id: x.id as Attention | null, label: x.short }))].map(f => {
              const n = f.id ? baseNoStatus.filter(c => matchesAttention(c, f.id!)).length : baseNoStatus.length;
              const on = status === f.id;
              return (
                <button key={f.id ?? 'all'} onClick={() => setParam('f', f.id)}
                  className={cx('h-8 pl-3 pr-2 rounded-full text-[12.5px] font-medium border whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5 transition',
                    on ? 'bg-go-ink text-go-bg border-go-ink' : 'bg-go-surface text-go-ink2 border-go-line')}>
                  {f.label}<span className={cx('text-[11px] tabular-nums', on ? 'opacity-70' : 'text-go-faint')}>{n}</span>
                </button>
              );
            })}
          </div>
          <div className="px-4 mt-3 space-y-4">
            {BUCKETS.map(b => {
              const items = shown.filter(c => bucket(c) === b)
                .sort((x, y) => (x.appointment?.at ?? x.returnBy).localeCompare(y.appointment?.at ?? y.returnBy));
              if (!items.length) return null;
              return (
                <section key={b}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted px-1 mb-1.5">{b} · {items.length}</p>
                  <Card className="divide-y divide-go-line overflow-hidden">{items.map(c => <ScheduleRow key={c.id} c={c} />)}</Card>
                </section>
              );
            })}
            {!shown.length && <EmptyState icon={<Search className="w-7 h-7" />} title="No matching lab work" body="Try a patient surname, a case ID like SG-28491, or a tooth like UR6." />}
          </div>
        </>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} label="Lab work filters" title={<span className="inline-flex items-center gap-2"><Filter className="w-5 h-5 text-go-brand" />Lab work</span>}
        footer={
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => { setParam('dentist', null); setParam('lab', null); }} disabled={!nFilters}>Clear</Btn>
            <Btn block onClick={() => setFiltersOpen(false)}>Show {base.length} result{base.length === 1 ? '' : 's'}</Btn>
          </div>
        }>
        <div className="space-y-4 pb-2">
          <PickerField label="Dentist" searchable value={dentist ?? 'all'} onChange={v => setParam('dentist', v === 'all' ? null : v)}
            options={[{ value: 'all', label: 'All dentists', sub: `${cases.length} case${cases.length === 1 ? '' : 's'}` },
              ...CLINICIANS.map(c => ({ value: c.id, label: c.name, sub: `${cases.filter(x => x.clinician === c.id).length} cases` }))]} />
          <PickerField label="Lab" searchable value={labF ?? 'all'} onChange={v => setParam('lab', v === 'all' ? null : v)}
            options={[{ value: 'all', label: 'All labs', sub: `${cases.length} case${cases.length === 1 ? '' : 's'}` },
              ...LABS.map(l => ({ value: l.id, label: l.name, sub: `${l.town} · ${cases.filter(x => x.lab === l.id).length} cases` }))]} />
        </div>
      </Sheet>
    </Screen>
  );
}

// ─── Detail ─────────────────────────────────────────────────────────────────

const STEP_ICON: Record<Stage, React.ReactNode> = {
  draft: <ClipboardCheck className="w-4 h-4" />,
  ready: <ClipboardCheck className="w-4 h-4" />,
  dispatched: <Truck className="w-4 h-4" />,
  'at-lab': <Building className="w-4 h-4" />,
  production: <Hammer className="w-4 h-4" />,
  shipped: <PackageCheck className="w-4 h-4" />,
  received: <CheckCircle2 className="w-4 h-4" />,
};

function Stepper({ c }: { c: LabCase }) {
  const idx = stageIndex(c.stage);
  return (
    <div className="relative flex justify-between">
      <span className="absolute left-4 right-4 top-4 h-0.5 bg-go-line" />
      <span className="absolute left-4 top-4 h-0.5 go-grad" style={{ width: `calc((100% - 2rem) * ${idx / (STAGES.length - 1)})` }} />
      {STAGES.map((s, i) => (
        <div key={s.id} className="relative flex flex-col items-center w-12">
          <span className={cx('w-8 h-8 rounded-full flex items-center justify-center transition',
            i < idx ? 'go-grad text-white' : i === idx ? 'go-grad text-white ring-4 ring-go-brand/20 go-glow' : 'bg-go-surface border border-go-line text-go-faint')}>
            {STEP_ICON[s.id]}
          </span>
          <span className={cx('text-[9.5px] mt-1 text-center leading-tight', i <= idx ? 'text-go-ink font-semibold' : 'text-go-faint')}>{s.short}</span>
        </div>
      ))}
    </div>
  );
}

const QUICK_REPLIES = ['New bite registration posted today', 'Proceed with the current bite', 'Call me to discuss'];

function Messages({ c }: { c: LabCase }) {
  const { updateCase, toast } = useGo();
  const [text, setText] = useState('');
  const send = () => {
    updateCase(c.id, x => ({
      questionOpen: false,
      messages: [...x.messages, { from: 'practice', author: ME.name, text, at: nowIso() }],
      events: [...x.events, { stage: 'note', at: nowIso(), by: ME.name, text: 'Replied to the lab' }],
    }));
    toast(`Comment sent to ${labName(c.lab)}`);
    setText('');
  };
  return (
    <div>
      <div className="space-y-3">
        {c.messages.map(m => (
          <div key={m.at} className={cx('max-w-[86%]', m.from === 'practice' && 'ml-auto')}>
            <div className={cx('p-3 rounded-2xl text-[13.5px] leading-relaxed',
              m.from === 'lab' ? 'bg-go-surface border border-go-line text-go-ink rounded-tl-md' : 'go-grad text-white rounded-tr-md')}>{m.text}</div>
            <p className={cx('text-[10.5px] text-go-muted mt-1', m.from === 'practice' && 'text-right')}>{m.author} · {fmtDateTime(m.at)}</p>
          </div>
        ))}
        {!c.messages.length && <p className="text-[13px] text-go-muted text-center py-4">No comments with {labName(c.lab)} yet.</p>}
      </div>
      <div className="mt-4">
        {c.questionOpen && <Chips options={QUICK_REPLIES} value={null} onChange={(v: string) => setText(v)} />}
        <div className="flex items-end gap-2 mt-3">
          <TextArea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Add a comment…" className="!py-2.5" />
          <button onClick={send} disabled={!text.trim()} aria-label="Send"
            className="w-12 h-12 rounded-2xl go-grad text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChaseSheet({ c, open, onClose }: { c: LabCase; open: boolean; onClose: () => void }) {
  const { updateCase, toast } = useGo();
  const p = patientById(c.patientId);
  const appt = c.appointment ? ` The patient is booked for a ${c.appointment.kind.toLowerCase()} on ${fmtDate(c.appointment.at)}.` : '';
  const [text, setText] = useState(
    `Hi ${labName(c.lab)}, ${c.id} (${shortName(p.name)}, ${c.service.toLowerCase()} ${c.teeth.join(', ')}) was due for delivery on ${fmtDate(c.returnBy)}.${appt} Please could you let us know when it will be sent?`,
  );
  const send = () => {
    updateCase(c.id, x => ({
      chasedAt: nowIso(),
      messages: [...x.messages, { from: 'practice', author: ME.name, text, at: nowIso() }],
      events: [...x.events, { stage: 'note', at: nowIso(), by: ME.name, text: 'Chased the lab' }],
    }));
    toast(`Chaser sent to ${labName(c.lab)}`);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Chase the lab" sub="Sent via Smile Genius. The lab will reply in the case comments."
      footer={<Btn block disabled={!text.trim()} onClick={send} icon={<Send className="w-[18px] h-[18px]" />}>Send chaser</Btn>}>
      <TextArea rows={6} value={text} onChange={e => setText(e.target.value)} />
    </Sheet>
  );
}

type Tab = 'details' | 'activity' | 'messages' | 'files';

export function CaseDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { cases, updateCase, toast } = useGo();
  const c = cases.find(x => x.id === id);
  const tab = (params.get('tab') as Tab) || 'details';
  const setTab = (t: Tab) => setParams(t === 'details' ? {} : { tab: t }, { replace: true });
  const [chase, setChase] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(params.get('receive') === '1');
  if (!c) {
    return <Screen header={<TopBar back fallback="/go/work" title="Lab work" />}><EmptyState icon={<Search className="w-7 h-7" />} title="Case not found" body="We couldn’t find this case in the demo data." /></Screen>;
  }
  if (c.stage === 'draft') return <Navigate to={`/go/new/manual?draft=${c.id}`} replace />;
  const p = patientById(c.patientId);
  const r = readiness(c);
  const a = nextAction(c);
  const shipped = c.events.find(e => e.stage === 'shipped');

  // One-line next step with its action — reads like a to-do, not a card.
  const step: { icon: React.ReactNode; tone: Tone; title: string; body: string; cta?: { label: string; run: () => void } } = {
    finish: { icon: <ClipboardCheck className="w-5 h-5" />, tone: 'neutral' as Tone, title: 'Draft not submitted', body: 'Finish the details and create the case.', cta: { label: 'Finish case', run: () => navigate(`/go/new/manual?draft=${c.id}`) } },
    // Only the lab can put a case on or off hold. The practice answers in Comments when the lab is waiting on it.
    'on-hold': c.onHold?.side === 'Practice'
      ? { icon: <Pause className="w-5 h-5" />, tone: 'warn' as Tone, title: 'On hold · lab is waiting on you', body: c.onHold.reason, cta: { label: 'Reply', run: () => setTab('messages') } }
      : { icon: <Pause className="w-5 h-5" />, tone: 'warn' as Tone, title: 'On hold by the lab', body: `${c.onHold?.reason ?? ''} · Only the lab can change this.` },
    dispatch: { icon: <Truck className="w-5 h-5" />, tone: 'warn' as Tone, title: 'Send it to the lab', body: 'Include impressions, bite and the signed lab form.', cta: { label: 'Dispatch', run: () => navigate(`/go/work/${c.id}/dispatch`) } },
    reply: { icon: <MessageSquare className="w-5 h-5" />, tone: 'pink' as Tone, title: `${labName(c.lab)} needs more information`, body: 'The case is paused until you reply.', cta: { label: 'Reply', run: () => setTab('messages') } },
    'check-in': { icon: <PackageCheck className="w-5 h-5" />, tone: 'brand' as Tone, title: 'Arriving from the lab', body: shipped ? `Shipped ${fmtDate(shipped.at)}${shipped.text ? ` · ${shipped.text}` : ''}` : 'On its way back.', cta: { label: 'Mark as received', run: () => setReceiveOpen(true) } },
    chase: { icon: <Clock className="w-5 h-5" />, tone: 'bad' as Tone, title: 'Chase the lab', body: c.appointment ? 'Or move the patient’s appointment.' : `Delivery date was ${fmtDate(c.returnBy)}.`, cta: { label: 'Chase', run: () => setChase(true) } },
    wait: { icon: <FlaskConical className="w-5 h-5" />, tone: 'violet' as Tone, title: c.chasedAt ? `Chased ${relDay(c.chasedAt).toLowerCase()}` : 'Nothing to do', body: c.chasedAt ? 'We’ll let you know when the lab replies.' : `Delivery date ${fmtDate(c.returnBy)}.` },
    done: { icon: <CheckCircle2 className="w-5 h-5" />, tone: 'ok' as Tone, title: c.problem ? 'Problem reported' : 'Ready for the patient', body: c.problem ?? (c.receipt && c.receipt.storedIn !== 'Not recorded' ? `Stored in ${c.receipt.storedIn}.` : 'Received at the practice.') },
  }[a];

  const facts: [string, React.ReactNode][] = [
    ['Lab', labName(c.lab)],
    ['Lab status', labStatusOf(c) ?? 'Not received yet'],
    ['Dentist', clinicianName(c.clinician)],
    ['Material', c.material],
    ['Shade', [c.shade, c.stumpShade && `stump ${c.stumpShade}`].filter(Boolean).join(' · ') || '—'],
    ['Delivery date', fmtDate(c.returnBy)],
    ['Order type', c.funding],
    ['Practice', practiceName(c.practice)],
    ['Created by', c.source === 'photo' ? `${c.createdBy} · from photo` : c.createdBy],
  ];

  return (
    <Screen header={<TopBar back fallback="/go/work" title={p.name} sub={`${c.id} · DOB ${p.dob}`} />}
      // Sticky next-step bar: Dispatch / Reply / Mark as received / Chase stay in thumb reach.
      // Hidden on the Comments tab while replying — the composer there is the action.
      footer={step.cta && !((a === 'reply' || a === 'on-hold') && tab === 'messages') ? (
        <div className="flex items-center gap-3">
          <IconTile icon={step.icon} tone={step.tone} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-go-ink truncate">{step.title}</p>
            <p className="text-[11.5px] text-go-muted truncate">{step.body}</p>
          </div>
          <Btn size="md" onClick={step.cta.run} className={cx('!h-11 !px-5', a === 'chase' && '!bg-none !bg-go-bad !shadow-none')}>{step.cta.label}</Btn>
        </div>
      ) : undefined}>
      {/* Summary */}
      <div className="px-4 pt-1">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[22px] font-bold text-go-ink tracking-tight leading-tight">{c.service} <span className="go-grad-text">{c.teeth.join(', ')}</span></p>
            <p className="text-[12.5px] text-go-muted mt-0.5 truncate">{c.material}{c.shade ? ` · ${c.shade}` : ''} · {labName(c.lab)}</p>
            {c.items?.map(it => (
              <p key={it.service} className="text-[14px] font-semibold text-go-ink mt-1.5">+ {it.service} <span className="go-grad-text">{it.teeth.join(', ')}</span> <span className="text-[12px] font-normal text-go-muted">· {it.material}{it.shade ? ` · ${it.shade}` : ''}</span></p>
            ))}
          </div>
        </div>

        {/* Appointment vs lab — the clinician's question */}
        <div className={cx('mt-3 rounded-[20px] p-3.5 flex items-center gap-3 border',
          r.level === 'at-risk' ? 'bg-go-bad-soft border-go-bad/25' : r.level === 'attention' ? 'bg-go-warn-soft border-go-warn/25' : 'bg-go-surface border-go-line')}>
          <IconTile icon={<CalendarClock className="w-5 h-5" />} tone={READINESS_TONE[r.level]} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-go-ink truncate">
              {c.appointment ? `${c.appointment.kind} · ${fmtDate(c.appointment.at)}` : 'No appointment booked'}
            </p>
            <p className={cx('text-[11.5px] truncate', r.level === 'at-risk' ? 'text-go-bad' : 'text-go-muted')}>
              {c.appointment ? `${c.appointment.room} · ` : ''}{r.detail}
            </p>
          </div>
          <Pill tone={READINESS_TONE[r.level]} dot>{r.label}</Pill>
        </div>

        <div className="mt-4 px-1"><Stepper c={c} /></div>

        {/* No action to take → a quiet info card in the page. Actions live in the sticky bar below. */}
        {!step.cta && (
          <Card className="mt-4 p-3 flex items-center gap-3">
            <IconTile icon={step.icon} tone={step.tone} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-semibold text-go-ink truncate">{step.title}</p>
              <p className="text-[11.5px] text-go-muted truncate">{step.body}</p>
            </div>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 mt-4">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'details', label: 'Details' },
          { value: 'activity', label: 'Activity' },
          { value: 'messages', label: 'Comments', count: c.messages.length || undefined },
          { value: 'files', label: 'Files', count: c.attachments.length },
        ]} />
      </div>

      <div className="px-4 mt-3">
        {tab === 'details' && (
          <>
            {!!c.items?.length && (
              <div className="rounded-2xl bg-go-surface border border-go-line divide-y divide-go-line mb-2">
                {allItems(c).map((it, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-6 h-6 rounded-lg go-grad text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-go-ink truncate">{it.service} · {it.teeth.join(', ')}</p>
                      <p className="text-[11.5px] text-go-muted truncate">{it.material}{it.shade ? ` · shade ${it.shade}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {facts.filter(([k]) => !(c.items?.length && (k === 'Material' || k === 'Shade'))).map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-go-surface border border-go-line px-3 py-2.5 min-w-0">
                  <p className="text-[10.5px] uppercase tracking-wider font-semibold text-go-faint">{k}</p>
                  <p className="text-[13px] font-medium text-go-ink mt-0.5 truncate">{v}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-go-surface border border-go-line px-3 py-2.5 mt-2">
              <p className="text-[10.5px] uppercase tracking-wider font-semibold text-go-faint">Instructions</p>
              <p className="text-[13px] text-go-ink mt-0.5 leading-relaxed">{c.instructions}</p>
            </div>
            {(c.dispatch || c.receipt) && (
              <div className="rounded-2xl bg-go-surface border border-go-line px-3 py-2.5 mt-2">
                <p className="text-[10.5px] uppercase tracking-wider font-semibold text-go-faint">Courier and storage</p>
                {c.dispatch && <p className="text-[13px] text-go-ink mt-0.5">Sent: {c.dispatch.courier}{c.dispatch.tracking ? ` · ${c.dispatch.tracking}` : ''} · {c.dispatch.bags} bag{c.dispatch.bags > 1 ? 's' : ''}</p>}
                {c.receipt && <p className="text-[13px] text-go-ink mt-0.5">Received: stored in {c.receipt.storedIn}{c.receipt.comment ? ` · ${c.receipt.comment}` : ''}</p>}
              </div>
            )}
          </>
        )}

        {tab === 'activity' && (
          <Card className="p-4">
            <ol className="relative">
              {[...c.events].reverse().map((e, i, arr) => (
                <li key={e.at + i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < arr.length - 1 && <span className="absolute left-[5px] top-4 bottom-0 w-0.5 bg-go-line" />}
                  <span className={cx('relative z-[1] w-3 h-3 rounded-full mt-1 flex-shrink-0', i === 0 ? 'go-grad ring-4 ring-go-brand/15' : 'bg-go-line')} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-go-ink">
                      {e.stage === 'authorised' ? 'Prescription authorised' : e.stage === 'note' ? e.text : STAGES[stageIndex(e.stage)].label}
                    </p>
                    <p className="text-[11.5px] text-go-muted">{fmtDateTime(e.at)} · {e.by}{e.text && e.stage !== 'note' ? ` · ${e.text}` : ''}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {tab === 'messages' && <Messages c={c} />}

        {tab === 'files' && (
          <div className="grid grid-cols-2 gap-2">
            {c.attachments.map(f => (
              <div key={f} className="rounded-2xl bg-go-surface border border-go-line p-3 aspect-[4/3] flex flex-col justify-between">
                <span className="w-9 h-9 rounded-xl bg-go-raised flex items-center justify-center text-go-muted">
                  {/photo/i.test(f) ? <ImageIcon className="w-[18px] h-[18px] text-go-brand" /> : /pdf/i.test(f) ? <FileText className="w-[18px] h-[18px] text-go-violet" /> : <Paperclip className="w-[18px] h-[18px]" />}
                </span>
                <p className="text-[12.5px] font-medium text-go-ink leading-snug line-clamp-2">{f}</p>
              </div>
            ))}
            {!c.attachments.length && <EmptyState icon={<Inbox className="w-7 h-7" />} title="No files" />}
          </div>
        )}
      </div>

      <ChaseSheet c={c} open={chase} onClose={() => setChase(false)} />
      <ReceiveSheet c={c} open={receiveOpen} onClose={() => setReceiveOpen(false)} />
    </Screen>
  );
}
