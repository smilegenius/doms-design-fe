import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ExternalLink, Globe, ShieldAlert } from 'lucide-react';
import SideDrawer from '../../src/app/components/SideDrawer';
import { getCreatedCases } from '../../src/app/data/createdCases';
import { portalDateTime } from '../lab-prescription-inbox/data';
import IntakeOrderForm from './IntakeOrderForm';
import { IntakeSubmission, useIntake } from './intakeStore';

// ── Source of a website draft, on the (unchanged) QuickCreate screen ─────────
// QuickCreate only knows email drafts, so it would show a "Source email" pane
// with its built-in prescription mock. For website drafts the sandbox puts the
// real source in that pane at runtime: the order form the dentist submitted,
// the files, and the checks the lab must do. The header's "Email draft" pill
// reads "Website draft". If the pane can't be found (QuickCreate's markup
// changed), a floating card with the same content appears instead.
// Relies on QuickCreate markup: the pane title "Source email" and the pill
// "Email draft" (or "Email · <scanner>"), and the "Email" preview tab, which
// reads "Website form". sandbox.css hides the native pane content.

/** Older requests were saved before the order details were: fill them from the draft case. */
export function withOrder(sub: IntakeSubmission): IntakeSubmission {
  if (sub.order) return sub;
  const si = getCreatedCases().find(c => c.id === sub.caseId)?.serviceItems[0];
  return {
    ...sub,
    order: {
      patientDob: '', patientRef: '', teeth: si?.fdi ?? [], material: si?.material, shade: si?.shade, orderType: si?.orderType,
      instructions: si?.instructions?.split('\n').filter(l => !/^(Clinic patient ref|Patient DOB):/.test(l)).join('\n'), extras: {},
    },
  };
}

export function SenderChecks({ sub }: { sub: IntakeSubmission }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-[#B45309] bg-[#FFF8E1] border border-[#FDE68A] rounded-xl px-3 py-2.5 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span>
          <span className="font-semibold">Check before you confirm.</span> Anyone can fill in a website form, so "{sub.dentist}" and GDC {sub.gdc || '(none given)'} are as typed. Look them up on the GDC register{sub.knownPractice ? '' : ', link or add the practice'}, and call the practice if anything looks off.
          <a href="https://olr.gdc-uk.org/searchregister" target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 font-semibold text-[#1565C0] hover:underline">Search the GDC register <ExternalLink className="w-3 h-3" /></a>
        </span>
      </div>
      {!sub.knownPractice && (
        <p className="text-[11px] text-[#B45309] bg-[#FFF8E1] border border-[#FDE68A] rounded-xl px-3 py-2">New practice: "{sub.practice}"{sub.postcode ? `, ${sub.postcode}` : ''} isn't linked to your account. Pick or add it under Clinic before you create the case.</p>
      )}
    </div>
  );
}

function SourcePane({ sub }: { sub: IntakeSubmission }) {
  const { config } = useIntake();
  return (
    <div className="sf-intake-pane flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-[#F0EFF6] bg-[#F8F9FC] flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center"><Globe className="w-3.5 h-3.5 text-[#1565C0]" /></span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#030213] uppercase tracking-wider leading-tight">Source: website intake form</p>
          <p className="text-[10px] text-[#717182] leading-tight truncate">Submitted on {config.labName}'s website · {portalDateTime(sub.at)}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <SenderChecks sub={sub} />
        <IntakeOrderForm sub={withOrder(sub)} config={config} />
        <p className="text-[10px] text-[#A0A0B0] text-center px-2">The form on the right is filled in from this request. Review and edit any field, then create the case.</p>
      </div>
    </div>
  );
}

const leaf = (text: string) =>
  [...document.querySelectorAll<HTMLElement>('p, span')].find(e => e.children.length === 0 && e.textContent?.trim() === text);

/** QuickCreate's source pane root (the one titled "Source email"). */
function findPane(): HTMLElement | null {
  return leaf('Source email')?.closest<HTMLElement>('div.flex-1.min-h-0.flex.flex-col') ?? null;
}
/** The header pill that reads "Email draft". */
function findPill(): HTMLElement | null {
  // "Email draft", or "Email · 3Shape" when the draft has scans.
  const t = [...document.querySelectorAll<HTMLElement>('span, div')].find(e => /^Email( draft| · .+)$/.test(e.textContent?.trim() ?? '') && e.children.length <= 2 && e.querySelector('svg'));
  return t ?? null;
}
/** The left pane's "Email" preview tab. */
function findTab(): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>('aside button')].find(b => b.textContent?.trim() === 'Email' && b.querySelector('svg')) ?? null;
}

function Fallback({ sub }: { sub: IntakeSubmission }) {
  const { config } = useIntake();
  const [open, setOpen] = useState(false);
  const n = sub.files.length;
  return (
    <>
      <div className="fixed left-4 bottom-20 z-[60] rounded-xl border border-[#DBEAFE] bg-[#EEF4FF] shadow-lg pl-2.5 pr-3 py-2">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0"><Globe className="w-4 h-4 text-[#4D8EF7]" /></span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[#1565C0]">From your website · {sub.ref}</p>
            <p className="text-[10px] text-[#3B6BAE]">{sub.dentist} (unverified) · {n ? `${n} file${n === 1 ? '' : 's'}` : 'no files'}{sub.knownPractice ? '' : ' · new practice'}</p>
          </div>
          <button onClick={() => setOpen(true)} className="ml-1 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity">
            View <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
      <SideDrawer open={open} onClose={() => setOpen(false)} title={`Website request ${sub.ref}`} subtitle={`Received ${portalDateTime(sub.at)}`} icon={<Globe className="w-4 h-4 text-[#4D8EF7]" />}>
        <div className="space-y-4"><SenderChecks sub={sub} /><IntakeOrderForm sub={withOrder(sub)} config={config} /></div>
      </SideDrawer>
    </>
  );
}

export default function IntakeFilesDock({ caseId }: { caseId: string }) {
  const { submissions } = useIntake();
  const sub = submissions.find(s => s.caseId === caseId);
  const [pane, setPane] = useState<HTMLElement | null>(null);
  const [pill, setPill] = useState<HTMLElement | null>(null);
  const [tab, setTab] = useState<HTMLElement | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (!sub) return;
    const sync = () => {
      setPane(p => { const n = findPane(); return p === n ? p : n; });
      setPill(p => { const n = findPill(); return p === n ? p : n; });
      setTab(p => { const n = findTab(); return p === n ? p : n; });
    };
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    sync();
    const t = window.setTimeout(() => setGaveUp(true), 2500);
    return () => { mo.disconnect(); window.clearTimeout(t); };
  }, [sub?.caseId]);

  useEffect(() => {
    if (!pane) return;
    pane.setAttribute('data-sf-intake-pane', 'on');
    return () => pane.removeAttribute('data-sf-intake-pane');
  }, [pane]);

  useEffect(() => {
    if (!pill) return;
    pill.setAttribute('data-sf-intake-pill', 'on');
    return () => pill.removeAttribute('data-sf-intake-pill');
  }, [pill]);

  useEffect(() => {
    if (!tab) return;
    tab.setAttribute('data-sf-intake-tab', 'on');
    return () => tab.removeAttribute('data-sf-intake-tab');
  }, [tab]);

  if (!sub) return null;
  return (
    <>
      {pane && createPortal(<SourcePane sub={sub} />, pane)}
      {pill && pill.parentElement && createPortal(
        <span className="sf-intake-pill inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF4FF] text-[#1565C0] border border-[#DBEAFE]"><Globe className="w-3 h-3" /> Website draft</span>,
        pill.parentElement,
      )}
      {!pane && gaveUp && <Fallback sub={sub} />}
    </>
  );
}
