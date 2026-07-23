import { useMemo, useState } from 'react';
import {
  Download, ZoomIn, ZoomOut, Search, Flag, Trash2,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  ArrowRight, Send, Maximize2, Plus, X,
} from 'lucide-react';
import ModalPortal from '../components/ModalPortal';
import { useToast } from '../context/ToastContext';
import type { Invoice } from './InvoicesPage';

// ─── Case-matching review — full-screen reconciliation of one invoice's line
//     items against cases. AI proposes a match + confidence per line; the user
//     reviews, re-matches, or removes lines before submitting. Mock/local only.
//     Rebuilt in the SmileGenius design system (no external markup).

type MatchType = 'auto' | 'suggested' | 'already-invoiced' | 'remake' | 'manual-review';

interface MatchRow {
  id: string;
  description: string;
  qty: number;
  amount: number;
  nonClinical?: boolean;
  caseId?: string;         // e.g. 'SG-20341' → shown as "Case #SG-20341"
  note: string;            // "Matched to …" / "Not found on matched case"
  badges: MatchType[];
  confidence?: number;     // 0–100; undefined when unmatched
}

const BADGE: Record<MatchType, { label: string; cls: string }> = {
  'auto':            { label: 'Auto Match',      cls: 'text-[#2E7D32] bg-[#E7F6EC] border-[#C6E9CE]' },
  'suggested':       { label: 'Suggested Match', cls: 'text-[#B45309] bg-[#FEF3C7] border-[#FDE68A]' },
  'already-invoiced':{ label: 'Already Invoiced',cls: 'text-[#C62828] bg-[#FFEBEE] border-[#F9DCDC]' },
  'remake':          { label: 'Remake',          cls: 'text-[#6D28D9] bg-[#EDE9FE] border-[#DDD6FE]' },
  'manual-review':   { label: 'Manual Review',   cls: 'text-[#C62828] bg-[#FFF1F2] border-[#FECDD3]' },
};

const symbolFor = (currency: string) =>
  currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : `${currency} `;

function money(n: number, currency: string) {
  return `${symbolFor(currency)}${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const NON_CLINICAL_RE = /\b(fee|rush|training|care\s*plan|shade\s*guide|try-?in|delivery|shipping|postage|admin)\b/i;

// Deterministic seed of match rows from the invoice's line items. No randomness
// (stable across renders); variety is driven purely by the line index so the
// screen shows the full spread of match states like the reference design.
function buildRows(invoice: Invoice): MatchRow[] {
  const items = invoice.lineItems ?? [];
  return items.map((li, i) => {
    // Group ~3 consecutive lines onto the same case, mirroring how one case
    // usually spans several invoice lines.
    const caseNo = 20341 + Math.floor(i / 3);
    const caseId = `SG-${caseNo}`;
    const nonClinical = NON_CLINICAL_RE.test(li.description);
    const profile = i % 3;
    if (profile === 0) {
      return {
        id: `row-${i}`, description: li.description, qty: li.qty, amount: li.total,
        nonClinical, caseId, note: `Matched to ${li.description}`,
        badges: ['auto'], confidence: 96,
      };
    }
    if (profile === 1) {
      return {
        id: `row-${i}`, description: li.description, qty: li.qty, amount: li.total,
        nonClinical, caseId, note: `Matched to ${li.description}`,
        badges: ['already-invoiced', 'suggested'], confidence: 82,
      };
    }
    return {
      id: `row-${i}`, description: li.description, qty: li.qty, amount: li.total,
      nonClinical, caseId, note: 'Not found on matched case',
      badges: ['remake', 'manual-review'], confidence: 61,
    };
  });
}

// The blocking issue on a line, if any — drives the "unresolved" confirm dialog.
function issueFor(r: MatchRow): { text: string; tone: 'red' | 'amber' } | null {
  if (!r.caseId) return { text: 'No case matched', tone: 'red' };
  if (r.badges.includes('already-invoiced')) return { text: 'Already invoiced elsewhere', tone: 'red' };
  if (r.badges.includes('remake') || r.badges.includes('manual-review')) return { text: 'Matched case is a remake', tone: 'amber' };
  return null;
}

function confTone(c: number) {
  if (c >= 90) return { dot: 'bg-[#16A34A]', text: 'text-[#15803D]' };
  if (c >= 70) return { dot: 'bg-[#F59E0B]', text: 'text-[#B45309]' };
  return { dot: 'bg-[#DC2626]', text: 'text-[#B91C1C]' };
}

function Badge({ type }: { type: MatchType }) {
  const b = BADGE[type];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${b.cls}`}>
      {b.label}
    </span>
  );
}

// ── One match row (right column) ──
function MatchRowCard({
  row, currency, onOpenCase, onRemove, onRematch,
}: {
  row: MatchRow;
  currency: string;
  onOpenCase: (caseId: string) => void;
  onRemove: () => void;
  onRematch: (caseId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const matched = !!row.caseId;
  const conf = row.confidence !== undefined ? confTone(row.confidence) : null;

  // Left accent colour from the primary badge / state.
  const accent = !matched
    ? 'border-l-[#E0E0E6]'
    : row.badges[0] === 'auto' ? 'border-l-[#7BC98D]'
    : row.badges[0] === 'already-invoiced' ? 'border-l-[#F0B4B4]'
    : row.badges[0] === 'remake' ? 'border-l-[#C4B5FD]'
    : 'border-l-[#F5C24B]';

  const CASE_OPTIONS = useMemo(
    () => Array.from({ length: 24 }, (_, i) => `SG-${20341 + i}`),
    [],
  );
  const filtered = CASE_OPTIONS.filter(c => c.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`rounded-xl border border-[#E9E9EF] border-l-[3px] ${accent} bg-white hover:shadow-[0_2px_10px_rgba(20,20,40,0.05)] transition-shadow`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Description + status note */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-[#030213] truncate">{row.description}</span>
            <Flag className="w-3 h-3 text-[#C0C0CC] flex-shrink-0" />
            {row.nonClinical && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold text-[#B45309] bg-[#FEF3C7] border border-[#FDE68A]">
                Non-Clinical
              </span>
            )}
          </div>
          <p className={`text-[11px] mt-0.5 ${matched ? 'text-[#8A8A99]' : 'text-[#C0392B]'}`}>{row.note}</p>
        </div>

        {/* Qty */}
        <div className="hidden sm:block text-right w-12 flex-shrink-0">
          <p className="text-[9px] font-bold text-[#B0B0BC] uppercase tracking-wider">Qty</p>
          <p className="text-[13px] text-[#030213]">{row.qty}</p>
        </div>

        {/* Amount */}
        <div className="text-right w-24 flex-shrink-0">
          <p className="text-[9px] font-bold text-[#B0B0BC] uppercase tracking-wider">Amount</p>
          <p className="text-[13px] font-semibold text-[#030213]">{money(row.amount, currency)}</p>
        </div>

        <ArrowRight className="w-4 h-4 text-[#C0C0CC] flex-shrink-0" />

        {/* Case ref + match state */}
        <div className="w-[300px] flex-shrink-0 relative">
          {matched ? (
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => onOpenCase(row.caseId!)}
                title={`Open Case #${row.caseId}`}
                className="text-[12px] font-semibold text-[#1565C0] hover:underline flex-shrink-0"
              >
                Case #{row.caseId}
              </button>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {row.badges.map(b => <Badge key={b} type={b} />)}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-[#A0A0B0]">No Case Matched</span>
              <button
                onClick={() => setPickerOpen(o => !o)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7] border border-[#BFDBFE] bg-white hover:bg-[#EEF4FF] px-2.5 py-1 rounded-full transition-colors"
              >
                <Search className="w-3 h-3" /> Match Case
              </button>
            </div>
          )}

          {pickerOpen && (
            <div className="absolute top-full right-0 mt-1 z-50 w-52 bg-white rounded-xl shadow-[0_10px_30px_rgba(20,20,40,0.15)] border border-[#E8EAF6] overflow-hidden">
              <div className="px-2 py-1.5 border-b border-[#F0EFF6] bg-[#F8F9FC]">
                <input
                  autoFocus value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search case…"
                  className="w-full text-[11px] px-2 py-1 border border-[#E0E0E6] rounded-md outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
                />
              </div>
              <div className="max-h-44 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <p className="px-3 py-3 text-[11px] text-[#A0A0B0] text-center italic">No matches</p>
                ) : filtered.slice(0, 30).map(c => (
                  <button
                    key={c}
                    onClick={() => { onRematch(c); setPickerOpen(false); setSearch(''); }}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-[#030213] hover:bg-[#EEF4FF] transition-colors"
                  >
                    Case #{c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confidence */}
        <div className="w-14 flex-shrink-0 flex items-center justify-end gap-1.5">
          {conf ? (
            <>
              <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
              <span className={`text-[12px] font-semibold ${conf.text}`}>{row.confidence}%</span>
            </>
          ) : (
            <span className="text-[11px] text-[#C0C0CC]">—</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={onRemove} title="Remove line" className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-[#A0A0B0] hover:text-[#C62828] hover:bg-[#FFEBEE] transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse' : 'Expand'} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-[#A0A0B0] hover:text-[#5A5568] hover:bg-[#F3F3F5] transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded detail — invoice line ↔ matched case comparison */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-[#F3F3F5]">
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="rounded-lg border border-[#EDEDF2] bg-[#FAFBFC] p-3">
              <p className="text-[9px] font-bold text-[#B0B0BC] uppercase tracking-wider mb-1.5">Invoice line</p>
              <p className="text-[12px] font-medium text-[#030213]">{row.description}</p>
              <p className="text-[11px] text-[#717182] mt-1">Qty {row.qty} · {money(row.amount, currency)}</p>
            </div>
            <div className="rounded-lg border border-[#EDEDF2] bg-[#FAFBFC] p-3">
              <p className="text-[9px] font-bold text-[#B0B0BC] uppercase tracking-wider mb-1.5">Matched case</p>
              {matched ? (
                <>
                  <p className="text-[12px] font-medium text-[#1565C0]">Case #{row.caseId}</p>
                  <p className="text-[11px] text-[#717182] mt-1">{row.note}</p>
                </>
              ) : (
                <p className="text-[12px] text-[#A0A0B0] italic">Not matched yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvoiceReviewOverlay({
  invoice, onClose, onOpenCase,
}: {
  invoice: Invoice;
  onClose: () => void;
  onOpenCase?: (caseId: string) => void;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<MatchRow[]>(() => buildRows(invoice));
  const [zoom, setZoom] = useState(100);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const total = rows.length;
  const matched = rows.filter(r => r.caseId).length;
  const aiMatched = rows.filter(r => r.confidence !== undefined && r.confidence >= 70).length;

  // A line is "unresolved" if it isn't a clean match — no case, already invoiced
  // elsewhere, or matched to a remake / flagged for manual review. These block a
  // clean submit and are surfaced in the confirmation dialog.
  const unresolved = rows
    .map(r => ({ r, issue: issueFor(r) }))
    .filter((x): x is { r: MatchRow; issue: { text: string; tone: 'red' | 'amber' } } => x.issue !== null);
  const needsReview = unresolved.length > 0;

  // The document panel mirrors the invoice's own figures (net = gross − VAT),
  // independent of any row edits in the matching list.
  const cur = invoice.currency;
  const vat = invoice.vatAmount || 0;
  const totalDue = invoice.amount;
  const subtotal = +(invoice.amount - vat).toFixed(2);

  function rematch(id: string, caseId: string) {
    setRows(prev => prev.map(r => r.id === id
      ? { ...r, caseId, note: `Matched to ${r.description}`, badges: ['suggested'], confidence: 78 }
      : r));
    toast.success(`Matched to Case #${caseId}`);
  }
  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
  }
  function addCase() {
    setRows(prev => [...prev, {
      id: `row-new-${prev.length}`, description: 'New line item', qty: 1, amount: 0,
      note: 'Add a description, then match a case', badges: [],
    }]);
    toast.info('Added a blank line to match');
  }
  function openCase(caseId: string) {
    if (onOpenCase) onOpenCase(caseId);
    else toast.info(`Opening Case #${caseId}`);
  }
  function submit() {
    toast.success('Invoice submitted for billing');
    onClose();
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[110] bg-[#F5F6F8] flex flex-col">
        {/* ── Header ── */}
        <div className="flex-shrink-0 bg-white border-b border-[#E8E8EE] px-6 pt-3 pb-4">
          <div className="flex items-center gap-1.5 text-[12px] text-[#9A9AA8] mb-2">
            <button onClick={onClose} className="hover:text-[#4D8EF7] transition-colors">Billing</button>
            <span>/</span>
            <button onClick={onClose} className="hover:text-[#4D8EF7] transition-colors">Draft Billing</button>
            <span>/</span>
            <span className="text-[#5A5568] font-medium">Invoice Review</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-[#030213] font-mono tracking-tight">Invoice {invoice.number}</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toast.info('Preparing invoice download…')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-semibold text-[#5A5568] bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
              >
                <Download className="w-4 h-4" /> Download Invoice
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[#9A9AA8] hover:bg-[#F3F3F5] hover:text-[#5A5568] transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 flex gap-5 p-5 overflow-hidden">
          {/* Left — Original Document */}
          <div className="w-[340px] flex-shrink-0 bg-white rounded-2xl border border-[#E8E8EE] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EFF6] flex-shrink-0">
              <h2 className="text-[15px] font-bold text-[#030213]">Original Document</h2>
              <div className="flex items-center gap-1">
                <button onClick={() => setZoom(z => Math.max(60, z - 10))} className="w-6 h-6 inline-flex items-center justify-center rounded-md text-[#8A8A99] hover:bg-[#F3F3F5] transition-colors"><ZoomOut className="w-3.5 h-3.5" /></button>
                <span className="text-[11px] text-[#8A8A99] w-9 text-center tabular-nums">{zoom}%</span>
                <button onClick={() => setZoom(z => Math.min(160, z + 10))} className="w-6 h-6 inline-flex items-center justify-center rounded-md text-[#8A8A99] hover:bg-[#F3F3F5] transition-colors"><ZoomIn className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto bg-[#F1F2F5] p-4">
              <div
                className="mx-auto bg-white rounded-lg shadow-[0_4px_20px_rgba(20,20,40,0.10)] border border-[#ECECF1] p-5 origin-top"
                style={{ width: 280, transform: `scale(${zoom / 100})` }}
              >
                {/* Doc header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#030213] leading-tight">{invoice.supplier || 'Supplier'}</p>
                    <p className="text-[9px] text-[#9A9AA8] mt-0.5 leading-snug">Supplier of record</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] font-bold text-[#9A9AA8] tracking-widest">INVOICE</p>
                    <p className="text-[9px] text-[#5A5568] mt-0.5">{invoice.number}</p>
                  </div>
                </div>

                <div className="h-px bg-[#F0EFF6] my-3" />

                <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[9px]">
                  <p className="text-[#9A9AA8]">Date: <span className="text-[#5A5568]">{invoice.date}</span></p>
                  <p className="text-[#9A9AA8] text-right">Currency: <span className="text-[#5A5568]">{cur}</span></p>
                  <p className="text-[#9A9AA8] col-span-2">Bill to (Practice): <span className="text-[#5A5568]">{invoice.billedToName || 'Not specified'}</span></p>
                  <p className="text-[#9A9AA8] col-span-2">Entity: <span className="text-[#5A5568]">{invoice.entity || '—'}</span></p>
                </div>

                <div className="h-px bg-[#F0EFF6] my-3" />

                {/* Line table */}
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[9px] font-bold text-[#B0B0BC] uppercase tracking-wider pb-1 border-b border-[#F0EFF6]">
                  <span>Description</span><span className="text-right">Qty</span><span className="text-right">Amount</span>
                </div>
                <div className="divide-y divide-[#F6F6F9]">
                  {(invoice.lineItems ?? []).map((li, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-x-3 py-1 text-[9px]">
                      <span className="text-[#030213] truncate">{li.description}</span>
                      <span className="text-right text-[#5A5568]">{li.qty}</span>
                      <span className="text-right text-[#030213]">{money(li.total, cur)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 space-y-1 text-[9px]">
                  <div className="flex justify-between"><span className="text-[#9A9AA8]">Subtotal</span><span className="text-[#5A5568]">{money(subtotal, cur)}</span></div>
                  <div className="flex justify-between"><span className="text-[#9A9AA8]">VAT</span><span className="text-[#5A5568]">{money(vat, cur)}</span></div>
                  <div className="flex justify-between"><span className="text-[#9A9AA8]">Discount</span><span className="text-[#5A5568]">{money(0, cur)}</span></div>
                  <div className="flex justify-between pt-1 border-t border-[#F0EFF6] font-bold"><span className="text-[#030213]">Total</span><span className="text-[#030213]">{money(totalDue, cur)}</span></div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#F0EFF6] flex-shrink-0">
              <div className="flex items-center gap-1 text-[11px] text-[#8A8A99]">
                <button className="w-6 h-6 inline-flex items-center justify-center rounded-md hover:bg-[#F3F3F5] transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
                <span>Page 1 of 1</span>
                <button className="w-6 h-6 inline-flex items-center justify-center rounded-md hover:bg-[#F3F3F5] transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
              <button
                onClick={() => toast.info('Full-size document preview')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" /> Open Full Size
              </button>
            </div>
          </div>

          {/* Right — Case Matching */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-[#E8E8EE] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0EFF6] flex-shrink-0">
              <div className="min-w-0">
                <h2 className="text-[16px] font-bold text-[#030213]">Case Matching</h2>
                <p className="text-[12px] text-[#8A8A99] mt-0.5">
                  AI matched {aiMatched} of {total} invoice line items to cases · showing {total} for review
                </p>
              </div>
              <button
                onClick={addCase}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold text-[#5A5568] bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors flex-shrink-0"
              >
                <Search className="w-4 h-4" /> Add Case
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 bg-[#FAFAFC]">
              {rows.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                  <p className="text-[13px] font-semibold text-[#5A5568]">No line items to match</p>
                  <p className="text-[12px] text-[#9A9AA8] mt-1">Use “Add Case” to start matching manually.</p>
                </div>
              ) : rows.map(row => (
                <MatchRowCard
                  key={row.id}
                  row={row}
                  currency={cur}
                  onOpenCase={openCase}
                  onRemove={() => removeRow(row.id)}
                  onRematch={(caseId) => rematch(row.id, caseId)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 bg-white border-t border-[#E8E8EE] px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-40 h-1.5 rounded-full bg-[#EBEBF0] overflow-hidden flex-shrink-0">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] transition-all"
                style={{ width: `${total ? (matched / total) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[13px] font-semibold text-[#030213] flex-shrink-0">{matched} of {total} Line Matched</span>
            {needsReview && <span className="text-[12px] text-[#E65100] truncate">Some cases still need review</span>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-[#5A5568] hover:bg-[#F3F3F5] transition-colors">Cancel</button>
            <button
              onClick={() => (unresolved.length > 0 ? setConfirmOpen(true) : submit())}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 shadow-[0_4px_14px_rgba(77,142,247,0.35)] transition-opacity"
            >
              <Send className="w-4 h-4" /> Submit Anyway
            </button>
          </div>
        </div>

        {/* ── Unresolved-lines confirmation ── */}
        {confirmOpen && (
          <div className="absolute inset-0 z-[10] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setConfirmOpen(false)} />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0EFF6]">
                <h3 className="text-[17px] font-bold text-[#030213]">Submit with unresolved line items?</h3>
                <button onClick={() => setConfirmOpen(false)} className="w-8 h-8 rounded-lg hover:bg-[#F3F3F5] flex items-center justify-center text-[#9A9AA8] flex-shrink-0 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4">
                <p className="text-[13px] text-[#717182] mb-3 leading-relaxed">
                  {unresolved.length} line {unresolved.length === 1 ? 'item' : 'items'} on this invoice still {unresolved.length === 1 ? 'has' : 'have'} issues. Submitting now sends them for DSO approval as-is.
                </p>
                <div className="rounded-xl border border-[#EDEDF2] divide-y divide-[#F3F3F5] max-h-64 overflow-y-auto">
                  {unresolved.map(({ r, issue }) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <span className="text-[13px] text-[#030213] truncate">{r.description}</span>
                      <span className={`text-[12px] font-semibold flex-shrink-0 ${issue.tone === 'red' ? 'text-[#C62828]' : 'text-[#E65100]'}`}>{issue.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#F0EFF6]">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
                >
                  Review Line Items
                </button>
                <button
                  onClick={() => { setConfirmOpen(false); submit(); }}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-[#DC2626] hover:bg-[#C81E1E] transition-colors"
                >
                  Submit Anyway
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalPortal>
  );
}
