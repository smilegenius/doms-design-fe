import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clock, FileText, Filter, Inbox, Info, Layers, Link2, MessageSquare, Monitor, Receipt, Send, ThumbsUp, X, XCircle, Zap,
} from '../icons';
import { ME, useGo, useScoped } from '../store';
import {
  CheckState, EXCEPTION_RESOLUTIONS, INVOICE_REASONS, INVOICE_STATUSES, Invoice, InvoiceStatus, LineState, fmtDate, fmtDateTime, gbp,
  invoiceInfo, invoiceIssues, invoiceNeedsAction, practiceName, relDay,
} from '../data';
import { Btn, Card, Chips, EmptyState, KV, Label, Pill, Screen, SearchBox, Section, Segmented, Sheet, TextArea, TopBar, Tone, cx } from '../ui';

/** Status pill — same names as the portal. */
export const INV_STATUS: Record<InvoiceStatus, { tone: Tone; label: string }> = {
  qc: { tone: 'bad', label: 'QC' },
  duplicate: { tone: 'violet', label: 'Duplicate' },
  awaiting: { tone: 'warn', label: 'Awaiting approval' },
  approved: { tone: 'ok', label: 'Approved' },
  xero: { tone: 'brand', label: 'Sent to Xero' },
  paid: { tone: 'teal', label: 'Payment processed' },
  disputed: { tone: 'bad', label: 'Disputed' },
  rejected: { tone: 'bad', label: 'Rejected' },
  'xero-failed': { tone: 'bad', label: 'Sent to Xero failed' },
  exported: { tone: 'neutral', label: 'Exported for payment' },
  archived: { tone: 'neutral', label: 'Archived' },
  'not-invoice': { tone: 'neutral', label: 'Not an invoice' },
  'zero-value': { tone: 'neutral', label: 'Zero value' },
};
/** Summary tile icon + colour per main status (portal's stat cards). */
const TILE: Partial<Record<InvoiceStatus | 'all', { icon: React.ComponentType<{ className?: string }>; color: string; bar: string; short: string }>> = {
  all: { icon: FileText, color: 'text-go-brand', bar: 'bg-go-brand', short: 'All' },
  qc: { icon: AlertTriangle, color: 'text-go-bad', bar: 'bg-go-bad', short: 'QC' },
  duplicate: { icon: Layers, color: 'text-go-violet', bar: 'bg-go-violet', short: 'Duplicates' },
  awaiting: { icon: Clock, color: 'text-go-warn', bar: 'bg-go-warn', short: 'Awaiting' },
  approved: { icon: CheckCircle2, color: 'text-go-ok', bar: 'bg-go-ok', short: 'Approved' },
  xero: { icon: Send, color: 'text-go-brand', bar: 'bg-go-brand', short: 'In Xero' },
  paid: { icon: ThumbsUp, color: 'text-go-teal', bar: 'bg-go-teal', short: 'Paid' },
};
const CHECK_ICON: Record<CheckState, React.ReactNode> = {
  pass: <CheckCircle2 className="w-5 h-5 text-go-ok" />,
  warn: <AlertTriangle className="w-5 h-5 text-go-warn" />,
  fail: <XCircle className="w-5 h-5 text-go-bad" />,
  info: <Info className="w-5 h-5 text-go-brand" />,
};
const LINE_STATE: Record<LineState, { tone: Tone; label: string }> = {
  matched: { tone: 'ok', label: 'Matched' },
  difference: { tone: 'warn', label: 'Difference' },
  missing: { tone: 'bad', label: 'No invoice' },
  resolved: { tone: 'teal', label: 'Resolved' },
};
const gross = (i: Invoice) => i.net + i.vat;
// Fades the right edge of a sideways-scrolling row so it reads as scrollable
const EDGE_FADE = 'linear-gradient(90deg, #000 calc(100% - 36px), transparent 100%)';

type Sort = 'recent' | 'oldest' | 'high' | 'low';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'recent', label: 'Most recent' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'high', label: 'Amount: high to low' },
  { id: 'low', label: 'Amount: low to high' },
];

/** AI read confidence — lightning + bar, orange under 90%, green from 90%. */
function Confidence({ v }: { v: number }) {
  const good = v >= 90;
  return (
    <span className="flex items-center gap-1.5">
      <Zap className={cx('w-3.5 h-3.5', good ? 'text-go-ok' : 'text-go-warn')} />
      <span className="w-12 h-1.5 rounded-full bg-go-line overflow-hidden"><span className={cx('block h-full rounded-full', good ? 'bg-go-ok' : 'bg-go-warn')} style={{ width: `${v}%` }} /></span>
      <span className={cx('text-[11px] font-semibold tabular-nums', good ? 'text-go-ok' : 'text-go-warn')}>{v}%</span>
    </span>
  );
}

/** "QC · 5 issues" / "Approved · System · 3 info" */
export function InvoiceStatusLine({ i }: { i: Invoice }) {
  const s = INV_STATUS[i.status];
  const issues = invoiceIssues(i);
  const info = invoiceInfo(i);
  return (
    <span className="flex items-center gap-2 min-w-0">
      <Pill tone={s.tone} className="!h-[22px] !px-2 !text-[11px] flex-shrink-0">
        {i.status === 'qc' && <AlertTriangle className="w-3 h-3" />}
        {i.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
        {s.label}{i.status === 'approved' && i.approvedBy === 'System' ? ' · System' : ''}
      </Pill>
      {issues > 0 && invoiceNeedsAction(i.status)
        ? <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-go-bad whitespace-nowrap"><AlertTriangle className="w-3 h-3" />{issues} issue{issues > 1 ? 's' : ''}</span>
        : info > 0 && <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-go-brand whitespace-nowrap"><Info className="w-3 h-3" />{info} info</span>}
    </span>
  );
}

function InvoiceRow({ i }: { i: Invoice }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(`/go/invoices/invoice/${i.id}`)} className="w-full text-left px-3.5 py-3 flex flex-col gap-1.5 hover:bg-go-raised transition">
      {/* Invoice number + amount */}
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[14.5px] font-bold text-go-ink truncate">{i.number}</span>
        <span className="text-[14.5px] font-bold text-go-ink tabular-nums flex-shrink-0">{gbp(gross(i))}</span>
      </span>
      {/* Supplier · date · type */}
      <span className="flex items-center gap-2 text-[12px] text-go-muted min-w-0">
        <span className="truncate">{i.supplier}</span>
        <span className="flex-shrink-0">· {new Date(i.issued).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        <span className={cx('flex-shrink-0 h-[18px] px-1.5 rounded-md text-[9.5px] font-bold uppercase tracking-wider flex items-center',
          i.docType === 'Credit note' ? 'bg-go-violet-soft text-go-violet' : 'bg-go-brand-soft text-go-brand-ink')}>{i.docType}</span>
      </span>
      {/* Bill to */}
      <span className="flex items-center gap-1.5 text-[12px] min-w-0">
        <span className="text-go-faint flex-shrink-0">Bill to</span>
        <span className="text-go-ink2 font-medium truncate">{i.billTo.name}{i.billTo.registered ? ` (${practiceName(i.practice).split(' ')[0]})` : ''}</span>
        {!i.billTo.registered && <span className="flex-shrink-0 h-[18px] px-1.5 rounded-full border border-go-warn/50 bg-go-warn-soft text-go-warn text-[10px] font-semibold flex items-center gap-0.5">Not registered<Info className="w-2.5 h-2.5" /></span>}
      </span>
      {/* Status + read confidence */}
      <span className="flex items-center justify-between gap-2 mt-0.5">
        <InvoiceStatusLine i={i} />
        <Confidence v={i.confidence} />
      </span>
    </button>
  );
}

/** Shown on the Invoices tab while invoices are switched off (FEATURES.invoices). */
export function InvoicesComingSoon() {
  return (
    <Screen tabs header={<TopBar title="Invoices" large />}>
      {/* Deliberately quiet: faded icon + muted text, centred in the screen */}
      <div className="px-6 pt-40 flex flex-col items-center text-center">
        <span className="w-16 h-16 rounded-full bg-go-raised border border-go-line flex items-center justify-center">
          <Monitor className="w-7 h-7 text-go-faint opacity-60" />
        </span>
        <h2 className="text-[15px] font-medium text-go-muted tracking-wide mt-4">Coming soon to the app</h2>
        <p className="text-[13px] text-go-faint leading-relaxed mt-1.5 max-w-[250px]">
          For now, you can view and approve invoices on the Smile Genius web portal.
        </p>
      </div>
    </Screen>
  );
}

export function FinanceScreen() {
  const navigate = useNavigate();
  const { invoices, statements } = useScoped();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'statements' ? 'statements' : 'invoices';
  const setTab = (t: 'invoices' | 'statements') => setParams(t === 'statements' ? { tab: t } : {}, { replace: true });
  const status = (INVOICE_STATUSES.find(s => s.id === params.get('s'))?.id ?? 'all') as InvoiceStatus | 'all';
  const setStatus = (s: InvoiceStatus | 'all') => setParams(s === 'all' ? {} : { s }, { replace: true });
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [sortOpen, setSortOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const toReview = statements.filter(s => s.status === 'to-review');
  const count = (s: InvoiceStatus) => invoices.filter(i => i.status === s).length;

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return invoices
      .filter(i => status === 'all' || i.status === status)
      .filter(i => !t || `${i.supplier} ${i.number} ${practiceName(i.practice)} ${i.billTo.name}`.toLowerCase().includes(t))
      .sort((a, b) => sort === 'recent' ? b.issued.localeCompare(a.issued) : sort === 'oldest' ? a.issued.localeCompare(b.issued)
        : sort === 'high' ? gross(b) - gross(a) : gross(a) - gross(b));
  }, [invoices, status, q, sort]);
  const moreStatus = INVOICE_STATUSES.find(s => s.id === status && s.group === 'more');
  const tiles: { id: InvoiceStatus | 'all'; label: string; short: string; n: number }[] = [
    { id: 'all', label: 'All invoices', short: 'All', n: invoices.length },
    ...INVOICE_STATUSES.filter(s => s.group === 'main').map(s => ({ id: s.id, label: s.label, short: TILE[s.id]!.short, n: count(s.id) }))
      .filter(t => t.n > 0 || t.id === status),
  ];

  return (
    <Screen tabs header={
      <div className="bg-go-bg/80 backdrop-blur-xl px-4 pt-3 pb-3 space-y-3">
        <h1 className="text-[24px] font-bold text-go-ink tracking-tight">Invoices</h1>
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'invoices', label: 'Invoices', count: invoices.filter(i => invoiceNeedsAction(i.status)).length },
          { value: 'statements', label: 'Statements', count: toReview.length },
        ]} />
      </div>
    }>
      {tab === 'invoices' && (
        <>
          {/* Status row — same as Home: one card, icon + count on one line, short label under.
              Zero counts are hidden; scrolls sideways inside the card when it doesn't fit. */}
          <div className="px-4">
            <Card className="overflow-hidden">
              <div role="tablist" className="flex overflow-x-auto go-scroll divide-x divide-go-line"
                style={tiles.length > 4 ? { maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE } : undefined}>
                {tiles.map(t => {
                  const st = TILE[t.id]!;
                  const Icon = st.icon;
                  const on = status === t.id;
                  return (
                    <button key={t.id} role="tab" aria-selected={on} aria-label={`${t.label}: ${t.n}`} onClick={() => setStatus(t.id)}
                      className={cx('relative flex-1 min-w-[82px] flex flex-col items-center gap-1 px-2 pt-3 pb-2.5 transition', on ? 'bg-go-raised' : 'active:scale-95')}>
                      <span className="flex items-center gap-1.5">
                        <Icon className={cx('w-[18px] h-[18px]', st.color)} />
                        <span className="text-[20px] font-bold tabular-nums leading-none text-go-ink">{t.n}</span>
                      </span>
                      <span className={cx('text-[11px] whitespace-nowrap', on ? 'font-semibold text-go-ink' : 'font-medium text-go-muted')}>{t.short}</span>
                      {on && <span className={cx('absolute bottom-0 inset-x-3 h-0.5 rounded-full', st.bar)} />}
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Search · sort · more filters */}
          <div className="px-4 mt-3 flex gap-2">
            <div className="flex-1 min-w-0"><SearchBox value={q} onChange={setQ} placeholder="Supplier, invoice number or practice" /></div>
            <button onClick={() => setMoreOpen(true)} aria-label="More statuses"
              className={cx('relative w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0',
                moreStatus ? 'go-grad text-white border-transparent' : 'bg-go-surface border-go-line text-go-ink2')}>
              <Filter className="w-5 h-5" />
            </button>
          </div>
          <div className="px-4 mt-2.5 flex items-center justify-between gap-2">
            <p className="text-[12px] text-go-muted">{shown.length} invoice{shown.length === 1 ? '' : 's'}</p>
            <button onClick={() => setSortOpen(true)} className="inline-flex items-center gap-1 text-[12.5px] text-go-muted">
              Sort <span className="font-semibold text-go-brand">{SORTS.find(s => s.id === sort)!.label}</span><ChevronDown className="w-4 h-4 text-go-brand" />
            </button>
          </div>
          {moreStatus && (
            <div className="px-4 mt-2">
              <button onClick={() => setStatus('all')} className="inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full bg-go-brand-soft text-go-brand-ink text-[12.5px] font-semibold">
                {moreStatus.label}<X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="px-4 mt-2.5">
            {shown.length ? (
              <Card className="divide-y divide-go-line overflow-hidden">{shown.map(i => <InvoiceRow key={i.id} i={i} />)}</Card>
            ) : (
              <EmptyState icon={<FileText className="w-7 h-7" />} title="No invoices found" body="Please try a different status or search." />
            )}
          </div>

          {/* Sort */}
          <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="Sort invoices">
            <div className="space-y-1">
              {SORTS.map(s => (
                <button key={s.id} onClick={() => { setSort(s.id); setSortOpen(false); }}
                  className={cx('w-full h-12 px-3 rounded-2xl flex items-center justify-between text-[14.5px] text-left', sort === s.id ? 'bg-go-brand-soft text-go-brand-ink font-semibold' : 'text-go-ink hover:bg-go-raised')}>
                  {s.label}{sort === s.id && <CheckCircle2 className="w-5 h-5 text-go-brand" />}
                </button>
              ))}
            </div>
          </Sheet>

          {/* Secondary statuses (portal's bottom filters) */}
          <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={<span className="inline-flex items-center gap-2"><Filter className="w-5 h-5 text-go-brand" />More statuses</span>} label="More statuses">
            <div className="space-y-1">
              {INVOICE_STATUSES.filter(s => s.group === 'more').map(s => {
                const n = count(s.id);
                const on = status === s.id;
                const bad = s.id === 'disputed' || s.id === 'rejected' || s.id === 'xero-failed';
                return (
                  <button key={s.id} onClick={() => { setStatus(on ? 'all' : s.id); setMoreOpen(false); }}
                    className={cx('w-full h-12 px-3 rounded-2xl flex items-center gap-3 text-left transition', on ? 'bg-go-brand-soft' : 'hover:bg-go-raised')}>
                    <span className={cx('flex-1 text-[14.5px]', on ? 'font-semibold text-go-brand-ink' : bad && n ? 'text-go-bad font-medium' : 'text-go-ink')}>{s.label}</span>
                    <span className={cx('min-w-[26px] h-6 px-2 rounded-full text-[12px] font-bold flex items-center justify-center tabular-nums',
                      n ? (bad ? 'bg-go-bad-soft text-go-bad' : 'bg-go-raised text-go-ink2') : 'text-go-faint')}>{n}</span>
                  </button>
                );
              })}
            </div>
          </Sheet>
        </>
      )}

      {tab === 'statements' && (
        <div className="px-4 space-y-3">
          {statements.map(s => {
            const ex = s.lines.filter(l => l.state === 'difference' || l.state === 'missing').length;
            return (
              <Card key={s.id} onClick={() => navigate(`/go/invoices/statement/${s.id}`)} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="w-11 h-11 rounded-2xl bg-go-raised border border-go-line flex items-center justify-center text-go-ink2 flex-shrink-0"><FileText className="w-5 h-5" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-go-ink truncate">{s.supplier}</p>
                    <p className="text-[12px] text-go-muted">{s.period} · {practiceName(s.practice)}</p>
                  </div>
                  <p className="text-[16px] font-bold text-go-ink tabular-nums">{gbp(s.balance)}</p>
                </div>
                <div className="mt-3">
                  {s.status === 'reconciled' ? <Pill tone="teal" dot>Reconciled</Pill>
                    : ex ? <Pill tone="warn" dot>{ex} line{ex > 1 ? 's' : ''} to resolve</Pill>
                    : <Pill tone="ok" dot>All lines matched</Pill>}
                </div>
              </Card>
            );
          })}
          {!statements.length && <EmptyState icon={<Inbox className="w-7 h-7" />} title="No statements" body="Nothing to review for this practice." />}
        </div>
      )}
    </Screen>
  );
}


// ─── Invoice ────────────────────────────────────────────────────────────────

export function InvoiceScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { invoices, setInvoiceStatus, toast } = useGo();
  const inv = invoices.find(i => i.id === id);
  const [sheet, setSheet] = useState<null | 'approve' | 'query' | 'reject'>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [reviewed, setReviewed] = useState(false);
  if (!inv) return <Screen header={<TopBar back fallback="/go/invoices" />}><EmptyState icon={<Receipt className="w-7 h-7" />} title="Invoice not found" /></Screen>;
  const s = INV_STATUS[inv.status];
  const flagged = inv.checks.filter(c => c.state !== 'pass');
  const actionable = invoiceNeedsAction(inv.status);
  const close = () => { setSheet(null); setReasons([]); setReason(null); setMsg(''); setReviewed(false); };

  const approve = () => { setInvoiceStatus(inv.id, 'approved', `Approved by ${ME.name}`); toast('Invoice approved for the next payment run'); close(); };
  const query = () => { setInvoiceStatus(inv.id, 'disputed', `Queried by ${ME.name}: ${reasons.join(', ')}`); toast(`Query sent to ${inv.supplier}`, 'info'); close(); };
  const reject = () => { setInvoiceStatus(inv.id, 'rejected', `Rejected by ${ME.name}: ${reason}`); toast('Invoice rejected. Supplier notified.', 'bad'); close(); };

  return (
    <Screen header={<TopBar back fallback="/go/invoices" title={inv.supplier} sub={inv.id} />}
      footer={actionable ? (
        <div className="flex gap-2">
          <Btn variant="secondary" className="!text-go-bad !px-4" onClick={() => setSheet('reject')}>Reject</Btn>
          <Btn variant="secondary" className="!px-4" onClick={() => setSheet('query')} icon={<MessageSquare className="w-4 h-4" />}>Query</Btn>
          <Btn className="flex-1 min-w-0" onClick={() => setSheet('approve')} icon={<ThumbsUp className="w-[18px] h-[18px]" />}>Approve</Btn>
        </div>
      ) : undefined}>
      <div className="px-4 pt-1">
        <Card className="p-5 relative overflow-hidden">
          <span className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-go-brand/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <Pill tone={s.tone} dot>{s.label}</Pill>
            <p className="text-[36px] font-bold tracking-tight tabular-nums mt-3 go-grad-text">{gbp(gross(inv))}</p>
            <p className="text-[13px] text-go-muted">{gbp(inv.net)} + {gbp(inv.vat)} VAT · due {fmtDate(inv.due)}</p>
            <p className="text-[12px] text-go-ink2 mt-3 pt-3 border-t border-go-line">{practiceName(inv.practice)} · {inv.source}</p>
          </div>
        </Card>
      </div>

      <Section title="Checks">
        <Card className="divide-y divide-go-line">
          {inv.checks.map(c => (
            <div key={c.label} className="flex items-start gap-3 p-4">
              {CHECK_ICON[c.state]}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-go-ink">{c.label}</p>
                <p className={cx('text-[12.5px] mt-0.5 leading-snug', c.state === 'pass' ? 'text-go-muted' : c.state === 'warn' ? 'text-go-warn' : 'text-go-bad')}>{c.detail}</p>
              </div>
            </div>
          ))}
        </Card>
      </Section>

      {inv.caseId && (
        <div className="px-4 mt-3">
          <Card onClick={() => navigate(`/go/work/${inv.caseId}`)} className="p-4 flex items-center gap-3">
            <Link2 className="w-5 h-5 text-go-brand" />
            <span className="flex-1 text-[14px] font-medium text-go-ink">Linked case <span className="font-mono text-go-muted">{inv.caseId}</span></span>
            <ChevronRight className="w-5 h-5 text-go-faint" />
          </Card>
        </div>
      )}

      <Section title="Invoice lines">
        <Card className="px-4 py-1">
          {inv.lines.map(l => (
            <div key={l.label} className="flex items-start justify-between gap-3 py-3 border-b border-go-line">
              <div className="min-w-0"><p className="text-[13.5px] text-go-ink">{l.label}</p><p className="text-[12px] text-go-muted">{l.qty} × {gbp(l.unit)}</p></div>
              <p className="text-[13.5px] font-semibold text-go-ink tabular-nums">{gbp(l.qty * l.unit)}</p>
            </div>
          ))}
          <KV rows={[['Net', gbp(inv.net)], ['VAT', gbp(inv.vat)], ['Total', <span key="t" className="text-[16px] font-bold">{gbp(gross(inv))}</span>]]} />
        </Card>
      </Section>

      <Section title="Document">
        <div className="rounded-[22px] border border-go-line bg-go-raised h-40 flex flex-col items-center justify-center gap-2 text-go-muted">
          <FileText className="w-8 h-8" />
          <p className="text-[12.5px]">The invoice will show here.</p>
        </div>
      </Section>

      <Section title="Activity">
        <Card className="p-4 space-y-3">
          {inv.activity.map(a => (
            <div key={a.text + a.at} className="flex gap-3">
              <span className="w-2 h-2 rounded-full go-grad mt-1.5 flex-shrink-0" />
              <div><p className="text-[13.5px] text-go-ink">{a.text}</p><p className="text-[11.5px] text-go-muted">{fmtDateTime(a.at)}</p></div>
            </div>
          ))}
        </Card>
      </Section>

      <Sheet open={sheet === 'approve'} onClose={close} title="Approve invoice" sub={`${gbp(gross(inv))} to ${inv.supplier}, paid in the next payment run.`}
        footer={<Btn block disabled={!!flagged.length && !reviewed} onClick={approve} icon={<ThumbsUp className="w-[18px] h-[18px]" />}>Approve invoice</Btn>}>
        {flagged.length ? (
          <>
            {flagged.map(f => (
              <div key={f.label} className="flex gap-3 p-3.5 rounded-2xl bg-go-warn-soft mb-2">
                <AlertTriangle className="w-5 h-5 text-go-warn flex-shrink-0" />
                <div><p className="text-[13.5px] font-semibold text-go-ink">{f.label}</p><p className="text-[12.5px] text-go-warn">{f.detail}</p></div>
              </div>
            ))}
            <button onClick={() => setReviewed(r => !r)} className="flex items-center gap-3 mt-3 text-left">
              <span className={cx('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0', reviewed ? 'go-grad text-white' : 'border-2 border-go-line')}>{reviewed && <CheckCircle2 className="w-4 h-4" />}</span>
              <span className="text-[13.5px] text-go-ink">I’ve checked the warnings above and want to approve anyway</span>
            </button>
          </>
        ) : (
          <div className="flex gap-3 p-3.5 rounded-2xl bg-go-ok-soft"><CheckCircle2 className="w-5 h-5 text-go-ok" /><p className="text-[13.5px] text-go-ink">All checks passed.</p></div>
        )}
      </Sheet>

      <Sheet open={sheet === 'query'} onClose={close} title="Query with supplier" sub="The invoice stays on hold until the supplier replies."
        footer={<Btn block disabled={!reasons.length} onClick={query}>Send query</Btn>}>
        <Label>Reason</Label>
        <Chips options={INVOICE_REASONS} value={reasons} onChange={setReasons} multi />
        <div className="mt-5"><Label optional>Message to supplier</Label><TextArea rows={4} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Add details the supplier needs to resolve this." /></div>
      </Sheet>

      <Sheet open={sheet === 'reject'} onClose={close} title="Reject invoice" sub="Why is this invoice being rejected?"
        footer={<Btn block variant="danger" disabled={!reason || !msg.trim()} onClick={reject}>Reject invoice</Btn>}>
        <Chips options={INVOICE_REASONS} value={reason} onChange={setReason} />
        <div className="mt-5"><Label>Message to supplier</Label><TextArea rows={4} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Tell the supplier what to do next." /></div>
      </Sheet>
    </Screen>
  );
}

// ─── Statement ──────────────────────────────────────────────────────────────

export function StatementScreen() {
  const { id } = useParams();
  const { statements, updateStatement, toast } = useGo();
  const st = statements.find(s => s.id === id);
  const [line, setLine] = useState<number | null>(null);
  const [res, setRes] = useState<string | null>(null);
  const [note, setNote] = useState('');
  if (!st) return <Screen header={<TopBar back fallback="/go/invoices" />}><EmptyState icon={<FileText className="w-7 h-7" />} title="Statement not found" /></Screen>;
  const exceptions = st.lines.filter(l => l.state === 'difference' || l.state === 'missing');
  const matched = st.lines.filter(l => l.state !== 'difference' && l.state !== 'missing').length;
  const current = line !== null ? st.lines[line] : null;

  const resolve = () => {
    updateStatement(st.id, s => ({ ...s, lines: s.lines.map((l, i) => (i === line ? { ...l, state: 'resolved', resolution: res! + (note ? ` · ${note}` : '') } : l)) }));
    toast('Line resolved');
    setLine(null); setRes(null); setNote('');
  };
  const approve = () => {
    updateStatement(st.id, s => ({ ...s, status: 'reconciled' }));
    toast('Statement approved and reconciled');
  };

  return (
    <Screen header={<TopBar back fallback="/go/invoices" title={st.supplier} sub={`Statement · ${st.period}`} />}
      footer={st.status === 'to-review' ? (
        <Btn block disabled={!!exceptions.length} onClick={approve}>{exceptions.length ? `Resolve ${exceptions.length} line${exceptions.length > 1 ? 's' : ''} to approve` : 'Approve statement'}</Btn>
      ) : undefined}>
      <div className="px-4 pt-1">
        <Card className="p-5">
          {st.status === 'reconciled' ? <Pill tone="teal" dot>Reconciled</Pill> : <Pill tone={exceptions.length ? 'warn' : 'ok'} dot>{exceptions.length ? 'Needs review' : 'All lines matched'}</Pill>}
          <p className="text-[34px] font-bold tracking-tight tabular-nums mt-3 text-go-ink">{gbp(st.balance)}</p>
          <p className="text-[13px] text-go-muted">Balance · {practiceName(st.practice)}</p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="rounded-2xl bg-go-ok-soft p-3"><p className="text-[22px] font-bold text-go-ok tabular-nums">{matched}</p><p className="text-[12px] text-go-ink2">Matched</p></div>
            <div className={cx('rounded-2xl p-3', exceptions.length ? 'bg-go-warn-soft' : 'bg-go-raised')}><p className={cx('text-[22px] font-bold tabular-nums', exceptions.length ? 'text-go-warn' : 'text-go-faint')}>{exceptions.length}</p><p className="text-[12px] text-go-ink2">To resolve</p></div>
          </div>
        </Card>
      </div>

      <Section title="Statement lines">
        <div className="space-y-2">
          {st.lines.map((l, i) => {
            const ls = LINE_STATE[l.state];
            const ex = l.state === 'difference' || l.state === 'missing';
            return (
              <button key={l.ref} disabled={!ex || st.status === 'reconciled'} onClick={() => setLine(i)}
                className={cx('w-full text-left p-4 rounded-[20px] border transition', ex ? 'border-go-warn/40 bg-go-surface' : 'border-go-line bg-go-surface')}>
                <div className="flex items-center gap-3">
                  <span className="flex-1 font-mono text-[13.5px] font-semibold text-go-ink">{l.ref}</span>
                  <span className="text-[14px] font-semibold text-go-ink tabular-nums">{gbp(l.amount)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Pill tone={ls.tone} dot>{ls.label}</Pill>
                  {(l.note || l.resolution) && <span className="text-[12px] text-go-muted truncate">{l.resolution ?? l.note}</span>}
                  {ex && <ChevronRight className="w-4 h-4 text-go-faint ml-auto flex-shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Sheet open={line !== null} onClose={() => setLine(null)} title="Resolve line" sub={current ? `${current.ref} · ${current.note}` : undefined}
        footer={<Btn block disabled={!res} onClick={resolve}>Resolve</Btn>}>
        <div className="space-y-2">
          {EXCEPTION_RESOLUTIONS.map(r => (
            <button key={r} onClick={() => setRes(r)} className={cx('w-full text-left flex items-center gap-3 p-3.5 rounded-2xl border transition', res === r ? 'border-go-brand bg-go-brand-soft' : 'border-go-line')}>
              <span className={cx('w-5 h-5 rounded-full border-2 flex items-center justify-center', res === r ? 'border-go-brand' : 'border-go-line')}>{res === r && <span className="w-2.5 h-2.5 rounded-full bg-go-brand" />}</span>
              <span className="text-[14px] text-go-ink">{r}</span>
            </button>
          ))}
        </div>
        <div className="mt-4"><Label optional>Note</Label><TextArea value={note} onChange={e => setNote(e.target.value)} placeholder="Anything the finance team should know" /></div>
      </Sheet>
    </Screen>
  );
}
