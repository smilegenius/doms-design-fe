// ─── Lab Settings › Order Form ───────────────────────────────────────────────
// The lab sets up the new Dental Order Form here (12-Nov-2026): its logo and
// registration numbers, field emphasis and paper size; a short UK and/or EU
// conformity statement at the bottom, with who signs it; and which help
// sections the form's foot keeps. Save applies it to every order form: the
// case page's panel, Full View, Print and Download PDF.
//
// 12-Nov, round 2 (user: "this side look very congested… open on full mode"):
// the Settings tab is now a summary (one row a group, each with Edit) over a
// large preview of the saved form, and the editing happens in a full-screen
// editor: the settings in a column on the left, the live preview of the
// unsaved draft filling the rest, Save and Discard in its top bar.
// The Growth team's Settings › Order form was the reference for what to set
// up; this is built from our own Settings pieces (cards, Toggle, Button).

import { ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ChevronDown, Eye, FileSignature, Image as ImageIcon, LayoutList, Pencil, PenLine, Plus, Printer, RotateCcw,
  SlidersHorizontal, Trash2, Upload, X,
} from 'lucide-react';
import Toggle from '../components/Toggle';
import Button from '../components/Button';
import ModalPortal from '../components/ModalPortal';
import { useToast } from '../context/ToastContext';
import OrderFormSheet, { OrderFormFullView } from './OrderForm';
import { orderFormModelFor } from './FlowCaseDetail';
import { BRIDGE_CASE_ID, MULTI_CASE_ID, ensureBridgeDemo, ensureMultiCaseDemo } from './orderFormDemo';
import {
  DEFAULT_ORDER_FORM_SETTINGS, EU_DEFAULT, PAPER, SIGNATURE_FONT, TOKENS, UK_DEFAULT, euBlocker, saveErrors,
  saveOrderFormSettings, useOrderFormSettings, type Jurisdiction, type OrderFormSettings, type PaperSize,
} from './orderFormSettings';

type Group = 'branding' | 'statement' | 'sections';
const GROUPS: Group[] = ['branding', 'statement', 'sections'];

/** The walkthrough's four examples (/flows/order-form), to preview the form on. */
const PREVIEW_CASES: { id: string; label: string; ensure?: () => void }[] = [
  { id: 'CAS-2026-098', label: 'Crown · William Grant' },
  { id: MULTI_CASE_ID, label: 'Crown + full denture · Margaret Hill', ensure: ensureMultiCaseDemo },
  { id: 'CAS-2026-117', label: 'Full denture, 2 stages · Edward Thomas' },
  { id: BRIDGE_CASE_ID, label: 'Bridge · Ben Ortiz', ensure: ensureBridgeDemo },
];

const input = 'w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]';
const lbl = 'block text-[11px] font-medium text-[#717182] uppercase tracking-wide mb-1';
const hint = 'text-[11px] text-[#717182] mt-1 leading-snug';

// ─── What each group says, in the summary and on its collapsed header ────────

const GROUP_META: Record<Group, { title: string; icon: typeof ImageIcon }> = {
  branding: { title: 'Branding', icon: ImageIcon },
  statement: { title: 'Conformity statement', icon: FileSignature },
  sections: { title: 'Sections on the form', icon: LayoutList },
};

function groupSummary(g: Group, s: OrderFormSettings): string {
  if (g === 'branding') {
    return [
      s.showLogo && s.logo ? 'Your logo' : 'Smile Genius logo',
      s.mhra.trim() && `MHRA ${s.mhra.trim()}`,
      s.damas.trim() && `DAMAS ${s.damas.trim()}`,
      s.emphasis ? 'Field emphasis on' : 'Field emphasis off',
      PAPER[s.paper].label,
    ].filter(Boolean).join(' · ');
  }
  if (g === 'statement') {
    if (!s.statementOn) return 'Off';
    return [s.jurisdiction === 'Both' ? 'UK and EU' : `${s.jurisdiction} only`, s.signerName && `signed by ${s.signerName}`, { typed: 'typed signature', image: 'uploaded signature', blank: 'signed in ink' }[s.signatureMode]]
      .filter(Boolean).join(' · ');
  }
  const off = [!s.showHowTo && 'how-to video', !s.showHelp && 'help', !s.showDuplicateCheck && 'duplicate check'].filter(Boolean);
  return off.length ? `Hidden: ${off.join(', ')}` : 'All shown';
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

/** A collapsible group of settings, in the Settings page's SectionCard look. */
function Section({ id, open, onToggle, sub, children }: { id: Group; open: boolean; onToggle: (g: Group) => void; sub: string; children: ReactNode }) {
  const { title, icon: Icon } = GROUP_META[id];
  return (
    <div id={`of-${id}`} className="bg-white rounded-xl border border-[#E0E0E6] overflow-hidden scroll-mt-4">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left bg-[#F8F9FC] hover:bg-[#F3F3F5] transition-colors ${open ? 'border-b border-[#F0EFF6]' : ''}`}
      >
        <span className="w-8 h-8 rounded-lg bg-white border border-[#E0E0E6] flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-[#4D8EF7]" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#030213]">{title}</h3>
          {!open && <p className="text-[11px] text-[#717182] truncate">{sub}</p>}
        </div>
        <ChevronDown className={`w-4 h-4 text-[#717182] transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 py-4 space-y-4">{children}</div>}
    </div>
  );
}

/** A labelled switch row, as the Notifications settings lay them out. */
function SwitchRow({ label, sub, on, onChange, disabled, title }: { label: string; sub?: ReactNode; on: boolean; onChange: () => void; disabled?: boolean; title?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className={`text-sm font-medium ${disabled ? 'text-[#A0A0B0]' : 'text-[#030213]'}`}>{label}</p>
        {sub && <p className={hint}>{sub}</p>}
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} title={title} />
    </div>
  );
}

/** Pick one of a few, as pill buttons. */
function Segmented<T extends string>({ value, options, onChange, disabledFor }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; disabledFor?: (v: T) => string | null;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, l]) => {
        const why = disabledFor?.(v) ?? null;
        const on = value === v;
        return (
          <button
            type="button"
            key={v}
            disabled={!!why}
            title={why ?? undefined}
            onClick={() => onChange(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              on ? 'bg-[#EEF4FF] border-[#4D8EF7] text-[#1565C0]' : 'bg-white border-[#E0E0E6] text-[#5A5568] hover:bg-[#F8F9FC]'
            }`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

/** One jurisdiction's statement: what it cites, (EU) its extra details, and its wording behind Edit wording. */
function StatementCard({ tag, title, law, active, text, onText, standard, children }: {
  tag: 'UK' | 'EU'; title: string; law: string; active: boolean; text: string; onText: (v: string) => void; standard: string; children?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className={`rounded-xl border border-[#E0E0E6] overflow-hidden transition-opacity ${active ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[#F8F9FC] border-b border-[#F0EFF6]">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EEF4FF] text-[#1565C0] border border-[#DBEAFE]">{tag}</span>
        <p className="text-sm font-semibold text-[#030213]">{title}</p>
        <span className="text-[11px] text-[#717182]">{law}</span>
        <span className="flex-1" />
        <button type="button" onClick={() => setEditing(v => !v)} className="text-xs font-medium text-[#4D8EF7] hover:text-[#3578E5]">
          {editing ? 'Done' : 'Edit wording'}
        </button>
      </div>
      {(children || editing) && (
        <div className="p-3 space-y-3">
          {children}
          {editing && (
            <div>
              <textarea className={`${input} text-xs leading-relaxed`} rows={7} value={text} onChange={e => onText(e.target.value)} aria-label={`${tag} statement wording`} />
              <div className="flex flex-wrap items-start gap-2 mt-1.5">
                <p className="text-[10.5px] text-[#A0A0B0] flex-1 leading-snug">
                  Filled in from each case: {TOKENS.map(t => <code key={t.token} title={t.label} className="mr-1 text-[#5A5568]">{t.token}</code>)}
                </p>
                {text !== standard && (
                  <button type="button" onClick={() => onText(standard)} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4D8EF7]">
                    <RotateCcw className="w-3 h-3" /> Standard wording
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function readImage(file: File): Promise<{ url: string; width: number }> {
  return new Promise((resolve, reject) => {
    if (file.size > 2 * 1024 * 1024) { reject(new Error('That file is over 2 MB.')); return; }
    const r = new FileReader();
    r.onload = () => {
      const url = String(r.result);
      const img = new Image();
      img.onload = () => resolve({ url, width: img.naturalWidth });
      img.onerror = () => resolve({ url, width: 0 });
      img.src = url;
    };
    r.onerror = () => reject(new Error('That file couldn’t be read.'));
    r.readAsDataURL(file);
  });
}

/** The sheet at its print width, scaled down (never up) to the width it's given. */
function ScaledSheet({ children, sheetWidth = 760 }: { children: ReactNode; sheetWidth?: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 0.5, h: 600 });
  useLayoutEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const scale = Math.min(1, o.clientWidth / sheetWidth);
      setSize({ scale, h: i.scrollHeight * scale });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [sheetWidth]);
  return (
    <div ref={outer} className="relative overflow-hidden" style={{ height: size.h }}>
      <div ref={inner} className="absolute top-0 left-0 origin-top-left" style={{ width: sheetWidth, transform: `scale(${size.scale})` }}>
        {children}
      </div>
    </div>
  );
}

/** A preview case's order form; the two orders made for the walkthrough are added to the flow's demo when picked. */
function usePreviewModel(caseId: string) {
  return useMemo(() => {
    PREVIEW_CASES.find(c => c.id === caseId)?.ensure?.();
    return orderFormModelFor(caseId);
  }, [caseId]);
}

function CasePicker({ value, onChange, className = '' }: { value: string; onChange: (id: string) => void; className?: string }) {
  return (
    <select aria-label="Preview case" className={`${input} ${className}`} value={value} onChange={e => onChange(e.target.value)}>
      {PREVIEW_CASES.map(c => <option key={c.id} value={c.id}>{c.id} · {c.label}</option>)}
    </select>
  );
}

/** The form on a grey desk, as a page. */
function PreviewPage({ caseId, settings }: { caseId: string; settings: OrderFormSettings }) {
  const model = usePreviewModel(caseId);
  if (!model) return <p className="text-xs text-[#717182] p-4">{caseId} isn’t in the demo data. Reset the demo data on the New case flow, then try again.</p>;
  return (
    <div className="bg-white rounded-md shadow-[0_4px_24px_-8px_rgba(3,2,19,0.18)] border border-[#E0E0E6] p-4 sm:p-6">
      <ScaledSheet>
        <OrderFormSheet model={model} settings={settings} roomy />
      </ScaledSheet>
    </div>
  );
}

// ─── The settings themselves (the editor's left column) ──────────────────────

function SettingsForm({ draft, setDraft, open, onToggle }: {
  draft: OrderFormSettings; setDraft: (f: (d: OrderFormSettings) => OrderFormSettings) => void; open: Set<Group>; onToggle: (g: Group) => void;
}) {
  const { toast } = useToast();
  const set = <K extends keyof OrderFormSettings>(k: K, v: OrderFormSettings[K]) => setDraft(d => ({ ...d, [k]: v }));
  const euBlock = euBlocker(draft);
  const ukOn = draft.statementOn && draft.jurisdiction !== 'EU';
  const euOn = draft.statementOn && draft.jurisdiction !== 'UK';

  async function uploadLogo(f?: File) {
    if (!f) return;
    if (!/^image\/(png|svg\+xml|jpeg)$/.test(f.type)) { toast.error('Upload a PNG, SVG or JPG.'); return; }
    try {
      const { url, width } = await readImage(f);
      setDraft(d => ({ ...d, logo: url, logoWidth: width, showLogo: true }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const sigInput = useRef<HTMLInputElement>(null);
  async function uploadSignature(f?: File) {
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) { toast.error('Upload a PNG or JPG of the signature.'); return; }
    try {
      const { url } = await readImage(f);
      setDraft(d => ({ ...d, signatureImage: url, signatureMode: 'image' }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      {/* ─── Branding ─── */}
      <Section id="branding" open={open.has('branding')} onToggle={onToggle} sub={groupSummary('branding', draft)}>
        <div className="flex items-center gap-3">
          <div className="w-32 h-16 rounded-lg border border-dashed border-[#D4CEE1] bg-[#F8F9FC] flex items-center justify-center overflow-hidden flex-shrink-0">
            {draft.logo
              ? <img src={draft.logo} alt="Your lab logo" className="max-h-14 max-w-28 object-contain" />
              : <span className="text-[11px] text-[#A0A0B0] px-2 text-center">No logo yet</span>}
          </div>
          <div className="space-y-1 min-w-0">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#4D8EF7] border border-[#C8D8FC] hover:bg-[#EEF4FF] cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              {draft.logo ? 'Replace logo' : 'Upload logo'}
              <input type="file" accept="image/png,image/svg+xml,image/jpeg" className="hidden" onChange={e => { uploadLogo(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <p className="text-[11px] text-[#717182]">PNG, SVG or JPG, up to 2 MB.</p>
            {draft.logo && (
              <button type="button" onClick={() => setDraft(d => ({ ...d, logo: null, logoWidth: null, showLogo: false }))} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#C62828] hover:underline">
                <Trash2 className="w-3 h-3" /> Remove logo
              </button>
            )}
          </div>
        </div>
        {draft.logo && !!draft.logoWidth && draft.logoWidth < 300 && (
          <p className="text-[11px] text-[#B45309] -mt-2">This logo is {draft.logoWidth} px wide. 300 px or more prints sharper.</p>
        )}
        <SwitchRow
          label="Show my logo on the order form"
          sub={draft.logo ? 'In place of the Smile Genius logo; “Powered by Smile Genius” moves to the foot.' : 'Upload a logo first.'}
          on={draft.showLogo && !!draft.logo}
          disabled={!draft.logo}
          title={draft.logo ? undefined : 'Upload a logo first'}
          onChange={() => set('showLogo', !draft.showLogo)}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl} htmlFor="of-mhra">MHRA registration</label>
            <input id="of-mhra" className={input} maxLength={20} value={draft.mhra} onChange={e => set('mhra', e.target.value)} placeholder="e.g. CA012345" />
          </div>
          <div>
            <label className={lbl} htmlFor="of-damas">DAMAS number</label>
            <input id="of-damas" className={input} maxLength={20} value={draft.damas} onChange={e => set('damas', e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <p className={`${hint} -mt-2`}>Both optional. They print under your lab’s name in the Lab box.</p>
        <div className="border-t border-[#F0EFF6] pt-4">
          <SwitchRow
            label="Field emphasis"
            sub="Delivery dates print bold and the instructions get a darker border, so technicians see them first."
            on={draft.emphasis}
            onChange={() => set('emphasis', !draft.emphasis)}
          />
        </div>
        <div>
          <p className={lbl}>Paper size</p>
          <Segmented<PaperSize> value={draft.paper} onChange={v => set('paper', v)} options={(Object.keys(PAPER) as PaperSize[]).map(p => [p, PAPER[p].label])} />
          <p className={hint}>Print and Download PDF fit the form on one page of this size.</p>
        </div>
      </Section>

      {/* ─── Conformity statement ─── */}
      <Section id="statement" open={open.has('statement')} onToggle={onToggle} sub={groupSummary('statement', draft)}>
        <SwitchRow
          label="Print the statement on the order form"
          sub="Your signed statement for a custom-made device, at the bottom of every order form. Leave it off if you make statements in another system."
          on={draft.statementOn}
          onChange={() => set('statementOn', !draft.statementOn)}
        />
        <div>
          <p className={lbl}>Where you send work</p>
          <Segmented<Jurisdiction>
            value={draft.jurisdiction}
            onChange={v => set('jurisdiction', v)}
            options={[['UK', 'UK only'], ['EU', 'EU only'], ['Both', 'UK and EU']]}
            disabledFor={v => (v !== 'UK' ? euBlock : null)}
          />
          {euBlock && <p className="text-[11px] text-[#B45309] mt-1.5">For the EU, add a manufacturing site and your EU authorised representative below.</p>}
        </div>
        <StatementCard tag="UK" title="UK statement" law="UK MDR 2002" active={ukOn} text={draft.ukText} onText={v => set('ukText', v)} standard={UK_DEFAULT} />
        <StatementCard tag="EU" title="EU statement" law="EU MDR 2017/745" active={euOn} text={draft.euText} onText={v => set('euText', v)} standard={EU_DEFAULT}>
          <div>
            <p className={lbl}>Manufacturing sites</p>
            <div className="space-y-2">
              {draft.sites.map((st, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <input className={input} placeholder="Site name" aria-label={`Site ${i + 1} name`} value={st.name} onChange={e => set('sites', draft.sites.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                    <input className={input} placeholder="Address" aria-label={`Site ${i + 1} address`} value={st.address} onChange={e => set('sites', draft.sites.map((x, k) => (k === i ? { ...x, address: e.target.value } : x)))} />
                  </div>
                  <button type="button" aria-label={`Remove site ${i + 1}`} onClick={() => set('sites', draft.sites.filter((_, k) => k !== i))} className="w-9 h-9 rounded-lg flex items-center justify-center text-[#717182] hover:text-[#C62828] hover:bg-[#FFF5F5] flex-shrink-0 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => set('sites', [...draft.sites, { name: '', address: '' }])} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#4D8EF7] hover:text-[#3578E5]">
              <Plus className="w-3.5 h-3.5" /> Add a site
            </button>
          </div>
          <div>
            <p className={lbl}>EU authorised representative</p>
            <div className="space-y-1.5">
              <input className={input} placeholder="Name" aria-label="Representative name" value={draft.authRep.name} onChange={e => set('authRep', { ...draft.authRep, name: e.target.value })} />
              <input className={input} placeholder="Address in the EU" aria-label="Representative address" value={draft.authRep.address} onChange={e => set('authRep', { ...draft.authRep, address: e.target.value })} />
            </div>
          </div>
        </StatementCard>

        <div className="border-t border-[#F0EFF6] pt-4 space-y-3">
          <p className="text-sm font-semibold text-[#030213] flex items-center gap-1.5"><PenLine className="w-4 h-4 text-[#4D8EF7]" /> Signed by</p>
          {/* 12-Nov: with the statement off, nothing here reaches the preview; say so where the user is typing. */}
          {!draft.statementOn && (
            <div className="flex items-start gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
              <Eye className="w-3.5 h-3.5 text-[#B45309] mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-[#92400E] leading-snug flex-1">The statement is off, so it isn’t on the form or in the preview.</p>
              <button type="button" onClick={() => set('statementOn', true)} className="text-[11px] font-semibold text-[#4D8EF7] hover:underline whitespace-nowrap">Turn it on</button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} htmlFor="of-signer">Name</label>
              <input id="of-signer" className={input} placeholder="e.g. Peter Harling" value={draft.signerName} onChange={e => set('signerName', e.target.value)} />
            </div>
            <div>
              <label className={lbl} htmlFor="of-title">Job title</label>
              <input id="of-title" className={input} placeholder="Optional" value={draft.signerTitle} onChange={e => set('signerTitle', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([['typed', 'Typed', 'Your name in script.'], ['image', 'Upload', 'An image of your signature.'], ['blank', 'Blank line', 'Sign each form in ink.']] as const).map(([mode, title, sub]) => {
              const on = draft.signatureMode === mode;
              return (
                <button
                  type="button"
                  key={mode}
                  // Upload with no image yet goes straight to the file picker; the mode is set once a file is read.
                  onClick={() => (mode === 'image' && !draft.signatureImage ? sigInput.current?.click() : set('signatureMode', mode))}
                  aria-pressed={on}
                  className={`text-left rounded-xl border px-2.5 py-2.5 min-w-0 transition-colors ${on ? 'border-[#4D8EF7] bg-[#EEF4FF]' : 'border-[#E0E0E6] bg-white hover:bg-[#F8F9FC]'}`}
                >
                  <p className="text-xs font-semibold text-[#030213]">{title}</p>
                  <p className="text-[11px] text-[#717182] leading-snug">{sub}</p>
                  <div className="mt-2 h-7 flex items-end">
                    {mode === 'typed'
                      ? <span className="border-b border-[#030213] pr-3 text-[#030213] truncate max-w-full" style={{ fontFamily: SIGNATURE_FONT, fontSize: 17, lineHeight: 1.1 }}>{draft.signerName || 'Your name'}</span>
                      : mode === 'image'
                        ? draft.signatureImage
                          ? <span className="block w-full border-b border-[#030213]"><img src={draft.signatureImage} alt="Your signature" className="block h-6 max-w-full object-contain object-left" /></span>
                          : <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7]"><Upload className="w-3.5 h-3.5" /> Choose file</span>
                        : <span className="block w-full border-b border-[#030213]" />}
                  </div>
                </button>
              );
            })}
          </div>
          <input ref={sigInput} type="file" accept="image/png,image/jpeg" className="hidden" onChange={e => { uploadSignature(e.target.files?.[0]); e.target.value = ''; }} />
          {draft.signatureImage ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button type="button" onClick={() => sigInput.current?.click()} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4D8EF7] hover:underline">
                <Upload className="w-3 h-3" /> Replace signature
              </button>
              <button type="button" onClick={() => setDraft(d => ({ ...d, signatureImage: null, signatureMode: d.signatureMode === 'image' ? 'typed' : d.signatureMode }))} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#C62828] hover:underline">
                <Trash2 className="w-3 h-3" /> Remove signature
              </button>
            </div>
          ) : (
            <p className={hint}>Upload: a PNG or JPG up to 2 MB. Dark ink on a white or clear background prints best.</p>
          )}
        </div>
      </Section>

      {/* ─── Sections on the form ─── */}
      <Section id="sections" open={open.has('sections')} onToggle={onToggle} sub={groupSummary('sections', draft)}>
        {/* The Toggle's disabled look reads as off, so this one says it in words. */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#030213]">Open this case</p>
            <p className={hint}>The QR code that opens the case in Smile Genius.</p>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F0EFF6] text-[#717182] border border-[#E0E0E6] whitespace-nowrap flex-shrink-0">Always on</span>
        </div>
        <SwitchRow label="How-to video" sub="A QR code to the video and the four steps: log in, find the case, accept it, mark it shipped." on={draft.showHowTo} onChange={() => set('showHowTo', !draft.showHowTo)} />
        <SwitchRow label="Need help?" sub="A QR code to book time with support, and the support email." on={draft.showHelp} onChange={() => set('showHelp', !draft.showHelp)} />
        <SwitchRow label="Duplicate check" sub="“Please check for duplicates” before the lab starts the work." on={draft.showDuplicateCheck} onChange={() => set('showDuplicateCheck', !draft.showDuplicateCheck)} />
      </Section>
    </div>
  );
}

// ─── The full-screen editor ──────────────────────────────────────────────────

function OrderFormEditor({ startAt, caseId, onCaseId, onClose }: { startAt: Group; caseId: string; onCaseId: (id: string) => void; onClose: () => void }) {
  const { toast } = useToast();
  const saved = useOrderFormSettings();
  const [draft, setDraft] = useState<OrderFormSettings>(saved);
  const [open, setOpen] = useState<Set<Group>>(() => new Set([startAt]));
  const toggleGroup = (g: Group) => setOpen(o => { const n = new Set(o); if (n.has(g)) n.delete(g); else n.add(g); return n; });
  // Narrow screens show one pane at a time.
  const [pane, setPane] = useState<'settings' | 'preview'>('settings');
  // Closing with unsaved changes asks first, in the top bar.
  const [leaving, setLeaving] = useState(false);
  const [printView, setPrintView] = useState(false);
  const model = usePreviewModel(caseId);
  // When the statement is switched on, bring it into view in the preview (it sits near the foot of the page).
  const previewScroll = useRef<HTMLDivElement>(null);
  const wasOn = useRef(draft.statementOn);
  useEffect(() => {
    if (draft.statementOn && !wasOn.current) {
      requestAnimationFrame(() => previewScroll.current?.querySelector('[data-of-part="statement"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
    wasOn.current = draft.statementOn;
  }, [draft.statementOn]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const errors = saveErrors(draft);
  const isDefault = JSON.stringify(draft) === JSON.stringify(DEFAULT_ORDER_FORM_SETTINGS);
  const close = () => { if (dirty) setLeaving(true); else onClose(); };

  useEffect(() => {
    document.getElementById(`of-${startAt}`)?.scrollIntoView({ block: 'start' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !printView) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function save() {
    if (errors.length) { toast.error(errors[0]); return; }
    const kept = saveOrderFormSettings(draft);
    if (kept) toast.success('Saved. Every order form now uses these settings.');
    else toast.info('Saved for this visit. The logo is too big to keep in this browser, so upload a smaller one to keep it.');
    onClose();
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex flex-col bg-[#F3F3F5]" role="dialog" aria-modal="true" aria-label="Edit order form">
        {/* Top bar: close, title, then the case to preview and the actions (or, leaving with changes, the question). */}
        <div className="flex items-center gap-3 px-4 sm:px-6 h-16 bg-white border-b border-[#E0E0E6] flex-shrink-0">
          <button type="button" onClick={close} aria-label="Close" className="w-9 h-9 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#030213] truncate">
              Order Form
              {dirty && <span className="ml-2 align-middle px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF8E1] text-[#B45309] border border-[#FFE082]">Unsaved</span>}
            </p>
            <p className="text-[11px] text-[#717182] truncate hidden sm:block">Settings › Order Form · the preview shows your changes before you save</p>
          </div>
          {leaving ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-[#5A5568] hidden sm:inline">Leave without saving?</span>
              <Button variant="outline" size="sm" onClick={() => setLeaving(false)}>Keep editing</Button>
              <Button variant="secondary" size="sm" onClick={onClose}>Discard changes</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isDefault && <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => setDraft(DEFAULT_ORDER_FORM_SETTINGS)}>Reset to default</Button>}
              {dirty && <Button variant="outline" size="sm" onClick={() => setDraft(saved)}>Discard</Button>}
              <Button size="sm" disabled={!dirty || errors.length > 0} onClick={save}>Save</Button>
            </div>
          )}
        </div>

        {/* Narrow: one pane at a time. */}
        <div className="lg:hidden flex gap-1 p-1 mx-4 mt-3 bg-white border border-[#E0E0E6] rounded-lg flex-shrink-0">
          {([['settings', 'Settings', SlidersHorizontal], ['preview', 'Preview', Eye]] as const).map(([p, l, Icon]) => (
            <button key={p} type="button" onClick={() => setPane(p)} aria-pressed={pane === p}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${pane === p ? 'bg-[#EEF4FF] text-[#1565C0]' : 'text-[#5A5568] hover:bg-[#F8F9FC]'}`}>
              <Icon className="w-3.5 h-3.5" /> {l}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* Settings column */}
          <aside className={`${pane === 'settings' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-[420px] flex-shrink-0 lg:border-r border-[#E0E0E6] bg-[#F8F9FC] min-h-0`}>
            <div className="flex-1 overflow-y-auto p-4">
              <SettingsForm draft={draft} setDraft={setDraft} open={open} onToggle={toggleGroup} />
            </div>
            {errors.length > 0 && (
              <div className="px-4 py-2.5 border-t border-[#FFE082] bg-[#FFF8E1] text-[11px] text-[#B45309] flex items-start gap-1.5 flex-shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0" />
                <span>{errors.join(' ')}</span>
              </div>
            )}
          </aside>

          {/* Preview */}
          <section className={`${pane === 'preview' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col min-w-0 min-h-0`}>
            <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 flex-shrink-0">
              <p className="text-xs font-semibold text-[#030213] mr-auto inline-flex items-center gap-1.5"><Eye className="w-4 h-4 text-[#4D8EF7]" /> Live preview · {PAPER[draft.paper].label}</p>
              <CasePicker value={caseId} onChange={onCaseId} className="!w-auto max-w-full !py-1.5 text-xs" />
              <Button variant="outline" size="sm" className="!text-xs" icon={<Printer className="w-3.5 h-3.5" />} onClick={() => setPrintView(true)} disabled={!model}>Print preview</Button>
            </div>
            <div ref={previewScroll} className="flex-1 overflow-y-auto px-4 sm:px-6 pb-8">
              <div className="mx-auto max-w-[860px]">
                <PreviewPage caseId={caseId} settings={draft} />
              </div>
            </div>
          </section>
        </div>
      </div>
      {printView && model && <OrderFormFullView model={model} settings={draft} onClose={() => setPrintView(false)} />}
    </ModalPortal>
  );
}

// ─── The Settings tab: a summary and the saved form ─────────────────────────

export default function OrderFormSettingsPanel() {
  const [params, setParams] = useSearchParams();
  const saved = useOrderFormSettings();
  const [caseId, setCaseId] = useState(PREVIEW_CASES[0].id);
  // The editor is deep-linkable: ?tab=order-form&group=branding|statement|sections opens it at that group.
  const groupParam = params.get('group') as Group | null;
  const editing: Group | null = groupParam && GROUPS.includes(groupParam) ? groupParam : null;
  const openEditor = (g: Group) => { const n = new URLSearchParams(params); n.set('group', g); setParams(n); };
  const closeEditor = () => { const n = new URLSearchParams(params); n.delete('group'); setParams(n); };

  return (
    <div className="bg-white rounded-xl border border-[#E0E0E6] overflow-hidden">
      {/* 12-Nov: before editing, only Edit and the saved form's preview; all settings live in the full-screen editor. */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 bg-[#F8F9FC] border-b border-[#F0EFF6]">
        <div className="min-w-0 mr-auto">
          <h3 className="text-sm font-semibold text-[#030213]">Order Form</h3>
          <p className="text-xs text-[#717182] mt-0.5">How your order form prints, shown on a crown.</p>
        </div>
        <Button size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openEditor('branding')}>Edit</Button>
      </div>
      <div className="p-4 sm:p-6 bg-[#F3F3F5]">
        <div className="mx-auto max-w-[760px]">
          <PreviewPage caseId={caseId} settings={saved} />
        </div>
      </div>

      {editing && <OrderFormEditor startAt={editing} caseId={caseId} onCaseId={setCaseId} onClose={closeEditor} />}
    </div>
  );
}
