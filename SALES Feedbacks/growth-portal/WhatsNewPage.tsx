import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, ExternalLink, Pencil, Plus, RotateCcw, Search, Sparkles, Trash2 } from 'lucide-react';
import Button from '../../src/app/components/Button';
import Modal from '../../src/app/components/Modal';
import { filesSubmissionForDraft, latestIntakeDraft, submissionBehind } from '../intake-form/intakeStore';
import { getCreatedCases } from '../../src/app/data/createdCases';
import {
  addUpdate, BUCKETS, isEdited, markAllSeen, removeUpdate, resetNote, setNote, Update, UpdateExample, UpdateTag, useUpdates,
} from './updatesStore';

// ── What's new ───────────────────────────────────────────────────────────────
// Rendered inside the portal's Layout, in its own page header + card style.

const TAG: Record<UpdateTag, { label: string; title: string; cls: string }> = {
  new:     { label: 'New',     title: 'New in Growth Team Feedback', cls: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]' },
  changed: { label: 'Changed', title: 'Changes the original design', cls: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]' },
};

/** Subsections for an update's links: things to try, settings, and pages people outside the lab see. */
const GROUP_ORDER = ['Try it', 'Settings', 'Outside view'];
function groupOf(ex: UpdateExample) {
  return ex.group ?? (ex.newTab || /^\/(review|lablink|partner|intake)\//.test(ex.to) ? 'Outside view' : /\/settings/.test(ex.to) ? 'Settings' : 'Try it');
}
const anchor = (id: string) => `wn-${id}`;
const areaAnchor = (b: string) => `wn-area-${b.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/** Draft examples follow the request if the lab has already acted on it. */
function resolveExample(ex: { label: string; to: string; newTab?: boolean }) {
  if (ex.to === '/intake/latest-draft') {
    const d = latestIntakeDraft();
    return d ? { ...ex, to: `/growth/cases/quick-new/${encodeURIComponent(d.caseId)}`, label: `${ex.label} (${d.ref})` } : { ...ex, to: '/intake/smile-genius-lab', newTab: true, label: 'Send a test request first' };
  }
  const qn = ex.to.match(/^\/growth\/cases\/quick-new\/(.+)$/);
  if (qn && !getCreatedCases().some(c => c.id === qn[1] && c.status === 'draft')) {
    // That draft was confirmed (or removed): show the case it became, else the latest draft.
    const files = filesSubmissionForDraft(qn[1])?.filesFor;
    if (files?.attachedCaseId) return { ...ex, to: `/growth/cases/${files.attachedCaseId}?sf=attachments`, label: `${ex.label}: now on ${files.attachedCaseId}` };
    if (files?.convertedTo) return { ...ex, to: `/growth/cases/quick-new/${encodeURIComponent(files.convertedTo)}`, label: `${ex.label}: now draft ${files.convertedRef}` };
    if (files?.dismissedAt) return { ...ex, to: '/growth/cases', label: `${ex.label} (dismissed)` };
    const done = submissionBehind(qn[1])?.confirmedCaseId;
    if (done) return { ...ex, to: `/growth/cases/${done}?sf=order`, label: `${ex.label}: now case ${done}` };
    const d = latestIntakeDraft();
    return d ? { ...ex, to: `/growth/cases/quick-new/${encodeURIComponent(d.caseId)}`, label: `LabLink draft ${d.ref}` } : { ...ex, to: '/lablink/smile-genius-lab', newTab: true, label: 'Send a test request first' };
  }
  return ex;
}

function UpdateCard({ u, open, onToggle }: { u: Update; open: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(u.note);
  const save = () => { setNote(u.id, draft.trim() || u.note); setEditing(false); };
  // Resolved links can land on the same page (e.g. a draft that was confirmed): list each once.
  const links = u.examples.map(resolveExample).filter((l, i, a) => a.findIndex(x => x.to === l.to && x.label === l.label) === i);
  const groups = [...new Set([...GROUP_ORDER, ...links.map(groupOf)])].map(g => ({ g, items: links.filter(l => groupOf(l) === g) })).filter(x => x.items.length);

  return (
    <div id={anchor(u.id)} className="bg-white border border-[#E0E0E6] rounded-xl px-4 py-3 scroll-mt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-[#030213]">{u.title}</h3>
            <span title={TAG[u.tag].title} className={`px-1.5 py-px rounded-full text-[10px] font-semibold border ${TAG[u.tag].cls}`}>{TAG[u.tag].label}</span>
            {isEdited(u.id) && <span className="text-[10px] text-[#A0A0B0]">note edited</span>}
          </div>
          <p className="text-xs text-[#717182] mt-0.5">{u.summary ?? (u.note.length > 110 ? `${u.note.slice(0, 110).replace(/\s+\S*$/, '')}…` : u.note)}</p>
        </div>
        <button onClick={onToggle} className="flex-shrink-0 inline-flex items-center gap-0.5 text-[11px] font-medium text-[#717182] hover:text-[#030213]">
          Details <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {groups.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {groups.map(({ g, items }) => (
            <div key={g} className="flex flex-wrap items-center gap-1.5">
              <span className="w-24 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#A0A0B0]">{g}</span>
              {items.map(ex => (
                <button
                  key={ex.label + ex.to}
                  onClick={() => (ex.newTab ? window.open(ex.to, '_blank', 'noopener') : navigate(ex.to))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[#1565C0] bg-[#F5F9FF] border border-[#C8D8FC] hover:bg-[#EEF4FF] transition-colors"
                >
                  {ex.label} {ex.newTab ? <ExternalLink className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-3 pt-3 border-t border-[#F0EFF6]">
          {editing ? (
            <div>
              <textarea autoFocus rows={4} value={draft} onChange={e => setDraft(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm text-[#030213] focus:outline-none focus:border-[#4D8EF7] resize-none" />
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" onClick={save}>Save note</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <p className="flex-1 text-sm text-[#5A5568] leading-relaxed">{u.note}</p>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => { setDraft(u.note); setEditing(true); }} className="p-1.5 rounded-lg text-[#A0A0B0] hover:text-[#4D8EF7] hover:bg-[#EEF4FF]" title="Edit note"><Pencil className="w-3.5 h-3.5" /></button>
                {isEdited(u.id) && <button onClick={() => resetNote(u.id)} className="p-1.5 rounded-lg text-[#A0A0B0] hover:text-[#030213] hover:bg-[#F8F9FC]" title="Restore the original note"><RotateCcw className="w-3.5 h-3.5" /></button>}
                {u.custom && <button onClick={() => removeUpdate(u.id)} className="p-1.5 rounded-lg text-[#A0A0B0] hover:text-[#D4183D] hover:bg-[#FFEBEE]" title="Delete this update"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [bucket, setBucket] = useState<string>(BUCKETS[0]);
  const [tag, setTag] = useState<UpdateTag>('new');
  const [note, setNoteText] = useState('');
  const [path, setPath] = useState('');
  const ok = title.trim().length > 0;
  const input = 'w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm text-[#030213] focus:outline-none focus:border-[#4D8EF7]';
  return (
    <Modal isOpen onClose={onClose} title="Add an update" footer={
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!ok} onClick={() => {
          const to = path.trim();
          addUpdate({ title: title.trim(), bucket, tag, note: note.trim(), examples: to ? [{ label: 'See the example', to: to.startsWith('/') ? to : `/growth/${to}`, newTab: /^\/(review|lablink|intake|partner)\//.test(to) }] : [] });
          onClose();
        }}>Add update</Button>
      </div>
    }>
      <div className="space-y-3">
        <label className="block"><span className="block text-xs font-medium text-[#030213] mb-1">What changed</span><input value={title} onChange={e => setTitle(e.target.value)} className={input} placeholder="e.g. Case timeline view" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-xs font-medium text-[#030213] mb-1">Area</span>
            <select value={bucket} onChange={e => setBucket(e.target.value)} className={input}>{BUCKETS.map(b => <option key={b}>{b}</option>)}</select></label>
          <label className="block"><span className="block text-xs font-medium text-[#030213] mb-1">Type</span>
            <select value={tag} onChange={e => setTag(e.target.value as UpdateTag)} className={input}><option value="new">New</option><option value="changed">Changed (the original design)</option></select></label>
        </div>
        <label className="block"><span className="block text-xs font-medium text-[#030213] mb-1">Note</span><textarea rows={3} value={note} onChange={e => setNoteText(e.target.value)} className={`${input} resize-none`} placeholder="What exactly did we add or change?" /></label>
        <label className="block"><span className="block text-xs font-medium text-[#030213] mb-1">Example page <span className="font-normal text-[#A0A0B0]">(optional)</span></span><input value={path} onChange={e => setPath(e.target.value)} className={`${input} font-mono text-xs`} placeholder="/growth/cases/SG-2026-0481" /></label>
      </div>
    </Modal>
  );
}

export default function WhatsNewPage() {
  const { all } = useUpdates();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string[]>([]);
  useEffect(() => { markAllSeen(); }, []);
  const buckets = [...BUCKETS, ...new Set(all.map(u => u.bucket).filter(b => !(BUCKETS as readonly string[]).includes(b)))];
  const match = (u: Update) => !q.trim() || `${u.title} ${u.summary ?? ''} ${u.note} ${u.examples.map(e => e.label).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase());
  const shown = all.filter(match);
  const areas = buckets.map(b => ({ b, items: shown.filter(u => u.bucket === b) })).filter(x => x.items.length);
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const toggle = (id: string) => setOpen(o => (o.includes(id) ? o.filter(x => x !== id) : [...o, id]));
  const allOpen = shown.length > 0 && shown.every(u => open.includes(u.id));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center"><Sparkles className="w-5 h-5 text-white" /></span>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213]">What's new</h1>
          </div>
          <p className="text-sm text-[#717182]">{all.length} changes in Growth Team Feedback. Pick an area, then open a link to try it.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#A0A0B0]" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search changes and links…" className="pl-8 pr-3 py-2 rounded-lg border border-[#E0E0E6] text-sm w-56 bg-white focus:outline-none focus:border-[#4D8EF7]" /></div>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setAdding(true)}>Add update</Button>
        </div>
      </div>

      {/* Areas as chips on small screens */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 lg:hidden">
        {areas.map(({ b, items }) => <button key={b} onClick={() => jump(areaAnchor(b))} className="flex-shrink-0 px-2.5 py-1 rounded-full border border-[#E0E0E6] bg-white text-xs text-[#5A5568]">{b} <span className="text-[#A0A0B0]">{items.length}</span></button>)}
      </div>

      <div className="flex gap-6">
        <nav className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-4 bg-white border border-[#E0E0E6] rounded-xl p-2 max-h-[calc(100vh-2rem)] overflow-y-auto">
            {areas.map(({ b, items }) => (
              <div key={b} className="mb-1.5 last:mb-0">
                <button onClick={() => jump(areaAnchor(b))} className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-semibold text-[#030213] hover:bg-[#F8F9FC]">
                  {b} <span className="text-[10px] font-medium text-[#A0A0B0]">{items.length}</span>
                </button>
                {items.map(u => (
                  <button key={u.id} onClick={() => jump(anchor(u.id))} className="w-full text-left pl-4 pr-2 py-1 rounded-md text-[11px] text-[#5A5568] hover:bg-[#F8F9FC] hover:text-[#030213] truncate">{u.title}</button>
                ))}
              </div>
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0 space-y-6">
          <div className="flex justify-end -mb-3">
            <button onClick={() => setOpen(allOpen ? [] : shown.map(u => u.id))} className="text-[11px] font-medium text-[#717182] hover:text-[#030213]">{allOpen ? 'Hide all details' : 'Show all details'}</button>
          </div>
          {areas.length === 0 && <p className="text-sm text-[#A0A0B0] text-center py-10">Nothing matches "{q}".</p>}
          {areas.map(({ b, items }) => (
            <section key={b} id={areaAnchor(b)} className="scroll-mt-4">
              <div className="flex items-center gap-2 mb-2.5">
                <h2 className="text-sm font-semibold text-[#030213] uppercase tracking-wide">{b}</h2>
                <span className="px-1.5 py-px rounded-full bg-[#F3F3F5] text-[10px] font-medium text-[#717182] tabular-nums">{items.length}</span>
              </div>
              <div className="space-y-2">{items.map(u => <UpdateCard key={u.id} u={u} open={open.includes(u.id)} onToggle={() => toggle(u.id)} />)}</div>
            </section>
          ))}
        </div>
      </div>
      {adding && <AddModal onClose={() => setAdding(false)} />}
    </div>
  );
}
