import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCheck, Download, Inbox, Layers, Printer, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../src/app/components/Button';
import Modal from '../../src/app/components/Modal';
import { useAuth } from '../../src/app/context/AuthContext';
import { useToast } from '../../src/app/context/ToastContext';
import { useCreatedCases } from '../../src/app/data/createdCases';
import { teamMemberFor } from '../lab-prescription-inbox/data';
import { DownloadDialog, PrintDialog } from './BulkDialogs';
import { saveBulkDefaults, TARGET_LABELS, useBulkDefaults, type DraftTarget } from './bulkDefaults';
import DraftCheckboxes from './DraftCheckboxes';
import { clearDraftSelection, setDraftSelection, useDraftSelection } from './draftSelection';
import { createCasesFromDrafts, listDrafts, originOf } from './draftCases';
import { selectedCaseIds } from './selection';

// ── Bulk Actions ─────────────────────────────────────────────────────────────
// Everything works on what's ticked:
//   • Cases (the list's own ticks): Accept, Download files, Print order forms,
//     added to the list's blue bulk bar. Accept opens the portal's own status
//     modal with In Production ("Accepted by Lab") picked.
//   • Drafts (the sandbox's ticks on draft rows): Move to Received / Accept,
//     plus Download and Print. Drafts and cases are never ticked together.
// Dialogs remember each lab user's choices (bulkDefaults.ts).

type Dialog = { kind: 'download' | 'print'; ids: string[] } | null;

function useMe() {
  const { user } = useAuth();
  const m = teamMemberFor(user?.email);
  return { key: m?.email ?? user?.email ?? 'me', name: m?.name ?? user?.name ?? 'Lab' };
}

const barBtn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#C8D8FC] bg-white text-[#1565C0] hover:bg-[#F5F9FF] disabled:opacity-50';

/** Buttons added to the Cases list's own bulk bar (shown while case rows are ticked). */
function NativeBarButtons({ onOpen }: { onOpen: (d: Dialog) => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const sync = () => {
      const update = [...document.querySelectorAll<HTMLElement>('main button')].find(b => b.textContent?.trim() === 'Update Status');
      const bar = update?.parentElement;
      setHost(prev => {
        if (!bar) { prev?.remove(); return null; }
        if (prev && prev.isConnected && prev.parentElement === bar) return prev;
        prev?.remove();
        const el = document.createElement('span');
        el.className = 'inline-flex items-center gap-2 mr-2';
        bar.insertBefore(el, update!);
        bar.classList.add('flex', 'items-center');
        return el;
      });
    };
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => { mo.disconnect(); setHost(h => { h?.remove(); return null; }); };
  }, []);

  function accept() {
    [...document.querySelectorAll<HTMLElement>('main button')].find(b => b.textContent?.trim() === 'Update Status')?.click();
    window.setTimeout(() => {
      const modal = [...document.querySelectorAll<HTMLElement>('h3')].find(h => h.textContent?.trim() === 'Bulk status update')?.closest<HTMLElement>('.fixed') ?? document.body;
      [...modal.querySelectorAll<HTMLElement>('button')].find(b => b.querySelector('span')?.textContent?.trim() === 'In Production')?.click();
    }, 80);
  }

  if (!host) return null;
  return createPortal(
    <>
      <button onClick={accept} className={barBtn} title="Opens Update Status with In Production (Accepted by Lab) picked"><CheckCheck className="w-3.5 h-3.5" /> Accept</button>
      <button onClick={() => onOpen({ kind: 'download', ids: selectedCaseIds() })} className={barBtn}><Download className="w-3.5 h-3.5" /> Download files</button>
      <button onClick={() => onOpen({ kind: 'print', ids: selectedCaseIds() })} className={barBtn}><Printer className="w-3.5 h-3.5" /> Print order forms</button>
    </>,
    host,
  );
}

/** The blue bar for ticked drafts. */
function DraftBar({ ids, me, onOpen, onChanged }: { ids: string[]; me: { key: string; name: string }; onOpen: (d: Dialog) => void; onChanged: () => void }) {
  const { toast } = useToast();
  const defaults = useBulkDefaults(me.key);
  const [confirm, setConfirm] = useState<DraftTarget | null>(null);
  const [remember, setRemember] = useState(true);
  const drafts = useMemo(() => listDrafts().filter(d => ids.includes(d.id)), [ids.join()]);

  function go(target: DraftTarget) {
    const made = createCasesFromDrafts(drafts, target, me.name);
    clearDraftSelection();
    toast.success(`${made.length} draft${made.length === 1 ? '' : 's'} moved to ${TARGET_LABELS[target]}: ${made.map(m => m.to).join(', ')}`);
    onChanged();
  }
  const ask = (t: DraftTarget) => (defaults.drafts.confirm ? setConfirm(t) : go(t));
  const order: DraftTarget[] = defaults.drafts.primary === 'new' ? ['new', 'in-production'] : ['in-production', 'new'];

  return (
    <div className="flex flex-wrap items-center gap-3 mt-3 px-4 py-3 bg-[#EEF4FF] border border-[#C8D8FC] rounded-xl">
      <span className="text-sm font-semibold text-[#1565C0]">{drafts.length} draft{drafts.length === 1 ? '' : 's'} selected</span>
      <button onClick={clearDraftSelection} className="text-sm text-[#717182] hover:text-[#030213] underline underline-offset-2">Clear selection</button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button onClick={() => onOpen({ kind: 'download', ids })} className={barBtn}><Download className="w-3.5 h-3.5" /> Download files</button>
        <button onClick={() => onOpen({ kind: 'print', ids })} className={barBtn}><Printer className="w-3.5 h-3.5" /> Print order forms</button>
        {order.map((t, i) => i === 0
          ? <Button key={t} size="sm" icon={<CheckCheck className="w-4 h-4" />} onClick={() => ask(t)}>{t === 'new' ? 'Move to Received' : 'Accept'}</Button>
          : <button key={t} onClick={() => ask(t)} className={barBtn}>{t === 'new' ? 'Move to Received' : 'Accept'}</button>)}
      </div>
      {confirm && (
        <Modal isOpen onClose={() => setConfirm(null)} title={`Move ${drafts.length} draft${drafts.length === 1 ? '' : 's'} to ${TARGET_LABELS[confirm]}?`} footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-[#030213]"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Make {confirm === 'new' ? 'Received' : 'Accept'} my main action</label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button onClick={() => { if (remember) saveBulkDefaults(me.key, 'drafts', { ...defaults.drafts, primary: confirm }); const t = confirm; setConfirm(null); go(t); }}>Move {drafts.length}</Button>
            </div>
          </div>
        }>
          <p className="text-xs text-[#717182] mb-3">Each draft becomes a real case with the details it already has{confirm === 'in-production' ? ', accepted straight into production' : ''}. The drafts are removed.</p>
          <div className="rounded-xl border border-[#E0E0E6] divide-y divide-[#F0EFF6] max-h-56 overflow-y-auto">
            {drafts.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-3 py-1.5">
                <span className="font-mono text-[11px] font-semibold text-[#030213] w-32 flex-shrink-0 truncate">{d.id}</span>
                <span className="text-xs text-[#5A5568] flex-1 truncate">{d.patientName} · {d.services.join(', ')}</span>
                <span className="text-[10px] px-1.5 py-px rounded-full bg-[#F3F3F5] text-[#5A5568]">{originOf(d)}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function BulkActionsBar({ onChanged }: { onChanged: () => void }) {
  useCreatedCases();
  const navigate = useNavigate();
  const me = useMe();
  const drafts = useDraftSelection();
  const [dialog, setDialog] = useState<Dialog>(null);
  const draftIds = listDrafts().map(d => d.id);
  const ticked = drafts.filter(id => draftIds.includes(id));

  // What's new examples: ?bulk=drafts ticks every draft; ?bulk=download|print&ids=A,B opens that dialog.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const bulk = p.get('bulk');
    const ids = (p.get('ids') ?? '').split(',').filter(Boolean);
    if (bulk === 'drafts') setDraftSelection(listDrafts().map(d => d.id));
    else if ((bulk === 'download' || bulk === 'print') && ids.length) setDialog({ kind: bulk, ids });
    return () => clearDraftSelection();
  }, []);

  const btn = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#5A5568] bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors disabled:opacity-50';
  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-3 -mb-2 sm:-mb-3 lg:-mb-4">
      <div className="rounded-xl border border-[#E0E0E6] bg-white px-4 py-2.5 flex flex-col md:flex-row md:items-center gap-2.5">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="w-6 h-6 rounded-lg bg-[#F5F3FF] flex items-center justify-center flex-shrink-0 text-[#7C3AED]"><Layers className="w-3.5 h-3.5" /></span>
          <p className="text-[11px] leading-relaxed text-[#5A5568]"><span className="font-bold text-[#030213]">Bulk actions.</span> Tick cases to accept, download or print them. Drafts can be ticked too, to move them to Received or Accepted.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button onClick={() => setDraftSelection(draftIds)} disabled={!draftIds.length} className={btn}><Inbox className="w-3 h-3" /> Select all {draftIds.length} draft{draftIds.length === 1 ? '' : 's'}</button>
          <button onClick={() => navigate('/growth/settings?tab=bulk-actions')} className={btn}><Settings2 className="w-3 h-3" /> Defaults</button>
        </div>
      </div>
      {ticked.length > 0 && <DraftBar ids={ticked} me={me} onOpen={setDialog} onChanged={onChanged} />}
      <DraftCheckboxes />
      <NativeBarButtons onOpen={setDialog} />
      {dialog?.kind === 'download' && <DownloadDialog ids={dialog.ids} user={me.key} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'print' && <PrintDialog ids={dialog.ids} user={me.key} onClose={() => setDialog(null)} />}
    </div>
  );
}

