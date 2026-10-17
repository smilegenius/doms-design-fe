import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FilePlus2, FolderUp, Paperclip, Search, X } from 'lucide-react';
import Button from '../../src/app/components/Button';
import RescanMatchCard from '../../src/app/components/RescanMatchCard';
import { useAuth } from '../../src/app/context/AuthContext';
import { useToast } from '../../src/app/context/ToastContext';
import { FileList } from '../design-studio/components/FileChips';
import { portalDate, portalDateTime, teamMemberFor } from '../lab-prescription-inbox/data';
import { SenderChecks } from './IntakeFilesDock';
import { candidateCases, scoreCase, searchCases, suggestMatches, type FileSubject } from './fileMatching';
import { attachFiles, convertFilesToCase, dismissFiles, filesSubmissionForDraft, useIntake } from './intakeStore';

// ── Match files ──────────────────────────────────────────────────────────────
// Opens in place of QuickCreate for a LabLink "files for an existing case"
// draft (SF-WEB-F…) whose reference didn't match a case exactly. The lab sees
// what was sent, the likely cases with their evidence (the portal's own
// RescanMatchCard), and picks one, or searches, or dismisses it.

export default function MatchFilesPage({ draftId }: { draftId: string }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  useIntake();
  const sub = filesSubmissionForDraft(draftId);
  const subject: FileSubject | null = sub?.filesFor
    ? { patientName: sub.patientName, practice: sub.practice, dentist: sub.dentist, reference: sub.filesFor.reference, service: sub.service === 'Additional files' ? undefined : sub.service, teeth: sub.filesFor.teeth }
    : null;
  const suggestions = useMemo(() => (subject ? suggestMatches(subject) : []), [sub?.ref]);
  const [selected, setSelected] = useState<string | null>(suggestions[0]?.case.id ?? null);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  if (!sub?.filesFor || !subject) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-[#F8F9FC]">
        <p className="text-sm text-[#717182]">This LabLink request isn't waiting to be matched.</p>
        <Button variant="outline" onClick={() => navigate('/growth/cases')}>Back to Cases</Button>
      </div>
    );
  }
  const f = sub.filesFor;
  if (f.attachedCaseId || f.dismissedAt || f.convertedTo) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-[#F8F9FC]">
        <p className="text-sm text-[#030213] font-semibold">{sub.ref} {f.attachedCaseId ? `is on ${f.attachedCaseId}` : f.convertedTo ? `became new-case draft ${f.convertedRef}` : 'was dismissed'}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/growth/cases')}>Back to Cases</Button>
          {f.attachedCaseId && <Button onClick={() => navigate(`/growth/cases/${f.attachedCaseId}?sf=attachments`)}>Open the case</Button>}
          {f.convertedTo && <Button onClick={() => navigate(`/growth/cases/quick-new/${encodeURIComponent(f.convertedTo!)}`)}>Open the draft</Button>}
        </div>
      </div>
    );
  }

  // Cases the lab found by search, scored the same way so the evidence reads the same.
  const extra = picked.filter(id => !suggestions.some(m => m.case.id === id))
    .map(id => candidateCases().find(c => c.id === id)).filter(c => !!c).map(c => scoreCase(subject, c!));
  const results = searchCases(q).filter(c => !suggestions.some(m => m.case.id === c.id) && !picked.includes(c.id));
  const all = [...suggestions, ...extra];
  const target = all.find(m => m.case.id === selected);
  const n = sub.files.length;

  function createNew() {
    const draft = convertFilesToCase(sub!.ref);
    if (!draft) return;
    toast.success(`New-case draft ${draft.ref} made from ${sub!.ref}. Check it and create the case.`);
    navigate(`/growth/cases/quick-new/${encodeURIComponent(draft.caseId)}`);
  }

  function attach() {
    if (!target) return;
    attachFiles(sub!.ref, target.case.id, teamMemberFor(user?.email)?.name ?? user?.name);
    toast.success(`${n} file${n === 1 ? '' : 's'} added to ${target.case.id}. ${sub!.dentist} has been told.`);
    navigate(`/growth/cases/${encodeURIComponent(target.case.id)}?sf=attachments`);
  }

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FC]">
      <header className="h-14 flex-shrink-0 bg-white border-b border-[#E0E0E6] px-4 flex items-center gap-3">
        <button onClick={() => navigate('/growth/cases')} className="inline-flex items-center gap-1.5 text-sm text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-4 h-4" /> Back to Cases</button>
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          <h1 className="text-base font-semibold text-[#030213]">Match files</h1>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF4FF] text-[#1565C0] border border-[#DBEAFE]"><FolderUp className="w-3 h-3" /> LabLink · {sub.ref}</span>
        </div>
        <span className="w-28" />
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* What was sent */}
        <aside className="lg:w-[400px] flex-shrink-0 border-r border-[#E0E0E6] bg-white overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-[11px] font-bold text-[#030213] uppercase tracking-wider">What {sub.dentist} sent</p>
            <p className="text-[11px] text-[#717182]">Through LabLink · {portalDateTime(sub.at)}</p>
          </div>
          <SenderChecks sub={sub} />
          <div className="rounded-xl border border-[#E0E0E6] p-3 space-y-1.5">
            {[
              ['Dentist', `${sub.dentist} · GDC ${sub.gdc || '—'}`],
              ['Practice', `${sub.practice}${sub.postcode ? `, ${sub.postcode}` : ''}`],
              ['Contact', `${sub.email} · ${sub.phone}`],
              ['Patient', `${sub.patientName}${f.patientDob ? ` · born ${portalDate(new Date(`${f.patientDob}T12:00:00`))}` : ''}`],
              ['Reference', f.reference || 'None given'],
              ['For', [sub.service !== 'Additional files' ? sub.service : '', f.teeth.length ? `teeth ${f.teeth.join(', ')}` : ''].filter(Boolean).join(' · ') || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3 text-xs"><span className="w-20 flex-shrink-0 text-[#717182]">{k}</span><span className="text-[#030213] min-w-0 break-words">{v}</span></div>
            ))}
          </div>
          {f.comments && (
            <div className="rounded-xl bg-[#F8F9FC] border border-[#F0EFF6] px-3 py-2.5">
              <p className="text-[10px] font-bold text-[#1565C0] uppercase tracking-wider mb-1">Notes for the lab</p>
              <p className="text-xs text-[#030213] leading-relaxed whitespace-pre-wrap">{f.comments}</p>
            </div>
          )}
          <div><FileList files={sub.files} title={`Files (${n})`} /></div>
        </aside>

        {/* Which case */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[#030213]">Which case do these belong to?</h2>
            <p className="text-sm text-[#717182] mt-0.5">
              {f.reference ? `"${f.reference}" didn't match a case at ${sub.practice} exactly, so ` : 'No case reference was given, so '}
              nothing has been attached yet. Pick the case and the files go into its attachments. If it isn't here (for example the original scan never reached you), create a new case from them.
            </p>
          </div>

          {suggestions.length === 0 && <div className="rounded-xl border border-dashed border-[#E0E0E6] bg-white px-4 py-6 text-center text-sm text-[#717182]">No likely cases found. Search for the case below.</div>}
          <div className="space-y-3">
            {all.map(m => (
              <RescanMatchCard key={m.case.id} match={m} selected={selected === m.case.id} onSelect={() => setSelected(m.case.id)}
                onOpenCase={() => window.open(`/growth/cases/${encodeURIComponent(m.case.id)}`, '_blank', 'noopener')} />
            ))}
          </div>

          <div className="bg-white border border-[#E0E0E6] rounded-xl p-3">
            <p className="text-xs font-semibold text-[#030213] mb-2">Not listed? Find the case</p>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E0E0E6] focus-within:border-[#4D8EF7]">
              <Search className="w-4 h-4 text-[#A0A0B0]" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Case ID, patient, practice, dentist or scanner ref" className="flex-1 text-sm focus:outline-none" />
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
        </main>
      </div>

      <footer className="flex-shrink-0 bg-white border-t border-[#E0E0E6] px-4 py-3 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => { dismissFiles(sub.ref); toast.success(`${sub.ref} dismissed. It stays in the LabLink log.`); navigate('/growth/cases'); }}>Not a match</Button>
        <div className="flex items-center gap-2">
        <Button variant="outline" icon={<FilePlus2 className="w-4 h-4" />} onClick={createNew}>Create a new case from these</Button>
        <Button icon={<Paperclip className="w-4 h-4" />} disabled={!target} onClick={attach}>
          {target ? `Attach ${n} file${n === 1 ? '' : 's'} to ${target.case.id}` : 'Pick a case'}
        </Button>
        </div>
      </footer>
    </div>
  );
}
