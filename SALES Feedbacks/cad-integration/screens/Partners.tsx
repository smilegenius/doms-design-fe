import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Copy, ExternalLink, Pencil, Plus, RefreshCw } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import { useToast } from '../../../src/app/context/ToastContext';
import type { Partner } from '../types';
import { reassignJob, remindPartner, savePartner, useCad } from '../cadStore';
import { btn, btnPrimary, Card, Empty, Field, input, Pill, Seg, td, th, Toggle } from '../../lab-billing/ui';

// ── 5. Partners: outside design and milling partners ─────────────────────────

const late = (dueAt: string, days: number) => Date.now() - new Date(dueAt).getTime() > days * 86_400_000;

export default function Partners() {
  const s = useCad();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [edit, setEdit] = useState<Partner | null>(null);
  const [reassign, setReassign] = useState<string | null>(null);
  const open = s.jobs.filter(j => !['received'].includes(j.status));
  return (
    <div className="space-y-4">
      <Card title="Partners" sub="Set up once: what they do, how to reach them, and their usual turnaround. Partners don't need a Smile Genius account: each case gets them a secure link." actions={<button className={btnPrimary} onClick={() => setEdit({ id: `p-${Date.now().toString(36)}`, name: '', does: 'design', email: '', turnaroundDays: 2, active: true })}><Plus className="w-3.5 h-3.5" /> Add partner</button>} pad={false}>
        <table className="w-full">
          <thead><tr><th className={th}>Partner</th><th className={th}>Does</th><th className={th}>Turnaround</th><th className={th}>Active cases</th><th className={th}>Late</th><th className={th} /></tr></thead>
          <tbody>{s.partners.map(p => {
            const jobs = open.filter(j => j.partnerId === p.id);
            const overdue = jobs.filter(j => ['sent', 'downloaded'].includes(j.status) && late(j.dueAt, s.settings.partnerOverdueDays));
            return (
              <tr key={p.id} className={p.active ? '' : 'opacity-50'}>
                <td className={td}><span className="font-semibold">{p.name}</span><span className="block text-[#717182]">{p.email}</span></td>
                <td className={td}>{p.does === 'both' ? 'Design and milling' : p.does === 'design' ? 'Design' : 'Milling'}</td>
                <td className={td}>{p.turnaroundDays} day{p.turnaroundDays === 1 ? '' : 's'}</td>
                <td className={td}>{jobs.length}</td>
                <td className={td}>{overdue.length ? <Pill tone="red">{overdue.length} late</Pill> : '—'}</td>
                <td className={`${td} text-right`}><button className={btn} onClick={() => setEdit(p)}><Pencil className="w-3 h-3" /> Edit</button></td>
              </tr>
            );
          })}</tbody>
        </table>
      </Card>

      <Card title="Cases with partners" pad={false}>
        {open.length === 0 ? <Empty>No cases out with partners.</Empty> : (
          <table className="w-full">
            <thead><tr><th className={th}>Case</th><th className={th}>Partner</th><th className={th}>For</th><th className={th}>Sent</th><th className={th}>Due</th><th className={th}>Status</th><th className={th} /></tr></thead>
            <tbody>{open.map(j => {
              const p = s.partners.find(x => x.id === j.partnerId);
              const isLate = ['sent', 'downloaded'].includes(j.status) && late(j.dueAt, s.settings.partnerOverdueDays);
              return (
                <tr key={j.token}>
                  <td className={td}><button className="font-mono text-[#4D8EF7] hover:underline" onClick={() => navigate(`/growth/cases/${j.caseId}?sf=cad`)}>{j.caseId}</button></td>
                  <td className={td}>{p?.name}</td>
                  <td className={td}>{j.kind === 'design' ? 'Design' : 'Milling'}</td>
                  <td className={td}>{new Date(j.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                  <td className={`${td} ${isLate ? 'text-[#C62828] font-semibold' : ''}`}>{new Date(j.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                  <td className={td}>{isLate ? <Pill tone="red">Late</Pill> : <Pill tone={j.status === 'uploaded' || j.status === 'shipped' ? 'green' : 'blue'}>{{ sent: 'Link sent', downloaded: 'Pack downloaded', uploaded: 'Design uploaded', shipped: `Shipped${j.tracking ? ` · ${j.tracking}` : ''}`, received: 'Received' }[j.status]}</Pill>}{j.remindedAt && isLate && <span className="block text-[10px] text-[#717182]">Reminded {new Date(j.remindedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    <button className={`${btn} mr-1`} title="Copy their link" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/partner/${j.token}`).catch(() => {}); toast.success('Link copied'); }}><Copy className="w-3 h-3" /></button>
                    <button className={`${btn} mr-1`} title="Partner view" onClick={() => window.open(`/partner/${j.token}`, '_blank')}><ExternalLink className="w-3 h-3" /></button>
                    {isLate && <button className={`${btn} mr-1`} onClick={() => { remindPartner(j.token); toast.success(`${p?.name} reminded`); }}><Bell className="w-3 h-3" /> Remind</button>}
                    {['sent', 'downloaded'].includes(j.status) && <button className={btn} onClick={() => setReassign(j.token)}><RefreshCw className="w-3 h-3" /> Reassign</button>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </Card>

      {edit && <PartnerModal p={edit} onClose={() => setEdit(null)} />}
      {reassign && <ReassignModal token={reassign} onClose={() => setReassign(null)} />}
    </div>
  );
}

function PartnerModal({ p, onClose }: { p: Partner; onClose: () => void }) {
  const { toast } = useToast();
  const [d, setD] = useState(p);
  return (
    <Modal isOpen onClose={onClose} title={p.name ? `Edit ${p.name}` : 'Add a partner'} footer={<div className="flex justify-end gap-2"><button className={btn} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={!d.name.trim() || !d.email.includes('@')} onClick={() => { savePartner({ ...d, name: d.name.trim() }); toast.success('Partner saved'); onClose(); }}>Save</button></div>}>
      <div className="space-y-3">
        <Field label="Name"><input className={input} value={d.name} onChange={e => setD({ ...d, name: e.target.value })} /></Field>
        <Field label="What they do"><Seg value={d.does} onChange={v => setD({ ...d, does: v })} options={[{ value: 'design', label: 'Design' }, { value: 'milling', label: 'Milling' }, { value: 'both', label: 'Both' }]} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Contact email"><input className={input} value={d.email} onChange={e => setD({ ...d, email: e.target.value })} /></Field>
          <Field label="Usual turnaround (days)"><input className={input} type="number" min="1" value={d.turnaroundDays} onChange={e => setD({ ...d, turnaroundDays: Number(e.target.value) })} /></Field>
        </div>
        <Toggle on={d.active} onChange={v => setD({ ...d, active: v })} label={d.active ? 'Active' : 'Not used for new cases'} />
      </div>
    </Modal>
  );
}

function ReassignModal({ token, onClose }: { token: string; onClose: () => void }) {
  const s = useCad();
  const { toast } = useToast();
  const j = s.jobs.find(x => x.token === token)!;
  const options = s.partners.filter(p => p.active && p.id !== j.partnerId && (p.does === 'both' || p.does === j.kind));
  const [to, setTo] = useState(options[0]?.id ?? '');
  return (
    <Modal isOpen onClose={onClose} title={`Reassign ${j.caseId}`} footer={<div className="flex justify-end gap-2"><button className={btn} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={!to} onClick={() => { reassignJob(token, to); toast.success(`Sent to ${s.partners.find(p => p.id === to)?.name}; the old link was closed`); onClose(); }}>Reassign</button></div>}>
      {options.length ? <Field label="Send it to"><select className={input} value={to} onChange={e => setTo(e.target.value)}>{options.map(p => <option key={p.id} value={p.id}>{p.name} · {p.turnaroundDays}-day turnaround</option>)}</select></Field> : <p className="text-sm text-[#717182]">No other active partner does this. Add one first.</p>}
    </Modal>
  );
}
