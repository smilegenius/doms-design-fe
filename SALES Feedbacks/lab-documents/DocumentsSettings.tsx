import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Building2, ChevronDown, Eye, FileDown, FileSignature, Printer, Image as ImageIcon, Info, Lock, PenLine, Plus, RotateCcw, Tag, Trash2, Upload } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { useAuth } from '../../src/app/context/AuthContext';
import { teamMemberFor } from '../lab-prescription-inbox/data';
import { getIntakeConfig } from '../intake-form/intakeStore';
import { casesFor } from '../bulk-actions/BulkDialogs';
import { SgOrderFormPrint } from '../bulk-actions/printForms';
import { saveDocs, useDocs, type DocsSettings, type Jurisdiction } from './docsStore';
import { euBlocker, saveErrors } from './engine';
import { FullStatement, fullStatementHtml } from './FullStatement';
import { paperPageCss } from './DocumentPrint';
import { printPages } from '../bulk-actions/printForms';
import { saveBlob } from '../bulk-actions/zip';
import { renderToStaticMarkup } from 'react-dom/server';
import { EU_DEFAULT, TOKENS, UK_DEFAULT } from './templates';
import { SIGNATURE_FONT } from './DocumentPrint';
import CasePicker from './CasePicker';

// ── Settings › Order form ────────────────────────────────────────────────────
// Branding (logo, MHRA, DAMAS, field emphasis), Conformity statement (one
// short UK and/or EU statement at the bottom of the order form) and Case
// label. The lab's name, address and phone come from Lab info. A live preview
// shows the order form for any case as you change things. Validation runs on
// save. Owners and admins edit; everyone else sees it read-only.

type Group = 'branding' | 'statement' | 'label' | 'full';

const input = 'w-full border border-[#E0E0E6] rounded-lg px-3 py-2 text-sm bg-white disabled:bg-[#F8F9FC] disabled:text-[#717182]';
const lbl = 'block text-xs font-semibold text-[#030213] mb-1';
const hint = 'text-[11px] text-[#717182] mt-1';

function Toggle({ on, onChange, disabled, label, sub, badge }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; sub?: ReactNode; badge?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#030213]">{label}{badge && <span className="ml-2 align-middle px-1.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#047857] text-[10px] font-semibold">{badge}</span>}</p>
        {sub && <p className={hint}>{sub}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
        className={`relative w-10 h-6 rounded-full flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${on ? 'bg-gradient-to-r from-[#4D8EF7] to-[#7C6BFF]' : 'bg-[#D4CEE1]'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function Section({ id, open, onToggle, title, sub, icon: Icon, children, locked = false }: { id: Group; open: boolean; onToggle: (g: Group) => void; title: string; sub: string; icon: any; children: ReactNode; locked?: boolean }) {
  return (
    <div id={`docs-${id}`} className="bg-white border border-[#E0E0E6] rounded-xl">
      <button type="button" onClick={() => onToggle(id)} className="w-full flex items-center gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <Icon className="w-4 h-4 text-[#4D8EF7]" />
        <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-[#030213]">{title}</p><p className="text-[11px] text-[#717182]">{sub}</p></div>
        <ChevronDown className={`w-4 h-4 text-[#717182] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <fieldset disabled={locked} className="px-4 pb-4 border-t border-[#F0EFF6] pt-3 space-y-3 min-w-0">{children}</fieldset>}
    </div>
  );
}

/** One jurisdiction's card: the law it cites, (EU) its extra details, and the wording behind "Edit wording". */
function RegimeCard({ tone, title, law, active, text, onText, defaultText, children }: {
  tone: 'uk' | 'eu'; title: string; law: string; active: boolean;
  text: string; onText: (v: string) => void; defaultText: string; children?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const c = tone === 'uk' ? { bar: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', chip: 'bg-[#DBEAFE] text-[#1E40AF]' } : { bar: '#B45309', bg: '#FFFBEB', border: '#FDE68A', chip: 'bg-[#FEF3C7] text-[#92400E]' };
  return (
    <div className={`rounded-xl border overflow-hidden ${active ? '' : 'opacity-60'}`} style={{ borderColor: c.border }}>
      <div className="px-3 py-2 flex flex-wrap items-center gap-2" style={{ background: c.bg, borderLeft: `4px solid ${c.bar}` }}>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${c.chip}`}>{tone.toUpperCase()}</span>
        <p className="text-sm font-semibold text-[#030213]">{title}</p>
        <span className="text-[11px] text-[#5A5568]">{law}</span>
        <span className="flex-1" />
        <button type="button" className="text-[11px] text-[#4D8EF7] font-medium" onClick={() => setEditing(v => !v)}>{editing ? 'Done' : 'Edit wording'}</button>
      </div>
      {(children || editing) && (
        <div className="p-3 space-y-3 bg-white">
          {children}
          {editing && (
            <div>
              <textarea className={`${input} text-[12px] leading-relaxed`} rows={5} value={text} onChange={e => onText(e.target.value)} />
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-[10px] text-[#A0A0B0] flex-1">Filled in for each case: {TOKENS.map(t => t.token).join(' ')}</p>
                {text !== defaultText && <button type="button" className="text-[11px] text-[#4D8EF7] inline-flex items-center gap-1" onClick={() => onText(defaultText)}><RotateCcw className="w-3 h-3" /> Standard wording</button>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function readImage(file: File, max: number): Promise<{ url: string; width: number }> {
  return new Promise((resolve, reject) => {
    if (file.size > max) { reject(new Error(`That file is over ${Math.round(max / 1024 / 1024)} MB.`)); return; }
    const r = new FileReader();
    r.onload = () => { const url = String(r.result); const img = new Image(); img.onload = () => resolve({ url, width: img.naturalWidth }); img.onerror = () => resolve({ url, width: 0 }); img.src = url; };
    r.onerror = () => reject(new Error('Could not read that file.'));
    r.readAsDataURL(file);
  });
}

export default function DocumentsSettings() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const me = teamMemberFor(user?.email);
  const settings = useDocs();
  const [draft, setDraft] = useState<DocsSettings>(settings);
  const [asTech, setAsTech] = useState(false);
  const canEdit = !asTech && (!me || me.role === 'Super Admin' || me.role === 'Admin');
  const [open, setOpen] = useState<Set<Group>>(() => new Set([(params.get('group') as Group) ?? 'branding']));
  const [previewId, setPreviewId] = useState('CASE-RS-2002');
  const [showFull, setShowFull] = useState(false);
  useEffect(() => { setDraft(settings); }, [settings]);
  useEffect(() => {
    const g = params.get('group') as Group | null;
    if (g) { setOpen(o => new Set([...o, g])); setTimeout(() => document.getElementById(`docs-${g}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }
  }, [params]);

  const set = <K extends keyof DocsSettings>(k: K, v: DocsSettings[K]) => setDraft(d => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const errors = saveErrors(draft);
  const euBlock = euBlocker(draft);
  const toggleGroup = (g: Group) => setOpen(o => { const n = new Set(o); if (n.has(g)) n.delete(g); else n.add(g); return n; });
  const previewCase = casesFor([previewId])[0];
  const lablinkLogo = getIntakeConfig().logo;
  const ukOn = draft.statementOn && draft.jurisdiction !== 'EU';
  const euOn = draft.statementOn && draft.jurisdiction !== 'UK';

  function downloadFull() {
    const name = 'full-statement-blank';
    saveBlob(new Blob([fullStatementHtml(name, renderToStaticMarkup(<FullStatement s={draft} />), paperPageCss(draft))], { type: 'text/html' }), `${name}.html`);
    toast.success('Downloaded. Open it to print, or save it as a PDF.');
  }
  function printFull() {
    if (!printPages([{ key: 'full', node: <FullStatement s={draft} /> }], 'Full statement', paperPageCss(draft))) toast.error('Allow pop-ups to print');
  }
  function save() {
    if (errors.length) { toast.error(errors[0]); return; }
    saveDocs(draft);
    toast.success('Saved. The next printed order form uses these settings.');
  }
  async function uploadLogo(f?: File) {
    if (!f) return;
    if (!/image\/(png|svg\+xml)/.test(f.type)) { toast.error('Upload a PNG or SVG.'); return; }
    try { const { url, width } = await readImage(f, 2 * 1024 * 1024); setDraft(d => ({ ...d, logo: url, logoWidth: width, brandingOn: true })); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#030213]">Order form settings</h2>
            <p className="text-xs text-[#717182] max-w-xl">Your logo on the order form, a short conformity statement at the bottom, and a label for the box. Each switch can be turned back at any time.</p>
          </div>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E0E0E6] bg-white hover:bg-[#F8F9FC]" onClick={() => navigate('/growth/order-form/samples')}><Eye className="w-3.5 h-3.5" /> See samples</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
          {canEdit
            ? <span className="text-[#2E7D32]">You can edit these settings ({me?.role ?? 'Admin'}).</span>
            : <span className="inline-flex items-center gap-1 text-[#717182]"><Lock className="w-3 h-3" /> Read-only. Only the lab owner and admins can change these.</span>}
          <label className="inline-flex items-center gap-1 text-[#717182]"><input type="checkbox" checked={asTech} onChange={e => setAsTech(e.target.checked)} /> Demo: view as a technician</label>
        </div>
      </div>

      <div className="grid 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 items-start">
        <div className="space-y-3 min-w-0">
          <Section id="branding" locked={!canEdit} open={open.has('branding')} onToggle={toggleGroup} icon={ImageIcon} title="Branding" sub="Your logo and registration numbers at the top of the order form">
            <div className="rounded-lg border border-[#E0E0E6] bg-[#F8F9FC] px-3 py-2 flex flex-wrap items-start gap-3">
              <Building2 className="w-4 h-4 text-[#4D8EF7] mt-0.5" />
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-semibold text-[#030213]">{draft.displayName}</p>
                <p className="text-[#5A5568]">{draft.address.split('\n').filter(Boolean).join(', ')} · {draft.phone}</p>
                <p className="text-[11px] text-[#717182] mt-0.5">Name, address and phone come from Lab info (Settings › DSO Info), so they're the same everywhere.</p>
              </div>
              <button type="button" className="text-[11px] text-[#4D8EF7] font-medium hover:underline" onClick={() => navigate('/growth/settings?tab=dso')}>Edit in Lab info</button>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-40 h-16 rounded-lg border border-dashed border-[#D4CEE1] flex items-center justify-center bg-[#F8F9FC] overflow-hidden">
                {draft.logo ? <img src={draft.logo} alt="Lab logo" className="max-h-14 max-w-36 object-contain" /> : <span className="text-[11px] text-[#A0A0B0]">No logo · our mark shows</span>}
              </div>
              <div className="space-y-1">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E0E0E6] bg-white hover:bg-[#F8F9FC] cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Upload logo (PNG or SVG, up to 2 MB)
                  <input type="file" accept="image/png,image/svg+xml" className="hidden" onChange={e => uploadLogo(e.target.files?.[0])} />
                </label>
                <div className="flex gap-2">
                  {lablinkLogo && !draft.logo && <button type="button" className="text-[11px] text-[#4D8EF7] font-medium hover:underline" onClick={() => setDraft(d => ({ ...d, logo: lablinkLogo, brandingOn: true }))}>Use the LabLink logo</button>}
                  {draft.logo && <button type="button" className="text-[11px] text-[#C62828] font-medium hover:underline" onClick={() => setDraft(d => ({ ...d, logo: null, logoWidth: null, brandingOn: false }))}>Remove logo</button>}
                </div>
                {draft.logo && !!draft.logoWidth && draft.logoWidth < 300 && <p className="text-[11px] text-[#B45309]">This logo is {draft.logoWidth} px wide. 300 px or more prints sharper.</p>}
              </div>
            </div>
            <Toggle label="Show my logo on the order form" on={draft.brandingOn && !!draft.logo} disabled={!draft.logo} onChange={v => set('brandingOn', v)}
              sub={draft.logo ? 'Your logo and details at the top; “Powered by Smile Genius” moves to the footer.' : 'Upload a logo first.'} />
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className={lbl}>MHRA registration number</label><input className={input} maxLength={20} value={draft.mhra} onChange={e => set('mhra', e.target.value)} placeholder="e.g. CA012345" /><p className={hint}>Optional. Prints at the top and under the statement.</p></div>
              <div><label className={lbl}>DAMAS number <span className="font-normal text-[#717182]">(voluntary scheme)</span></label><input className={input} maxLength={20} value={draft.damas} onChange={e => set('damas', e.target.value)} /><p className={hint}>Optional. Prints when you hold one.</p></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Paper size</label><select className={input} value={draft.paper} onChange={e => set('paper', e.target.value as DocsSettings['paper'])}><option value="A4">A4</option><option value="Letter">US Letter</option></select></div>
            </div>
            <Toggle label="Field emphasis" badge="On by default" on={draft.emphasis} onChange={v => set('emphasis', v)} sub="Highlights the dentist name, patient name, requested delivery date and case instructions, so technicians see them first." />
          </Section>

          <Section id="statement" locked={!canEdit} open={open.has('statement')} onToggle={toggleGroup} icon={FileSignature} title="Conformity statement" sub="A short statement for a custom-made device at the bottom of the order form">
            <p className="text-xs text-[#5A5568]">Prints your signed statement for a custom-made device at the bottom of every order form. Leave it off if you produce statements in another system.</p>
            <Toggle label="Print the statement on the order form" on={draft.statementOn} onChange={v => set('statementOn', v)} />

            <div>
              <label className={lbl}>Where you send work</label>
              <div className="flex flex-wrap gap-1.5">
                {([['UK', 'UK only'], ['EU', 'EU only'], ['Both', 'UK and EU']] as [Jurisdiction, string][]).map(([j, l]) => {
                  const off = j !== 'UK' && !!euBlock;
                  return <button type="button" key={j} disabled={off} title={off ? euBlock ?? '' : undefined} onClick={() => set('jurisdiction', j)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-40 disabled:cursor-not-allowed ${draft.jurisdiction === j ? 'bg-[#EEF4FF] border-[#4D8EF7] text-[#1565C0]' : 'bg-white border-[#E0E0E6] text-[#5A5568]'}`}>{l}</button>;
                })}
              </div>
              {euBlock && <p className="text-[11px] text-[#B45309] mt-1">For EU, add your manufacturing site and EU authorised representative below.</p>}
            </div>

            <RegimeCard tone="uk" title="UK statement" law="UK Medical Devices Regulations 2002" active={ukOn} text={draft.ukText} onText={v => set('ukText', v)} defaultText={UK_DEFAULT} />

            <RegimeCard tone="eu" title="EU statement" law="EU MDR 2017/745" active={euOn} text={draft.euText} onText={v => set('euText', v)} defaultText={EU_DEFAULT}>
              <div>
                <label className={lbl}>Manufacturing sites</label>
                {draft.sites.map((st, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input className={input} placeholder="Site name" value={st.name} onChange={e => set('sites', draft.sites.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                    <input className={input} placeholder="Address" value={st.address} onChange={e => set('sites', draft.sites.map((x, k) => (k === i ? { ...x, address: e.target.value } : x)))} />
                    <button type="button" aria-label="Remove site" className="p-2 text-[#C62828]" onClick={() => set('sites', draft.sites.filter((_, k) => k !== i))}><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" className="text-xs text-[#4D8EF7] font-medium inline-flex items-center gap-1" onClick={() => set('sites', [...draft.sites, { name: '', address: '' }])}><Plus className="w-3.5 h-3.5" /> Add a site</button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className={lbl}>EU authorised representative</label><input className={input} placeholder="Name" value={draft.authRep.name} onChange={e => set('authRep', { ...draft.authRep, name: e.target.value })} /></div>
                <div><label className={lbl}>&nbsp;</label><input className={input} placeholder="Address in the EU" value={draft.authRep.address} onChange={e => set('authRep', { ...draft.authRep, address: e.target.value })} /></div>
              </div>
            </RegimeCard>


            <div className="border-t border-[#F0EFF6] pt-3 space-y-3">
              <p className="text-sm font-semibold text-[#030213] flex items-center gap-1.5"><PenLine className="w-4 h-4 text-[#4D8EF7]" /> Signed by</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className={lbl}>Name</label><input className={input} placeholder="e.g. Peter Harling" value={draft.signerName} onChange={e => set('signerName', e.target.value)} /></div>
                <div><label className={lbl}>Job title <span className="font-normal text-[#717182]">(optional)</span></label><input className={input} placeholder="e.g. Registered Dental Technician" value={draft.signerTitle} onChange={e => set('signerTitle', e.target.value)} /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {([['typed', 'Typed signature', 'Your name in a handwriting style, like an e-signature.'], ['blank', 'Blank line', 'Sign each form by hand in ink.']] as const).map(([m, title, sub]) => (
                  <button type="button" key={m} onClick={() => set('signatureMode', m)} className={`text-left rounded-lg border px-3 py-2 ${draft.signatureMode === m ? 'border-[#4D8EF7] bg-[#EEF4FF]' : 'border-[#E0E0E6] bg-white'}`}>
                    <p className="text-xs font-semibold text-[#030213]">{title}</p>
                    <p className="text-[11px] text-[#717182]">{sub}</p>
                    <div className="mt-2 h-9 flex items-end">
                      {m === 'typed'
                        ? <span style={{ fontFamily: SIGNATURE_FONT, fontSize: 24, color: '#0B2545', borderBottom: '1px solid #030213', minWidth: 160, lineHeight: 1.1 }}>{draft.signerName || 'Your name'}</span>
                        : <span className="block w-40 border-b border-[#030213]" />}
                    </div>
                  </button>
                ))}
              </div>
                          </div>
          </Section>

          <Section id="label" locked={!canEdit} open={open.has('label')} onToggle={toggleGroup} icon={Tag} title="Case label" sub={draft.labelOn ? 'On · a label for the outgoing box' : 'Off · optional label for the outgoing box'}>
            <Toggle label="Use case labels" on={draft.labelOn} onChange={v => set('labelOn', v)}
              sub="Optional. When on, a “Print case label” button appears in the bottom-right corner of the order form on every case." />
            <p className="text-xs text-[#5A5568]">Lab name and contact, case ID, patient, practice, the product and teeth, and the words “custom-made device”, which UK rules ask for on the packaging.</p>
            {draft.labelOn && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><label className={lbl}>Label stock</label><select className={input} value={draft.labelStock} onChange={e => set('labelStock', e.target.value as DocsSettings['labelStock'])}><option value="62x100">62 × 100 mm</option><option value="102x152">102 × 152 mm</option></select></div>
                </div>
                <button type="button" className="text-xs text-[#4D8EF7] font-medium" onClick={() => navigate(`/growth/order-form/${encodeURIComponent(previewId)}?view=label`)}>Preview the label for {previewId}</button>
              </>
            )}
          </Section>

          <Section id="full" open={open.has('full')} onToggle={toggleGroup} icon={FileDown} title="Full statement" sub="A blank full-page statement for when a dentist asks for one">
            <p className="text-xs text-[#5A5568]">Your lab details are filled in; complete the case details and sign in ink.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E0E0E6] bg-white hover:bg-[#F8F9FC]" onClick={() => setShowFull(v => !v)}><Eye className="w-3.5 h-3.5" /> {showFull ? 'Hide preview' : 'Preview'}</button>
              <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E0E0E6] bg-white hover:bg-[#F8F9FC]" onClick={downloadFull}><FileDown className="w-3.5 h-3.5" /> Download blank</button>
              <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E0E0E6] bg-white hover:bg-[#F8F9FC]" onClick={printFull}><Printer className="w-3.5 h-3.5" /> Print blank</button>
            </div>
            {showFull && (
              <div className="bg-[#EEF0F4] rounded-lg p-3 overflow-hidden">
                <div className="bg-white shadow rounded-sm p-8 mx-auto" style={{ zoom: 0.7, maxWidth: 794 }}><FullStatement s={draft} /></div>
              </div>
            )}
          </Section>
        </div>

        <div className="bg-white border border-[#E0E0E6] rounded-xl p-3 2xl:sticky 2xl:top-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <p className="text-sm font-semibold text-[#030213] mr-auto">Live preview{dirty ? ' (unsaved)' : ''}</p>
            <CasePicker value={previewId} onChange={setPreviewId} label="Case" />
            <button type="button" className="text-[11px] text-[#4D8EF7] font-medium" onClick={() => navigate(`/growth/order-form/${encodeURIComponent(previewId)}`)}>Full size</button>
          </div>
          <div className="bg-[#EEF0F4] rounded-lg p-3 overflow-hidden">
            {previewCase
              ? <div className="bg-white shadow rounded-sm p-6 mx-auto" style={{ zoom: 0.62, maxWidth: 794 }}><SgOrderFormPrint c={previewCase} docs={draft} /></div>
              : <p className="text-xs text-[#717182] p-4">Pick a case.</p>}
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="sticky bottom-0 bg-white/90 backdrop-blur border border-[#E0E0E6] rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0 text-xs">
            {errors.length ? <span className="text-[#B45309] flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{errors.join(' ')}</span>
              : dirty ? <span className="text-[#5A5568]">Unsaved changes.</span> : <span className="text-[#717182]">All changes saved.</span>}
          </div>
          <button type="button" disabled={!dirty} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E0E0E6] bg-white disabled:opacity-40" onClick={() => setDraft(settings)}>Discard</button>
          <button type="button" disabled={!dirty || errors.length > 0} className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#7C6BFF] disabled:opacity-40" onClick={save}>Save</button>
        </div>
      )}
    </div>
  );
}
