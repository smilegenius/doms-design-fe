// ─── Case documents — order form and files & scans ──────────────────────────
// Ported from the web prototype (screens/CaseDocs.tsx). The two buttons in a
// case's sticky bottom bar (a slim strip above the next-step action), and what
// they open:
//   • Order form — the case as the lab's Dental Order Form, laid out for a phone:
//     who and where, each service with its teeth and delivery, a staged service's
//     stage history, instructions and files.
//   • Files & scans — the 3D scan (upper / lower / both, zoom, full screen) and
//     every file on the case, scans and impressions first. Tapping a file opens it
//     full screen, with Download in the header and Back / Next through the files.
import { useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import {
  ChevronLeft, ChevronRight, Cube3D, Download, Expand, FileText, Image as ImageIcon, PackageCheck, Printer, RotateCcw, X, ZoomIn, ZoomOut,
} from '../components/icons';
import { useGo } from '../store/store';
import { useTheme } from '../theme/ThemeRoot';
import { cssVars } from '../theme/tokens';
import {
  LABS, LabCase, PRACTICES, StageLine, allItems, clinicianName, createdOn, dayOffset, fmtDate, labName, patientById, practiceName, stagedKindOf,
} from '../data/data';
import { BrandWordmark, Btn, Grad, Pill, Rows, Sheet, T, Tone, cx } from '../components/ui';
import { FakeCode } from './Logistics';

const MONO = { fontFamily: 'monospace' } as const;
const FACT_LABEL = 'text-[10.5px] uppercase tracking-[1px] font-semibold text-go-faint';
const SCAN_IMAGE = require('../../assets/teeth-3d.png');

// ─── Shared: a stage / phase line ────────────────────────────────────────────

/** Small pill (the web `!h-[22px] !px-2`). */
export const SmallPill = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => <Pill tone={tone} className="!h-[22px] !px-2">{children}</Pill>;

/** One stage / phase row: name, date and where it is. */
export function StageRow({ s, n }: { s: StageLine; n: number }) {
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

// ─── Files on a case ─────────────────────────────────────────────────────────

type FileKind = 'scan' | 'impression' | 'photo' | 'document';
const kindOf = (name: string): FileKind =>
  /scan/i.test(name) ? 'scan' : /impression|bite registration/i.test(name) ? 'impression' : /photo/i.test(name) ? 'photo' : 'document';
const KIND_LABEL: Record<FileKind, string> = { scan: '3D scan', impression: 'Sent by post', photo: 'Photo', document: 'Document' };
const KindIcon = ({ k }: { k: FileKind }) =>
  k === 'scan' ? <Cube3D className="w-[18px] h-[18px] text-go-violet" />
    : k === 'impression' ? <PackageCheck className="w-[18px] h-[18px] text-go-warn" />
    : k === 'photo' ? <ImageIcon className="w-[18px] h-[18px] text-go-brand" />
    : <FileText className="w-[18px] h-[18px] text-go-ink2" />;
/** Scans and impressions first, then everything else, each in the order it was added. */
const sortedFiles = (c: LabCase) => {
  const rank: Record<FileKind, number> = { scan: 0, impression: 1, photo: 2, document: 3 };
  return [...c.attachments].sort((a, b) => rank[kindOf(a)] - rank[kindOf(b)]);
};
/** Impressions travel by post: nothing to open. */
export const canOpen = (name: string) => kindOf(name) !== 'impression';

/** A file line. Tapping it opens the file (a scan opens the 3D viewer full screen). */
function FileRow({ name, onOpen }: { name: string; onOpen?: (name: string) => void }) {
  const k = kindOf(name);
  const body = (
    <>
      <View className="w-9 h-9 rounded-xl bg-go-raised items-center justify-center flex-shrink-0"><KindIcon k={k} /></View>
      <View className="flex-1 min-w-0">
        <T className="text-[13.5px] font-semibold truncate">{name}</T>
        <T className="text-[11.5px] text-go-muted">{KIND_LABEL[k]}</T>
      </View>
    </>
  );
  return onOpen && canOpen(name) ? (
    <Pressable onPress={() => onOpen(name)} accessibilityRole="button" accessibilityLabel={`Open ${name}`} className="flex-row items-center gap-3 py-2.5 active:opacity-90">
      {body}
      <ChevronRight className="w-4 h-4 text-go-faint" />
    </Pressable>
  ) : <View className="flex-row items-center gap-3 py-2.5">{body}</View>;
}

// ─── File viewer (full screen) ───────────────────────────────────────────────

/**
 * One file, full screen: a scan in the 3D viewer, a photo or a document as a preview. Download sits in the
 * header; Back / Next at the bottom step through the case's files (the ones that open), in the list's order.
 */
export function FileViewer({ c, name, onChange, onClose }: { c: LabCase; name: string | null; onChange: (name: string) => void; onClose: () => void }) {
  const { toast } = useGo();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const k = name ? kindOf(name) : 'document';
  const files = sortedFiles(c).filter(canOpen);
  const at = name ? files.indexOf(name) : -1;
  return (
    <Modal visible={!!name} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {!!name && (
        // A modal renders outside the app root (a portal on web), so the theme variables are set again here
        <View className="flex-1 bg-go-bg" style={[vars(cssVars(theme)), { paddingTop: insets.top }]}>
          <View className="flex-row items-center gap-2 px-3 h-14">
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" className="w-10 h-10 rounded-full bg-go-raised items-center justify-center">
              <X className="w-5 h-5 text-go-ink2" />
            </Pressable>
            <View className="flex-1 min-w-0 items-center">
              <T className="text-[15px] font-semibold truncate">{name}</T>
              <T className="text-[11px] text-go-muted truncate">{KIND_LABEL[k]} · {patientById(c.patientId).name}</T>
            </View>
            <Pressable onPress={() => toast(`Downloading ${name}`)} accessibilityRole="button" accessibilityLabel={`Download ${name}`}
              className="w-10 h-10 rounded-full bg-go-brand-soft items-center justify-center">
              <Download className="w-5 h-5 text-go-brand-ink" />
            </Pressable>
          </View>
          <View className="flex-1 px-4 pb-3">
            {k === 'scan' ? <ScanViewer full /> : (
              <View className="flex-1 items-center justify-center">
                {k === 'photo' ? <PhotoPreview name={name} /> : <DocumentPreview name={name} />}
              </View>
            )}
          </View>
          {files.length > 1 && (
            <View className="flex-row items-center gap-3 px-4 pt-3 border-t border-go-line bg-go-surface/90" style={{ paddingBottom: insets.bottom + 16 }}>
              <StepBtn dir="back" disabled={at <= 0} onPress={() => onChange(files[at - 1])} />
              <T className="flex-1 text-center text-[12.5px] font-semibold text-go-muted">{at + 1} of {files.length}</T>
              <StepBtn dir="next" disabled={at < 0 || at >= files.length - 1} onPress={() => onChange(files[at + 1])} />
            </View>
          )}
        </View>
      )}
    </Modal>
  );
}

function PhotoPreview({ name }: { name: string }) {
  const { c } = useTheme();
  return (
    <LinearGradient colors={[c['brand-soft'], c['violet-soft']]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      className="w-full max-w-[300px] aspect-[3/4] rounded-[22px] border border-go-line items-center justify-center gap-2" style={{ borderRadius: 22 }}>
      <ImageIcon className="w-12 h-12 text-go-brand" />
      <T className="text-[12.5px] font-semibold text-go-brand-ink">{name}</T>
    </LinearGradient>
  );
}

/** A document: a page with its title, the rest drawn as lines. */
function DocumentPreview({ name }: { name: string }) {
  return (
    <View className="w-full max-w-[300px] aspect-[0.707] rounded-2xl border border-go-line bg-go-surface p-5">
      <FileText className="w-6 h-6 text-go-violet" />
      <T className="text-[13px] font-semibold mt-2 truncate">{name}</T>
      <View className="mt-4 gap-2">
        {[92, 100, 84, 96, 70, 100, 88, 60].map((w, i) => <View key={i} className="h-2 rounded-full bg-go-line" style={{ width: `${w}%` }} />)}
      </View>
    </View>
  );
}

/** Back / Next in the file viewer: Next in the brand gradient, Back quiet. */
function StepBtn({ dir, disabled, onPress }: { dir: 'back' | 'next'; disabled: boolean; onPress: () => void }) {
  const next = dir === 'next';
  const inner = (
    <>
      {!next && <ChevronLeft className="w-4 h-4 text-go-ink2" />}
      <T className={cx('text-[13.5px] font-semibold', next ? 'text-white' : 'text-go-ink2')}>{next ? 'Next' : 'Back'}</T>
      {next && <ChevronRight className="w-4 h-4 text-white" />}
    </>
  );
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      className={cx('active:opacity-90', disabled && 'opacity-40')}>
      {next
        ? <Grad className="h-11 px-4 rounded-2xl flex-row items-center gap-1.5" style={{ borderRadius: 16 }}>{inner}</Grad>
        : <View className="h-11 px-4 rounded-2xl bg-go-raised flex-row items-center gap-1.5">{inner}</View>}
    </Pressable>
  );
}

// ─── The two buttons ─────────────────────────────────────────────────────────

/**
 * A floating capsule over the case, just above its bottom bar (designer, 30 Oct): a pill with the two buttons
 * (Screen's `floating`). The next step under it (Dispatch, Reply, Mark as received…) stays the one big gradient
 * button. compact = the page is scrolling down: the labels tuck away and only the round icons stay.
 * No blur natively, so the pill is a near-solid surface with a soft shadow.
 */
export function CaseDocBar({ c, compact = false }: { c: LabCase; compact?: boolean }) {
  const [open, setOpen] = useState<'form' | 'files' | null>(null);
  const { c: col, theme } = useTheme();
  return (
    <>
      <Animated.View layout={LinearTransition.duration(200)} className="flex-row items-center p-1 rounded-full bg-go-surface/95 border border-go-line"
        style={{ borderRadius: 999, shadowColor: col.shadow, shadowOpacity: theme === 'dark' ? 0.5 : 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
        <DocButton icon={<FileText className="w-4 h-4 text-white" />} label="Order form" compact={compact} onPress={() => setOpen('form')} />
        <View className="w-px h-5 mx-0.5 bg-go-line" />
        <DocButton icon={<Cube3D className="w-4 h-4 text-white" />} label="Files & scans" count={c.attachments.length} compact={compact} onPress={() => setOpen('files')} />
      </Animated.View>
      <OrderFormSheet c={c} open={open === 'form'} onClose={() => setOpen(null)} />
      <FilesScansSheet c={c} open={open === 'files'} onClose={() => setOpen(null)} />
    </>
  );
}

function DocButton({ icon, label, count, compact, onPress }: { icon: React.ReactNode; label: string; count?: number; compact: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={count ? `${label}, ${count}` : label}
      className={cx('h-9 rounded-full flex-row items-center active:opacity-80', compact ? 'px-0.5' : 'pl-1 pr-2.5')}>
      {/* The count rides on the icon, so it shows in the compact capsule too */}
      <View>
        <Grad className="w-8 h-8 rounded-full items-center justify-center" style={{ borderRadius: 999 }}>{icon}</Grad>
        {!!count && (
          <View className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-go-ink border-2 border-go-surface items-center justify-center">
            <T className="text-[9.5px] font-bold text-go-surface">{count}</T>
          </View>
        )}
      </View>
      {!compact && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} className="flex-row items-center gap-1 ml-2">
          <T className="text-[12.5px] font-semibold text-go-ink">{label}</T>
          <ChevronRight className="w-3.5 h-3.5 text-go-faint" />
        </Animated.View>
      )}
    </Pressable>
  );
}

// ─── Order form ──────────────────────────────────────────────────────────────

function OrderFormSheet({ c, open, onClose }: { c: LabCase; open: boolean; onClose: () => void }) {
  const { toast } = useGo();
  const p = patientById(c.patientId);
  const lab = LABS.find(l => l.id === c.lab);
  const practice = PRACTICES.find(x => x.id === c.practice);
  const items = allItems(c);
  const staged = items.map((it, i) => ({ it, i, kind: it.staged ?? (it.stages?.length ? stagedKindOf(it.service) : undefined) })).filter(x => x.kind);
  const receivedVia = c.caseSource ?? (c.source === 'photo' ? 'Photo of lab form' : 'Smile Genius Go');
  const created = createdOn(c);
  const tiles: [string, string, string?][] = [
    ['Patient', p.name, [`DOB ${p.dob}`, p.gender].filter(Boolean).join(' · ')],
    ['Dentist', clinicianName(c.clinician)],
    ['Practice', practiceName(c.practice), practice?.area],
    ['Lab', labName(c.lab), lab?.town],
    ['Ship to', practiceName(c.practice), practice?.area],
    ['Order type', c.funding],
  ];
  return (
    <Sheet open={open} onClose={onClose} tall title="Order form" sub={`${c.id} · ${p.name}`}
      footer={<Btn block icon={<Printer className="w-5 h-5 text-white" />} onPress={() => { toast('Order form sent to the printer'); onClose(); }}>Print order form</Btn>}>
      {/* Heading: whose form, which case, how it reached the lab */}
      <View className="rounded-[22px] bg-go-raised/60 border border-go-line p-3.5 flex-row items-start gap-3">
        <View className="flex-1 min-w-0">
          <BrandWordmark width={112} />
          <T className="text-[10.5px] uppercase tracking-[2px] font-bold text-go-faint mt-1">Dental order form</T>
          <T className="text-[12.5px] text-go-muted mt-2">Order ID <T className="text-[12.5px] font-semibold text-go-ink" style={MONO}>{c.id}</T></T>
          <T className="text-[12.5px] text-go-muted">Received via <T className="text-[12.5px] font-semibold text-go-ink">{receivedVia}</T></T>
        </View>
        {/* A printed code, so it stays dark on white in both themes */}
        <View className="items-center gap-1">
          <View className="p-1.5 rounded-xl" style={{ backgroundColor: '#FFFFFF' }}><FakeCode seed={c.id} size={52} /></View>
          <T className="text-[9.5px] text-go-faint">Scan to view case</T>
        </View>
      </View>

      {/* Who and where */}
      <View className="mt-2 gap-2">
        {[0, 2, 4].map(r => (
          <View key={r} className="flex-row gap-2">
            {tiles.slice(r, r + 2).map(([label, value, sub]) => (
              <View key={label} className="flex-1 min-w-0 rounded-2xl bg-go-surface border border-go-line px-3 py-2.5">
                <T className={FACT_LABEL}>{label}</T>
                <T className="text-[13px] font-medium mt-0.5 truncate">{value}</T>
                {!!sub && <T className="text-[11.5px] text-go-muted truncate">{sub}</T>}
              </View>
            ))}
          </View>
        ))}
      </View>

      <Block title={items.length === 1 ? `Service details · ${items[0].service}` : `Service details · ${items.length} services`}>
        {items.map((it, i) => (
          <View key={i} className="flex-row items-start gap-3 py-2.5">
            <Grad className="w-6 h-6 rounded-lg items-center justify-center mt-0.5" style={{ borderRadius: 8 }}>
              <T className="text-[11px] font-bold text-white">{i + 1}</T>
            </Grad>
            <View className="flex-1 min-w-0">
              <T className="text-[13.5px] font-semibold">{it.service} · {it.teeth.join(', ')}</T>
              <T className="text-[11.5px] text-go-muted mt-0.5">{[it.material, it.shade && `shade ${it.shade}`, it.extra].filter(Boolean).join(' · ') || '—'}</T>
            </View>
            <View className="items-end">
              <T className={FACT_LABEL}>Delivery</T>
              <T className="text-[12.5px] font-semibold text-go-ink2">
                {it.staged || it.stages?.length ? `Per ${it.staged === 'phase' ? 'phase' : 'stage'}` : it.returnBy ? fmtDate(it.returnBy) : 'Not set'}
              </T>
            </View>
          </View>
        ))}
      </Block>

      {staged.map(({ it, i, kind }) => (
        <Block key={i} title={`${kind === 'phase' ? 'Phase' : 'Stage'} history${items.length > 1 ? ` · ${it.service}` : ''}`}>
          {(it.stages ?? []).length
            ? (it.stages ?? []).map((s, j) => <StageRow key={s.name} s={s} n={j + 1} />)
            : <T className="py-2.5 text-[12.5px] text-go-muted">No {kind === 'phase' ? 'phases' : 'stages'} ordered yet.</T>}
        </Block>
      ))}

      <Block title="Case instructions">
        <T className={cx('py-2.5 text-[13px] leading-[20px]', c.instructions ? 'text-go-ink' : 'text-go-muted')}>{c.instructions || 'No instructions on this case.'}</T>
      </Block>

      <Block title={`Files · ${c.attachments.length}`}>
        {c.attachments.length ? sortedFiles(c).map(f => <FileRow key={f} name={f} />) : <T className="py-2.5 text-[12.5px] text-go-muted">No files on this case.</T>}
      </Block>

      <T className="text-[11.5px] text-go-faint mt-3 px-1">Created by {c.createdBy}{created ? ` on ${fmtDate(created)}` : ''}</T>
    </Sheet>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-3">
      <T className={cx(FACT_LABEL, 'px-1 mb-1')}>{title}</T>
      <Rows className="rounded-2xl bg-go-surface border border-go-line px-3">{children}</Rows>
    </View>
  );
}

// ─── Files & scans ───────────────────────────────────────────────────────────

function FilesScansSheet({ c, open, onClose }: { c: LabCase; open: boolean; onClose: () => void }) {
  const { toast } = useGo();
  const files = sortedFiles(c);
  const n = files.length;
  const [view, setView] = useState<string | null>(null);
  const scan = files.find(f => kindOf(f) === 'scan');
  return (
    <Sheet open={open} onClose={onClose} tall title="Files & scans" sub={`${c.id} · ${patientById(c.patientId).name}`}
      footer={n > 0 ? <Btn block variant="secondary" onPress={() => { toast(`Downloading ${n} file${n === 1 ? '' : 's'}`); onClose(); }}>Download all</Btn> : undefined}>
      <FileViewer c={c} name={open ? view : null} onChange={setView} onClose={() => setView(null)} />
      {scan ? <ScanViewer onExpand={() => setView(scan)} /> : (
        <View className="h-[150px] rounded-[22px] border border-dashed border-go-line bg-go-raised/50 items-center justify-center px-6">
          <Cube3D className="w-7 h-7 text-go-faint" />
          <T className="text-[13.5px] font-semibold mt-2 text-center">No 3D scan on this case</T>
          <T className="text-[12px] text-go-muted mt-0.5 text-center">{c.attachments.some(f => kindOf(f) === 'impression') ? 'The impressions go to the lab by post.' : 'Add a scan from the web portal.'}</T>
        </View>
      )}
      <Block title={`Files · ${n}`}>
        {n ? files.map(f => <FileRow key={f} name={f} onOpen={setView} />) : <T className="py-2.5 text-[12.5px] text-go-muted">No files on this case.</T>}
      </Block>
    </Sheet>
  );
}

type Jaw = 'both' | 'upper' | 'lower';

/**
 * The 3D scan: upper, lower or both, with zoom in / out and reset. `full` fills the screen; `onExpand` offers full
 * screen. One jaw: RN has no clip-path, so the image sits in a half-height frame in the middle, shifted to show that half.
 */
function ScanViewer({ full, onExpand }: { full?: boolean; onExpand?: () => void }) {
  const [jaw, setJaw] = useState<Jaw>('both');
  const [zoom, setZoom] = useState(1);
  const [h, setH] = useState(250);
  return (
    <View className={cx('rounded-[22px] overflow-hidden border border-go-line bg-go-raised', full ? 'flex-1' : 'h-[250px]')}
      onLayout={e => setH(e.nativeEvent.layout.height)}>
      {jaw === 'both' ? (
        <Image source={SCAN_IMAGE} resizeMode="contain" accessibilityLabel="3D scan of the patient's teeth"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h, width: '100%', transform: [{ scale: zoom }] }} />
      ) : (
        <View style={{ position: 'absolute', left: 0, right: 0, top: h / 4, height: h / 2, overflow: 'hidden', transform: [{ scale: zoom }] }}>
          <Image source={SCAN_IMAGE} resizeMode="contain" accessibilityLabel={`3D scan, ${jaw} jaw`}
            style={{ position: 'absolute', left: 0, right: 0, width: '100%', height: h, top: jaw === 'lower' ? -h / 2 : 0 }} />
        </View>
      )}
      <View className="absolute top-2.5 left-2.5 flex-row p-0.5 rounded-full bg-go-surface/90 border border-go-line">
        {(['both', 'upper', 'lower'] as Jaw[]).map(j => (
          <Pressable key={j} onPress={() => setJaw(j)} accessibilityRole="button" accessibilityState={{ selected: jaw === j }}>
            {jaw === j
              ? <Grad className="h-7 px-2.5 rounded-full items-center justify-center" style={{ borderRadius: 999 }}><T className="text-[11.5px] font-semibold text-white capitalize">{j}</T></Grad>
              : <View className="h-7 px-2.5 items-center justify-center"><T className="text-[11.5px] font-semibold text-go-muted capitalize">{j}</T></View>}
          </Pressable>
        ))}
      </View>
      {onExpand ? (
        <Pressable onPress={onExpand} accessibilityRole="button" accessibilityLabel="Full screen"
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-go-surface/90 border border-go-line items-center justify-center active:opacity-90">
          <Expand className="w-4 h-4 text-go-ink2" />
        </Pressable>
      ) : <View className="absolute top-3 right-3"><SmallPill tone="violet">3D</SmallPill></View>}
      <View className="absolute bottom-2.5 left-0 right-0 items-center">
        <View className="flex-row items-center gap-0.5 p-1 rounded-full bg-go-surface/90 border border-go-line">
          <ViewerBtn label="Zoom out" onPress={() => setZoom(z => Math.max(0.6, +(z - 0.2).toFixed(1)))}><ZoomOut className="w-4 h-4 text-go-ink2" /></ViewerBtn>
          <T className="w-10 text-center text-[11px] font-semibold text-go-ink2">{Math.round(zoom * 100)}%</T>
          <ViewerBtn label="Zoom in" onPress={() => setZoom(z => Math.min(2, +(z + 0.2).toFixed(1)))}><ZoomIn className="w-4 h-4 text-go-ink2" /></ViewerBtn>
          <ViewerBtn label="Reset view" onPress={() => { setZoom(1); setJaw('both'); }}><RotateCcw className="w-4 h-4 text-go-ink2" /></ViewerBtn>
        </View>
      </View>
    </View>
  );
}

const ViewerBtn = ({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className="w-8 h-8 rounded-full items-center justify-center active:opacity-90">{children}</Pressable>
);
