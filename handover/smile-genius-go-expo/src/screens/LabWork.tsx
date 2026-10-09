// ─── Lab work — list and case ────────────────────────────────────────────────
// A plain list of cases (no timeline / day grouping), soonest delivery date
// first, narrowed by the status chips, search and dentist / lab filters.
// Ported 1:1 from the web prototype (screens/LabWork.tsx).
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import {
  CalendarClock, CheckCircle2, ClipboardCheck, Clock, FileText, FlaskConical, Image as ImageIcon, Inbox, MessageSquare, PackageCheck,
  Paperclip, Pause, PlusCircle, Search, Send, Truck, X, Hammer, Building, Filter, User, List, LayoutGrid,
} from '../components/icons';
import type { IconType } from '../components/icons';
import { FEATURES, ME, useGo, useScoped } from '../store/store';
import { ReceiveSheet } from './Logistics';
import {
  ATTENTION, Attention, CLINICIANS, labStatusOf, LABS, LabCase, matchesAttention, allItems, caseTitle, ReadinessLevel, STAGES, Stage, clinicianName, dayOffset, fmtDate, fmtDateTime, labName, nextAction, nowIso,
  createdOn, initials, patientById, STAGE_NAMES, StageLine, dueLabel, patchItemStages, phaseName, remainingStages, stagedKindOf, practiceName, readiness, relDay, shortName, stageIndex,
} from '../data/data';
import {
  Btn, Card, Chips, DateField, EmptyState, Grad, IconTile, Label, Pill, PickerField, READINESS_TONE, Rows, Screen, SearchBox, Segmented, Sheet, T, TextArea, TopBar, Tone, cx,
} from '../components/ui';

/** First value of a route param (expo-router can hand back string[]). */
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;

/** Lay children out as a 2-column grid (the web `grid grid-cols-2 gap-2`). */
function Grid2({ children }: { children: React.ReactNode[] }) {
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < children.length; i += 2) rows.push(children.slice(i, i + 2));
  return (
    <View className="gap-2">
      {rows.map((r, i) => (
        <View key={i} className="flex-row gap-2">
          {r.map((k, j) => <View key={j} className="flex-1 min-w-0">{k}</View>)}
          {r.length === 1 && <View className="flex-1" />}
        </View>
      ))}
    </View>
  );
}

// ─── Rows and cards ─────────────────────────────────────────────────────────
// Two views of the same cases: a dense list (default) and roomier cards.
// Both show dentist + lab with their icons, since search matches those.

const drShort = (c: LabCase) => clinicianName(c.clinician).replace(/^Dr (\S)\S* /, 'Dr $1. ');
const labShort = (c: LabCase) => labName(c.lab).replace(/ (Dental )?(Lab|Laboratory|Works)$/, '');
const openCase = (c: LabCase) => (c.stage === 'draft' ? `/new/manual?draft=${c.id}` : `/work/${c.id}`);

/** Status pill text; an overdue case shows how late it is ("2 days late") instead of "Late". */
const pillLabel = (c: LabCase, label: string) => {
  if (label !== 'Late') return label;
  const n = Math.max(1, -dayOffset(c.returnBy));
  return `${n} day${n === 1 ? '' : 's'} late`;
};

/** Dentist and lab, each with its icon. */
function WhoLine({ c, className }: { c: LabCase; className?: string }) {
  return (
    <View className={cx('flex-row items-center gap-2.5 min-w-0', className)}>
      <View className="flex-row items-center gap-1 min-w-0 flex-shrink">
        <User className="w-3.5 h-3.5 text-go-brand" accessibilityLabel="Dentist" />
        <T className="text-[12px] text-go-ink2 truncate flex-shrink">{drShort(c)}</T>
      </View>
      <View className="flex-row items-center gap-1 min-w-0 flex-shrink">
        <FlaskConical className="w-3.5 h-3.5 text-go-violet" accessibilityLabel="Lab" />
        <T className="text-[12px] text-go-muted truncate flex-shrink">{labShort(c)}</T>
      </View>
    </View>
  );
}

const Initials = ({ c, size = 40 }: { c: LabCase; size?: number }) => (
  <View className="rounded-full bg-go-raised border border-go-line items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
    <T className="text-[12px] font-bold text-go-ink2">{initials(patientById(c.patientId).name)}</T>
  </View>
);

/** List view: initials · patient + case ID · dentist + lab · status + delivery date. */
function CaseRow({ c }: { c: LabCase }) {
  const r = readiness(c);
  const due = dueLabel(c);
  return (
    <Pressable onPress={() => router.push(openCase(c) as never)} accessibilityRole="button"
      className="w-full flex-row items-center gap-3 px-3.5 py-3 active:bg-go-raised">
      <Initials c={c} />
      <View className="flex-1 min-w-0">
        <View className="flex-row items-baseline gap-1.5 min-w-0">
          <T className="text-[14px] font-semibold truncate flex-shrink">{shortName(patientById(c.patientId).name)}</T>
          <T className="text-[10.5px] text-go-faint flex-shrink-0" style={MONO}>{c.id}</T>
        </View>
        <WhoLine c={c} className="mt-0.5" />
        {/* Denture stage / aligner phase that the date belongs to */}
        {!!due && <T className="text-[11.5px] font-medium text-go-violet mt-0.5 truncate">Next: {due}</T>}
      </View>
      <View className="items-end flex-shrink-0">
        <Pill tone={READINESS_TONE[r.level]} className="!h-[22px] !px-2">{pillLabel(c, r.label)}</Pill>
        <T className="text-[11px] text-go-muted mt-1">{c.returnBy ? fmtDate(c.returnBy) : 'No date'}</T>
      </View>
    </Pressable>
  );
}

/** Card view: one card per case with the service, dentist, lab and delivery date spelled out. */
function CaseCard({ c }: { c: LabCase }) {
  const r = readiness(c);
  const p = patientById(c.patientId);
  return (
    <Card onPress={() => router.push(openCase(c) as never)} className="p-3.5">
      <View className="flex-row items-center gap-3">
        <Initials c={c} size={36} />
        <View className="flex-1 min-w-0">
          <T className="text-[14.5px] font-semibold truncate">{p.name}</T>
          <T className="text-[10.5px] text-go-faint" style={MONO}>{c.id}</T>
        </View>
        <Pill tone={READINESS_TONE[r.level]} className="!h-[22px] !px-2 flex-shrink-0">{pillLabel(c, r.label)}</Pill>
      </View>
      <T className="text-[13px] text-go-ink2 mt-2.5 truncate">{caseTitle(c)}</T>
      <View className="flex-row gap-2 mt-2.5">
        <View className="flex-1 flex-row items-center gap-2 min-w-0 h-9 px-2.5 rounded-xl bg-go-raised">
          <User className="w-4 h-4 text-go-brand" accessibilityLabel="Dentist" />
          <T className="text-[12px] font-medium text-go-ink2 truncate flex-shrink">{drShort(c)}</T>
        </View>
        <View className="flex-1 flex-row items-center gap-2 min-w-0 h-9 px-2.5 rounded-xl bg-go-raised">
          <FlaskConical className="w-4 h-4 text-go-violet" accessibilityLabel="Lab" />
          <T className="text-[12px] font-medium text-go-ink2 truncate flex-shrink">{labShort(c)}</T>
        </View>
      </View>
      <View className="flex-row items-center gap-1.5 mt-2.5 pt-2.5 border-t border-go-line">
        <CalendarClock className="w-3.5 h-3.5 text-go-muted" />
        <T className="text-[12px] text-go-muted">Delivery <T className="text-[12px] font-semibold text-go-ink2">{c.returnBy ? fmtDate(c.returnBy) : 'Not set'}</T></T>
        <T className="flex-1 text-[12px] text-go-muted text-right truncate">{r.detail}</T>
      </View>
    </Card>
  );
}

/** Monospace for case IDs (the web `font-mono`). */
const MONO = { fontFamily: 'monospace' } as const;

// ─── List ───────────────────────────────────────────────────────────────────

type RFilter = 'all' | ReadinessLevel;

/** Search matches only patient, dentist and lab names. */
const matchesSearch = (c: LabCase, q: string) => {
  const t = q.trim().toLowerCase();
  return !t || [patientById(c.patientId).name, clinicianName(c.clinician), labName(c.lab)].some(x => x.toLowerCase().includes(t));
};

/** Creation-date filter: quick ranges, then a custom from / to. */
type CreatedRange = '7' | '14' | '30' | 'custom';
const CREATED_PRESETS: { id: CreatedRange | null; label: string }[] = [
  { id: null, label: 'Any time' }, { id: '7', label: 'Last 7 days' }, { id: '14', label: 'Last 2 weeks' },
  { id: '30', label: 'Last 30 days' }, { id: 'custom', label: 'Custom' },
];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Inclusive day range [from, to] as yyyy-mm-dd; null when no created filter. */
function createdBounds(range: CreatedRange | null, from: string | null, to: string | null): [string, string] | null {
  if (!range) return null;
  if (range === 'custom') return from || to ? [from ?? '0000-01-01', to ?? '9999-12-31'] : null;
  const start = new Date(); start.setDate(start.getDate() - (Number(range) - 1));
  return [ymd(start), ymd(new Date())];
}
const createdIn = (c: LabCase, b: [string, string] | null) => {
  if (!b) return true;
  const d = createdOn(c);
  return !!d && ymd(new Date(d)) >= b[0] && ymd(new Date(d)) <= b[1];
};
const fmtYmd = (s: string) => new Date(`${s}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** Soonest delivery date first; cases with no date (e.g. drafts) at the end. */
const byDelivery = (x: LabCase, y: LabCase) => (x.returnBy || '9').localeCompare(y.returnBy || '9');

/** Removable active-filter chip (brand fill, ×). */
function FilterChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Remove ${label}`}
      className="h-8 pl-3 pr-2 rounded-full bg-go-brand flex-row items-center gap-1 flex-shrink-0">
      <T className="text-[12.5px] font-semibold text-white" numberOfLines={1}>{label}</T>
      <X className="w-3.5 h-3.5 text-white" />
    </Pressable>
  );
}

export function LabWorkScreen() {
  const { cases } = useScoped();
  const params = useLocalSearchParams<{ f?: string; r?: string; day?: string; dentist?: string; lab?: string; created?: string; from?: string; to?: string; view?: string }>();
  const dayP = one(params.day);
  const day = dayP ? Number(dayP) : null;
  // Status filter from the Home tiles: ready | arriving | questions | overdue
  const status = ATTENTION.find(a => a.id === one(params.f))?.id ?? null;
  // Readiness filter lives in the route params (?r=at-risk) so scenarios can deep-link to it
  const rf = (one(params.r) as RFilter) || 'all';
  const [q, setQ] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Dentist / lab filters (route params so they survive navigation)
  const dentist = one(params.dentist);
  const labF = one(params.lab);
  // Created date: ?created=7|14|30|custom (+ ?from=&to= for custom)
  const created = (['7', '14', '30', 'custom'] as const).find(x => x === one(params.created)) ?? null;
  const cFrom = one(params.from);
  const cTo = one(params.to);
  const bounds = createdBounds(created, cFrom, cTo);
  const nFilters = (status ? 1 : 0) + (dentist ? 1 : 0) + (labF ? 1 : 0) + (bounds ? 1 : 0);
  // Card view is switched off for now (FEATURES.labCardView). When on: list
  // (default) or cards, in the route params so scenarios can deep-link (?view=cards).
  const labCardView = FEATURES.labCardView;
  const view = labCardView && one(params.view) === 'cards' ? 'cards' : 'list';

  const base = useMemo(() => cases.filter(c => {
    return matchesSearch(c, q) && (day === null || (c.appointment && dayOffset(c.appointment.at) === day))
      && (!status || matchesAttention(c, status))
      && (!dentist || c.clinician === dentist) && (!labF || c.lab === labF) && createdIn(c, bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cases, q, day, status, dentist, labF, bounds?.[0], bounds?.[1]]);
  const baseNoStatus = useMemo(() => cases.filter(c => {
    return matchesSearch(c, q) && (day === null || (c.appointment && dayOffset(c.appointment.at) === day))
      && (!dentist || c.clinician === dentist) && (!labF || c.lab === labF) && createdIn(c, bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cases, q, day, dentist, labF, bounds?.[0], bounds?.[1]]);
  const shown = base.filter(c => rf === 'all' || readiness(c).level === rf);
  // Several keys in one update (undefined removes a param)
  const setMany = (kv: Record<string, string | null>) => {
    const n: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(kv)) n[k] = v === null ? undefined : v;
    router.setParams(n as never);
  };
  const setParam = (k: string, v: string | null) => setMany({ [k]: v });
  const createdLabel = created === 'custom'
    ? `Created ${cFrom ? fmtYmd(cFrom) : '…'} – ${cTo ? fmtYmd(cTo) : '…'}`
    : `Created: ${CREATED_PRESETS.find(p => p.id === created)?.label.toLowerCase()}`;
  const sorted = [...shown].sort(byDelivery);

  const VIEWS: [string, IconType, string][] = [['list', List, 'List view'], ['cards', LayoutGrid, 'Card view']];

  return (
    <Screen tabs header={
      <View className="bg-go-bg/80 px-4 pt-3 pb-3 gap-3">
        <View className="flex-row items-center justify-between">
          <T className="text-[24px] font-bold">Lab work <T className="text-go-faint font-semibold text-[18px]">{cases.length}</T></T>
          <View className="flex-row items-center gap-2">
            {/* View: list or cards (only when card view is switched on) */}
            {labCardView && (
              <View accessibilityLabel="View" className="flex-row p-1 h-10 rounded-full bg-go-surface border border-go-line">
                {VIEWS.map(([v, Icon, label]) => (
                  <Pressable key={v} onPress={() => setParam('view', v === 'list' ? null : v)} accessibilityRole="button" accessibilityLabel={label}
                    accessibilityState={{ selected: view === v }} className="w-8 h-full rounded-full overflow-hidden">
                    {view === v
                      ? <Grad className="flex-1 items-center justify-center"><Icon className="w-4 h-4 text-white" /></Grad>
                      : <View className="flex-1 items-center justify-center"><Icon className="w-4 h-4 text-go-muted" /></View>}
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable onPress={() => setFiltersOpen(true)} accessibilityRole="button" accessibilityLabel="Filter by status, dentist, lab or creation date"
              className={cx('w-10 h-10 rounded-full items-center justify-center border', nFilters ? 'bg-go-brand-soft border-go-brand/30' : 'bg-go-surface border-go-line')}>
              <Filter className={cx('w-[18px] h-[18px]', nFilters ? 'text-go-brand' : 'text-go-ink')} />
              {!!nFilters && (
                <Grad className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full items-center justify-center border-2 border-go-bg">
                  <T className="text-white text-[10px] font-bold">{nFilters}</T>
                </Grad>
              )}
            </Pressable>
          </View>
        </View>
        {/* Search is always open (not behind an icon) */}
        <SearchBox value={q} onChange={setQ} placeholder="Search patient, dentist or lab" />
      </View>
    }>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 pb-1" keyboardShouldPersistTaps="handled">
        {!!dentist && <FilterChip label={clinicianName(dentist)} onPress={() => setParam('dentist', null)} />}
        {!!labF && <FilterChip label={labName(labF)} onPress={() => setParam('lab', null)} />}
        {!!bounds && <FilterChip label={createdLabel} onPress={() => setMany({ created: null, from: null, to: null })} />}
        {day !== null && <FilterChip label={fmtDate(new Date(Date.now() + day * 864e5).toISOString())} onPress={() => setParam('day', null)} />}
        {/* Status chips — same statuses as the Home tiles */}
        {[{ id: null as Attention | null, label: 'All' }, ...ATTENTION.filter(x => x.home || x.id === status).map(x => ({ id: x.id as Attention | null, label: x.short }))].map(f => {
          const n = f.id ? baseNoStatus.filter(c => matchesAttention(c, f.id!)).length : baseNoStatus.length;
          const on = status === f.id;
          return (
            <Pressable key={f.id ?? 'all'} onPress={() => setParam('f', f.id)} accessibilityRole="button" accessibilityState={{ selected: on }}
              className={cx('h-8 pl-3 pr-2 rounded-full border flex-shrink-0 flex-row items-center gap-1.5',
                on ? 'bg-go-ink border-go-ink' : 'bg-go-surface border-go-line')}>
              <T className={cx('text-[12.5px] font-medium', on ? 'text-go-bg' : 'text-go-ink2')} numberOfLines={1}>{f.label}</T>
              <T className={cx('text-[11px]', on ? 'text-go-bg opacity-70' : 'text-go-faint')}>{n}</T>
            </Pressable>
          );
        })}
      </ScrollView>
      <View className="px-4 mt-3 gap-4">
        {!!shown.length && (view === 'cards' ? (
          <View className="gap-2.5">{sorted.map(c => <CaseCard key={c.id} c={c} />)}</View>
        ) : (
          <Card className="overflow-hidden">
            <Rows>{sorted.map(c => <CaseRow key={c.id} c={c} />)}</Rows>
          </Card>
        ))}
        {!shown.length && <EmptyState icon={<Search className="w-7 h-7 text-go-muted" />} title="No lab work found" body="Please check the spelling, or clear the filters." />}
      </View>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} label="Lab work filters"
        title={<View className="flex-row items-center gap-2"><Filter className="w-5 h-5 text-go-brand" /><T className="text-[19px] font-bold leading-[24px]">Lab work</T></View>}
        footer={
          <View className="flex-row gap-2">
            <Btn variant="secondary" onPress={() => setMany({ f: null, dentist: null, lab: null, created: null, from: null, to: null })} disabled={!nFilters && !created}>Clear</Btn>
            <Btn className="flex-1" onPress={() => setFiltersOpen(false)}>Show {base.length} result{base.length === 1 ? '' : 's'}</Btn>
          </View>
        }>
        <View className="gap-4 pb-2">
          <PickerField label="Status" value={status ?? 'all'} onChange={v => setParam('f', v === 'all' ? null : v)}
            options={[{ value: 'all', label: 'All statuses', sub: `${baseNoStatus.length} case${baseNoStatus.length === 1 ? '' : 's'}` },
              ...ATTENTION.map(a => { const n = baseNoStatus.filter(c => matchesAttention(c, a.id)).length; return { value: a.id, label: a.label, sub: `${n} case${n === 1 ? '' : 's'}` }; })]} />
          <PickerField label="Dentist" searchable value={dentist ?? 'all'} onChange={v => setParam('dentist', v === 'all' ? null : v)}
            options={[{ value: 'all', label: 'All dentists', sub: `${cases.length} case${cases.length === 1 ? '' : 's'}` },
              ...CLINICIANS.map(c => ({ value: c.id, label: c.name, sub: `${cases.filter(x => x.clinician === c.id).length} cases` }))]} />
          <PickerField label="Lab" searchable value={labF ?? 'all'} onChange={v => setParam('lab', v === 'all' ? null : v)}
            options={[{ value: 'all', label: 'All labs', sub: `${cases.length} case${cases.length === 1 ? '' : 's'}` },
              ...LABS.map(l => ({ value: l.id, label: l.name, sub: `${l.town} · ${cases.filter(x => x.lab === l.id).length} cases` }))]} />
          <View>
            <Label>Creation date</Label>
            <Chips options={CREATED_PRESETS.map(p => p.label)} value={CREATED_PRESETS.find(p => p.id === created)!.label}
              onChange={(lbl: string) => {
                const v = CREATED_PRESETS.find(p => p.label === lbl)?.id ?? null; setMany(v === 'custom'
                  ? { created: 'custom', from: cFrom ?? ymd(new Date(Date.now() - 7 * 864e5)), to: cTo ?? ymd(new Date()) }
                  : { created: v, from: null, to: null });
              }} />
            {created === 'custom' && (
              <View className="flex-row gap-2 mt-3">
                <View className="flex-1 min-w-0">
                  <T className="text-[11.5px] text-go-muted mb-1 px-0.5">From</T>
                  <DateField value={cFrom ?? ''} max={cTo ?? undefined} onChange={v => setParam('from', v || null)} accessibilityLabel="From" className="!h-12 !px-3" />
                </View>
                <View className="flex-1 min-w-0">
                  <T className="text-[11.5px] text-go-muted mb-1 px-0.5">To</T>
                  <DateField value={cTo ?? ''} min={cFrom ?? undefined} onChange={v => setParam('to', v || null)} accessibilityLabel="To" className="!h-12 !px-3" />
                </View>
              </View>
            )}
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

// ─── Detail ─────────────────────────────────────────────────────────────────

const STEP_ICON: Record<Stage, IconType> = {
  draft: ClipboardCheck,
  ready: ClipboardCheck,
  dispatched: Truck,
  'at-lab': Building,
  production: Hammer,
  shipped: PackageCheck,
  received: CheckCircle2,
};

/** Stage stepper (named CaseStepper here — the kit's Stepper is the − / + counter). */
function CaseStepper({ c }: { c: LabCase }) {
  const idx = stageIndex(c.stage);
  return (
    <View className="flex-row justify-between">
      {/* Track + filled part, between the first and last dot centres (24px in from each side) */}
      <View className="absolute left-6 right-6 top-4 h-0.5 bg-go-line">
        <Grad className="h-0.5" style={{ width: `${(Math.max(0, idx) / (STAGES.length - 1)) * 100}%` }} />
      </View>
      {STAGES.map((s, i) => {
        const Icon = STEP_ICON[s.id];
        const dot = i <= idx
          ? <Grad className="w-8 h-8 rounded-full items-center justify-center"><Icon className="w-4 h-4 text-white" /></Grad>
          : <View className="w-8 h-8 rounded-full items-center justify-center bg-go-surface border border-go-line"><Icon className="w-4 h-4 text-go-faint" /></View>;
        return (
          <View key={s.id} className="items-center w-12">
            {/* Current stage: soft ring (the web ring-4 ring-go-brand/20) */}
            {i === idx ? <View className="w-10 h-10 -m-1 rounded-full bg-go-brand/20 items-center justify-center">{dot}</View> : dot}
            <T className={cx('text-[9.5px] mt-1 text-center leading-[12px]', i <= idx ? 'text-go-ink font-semibold' : 'text-go-faint')}>{s.short}</T>
          </View>
        );
      })}
    </View>
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
    <View>
      <View className="gap-3">
        {c.messages.map(m => (
          <View key={m.at} className={cx('max-w-[86%]', m.from === 'practice' && 'self-end')}>
            {m.from === 'lab' ? (
              <View className="p-3 rounded-2xl rounded-tl-md bg-go-surface border border-go-line">
                <T className="text-[13.5px] leading-[21px]">{m.text}</T>
              </View>
            ) : (
              <Grad className="p-3 rounded-2xl rounded-tr-md">
                <T className="text-[13.5px] leading-[21px] text-white">{m.text}</T>
              </Grad>
            )}
            <T className={cx('text-[10.5px] text-go-muted mt-1', m.from === 'practice' && 'text-right')}>{m.author} · {fmtDateTime(m.at)}</T>
          </View>
        ))}
        {!c.messages.length && <T className="text-[13px] text-go-muted text-center py-4">No comments with {labName(c.lab)} yet.</T>}
      </View>
      <View className="mt-4">
        {c.questionOpen && <Chips options={QUICK_REPLIES} value={null} onChange={(v: string) => setText(v)} />}
        <View className="flex-row items-end gap-2 mt-3">
          <View className="flex-1 min-w-0">
            <TextArea rows={2} value={text} onChangeText={setText} placeholder="Add a comment…" className="!py-2.5" />
          </View>
          <Pressable onPress={send} disabled={!text.trim()} accessibilityRole="button" accessibilityLabel="Send" accessibilityState={{ disabled: !text.trim() }}
            className={cx('w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0', !text.trim() ? 'opacity-40' : 'active:opacity-90')}>
            <Grad className="flex-1 items-center justify-center"><Send className="w-5 h-5 text-white" /></Grad>
          </Pressable>
        </View>
      </View>
    </View>
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
    toast(`Reminder sent to ${labName(c.lab)}`);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Chase the lab" sub="The lab will reply in Comments on this case."
      footer={<Btn block disabled={!text.trim()} onPress={send} icon={<Send className="w-[18px] h-[18px] text-white" />}>Send reminder</Btn>}>
      <TextArea rows={6} value={text} onChangeText={setText} />
    </Sheet>
  );
}

type Tab = 'details' | 'activity' | 'messages' | 'files';

// ─── Services with their delivery dates (incl. denture stages / aligner phases) ──

const isoFromYmd = (d: string) => (d ? new Date(`${d}T12:00`).toISOString() : '');
const tomorrowYmd = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10);

/** Small pill (the web `!h-[22px] !px-2`). */
const SmallPill = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => <Pill tone={tone} className="!h-[22px] !px-2">{children}</Pill>;

/** One stage / phase row: name, date and where it is. */
function StageRow({ s, n }: { s: StageLine; n: number }) {
  const late = !s.state && !!s.date && dayOffset(s.date) < 0;
  const tag = s.state === 'done-earlier' ? <SmallPill tone="neutral">Done earlier</SmallPill>
    : s.state === 'received' ? <SmallPill tone="ok">Received</SmallPill>
    : late ? <SmallPill tone="bad">Late</SmallPill>
    : <SmallPill tone="brand">{s.date ? 'Due' : 'No date'}</SmallPill>;
  return (
    <View className="flex-row items-center gap-2.5 py-2">
      <View className={cx('w-5 h-5 rounded-md items-center justify-center flex-shrink-0', s.state ? 'bg-go-raised' : 'bg-go-violet-soft')}>
        <T className={cx('text-[10.5px] font-bold', s.state ? 'text-go-faint' : 'text-go-violet')}>{n}</T>
      </View>
      <View className="flex-1 min-w-0">
        <T className={cx('text-[13px] font-semibold truncate', s.state ? 'text-go-muted' : 'text-go-ink')}>{s.name}</T>
        <T className="text-[11.5px] text-go-muted">{s.date ? fmtDate(s.date) : 'Date not set'}{s.orderedAt ? ` · ordered ${fmtDate(s.orderedAt)}` : ''}</T>
      </View>
      {tag}
    </View>
  );
}

function ServicesCard({ c, onOrder }: { c: LabCase; onOrder: (index: number) => void }) {
  const items = allItems(c);
  return (
    <View className="rounded-2xl bg-go-surface border border-go-line mb-2">
      <Rows>
        {items.map((it, i) => {
          const kind = it.staged ?? (it.stages?.length ? stagedKindOf(it.service) : undefined);
          const canOrder = kind === 'phase' || (kind === 'stage' && remainingStages(it).length > 0);
          return (
            <View key={i} className="px-3 py-2.5">
              <View className="flex-row items-center gap-3">
                <Grad className="w-6 h-6 rounded-lg items-center justify-center flex-shrink-0"><T className="text-white text-[11px] font-bold">{i + 1}</T></Grad>
                <View className="flex-1 min-w-0">
                  <T className="text-[13.5px] font-semibold truncate">{it.service} · {it.teeth.join(', ')}</T>
                  <T className="text-[11.5px] text-go-muted truncate">{[it.material, it.shade && `shade ${it.shade}`].filter(Boolean).join(' · ') || '—'}</T>
                </View>
                {!kind && (
                  <View className="items-end flex-shrink-0">
                    <T className="text-[10.5px] uppercase tracking-[0.5px] font-semibold text-go-faint">Delivery</T>
                    <T className="text-[12.5px] font-semibold text-go-ink2">{it.returnBy ? fmtDate(it.returnBy) : 'Not set'}</T>
                  </View>
                )}
              </View>
              {kind && (
                <View className="ml-9 mt-1">
                  <T className="text-[10.5px] uppercase tracking-[0.5px] font-semibold text-go-faint">{kind === 'stage' ? 'Stages' : 'Phases'}</T>
                  <Rows>
                    {(it.stages ?? []).map((s, j) => <StageRow key={s.name} s={s} n={j + 1} />)}
                  </Rows>
                  {canOrder && (
                    <Pressable onPress={() => onOrder(i)} accessibilityRole="button"
                      className="mt-1.5 mb-0.5 w-full h-10 rounded-xl border border-dashed border-go-brand/50 bg-go-brand-soft/60 flex-row items-center justify-center gap-1.5 active:opacity-90">
                      <PlusCircle className="w-4 h-4 text-go-brand-ink" />
                      <T className="text-[13px] font-semibold text-go-brand-ink">{kind === 'stage' ? 'Order next stage' : `Order ${phaseName((it.stages?.length ?? 0) + 1)}`}</T>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </Rows>
    </View>
  );
}

/** Order more stages (denture) or the next phase (aligners) on an existing case. */
function OrderStageSheet({ c, index, onClose }: { c: LabCase; index: number | null; onClose: () => void }) {
  const { updateCase, toast } = useGo();
  const it = index === null ? null : allItems(c)[index];
  const kind = it ? it.staged ?? stagedKindOf(it.service) : undefined;
  const left = it ? remainingStages(it) : [];
  const [pick, setPick] = useState<string[]>([]);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [lastIndex, setLastIndex] = useState<number | null>(null);
  if (index !== lastIndex) { setLastIndex(index); setPick(left.slice(0, 1)); setDates({}); } // reset per open
  if (!it || index === null) return null;
  const nextPhase = phaseName((it.stages?.length ?? 0) + 1);
  const names = kind === 'phase' ? [nextPhase] : STAGE_NAMES.filter(n => pick.includes(n));
  const send = () => {
    const now = nowIso();
    const added: StageLine[] = names.map(n => ({ name: n, date: isoFromYmd(dates[n] ?? ''), orderedAt: now }));
    updateCase(c.id, x => ({
      // Denture stages stay in their natural order (Special Tray … Finish); phases just add on
      ...patchItemStages(x, index, [...(allItems(x)[index].stages ?? []), ...added]
        .sort((p, q) => (kind === 'stage' ? STAGE_NAMES.indexOf(p.name) - STAGE_NAMES.indexOf(q.name) : 0))),
      events: [...x.events, { stage: 'note', at: now, by: ME.name, text: `Ordered ${names.join(', ')} · ${it.service}` }],
    }));
    toast(`${names.join(', ')} ordered from ${labName(c.lab)}`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={kind === 'phase' ? `Order ${nextPhase}` : 'Order next stage'}
      sub={`${it.service} · ${it.teeth.join(', ')} · ${labName(c.lab)}`}
      footer={<Btn block disabled={!names.length} onPress={send}>Send to the lab</Btn>}>
      <View className="gap-4 pb-2">
        {kind === 'stage' && (
          <View>
            <Label hint="Choose one or more">Stages to order</Label>
            <Chips options={left} value={pick} onChange={(v: string[]) => setPick(v)} multi />
          </View>
        )}
        {!!names.length && (
          <View>
            <Label optional>Delivery dates</Label>
            <View className="rounded-2xl border border-go-line bg-go-surface">
              <Rows>
                {names.map(n => (
                  <View key={n} className="flex-row items-center gap-3 px-3 py-2.5">
                    <T className="flex-1 text-[14px] font-semibold">{n}</T>
                    <View style={{ width: 156 }}>
                      <DateField accessibilityLabel={`${n} delivery date`} min={tomorrowYmd()} value={dates[n] ?? ''}
                        onChange={v => setDates(d => ({ ...d, [n]: v }))} className="!h-11 !px-3" />
                    </View>
                  </View>
                ))}
              </Rows>
            </View>
          </View>
        )}
        <T className="text-[12.5px] text-go-muted px-1">This is added to the same case. {labName(c.lab)} will see it as a new order.</T>
      </View>
    </Sheet>
  );
}

/** Sticky-footer action button (the web Btn size md with !h-11 !px-5; Chase is solid red). */
function StepBtn({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const inner = <T className="text-[13.5px] font-semibold text-white">{label}</T>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="active:opacity-85">
      {danger
        ? <View className="h-11 px-5 rounded-xl bg-go-bad items-center justify-center">{inner}</View>
        : <Grad glow className="h-11 px-5 rounded-xl items-center justify-center">{inner}</Grad>}
    </Pressable>
  );
}

/** Uppercase label + value tile used in the facts grid and the notes cards. */
const FACT_LABEL = 'text-[10.5px] uppercase tracking-[0.5px] font-semibold text-go-faint';

export function CaseDetailScreen() {
  const params = useLocalSearchParams<{ id: string; tab?: string; receive?: string }>();
  const id = one(params.id);
  const { cases } = useGo();
  const c = cases.find(x => x.id === id);
  const tab = (one(params.tab) as Tab) || 'details';
  const setTab = (t: Tab) => router.setParams({ tab: t === 'details' ? undefined : t, receive: undefined } as never);
  const [chase, setChase] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(one(params.receive) === '1');
  const [orderFor, setOrderFor] = useState<number | null>(null);
  if (!c) {
    return <Screen header={<TopBar back fallback="/work" title="Lab work" />}><EmptyState icon={<Search className="w-7 h-7 text-go-muted" />} title="Case not found" body="We couldn’t find this case. It may have been removed." /></Screen>;
  }
  if (c.stage === 'draft') return <Redirect href={`/new/manual?draft=${c.id}` as never} />;
  const p = patientById(c.patientId);
  const r = readiness(c);
  const a = nextAction(c);
  const shipped = c.events.find(e => e.stage === 'shipped');

  // One-line next step with its action — reads like a to-do, not a card.
  const step: { icon: React.ReactNode; tone: Tone; title: string; body: string; cta?: { label: string; run: () => void } } = {
    finish: { icon: <ClipboardCheck className="w-5 h-5 text-go-ink2" />, tone: 'neutral' as Tone, title: 'Draft not sent yet', body: 'Finish the details and send it to the lab.', cta: { label: 'Finish case', run: () => router.push(`/new/manual?draft=${c.id}` as never) } },
    // Only the lab can put a case on or off hold. The practice answers in Comments when the lab is waiting on it.
    'on-hold': c.onHold?.side === 'Practice'
      ? { icon: <Pause className="w-5 h-5 text-go-warn" />, tone: 'warn' as Tone, title: 'On hold · the lab is waiting for you', body: c.onHold.reason, cta: { label: 'Reply', run: () => setTab('messages') } }
      : { icon: <Pause className="w-5 h-5 text-go-warn" />, tone: 'warn' as Tone, title: 'On hold by the lab', body: `${c.onHold?.reason ?? ''} · Only the lab can take it off hold.` },
    dispatch: { icon: <Truck className="w-5 h-5 text-go-warn" />, tone: 'warn' as Tone, title: 'Send it to the lab', body: 'Include the impressions, bite and signed lab form.', cta: { label: 'Dispatch', run: () => router.push(`/work/${c.id}/dispatch` as never) } },
    reply: { icon: <MessageSquare className="w-5 h-5 text-go-pink" />, tone: 'pink' as Tone, title: `${labName(c.lab)} needs more information`, body: 'The case is paused until you reply.', cta: { label: 'Reply', run: () => setTab('messages') } },
    'check-in': { icon: <PackageCheck className="w-5 h-5 text-go-brand-ink" />, tone: 'brand' as Tone, title: 'Arriving from the lab', body: shipped ? `Shipped ${fmtDate(shipped.at)}${shipped.text ? ` · ${shipped.text}` : ''}` : 'On its way back.', cta: { label: 'Mark as received', run: () => setReceiveOpen(true) } },
    chase: { icon: <Clock className="w-5 h-5 text-go-bad" />, tone: 'bad' as Tone, title: 'Chase the lab', body: c.appointment ? 'Or move the patient’s appointment.' : `Delivery date was ${fmtDate(c.returnBy)}.`, cta: { label: 'Chase', run: () => setChase(true) } },
    wait: { icon: <FlaskConical className="w-5 h-5 text-go-violet" />, tone: 'violet' as Tone, title: c.chasedAt ? `Chased ${relDay(c.chasedAt).toLowerCase()}` : 'Nothing to do for now', body: c.chasedAt ? 'We’ll let you know when the lab replies.' : `Delivery date ${fmtDate(c.returnBy)}.` },
    done: { icon: <CheckCircle2 className="w-5 h-5 text-go-ok" />, tone: 'ok' as Tone, title: c.problem ? 'Problem reported' : 'Ready for the patient', body: c.problem ?? (c.receipt && c.receipt.storedIn !== 'Not recorded' ? `Stored in ${c.receipt.storedIn}.` : 'Received at the practice.') },
  }[a];

  const facts: [string, string][] = [
    ['Lab', labName(c.lab)],
    ['Lab status', labStatusOf(c) ?? 'Not received yet'],
    ['Dentist', clinicianName(c.clinician)],
    ['Material', c.material],
    ['Shade', [c.shade, c.stumpShade && `stump ${c.stumpShade}`].filter(Boolean).join(' · ') || '—'],
    ['Next delivery', `${dueLabel(c) ? `${dueLabel(c)} · ` : ''}${fmtDate(c.returnBy)}`],
    ['Order type', c.funding],
    ['Practice', practiceName(c.practice)],
    ['Created by', c.source === 'photo' ? `${c.createdBy} · from photo` : c.createdBy],
  ];
  const calTone = READINESS_TONE[r.level];
  const calIconColour: Record<Tone, string> = {
    brand: 'text-go-brand-ink', violet: 'text-go-violet', ok: 'text-go-ok', warn: 'text-go-warn', bad: 'text-go-bad', teal: 'text-go-teal', pink: 'text-go-pink', neutral: 'text-go-ink2',
  };

  return (
    <Screen header={<TopBar back fallback="/work" title={p.name} sub={`${c.id} · DOB ${p.dob}`} />}
      // Sticky next-step bar: Dispatch / Reply / Mark as received / Chase stay in thumb reach.
      // Hidden on the Comments tab while replying — the composer there is the action.
      footer={step.cta && !((a === 'reply' || a === 'on-hold') && tab === 'messages') ? (
        <View className="flex-row items-center gap-3">
          <IconTile icon={step.icon} tone={step.tone} size="sm" />
          <View className="flex-1 min-w-0">
            <T className="text-[13.5px] font-semibold truncate">{step.title}</T>
            <T className="text-[11.5px] text-go-muted truncate">{step.body}</T>
          </View>
          <StepBtn label={step.cta.label} onPress={step.cta.run} danger={a === 'chase'} />
        </View>
      ) : undefined}>
      {/* Summary */}
      <View className="px-4 pt-1">
        <View className="min-w-0">
          {/* The web shows the teeth in gradient text; RN has no gradient text without MaskedView, so brand colour */}
          <T className="text-[22px] font-bold leading-[28px]">{c.service} <T className="text-[22px] font-bold text-go-brand">{c.teeth.join(', ')}</T></T>
          <T className="text-[12.5px] text-go-muted mt-0.5 truncate">{c.material}{c.shade ? ` · ${c.shade}` : ''} · {labName(c.lab)}</T>
          {c.items?.map(it => (
            <T key={it.service} className="text-[14px] font-semibold mt-1.5">+ {it.service} <T className="text-[14px] font-semibold text-go-brand">{it.teeth.join(', ')}</T> <T className="text-[12px] font-normal text-go-muted">· {it.material}{it.shade ? ` · ${it.shade}` : ''}</T></T>
          ))}
        </View>

        {/* Appointment vs lab — the clinician's question */}
        <View className={cx('mt-3 rounded-[20px] p-3.5 flex-row items-center gap-3 border',
          r.level === 'at-risk' ? 'bg-go-bad-soft border-go-bad/25' : r.level === 'attention' ? 'bg-go-warn-soft border-go-warn/25' : 'bg-go-surface border-go-line')}>
          <IconTile icon={<CalendarClock className={cx('w-5 h-5', calIconColour[calTone])} />} tone={calTone} size="sm" />
          <View className="flex-1 min-w-0">
            <T className="text-[13.5px] font-semibold truncate">
              {c.appointment ? `${c.appointment.kind} · ${fmtDate(c.appointment.at)}` : 'No appointment booked'}
            </T>
            <T className={cx('text-[11.5px] truncate', r.level === 'at-risk' ? 'text-go-bad' : 'text-go-muted')}>
              {c.appointment ? `${c.appointment.room} · ` : ''}{r.detail}
            </T>
          </View>
          <Pill tone={calTone} dot>{r.label}</Pill>
        </View>

        <View className="mt-4 px-1"><CaseStepper c={c} /></View>

        {/* No action to take → a quiet info card in the page. Actions live in the sticky bar below. */}
        {!step.cta && (
          <Card className="mt-4 p-3 flex-row items-center gap-3">
            <IconTile icon={step.icon} tone={step.tone} size="sm" />
            <View className="flex-1 min-w-0">
              <T className="text-[13.5px] font-semibold truncate">{step.title}</T>
              <T className="text-[11.5px] text-go-muted truncate">{step.body}</T>
            </View>
          </Card>
        )}
      </View>

      {/* Tabs */}
      <View className="px-4 mt-4">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'details', label: 'Details' },
          { value: 'activity', label: 'Activity' },
          { value: 'messages', label: 'Comments', count: c.messages.length || undefined },
          { value: 'files', label: 'Files', count: c.attachments.length },
        ]} />
      </View>

      <View className="px-4 mt-3">
        {tab === 'details' && (
          <>
            {/* Every service with its own delivery date; staged ones list their stages / phases */}
            <ServicesCard c={c} onOrder={setOrderFor} />
            <Grid2>
              {facts.filter(([k]) => k !== 'Material' && k !== 'Shade').map(([k, v]) => (
                <View key={k} className="rounded-2xl bg-go-surface border border-go-line px-3 py-2.5 min-w-0">
                  <T className={FACT_LABEL}>{k}</T>
                  <T className="text-[13px] font-medium mt-0.5 truncate">{v}</T>
                </View>
              ))}
            </Grid2>
            <View className="rounded-2xl bg-go-surface border border-go-line px-3 py-2.5 mt-2">
              <T className={FACT_LABEL}>Case instructions</T>
              <T className="text-[13px] mt-0.5 leading-[20px]">{c.instructions}</T>
            </View>
            {(c.dispatch || c.receipt) && (
              <View className="rounded-2xl bg-go-surface border border-go-line px-3 py-2.5 mt-2">
                <T className={FACT_LABEL}>Courier and storage</T>
                {c.dispatch && <T className="text-[13px] mt-0.5">Sent: {c.dispatch.courier}{c.dispatch.tracking ? ` · ${c.dispatch.tracking}` : ''} · {c.dispatch.bags} bag{c.dispatch.bags > 1 ? 's' : ''}</T>}
                {c.receipt && <T className="text-[13px] mt-0.5">Received: stored in {c.receipt.storedIn}{c.receipt.comment ? ` · ${c.receipt.comment}` : ''}</T>}
              </View>
            )}
          </>
        )}

        {tab === 'activity' && (
          <Card className="p-4">
            <View>
              {[...c.events].reverse().map((e, i, arr) => (
                <View key={e.at + i} className={cx('flex-row gap-3', i < arr.length - 1 && 'pb-4')}>
                  {i < arr.length - 1 && <View className="absolute left-[5px] top-4 bottom-0 w-0.5 bg-go-line" />}
                  {i === 0
                    ? <View className="w-3 h-3 mt-1 flex-shrink-0 items-center justify-center"><View className="absolute w-5 h-5 rounded-full bg-go-brand/15" /><Grad className="w-3 h-3 rounded-full" /></View>
                    : <View className="w-3 h-3 rounded-full mt-1 flex-shrink-0 bg-go-line" />}
                  <View className="flex-1 min-w-0">
                    <T className="text-[13.5px] font-semibold">
                      {e.stage === 'authorised' ? 'Prescription authorised' : e.stage === 'note' ? e.text : STAGES[stageIndex(e.stage)].label}
                    </T>
                    <T className="text-[11.5px] text-go-muted">{fmtDateTime(e.at)} · {e.by}{e.text && e.stage !== 'note' ? ` · ${e.text}` : ''}</T>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {tab === 'messages' && <Messages c={c} />}

        {tab === 'files' && (
          c.attachments.length ? (
            <Grid2>
              {c.attachments.map(f => (
                <View key={f} className="rounded-2xl bg-go-surface border border-go-line p-3 aspect-[4/3] justify-between">
                  <View className="w-9 h-9 rounded-xl bg-go-raised items-center justify-center">
                    {/photo/i.test(f) ? <ImageIcon className="w-[18px] h-[18px] text-go-brand" /> : /pdf/i.test(f) ? <FileText className="w-[18px] h-[18px] text-go-violet" /> : <Paperclip className="w-[18px] h-[18px] text-go-muted" />}
                  </View>
                  <T className="text-[12.5px] font-medium leading-[17px] line-clamp-2">{f}</T>
                </View>
              ))}
            </Grid2>
          ) : <EmptyState icon={<Inbox className="w-7 h-7 text-go-muted" />} title="No files" />
        )}
      </View>

      <ChaseSheet c={c} open={chase} onClose={() => setChase(false)} />
      <ReceiveSheet c={c} open={receiveOpen} onClose={() => setReceiveOpen(false)} />
      <OrderStageSheet c={c} index={orderFor} onClose={() => setOrderFor(null)} />
    </Screen>
  );
}
