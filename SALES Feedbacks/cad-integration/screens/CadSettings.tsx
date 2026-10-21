import { useState } from 'react';
import { CheckCircle2, Circle, Download, HardDrive, Loader2, Plug, Power, RefreshCw, Server, ShieldCheck, Stethoscope, Trash2, Wrench } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import { useToast } from '../../../src/app/context/ToastContext';
import { useBilling } from '../../lab-billing/billingStore';
import type { CadSettings as Settings, CadSoftware, Connector } from '../types';
import { hoursSince, INDICATIONS, MATERIALS, NOT_CAD, TECHNICIANS } from '../engine';
import { addConnector, goOffline, healthCheck, reconnect, removeConnector, setMapping, updateCadSettings, updateConnector, useCad } from '../cadStore';
import { btn, btnPrimary, Card, Field, input, inputSm, Note, Pill, Seg, td, th } from '../../lab-billing/ui';

// ── 7. Settings → CAD & design ───────────────────────────────────────────────
// Ten settings, all with defaults: a lab with one CAD and no outsourcing only
// confirms the CAD choice. Plus the mapping table and connector health.

export default function CadSettings() {
  const s = useCad();
  const billing = useBilling();
  const { toast } = useToast();
  const [setup, setSetup] = useState(false);
  const st = s.settings;
  const set = (patch: Partial<Settings>) => { updateCadSettings(patch); toast.success('Saved'); };
  const depts = billing.departments.map(d => d.name).filter(d => !NOT_CAD.includes(d));
  const items = billing.catalog.filter(i => !i.archived && !NOT_CAD.includes(i.department) && i.id !== 'cour');
  const cads: CadSoftware[] = st.cad === 'both' ? ['exocad', '3shape'] : st.cad === 'exocad' || st.cad === '3shape' ? [st.cad] : [];
  const unmapped = items.filter(i => cads.some(c => !st.mapping[i.id]?.[c])).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#030213]">CAD & design</h2>
        <p className="text-xs text-[#717182]">Smile Genius creates the CAD order for every digital case, with the scans attached, and tracks the design until it's approved and made. Admins only.</p>
      </div>

      <Card title="How finished designs come back" sub="What exocad and 3Shape can do for us depends on partner access, still being agreed.">
        <div className="space-y-2 text-xs">
          <Note tone="amber">For now, finished designs come back <b>by hand</b>: on the case's CAD design tab, the technician pastes the share link from exocad (webview / DentalShare) or 3Shape Communicate, or uploads the STL export and screenshots. That becomes a Design Studio version, ready to send to the dentist.</Note>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              ['Create orders with scans', 'Simulated through the connector; needs exocad and 3Shape partner access', 'amber'],
              ['Read "in design" status', 'Simulated; the technician can also set it on the board', 'amber'],
              ['Bring the finished design back', 'Manual: share link or upload', 'blue'],
            ].map(([t, d, tone]) => <div key={t} className="rounded-lg border border-[#E0E0E6] p-2.5"><p className="font-semibold text-[#030213]">{t}</p><p className="text-[#717182] mt-0.5">{d}</p><span className="mt-1 inline-block"><Pill tone={tone as 'amber' | 'blue'}>{tone === 'blue' ? 'Manual for now' : 'Waiting on vendors'}</Pill></span></div>)}
          </div>
        </div>
      </Card>

      <Card title="CAD software">
        <div className="space-y-4">
          <Row label="CAD software" hint={s.connectors.length ? `Detected by the connector: ${[...new Set(s.connectors.map(c => c.cad === 'exocad' ? 'exocad' : '3Shape'))].join(' and ')}` : 'Set up a connector to detect it.'}>
            <Seg value={st.cad} onChange={v => set({ cad: v })} options={[{ value: 'exocad', label: 'exocad' }, { value: '3shape', label: '3Shape' }, { value: 'both', label: 'Both' }, { value: 'none', label: 'None (outsource only)' }]} />
          </Row>
          {st.cad === 'both' && (
            <Row label="Default CAD per restoration type" hint="Technicians can still move a case to the other CAD.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">{depts.map(d => <label key={d} className="flex items-center justify-between gap-2 text-xs">{d}<select className={inputSm} value={st.cadByDepartment[d] ?? 'exocad'} onChange={e => set({ cadByDepartment: { ...st.cadByDepartment, [d]: e.target.value as CadSoftware } })}><option value="exocad">exocad</option><option value="3shape">3Shape</option></select></label>)}</div>
            </Row>
          )}
          <Row label="When to create the CAD order"><Seg value={st.createOn} onChange={v => set({ createOn: v })} options={[{ value: 'accepted', label: 'When the case is accepted' }, { value: 'manual', label: 'Manually' }]} /></Row>
          <Row label="Patient details in CAD" hint="Initials keep personal data on the CAD PC to a minimum."><Seg value={st.patientDetails} onChange={v => set({ patientDetails: v })} options={[{ value: 'full', label: 'Full name' }, { value: 'initials', label: 'Initials and reference' }]} /></Row>
          <Row label="Assign to technician">
            <div className="space-y-2">
              <Seg value={st.assign} onChange={v => set({ assign: v })} options={[{ value: 'manual', label: 'Manual' }, { value: 'round-robin', label: 'Round-robin' }, { value: 'by-type', label: 'By restoration type' }]} />
              {st.assign === 'by-type' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">{depts.map(d => <label key={d} className="flex items-center justify-between gap-2 text-xs">{d}<select className={inputSm} value={st.techByDepartment[d] ?? ''} onChange={e => set({ techByDepartment: { ...st.techByDepartment, [d]: e.target.value } })}><option value="">Unassigned</option>{TECHNICIANS.map(t => <option key={t}>{t}</option>)}</select></label>)}</div>}
            </div>
          </Row>
        </div>
      </Card>

      <Card title="Design approval">
        <div className="space-y-4">
          <Row label="Design approval required">
            <div className="space-y-2">
              <Seg value={st.approval} onChange={v => set({ approval: v })} options={[{ value: 'selected', label: 'Selected types' }, { value: 'always', label: 'Always' }, { value: 'never', label: 'Never' }]} />
              {st.approval === 'selected' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">{([['veneers', 'Veneers'], ['anterior4', 'Anterior cases of 4+ units'], ['implantBars', 'Implant bars and screw-retained work'], ['bridges', 'Bridges'], ['smileDesign', 'Smile designs']] as const).map(([k, l]) => <label key={k} className="text-xs inline-flex items-center gap-1.5"><input type="checkbox" checked={st.approvalTypes[k]} onChange={e => set({ approvalTypes: { ...st.approvalTypes, [k]: e.target.checked } })} /> {l}</label>)}</div>}
              <p className="text-[11px] text-[#717182]">Single posterior crowns usually skip approval.</p>
            </div>
          </Row>
          <Row label="Approval reminder" hint="Nudge the dentist once after this long, then alert the lab."><span className="inline-flex items-center gap-2"><input className={`${input} w-24`} type="number" min="1" defaultValue={st.reminderHours} onBlur={e => set({ reminderHours: Number(e.target.value) || 24 })} /><span className="text-xs text-[#717182]">hours</span></span></Row>
        </div>
      </Card>

      <Card title="Partners">
        <div className="space-y-4">
          <Row label="Default partner per restoration type" hint="Pre-picked when you send a case out.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">{depts.map(d => <label key={d} className="flex items-center justify-between gap-2 text-xs">{d}<select className={inputSm} value={st.partnerByDepartment[d] ?? ''} onChange={e => set({ partnerByDepartment: { ...st.partnerByDepartment, [d]: e.target.value || null } })}><option value="">None</option>{s.partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>)}</div>
          </Row>
          <Row label="Partner overdue alert" hint="Days past their usual turnaround."><span className="inline-flex items-center gap-2"><input className={`${input} w-24`} type="number" min="0" defaultValue={st.partnerOverdueDays} onBlur={e => set({ partnerOverdueDays: Number(e.target.value) })} /><span className="text-xs text-[#717182]">day(s)</span></span></Row>
        </div>
      </Card>

      <Card title={<span className="inline-flex items-center gap-2">Indication and material mapping {unmapped > 0 && <Pill tone="amber">{unmapped} to map</Pill>}</span>} sub="Each catalog item maps to a CAD indication and material, once per lab. Unmapped items create the order with teeth and scans only, and the technician picks the indication (and can save it as a rule)." pad={false}>
        {cads.length === 0 ? <p className="text-xs text-[#717182] p-4">No CAD selected (outsource only).</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr><th className={th}>Catalog item</th>{cads.map(c => <th key={c} className={th} colSpan={2}>{c === 'exocad' ? 'exocad' : '3Shape'}: indication · material</th>)}</tr></thead>
              <tbody>{items.map(i => (
                <tr key={i.id} className={cads.some(c => !st.mapping[i.id]?.[c]) ? 'bg-[#FFFBEB]' : ''}>
                  <td className={td}><span className="font-semibold">{i.name}</span><span className="block text-[10px] text-[#717182]">{i.department}</span></td>
                  {cads.map(c => {
                    const m = st.mapping[i.id]?.[c];
                    return [
                      <td key={`${c}-i`} className={td}><select className={inputSm} value={m?.indication ?? ''} onChange={e => { setMapping(i.id, c, e.target.value ? { indication: e.target.value, material: m?.material ?? MATERIALS[0] } : null); }}><option value="">Not mapped</option>{INDICATIONS[c].map(x => <option key={x}>{x}</option>)}</select></td>,
                      <td key={`${c}-m`} className={td}><select className={inputSm} value={m?.material ?? ''} disabled={!m} onChange={e => setMapping(i.id, c, { indication: m!.indication, material: e.target.value })}>{!m && <option value="">—</option>}{MATERIALS.map(x => <option key={x}>{x}</option>)}</select></td>,
                    ];
                  })}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Connectors" sub="A small Smile Genius app on the CAD server (or each CAD PC). Outbound HTTPS only, no open ports; it only touches the order folders it's pointed to. Updates install outside working hours." actions={<button className={btnPrimary} onClick={() => setSetup(true)}><Plug className="w-3.5 h-3.5" /> Set up a connector</button>} pad={false}>
        {s.connectors.length === 0 ? <p className="text-xs text-[#717182] p-4">No connector yet. Set one up on the PC or server that holds the CAD order database.</p> : (
          <table className="w-full">
            <thead><tr><th className={th}>PC</th><th className={th}>CAD</th><th className={th}>Order folder</th><th className={th}>Status</th><th className={th}>Last check-in</th><th className={th} /></tr></thead>
            <tbody>{s.connectors.map(c => (
              <tr key={c.id}>
                <td className={td}><span className="inline-flex items-center gap-1.5 font-semibold">{c.mode === 'shared' ? <Server className="w-3.5 h-3.5 text-[#717182]" /> : <HardDrive className="w-3.5 h-3.5 text-[#717182]" />}{c.pc}</span><span className="block text-[10px] text-[#717182]">{c.mode === 'shared' ? 'Shared server: all CAD PCs' : 'This PC only'} · v{c.version}</span></td>
                <td className={td}>{c.cad === 'exocad' ? 'exocad' : '3Shape'}</td>
                <td className={`${td} font-mono text-[10px]`}>{c.path}</td>
                <td className={td}>{c.status === 'online' ? <Pill tone="green">Online</Pill> : c.status === 'offline' ? <Pill tone="red">Offline{c.queue.length ? ` · ${c.queue.length} queued` : ''}</Pill> : <Pill tone="amber">Needs update</Pill>}{c.testedAt && <span className="block text-[10px] text-[#717182]">Test order OK {new Date(c.testedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}</td>
                <td className={td}>{hoursSince(c.lastSeen) < 0.1 ? 'Just now' : `${Math.round(hoursSince(c.lastSeen) * 10) / 10}h ago`}{c.status === 'offline' && hoursSince(c.lastSeen) >= 2 && <span className="block text-[10px] text-[#C62828]">Admin alerted (over 2h)</span>}</td>
                <td className={`${td} text-right whitespace-nowrap`}>
                  <button className={`${btn} mr-1`} title="Run a test order" onClick={() => { const ok = healthCheck(c.id); ok ? toast.success('Health check passed: test order created and removed') : toast.error(c.status === 'offline' ? 'Offline: the test order is queued' : 'Test order failed: the CAD order format changed. Update the connector'); }}><Stethoscope className="w-3 h-3" /></button>
                  {c.status === 'needs-update' && <button className={`${btn} mr-1`} onClick={() => { updateConnector(c.id); toast.success('Updated to 1.4.2; queued orders written'); }}><Wrench className="w-3 h-3" /> Update</button>}
                  {c.status === 'online'
                    ? <button className={`${btn} mr-1`} title="Demo: the PC goes off" onClick={() => goOffline(c.id)}><Power className="w-3 h-3" /></button>
                    : <button className={`${btn} mr-1`} title="Demo: back online" onClick={() => { reconnect(c.id); toast.success('Back online: queued orders written'); }}><RefreshCw className="w-3 h-3" /></button>}
                  <button className={btn} title="Remove" onClick={() => { if (window.confirm(`Remove the connector on ${c.pc}?`)) removeConnector(c.id); }}><Trash2 className="w-3 h-3" /></button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>

      {setup && <ConnectorSetup onClose={() => setSetup(false)} />}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 pb-4 border-b border-[#F0EFF6] last:border-0 last:pb-0">
      <div><p className="text-xs font-semibold text-[#030213]">{label}</p>{hint && <p className="text-[11px] text-[#717182] mt-0.5">{hint}</p>}</div>
      <div className="md:col-span-2">{children}</div>
    </div>
  );
}

const STEPS = ['Download', 'Sign in', 'Find CAD', 'Where it runs', 'Test order'];

/** The guided install, simulated: download, sign in, detect CAD folders, choose where it runs, test order. */
function ConnectorSetup({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ cad: CadSoftware; path: string; use: boolean }[]>([]);
  const [mode, setMode] = useState<Connector['mode']>('shared');
  const [pc, setPc] = useState('CAD-SERVER-2');
  const [tested, setTested] = useState<string[]>([]);
  const wait = (ms: number, then: () => void) => { setBusy(true); window.setTimeout(() => { setBusy(false); then(); }, ms); };

  function finish() {
    for (const f of found.filter(x => x.use)) addConnector({ id: `con-${f.cad}-${Date.now().toString(36)}`, pc, cad: f.cad, path: f.path, mode, version: '1.4.2', lastSeen: new Date().toISOString(), status: 'online', queue: [], testedAt: new Date().toISOString() });
    toast.success(`Connector running on ${pc}`);
    onClose();
  }

  return (
    <Modal isOpen onClose={onClose} size="lg" title="Set up a connector" footer={
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#717182]">Demo: nothing is installed. A few minutes, no IT help needed.</span>
        <div className="flex gap-2">
          {step > 0 && step < 4 && <button className={btn} onClick={() => setStep(x => x - 1)}>Back</button>}
          {step === 4 ? <button className={btnPrimary} disabled={tested.length < found.filter(f => f.use).length} onClick={finish}>Finish</button> : null}
        </div>
      </div>
    }>
      <div className="flex gap-1.5 mb-4">{STEPS.map((x, i) => <span key={x} className={`flex-1 text-center text-[10px] font-semibold py-1 rounded ${i < step ? 'bg-[#E8F5E9] text-[#2E7D32]' : i === step ? 'bg-[#EEF4FF] text-[#1565C0]' : 'bg-[#F3F3F5] text-[#A0A0B0]'}`}>{i + 1}. {x}</span>)}</div>
      <div className="space-y-3 text-sm">
        {step === 0 && <>
          <p>Download the signed installer on the PC or server that holds the CAD order database (the shared drive or server most labs use).</p>
          <div className="flex items-center gap-3 rounded-xl border border-[#E0E0E6] p-3"><ShieldCheck className="w-8 h-8 text-[#2E7D32]" /><div className="flex-1"><p className="font-semibold">SmileGeniusConnector-1.4.2.msi</p><p className="text-xs text-[#717182]">Windows 10/11 · 18 MB · signed by Smile Genius Ltd</p></div><button className={btnPrimary} disabled={busy} onClick={() => wait(900, () => setStep(1))}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download</button></div>
        </>}
        {step === 1 && <>
          <p>Open it and sign in with your Smile Genius account. It sits in the system tray from then on.</p>
          <button className={btnPrimary} disabled={busy} onClick={() => wait(800, () => setStep(2))}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Signed in as Sajid Mahmood</button>
        </>}
        {step === 2 && <>
          <p>The connector looks for exocad and 3Shape and their order folders. Confirm them, or point it to the right place.</p>
          {!found.length ? <button className={btnPrimary} disabled={busy} onClick={() => wait(1200, () => setFound([{ cad: 'exocad', path: '\\\\CAD-SERVER-2\\exocad\\DentalDB\\Orders', use: true }, { cad: '3shape', path: 'C:\\3Shape\\DentalSystem\\Orders', use: true }]))}>{busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking…</> : 'Find CAD software'}</button> : (
            <div className="space-y-2">
              {found.map((f, i) => (
                <div key={f.cad} className="rounded-lg border border-[#E0E0E6] p-2.5">
                  <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={f.use} onChange={e => setFound(x => x.map((y, k) => (k === i ? { ...y, use: e.target.checked } : y)))} /> {f.cad === 'exocad' ? 'exocad DentalDB 3.1 Rijeka' : '3Shape Dental System 2024'} found</label>
                  <input className={`${input} mt-1.5 font-mono text-xs`} value={f.path} onChange={e => setFound(x => x.map((y, k) => (k === i ? { ...y, path: e.target.value } : y)))} />
                </div>
              ))}
              <button className={btnPrimary} disabled={!found.some(f => f.use)} onClick={() => setStep(3)}>Looks right</button>
            </div>
          )}
        </>}
        {step === 3 && <>
          <Field label="Where does the CAD order database live?">
            <Seg value={mode} onChange={setMode} options={[{ value: 'shared', label: 'Shared server: one connector for all CAD PCs' }, { value: 'per-pc', label: 'Each PC has its own: one connector per PC' }]} />
          </Field>
          <Field label="This PC's name"><input className={input} value={pc} onChange={e => setPc(e.target.value)} /></Field>
          {mode === 'per-pc' && <Note>Orders go to the PC chosen by the technician assignment or restoration type. Set up the connector on each CAD PC.</Note>}
          <button className={btnPrimary} disabled={!pc.trim()} onClick={() => setStep(4)}>Next</button>
        </>}
        {step === 4 && <>
          <p>A test order is created in each CAD. Open it there and check it looks right: patient, teeth, indication and the scans.</p>
          {found.filter(f => f.use).map(f => (
            <div key={f.cad} className="flex items-center justify-between gap-2 rounded-lg border border-[#E0E0E6] p-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5">{tested.includes(f.cad) ? <CheckCircle2 className="w-4 h-4 text-[#2E7D32]" /> : <Circle className="w-4 h-4 text-[#D4CEE1]" />} {f.cad === 'exocad' ? 'exocad' : '3Shape'}: test order <span className="font-mono">SG-TEST-0001</span> (crown on 36, Zirconia, 3 scans)</span>
              {!tested.includes(f.cad) && <button className={btn} disabled={busy} onClick={() => wait(1000, () => setTested(x => [...x, f.cad]))}>{busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Create & I checked it</button>}
            </div>
          ))}
        </>}
      </div>
    </Modal>
  );
}

