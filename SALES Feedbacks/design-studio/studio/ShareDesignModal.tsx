import { useMemo, useState } from 'react';
import { Check, Link2, Paperclip, Upload } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import Button from '../../../src/app/components/Button';
import { useToast } from '../../../src/app/context/ToastContext';
import { DesignFile, DesignKind, detectProvider, KIND_LABEL, LAB_MEMBERS, ReviewLink, StudioCase } from '../data/designStudio';
import { clinicianFiles, latestVersion, shareDesign } from '../store/studioStore';
import { FileDropZone, FileList } from '../components/FileChips';

const QUICK_NOTES = ['Please check incisal edge position and midline', 'Please approve staging and IPR before we print.'];
const EXPIRY = [7, 14, 30];

export default function ShareDesignModal({ studioCase, onClose, onShared }: {
  studioCase: StudioCase;
  onClose: () => void;
  onShared: (link: ReviewLink) => void;
}) {
  const { toast } = useToast();
  const prev = studioCase.versions.length ? latestVersion(studioCase) : undefined;
  const [source, setSource] = useState<'link' | 'upload'>('link');
  const [files, setFiles] = useState<DesignFile[]>([]);
  const fromDentist = prev ? clinicianFiles(prev) : [];
  const [carry, setCarry] = useState<string[]>([]);
  const [url, setUrl] = useState('');
  const [touched, setTouched] = useState(false);
  const match = useMemo(() => (url.trim() ? detectProvider(url) : null), [url]);
  const [kindOverride, setKindOverride] = useState<DesignKind | null>(null);
  const kind: DesignKind = kindOverride ?? (source === 'link' ? match?.kindHint : undefined) ?? studioCase.kind;
  const [name, setName] = useState(studioCase.dentist);
  const [email, setEmail] = useState(studioCase.dentistEmail);
  const [note, setNote] = useState('');
  const [expiry, setExpiry] = useState(14);
  const [sender, setSender] = useState(studioCase.kind === 'aligner-plan' ? 'Anas' : 'Mark');
  const validUrl = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i.test(url.trim());

  const carried = fromDentist.filter(f => carry.includes(f.id));
  const ready = source === 'link' ? !!url.trim() : files.length + carried.length > 0;

  function submit() {
    if (source === 'link' && (!validUrl || !match)) { setTouched(true); return; }
    const link = shareDesign({
      caseId: studioCase.caseId,
      sourceUrl: source === 'link' ? (url.trim().match(/^https?:\/\//i) ? url.trim() : `https://${url.trim()}`) : '',
      provider: source === 'link' ? match!.provider : 'upload', kind, recipientName: name.trim(), recipientEmail: email.trim(),
      note: note.trim(), expiresInDays: expiry, uploadedBy: sender,
      files: source === 'upload' || carried.length ? [...(source === 'upload' ? files : []), ...carried] : undefined,
    });
    toast.success(`Review link sent to ${name.trim()}`);
    onShared(link);
  }

  const field = 'w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm text-[#030213] placeholder:text-[#A0A0B0] focus:outline-none focus:border-[#4D8EF7]';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={prev ? `Share Version ${prev.number + 1}` : 'Share a design'}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!ready || !name.trim() || !email.trim()}>Create review link</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="inline-flex p-0.5 bg-[#F8F9FC] border border-[#E0E0E6] rounded-lg">
          {([['link', 'Paste a link', Link2], ['upload', 'Upload files', Upload]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setSource(id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${source === id ? 'bg-white text-[#4D8EF7] shadow-sm' : 'text-[#717182]'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {fromDentist.length > 0 && (
          <div className="rounded-xl border border-[#E0E0E6] bg-[#F8F9FC] px-3 py-2.5 space-y-2">
            <p className="text-xs font-semibold text-[#030213] flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5 text-[#717182]" /> From {studioCase.dentist} on V{prev!.number}</p>
            <FileList files={fromDentist} />
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {fromDentist.map(f => (
                <label key={f.id} className="inline-flex items-center gap-1.5 text-[11px] text-[#717182] cursor-pointer">
                  <input type="checkbox" className="accent-[#4D8EF7]" checked={carry.includes(f.id)} onChange={e => setCarry(c => (e.target.checked ? [...c, f.id] : c.filter(x => x !== f.id)))} />
                  Include {f.name} in the next version
                </label>
              ))}
            </div>
          </div>
        )}

        {source === 'upload' ? (
          <div className="space-y-2">
            <FileDropZone uploadedBy="lab" onAdded={added => setFiles(f => [...f, ...added])} title="Drop the design files here or browse" />
            <FileList files={files} onRemove={id => setFiles(f => f.filter(x => x.id !== id))} />
            <p className="text-[11px] text-[#717182]">No design link? Upload the STL / OBJ / PLY export, renders or a PDF report. The dentist reviews them on the same secure page.</p>
          </div>
        ) : (
        <div>
          <label className="text-xs font-medium text-[#717182]">Design link</label>
          <input
            autoFocus
            value={url}
            onChange={e => setUrl(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Paste the share link from exocad, 3Shape Communicate, ClinCheck…"
            className={`${field} mt-1 font-mono text-xs`}
          />
          {touched && url.trim() && !validUrl && <p className="text-[11px] text-[#D4183D] mt-1">That doesn't look like a link — check you copied the whole URL.</p>}
          {match && validUrl && (
            match.provider === 'generic' ? (
              <div className="mt-2 rounded-xl border border-[#FDE68A] bg-[#FFF8E1] px-3 py-2.5">
                <p className="text-xs font-semibold text-[#B45309]">We'll link it as-is — tell us what it is</p>
                <div className="flex gap-4 mt-2">
                  {(['smile-design', 'aligner-plan'] as DesignKind[]).map(k => (
                    <label key={k} className="inline-flex items-center gap-1.5 text-xs text-[#030213] cursor-pointer">
                      <input type="radio" checked={kind === k} onChange={() => setKindOverride(k)} className="accent-[#4D8EF7]" /> {KIND_LABEL[k]}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-2 inline-flex rounded-full p-px bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-xs font-semibold text-[#030213]">
                  <Link2 className="w-3.5 h-3.5 text-[#4D8EF7]" /> {match.label} detected <Check className="w-3.5 h-3.5 text-[#047857]" />
                  {!match.embeddable && <span className="font-normal text-[#717182]">· opens in a new tab</span>}
                </span>
              </div>
            )
          )}
        </div>

        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-[#717182]">Design type</label>
            <div className="mt-1 inline-flex p-0.5 bg-[#F8F9FC] border border-[#E0E0E6] rounded-lg w-full">
              {(['smile-design', 'aligner-plan'] as DesignKind[]).map(k => (
                <button key={k} onClick={() => setKindOverride(k)} className={`flex-1 px-2 py-1.5 rounded-md text-xs font-semibold ${kind === k ? 'bg-white text-[#4D8EF7] shadow-sm' : 'text-[#717182]'}`}>
                  {k === 'smile-design' ? 'Smile design' : 'Aligner treatment plan'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[#717182]">Link expires</label>
            <div className="mt-1 inline-flex p-0.5 bg-[#F8F9FC] border border-[#E0E0E6] rounded-lg w-full">
              {EXPIRY.map(d => (
                <button key={d} onClick={() => setExpiry(d)} className={`flex-1 px-2 py-1.5 rounded-md text-xs font-semibold ${expiry === d ? 'bg-white text-[#4D8EF7] shadow-sm' : 'text-[#717182]'}`}>
                  {d} days
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-4">
          <div>
            <label className="text-xs font-medium text-[#717182]">Send to</label>
            <select value={name} onChange={e => setName(e.target.value)} className={`${field} mt-1`}>
              <option>{studioCase.dentist}</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#717182]">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} className={`${field} mt-1`} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[#717182]">Covering note</label>
            <span className="text-[10px] text-[#A0A0B0]">{note.length}/500</span>
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 500))} rows={3} placeholder="What should the dentist look at?" className={`${field} mt-1 resize-none`} />
          <div className="flex flex-wrap gap-2 mt-2">
            {QUICK_NOTES.map(q => (
              <button key={q} onClick={() => setNote(n => (n ? `${n.trim()} ${q}` : q).slice(0, 500))} className="px-2.5 py-1 rounded-full border border-[#E0E0E6] text-[11px] text-[#717182] hover:border-[#4D8EF7] hover:text-[#4D8EF7]">
                + {q}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#717182]">
          Sending as
          <select value={sender} onChange={e => setSender(e.target.value)} className="px-2 py-1 rounded-lg border border-[#E0E0E6] text-xs text-[#030213] focus:outline-none">
            {LAB_MEMBERS.map(m => <option key={m.id}>{m.name}</option>)}
          </select>
          <span className="text-[#A0A0B0]">· the case moves to Sent for Review</span>
        </div>
      </div>
    </Modal>
  );
}
