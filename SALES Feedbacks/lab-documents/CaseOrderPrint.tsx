import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Tag } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { casesFor } from '../bulk-actions/BulkDialogs';
import { printPages } from '../bulk-actions/printForms';
import { getDocs, useDocs } from './docsStore';
import { casePrintPages } from './casePages';
import { CaseLabel, labelPageCss, paperPageCss } from './DocumentPrint';
import { docFileName } from './engine';

// ── Printing from the case page, with no extra clicks ────────────────────────
// The case page's order form panel already has a Print button (CaseDetailPage's
// OrderFormTools). Inside Growth Team Feedback that same button prints the
// order form as set up in Settings › Order form (lab logo, emphasis, the
// conformity statement and signature). When the case label is switched on, a
// "Print case label" button sits in the bottom-right corner of the order form.

interface Panel { panel: HTMLElement; bar: HTMLElement; formTab: HTMLElement }

function findPanel(): Panel | null {
  const docsTab = [...document.querySelectorAll<HTMLElement>('main button')].find(b => b.textContent?.trim() === 'Lab Documents');
  const bar = docsTab?.parentElement;
  const panel = bar?.parentElement;
  const formTab = [...(bar?.querySelectorAll<HTMLElement>('button') ?? [])].find(b => b.textContent?.trim() === 'Order form');
  return bar && panel && formTab ? { panel, bar, formTab } : null;
}

export function printCaseOrderForm(caseId: string): boolean {
  const c = casesFor([caseId])[0];
  if (!c) return false;
  const s = getDocs();
  return printPages(casePrintPages(c), docFileName(c, 'order-form'), paperPageCss(s));
}

export default function CaseOrderPrint({ caseId }: { caseId: string }) {
  const { toast } = useToast();
  const s = useDocs();
  const [found, setFound] = useState<Panel | null>(null);
  const [formShowing, setFormShowing] = useState(true);

  // Find the panel (it re-renders when the user moves between services).
  useEffect(() => {
    const sync = () => {
      const n = findPanel();
      setFound(prev => (prev && n && prev.panel === n.panel && prev.formTab === n.formTab ? prev : n));
      // The order form is showing when its native tab is active and no sandbox tab (LabLink form, Billing…) is open.
      if (n) setFormShowing(n.formTab.className.includes('border-[#4D8EF7]') && !n.panel.hasAttribute('data-sf-ptab'));
    };
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-sf-ptab'] });
    sync();
    return () => mo.disconnect();
  }, []);

  // The panel's own Print button prints the proper form (with the statement), straight away.
  useEffect(() => {
    if (!found) return;
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn || btn.textContent?.trim() !== 'Print' || !found.bar.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!printCaseOrderForm(caseId)) toast.error('Allow pop-ups to print');
    };
    found.bar.addEventListener('click', onClick, true);
    return () => found.bar.removeEventListener('click', onClick, true);
  }, [found, caseId, toast]);

  if (!found || !formShowing || !s.labelOn) return null;
  const c = casesFor([caseId])[0];
  if (!c) return null;
  return createPortal(
    <div className="sf-case-print flex justify-end gap-2 px-4 py-2 border-t border-[#F0EFF6]">
      <button
        onClick={() => { if (!printPages([{ key: 'label', node: <CaseLabel c={c} s={s} /> }], docFileName(c, 'case-label'), labelPageCss(s), 'sf-label-page')) toast.error('Allow pop-ups to print'); }}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#4D8EF7] hover:bg-[#EEF4FF]"
      >
        <Tag className="w-3 h-3" /> Print case label
      </button>
      <button
        onClick={() => { if (!printCaseOrderForm(caseId)) toast.error('Allow pop-ups to print'); }}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#4D8EF7] hover:bg-[#EEF4FF]"
      >
        <Printer className="w-3 h-3" /> Print order form
      </button>
    </div>,
    found.panel,
  );
}
