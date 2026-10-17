import { ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2, Printer, Settings2 } from 'lucide-react';
import Button from '../../src/app/components/Button';
import Modal from '../../src/app/components/Modal';
import { useToast } from '../../src/app/context/ToastContext';
import type { Case } from '../../src/app/pages/CasesPage';
import { parseCaseDate } from '../../src/app/data/rescanDetection';
import { allCases, estimate, originalForms, zipEntriesFor } from './caseContent';
import {
  BulkDefaults, GROUPING_LABELS, INCLUDE_LABELS, IncludeKey, NAMING_LABELS, NO_ORIGINAL_LABELS, ORDER_LABELS,
  saveBulkDefaults, useBulkDefaults, WHICH_LABELS,
} from './bulkDefaults';
import { printPages, SgOrderFormPrint } from './printForms';
import { buildZip, saveBlob } from './zip';

// ── Download and Print, for the ticked cases only ────────────────────────────
// Both open with the lab user's saved choices (Settings → Bulk Actions) and
// save back when "Remember these choices" is on.

const mb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const pl = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function casesFor(ids: string[]): Case[] {
  const all = allCases();
  return ids.map(id => all.find(c => c.id === id)).filter((c): c is Case => !!c);
}

function SavedNote({ saved }: { saved: boolean }) {
  const navigate = useNavigate();
  return (
    <p className="text-[11px] text-[#717182] flex items-center gap-1">
      <Settings2 className="w-3 h-3" /> {saved ? 'Using your saved choices' : 'Default choices'} ·{' '}
      <button onClick={() => navigate('/growth/settings?tab=bulk-actions')} className="text-[#4D8EF7] font-medium hover:underline">Change defaults</button>
    </p>
  );
}

function CaseList({ cases }: { cases: Case[] }) {
  return (
    <div className="rounded-xl border border-[#E0E0E6] divide-y divide-[#F0EFF6] max-h-40 overflow-y-auto">
      {cases.map(c => (
        <div key={c.id} className="flex items-center gap-3 px-3 py-1.5">
          <span className="font-mono text-[11px] font-semibold text-[#030213] w-32 flex-shrink-0 truncate">{c.id}</span>
          <span className="text-xs text-[#5A5568] truncate">{c.patientName} · {c.services.join(', ')} · {c.practice || 'no practice'}</span>
        </div>
      ))}
    </div>
  );
}

const Radio = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${on ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0] font-semibold' : 'border-[#E0E0E6] bg-white text-[#5A5568] hover:border-[#C8D8FC]'}`}>{children}</button>
);

export function DownloadDialog({ ids, user, onClose }: { ids: string[]; user: string; onClose: () => void }) {
  const { toast } = useToast();
  const defaults = useBulkDefaults(user);
  const cases = useMemo(() => casesFor(ids), [ids.join()]);
  const [opts, setOpts] = useState<BulkDefaults['download']>(defaults.download);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const est = estimate(cases, opts.include);
  const toggle = (k: IncludeKey) => setOpts(o => ({ ...o, include: { ...o.include, [k]: !o.include[k] } }));

  async function run() {
    if (remember) saveBulkDefaults(user, 'download', opts);
    setBusy('Collecting files…');
    const groups = opts.grouping === 'per-practice'
      ? [...new Set(cases.map(c => c.practice || 'No practice'))].map(p => ({ name: p, cases: cases.filter(c => (c.practice || 'No practice') === p) }))
      : [{ name: '', cases }];
    let total = 0;
    for (const g of groups) {
      const entries = (await Promise.all(g.cases.map(c => zipEntriesFor(c, opts.include, opts.naming)))).flat();
      const zip = await buildZip(entries, (d, t) => setBusy(`Zipping ${d} of ${t}…`));
      saveBlob(zip, `smile-genius-cases${g.name ? `_${g.name.replace(/[^\w-]+/g, '-')}` : ''}_${new Date().toISOString().slice(0, 10)}.zip`);
      total += entries.length;
    }
    setBusy(null);
    toast.success(`${pl(cases.length, 'case')} · ${pl(total, 'file')} in ${pl(groups.length, 'ZIP')}`);
    onClose();
  }

  return (
    <Modal isOpen onClose={onClose} size="lg" title={`Download files · ${pl(cases.length, 'case')}`} footer={
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-1.5 text-xs text-[#030213]"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember these choices</label>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!cases.length || !!busy || !est.files} icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} onClick={run}>
            {busy ?? `Download ${pl(est.files, 'file')} · about ${mb(est.bytes)}`}
          </Button>
        </div>
      </div>
    }>
      <div className="space-y-4">
        <SavedNote saved={defaults.saved.download} />
        <CaseList cases={cases} />
        <div>
          <p className="text-xs font-semibold text-[#030213] mb-1.5">Include</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(INCLUDE_LABELS) as IncludeKey[]).map(k => (
              <label key={k} className="inline-flex items-center gap-2 text-xs text-[#030213]"><input type="checkbox" checked={opts.include[k]} onChange={() => toggle(k)} /> {INCLUDE_LABELS[k]}</label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-[#030213] mb-1.5">Folder names</p>
            <div className="flex flex-col gap-1.5">{(Object.keys(NAMING_LABELS) as BulkDefaults['download']['naming'][]).map(k => <Radio key={k} on={opts.naming === k} onClick={() => setOpts(o => ({ ...o, naming: k }))}>{NAMING_LABELS[k]}</Radio>)}</div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#030213] mb-1.5">ZIP files</p>
            <div className="flex flex-col gap-1.5">{(Object.keys(GROUPING_LABELS) as BulkDefaults['download']['grouping'][]).map(k => <Radio key={k} on={opts.grouping === k} onClick={() => setOpts(o => ({ ...o, grouping: k }))}>{GROUPING_LABELS[k]}</Radio>)}</div>
          </div>
        </div>
        <p className="text-[11px] text-[#A0A0B0]">Scanner files that live on the scanner portal aren't in the download; the file list says which.</p>
      </div>
    </Modal>
  );
}

export function PrintDialog({ ids, user, onClose }: { ids: string[]; user: string; onClose: () => void }) {
  const { toast } = useToast();
  const defaults = useBulkDefaults(user);
  const cases = useMemo(() => casesFor(ids), [ids.join()]);
  const [opts, setOpts] = useState<BulkDefaults['print']>(defaults.print);
  const [remember, setRemember] = useState(true);
  const noOriginal = cases.filter(c => !originalForms(c).length);

  function run() {
    if (remember) saveBulkDefaults(user, 'print', opts);
    const ordered = [...cases];
    if (opts.order === 'id') ordered.sort((a, b) => a.id.localeCompare(b.id));
    if (opts.order === 'practice') ordered.sort((a, b) => a.practice.localeCompare(b.practice));
    if (opts.order === 'delivery') ordered.sort((a, b) => (a.requestedDelivery ? parseCaseDate(a.requestedDelivery).getTime() : Infinity) - (b.requestedDelivery ? parseCaseDate(b.requestedDelivery).getTime() : Infinity));
    const pages = ordered.flatMap(c => {
      const sg = { key: `${c.id}-sg`, node: <SgOrderFormPrint c={c} /> };
      const originals = originalForms(c).map((o, i) => ({ key: `${c.id}-o${i}`, node: o.node }));
      if (opts.which === 'sg') return [sg];
      if (opts.which === 'both') return [sg, ...originals];
      return originals.length ? originals : opts.noOriginal === 'sg-instead' ? [sg] : [];
    });
    if (!pages.length) { toast.error('Nothing to print with these choices'); return; }
    if (!printPages(pages, `Order forms · ${pl(cases.length, 'case')}`)) { toast.error('Allow pop-ups to print'); return; }
    toast.success(`${pl(pages.length, 'page')} ready to print`);
    onClose();
  }

  return (
    <Modal isOpen onClose={onClose} title={`Print order forms · ${pl(cases.length, 'case')}`} footer={
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-1.5 text-xs text-[#030213]"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember these choices</label>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button icon={<Printer className="w-4 h-4" />} disabled={!cases.length} onClick={run}>Print</Button>
        </div>
      </div>
    }>
      <div className="space-y-4">
        <SavedNote saved={defaults.saved.print} />
        <CaseList cases={cases} />
        <div>
          <p className="text-xs font-semibold text-[#030213] mb-1.5">Which order form?</p>
          <div className="flex flex-col gap-1.5">{(Object.keys(WHICH_LABELS) as BulkDefaults['print']['which'][]).map(k => <Radio key={k} on={opts.which === k} onClick={() => setOpts(o => ({ ...o, which: k }))}>{WHICH_LABELS[k]}</Radio>)}</div>
        </div>
        {opts.which === 'original' && noOriginal.length > 0 && (
          <div>
            <p className="text-xs text-[#B45309] mb-1.5">{noOriginal.length} of {cases.length} {noOriginal.length === 1 ? 'has' : 'have'} no original order form ({noOriginal.map(c => c.id).join(', ')}).</p>
            <div className="flex gap-1.5">{(Object.keys(NO_ORIGINAL_LABELS) as BulkDefaults['print']['noOriginal'][]).map(k => <Radio key={k} on={opts.noOriginal === k} onClick={() => setOpts(o => ({ ...o, noOriginal: k }))}>{NO_ORIGINAL_LABELS[k]}</Radio>)}</div>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-[#030213] mb-1.5">Order</p>
          <div className="flex flex-wrap gap-1.5">{(Object.keys(ORDER_LABELS) as BulkDefaults['print']['order'][]).map(k => <Radio key={k} on={opts.order === k} onClick={() => setOpts(o => ({ ...o, order: k }))}>{ORDER_LABELS[k]}</Radio>)}</div>
        </div>
      </div>
    </Modal>
  );
}
