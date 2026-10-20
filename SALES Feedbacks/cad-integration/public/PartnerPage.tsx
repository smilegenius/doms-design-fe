import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Download, Loader2, PackageCheck, Truck, Upload } from 'lucide-react';
import { accentFor, getIntakeConfig } from '../../intake-form/intakeStore';
import { LabLogo } from '../../bulk-actions/printForms';
import { buildZip, saveBlob, type ZipEntry } from '../../bulk-actions/zip';
import { FileDropZone, FileList } from '../../design-studio/components/FileChips';
import type { DesignFile } from '../../design-studio/data/designStudio';
import { partnerDownloaded, partnerShipped, partnerUpload, useCad } from '../cadStore';

// ── 6. Partner upload page: /partner/:token (public, no login) ───────────────
// The outside design or milling partner downloads the pack (scans, order
// details, instructions, due date) and sends the result back to the case.

const box = 'bg-white border border-[#E0E0E6] rounded-xl p-4 sm:p-5';
const field = 'w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm focus:outline-none focus:border-[#4D8EF7]';
const primary = 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#7C6BFF] disabled:opacity-50';

export default function PartnerPage() {
  const { token = '' } = useParams();
  const s = useCad();
  const cfg = getIntakeConfig();
  const job = s.jobs.find(j => j.token === token);
  const order = job ? s.orders[job.caseId] : undefined;
  const partner = job ? s.partners.find(p => p.id === job.partnerId) : undefined;
  const [files, setFiles] = useState<DesignFile[]>([]);
  const [message, setMessage] = useState('');
  const [courier, setCourier] = useState('Royal Mail Special Delivery');
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = `${cfg.labName} · case for ${partner?.name ?? 'partner'}`; }, [cfg.labName, partner?.name]);

  if (!job || !order || job.status === 'received') {
    return (
      <Shell lab={cfg}>
        <div className={`${box} text-center`}>
          <p className="text-base font-semibold text-[#030213]">{job?.status === 'received' ? 'This case is closed' : 'Link not found'}</p>
          <p className="text-sm text-[#717182] mt-1">{job?.status === 'received' ? `${cfg.labName} has checked it in or moved it to another partner. Thanks!` : `Ask ${cfg.labName} to send the link again.`}</p>
        </div>
      </Shell>
    );
  }

  async function download() {
    setBusy(true);
    const dir = order!.caseId;
    const sheet = [
      `${cfg.labName} · case ${order!.ref} for ${partner?.name}`,
      `${job!.kind === 'design' ? 'Design' : 'Milling'} · due ${new Date(job!.dueAt).toLocaleDateString('en-GB')}`,
      `Patient: ${order!.patientSent} · Shade: ${order!.shade || '—'}`,
      ...(order!.implant ? [`Implant: ${order!.implant.system} ${order!.implant.platform}`] : []),
      ...order!.lines.map(l => `Teeth ${l.fdi.join(', ')}: ${l.indication ?? l.itemName} · ${l.material ?? '—'}`),
      `Instructions: ${order!.instructions ?? '—'}`,
      ...(job!.message ? [`From the lab: ${job!.message}`] : []),
    ].join('\n');
    const entries: ZipEntry[] = [{ path: `${dir}/order.txt`, data: sheet }];
    for (const sc of order!.scans.filter(x => x.name.endsWith('.stl'))) entries.push({ path: `${dir}/scans/${sc.name}`, data: `solid ${sc.name}\n facet normal 0 0 1\n  outer loop\n   vertex 0 0 0\n   vertex 10 0 0\n   vertex 0 10 0\n  endloop\n endfacet\nendsolid ${sc.name}\n` });
    saveBlob(await buildZip(entries), `${order!.caseId}_pack.zip`);
    partnerDownloaded(token);
    setBusy(false);
  }

  const done = job.status === 'uploaded' || job.status === 'shipped';
  return (
    <Shell lab={cfg}>
      <div className={box}>
        <p className="text-xs text-[#717182]">Case for {partner?.name}</p>
        <h1 className="text-lg font-semibold text-[#030213]">{order.ref} · {job.kind === 'design' ? 'Design' : 'Milling'}</h1>
        <p className="text-sm text-[#5A5568] mt-1">Due back {new Date(job.dueAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <div className="mt-3 rounded-lg bg-[#F8F9FC] px-3 py-2 text-sm text-[#030213] space-y-0.5">
          <p>Patient: {order.patientSent} · Shade {order.shade || '—'}</p>
          {order.lines.map(l => <p key={l.id}>Teeth {l.fdi.join(', ') || '—'}: {l.indication ?? l.itemName} · {l.material ?? '—'}</p>)}
          {order.implant && <p>Implant: {order.implant.system} · {order.implant.platform}</p>}
          {order.instructions && <p className="text-[#5A5568]">{order.instructions}</p>}
          {job.message && <p className="text-[#5A5568]">From the lab: {job.message}</p>}
        </div>
        <button className={`${primary} mt-3 w-full sm:w-auto`} disabled={busy} onClick={download}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download the case pack</button>
        {job.downloadedAt && <p className="text-xs text-[#2E7D32] mt-1.5">Downloaded {new Date(job.downloadedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
      </div>

      {done ? (
        <div className={`${box} text-center`}>
          <CheckCircle2 className="w-8 h-8 text-[#2E7D32] mx-auto" />
          <p className="text-base font-semibold text-[#030213] mt-2">{job.status === 'shipped' ? 'Dispatch confirmed' : 'Design sent'}</p>
          <p className="text-sm text-[#717182] mt-1">{job.status === 'shipped' ? `${job.courier} ${job.tracking}. ${cfg.labName} will check it in when it arrives.` : `${cfg.labName} has the files on the case now. You can add more below if needed.`}</p>
        </div>
      ) : null}

      {job.kind === 'design' ? (
        <div className={box}>
          <p className="text-sm font-semibold text-[#030213] flex items-center gap-1.5"><Upload className="w-4 h-4" /> Upload the finished design</p>
          <p className="text-xs text-[#717182] mb-2">STL files, screenshots, and the CAD project file if you share it.</p>
          <FileDropZone uploadedBy="lab" onAdded={f => setFiles(x => [...x, ...f])} title="Drop the design files here or browse" />
          <FileList files={files} onRemove={id => setFiles(x => x.filter(f => f.id !== id))} />
          <textarea className={`${field} mt-2`} rows={2} value={message} onChange={e => setMessage(e.target.value)} placeholder="Note for the lab (optional)" />
          <button className={`${primary} mt-2 w-full sm:w-auto`} disabled={!files.length} onClick={() => { partnerUpload(token, files, message.trim() || undefined); setFiles([]); }}><PackageCheck className="w-4 h-4" /> Send to {cfg.labName}</button>
        </div>
      ) : (
        <div className={box}>
          <p className="text-sm font-semibold text-[#030213] flex items-center gap-1.5"><Truck className="w-4 h-4" /> Confirm dispatch</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <input className={field} value={courier} onChange={e => setCourier(e.target.value)} placeholder="Courier" />
            <input className={field} value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking number" />
          </div>
          <button className={`${primary} mt-2 w-full sm:w-auto`} disabled={!tracking.trim()} onClick={() => partnerShipped(token, courier.trim(), tracking.trim())}><Truck className="w-4 h-4" /> Confirm dispatch</button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ lab, children }: { lab: ReturnType<typeof getIntakeConfig>; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FC] px-4 py-6 sm:py-10">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <LabLogo name={lab.labName} logo={lab.logo} accent={accentFor(lab.accent)} />
          <p className="text-base font-semibold text-[#030213]">{lab.labName}</p>
        </div>
        {children}
        <p className="text-center text-[10px] text-[#A0A0B0]">Secure link from {lab.labName} · Powered by Smile Genius · No account needed</p>
      </div>
    </div>
  );
}
