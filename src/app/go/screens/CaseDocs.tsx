// ─── Case documents — order form and files & scans ──────────────────────────
// The two buttons in a case's sticky bottom bar (a slim row above the next-step action), and the sheets they open:
//   • Order form — the case as the lab's Dental Order Form (the web portal's new
//     sheet, laid out for a phone): who and where, each service with its teeth
//     and delivery, a staged service's stage history, instructions and files.
//   • Files & scans — the 3D scan (upper / lower / both, zoom) and every file
//     on the case, scans and impressions first.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Cube3D, Download, Expand, FileText, Image as ImageIcon, PackageCheck, Printer, RotateCcw, X, ZoomIn, ZoomOut } from '../icons';
import { useGo } from '../store';
import {
  LABS, LabCase, PRACTICES, StageLine, allItems, clinicianName, createdOn, dayOffset, fmtDate, labName, patientById, practiceName, stagedKindOf,
} from '../data';
import { FakeQr } from '../../components/DispatchLabel';
import { BrandWordmark, Btn, Pill, Sheet, TeethChips, cx } from '../ui';

// ─── Shared: a stage / phase line ────────────────────────────────────────────

/** One stage or phase of a staged service, with Done earlier / Received / Late / Due. */
export function StageRow({ s, n }: { s: StageLine; n: number }) {
  const late = !s.state && !!s.date && dayOffset(s.date) < 0;
  const tag = s.state === 'done-earlier' ? <Pill tone="neutral" className="!h-[22px] !px-2">Done earlier</Pill>
    : s.state === 'received' ? <Pill tone="ok" className="!h-[22px] !px-2">Received</Pill>
    : late ? <Pill tone="bad" className="!h-[22px] !px-2">Late</Pill>
    : <Pill tone="brand" className="!h-[22px] !px-2">{s.date ? 'Due' : 'No date'}</Pill>;
  return (
    <div className="flex items-center gap-2.5 py-2">
      <span className={cx('w-5 h-5 rounded-md text-[10.5px] font-bold flex items-center justify-center flex-shrink-0',
        s.state ? 'bg-go-raised text-go-faint' : 'bg-go-violet-soft text-go-violet')}>{n}</span>
      <span className="flex-1 min-w-0">
        <span className={cx('block text-[13px] font-semibold truncate', s.state ? 'text-go-muted' : 'text-go-ink')}>{s.name}</span>
        <span className="block text-[11.5px] text-go-muted">{s.date ? fmtDate(s.date) : s.state === 'done-earlier' ? 'Done elsewhere' : 'Date not set'}{s.orderedAt ? ` · ordered ${fmtDate(s.orderedAt)}` : ''}</span>
      </span>
      {tag}
    </div>
  );
}

// ─── Files on a case ─────────────────────────────────────────────────────────

type FileKind = 'scan' | 'impression' | 'photo' | 'document';
const kindOf = (name: string): FileKind =>
  /scan/i.test(name) ? 'scan' : /impression|bite registration/i.test(name) ? 'impression' : /photo/i.test(name) ? 'photo' : 'document';
const KIND_LABEL: Record<FileKind, string> = { scan: '3D scan', impression: 'Sent by post', photo: 'Photo', document: 'Document' };
const KIND_ICON: Record<FileKind, React.ReactNode> = {
  scan: <Cube3D className="w-[18px] h-[18px] text-go-violet" />,
  impression: <PackageCheck className="w-[18px] h-[18px] text-go-warn" />,
  photo: <ImageIcon className="w-[18px] h-[18px] text-go-brand" />,
  document: <FileText className="w-[18px] h-[18px] text-go-ink2" />,
};
/** Scans and impressions first, then everything else, each in the order it was added. */
const sortedFiles = (c: LabCase) => {
  const rank: Record<FileKind, number> = { scan: 0, impression: 1, photo: 2, document: 3 };
  return [...c.attachments].sort((a, b) => rank[kindOf(a)] - rank[kindOf(b)]);
};
const hasScan = (c: LabCase) => c.attachments.some(f => kindOf(f) === 'scan');

/** Impressions travel by post: nothing to open. */
export const canOpen = (name: string) => kindOf(name) !== 'impression';

/** A file line. Tapping it opens the file (a scan opens the 3D viewer full screen). */
function FileRow({ name, onOpen }: { name: string; onOpen?: (name: string) => void }) {
  const k = kindOf(name);
  const open = onOpen && canOpen(name);
  const body = (
    <>
      <span className="w-9 h-9 rounded-xl bg-go-raised flex items-center justify-center flex-shrink-0">{KIND_ICON[k]}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-semibold text-go-ink truncate">{name}</span>
        <span className="block text-[11.5px] text-go-muted">{KIND_LABEL[k]}</span>
      </span>
    </>
  );
  return open ? (
    <button onClick={() => onOpen(name)} className="w-full flex items-center gap-3 py-2.5 text-left active:opacity-90">
      {body}
      <ChevronRight className="w-4 h-4 text-go-faint flex-shrink-0" />
    </button>
  ) : <div className="flex items-center gap-3 py-2.5">{body}</div>;
}

/** Full-screen layer inside the phone, over any open sheet. Esc closes only this layer. */
function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const { sheetRoot } = useGo();
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onClose]);
  if (!sheetRoot) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" className="absolute inset-0 z-[60] flex flex-col bg-go-bg sm:pt-[50px] go-fade-in">{children}</div>,
    sheetRoot,
  );
}

/**
 * One file, full screen: a scan in the 3D viewer, a photo or a document as a preview. Download sits in the
 * header; Back / Next at the bottom step through the case's files (the ones that open), in the list's order.
 */
export function FileViewer({ c, name, onChange, onClose }: { c: LabCase; name: string | null; onChange: (name: string) => void; onClose: () => void }) {
  const { toast } = useGo();
  if (!name) return null;
  const k = kindOf(name);
  const files = sortedFiles(c).filter(canOpen);
  const at = files.indexOf(name);
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center gap-2 px-3 h-14 flex-shrink-0">
        <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-go-raised text-go-ink2 flex items-center justify-center flex-shrink-0">
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-[15px] font-semibold text-go-ink truncate">{name}</p>
          <p className="text-[11px] text-go-muted truncate">{KIND_LABEL[k]} · {patientById(c.patientId).name}</p>
        </div>
        <button onClick={() => toast(`Downloading ${name}`)} aria-label={`Download ${name}`} className="w-10 h-10 rounded-full bg-go-brand-soft text-go-brand-ink flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 px-4 pb-3 flex flex-col">
        {k === 'scan' ? <ScanViewer full /> : (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            {k === 'photo' ? (
              <div className="w-full max-w-[300px] aspect-[3/4] rounded-[22px] border border-go-line bg-gradient-to-br from-go-brand-soft to-go-violet-soft flex flex-col items-center justify-center gap-2">
                <ImageIcon className="w-12 h-12 text-go-brand" />
                <p className="text-[12.5px] font-semibold text-go-brand-ink">{name}</p>
              </div>
            ) : (
              // A document: a page with its title, the rest drawn as lines
              <div className="w-full max-w-[300px] aspect-[1/1.414] rounded-2xl border border-go-line bg-go-surface go-card-shadow p-5 flex flex-col">
                <FileText className="w-6 h-6 text-go-violet" />
                <p className="text-[13px] font-semibold text-go-ink mt-2 truncate">{name}</p>
                <div className="mt-4 space-y-2">
                  {[92, 100, 84, 96, 70, 100, 88, 60].map((w, i) => <div key={i} className="h-2 rounded-full bg-go-line" style={{ width: `${w}%` }} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {files.length > 1 && (
        <div className="px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-go-line bg-go-surface/90 flex items-center gap-3">
          <StepBtn dir="back" disabled={at <= 0} onClick={() => onChange(files[at - 1])} />
          <p className="flex-1 text-center text-[12.5px] font-semibold text-go-muted tabular-nums">{at + 1} of {files.length}</p>
          <StepBtn dir="next" disabled={at < 0 || at >= files.length - 1} onClick={() => onChange(files[at + 1])} />
        </div>
      )}
    </Overlay>
  );
}

/** Back / Next in the file viewer: Next in the brand gradient, Back quiet. */
function StepBtn({ dir, disabled, onClick }: { dir: 'back' | 'next'; disabled: boolean; onClick: () => void }) {
  const next = dir === 'next';
  return (
    <button onClick={onClick} disabled={disabled}
      className={cx('h-11 px-4 rounded-2xl inline-flex items-center gap-1.5 text-[13.5px] font-semibold active:opacity-90 disabled:opacity-40',
        next ? 'go-grad text-white' : 'bg-go-raised text-go-ink2')}>
      {!next && <ChevronLeft className="w-4 h-4" />}
      {next ? 'Next' : 'Back'}
      {next && <ChevronRight className="w-4 h-4" />}
    </button>
  );
}

// ─── The two buttons ─────────────────────────────────────────────────────────

/**
 * A floating capsule over the case, just above its bottom bar (designer, 30 Oct): a frosted pill with the two
 * buttons. The next step under it (Dispatch, Reply, Mark as received…) stays the one big gradient button.
 * compact = the page is scrolling down: the labels tuck away and only the round icons stay.
 */
export function CaseDocBar({ c, compact = false }: { c: LabCase; compact?: boolean }) {
  const [open, setOpen] = useState<'form' | 'files' | null>(null);
  const files = c.attachments.length;
  return (
    <>
      <div className="flex items-center p-1 rounded-full bg-go-surface/85 backdrop-blur-xl border border-go-line shadow-[0_12px_32px_-10px_rgb(var(--go-shadow)/0.38)] go-rise">
        <DocButton icon={<FileText className="w-4 h-4" />} label="Order form" compact={compact} onClick={() => setOpen('form')} />
        <span className="w-px h-5 mx-0.5 bg-go-line" aria-hidden />
        <DocButton icon={<Cube3D className="w-4 h-4" />} label="Files & scans" count={files} compact={compact} onClick={() => setOpen('files')} />
      </div>
      <OrderFormSheet c={c} open={open === 'form'} onClose={() => setOpen(null)} />
      <FilesScansSheet c={c} open={open === 'files'} onClose={() => setOpen(null)} />
    </>
  );
}

function DocButton({ icon, label, count, compact, onClick }: { icon: React.ReactNode; label: string; count?: number; compact: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={count ? `${label}, ${count}` : label}
      className={cx('h-9 rounded-full inline-flex items-center text-[12.5px] font-semibold text-go-ink hover:bg-go-raised active:scale-[.97] transition-all duration-200', compact ? 'px-0.5' : 'pl-1 pr-2.5')}>
      {/* The count rides on the icon, so it shows in the compact capsule too */}
      <span className="relative w-8 h-8 rounded-full go-grad text-white flex items-center justify-center flex-shrink-0">
        {icon}
        {!!count && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-go-ink text-go-surface text-[9.5px] font-bold flex items-center justify-center ring-2 ring-go-surface">{count}</span>}
      </span>
      <span className={cx('inline-flex items-center gap-1 overflow-hidden whitespace-nowrap transition-all duration-200', compact ? 'max-w-0 opacity-0' : 'max-w-[140px] opacity-100 ml-2')}>
        {label}<ChevronRight className="w-3.5 h-3.5 text-go-faint" />
      </span>
    </button>
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
  return (
    <Sheet open={open} onClose={onClose} tall title="Order form" sub={`${c.id} · ${p.name}`}
      footer={<Btn block icon={<Printer className="w-5 h-5" />} onClick={() => { toast('Order form sent to the printer'); onClose(); }}>Print order form</Btn>}>
      {/* Heading: whose form, which case, how it reached the lab */}
      <div className="rounded-[22px] bg-go-raised/60 border border-go-line p-3.5 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <BrandWordmark width={112} />
          <p className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-go-faint mt-1">Dental order form</p>
          <p className="text-[12.5px] text-go-muted mt-2">Order ID <span className="font-mono font-semibold text-go-ink">{c.id}</span></p>
          <p className="text-[12.5px] text-go-muted">Received via <span className="font-semibold text-go-ink">{receivedVia}</span></p>
        </div>
        {/* A printed code, so it stays dark on white in both themes */}
        <span className="flex flex-col items-center gap-1 flex-shrink-0">
          <span className="p-1.5 rounded-xl bg-white"><FakeQr seed={c.id} size={52} /></span>
          <span className="text-[9.5px] text-go-faint">Scan to view case</span>
        </span>
      </div>

      {/* Who and where */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Tile label="Patient" value={p.name} sub={[`DOB ${p.dob}`, p.gender].filter(Boolean).join(' · ')} />
        <Tile label="Dentist" value={clinicianName(c.clinician)} />
        <Tile label="Practice" value={practiceName(c.practice)} sub={practice?.area} />
        <Tile label="Lab" value={labName(c.lab)} sub={lab?.town} />
        <Tile label="Ship to" value={practiceName(c.practice)} sub={practice?.area} />
        <Tile label="Order type" value={c.funding} />
      </div>

      <Block title={items.length === 1 ? `Service details · ${items[0].service}` : `Service details · ${items.length} services`}>
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-3 py-2.5">
            <span className="w-6 h-6 rounded-lg go-grad text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] font-semibold text-go-ink">{it.service} · <TeethChips teeth={it.teeth} /></span>
              <span className="block text-[11.5px] text-go-muted mt-0.5">{[it.material, it.shade && `shade ${it.shade}`, it.extra].filter(Boolean).join(' · ') || '—'}</span>
            </span>
            <span className="text-right flex-shrink-0">
              <span className="block text-[10.5px] uppercase tracking-wider font-semibold text-go-faint">Delivery</span>
              <span className="block text-[12.5px] font-semibold text-go-ink2">
                {it.staged || it.stages?.length ? `Per ${it.staged === 'phase' ? 'phase' : 'stage'}` : it.returnBy ? fmtDate(it.returnBy) : 'Not set'}
              </span>
            </span>
          </div>
        ))}
      </Block>

      {staged.map(({ it, i, kind }) => (
        <Block key={i} title={`${kind === 'phase' ? 'Phase' : 'Stage'} history${items.length > 1 ? ` · ${it.service}` : ''}`}>
          {(it.stages ?? []).length
            ? (it.stages ?? []).map((s, j) => <StageRow key={s.name} s={s} n={j + 1} />)
            : <p className="py-2.5 text-[12.5px] text-go-muted">No {kind === 'phase' ? 'phases' : 'stages'} ordered yet.</p>}
        </Block>
      ))}

      <Block title="Case instructions">
        <p className={cx('py-2.5 text-[13px] leading-relaxed', c.instructions ? 'text-go-ink' : 'text-go-muted')}>{c.instructions || 'No instructions on this case.'}</p>
      </Block>

      <Block title={`Files · ${c.attachments.length}`}>
        {c.attachments.length ? sortedFiles(c).map(f => <FileRow key={f} name={f} />) : <p className="py-2.5 text-[12.5px] text-go-muted">No files on this case.</p>}
      </Block>

      <p className="text-[11.5px] text-go-faint mt-3 px-1">Created by {c.createdBy}{created ? ` on ${fmtDate(created)}` : ''}</p>
    </Sheet>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-go-surface border border-go-line px-3 py-2.5 min-w-0">
      <p className="text-[10.5px] uppercase tracking-wider font-semibold text-go-faint">{label}</p>
      <p className="text-[13px] font-medium text-go-ink mt-0.5 truncate">{value}</p>
      {sub && <p className="text-[11.5px] text-go-muted truncate">{sub}</p>}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3">
      <p className="text-[10.5px] uppercase tracking-wider font-semibold text-go-faint px-1 mb-1">{title}</p>
      <div className="rounded-2xl bg-go-surface border border-go-line px-3 divide-y divide-go-line">{children}</div>
    </section>
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
      footer={n > 0 ? <Btn block variant="secondary" onClick={() => { toast(`Downloading ${n} file${n === 1 ? '' : 's'}`); onClose(); }}>Download all</Btn> : undefined}>
      <FileViewer c={c} name={open ? view : null} onChange={setView} onClose={() => setView(null)} />
      {scan ? <ScanViewer onExpand={() => setView(scan)} /> : (
        <div className="h-[150px] rounded-[22px] border border-dashed border-go-line bg-go-raised/50 flex flex-col items-center justify-center text-center px-6">
          <Cube3D className="w-7 h-7 text-go-faint" />
          <p className="text-[13.5px] font-semibold text-go-ink mt-2">No 3D scan on this case</p>
          <p className="text-[12px] text-go-muted mt-0.5">{c.attachments.some(f => kindOf(f) === 'impression') ? 'The impressions go to the lab by post.' : 'Add a scan from the web portal.'}</p>
        </div>
      )}
      <Block title={`Files · ${n}`}>
        {n ? files.map(f => <FileRow key={f} name={f} onOpen={setView} />) : <p className="py-2.5 text-[12.5px] text-go-muted">No files on this case.</p>}
      </Block>
    </Sheet>
  );
}

type Jaw = 'both' | 'upper' | 'lower';

/** The 3D scan: upper, lower or both, with zoom in / out and reset. `full` fills the screen; `onExpand` offers full screen. */
function ScanViewer({ full, onExpand }: { full?: boolean; onExpand?: () => void }) {
  const [jaw, setJaw] = useState<Jaw>('both');
  const [zoom, setZoom] = useState(1);
  const clip = jaw === 'upper' ? 'inset(0 0 50% 0)' : jaw === 'lower' ? 'inset(50% 0 0 0)' : undefined;
  // One jaw is half the model: move it to the middle of the frame.
  const shift = jaw === 'upper' ? 'translateY(22%) ' : jaw === 'lower' ? 'translateY(-22%) ' : '';
  return (
    <div className={cx('relative rounded-[22px] overflow-hidden border border-go-line bg-go-raised', full ? 'flex-1 min-h-0' : 'h-[250px]')}>
      <img src="/teeth-3d.png" alt="3D scan of the patient's teeth" draggable={false}
        className="absolute inset-0 w-full h-full object-contain transition-transform duration-300 select-none"
        style={{ transform: `${shift}scale(${zoom})`, clipPath: clip }} />
      <div className="absolute top-2.5 left-2.5 inline-flex p-0.5 rounded-full bg-go-surface/90 border border-go-line">
        {(['both', 'upper', 'lower'] as Jaw[]).map(j => (
          <button key={j} onClick={() => setJaw(j)} aria-pressed={jaw === j}
            className={cx('h-7 px-2.5 rounded-full text-[11.5px] font-semibold capitalize transition', jaw === j ? 'go-grad text-white' : 'text-go-muted')}>
            {j}
          </button>
        ))}
      </div>
      {onExpand ? (
        <button onClick={onExpand} aria-label="Full screen" className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-go-surface/90 border border-go-line text-go-ink2 flex items-center justify-center active:opacity-90">
          <Expand className="w-4 h-4" />
        </button>
      ) : <Pill tone="violet" className="absolute top-3 right-3 !h-[22px] !px-2">3D</Pill>}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-0.5 p-1 rounded-full bg-go-surface/90 border border-go-line">
        <ViewerBtn label="Zoom out" onClick={() => setZoom(z => Math.max(0.6, +(z - 0.2).toFixed(1)))}><ZoomOut className="w-4 h-4" /></ViewerBtn>
        <span className="w-10 text-center text-[11px] font-semibold text-go-ink2 tabular-nums">{Math.round(zoom * 100)}%</span>
        <ViewerBtn label="Zoom in" onClick={() => setZoom(z => Math.min(2, +(z + 0.2).toFixed(1)))}><ZoomIn className="w-4 h-4" /></ViewerBtn>
        <ViewerBtn label="Reset view" onClick={() => { setZoom(1); setJaw('both'); }}><RotateCcw className="w-4 h-4" /></ViewerBtn>
      </div>
    </div>
  );
}

const ViewerBtn = ({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} aria-label={label} className="w-8 h-8 rounded-full text-go-ink2 flex items-center justify-center active:opacity-90 hover:bg-go-raised">{children}</button>
);
