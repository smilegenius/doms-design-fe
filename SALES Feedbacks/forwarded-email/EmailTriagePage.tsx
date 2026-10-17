import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FilePlus2, Inbox, Mail, Paperclip, Search, Sparkles, X } from 'lucide-react';
import Button from '../../src/app/components/Button';
import RescanMatchCard from '../../src/app/components/RescanMatchCard';
import { useAuth } from '../../src/app/context/AuthContext';
import { useToast } from '../../src/app/context/ToastContext';
import { FileList } from '../design-studio/components/FileChips';
import { portalDateTime, RX_INBOX, teamMemberFor } from '../lab-prescription-inbox/data';
import { candidateCases, scoreCase, searchCases } from '../intake-form/fileMatching';
import { addEmailToCase, dismissEmail, ForwardedEmail, matchesFor, useForwardedEmails } from './emailStore';

// ── Email drafts ─────────────────────────────────────────────────────────────
// Every forwarded email (that isn't a prescription photo) is a draft in Cases.
// EmailDetail is what opening one shows: the email, what was read from it,
// and the two ways forward. "Create a new case" continues into QuickCreate
// with this draft (which shows the real email); "Add to an existing case"
// puts the email and its files on that case. EmailTriagePage lists them all.

const short = (n: string) => n.replace(/\s*<.*$/, '');

export function EmailDetail({ e, onDone }: { e: ForwardedEmail; onDone: (msg: string, to?: string) => void }) {
  const { user } = useAuth();
  const me = teamMemberFor(user?.email)?.name ?? user?.name ?? 'Lab';
  const { read, exact, suggestions } = useMemo(() => matchesFor(e), [e.id]);
  const exactScored = exact ? scoreCase(read.subject, exact) : null;
  const list = [...(exactScored ? [exactScored] : []), ...suggestions.filter(s => s.case.id !== exact?.id)];
  const [selected, setSelected] = useState<string | null>(list[0]?.case.id ?? null);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const extra = picked.filter(id => !list.some(m => m.case.id === id)).map(id => candidateCases().find(c => c.id === id)).filter(c => !!c).map(c => scoreCase(read.subject, c!));
  const all = [...list, ...extra];
  const results = searchCases(q).filter(c => !all.some(m => m.case.id === c.id));
  const target = all.find(m => m.case.id === selected);
  const done = e.status !== 'new';

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{short(e.fromName).split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#030213]">{e.subject}</p>
              <p className="text-xs text-[#717182]">{short(e.fromName)} &lt;{e.fromEmail}&gt; · {portalDateTime(e.at)} · forwarded by {e.forwardedBy}</p>
            </div>
          </div>
          <p className="text-sm text-[#030213] whitespace-pre-wrap leading-relaxed mt-3 pt-3 border-t border-[#F0EFF6]">{e.body}</p>
          {e.files.length > 0 && <div className="mt-3 pt-3 border-t border-[#F0EFF6]"><FileList files={e.files} title={`Attachments (${e.files.length})`} /></div>}
        </div>

        <div className="rounded-xl border border-[#EDE9FE] bg-[#F5F3FF] px-4 py-3">
          <p className="text-[11px] font-bold text-[#6D28D9] uppercase tracking-wider flex items-center gap-1.5 mb-1.5"><Sparkles className="w-3.5 h-3.5" /> Read from the email</p>
          <div className="flex flex-wrap gap-1.5">
            {[['Patient', read.patientName], ['Reference', read.reference], ['Practice', read.practice], ['Service', read.service], ['Teeth', read.teeth.join(', ')]].map(([k, v]) => (
              <span key={k} className={`px-2 py-0.5 rounded-full text-[11px] border ${v ? 'bg-white text-[#030213] border-[#DDD6FE]' : 'bg-transparent text-[#A0A0B0] border-dashed border-[#DDD6FE]'}`}>{k}: {v || 'not found'}</span>
            ))}
          </div>
        </div>

        {done ? (
          <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 text-sm text-[#047857] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {e.status === 'added' ? `Added to ${e.caseId} by ${e.actedBy}` : e.status === 'case' ? `Made into case ${e.caseId} by ${e.actedBy}` : `Dismissed by ${e.actedBy}`} · {portalDateTime(e.actedAt!)}
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-base font-semibold text-[#030213]">Which case is this about?</h2>
              <p className="text-xs text-[#717182] mt-0.5">
                {exact ? `The email quotes ${read.reference}, which matches ${exact.id}.` : !read.patientName ? 'No patient could be read from the email. Search for the case, or make a new one.' : all.length ? 'No exact reference, so these are the likely cases.' : `No case found for ${read.patientName}. If it's a new request, make a new case from it.`}
              </p>
            </div>
            <div className="space-y-3">
              {all.map(m => (
                <RescanMatchCard key={m.case.id} match={m} selected={selected === m.case.id} onSelect={() => setSelected(m.case.id)}
                  onOpenCase={() => window.open(`/growth/cases/${encodeURIComponent(m.case.id)}`, '_blank', 'noopener')} />
              ))}
            </div>
            <div className="bg-white border border-[#E0E0E6] rounded-xl p-3">
              <p className="text-xs font-semibold text-[#030213] mb-2">Find the case</p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E0E0E6] focus-within:border-[#4D8EF7]">
                <Search className="w-4 h-4 text-[#A0A0B0]" />
                <input value={q} onChange={ev => setQ(ev.target.value)} placeholder="Case ID, patient, practice, dentist or scanner ref" className="flex-1 text-sm focus:outline-none" />
                {q && <button onClick={() => setQ('')} aria-label="Clear"><X className="w-4 h-4 text-[#A0A0B0]" /></button>}
              </div>
              {results.length > 0 && (
                <div className="mt-2 divide-y divide-[#F0EFF6]">
                  {results.map(c => (
                    <button key={c.id} onClick={() => { setPicked(p => [...p, c.id]); setSelected(c.id); setQ(''); }} className="w-full text-left px-2 py-2 hover:bg-[#F8F9FC] flex items-center gap-3">
                      <span className="font-mono text-xs font-semibold text-[#030213] w-28 flex-shrink-0">{c.id}</span>
                      <span className="text-xs text-[#030213] truncate">{c.patientName} · {c.services.join(', ')} · {c.practice} · {c.dentist}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {!done && (
        <footer className="flex-shrink-0 bg-white border-t border-[#E0E0E6] px-4 py-3 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={() => { dismissEmail(e.id, me); onDone(`${e.id} dismissed`); }}>Dismiss</Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" icon={<FilePlus2 className="w-4 h-4" />} onClick={() => {
              onDone(`Check the details read from the email, then create the case.`, `/growth/cases/quick-new/${encodeURIComponent(e.draftId!)}?create=1`);
            }}>Create a new case</Button>
            <Button icon={<Paperclip className="w-4 h-4" />} disabled={!target} onClick={() => {
              addEmailToCase(e.id, target!.case.id, me);
              onDone(`Email and ${e.files.length} attachment${e.files.length === 1 ? '' : 's'} added to ${target!.case.id}`, `/growth/cases/${encodeURIComponent(target!.case.id)}?sf=attachments`);
            }}>{target ? `Add to ${target.case.id}` : 'Pick a case'}</Button>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function EmailTriagePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { emails } = useForwardedEmails();
  const [tab, setTab] = useState<'new' | 'done'>('new');
  const shown = emails.filter(e => (tab === 'new' ? e.status === 'new' : e.status !== 'new'));
  const [openId, setOpenId] = useState<string | null>(null);
  const open = shown.find(e => e.id === openId) ?? shown[0];

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FC]">
      <header className="h-14 flex-shrink-0 bg-white border-b border-[#E0E0E6] px-4 flex items-center gap-3">
        <button onClick={() => navigate('/growth/cases')} className="inline-flex items-center gap-1.5 text-sm text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-4 h-4" /> Back to Cases</button>
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          <h1 className="text-base font-semibold text-[#030213]">Email drafts</h1>
          <span className="hidden sm:inline text-[11px] text-[#717182] truncate">Forwarded to <span className="font-mono">{RX_INBOX}</span></span>
        </div>
        <span className="w-28" />
      </header>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <aside className="lg:w-[340px] flex-shrink-0 border-r border-[#E0E0E6] bg-white flex flex-col">
          <div className="p-3 border-b border-[#F0EFF6]">
            <div className="inline-flex p-0.5 bg-[#F3F3F5] rounded-lg w-full">
              {(['new', 'done'] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); setOpenId(null); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs ${tab === t ? 'bg-white text-[#1565C0] font-semibold shadow-sm' : 'text-[#717182] font-medium'}`}>
                  {t === 'new' ? `Waiting (${emails.filter(e => e.status === 'new').length})` : `Done (${emails.filter(e => e.status !== 'new').length})`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[#F0EFF6]">
            {shown.length === 0 && (
              <div className="p-6 text-center">
                <Inbox className="w-8 h-8 text-[#E0E0E6] mx-auto mb-2" />
                <p className="text-xs text-[#717182]">{tab === 'new' ? 'No email drafts waiting. Use "Forward an email" on Cases to try one.' : 'Nothing done yet.'}</p>
              </div>
            )}
            {shown.map(e => (
              <button key={e.id} onClick={() => setOpenId(e.id)} className={`w-full text-left px-4 py-3 hover:bg-[#F8F9FC] ${open?.id === e.id ? 'bg-[#EEF4FF]' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#030213] truncate">{short(e.fromName)}</p>
                  <span className="text-[10px] text-[#A0A0B0] flex-shrink-0">{portalDateTime(e.at)}</span>
                </div>
                <p className="text-xs text-[#030213] truncate mt-0.5">{e.subject}</p>
                <p className="text-[11px] text-[#717182] truncate">{e.body.replace(/\s+/g, ' ').slice(0, 90)}</p>
                <div className="flex items-center gap-2 mt-1">
                  {e.files.length > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] text-[#717182]"><Paperclip className="w-3 h-3" /> {e.files.length}</span>}
                  {e.status !== 'new' && <span className="text-[10px] font-semibold text-[#047857]">{e.status === 'added' ? `added to ${e.caseId}` : e.status === 'case' ? `became ${e.caseId}` : 'Dismissed'}</span>}
                </div>
              </button>
            ))}
          </div>
        </aside>
        {open ? (
          <EmailDetail key={open.id} e={open} onDone={(msg, to) => { toast.success(msg); setOpenId(null); if (to) navigate(to); }} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-[#717182]"><Mail className="w-4 h-4 mr-2" /> Pick an email</div>
        )}
      </div>
    </div>
  );
}
