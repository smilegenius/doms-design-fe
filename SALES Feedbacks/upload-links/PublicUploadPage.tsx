import { ReactNode, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Clock, KeyRound, Lock, Send, ShieldCheck, UploadCloud, XCircle } from 'lucide-react';
import Button from '../../src/app/components/Button';
import { SmileGeniusLogo } from '../design-studio/review/SmileGeniusLogo';
import { FileDropZone, FileList } from '../design-studio/components/FileChips';
import { DesignFile, formatBytes } from '../design-studio/data/designStudio';
import { portalDate } from '../lab-prescription-inbox/data';
import { CLINICAL_HINT, storeClinicalFiles } from './clinicalFiles';
import PublicViewSummary from './PublicViewSummary';
import {
  addUploadBatch, findLink, linkState, markOpened, MAX_CODE_ATTEMPTS, REQUEST_KINDS, sentCount, useUploadLinks, verifyCode,
} from './uploadStore';

// ── /upload/:token — the clinic's side of an upload link ─────────────────────
// Public (no sign-in) and mobile-first: it's usually opened from WhatsApp.
// It reads only the link's allow-listed snapshot (link.view) and is
// write-only: the clinic can send files but never sees what's already there.

const shortName = (n: string) => { const [a, b] = n.split(' '); return b ? `${a} ${b[0]}.` : a; };

function Shell({ lab, children }: { lab?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <header className="h-14 bg-white border-b border-[#E0E0E6] px-4 flex items-center gap-3">
        <SmileGeniusLogo className="w-28 h-auto flex-shrink-0" />
        {lab && <><span className="w-px h-6 bg-[#F0EFF6]" /><p className="text-xs font-semibold text-[#030213] truncate">{lab}</p></>}
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[#047857]"><ShieldCheck className="w-3.5 h-3.5" /> Secure upload</span>
      </header>
      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">{children}</main>
    </div>
  );
}

function Dead({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <Shell>
      <div className="bg-white border border-[#E0E0E6] rounded-2xl px-6 py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-[#F8F9FC] flex items-center justify-center mx-auto mb-4">{icon}</div>
        <h1 className="text-lg font-semibold text-[#030213] mb-1">{title}</h1>
        <p className="text-sm text-[#717182] max-w-sm mx-auto">{body}</p>
      </div>
    </Shell>
  );
}

const okKey = (t: string) => `salesFeedbacks.upload.ok.${t}`;
const readOk = (t: string) => { try { return sessionStorage.getItem(okKey(t)) === '1'; } catch { return false; } };

export default function PublicUploadPage() {
  const { token = '' } = useParams();
  useUploadLinks();
  const link = findLink(token);
  const [verified, setVerified] = useState(() => readOk(token));
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [pending, setPending] = useState<DesignFile[]>([]);
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState<number | null>(null);

  const needsCode = !!link?.code && !verified;
  useEffect(() => { if (link && !needsCode && linkState(link) === 'active') markOpened(token); }, [token, needsCode, link]);
  useEffect(() => { document.title = link ? `Upload files · ${link.labName}` : 'Upload files'; }, [link]);

  if (!link) return <Dead icon={<XCircle className="w-7 h-7 text-[#A0A0B0]" />} title="This link doesn't work" body="Check you have the whole link, or ask the lab to send it again." />;
  const st = linkState(link);
  if (st === 'revoked') return <Dead icon={<XCircle className="w-7 h-7 text-[#B91C1C]" />} title="This link has been turned off" body={`${link.labName} has closed this upload link. If they still need files, ask them for a new one.`} />;
  if (st === 'expired') return <Dead icon={<Clock className="w-7 h-7 text-[#717182]" />} title="This link has expired" body={`Upload links stay open for a limited time. Ask ${link.labName} for a new one.`} />;
  if (st === 'locked') return <Dead icon={<Lock className="w-7 h-7 text-[#B45309]" />} title="Too many attempts" body="The wrong access code was entered too many times. Try again in 15 minutes, or ask the lab for the code." />;

  if (needsCode) {
    const submit = () => {
      const r = verifyCode(token, code);
      if (r.ok) { try { sessionStorage.setItem(okKey(token), '1'); } catch { /* per-visit only */ } setVerified(true); return; }
      setCode('');
      setCodeError(r.locked ? '' : `That code isn't right. ${r.remaining} attempt${r.remaining === 1 ? '' : 's'} left.`);
    };
    return (
      <Shell lab={link.labName}>
        <div className="bg-white border border-[#E0E0E6] rounded-2xl px-6 py-8">
          <div className="w-12 h-12 rounded-xl bg-[#EEF4FF] flex items-center justify-center mb-4"><KeyRound className="w-6 h-6 text-[#4D8EF7]" /></div>
          <h1 className="text-lg font-semibold text-[#030213] mb-1">Enter the access code</h1>
          <p className="text-sm text-[#717182] mb-5">{link.labName} sent you a 6-digit code separately from this link.</p>
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setCodeError(''); }}
            onKeyDown={e => { if (e.key === 'Enter' && code.length === 6) submit(); }}
            placeholder="••••••"
            aria-label="Access code"
            className="w-full text-center text-2xl font-mono tracking-[0.5em] px-3 py-3 rounded-xl border border-[#E0E0E6] focus:outline-none focus:border-[#4D8EF7]"
          />
          {codeError && <p className="text-xs text-[#B91C1C] mt-2">{codeError}</p>}
          <Button className="w-full mt-4" disabled={code.length !== 6} onClick={submit}>Continue</Button>
          <p className="text-[11px] text-[#A0A0B0] mt-3 text-center">After {MAX_CODE_ATTEMPTS} wrong attempts the link locks for 15 minutes.</p>
        </div>
      </Shell>
    );
  }

  const total = pending.reduce((n, f) => n + f.size, 0);
  const send = () => {
    if (!pending.length || !consent) return;
    if (addUploadBatch(token, pending, name)) { setSent(pending.length); setPending([]); setConsent(false); window.scrollTo(0, 0); }
  };

  return (
    <Shell lab={link.labName}>
      {sent !== null ? (
        <div className="bg-white border border-[#A7F3D0] rounded-2xl px-6 py-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-[#047857] mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-[#030213]">Sent to {link.labName}</h1>
          <p className="text-sm text-[#717182] mt-1">{sent} file{sent === 1 ? '' : 's'} added to case {link.view.caseRef}. The lab has been notified.</p>
          <p className="text-xs text-[#A0A0B0] mt-3">You've sent {sentCount(token)} file{sentCount(token) === 1 ? '' : 's'} to this link in total.</p>
          <Button variant="outline" className="mt-5" icon={<UploadCloud className="w-4 h-4" />} onClick={() => setSent(null)}>Upload more</Button>
        </div>
      ) : (
        <>
          <div>
            <h1 className="text-xl font-semibold text-[#030213]">{link.labName} needs files for this case</h1>
            <p className="text-sm text-[#717182] mt-1">Requested by {shortName(link.createdBy)} · open until {portalDate(new Date(link.expiresAt))}</p>
          </div>

          <div className="bg-white border border-[#E0E0E6] rounded-2xl px-4 py-3">
            <PublicViewSummary view={link.view} />
          </div>

          <div className="bg-white border border-[#E0E0E6] rounded-2xl p-4">
            <p className="text-sm font-semibold text-[#030213] mb-2">What the lab is asking for</p>
            <ul className="space-y-1.5">
              {link.requested.map(r => {
                const k = REQUEST_KINDS.find(x => x.id === r)!;
                return (
                  <li key={r} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#4D8EF7] flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-[#030213]">{k.label} <span className="text-xs text-[#717182]">· {k.hint}</span></span>
                  </li>
                );
              })}
            </ul>
            {link.note && <p className="mt-3 text-sm text-[#030213] bg-[#F8F9FC] border border-[#F0EFF6] rounded-lg px-3 py-2"><span className="text-[#717182]">Note from the lab · </span>{link.note}</p>}
          </div>

          <div className="bg-white border border-[#E0E0E6] rounded-2xl p-4 space-y-3">
            <FileDropZone
              uploadedBy="clinician"
              store={storeClinicalFiles}
              accept=""
              folder
              title="Add files"
              hint={CLINICAL_HINT}
              onAdded={files => setPending(p => [...p, ...files])}
            />
            {pending.length > 0 && (
              <>
                <FileList files={pending} onRemove={id => setPending(p => p.filter(f => f.id !== id))} />
                <p className="text-[11px] text-[#717182]">{pending.length} item{pending.length === 1 ? '' : 's'} · {formatBytes(total)}</p>
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-[#030213] mb-1">Your name <span className="text-[#A0A0B0] font-normal">(optional, so the lab knows who sent them)</span></label>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="e.g. Hannah, dental nurse" className="w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm focus:outline-none focus:border-[#4D8EF7]" />
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 accent-[#4D8EF7]" />
              <span className="text-xs text-[#5A5568]">I'm authorised to share these files with {link.labName} for this patient's treatment.</span>
            </label>
            <Button className="w-full" icon={<Send className="w-4 h-4" />} disabled={!pending.length || !consent} onClick={send}>
              Send {pending.length ? `${pending.length} item${pending.length === 1 ? '' : 's'} ` : ''}to the lab
            </Button>
          </div>

          <p className="text-[11px] text-[#A0A0B0] text-center px-4">
            Files go straight to the lab's case. This page can't show files that were sent before, so it's safe if the link is forwarded by mistake.
          </p>
        </>
      )}
    </Shell>
  );
}
