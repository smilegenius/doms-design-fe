import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ExternalLink, Pencil, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import Button from '../../src/app/components/Button';
import Modal from '../../src/app/components/Modal';
import { filesSubmissionForDraft, latestIntakeDraft, submissionBehind } from '../intake-form/intakeStore';
import { getCreatedCases } from '../../src/app/data/createdCases';
import {
  addUpdate, BUCKETS, isEdited, markAllSeen, removeUpdate, resetNote, setNote, Update, UpdateTag, useUpdates,
} from './updatesStore';

// ── What's new ───────────────────────────────────────────────────────────────
// Rendered inside the portal's Layout, in its own page header + card style.

const TAG: Record<UpdateTag, { label: string; cls: string }> = {
  new:     { label: 'New',     cls: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]' },
  changed: { label: 'Changes the original design', cls: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]' },
};

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

function UpdateCard({ u }: { u: Update }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(u.note);
  const save = () => { setNote(u.id, draft.trim() || u.note); setEditing(false); };

  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h3 className="text-sm font-semibold text-[#030213]">{u.title}</h3>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TAG[u.tag].cls}`}>{TAG[u.tag].label}</span>
          {isEdited(u.id) && <span className="text-[10px] text-[#A0A0B0]">note edited</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!editing && <button onClick={() => { setDraft(u.note); setEditing(true); }} className="p-1.5 rounded-lg text-[#A0A0B0] hover:text-[#4D8EF7] hover:bg-[#EEF4FF]" title="Edit note"><Pencil className="w-3.5 h-3.5" /></button>}
          {isEdited(u.id) && !editing && <button onClick={() => resetNote(u.id)} className="p-1.5 rounded-lg text-[#A0A0B0] hover:text-[#030213] hover:bg-[#F8F9FC]" title="Restore the original note"><RotateCcw className="w-3.5 h-3.5" /></button>}
          {u.custom && <button onClick={() => removeUpdate(u.id)} className="p-1.5 rounded-lg text-[#A0A0B0] hover:text-[#D4183D] hover:bg-[#FFEBEE]" title="Delete this update"><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      {editing ? (
        <div className="mt-2">
          <textarea autoFocus rows={4} value={draft} onChange={e => setDraft(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm text-[#030213] focus:outline-none focus:border-[#4D8EF7] resize-none" />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={save}>Save note</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#5A5568] leading-relaxed mt-1.5">{u.note}</p>
      )}

      {u.examples.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {u.examples.map(resolveExample).map(ex => (
            <button
              key={ex.label}
              onClick={() => (ex.newTab ? window.open(ex.to, '_blank', 'noopener') : navigate(ex.to))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity"
            >
              {ex.label} {ex.newTab ? <ExternalLink className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
            </button>
          ))}
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
          addUpdate({ title: title.trim(), bucket, tag, note: note.trim(), examples: to ? [{ label: 'See the example', to: to.startsWith('/') ? to : `/growth/${to}`, newTab: /^\/(review|lablink|intake)\//.test(to) }] : [] });
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
            <select value={tag} onChange={e => setTag(e.target.value as UpdateTag)} className={input}><option value="new">New</option><option value="changed">Changes the original design</option></select></label>
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
  useEffect(() => { markAllSeen(); }, []);
  const buckets = [...BUCKETS, ...new Set(all.map(u => u.bucket).filter(b => !(BUCKETS as readonly string[]).includes(b)))];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center"><Sparkles className="w-5 h-5 text-white" /></span>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213]">What's new</h1>
          </div>
          <p className="text-sm sm:text-base text-[#717182]">Everything Growth Team Feedback adds or changes, by area. Open an example to see it in this portal, and edit any note to explain it your way.</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setAdding(true)}>Add update</Button>
      </div>

      <div className="space-y-7">
        {buckets.map(b => {
          const items = all.filter(u => u.bucket === b);
          if (!items.length) return null;
          return (
            <section key={b}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-[#030213] uppercase tracking-wide">{b}</h2>
                <span className="px-1.5 py-px rounded-full bg-[#F3F3F5] text-[10px] font-medium text-[#717182] tabular-nums">{items.length}</span>
              </div>
              <div className="space-y-3">{items.map(u => <UpdateCard key={u.id} u={u} />)}</div>
            </section>
          );
        })}
      </div>
      {adding && <AddModal onClose={() => setAdding(false)} />}
    </div>
  );
}
