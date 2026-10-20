import { useState } from 'react';
import { Link2, Mail, MessageCircle, MonitorSmartphone, Plus, Send, Trash2, Upload } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import { useToast } from '../../../src/app/context/ToastContext';
import { detectProvider, type DesignFile } from '../../design-studio/data/designStudio';
import { FileDropZone, FileList } from '../../design-studio/components/FileChips';
import { useBilling } from '../../lab-billing/billingStore';
import type { ApprovalRound, CadOrder, DesignedLine } from '../types';
import { designDiff } from '../engine';
import { bringInDesign, sendForApproval, sendToPartner, useCad } from '../cadStore';
import { btn, btnPrimary, Field, input, inputSm, Note, Seg } from '../../lab-billing/ui';

// ── 3. Bring in the design (manual return) · Send for approval · Send to partner

const teethText = (t: number[]) => t.join(', ');
const parseTeeth = (v: string) => [...new Set(v.split(/[\s,;]+/).map(Number).filter(n => (n >= 11 && n <= 48) || (n >= 51 && n <= 85)))];

/**
 * The design comes back by hand for now: the technician pastes the share link
 * from exocad (webview) or 3Shape Communicate, or uploads the STL export and
 * screenshots, then confirms what was actually designed.
 */
export function BringInDesignModal({ order, onClose }: { order: CadOrder; onClose: () => void }) {
  const { toast } = useToast();
  const billing = useBilling();
  const [source, setSource] = useState<'link' | 'upload'>('link');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<DesignFile[]>([]);
  const [lines, setLines] = useState<(DesignedLine & { teethText: string })[]>(() =>
    order.lines.filter(l => l.itemId).map(l => ({ id: l.id, itemId: l.itemId!, fdi: l.fdi, teethText: teethText(l.fdi) })));
  const match = url.trim() ? detectProvider(url) : null;
  const designed = lines.map(l => ({ id: l.id, itemId: l.itemId, fdi: parseTeeth(l.teethText) })).filter(l => l.fdi.length || !order.lines.find(x => x.id === l.id)?.fdi.length);
  const diff = designDiff(order, designed);
  const ready = source === 'link' ? !!url.trim() : files.length > 0;
  const items = billing.catalog.filter(i => !i.archived && i.department !== 'Orthodontics');

  function save() {
    const r = bringInDesign(order.caseId, { url: source === 'link' ? url.trim() : undefined, files: source === 'upload' ? files : [], lines: designed });
    toast.success(r?.diff.length ? `Design added. It differs from the case, so the invoice draft was updated and flagged.` : order.approvalNeeded ? 'Design added. Send it to the dentist for approval next.' : 'Design added: ready to manufacture (no approval needed).');
    onClose();
  }

  return (
    <Modal isOpen onClose={onClose} size="lg" title={`Bring in the design · ${order.caseId}`} footer={
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#717182]">{order.approvalNeeded ? 'Needs the dentist\'s approval: send it next.' : 'No approval needed for this restoration type: it goes to Ready to manufacture.'}</span>
        <div className="flex gap-2"><button className={btn} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={!ready} onClick={save}>Add the design</button></div>
      </div>
    }>
      <div className="space-y-4">
        <Note>exocad and 3Shape don't send the finished design to Smile Genius on their own yet. Paste the share link from {order.cad === '3shape' ? '3Shape Communicate' : 'exocad webview / DentalShare'}, or upload the STL export and screenshots.</Note>
        <Seg value={source} onChange={setSource} options={[{ value: 'link', label: 'Paste a share link' }, { value: 'upload', label: 'Upload files' }]} />
        {source === 'link' ? (
          <Field label="Design share link" hint={match ? (match.provider === 'generic' ? 'Not a link we recognise, but it will still open for the dentist.' : `Detected: ${match.label}${match.embeddable ? ' (shows inside the review page)' : ' (opens in a new tab for the dentist)'}`) : 'e.g. https://webview.exocad.com/… or https://communicate.3shape.com/…'}>
            <input className={`${input} font-mono text-xs`} value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste the link from exocad or 3Shape" autoFocus />
          </Field>
        ) : (
          <div className="space-y-2">
            <FileDropZone uploadedBy="lab" onAdded={f => setFiles(x => [...x, ...f])} title="Drop the STL export and screenshots (front, occlusal, contacts)" />
            <FileList files={files} onRemove={id => setFiles(x => x.filter(f => f.id !== id))} />
          </div>
        )}
        <div className="rounded-xl border border-[#E0E0E6] p-3 space-y-2">
          <p className="text-xs font-semibold text-[#030213]">What was designed</p>
          <p className="text-[11px] text-[#717182]">Prefilled from the case. Change it if the design differs (an extra unit, a crown that became an onlay): the invoice draft follows what was designed.</p>
          {lines.map((l, i) => (
            <div key={l.id} className="flex flex-wrap items-center gap-1.5">
              <select className={inputSm} value={l.itemId} onChange={e => setLines(x => x.map((y, k) => (k === i ? { ...y, itemId: e.target.value } : y)))}>{items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}</select>
              <input className={`${inputSm} w-40`} value={l.teethText} onChange={e => setLines(x => x.map((y, k) => (k === i ? { ...y, teethText: e.target.value } : y)))} placeholder="Teeth (FDI), e.g. 11, 21" />
              <button className="text-[#A0A0B0] hover:text-[#C62828]" onClick={() => setLines(x => x.filter((_, k) => k !== i))}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7]" onClick={() => setLines(x => [...x, { id: `add-${x.length}-${Date.now().toString(36)}`, itemId: items[0]?.id ?? 'crn', fdi: [], teethText: '' }])}><Plus className="w-3 h-3" /> Add a unit</button>
          {diff.length > 0 && <Note tone="amber"><b>Differs from the case:</b> {diff.join('; ')}. The invoice draft is repriced and flagged for the admin.</Note>}
        </div>
      </div>
    </Modal>
  );
}

/** Send the design to the dentist for approval, through a Design Studio review link. */
export function SendForApprovalModal({ order, onClose }: { order: CadOrder; onClose: () => void }) {
  const { toast } = useToast();
  const [note, setNote] = useState(order.rounds.length ? 'Updated with your changes, please take another look.' : 'Here is the design for your approval.');
  const [channel, setChannel] = useState<ApprovalRound['channel']>('whatsapp');
  const [shots, setShots] = useState<DesignFile[]>([]);
  const round = order.rounds.length + 1;
  return (
    <Modal isOpen onClose={onClose} size="lg" title={`Send for approval · ${order.caseId}`} footer={
      <div className="flex justify-end gap-2"><button className={btn} onClick={onClose}>Cancel</button><button className={btnPrimary} onClick={() => { const link = sendForApproval(order.caseId, { note, channel, extraFiles: shots }); if (link) { toast.success(`Sent to the dentist: review link ${link.token}`); onClose(); } }}><Send className="w-3.5 h-3.5" /> Send round {round}</button></div>
    }>
      <div className="space-y-4">
        {order.callDentist && <Note tone="red">This would be round {round}. Changes were requested twice already: a quick call with the dentist first usually saves another round.</Note>}
        <div className="text-xs text-[#5A5568]">
          Design: {order.design?.sourceUrl ? <a className="text-[#4D8EF7] font-mono" href={order.design.sourceUrl} target="_blank" rel="noreferrer">{order.design.sourceUrl}</a> : `${order.design?.files.length ?? 0} uploaded file(s)`}
        </div>
        <div>
          <p className="text-xs font-semibold text-[#030213] mb-1">Screenshots (front, occlusal, contacts)</p>
          <FileDropZone uploadedBy="lab" compact onAdded={f => setShots(x => [...x, ...f])} title="Add screenshots from CAD" hint="PNG or JPG" />
          <FileList files={shots} onRemove={id => setShots(x => x.filter(f => f.id !== id))} />
          <p className="text-[11px] text-[#A0A0B0] mt-1">The connector can't capture screenshots automatically yet, so add them here if the link doesn't show the design.</p>
        </div>
        <Field label="Note to the dentist"><textarea className={input} rows={3} value={note} onChange={e => setNote(e.target.value)} /></Field>
        <Field label="Send through the case's usual channel">
          <Seg value={channel} onChange={setChannel} options={[{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'email', label: 'Email' }, { value: 'portal', label: 'Practice portal' }]} />
        </Field>
        <p className="text-[11px] text-[#717182] inline-flex items-center gap-1">{channel === 'whatsapp' ? <MessageCircle className="w-3 h-3" /> : channel === 'email' ? <Mail className="w-3 h-3" /> : <MonitorSmartphone className="w-3 h-3" />} The dentist opens the design on their phone and taps Approve or Request changes. If they haven't replied in {useCad().settings.reminderHours} hours they get one reminder, then the lab is alerted.</p>
      </div>
    </Modal>
  );
}

/** Send a case to a design or milling partner: they get a secure link, no account needed. */
export function SendToPartnerModal({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const s = useCad();
  const { toast } = useToast();
  const [kind, setKind] = useState<'design' | 'milling'>('design');
  const options = s.partners.filter(p => p.active && (p.does === 'both' || p.does === kind));
  const [partnerId, setPartnerId] = useState(options[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const p = s.partners.find(x => x.id === partnerId);
  return (
    <Modal isOpen onClose={onClose} title={`Send ${caseId} to a partner`} footer={
      <div className="flex justify-end gap-2"><button className={btn} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={!p} onClick={() => { const t = sendToPartner(caseId, partnerId, kind, message.trim() || undefined); if (t) { navigator.clipboard?.writeText(`${window.location.origin}/partner/${t}`).catch(() => {}); toast.success(`Sent to ${p!.name}; their link is copied`); onClose(); } }}><Send className="w-3.5 h-3.5" /> Send to {p?.name ?? 'partner'}</button></div>
    }>
      <div className="space-y-3">
        <Field label="What for"><Seg value={kind} onChange={v => { setKind(v); setPartnerId(s.partners.find(x => x.active && (x.does === 'both' || x.does === v))?.id ?? ''); }} options={[{ value: 'design', label: 'Design' }, { value: 'milling', label: 'Milling' }]} /></Field>
        <Field label="Partner"><select className={input} value={partnerId} onChange={e => setPartnerId(e.target.value)}>{options.map(x => <option key={x.id} value={x.id}>{x.name} · {x.turnaroundDays}-day turnaround</option>)}</select></Field>
        <Field label="Message (optional)"><textarea className={input} rows={2} value={message} onChange={e => setMessage(e.target.value)} placeholder="Anything they should know" /></Field>
        <Note><Link2 className="w-3 h-3 inline -mt-0.5" /> They get a secure link to download the scans, the order details and the dentist's instructions, and to upload the {kind === 'design' ? 'finished design' : 'tracking number'}. No account or file-transfer service needed.</Note>
        {p && <p className="text-[11px] text-[#717182] inline-flex items-center gap-1"><Upload className="w-3 h-3" /> Due back {new Date(Date.now() + p.turnaroundDays * 86_400_000).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}; you're alerted if it's {s.settings.partnerOverdueDays} day{s.settings.partnerOverdueDays === 1 ? '' : 's'} late.</p>}
      </div>
    </Modal>
  );
}
