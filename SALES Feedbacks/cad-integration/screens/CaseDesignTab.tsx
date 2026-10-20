import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Copy, Download, ExternalLink, Hourglass, Link2, Loader2, PenTool, PhoneCall, Send, ServerOff, Share2, Truck } from 'lucide-react';
import { useToast } from '../../../src/app/context/ToastContext';
import type { Case } from '../../../src/app/pages/CasesPage';
import OrderPanelTab from '../../intake-form/OrderPanelTab';
import { caseFiles } from '../../bulk-actions/caseContent';
import { buildZip, saveBlob, type ZipEntry } from '../../bulk-actions/zip';
import { getFile } from '../../design-studio/store/fileStore';
import { FileList } from '../../design-studio/components/FileChips';
import type { CadOrder } from '../types';
import { CAD_LABEL, caseOf, INDICATIONS, isCadCase, MATERIALS, STATUS_LABEL, TECHNICIANS, waitingLabel } from '../engine';
import {
  assignTech, cancelOrder, createOrder, moveTo, openedInCad, pickIndication, receivedBack, remindDentist, resolveDuplicate, scansArrived, setOrderCad, syncCad, useCad,
} from '../cadStore';
import { BringInDesignModal, SendForApprovalModal, SendToPartnerModal } from './CaseModals';
import { btn, btnPrimary, inputSm, Note, Pill } from '../../lab-billing/ui';

// ── 2. Case design panel: a "CAD design" tab in the case's order form panel ──

/** Set before a deep link clicks through the Cases list (?sf=cad is lost on the way). */
export const pendingCadTab = { value: false };

export default function CaseDesignTab({ caseId }: { caseId: string }) {
  const [open] = useState(() => { const v = new URLSearchParams(window.location.search).get('sf') === 'cad' || pendingCadTab.value; pendingCadTab.value = false; return v; });
  useEffect(() => { syncCad(); }, [caseId]);
  // Multi-service cases open on "Case Summary": step into the first service so the tab shows.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      if ([...document.querySelectorAll('main button')].some(b => b.textContent?.trim() === 'Lab Documents')) return;
      const summary = [...document.querySelectorAll<HTMLElement>('main button')].find(b => b.textContent?.trim() === 'Case Summary');
      (summary?.nextElementSibling as HTMLElement | null)?.click();
    }, 700);
    return () => window.clearTimeout(t);
  }, [open]);
  const s = useCad();
  const c = caseOf(caseId);
  if (!c) return null;
  const o = s.orders[caseId];
  return (
    <OrderPanelTab tabKey="cad" label="CAD design" icon={<PenTool className="w-3.5 h-3.5" />} openOnLoad={open}>
      {o ? <Panel o={o} c={c} /> : <NoOrder c={c} />}
    </OrderPanelTab>
  );
}

function NoOrder({ c }: { c: Case }) {
  const s = useCad();
  const { toast } = useToast();
  const [partner, setPartner] = useState(false);
  const digital = isCadCase(c);
  return (
    <div className="space-y-3 text-xs">
      <p className="text-[#5A5568]">{digital ? `No CAD order yet. ${s.settings.createOn === 'accepted' ? 'Orders are created when a case is accepted; this one came in before the integration, so create it here.' : 'Orders are created by hand (CAD settings).'}` : 'This case has no digital scans or is ortho work, so it doesn\'t go through CAD. You can still send it to a partner.'}</p>
      <div className="flex flex-wrap gap-2">
        {digital && (s.settings.cad === 'both' || s.settings.cad === 'exocad') && <button className={btnPrimary} onClick={() => { createOrder(c.id, 'exocad'); toast.success('CAD order created in exocad, with the scans attached'); }}>Create exocad order</button>}
        {digital && (s.settings.cad === 'both' || s.settings.cad === '3shape') && <button className={s.settings.cad === '3shape' ? btnPrimary : btn} onClick={() => { createOrder(c.id, '3shape'); toast.success('CAD order created in 3Shape, with the scans attached'); }}>Create 3Shape order</button>}
        <button className={btn} onClick={() => setPartner(true)}><Share2 className="w-3.5 h-3.5" /> Send to a partner</button>
      </div>
      {partner && <SendToPartnerModal caseId={c.id} onClose={() => setPartner(false)} />}
    </div>
  );
}

function Panel({ o, c }: { o: CadOrder; c: Case }) {
  const s = useCad();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [modal, setModal] = useState<'bring' | 'approve' | 'partner' | null>(null);
  const [zipping, setZipping] = useState(false);
  const con = s.connectors.find(x => x.id === o.connectorId);
  const job = s.jobs.find(j => j.token === o.partnerJobId);
  const partner = job ? s.partners.find(p => p.id === job.partnerId) : undefined;
  const r = o.rounds[o.rounds.length - 1];
  const cadName = o.cad === 'exocad' ? 'exocad' : o.cad === '3shape' ? '3Shape' : 'the partner';
  const canSend = o.approvalNeeded && o.design && ['in-design', 'design-received'].includes(o.status);
  const tone = o.status === 'cancelled' ? 'gray' : ['ready', 'manufacturing', 'finishing', 'dispatched', 'received-back'].includes(o.status) ? 'green' : o.status === 'awaiting-dentist' ? 'amber' : 'blue';

  async function pack() {
    setZipping(true);
    const dir = o.caseId;
    const entries: ZipEntry[] = [{ path: `${dir}/order.txt`, data: orderSheet(o, c) }];
    for (const sc of o.scans.filter(x => x.name.startsWith(o.caseId))) entries.push({ path: `${dir}/scans/${sc.name}`, data: placeholderStl(sc.name) });
    for (const { file } of caseFiles(c)) { const b = await getFile(file.id); if (b) entries.push({ path: `${dir}/files/${file.name}`, data: b }); }
    saveBlob(await buildZip(entries), `${o.caseId}_scan-pack.zip`);
    setZipping(false);
    toast.success(`Scan pack downloaded: ${entries.length} files with standard names`);
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Pill tone={tone as never}>{STATUS_LABEL[o.status]}</Pill>
          <Pill tone={o.cad === 'exocad' ? 'blue' : o.cad === '3shape' ? 'purple' : 'gray'}>{CAD_LABEL[o.cad]}</Pill>
          {o.approvalNeeded ? <Pill tone="amber">Needs dentist approval</Pill> : <Pill>No approval needed</Pill>}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {o.cad !== 'partner' && (
            <select className={inputSm} value={o.technician ?? ''} onChange={e => { assignTech(o.caseId, e.target.value || null); toast.success(e.target.value ? `Assigned to ${e.target.value}` : 'Unassigned'); }}>
              <option value="">Unassigned</option>{TECHNICIANS.map(t => <option key={t}>{t}</option>)}
            </select>
          )}
          <button className="text-[11px] text-[#4D8EF7] font-semibold hover:underline" onClick={() => navigate('/growth/design')}>Design board</button>
        </span>
      </div>

      {o.queued && <Note tone="red"><ServerOff className="w-3 h-3 inline -mt-0.5" /> The {cadName} connector{con ? ` on ${con.pc}` : ''} is offline, so this order is queued. It's written to {cadName} as soon as it reconnects.</Note>}
      {o.status === 'waiting-scans' && <Note tone="amber"><Hourglass className="w-3 h-3 inline -mt-0.5" /> The order is created but the scans are still downloading from the scanner portal. They're added to the order when they arrive. <button className="underline font-semibold" onClick={() => scansArrived(o.caseId)}>Scans arrived (demo)</button></Note>}
      {o.linkedFromInbox && <Note><Link2 className="w-3 h-3 inline -mt-0.5" /> This TRIOS case was already in 3Shape's own inbox ({o.linkedFromInbox}), so Smile Genius linked to that order instead of creating a second one.</Note>}
      {o.duplicate && (
        <Note tone="amber">
          <Copy className="w-3 h-3 inline -mt-0.5" /> A second order with the same patient and teeth was made by hand in {cadName} ({o.duplicate.otherRef}, by {o.duplicate.createdBy}). Which one stays linked?
          <span className="flex flex-wrap gap-2 mt-1.5"><button className={btn} onClick={() => resolveDuplicate(o.caseId, 'ours')}>Keep the Smile Genius order</button><button className={btn} onClick={() => resolveDuplicate(o.caseId, 'theirs')}>Link {o.duplicate.otherRef} instead</button></span>
        </Note>
      )}
      {o.callDentist && <Note tone="red"><PhoneCall className="w-3 h-3 inline -mt-0.5" /> The dentist has asked for changes twice. Call them before sending a third version.</Note>}
      {o.design?.diff.length ? <Note tone="amber"><AlertTriangle className="w-3 h-3 inline -mt-0.5" /> <b>The design differs from the case:</b> {o.design.diff.join('; ')}. The invoice draft follows what was designed and is flagged for the admin. <button className="underline font-semibold" onClick={() => navigate(`/growth/cases/${o.caseId}?sf=billing`)}>See billing</button></Note> : null}
      {o.status === 'cancelled' && <Note>Cancelled. The {cadName} order was marked cancelled in its notes, never deleted.</Note>}

      <div className="rounded-lg border border-[#E0E0E6] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-[#F8F9FC] border-b border-[#F0EFF6]">
          <span className="font-semibold text-[#030213]">Order sent to {cadName}</span>
          {o.cad !== 'partner' && (
            <span className="inline-flex items-center gap-2">
              <select className="text-[11px] bg-transparent text-[#717182]" value={o.cad} onChange={e => { setOrderCad(o.caseId, e.target.value as 'exocad' | '3shape'); toast.success(`Moved to ${e.target.value === 'exocad' ? 'exocad' : '3Shape'}`); }}><option value="exocad">exocad</option><option value="3shape">3Shape</option></select>
              <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7]" onClick={() => { openedInCad(o.caseId); toast.success(`Opens ${o.ref} in ${cadName} on this PC (through the connector). Marked In design.`); }}><ExternalLink className="w-3 h-3" /> Open in {cadName}</button>
            </span>
          )}
        </div>
        <table className="w-full">
          <tbody>
            {[
              ['Order reference', <span className="font-mono">{o.ref}</span>],
              ['Patient', o.patientSent],
              ['Client', o.client],
              ['Due', o.dueDate ? new Date(o.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
              ['Shade', o.shade || '—'],
              ...(o.implant ? [['Implant', `${o.implant.system} · ${o.implant.platform}`]] : []),
              ['Technician', o.technician ?? (partner ? partner.name : 'Unassigned')],
            ].map(([k, v]) => <tr key={k as string} className="border-b border-[#F0EFF6]"><td className="px-3 py-1 text-[#A0A0B0] w-32">{k}</td><td className="px-3 py-1">{v}</td></tr>)}
            {o.lines.map(l => (
              <tr key={l.id} className="border-b border-[#F0EFF6] last:border-0">
                <td className="px-3 py-1 text-[#A0A0B0]">Teeth {l.fdi.join(', ') || '—'}</td>
                <td className="px-3 py-1">{l.indication ? <>{l.indication} · {l.material ?? '—'} <span className="text-[#A0A0B0]">({l.itemName})</span></> : <IndicationPicker o={o} lineId={l.id} itemName={l.itemName} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {o.instructions && <p className="px-3 py-1.5 border-t border-[#F0EFF6] text-[#5A5568]"><span className="text-[#A0A0B0]">Instructions · </span>{o.instructions}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[#5A5568]">{o.scans.length ? `${o.scans.length} scan file${o.scans.length === 1 ? '' : 's'}: ${o.scans.map(x => x.name).slice(0, 3).join(', ')}${o.scans.length > 3 ? '…' : ''}` : 'No scans yet'}</span>
        <button className={btn} disabled={zipping} onClick={pack}>{zipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download scan pack</button>
      </div>

      <div className="rounded-lg border border-[#E0E0E6] p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-[#030213]">Design</p>
          <span className="flex flex-wrap gap-1.5">
            {o.status !== 'cancelled' && <button className={o.design ? btn : btnPrimary} onClick={() => setModal('bring')}>{o.design ? 'Bring in a new version' : 'Bring in the design'}</button>}
            {canSend && <button className={btnPrimary} onClick={() => setModal('approve')}><Send className="w-3.5 h-3.5" /> Send for approval</button>}
          </span>
        </div>
        {o.design ? (
          <div className="space-y-1.5">
            <p className="text-[#5A5568]">From {o.design.by} · {new Date(o.design.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{o.design.sourceUrl && <> · <a href={o.design.sourceUrl} target="_blank" rel="noreferrer" className="text-[#4D8EF7] font-mono">{o.design.sourceUrl.replace(/^https?:\/\//, '').slice(0, 42)}</a></>}</p>
            {o.design.files.length > 0 && <FileList files={o.design.files} />}
            <p className="text-[#717182]">Designed: {o.design.lines.map(l => `${l.fdi.join(', ')}`).join(' · ')}</p>
          </div>
        ) : <p className="text-[#A0A0B0]">Not back yet. When it's finished in {cadName}, paste the share link or upload the export here.</p>}
        {o.approvalNeeded && o.rounds.length > 0 && (
          <div className="pt-2 border-t border-[#F0EFF6] space-y-1">
            <p className="font-semibold text-[#030213]">Approval</p>
            {o.rounds.map((x, i) => (
              <p key={i} className="flex flex-wrap items-center gap-1.5">
                <span>Round {x.number} · sent {new Date(x.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} by {x.channel === 'whatsapp' ? 'WhatsApp' : x.channel}</span>
                {x.decision === 'approved' ? <Pill tone="green"><CheckCircle2 className="w-2.5 h-2.5" /> Approved by {x.by}</Pill> : x.decision === 'changes-requested' ? <Pill tone="amber">Changes requested</Pill> : <Pill tone="blue">Waiting {waitingLabel(x.sentAt)}</Pill>}
                {x.versionHash && <span className="font-mono text-[10px] text-[#A0A0B0]" title="The exact version that was approved">{x.versionHash}</span>}
                {x.token && <button className="text-[#4D8EF7] hover:underline" onClick={() => window.open(`/review/${x.token}`, '_blank')}>Review page</button>}
              </p>
            ))}
            {o.status === 'awaiting-dentist' && r && !r.decision && (
              <p className="text-[#717182]">{o.reminderSentAt ? `Reminder sent ${waitingLabel(o.reminderSentAt)} ago. ` : ''}{o.labAlertedAt ? 'Lab alerted. ' : ''}<button className="text-[#4D8EF7] font-semibold hover:underline" onClick={() => { remindDentist(o.caseId); toast.success('Reminder sent to the dentist'); }}>Remind now</button></p>
            )}
            <button className="text-[11px] text-[#4D8EF7] hover:underline" onClick={() => navigate(`/growth/cases/${o.caseId}/studio?from=case`)}>Open in Design Studio</button>
          </div>
        )}
      </div>

      {job && partner && (
        <div className="rounded-lg border border-[#E0E0E6] p-3 space-y-1">
          <p className="font-semibold text-[#030213]">{partner.name} · {job.kind === 'design' ? 'design' : 'milling'}</p>
          <p className="text-[#5A5568]">Sent {new Date(job.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · due {new Date(job.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {job.status === 'uploaded' ? 'design uploaded' : job.status === 'shipped' ? `shipped ${job.courier ?? ''} ${job.tracking ?? ''}` : job.status === 'downloaded' ? 'pack downloaded' : job.status === 'received' ? 'received back' : 'link sent'}{job.overdueAlertedAt && ['sent', 'downloaded'].includes(job.status) ? ' · late' : ''}</p>
          <span className="flex flex-wrap gap-2">
            <button className="text-[#4D8EF7] hover:underline" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/partner/${job.token}`).catch(() => {}); toast.success('Partner link copied'); }}>Copy their link</button>
            <button className="text-[#4D8EF7] hover:underline" onClick={() => window.open(`/partner/${job.token}`, '_blank')}>Partner view</button>
            {job.status === 'shipped' && o.status !== 'received-back' && <button className={btnPrimary} onClick={() => { receivedBack(o.caseId); toast.success('Checked in: received back'); }}><Truck className="w-3.5 h-3.5" /> Received back</button>}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {o.status === 'ready' && <button className={btnPrimary} onClick={() => moveTo(o.caseId, 'manufacturing')}>Start manufacturing</button>}
        {(o.status === 'manufacturing' || o.status === 'received-back') && <button className={btnPrimary} onClick={() => moveTo(o.caseId, 'finishing')}>Move to finishing</button>}
        {!job && o.status !== 'cancelled' && !['manufacturing', 'finishing', 'dispatched'].includes(o.status) && <button className={btn} onClick={() => setModal('partner')}><Share2 className="w-3.5 h-3.5" /> Send to a partner</button>}
        {o.status === 'ready' && !job && <button className={btn} onClick={() => setModal('partner')}>Send to a milling partner</button>}
        {o.status !== 'cancelled' && o.status !== 'dispatched' && <button className="text-[11px] text-[#A0A0B0] hover:text-[#C62828] ml-auto" onClick={() => { if (window.confirm('Mark the CAD order cancelled? It is never deleted from CAD.')) cancelOrder(o.caseId); }}>Case cancelled?</button>}
      </div>

      {o.notes.length > 0 && <div className="text-[#5A5568] space-y-0.5"><p className="font-semibold text-[#030213]">CAD order notes</p>{o.notes.map((n, i) => <p key={i}>• {n}</p>)}</div>}
      <details className="text-[#717182]"><summary className="cursor-pointer">Status history</summary>{o.history.map((h, i) => <p key={i}>{new Date(h.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {STATUS_LABEL[h.status]} · {h.by}</p>)}</details>

      {modal === 'bring' && <BringInDesignModal order={o} onClose={() => setModal(null)} />}
      {modal === 'approve' && <SendForApprovalModal order={o} onClose={() => setModal(null)} />}
      {modal === 'partner' && <SendToPartnerModal caseId={o.caseId} onClose={() => setModal(null)} />}
    </div>
  );
}

function IndicationPicker({ o, lineId, itemName }: { o: CadOrder; lineId: string; itemName: string }) {
  const { toast } = useToast();
  const cad = o.cad === '3shape' ? '3shape' : 'exocad';
  const [ind, setInd] = useState('');
  const [mat, setMat] = useState(MATERIALS[0]);
  const [rule, setRule] = useState(true);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <AlertTriangle className="w-3 h-3 text-[#B45309]" /> <span className="text-[#B45309]">{itemName}: pick the indication</span>
      <select className={inputSm} value={ind} onChange={e => setInd(e.target.value)}><option value="">Indication…</option>{INDICATIONS[cad].map(i => <option key={i}>{i}</option>)}</select>
      <select className={inputSm} value={mat} onChange={e => setMat(e.target.value)}>{MATERIALS.map(m => <option key={m}>{m}</option>)}</select>
      <label className="inline-flex items-center gap-1 text-[10px]"><input type="checkbox" checked={rule} onChange={e => setRule(e.target.checked)} /> Save as a rule</label>
      <button className={btn} disabled={!ind} onClick={() => { pickIndication(o.caseId, lineId, ind, mat, rule); toast.success(rule ? `Saved: ${itemName} → ${ind} for every future ${cad === 'exocad' ? 'exocad' : '3Shape'} order` : 'Indication set on this order'); }}>Set</button>
    </span>
  );
}

function orderSheet(o: CadOrder, c: Case) {
  return [
    `Smile Genius CAD order · ${o.ref}`,
    `Patient: ${o.patientSent}`,
    `Client: ${o.client}`,
    `Due: ${o.dueDate ?? '—'} · Shade: ${o.shade || '—'}`,
    ...(o.implant ? [`Implant: ${o.implant.system} ${o.implant.platform}`] : []),
    '',
    ...o.lines.map(l => `Teeth ${l.fdi.join(', ')}: ${l.indication ?? `${l.itemName} (pick indication)`} · ${l.material ?? '—'}`),
    '',
    `Instructions: ${o.instructions ?? c.serviceItems?.[0]?.instructions ?? '—'}`,
    `Scans: ${o.scans.map(s => s.name).join(', ') || 'none yet'}`,
  ].join('\n');
}

/** A tiny valid ASCII STL (placeholder for scans that live on the scanner portal). */
function placeholderStl(name: string) {
  return `solid ${name}\n facet normal 0 0 1\n  outer loop\n   vertex 0 0 0\n   vertex 10 0 0\n   vertex 0 10 0\n  endloop\n endfacet\nendsolid ${name}\n`;
}
