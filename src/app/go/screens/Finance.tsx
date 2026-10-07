import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronRight, FileText, Inbox, Link2, MessageSquare, Receipt, ThumbsUp, XCircle } from '../icons';
import { ME, useGo, useScoped } from '../store';
import {
  CheckState, EXCEPTION_RESOLUTIONS, INVOICE_REASONS, Invoice, InvoiceStatus, LineState, fmtDate, fmtDateTime, gbp, practiceName, relDay,
} from '../data';
import { Btn, Card, Chips, EmptyState, KV, Label, Pill, Screen, Section, Segmented, Sheet, TextArea, TopBar, Tone, cx } from '../ui';

const INV_STATUS: Record<InvoiceStatus, { tone: Tone; label: string }> = {
  'to-approve': { tone: 'brand', label: 'Ready for approval' },
  'needs-review': { tone: 'warn', label: 'Needs review' },
  queried: { tone: 'violet', label: 'Queried with supplier' },
  approved: { tone: 'ok', label: 'Approved' },
  rejected: { tone: 'bad', label: 'Rejected' },
};
const CHECK_ICON: Record<CheckState, React.ReactNode> = {
  pass: <CheckCircle2 className="w-5 h-5 text-go-ok" />,
  warn: <AlertTriangle className="w-5 h-5 text-go-warn" />,
  fail: <XCircle className="w-5 h-5 text-go-bad" />,
};
const LINE_STATE: Record<LineState, { tone: Tone; label: string }> = {
  matched: { tone: 'ok', label: 'Matched' },
  difference: { tone: 'warn', label: 'Difference' },
  missing: { tone: 'bad', label: 'No invoice' },
  resolved: { tone: 'teal', label: 'Resolved' },
};
const gross = (i: Invoice) => i.net + i.vat;

type InvFilter = 'open' | 'queried' | 'done';

export function FinanceScreen() {
  const navigate = useNavigate();
  const { invoices, statements } = useScoped();
  const { setInvoiceStatus, toast } = useGo();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'statements' ? 'statements' : 'invoices';
  const setTab = (t: 'invoices' | 'statements') => setParams(t === 'statements' ? { tab: t } : {}, { replace: true });
  const [filter, setFilter] = useState<InvFilter>('open');
  const open = invoices.filter(i => i.status === 'to-approve' || i.status === 'needs-review');
  const toReview = statements.filter(s => s.status === 'to-review');
  const shown = invoices.filter(i =>
    filter === 'open' ? open.includes(i) : filter === 'queried' ? i.status === 'queried' : i.status === 'approved' || i.status === 'rejected');

  const clean = open.filter(i => i.status === 'to-approve' && i.checks.every(c => c.state === 'pass'));
  const approveClean = () => {
    clean.forEach(i => setInvoiceStatus(i.id, 'approved', `Approved by ${ME.name}`));
    toast(`${clean.length} invoice${clean.length === 1 ? '' : 's'} approved for the next payment run`);
  };

  return (
    <Screen tabs header={
      <div className="bg-go-bg/85 backdrop-blur-xl px-4 pt-3 pb-3 space-y-3">
        <h1 className="text-[24px] font-bold text-go-ink tracking-tight">Finance</h1>
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'invoices', label: 'Invoices', count: open.length },
          { value: 'statements', label: 'Statements', count: toReview.length },
        ]} />
      </div>
    }>
      {tab === 'invoices' && (
        <>
          <div className="px-4">
            <Card className="p-4 relative overflow-hidden">
              <span className="absolute -right-12 -top-16 w-44 h-44 rounded-full bg-go-brand/10 blur-2xl pointer-events-none" />
              <div className="relative flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted">Waiting for you</p>
                  <p className="text-[26px] font-bold text-go-ink tracking-tight tabular-nums leading-tight mt-0.5">{gbp(open.reduce((s, i) => s + gross(i), 0))}</p>
                </div>
                <div className="text-right text-[12px] leading-relaxed">
                  <p className="text-go-ok font-semibold">{clean.length} ready</p>
                  <p className="text-go-warn font-semibold">{open.length - clean.length} to check</p>
                </div>
              </div>
              {!!clean.length && (
                <Btn block size="md" className="mt-3 relative" onClick={approveClean} icon={<ThumbsUp className="w-4 h-4" />}>
                  Approve {clean.length} ready · {gbp(clean.reduce((s, i) => s + gross(i), 0))}
                </Btn>
              )}
            </Card>
          </div>
          <div className="px-4 mt-3">
            <Chips options={['To approve', 'Queried', 'Done'] as const}
              value={filter === 'open' ? 'To approve' : filter === 'queried' ? 'Queried' : 'Done'}
              onChange={(v: string) => setFilter(v === 'To approve' ? 'open' : v === 'Queried' ? 'queried' : 'done')} />
          </div>
          <div className="px-4 mt-3">
            {!!shown.length && (
              <Card className="divide-y divide-go-line overflow-hidden">
                {shown.map(i => {
                  const flag = i.checks.find(c => c.state !== 'pass');
                  const passed = i.checks.filter(c => c.state === 'pass').length;
                  const s = INV_STATUS[i.status];
                  const isClean = clean.includes(i);
                  return (
                    <div key={i.id} className="flex items-center gap-3 px-3.5 py-3">
                      <button onClick={() => navigate(`/go/finance/invoice/${i.id}`)} className="flex-1 min-w-0 text-left">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-[14px] font-semibold text-go-ink truncate">{i.supplier}</span>
                          <span className="text-[14px] font-bold text-go-ink tabular-nums flex-shrink-0">{gbp(gross(i))}</span>
                        </span>
                        <span className="flex items-center gap-1.5 mt-0.5 text-[11.5px]">
                          {i.status === 'to-approve' || i.status === 'needs-review'
                            ? (flag
                              ? <><AlertTriangle className={cx('w-3.5 h-3.5 flex-shrink-0', flag.state === 'fail' ? 'text-go-bad' : 'text-go-warn')} /><span className={cx('truncate', flag.state === 'fail' ? 'text-go-bad' : 'text-go-warn')}>{flag.detail}</span></>
                              : <><CheckCircle2 className="w-3.5 h-3.5 text-go-ok flex-shrink-0" /><span className="text-go-muted truncate">{passed}/{i.checks.length} checks passed · due {relDay(i.due).toLowerCase()}</span></>)
                            : <><Pill tone={s.tone} className="!h-5 !px-2 !text-[10.5px]">{s.label}</Pill><span className="text-go-muted truncate">{practiceName(i.practice)}</span></>}
                        </span>
                      </button>
                      {isClean
                        ? <button onClick={() => { setInvoiceStatus(i.id, 'approved', `Approved by ${ME.name}`); toast(`${i.id} approved`); }}
                            className="h-8 px-3 rounded-full bg-go-ok-soft text-go-ok text-[12px] font-semibold flex-shrink-0 active:scale-95 transition">Approve</button>
                        : <ChevronRight className="w-5 h-5 text-go-faint flex-shrink-0" />}
                    </div>
                  );
                })}
              </Card>
            )}
            {!shown.length && <EmptyState icon={<Inbox className="w-7 h-7" />} title="Nothing here" body="You’re all caught up." />}
          </div>
        </>
      )}

      {tab === 'statements' && (
        <div className="px-4 space-y-3">
          {statements.map(s => {
            const ex = s.lines.filter(l => l.state === 'difference' || l.state === 'missing').length;
            return (
              <Card key={s.id} onClick={() => navigate(`/go/finance/statement/${s.id}`)} className="p-4">
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
  if (!inv) return <Screen header={<TopBar back fallback="/go/finance" />}><EmptyState icon={<Receipt className="w-7 h-7" />} title="Invoice not found" /></Screen>;
  const s = INV_STATUS[inv.status];
  const flagged = inv.checks.filter(c => c.state !== 'pass');
  const actionable = inv.status === 'to-approve' || inv.status === 'needs-review' || inv.status === 'queried';
  const close = () => { setSheet(null); setReasons([]); setReason(null); setMsg(''); setReviewed(false); };

  const approve = () => { setInvoiceStatus(inv.id, 'approved', `Approved by ${ME.name}`); toast('Invoice approved for the next payment run'); close(); };
  const query = () => { setInvoiceStatus(inv.id, 'queried', `Queried by ${ME.name}: ${reasons.join(', ')}`); toast(`Query sent to ${inv.supplier}`, 'info'); close(); };
  const reject = () => { setInvoiceStatus(inv.id, 'rejected', `Rejected by ${ME.name}: ${reason}`); toast('Invoice rejected. Supplier notified.', 'bad'); close(); };

  return (
    <Screen header={<TopBar back fallback="/go/finance" title={inv.supplier} sub={inv.id} />}
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
          <p className="text-[12.5px]">Demo only. The invoice PDF will show here.</p>
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
  if (!st) return <Screen header={<TopBar back fallback="/go/finance" />}><EmptyState icon={<FileText className="w-7 h-7" />} title="Statement not found" /></Screen>;
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
    <Screen header={<TopBar back fallback="/go/finance" title={st.supplier} sub={`Statement · ${st.period}`} />}
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
