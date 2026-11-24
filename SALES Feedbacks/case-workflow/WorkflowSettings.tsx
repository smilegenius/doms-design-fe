import { useState } from 'react';
import { ArrowDown, ArrowUp, Lock, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '../../src/app/context/AuthContext';
import { useToast } from '../../src/app/context/ToastContext';
import { teamMemberFor } from '../lab-prescription-inbox/data';
import { btn, btnPrimary, Card, Field, input, inputSm, Note, Seg, Toggle } from '../lab-billing/ui';
import { type Assign, type Route, IN_LAB, STAFF, resetWorkflowDemo, saveRoute, setServiceRoute, updateSettings, useWorkflow } from './workflowStore';

// ── V2 Settings › Workflow (admins only) ─────────────────────────────────────
// Routes per service (a simple default for every service, customisable),
// the default person per stage (or the same person continues, or anyone),
// the intake owner, note acknowledgement, the bench PIN, the due-date buffer
// and assignment notifications. Route edits apply forward.

const assignValue = (a: Assign) => (a.mode === 'person' ? a.person : a.mode === 'same' ? '__same' : '__anyone');
const toAssign = (v: string): Assign => (v === '__same' ? { mode: 'same' } : v === '__anyone' ? { mode: 'anyone' } : { mode: 'person', person: v });

export default function WorkflowSettings() {
  const s = useWorkflow();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = teamMemberFor(user?.email)?.role ?? '';
  const admin = role === 'Admin' || role === 'Super Admin';
  const st = s.settings;
  const [editing, setEditing] = useState<string | null>(null);
  const services = Object.keys(s.serviceRoute).sort();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-[#030213]">Workflow</h2>
        <p className="text-sm text-[#717182]">How a case moves through the lab after you accept it: each service line follows its service's route, one owner at a time.</p>
      </div>
      {!admin && <Note tone="amber"><Lock className="w-3.5 h-3.5 inline -mt-0.5" /> Only lab admins can change routes, default people and these settings.</Note>}
      <fieldset disabled={!admin} className="space-y-4">
        <Card title="The workflow" sub="Premium. On the free plan cases stay on Received → Accepted → On Hold (Practice) → Shipped. A one-person lab with no routes sees no change either.">
          <Toggle on={st.enabled} onChange={v => { updateSettings({ enabled: v }); toast.success(v ? 'Workflow on: routes, queues and the calendar' : 'Workflow off'); }} label="Use routes, My queue and the delivery calendar" />
        </Card>

        <Card title="Routes" sub="The stages each kind of work goes through, and who gets it at each stage. Quality Control is always last. Changes apply forward: lines keep the stages they've done.">
          <div className="space-y-2">
            {s.routes.map(r => editing === r.key ? <RouteEditor key={r.key} route={r} onDone={() => setEditing(null)} /> : (
              <div key={r.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#F0EFF6] px-3 py-2.5">
                <div className="flex-1 min-w-[240px]">
                  <p className="text-sm font-semibold text-[#030213]">{r.name}</p>
                  <p className="text-xs text-[#717182]">{r.stages.map(x => `${x.name}${x.assign.mode === 'person' ? ` (${x.assign.person.split(' ')[0]})` : x.assign.mode === 'same' ? ' (same person)' : ' (anyone)'}`).join(' → ')}</p>
                  <p className="text-[10px] text-[#A0A0B0]">{Object.values(s.lines).filter(l => l.route === r.key && IN_LAB.includes(l.status)).length} lines on it now · used by {services.filter(x => s.serviceRoute[x] === r.key).length} services</p>
                </div>
                <button className={btn} onClick={() => setEditing(r.key)}>Edit</button>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Which route each service follows" sub="Every service starts on a sensible default. A case with a crown and a guide runs two lines on two routes." pad={false}>
          <div className="max-h-72 overflow-y-auto divide-y divide-[#F0EFF6]">
            {services.map(x => (
              <div key={x} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                <span>{x}</span>
                <select className={inputSm} value={s.serviceRoute[x]} onChange={e => { setServiceRoute(x, e.target.value); toast.success(`${x} now follows ${s.routes.find(r => r.key === e.target.value)?.name} (new lines)`); }}>{s.routes.map(r => <option key={r.key} value={r.key}>{r.name}</option>)}</select>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card title="Intake and handoffs">
            <div className="space-y-4">
              <Field label="Intake owner" hint="New lines in Received and Under Review are assigned to them.">
                <select className={input} value={st.intakeOwner} onChange={e => updateSettings({ intakeOwner: e.target.value })}>{STAFF.map(p => <option key={p.name}>{p.name}</option>)}</select>
              </Field>
              <div>
                <Toggle on={st.ackRequired} onChange={v => { updateSettings({ ackRequired: v }); toast.success(v ? 'Note acknowledgement on' : 'Note acknowledgement off'); }} label="Note acknowledgement" />
                <p className="text-[11px] text-[#717182] mt-1">The new owner ticks unread notes as read before they can change the line's status. Each tick is logged.</p>
              </div>
              <Field label="Internal due date" hint="Requested delivery minus this many days. Overdue shows red in queues and the calendar.">
                <div className="flex items-center gap-2"><input className={`${input} w-20`} type="number" min="0" value={st.bufferDays} onChange={e => updateSettings({ bufferDays: Math.max(0, Number(e.target.value) || 0) })} /><span className="text-xs">days before</span></div>
              </Field>
              <div>
                <Toggle on={st.shipPartial} onChange={v => updateSettings({ shipPartial: v })} label="Ship lines one at a time" />
                <p className="text-[11px] text-[#717182] mt-1">Off: a case ships when every line passes Quality Control.</p>
              </div>
            </div>
          </Card>
          <Card title="Shared benches and notifications">
            <div className="space-y-4">
              <div>
                <Toggle on={st.pinOn} onChange={v => updateSettings({ pinOn: v })} label="4-digit PIN on bench tablets" />
                <p className="text-[11px] text-[#717182] mt-1">Scanning a docket QR opens bench mode: pick your name{st.pinOn ? ' and enter your PIN' : ''}. No login.</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#030213] mb-1.5">Tell people when a line is assigned to them</p>
                <table className="w-full text-xs">
                  <thead><tr className="text-[10px] uppercase text-[#717182]"><th className="text-left py-1">Person</th><th>In-app</th><th>Email</th></tr></thead>
                  <tbody>{STAFF.map(p => { const n = st.notify[p.name] ?? { inApp: true, email: true }; return (
                    <tr key={p.name} className="border-t border-[#F0EFF6]"><td className="py-1.5">{p.name}<span className="block text-[10px] text-[#A0A0B0]">{p.role}</span></td>
                      <td className="text-center"><input type="checkbox" checked={n.inApp} onChange={e => updateSettings({ notify: { ...st.notify, [p.name]: { ...n, inApp: e.target.checked } } })} /></td>
                      <td className="text-center"><input type="checkbox" checked={n.email} onChange={e => updateSettings({ notify: { ...st.notify, [p.name]: { ...n, email: e.target.checked } } })} /></td></tr>
                  ); })}</tbody>
                </table>
                <p className="text-[10px] text-[#A0A0B0] mt-1">Each person can change their own in their notification settings.</p>
              </div>
            </div>
          </Card>
        </div>
      </fieldset>
      <button className="text-[11px] text-[#717182] inline-flex items-center gap-1 underline" onClick={() => { resetWorkflowDemo(); toast.success('Workflow demo reset'); }}><RotateCcw className="w-3 h-3" /> Reset the workflow demo data</button>
    </div>
  );
}

function RouteEditor({ route, onDone }: { route: Route; onDone: () => void }) {
  const { toast } = useToast();
  const [r, setR] = useState<Route>(() => structuredClone(route));
  const body = r.stages.filter(x => !x.qc);
  const qc = r.stages.find(x => x.qc)!;
  const set = (stages: typeof body) => setR({ ...r, stages: [...stages, qc] });
  return (
    <div className="rounded-xl border border-[#4D8EF7] p-3 space-y-2 bg-[#FAFCFF]">
      <input className={input} value={r.name} onChange={e => setR({ ...r, name: e.target.value })} />
      {[...body, qc].map((x, i) => (
        <div key={x.id} className="flex flex-wrap items-center gap-1.5">
          <span className="w-5 text-[11px] text-[#717182]">{i + 1}.</span>
          <input className={`${inputSm} w-36`} value={x.name} disabled={x.qc} onChange={e => set(body.map(y => (y.id === x.id ? { ...y, name: e.target.value } : y)))} />
          <select className={inputSm} value={assignValue(x.assign)} onChange={e => { const a = toAssign(e.target.value); if (x.qc) setR({ ...r, stages: [...body, { ...qc, assign: a }] }); else set(body.map(y => (y.id === x.id ? { ...y, assign: a } : y))); }}>
            {STAFF.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            <option value="__same">Same person continues</option>
            <option value="__anyone">Anyone (team queue)</option>
          </select>
          {!x.qc ? <>
            <button className="p-1 text-[#717182] disabled:opacity-30" disabled={i === 0} onClick={() => { const b = [...body]; [b[i - 1], b[i]] = [b[i], b[i - 1]]; set(b); }} aria-label="Up"><ArrowUp className="w-3.5 h-3.5" /></button>
            <button className="p-1 text-[#717182] disabled:opacity-30" disabled={i === body.length - 1} onClick={() => { const b = [...body]; [b[i + 1], b[i]] = [b[i], b[i + 1]]; set(b); }} aria-label="Down"><ArrowDown className="w-3.5 h-3.5" /></button>
            <button className="p-1 text-[#A0A0B0] hover:text-[#C62828] disabled:opacity-30" disabled={body.length <= 1} onClick={() => set(body.filter(y => y.id !== x.id))} aria-label="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
          </> : <span className="text-[10px] text-[#A0A0B0]"><Lock className="w-3 h-3 inline" /> always last</span>}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button className={btn} onClick={() => set([...body, { id: `st-${Date.now().toString(36)}`, name: 'New stage', assign: { mode: 'anyone' } }])}><Plus className="w-3 h-3" /> Add a stage</button>
        <div className="flex-1" />
        <button className={btn} onClick={onDone}>Cancel</button>
        <button className={btnPrimary} disabled={!r.name.trim() || r.stages.some(x => !x.name.trim())} onClick={() => { saveRoute(r); toast.success('Route saved: lines in flight follow it from their next handoff'); onDone(); }}>Save route</button>
      </div>
    </div>
  );
}

export { Seg };
