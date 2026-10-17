import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { useAuth } from '../../src/app/context/AuthContext';
import { useToast } from '../../src/app/context/ToastContext';
import Toggle from '../../src/app/components/Toggle';
import { teamMemberFor } from '../lab-prescription-inbox/data';
import {
  BulkDefaults, GROUPING_LABELS, INCLUDE_LABELS, IncludeKey, NAMING_LABELS, NO_ORIGINAL_LABELS, ORDER_LABELS,
  resetBulkDefaults, saveBulkDefaults, TARGET_LABELS, useBulkDefaults, WHICH_LABELS,
} from './bulkDefaults';

// ── Settings → Bulk Actions ──────────────────────────────────────────────────
// The signed-in lab user's own defaults for bulk downloads, prints and draft
// moves. The dialogs open with these; "Remember these choices" saves here.

const card = 'bg-white rounded-xl border border-[#E0E0E6]';
const sel = 'px-2.5 py-1.5 rounded-lg border border-[#E0E0E6] text-xs bg-white focus:outline-none focus:border-[#4D8EF7]';

function Section({ title, hint, saved, onReset, children }: { title: string; hint: string; saved: boolean; onReset: () => void; children: ReactNode }) {
  return (
    <div className={card}>
      <div className="px-5 py-4 border-b border-[#F0EFF6] flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#030213]">{title}</p>
          <p className="text-xs text-[#717182] mt-0.5">{hint}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${saved ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]' : 'bg-[#F8F9FC] text-[#717182] border-[#E0E0E6]'}`}>{saved ? 'Your choices' : 'Default'}</span>
          {saved && <button onClick={onReset} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#717182] hover:text-[#030213]"><RotateCcw className="w-3 h-3" /> Reset</button>}
        </div>
      </div>
      <div className="px-5 py-4 space-y-3">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6"><span className="text-xs font-medium text-[#030213] sm:w-48 flex-shrink-0">{label}</span><div className="flex-1">{children}</div></div>;
}

export default function BulkSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const me = teamMemberFor(user?.email);
  const key = me?.email ?? user?.email ?? 'me';
  const d = useBulkDefaults(key);
  const setDl = (patch: Partial<BulkDefaults['download']>) => saveBulkDefaults(key, 'download', { ...d.download, ...patch });
  const setPr = (patch: Partial<BulkDefaults['print']>) => saveBulkDefaults(key, 'print', { ...d.print, ...patch });
  const setDr = (patch: Partial<BulkDefaults['drafts']>) => saveBulkDefaults(key, 'drafts', { ...d.drafts, ...patch });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#030213]">Bulk Actions</h2>
          <p className="text-xs text-[#717182] mt-0.5">How bulk downloads, prints and draft moves are set up for you{me ? ` (${me.name})` : ''}. Each lab user has their own; the dialogs open with these and "Remember these choices" saves here.</p>
        </div>
        <button onClick={() => { resetBulkDefaults(key); toast.success('Bulk Actions defaults reset'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E0E0E6] text-[#030213] bg-white hover:bg-[#F8F9FC] flex-shrink-0"><RotateCcw className="w-3.5 h-3.5" /> Reset all</button>
      </div>

      <Section title="Download files" hint="What goes into the ZIP for the ticked cases." saved={d.saved.download} onReset={() => resetBulkDefaults(key, 'download')}>
        <Row label="Include">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {(Object.keys(INCLUDE_LABELS) as IncludeKey[]).map(k => (
              <label key={k} className="inline-flex items-center gap-2 text-xs text-[#030213]"><input type="checkbox" checked={d.download.include[k]} onChange={() => setDl({ include: { ...d.download.include, [k]: !d.download.include[k] } })} /> {INCLUDE_LABELS[k]}</label>
            ))}
          </div>
        </Row>
        <Row label="Folder names"><select className={sel} value={d.download.naming} onChange={e => setDl({ naming: e.target.value as BulkDefaults['download']['naming'] })}>{Object.entries(NAMING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Row>
        <Row label="ZIP files"><select className={sel} value={d.download.grouping} onChange={e => setDl({ grouping: e.target.value as BulkDefaults['download']['grouping'] })}>{Object.entries(GROUPING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Row>
      </Section>

      <Section title="Print order forms" hint="Which form prints for the ticked cases, and in what order." saved={d.saved.print} onReset={() => resetBulkDefaults(key, 'print')}>
        <Row label="Order form"><select className={sel} value={d.print.which} onChange={e => setPr({ which: e.target.value as BulkDefaults['print']['which'] })}>{Object.entries(WHICH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Row>
        <Row label="Cases with no original"><select className={sel} value={d.print.noOriginal} onChange={e => setPr({ noOriginal: e.target.value as BulkDefaults['print']['noOriginal'] })}>{Object.entries(NO_ORIGINAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Row>
        <Row label="Order"><select className={sel} value={d.print.order} onChange={e => setPr({ order: e.target.value as BulkDefaults['print']['order'] })}>{Object.entries(ORDER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Row>
      </Section>

      <Section title="Drafts" hint="Ticked drafts move to Received or Accepted." saved={d.saved.drafts} onReset={() => resetBulkDefaults(key, 'drafts')}>
        <Row label="Main button"><select className={sel} value={d.drafts.primary} onChange={e => setDr({ primary: e.target.value as BulkDefaults['drafts']['primary'] })}>{Object.entries(TARGET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Row>
        <Row label="Ask before moving"><Toggle on={d.drafts.confirm} onChange={() => setDr({ confirm: !d.drafts.confirm })} /></Row>
      </Section>
    </div>
  );
}
