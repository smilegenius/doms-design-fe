import { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Download, ExternalLink, Printer, Settings2, Tag } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { casesFor } from './BulkDialogs';
import { printPages, SgOrderFormPrint } from './printForms';
import { saveBlob } from './zip';
import { useDocs, type PaperSize } from '../lab-documents/docsStore';
import { CaseLabel, labelPageCss, paperPageCss, statementOnForm } from '../lab-documents/DocumentPrint';
import { casePrintPages } from '../lab-documents/casePages';
import { caseBlockers, docFileName } from '../lab-documents/engine';
import CasePicker from '../lab-documents/CasePicker';

// ── Print preview for any case: /growth/order-form/:caseId ───────────────────
// What you see is what prints: the order form with whatever Settings ›
// Order form switches on, or the case label (?view=label, when labels are on). Pick any other case
// from the search box. Per print only (settings untouched): paper size, and
// leaving the statement off this once.

const sheet = (paper: PaperSize) => (paper === 'Letter' ? 816 : 794);

export default function OrderFormPreview({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const s = useDocs();
  const c = casesFor([caseId])[0];
  const view = params.get('view') === 'label' && s.labelOn ? 'label' : 'form';
  const [paper, setPaper] = useState<PaperSize>(s.paper);
  const [withStatement, setWithStatement] = useState(true);
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E0E0E6] bg-white text-[#030213] hover:bg-[#F8F9FC]';
  const primary = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#7C6BFF]';
  const goCase = (id: string) => navigate(`/growth/order-form/${encodeURIComponent(id)}${view === 'label' ? '?view=label' : ''}`);

  if (!c) return <div className="p-8 text-sm text-[#717182] space-y-3"><p>Case {caseId} not found.</p><CasePicker value="" onChange={goCase} /></div>;
  const docs = { ...s, paper };
  const blockers = s.statementOn ? caseBlockers(c, s) : [];
  const setView = (v: string) => { const n = new URLSearchParams(params); if (v === 'form') n.delete('view'); else n.set('view', v); setParams(n, { replace: true }); };

  function print() {
    const ok = view === 'label'
      ? printPages([{ key: 'label', node: <CaseLabel c={c} s={s} /> }], docFileName(c, 'case-label'), labelPageCss(s), 'sf-label-page')
      : printPages(casePrintPages(c, { withStatement }, docs), docFileName(c, 'order-form'), paperPageCss(docs));
    if (!ok) toast.error('Allow pop-ups to print');
  }
  function download() {
    const node = view === 'label' ? <CaseLabel c={c} s={s} /> : <SgOrderFormPrint c={c} docs={docs} statement={withStatement} />;
    const type = view === 'label' ? 'case-label' : 'order-form';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${docFileName(c, type)}</title><style>body{font-family:system-ui,sans-serif;background:#fff;margin:0;padding:24px;max-width:760px}${view === 'label' ? labelPageCss(s) : paperPageCss(docs)}</style></head><body>${renderToStaticMarkup(node)}</body></html>`;
    saveBlob(new Blob([html], { type: 'text/html' }), `${docFileName(c, type)}.html`);
    toast.success('Downloaded. Open it and print to PDF for a PDF copy.');
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-xs text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
          <h1 className="text-xl font-semibold text-[#030213] mt-1">Print preview · {c.id}</h1>
          <p className="text-xs text-[#717182]">
            {c.patientName} · {c.practice}. What you see is what prints.{' '}
            {s.brandingOn && s.logo ? 'Lab logo on.' : 'Smile Genius mark (no lab logo).'} {s.emphasis ? 'Field emphasis on.' : 'Field emphasis off.'}{' '}
            {s.statementOn ? `Statement on (${s.jurisdiction}).` : 'Statement off.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={() => navigate('/growth/settings?tab=order-form')}><Settings2 className="w-3.5 h-3.5" /> Settings › Order form</button>
          <button className={btn} onClick={() => navigate(`/growth/cases/${encodeURIComponent(c.id)}`)}><ExternalLink className="w-3.5 h-3.5" /> Open the case</button>
          <button className={btn} onClick={download}><Download className="w-3.5 h-3.5" /> Download</button>
          <button className={primary} onClick={print}><Printer className="w-3.5 h-3.5" /> {view === 'label' ? 'Print label' : 'Print'}</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([['form', 'Order form', Printer], ...(s.labelOn ? [['label', 'Case label', Tag]] as const : [])] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setView(id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${view === id ? 'bg-[#EEF4FF] border-[#4D8EF7] text-[#1565C0]' : 'bg-white border-[#E0E0E6] text-[#5A5568] hover:bg-[#F8F9FC]'}`}><Icon className="w-3.5 h-3.5" /> {label}</button>
        ))}
        <CasePicker value={c.id} onChange={goCase} />
        <span className="flex-1" />
        {view === 'form' && (
          <label className="inline-flex items-center gap-1.5 text-xs text-[#5A5568]">Paper
            <select value={paper} onChange={e => setPaper(e.target.value as PaperSize)} className="border border-[#E0E0E6] rounded-md px-1.5 py-1 text-xs bg-white"><option value="A4">A4</option><option value="Letter">US Letter</option></select>
          </label>
        )}
        {view === 'form' && statementOnForm(c, s) && (
          <label className="inline-flex items-center gap-1.5 text-xs text-[#5A5568]"><input type="checkbox" checked={withStatement} onChange={e => setWithStatement(e.target.checked)} /> Include the statement this time</label>
        )}
      </div>

      {blockers.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E]">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span><b>No statement for this case.</b> {blockers.join(' ')} The order form still prints.</span>
        </div>
      )}

      <div className="bg-[#EEF0F4] rounded-xl p-4 sm:p-8 overflow-x-auto">
        {view === 'label' ? (
          <div className="flex flex-col items-center gap-2">
            <CaseLabel c={c} s={s} />
            <p className="text-[11px] text-[#717182]">{s.labelStock === '62x100' ? '62 × 100 mm' : '102 × 152 mm'} thermal label · change the stock in Settings › Order form › Case label</p>
          </div>
        ) : (
          <div className="mx-auto bg-white shadow-md rounded-sm p-8 sm:p-10 w-full" style={{ maxWidth: sheet(paper), minHeight: 1000 }}><SgOrderFormPrint c={c} docs={docs} statement={withStatement} /></div>
        )}
      </div>
    </div>
  );
}
