import { useState } from 'react';
import {
  ArrowLeft, ChevronRight, Calendar, CheckCircle2, AlertTriangle,
  ShieldCheck, FileText, ArrowUpRight, Receipt, Clock,
} from 'lucide-react';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import {
  VAT_PERIODS, VatPeriod, VatPeriodStatus,
  computeReturn, vatFlagsForInvoices,
} from '../data/vatData';

// ─── Helpers (per-page convention — not shared) ─────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Section card wrapper (mirrors SpendAnalyticsPage) ──────────────────────────
function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0EFF6] flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#030213]">{title}</p>
          {subtitle && <p className="text-xs text-[#717182] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0 mt-0.5">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Status pill (StatusBadge is hardcoded to other states — local one here) ────
function StatusPill({ status }: { status: VatPeriodStatus }) {
  const config: Record<VatPeriodStatus, { bg: string; text: string; icon: typeof Clock; label: string }> = {
    open:      { bg: 'bg-[#F3F3F5]', text: 'text-[#5A5568]', icon: Clock,        label: 'Open' },
    ready:     { bg: 'bg-[#FFF3E0]', text: 'text-[#E65100]', icon: AlertTriangle, label: 'Ready to submit' },
    submitted: { bg: 'bg-[#E8F5E9]', text: 'text-[#2E7D32]', icon: CheckCircle2,  label: 'Submitted' },
  };
  const { bg, text, icon: Icon, label } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

// Net-VAT label: positive box5 = pay HMRC, negative = reclaim.
function netVatLabel(box5: number): { text: string; tone: string } {
  if (box5 > 0) return { text: `Pay ${fmt(box5)}`, tone: 'text-[#030213]' };
  if (box5 < 0) return { text: `Reclaim ${fmt(Math.abs(box5))}`, tone: 'text-[#2E7D32]' };
  return { text: fmt(0), tone: 'text-[#717182]' };
}

interface Props {
  onNavigateToInvoices?: (filter?: string, supplier?: string) => void;
}

export default function VatHubPage({ onNavigateToInvoices }: Props = {}) {
  const { toast } = useToast();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  // Session overrides — a simulated submit flips a period to 'submitted'.
  const [submitted, setSubmitted] = useState<Record<string, { receiptRef: string; date: string }>>({});

  // Merge session submissions over the base data.
  function effectivePeriod(p: VatPeriod): VatPeriod {
    const s = submitted[p.id];
    if (!s) return p;
    return { ...p, status: 'submitted', receiptRef: p.receiptRef ?? s.receiptRef, submittedDate: p.submittedDate ?? s.date };
  }

  const periods = VAT_PERIODS.map(effectivePeriod);
  const selected = selectedPeriodId ? periods.find(p => p.id === selectedPeriodId) ?? null : null;

  function confirmSubmit() {
    if (!selected) return;
    const ref = `HMRC-${selected.id.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const date = new Date().toISOString().slice(0, 10);
    setSubmitted(prev => ({ ...prev, [selected.id]: { receiptRef: ref, date } }));
    setSubmitOpen(false);
    toast.success(`VAT return for ${selected.label} submitted — receipt ${ref}`);
  }

  // ─── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const ret = computeReturn(selected);
    const flags = vatFlagsForInvoices(ret.invoices);
    const net = netVatLabel(ret.box5);
    const isSubmitted = selected.status === 'submitted';

    return (
      <div className="flex flex-col h-full bg-[#F8F9FC]">
        {/* Header */}
        <div className="px-8 pt-8 pb-5 bg-white border-b border-[#F0EFF6]">
          <button
            onClick={() => setSelectedPeriodId(null)}
            className="inline-flex items-center gap-1.5 text-sm text-[#717182] hover:text-[#030213] transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" /> All VAT periods
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-[#030213]">VAT return · {selected.label}</h1>
                <StatusPill status={selected.status} />
              </div>
              <p className="text-sm text-[#717182] mt-1">
                {isSubmitted
                  ? `Submitted ${selected.submittedDate ? fmtDate(selected.submittedDate) : ''} · Receipt ${selected.receiptRef}`
                  : `Filing deadline ${fmtDate(selected.dueDate)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-4xl mx-auto flex flex-col gap-5">

            {/* VAT return boxes */}
            <Card title="VAT return summary" subtitle="HMRC 9-box return · input VAT derived from processed invoices">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <div className="rounded-xl border border-[#E0E0E6] p-4">
                  <p className="text-xs text-[#717182]">Box 1 · VAT due on sales</p>
                  <p className="text-lg font-semibold text-[#030213] mt-1">{fmt(ret.box1)}</p>
                </div>
                <div className="rounded-xl border border-[#E0E0E6] p-4">
                  <p className="text-xs text-[#717182]">Box 4 · VAT reclaimed on purchases</p>
                  <p className="text-lg font-semibold text-[#030213] mt-1">{fmt(ret.box4)}</p>
                </div>
                <div className="rounded-xl border-2 border-[#4D8EF7]/40 bg-[#4D8EF7]/5 p-4">
                  <p className="text-xs text-[#717182]">Box 5 · Net VAT position</p>
                  <p className={`text-lg font-semibold mt-1 ${net.tone}`}>{net.text}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#F8F9FC]">
                  <span className="text-[#717182]">Box 6 · Total sales ex-VAT</span>
                  <span className="font-medium text-[#030213]">{fmt(ret.box6)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#F8F9FC]">
                  <span className="text-[#717182]">Box 7 · Total purchases ex-VAT</span>
                  <span className="font-medium text-[#030213]">{fmt(ret.box7)}</span>
                </div>
              </div>
            </Card>

            {/* Input VAT breakdown */}
            <Card
              title="Input VAT breakdown"
              subtitle={`${ret.invoices.length} invoice${ret.invoices.length === 1 ? '' : 's'} contributing to Box 4`}
              action={onNavigateToInvoices && (
                <button
                  onClick={() => onNavigateToInvoices()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#4D8EF7] hover:underline"
                >
                  View in Invoices <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            >
              {ret.invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="w-8 h-8 text-[#C4C4CC] mb-2" />
                  <p className="text-sm text-[#717182]">No processed invoices fall in this period yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[#717182] border-b border-[#F0EFF6]">
                        <th className="pb-2 font-medium">Invoice</th>
                        <th className="pb-2 font-medium">Supplier</th>
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium text-right">Net</th>
                        <th className="pb-2 font-medium text-right">VAT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ret.invoices.map(inv => (
                        <tr key={inv.id} className="border-b border-[#F8F9FC] last:border-0">
                          <td className="py-2.5 font-medium text-[#030213]">{inv.number}</td>
                          <td className="py-2.5 text-[#5A5568]">{inv.supplier}</td>
                          <td className="py-2.5 text-[#717182]">{fmtDate(inv.date)}</td>
                          <td className="py-2.5 text-right text-[#5A5568]">{fmt(inv.amount - inv.vatAmount)}</td>
                          <td className="py-2.5 text-right font-medium text-[#030213]">{fmt(inv.vatAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#E0E0E6]">
                        <td className="pt-3 font-semibold text-[#030213]" colSpan={3}>Total reclaimable (Box 4)</td>
                        <td className="pt-3 text-right text-[#5A5568]">{fmt(ret.box7)}</td>
                        <td className="pt-3 text-right font-semibold text-[#030213]">{fmt(ret.box4)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>

            {/* Data quality checks */}
            <Card title="Data quality checks" subtitle="VAT validation before submission">
              {flags.length === 0 ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#E8F5E9]">
                  <ShieldCheck className="w-5 h-5 text-[#2E7D32] flex-shrink-0" />
                  <p className="text-sm text-[#2E7D32]">
                    All {ret.invoices.length} invoice{ret.invoices.length === 1 ? '' : 's'} passed VAT validation — no issues to resolve.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {flags.map((f, i) => (
                    <div key={`${f.invoiceId}-${i}`} className="flex items-start gap-3 px-4 py-3 rounded-lg bg-[#FFF3E0]">
                      <AlertTriangle className="w-5 h-5 text-[#E65100] flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#030213]">{f.title} · {f.invoiceNumber}</p>
                        <p className="text-xs text-[#717182] mt-0.5">{f.supplier} — {f.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Submit action */}
            <div className="flex items-center justify-between px-5 py-4 bg-white border border-[#E0E0E6] rounded-xl">
              {isSubmitted ? (
                <>
                  <div className="flex items-center gap-3">
                    <Receipt className="w-5 h-5 text-[#2E7D32]" />
                    <div>
                      <p className="text-sm font-medium text-[#030213]">Return submitted to HMRC</p>
                      <p className="text-xs text-[#717182] mt-0.5">
                        Receipt {selected.receiptRef}{selected.submittedDate ? ` · ${fmtDate(selected.submittedDate)}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm text-[#2E7D32]">
                    <CheckCircle2 className="w-4 h-4" /> Filed
                  </span>
                </>
              ) : selected.status === 'open' ? (
                <>
                  <div>
                    <p className="text-sm font-medium text-[#030213]">Period still open</p>
                    <p className="text-xs text-[#717182] mt-0.5">Available to submit after {fmtDate(selected.end)}.</p>
                  </div>
                  <Button variant="primary" disabled>Submit VAT claim</Button>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium text-[#030213]">Ready to submit</p>
                    <p className="text-xs text-[#717182] mt-0.5">
                      {flags.length > 0
                        ? `${flags.length} data-quality flag${flags.length === 1 ? '' : 's'} — review before filing.`
                        : 'All checks passed. File your return with HMRC.'}
                    </p>
                  </div>
                  <Button variant="primary" icon={<Receipt className="w-4 h-4" />} onClick={() => setSubmitOpen(true)}>
                    Submit VAT claim
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Submit confirmation */}
        <Modal
          isOpen={submitOpen}
          onClose={() => setSubmitOpen(false)}
          title="Submit VAT claim"
          size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={confirmSubmit}>Confirm & submit</Button>
            </div>
          }
        >
          <p className="text-sm text-[#5A5568]">
            You're about to submit the VAT return for <span className="font-medium text-[#030213]">{selected.label}</span> to HMRC.
          </p>
          <div className="mt-4 rounded-lg bg-[#F8F9FC] p-4 text-sm flex flex-col gap-2">
            <div className="flex justify-between"><span className="text-[#717182]">Box 5 · Net VAT</span><span className="font-medium text-[#030213]">{net.text}</span></div>
            <div className="flex justify-between"><span className="text-[#717182]">VAT reclaimed (Box 4)</span><span className="text-[#030213]">{fmt(ret.box4)}</span></div>
            <div className="flex justify-between"><span className="text-[#717182]">Invoices included</span><span className="text-[#030213]">{ret.invoices.length}</span></div>
          </div>
          {flags.length > 0 && (
            <p className="mt-3 text-xs text-[#E65100] flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {flags.length} unresolved data-quality flag{flags.length === 1 ? '' : 's'} will be submitted as-is.
            </p>
          )}
        </Modal>
      </div>
    );
  }

  // ─── List view ──────────────────────────────────────────────────────────────
  const openPeriod = periods.find(p => p.status === 'open');
  const nextDue = periods.find(p => p.status === 'ready') ?? openPeriod;
  const openReclaim = openPeriod ? computeReturn(openPeriod).box4 : 0;

  return (
    <div className="flex flex-col h-full bg-[#F8F9FC]">
      {/* Header */}
      <div className="px-8 pt-8 pb-5 bg-white border-b border-[#F0EFF6]">
        <h1 className="text-xl font-semibold text-[#030213]">VAT Hub</h1>
        <p className="text-sm text-[#717182] mt-1">Review and submit your VAT returns</p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-5xl mx-auto flex flex-col gap-5">

          {/* Summary strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-[#717182]"><Calendar className="w-4 h-4" /> Next return due</div>
              <p className="text-lg font-semibold text-[#030213] mt-1">{nextDue ? fmtDate(nextDue.dueDate) : '—'}</p>
              <p className="text-xs text-[#717182] mt-0.5">{nextDue ? nextDue.label : 'No open periods'}</p>
            </div>
            <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-[#717182]"><Receipt className="w-4 h-4" /> Reclaimable this period</div>
              <p className="text-lg font-semibold text-[#030213] mt-1">{fmt(openReclaim)}</p>
              <p className="text-xs text-[#717182] mt-0.5">{openPeriod ? openPeriod.label : 'Current quarter'}</p>
            </div>
            <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-[#717182]"><CheckCircle2 className="w-4 h-4" /> Filed to date</div>
              <p className="text-lg font-semibold text-[#030213] mt-1">{periods.filter(p => p.status === 'submitted').length}</p>
              <p className="text-xs text-[#717182] mt-0.5">Returns submitted</p>
            </div>
          </div>

          {/* Periods table */}
          <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0EFF6]">
              <p className="text-sm font-semibold text-[#030213]">VAT periods</p>
              <p className="text-xs text-[#717182] mt-0.5">Quarterly returns · newest first</p>
            </div>
            <div className="divide-y divide-[#F0EFF6]">
              {periods.map(p => {
                const ret = computeReturn(p);
                const net = netVatLabel(ret.box5);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPeriodId(p.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#F8F9FC] transition-colors"
                  >
                    <div className="w-40 flex-shrink-0">
                      <p className="text-sm font-medium text-[#030213]">{p.label}</p>
                      <p className="text-xs text-[#717182] mt-0.5">Due {fmtDate(p.dueDate)}</p>
                    </div>
                    <div className="flex-shrink-0"><StatusPill status={p.status} /></div>
                    <div className="flex-1" />
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${net.tone}`}>{net.text}</p>
                      <p className="text-xs text-[#717182] mt-0.5">Net VAT position</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#C4C4CC] flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
