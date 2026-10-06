import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Info, PackageCheck, Printer, Truck } from '../icons';
import { ME, useGo } from '../store';
import {
  COURIERS, LabCase, caseTitle, PROBLEMS, RECEIVE_CHECKS, STORAGE, fmtDate, fmtDateTime, labName, LABS, nowIso, patientById, practiceName, shortName,
} from '../data';
import { Btn, Card, CheckRow, Chips, EmptyState, Input, Label, Screen, Section, Sheet, Stepper, TextArea, TopBar, cx } from '../ui';

function useCase() {
  const { id } = useParams();
  const { cases } = useGo();
  return cases.find(c => c.id === id);
}

function Missing() {
  return <Screen header={<TopBar back fallback="/go/work" />}><EmptyState icon={<Info className="w-7 h-7" />} title="Not found" body="This lab work doesn’t exist in the demo." /></Screen>;
}

/** Deterministic QR-ish pattern from the order ID — demo only. */
function FakeCode({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return Array.from({ length: 121 }, (_, i) => {
      const x = i % 11, y = Math.floor(i / 11);
      const finder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
      if (finder) return !(x === 1 && y === 1) && !(x === 9 && y === 1) && !(x === 1 && y === 9);
      h = (h * 1103515245 + 12345) >>> 0;
      return (h >> 16) % 2 === 0;
    });
  }, [seed]);
  return (
    <div className="grid grid-cols-11 gap-[1.5px] w-[74px] h-[74px] flex-shrink-0">
      {cells.map((on, i) => <span key={i} className={on ? 'bg-[#030213] rounded-[1px]' : ''} />)}
    </div>
  );
}

/** Physical label — always printed black on white, whatever the app theme. */
function LabelPreview({ c }: { c: LabCase }) {
  const lab = LABS.find(l => l.id === c.lab)!;
  return (
    <div className="rounded-2xl bg-white text-[#030213] p-4 shadow-[0_12px_32px_-16px_rgba(16,24,64,.35)] border border-[#E0E0E6] aspect-[100/62] flex flex-col">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#717182]">Smile Genius · Lab work</span>
        <span className="text-[10px] font-semibold text-[#717182]">{c.funding}</span>
      </div>
      <div className="flex-1 flex items-center gap-4 mt-2">
        <FakeCode seed={c.id} />
        <div className="min-w-0">
          <p className="text-[22px] font-bold font-mono leading-none tracking-tight">{c.id}</p>
          <p className="text-[13px] font-semibold mt-1.5">{shortName(patientById(c.patientId).name)} · {caseTitle(c)}</p>
          <p className="text-[12px] text-[#5A5568] mt-0.5">To: {lab.name}, {lab.town}</p>
          <p className="text-[12px] text-[#5A5568]">Return by {fmtDate(c.returnBy)}</p>
        </div>
      </div>
      <p className="text-[10px] text-[#A0A0B0] mt-1">From {practiceName(c.practice)}</p>
    </div>
  );
}

export function DispatchScreen() {
  const c = useCase();
  const { updateCase, toast } = useGo();
  const navigate = useNavigate();
  const [printed, setPrinted] = useState(false);
  const [courier, setCourier] = useState<string | null>(null);
  const [tracking, setTracking] = useState('');
  const [collected, setCollected] = useState(() => new Date().toTimeString().slice(0, 5));
  const [bags, setBags] = useState(1);
  const [notes, setNotes] = useState('');
  if (!c) return <Missing />;
  const lab = labName(c.lab);
  const needsTracking = courier && !["Lab's own courier", 'Hand delivered'].includes(courier);

  if (c.stage !== 'ready') {
    return (
      <Screen header={<TopBar back fallback={`/go/work/${c.id}`} title="Dispatch to lab" sub={c.id} />}>
        <EmptyState icon={<Truck className="w-7 h-7" />} title="Already dispatched" body={`${c.id} left the practice${c.dispatch ? ` with ${c.dispatch.courier}` : ''}.`}
          action={<Btn variant="secondary" onClick={() => navigate(`/go/work/${c.id}`, { replace: true })}>View lab work</Btn>} />
      </Screen>
    );
  }

  const submit = () => {
    updateCase(c.id, x => ({
      stage: 'dispatched',
      dispatch: { courier: courier!, tracking: tracking || undefined, bags, notes: notes || undefined },
      events: [...x.events, { stage: 'dispatched', at: nowIso(), by: ME.name, text: [courier, tracking].filter(Boolean).join(' · ') }],
    }));
    toast(`Dispatched to ${lab}`);
    navigate(`/go/work/${c.id}`, { replace: true });
  };

  return (
    <Screen header={<TopBar back fallback={`/go/work/${c.id}`} title="Dispatch to lab" sub={`${c.id} · ${lab}`} />}
      footer={
        <div className="flex gap-2">
          <Btn variant={printed ? 'secondary' : 'soft'} className="!px-4" aria-label={printed ? 'Print label again' : 'Print label'}
            icon={printed ? <CheckCircle2 className="w-5 h-5 text-go-ok" /> : <Printer className="w-5 h-5" />}
            onClick={() => { setPrinted(true); toast('Label sent to Reception printer', 'info'); }}>
            {printed ? 'Printed' : 'Print'}
          </Btn>
          <Btn className="flex-1 min-w-0" disabled={!courier} onClick={submit} icon={<Truck className="w-5 h-5" />}>Mark as dispatched</Btn>
        </div>
      }>
      <Section title="1 · Print label" className="!mt-2">
        <LabelPreview c={c} />
        <p className="text-[12px] text-go-muted mt-2 px-1">100 × 62 mm. Stick it on the lab bag before dispatch.</p>
      </Section>

      <Section title="2 · Pack">
        <Card className="p-4 flex gap-3">
          <PackageCheck className="w-5 h-5 text-go-brand flex-shrink-0 mt-0.5" />
          <p className="text-[13px] text-go-ink2 leading-relaxed">Include impressions or scans, bite registration and the signed lab prescription.</p>
        </Card>
      </Section>

      <Section title="3 · Courier">
        <div className="space-y-5">
          <div><Label>Courier</Label><Chips options={COURIERS} value={courier} onChange={setCourier} /></div>
          {needsTracking && (
            <div><Label optional>Tracking number</Label><Input value={tracking} onChange={e => setTracking(e.target.value.toUpperCase())} placeholder="e.g. AB123456789GB" className="font-mono" /></div>
          )}
          <div className="flex gap-3">
            <div className="flex-1"><Label>Collected at</Label><Input type="time" value={collected} onChange={e => setCollected(e.target.value)} /></div>
            <div><Label>Bags / boxes</Label><Stepper value={bags} onChange={setBags} /></div>
          </div>
          <div><Label optional>Contents / notes</Label><TextArea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Impressions, bite registration, models…" /></div>
        </div>
      </Section>
    </Screen>
  );
}

export function ReceiveScreen() {
  const c = useCase();
  const { updateCase, toast } = useGo();
  const navigate = useNavigate();
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [stored, setStored] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [problemOpen, setProblemOpen] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [problemNote, setProblemNote] = useState('');
  if (!c) return <Missing />;
  const lab = labName(c.lab);
  const shipped = c.events.find(e => e.stage === 'shipped');
  const ready = RECEIVE_CHECKS.every(k => !k.required || checks[k.id]) && !!stored;

  if (c.stage !== 'shipped') {
    return (
      <Screen header={<TopBar back fallback={`/go/work/${c.id}`} title="Check in lab work" sub={c.id} />}>
        <EmptyState icon={<PackageCheck className="w-7 h-7" />} title={c.stage === 'received' ? 'Already checked in' : 'Not shipped yet'}
          body={c.stage === 'received' ? `Stored in ${c.receipt?.storedIn ?? 'the practice'}.` : `${lab} hasn’t shipped this work yet.`}
          action={<Btn variant="secondary" onClick={() => navigate(`/go/work/${c.id}`, { replace: true })}>View lab work</Btn>} />
      </Screen>
    );
  }

  const receive = () => {
    updateCase(c.id, x => ({
      stage: 'received',
      receipt: { storedIn: stored!, comment: comment || undefined },
      events: [...x.events, { stage: 'received', at: nowIso(), by: ME.name, text: `Stored in ${stored}` }],
    }));
    toast(`${c.id} checked in · stored in ${stored}`);
    navigate(`/go/work/${c.id}`, { replace: true });
  };
  const report = () => {
    const text = `${problems.join(', ')}${problemNote ? ` — ${problemNote}` : ''}`;
    updateCase(c.id, x => ({
      stage: 'received',
      problem: text,
      receipt: { storedIn: stored ?? 'Lab work drawer', comment: text },
      messages: [...x.messages, { from: 'practice', author: ME.name, text: `Problem on arrival: ${text}`, at: nowIso() }],
      events: [...x.events, { stage: 'received', at: nowIso(), by: ME.name, text: 'Problem reported' }],
    }));
    toast(`Problem reported to ${lab}`, 'bad');
    setProblemOpen(false);
    navigate(`/go/work/${c.id}`, { replace: true });
  };

  return (
    <Screen header={<TopBar back fallback={`/go/work/${c.id}`} title="Check in lab work" sub={`${c.id} · ${lab}`} />}
      footer={
        <div className="space-y-2">
          <Btn block disabled={!ready} onClick={receive} icon={<PackageCheck className="w-5 h-5" />}>Mark as received</Btn>
          <Btn block variant="ghost" size="md" onClick={() => setProblemOpen(true)} icon={<AlertTriangle className="w-4 h-4" />}>Report a problem instead</Btn>
        </div>
      }>
      <div className="px-4 pt-1">
        <Card className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted">Expected in the bag</p>
          <p className="text-[18px] font-bold text-go-ink mt-1">{c.service} <span className="go-grad-text">{c.teeth.join(', ')}</span></p>
          <p className="text-[13px] text-go-muted mt-0.5">{shortName(patientById(c.patientId).name)} · {c.material}{c.shade ? ` · Shade ${c.shade}` : ''}</p>
          {shipped && <p className="text-[12px] text-go-ink2 mt-3 pt-3 border-t border-go-line">Shipped by lab {fmtDateTime(shipped.at)}{shipped.text ? ` · ${shipped.text}` : ''}</p>}
        </Card>
      </div>

      <Section title="Quick check">
        <div className="space-y-2">
          {RECEIVE_CHECKS.map(k => (
            <CheckRow key={k.id} label={k.label} required={k.required} checked={!!checks[k.id]} onChange={v => setChecks(s => ({ ...s, [k.id]: v }))} />
          ))}
        </div>
      </Section>

      <Section title="Stored in">
        <Chips options={STORAGE} value={stored} onChange={setStored} />
      </Section>

      <Section title="Comment">
        <TextArea value={comment} onChange={e => setComment(e.target.value)} placeholder="e.g. Bag slightly damp, work fine" />
      </Section>

      <Sheet open={problemOpen} onClose={() => setProblemOpen(false)} title="Report a problem" sub={`${lab} is notified and replies in the case thread.`}
        footer={<Btn block variant="danger" disabled={!problems.length} onClick={report}>Report to {lab}</Btn>}>
        <Label>What’s wrong?</Label>
        <Chips options={PROBLEMS} value={problems} onChange={setProblems} multi />
        <div className="mt-5"><Label optional>Details</Label><TextArea rows={4} value={problemNote} onChange={e => setProblemNote(e.target.value)} placeholder="Describe what you found. Add photos from the case later." /></div>
        <p className={cx('text-[12px] text-go-muted mt-3')}>The work is still logged as arrived so it isn’t lost.</p>
      </Sheet>
    </Screen>
  );
}
