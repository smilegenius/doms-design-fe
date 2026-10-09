// ─── Logistics — dispatch to the lab, mark as received ──────────────────────
// Ported 1:1 from the web prototype (screens/Logistics.tsx). The web's
// ReceiveScreen route only redirected to the case with ?receive=1, so it is not
// a route here: the case detail opens ReceiveSheet from its receive param.
import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Rect } from 'react-native-svg';
import { Building, CheckCircle2, Info, PackageCheck, Printer, Truck } from '../components/icons';
import { ME, useGo } from '../store/store';
import { COURIERS, LabCase, caseTitle, fmtDate, labName, LABS, nowIso, patientById, practiceName, shortName } from '../data/data';
import { Btn, Card, Chips, DateField, EmptyState, Input, Label, Screen, Section, Sheet, Stepper, T, TextArea, TopBar } from '../components/ui';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

function useCase() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cases } = useGo();
  return cases.find(c => c.id === (Array.isArray(id) ? id[0] : id));
}

function Missing() {
  return <Screen header={<TopBar back fallback="/work" />}><EmptyState icon={<Info className="w-7 h-7 text-go-muted" />} title="Case not found" body="We couldn’t find this case. It may have been removed." /></Screen>;
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
  // 11 × 11 grid in 74px with 1.5px gaps (the web grid-cols-11 gap-[1.5px])
  const SIZE = 74, GAP = 1.5, CELL = (SIZE - GAP * 10) / 11;
  return (
    <Svg width={SIZE} height={SIZE} style={{ flexShrink: 0 }}>
      {cells.map((on, i) => on && (
        <Rect key={i} x={(i % 11) * (CELL + GAP)} y={Math.floor(i / 11) * (CELL + GAP)} width={CELL} height={CELL} rx={1} fill="#030213" />
      ))}
    </Svg>
  );
}

/** Label text in fixed print colours (style wins over T's default ink). */
const P = ({ color = '#030213', className, style, children }: { color?: string; className?: string; style?: object; children: React.ReactNode }) =>
  <T className={className} style={[{ color }, style]}>{children}</T>;

/** Physical label — always printed black on white, whatever the app theme. */
function LabelPreview({ c }: { c: LabCase }) {
  const lab = LABS.find(l => l.id === c.lab)!;
  return (
    <View className="rounded-2xl p-4" style={{
      backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E6', aspectRatio: 100 / 62,
      shadowColor: '#101840', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 12 }, elevation: 4,
    }}>
      <View className="flex-row items-center justify-between">
        <P color="#717182" className="text-[10px] font-bold uppercase tracking-[1.6px]">Smile Genius · Lab work</P>
        <P color="#717182" className="text-[10px] font-semibold">{c.funding}</P>
      </View>
      <View className="flex-1 flex-row items-center gap-4 mt-2">
        <FakeCode seed={c.id} />
        <View className="flex-1 min-w-0">
          <P className="text-[22px] font-bold leading-[24px]" style={{ fontFamily: MONO, fontWeight: '700' }}>{c.id}</P>
          <P className="text-[13px] font-semibold mt-1.5">{shortName(patientById(c.patientId).name)} · {caseTitle(c)}</P>
          <P color="#5A5568" className="text-[12px] mt-0.5">To: {lab.name}, {lab.town}</P>
          <P color="#5A5568" className="text-[12px]">Delivery date {fmtDate(c.returnBy)}</P>
        </View>
      </View>
      <P color="#A0A0B0" className="text-[10px] mt-1">From {practiceName(c.practice)}</P>
    </View>
  );
}

export function DispatchScreen() {
  const c = useCase();
  const { updateCase, toast } = useGo();
  const [printed, setPrinted] = useState(false);
  const [courier, setCourier] = useState<string | null>(null);
  const [tracking, setTracking] = useState('');
  const [collected, setCollected] = useState(() => new Date().toISOString().slice(0, 10));
  const [bags, setBags] = useState(1);
  const [notes, setNotes] = useState('');
  if (!c) return <Missing />;
  const lab = labName(c.lab);
  const needsTracking = courier && !["Lab's own courier", 'Hand delivered'].includes(courier);

  if (c.stage !== 'ready') {
    return (
      <Screen header={<TopBar back fallback={`/work/${c.id}`} title="Dispatch to lab" sub={c.id} />}>
        <EmptyState icon={<Truck className="w-7 h-7 text-go-muted" />} title="Already dispatched" body={`${c.id} left the practice${c.dispatch ? ` with ${c.dispatch.courier}` : ''}.`}
          action={<Btn variant="secondary" onPress={() => router.replace(`/work/${c.id}` as never)}>View case</Btn>} />
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
    router.replace(`/work/${c.id}` as never);
  };

  return (
    <Screen header={<TopBar back fallback={`/work/${c.id}`} title="Dispatch to lab" sub={`${c.id} · ${lab}`} />}
      footer={
        <View className="flex-row gap-2">
          <Btn variant={printed ? 'secondary' : 'soft'}
            icon={printed ? <CheckCircle2 className="w-5 h-5 text-go-ok" /> : <Printer className="w-5 h-5 text-go-brand-ink" />}
            onPress={() => { setPrinted(true); toast('Label sent to the reception printer', 'info'); }}>
            {printed ? 'Printed' : 'Print'}
          </Btn>
          <Btn className="flex-1 min-w-0" disabled={!courier} onPress={submit} icon={<Truck className="w-5 h-5 text-white" />}>Mark as dispatched</Btn>
        </View>
      }>
      <Section title="1 · Print label" className="!mt-2">
        <LabelPreview c={c} />
        <T className="text-[12px] text-go-muted mt-2 px-1">100 × 62 mm. Stick it on the lab bag before sending.</T>
      </Section>

      <Section title="2 · Pack">
        <Card className="p-4 flex-row gap-3">
          <PackageCheck className="w-5 h-5 text-go-brand mt-0.5" />
          <T className="flex-1 text-[13px] text-go-ink2 leading-[20px]">Include the impressions, bite registration and signed lab form.</T>
        </Card>
      </Section>

      <Section title="3 · Courier">
        <View className="gap-5">
          <View><Label>Courier</Label><Chips options={COURIERS} value={courier} onChange={setCourier} /></View>
          {!!needsTracking && (
            <View>
              <Label optional>Tracking number</Label>
              <Input value={tracking} onChangeText={v => setTracking(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false}
                placeholder="e.g. AB123456789GB" style={{ fontFamily: MONO }} />
            </View>
          )}
          <View className="flex-row gap-3">
            <View className="flex-1 min-w-0"><Label>Collected on</Label><DateField value={collected} onChange={setCollected} accessibilityLabel="Collected on" /></View>
            <View><Label>Bags or boxes</Label><Stepper value={bags} onChange={setBags} /></View>
          </View>
          <View><Label optional>Contents or notes</Label><TextArea value={notes} onChangeText={setNotes} placeholder="Impressions, bite registration, models…" /></View>
        </View>
      </Section>
    </Screen>
  );
}

const NOTE_MAX = 1000;

/** Same as the portal: a confirm with optional delivery notes. The lab is notified. */
export function ReceiveSheet({ c, open, onClose }: { c: LabCase; open: boolean; onClose: () => void }) {
  const { updateCase, toast } = useGo();
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
    setNote('');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Mark as received?"
      sub={
        <View className="flex-row items-center gap-1.5 mt-1">
          <Building className="w-3.5 h-3.5 text-go-muted" />
          <T className="flex-1 text-[13px] text-go-muted leading-[18px]">We’ll let {lab} know, if they use Smile Genius.</T>
        </View>
      }
      footer={
        <View className="flex-row gap-2">
          <Btn variant="secondary" onPress={onClose} className="flex-1">Cancel</Btn>
          <Btn onPress={receive} className="flex-[1.4]" icon={<PackageCheck className="w-5 h-5 text-white" />}>Yes, received</Btn>
        </View>
      }>
      <Label optional>Delivery notes</Label>
      <TextArea rows={3} maxLength={NOTE_MAX} value={note} onChangeText={setNote} placeholder="e.g. condition on arrival" />
      <T className="text-right text-[11px] text-go-faint mt-1">{note.length} / {NOTE_MAX}</T>
    </Sheet>
  );
}
