import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Building, CheckCircle2, Info, PackageCheck, Printer, Truck } from '../icons';
import { ME, useGo } from '../store';
import {
  COURIERS, LabCase, PROBLEMS, RECEIVE_CHECKS, STORAGE, clinicianName, fmtDateTime, labName, nowIso, patientById, practiceName,
} from '../data';
import { DispatchLabelPage } from '../../components/DispatchLabel';
import { Btn, Card, CheckRow, Chips, EmptyState, Input, Label, Screen, Section, Sheet, Stepper, TextArea, TopBar, cx } from '../ui';

function useCase() {
  const { id } = useParams();
  const { cases } = useGo();
  return cases.find(c => c.id === id);
}

function Missing({ list = '/go/work' }: { list?: string }) {
  return <Screen header={<TopBar back fallback={list} />}><EmptyState icon={<Info className="w-7 h-7" />} title="Case not found" body="We couldn’t find this case. It may have been removed." /></Screen>;
}

/** The A4 lab ticket, scaled down to fit the phone. Always printed black on white. */
function A4Label({ c }: { c: LabCase }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const scale = width / 794;
  return (
    <div ref={box} className="w-full overflow-hidden rounded-xl bg-white border border-[#E0E0E6] shadow-[0_12px_32px_-16px_rgba(16,24,64,.35)]" style={{ height: 1123 * scale }}>
      <div style={{ width: 794, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <DispatchLabelPage
          caseNumber={c.id}
          labName={labName(c.lab)}
          details={{ patient: patientById(c.patientId).name, dentist: clinicianName(c.clinician), clinic: practiceName(c.practice) }}
        />
      </div>
    </div>
  );
}

/** list = where Back and "done" return to; the light version passes its To dispatch list. */
export function DispatchScreen({ list }: { list?: string }) {
  const c = useCase();
  const { updateCase, toast, notify } = useGo();
  const navigate = useNavigate();
  const [printed, setPrinted] = useState(false);
  const [open, setOpen] = useState(false);
  const [courier, setCourier] = useState<string | null>(null);
  // "Other" asks for the courier's name, which is what gets recorded.
  const [otherCourier, setOtherCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const [collected, setCollected] = useState(() => new Date().toISOString().slice(0, 10));
  const [bags, setBags] = useState(1);
  const [notes, setNotes] = useState('');
  if (!c) return <Missing list={list} />;
  const back = list ?? `/go/work/${c.id}`;
  const lab = labName(c.lab);
  const courierName = courier === 'Other' ? otherCourier.trim() : courier;
  const needsTracking = courier && !["Lab's own courier", 'Hand delivered'].includes(courier);

  if (c.stage !== 'ready') {
    return (
      <Screen header={<TopBar back fallback={back} title="Dispatch to lab" sub={c.id} />}>
        <EmptyState icon={<Truck className="w-7 h-7" />} title="Already dispatched" body={`${c.id} left the practice${c.dispatch ? ` with ${c.dispatch.courier}` : ''}.`}
          action={<Btn variant="secondary" onClick={() => navigate(back, { replace: true })}>{list ? 'Back to the list' : 'View case'}</Btn>} />
      </Screen>
    );
  }

  const submit = () => {
    updateCase(c.id, x => ({
      stage: 'dispatched',
      dispatch: { courier: courierName!, tracking: tracking || undefined, bags, notes: notes || undefined },
      events: [...x.events, { stage: 'dispatched', at: nowIso(), by: ME.name, text: [courierName, tracking].filter(Boolean).join(' · ') }],
    }));
    toast(`Dispatched to ${lab}`);
    notify('lab', `New case ${c.id} from ${practiceName(c.practice)}`, 'info');
    setOpen(false);
    navigate(back, { replace: true });
  };

  return (
    <Screen header={<TopBar back fallback={back} title="Dispatch to lab" sub={`${c.id} · ${lab}`} />}
      footer={
        <div className="flex gap-2">
          <Btn variant="secondary" className="!px-4 whitespace-nowrap" aria-label={printed ? 'Print label again' : 'Print label'}
            icon={printed ? <CheckCircle2 className="w-5 h-5 text-go-ok" /> : <Printer className="w-5 h-5" />}
            onClick={() => { setPrinted(true); toast('Label sent to the reception printer', 'info'); }}>
            {printed ? 'Printed' : 'Print label'}
          </Btn>
          <Btn className="flex-1 min-w-0 whitespace-nowrap !px-3" onClick={() => setOpen(true)} icon={<Truck className="w-5 h-5" />}>Mark as dispatched</Btn>
        </div>
      }>
      <section className="px-4 pt-2">
        <A4Label c={c} />
        <p className="text-[12px] text-go-muted mt-2 px-1">A4. Put this sheet in the parcel with the impressions, bite registration and signed lab form.</p>
      </section>

      <Sheet open={open} onClose={() => setOpen(false)} title="Mark as dispatched" sub={`${c.id} · ${lab}`}
        footer={
          <div className="flex gap-2">
            <Btn variant="secondary" className="!px-5" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn className="flex-1 min-w-0 whitespace-nowrap !px-3" disabled={!courierName || !collected} onClick={submit} icon={<Truck className="w-5 h-5" />}>Mark as dispatched</Btn>
          </div>
        }>
        <div className="space-y-5 pb-2">
          <div><Label>Courier</Label><Chips options={COURIERS} value={courier} onChange={setCourier} />
            {courier === 'Other' && <Input className="mt-3" value={otherCourier} onChange={e => setOtherCourier(e.target.value)} placeholder="Enter courier name" autoFocus />}
          </div>
          {needsTracking && (
            <div><Label optional>Tracking number</Label><Input value={tracking} onChange={e => setTracking(e.target.value.toUpperCase())} placeholder="e.g. AB123456789GB" className="font-mono" /></div>
          )}
          <div className="flex gap-3">
            <div className="flex-1"><Label>Dispatched on</Label><Input type="date" value={collected} onChange={e => setCollected(e.target.value)} /></div>
            <div><Label>Bags or boxes</Label><Stepper value={bags} onChange={setBags} /></div>
          </div>
          <div><Label optional>Contents or notes</Label><TextArea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Impressions, bite registration, models…" /></div>
        </div>
      </Sheet>
    </Screen>
  );
}

/** Old route → case detail with the confirm open. */
export function ReceiveScreen() {
  const { id } = useParams();
  return <Navigate to={`/go/work/${id}?receive=1`} replace />;
}

const NOTE_MAX = 1000;

/** Same as the portal: a confirm with optional delivery notes. The lab is notified. */
export function ReceiveSheet({ c, open, onClose }: { c: LabCase; open: boolean; onClose: () => void }) {
  const { updateCase, toast, notify } = useGo();
  const [note, setNote] = useState('');
  const lab = labName(c.lab);
  const receive = () => {
    const text = note.trim();
    updateCase(c.id, x => ({
      stage: 'received',
      receipt: text ? { storedIn: 'Not recorded', comment: text } : undefined,
      events: [...x.events, { stage: 'received', at: nowIso(), by: ME.name, text: text || undefined }],
    }));
    toast(`Marked as received · ${lab} notified`);
    notify('lab', `${practiceName(c.practice)} received ${c.id}`, 'ok');
    setNote('');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Mark as received?"
      sub={<span className="inline-flex items-center gap-1.5"><Building className="w-3.5 h-3.5" />We’ll let {lab} know, if they use Smile Genius.</span>}
      footer={
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn onClick={receive} className="flex-[1.4]" icon={<PackageCheck className="w-5 h-5" />}>Yes, received</Btn>
        </div>
      }>
      <Label optional>Delivery notes</Label>
      <TextArea rows={3} maxLength={NOTE_MAX} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. condition on arrival" />
      <p className="text-right text-[11px] text-go-faint mt-1">{note.length} / {NOTE_MAX}</p>
    </Sheet>
  );
}
