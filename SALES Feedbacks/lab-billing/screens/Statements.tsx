import { Fragment, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Download, Eye, Lock, Printer, Send } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import { useToast } from '../../../src/app/context/ToastContext';
import { printPages } from '../../bulk-actions/printForms';
import { saveBlob } from '../../bulk-actions/zip';
import type { BillingState, Invoice, Statement } from '../types';
import { account, buildStatement, caseById, isOverdue, lineNet, outstanding, totals } from '../engine';
import { fmtDate, fmtMonth, money, monthOf, pl, prevMonth, round2, today } from '../format';
import { previewStatements, sendStatements, statementDay, useBilling } from '../billingStore';
import { billingAccounts } from '../insights';
import { StatementDoc } from '../BillingDocs';
import { useReadOnly } from '../BillingApp';
import { btn, btnPrimary, Card, Empty, Pill, td, th } from '../ui';

// ── Statements and reports: one screen, month picker at the top (S1–S5) ──────
// Send statements (practice statements subtotal each dentist), billing by
// practice for any month with each dentist underneath, owed vs paid per
// account, and the per-dentist NHS / private split DSOs pay associates from.

/** An invoice split by case: a month invoice covers several cases (and dentists). */
function parts(s: BillingState, inv: Invoice) {
  if (!inv.cases?.length) {
    const net = inv.lines.reduce((n, l) => n + lineNet(l), 0);
    return [{ dentist: inv.dentist, practice: inv.practice, net, nhs: inv.lines.filter(l => l.kind === 'NHS').reduce((n, l) => n + lineNet(l), 0), cases: 1 }];
  }
  return inv.cases.map(id => {
    const ls = inv.lines.filter(l => l.id.startsWith(`${id}:`));
    return { dentist: caseById(id)?.dentist ?? s.cases[id]?.info?.dentist ?? inv.dentist, practice: inv.practice, net: ls.reduce((n, l) => n + lineNet(l), 0), nhs: ls.filter(l => l.kind === 'NHS').reduce((n, l) => n + lineNet(l), 0), cases: 1 };
  });
}

const csv = (rows: (string | number)[][], name: string) => saveBlob(new Blob([rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' }), name);

export default function Statements() {
  const s = useBilling();
  const navigate = useNavigate();
  const readOnly = useReadOnly();
  const months = Array.from({ length: 12 }, (_, i) => { let m = monthOf(today()); for (let k = 0; k < i; k++) m = prevMonth(m); return m; });
  const [ym, setYm] = useState(months[0]);
  const [open, setOpen] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [viewing, setViewing] = useState<Statement | null>(null);

  const issued = useMemo(() => s.invoices.filter(i => i.issuedAt && i.status !== 'void' && monthOf(i.issuedAt) === ym), [s, ym]);
  const byPractice = useMemo(() => {
    const m = new Map<string, { practice: string; cases: number; net: number; nhs: number; dentists: Map<string, { cases: number; net: number; nhs: number }> }>();
    for (const inv of issued) for (const p of parts(s, inv)) {
      const e = m.get(p.practice) ?? { practice: p.practice, cases: 0, net: 0, nhs: 0, dentists: new Map() };
      e.cases += p.cases; e.net += p.net; e.nhs += p.nhs;
      const d = e.dentists.get(p.dentist) ?? { cases: 0, net: 0, nhs: 0 };
      d.cases += p.cases; d.net += p.net; d.nhs += p.nhs; e.dentists.set(p.dentist, d);
      m.set(p.practice, e);
    }
    return [...m.values()].sort((a, b) => b.net - a.net);
  }, [s, issued]);
  const dentists = useMemo(() => {
    const m = new Map<string, { practices: Set<string>; cases: number; net: number; nhs: number }>();
    for (const p of byPractice) for (const [d, v] of p.dentists) { const e = m.get(d) ?? { practices: new Set(), cases: 0, net: 0, nhs: 0 }; e.practices.add(p.practice); e.cases += v.cases; e.net += v.net; e.nhs += v.nhs; m.set(d, e); }
    return [...m].sort((a, b) => b[1].net - a[1].net);
  }, [byPractice]);
  const accounts = billingAccounts(s).map(a => {
    const inv = s.invoices.filter(i => i.accountId === a.id && i.status !== 'void');
    const billed = round2(inv.filter(i => i.issuedAt && monthOf(i.issuedAt) === ym).reduce((n, i) => n + totals(i).gross, 0));
    const paidIn = round2(inv.flatMap(i => i.payments).filter(p => monthOf(p.at) === ym).reduce((n, p) => n + p.amount, 0));
    const owed = round2(inv.reduce((n, i) => n + outstanding(i), 0) + s.xeroOnly.filter(x => x.accountId === a.id).reduce((n, x) => n + (x.amount - x.paid), 0));
    const overdue = round2(inv.filter(i => isOverdue(i)).reduce((n, i) => n + outstanding(i), 0));
    return { a, billed, paidIn, owed, overdue };
  }).filter(r => r.billed || r.paidIn || r.owed).sort((x, y) => y.owed - x.owed);

  const current = ym === months[0];
  const sent = s.statements.filter(x => x.period === ym && x.status === 'sent');
  const total = byPractice.reduce((n, p) => n + p.net, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#030213]">Month
          <select value={ym} onChange={e => { setYm(e.target.value); setOpen([]); }} className="px-2.5 py-1.5 rounded-lg border border-[#E0E0E6] text-sm bg-white">
            {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
        </label>
        <span className="text-xs text-[#717182]">{money(total, 'GBP', { round: true })} invoiced (net) · {pl(byPractice.reduce((n, p) => n + p.cases, 0), 'case')} · {pl(byPractice.length, 'practice')}</span>
      </div>

      <Card title="Statements" sub={current ? `One per paying account. Practices list each dentist's share. Statement day ${fmtDate(statementDay(s))}.` : `As at the end of ${fmtMonth(ym)}.`}
        actions={<>
          {sent.length > 0 && <Pill tone="green">{pl(sent.length, 'statement')} sent</Pill>}
          {!readOnly && current && <button className={btnPrimary} onClick={() => { previewStatements(ym); setSending(true); }}><Send className="w-3.5 h-3.5" /> Preview & send statements</button>}
        </>}>
        <div className="flex flex-wrap gap-2">
          {billingAccounts(s).map(a => {
            const st = s.statements.find(x => x.accountId === a.id && x.period === ym) ?? buildStatement(s, a.id, ym);
            if (!st.invoices.length && Math.abs(st.opening) < 0.005 && !st.payments.length) return null;
            return <button key={a.id} onClick={() => setViewing(st)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E0E0E6] bg-white text-xs hover:bg-[#F8F9FC]"><Eye className="w-3 h-3 text-[#717182]" /> {a.name} <span className="text-[#717182]">{money(st.closing, st.currency, { round: true })}</span></button>;
          })}
        </div>
      </Card>

      <Card title="Billing by practice" sub="Click a practice to see each dentist." pad={false}
        actions={<button className={btn} onClick={() => csv([['Practice', 'Dentist', 'Cases', 'Net', 'NHS', 'Private'], ...byPractice.flatMap(p => [...p.dentists].map(([d, v]) => [p.practice, d, v.cases, v.net.toFixed(2), v.nhs.toFixed(2), (v.net - v.nhs).toFixed(2)]))], `billing-by-practice-${ym}.csv`)}><Download className="w-3.5 h-3.5" /> Export</button>}>
        {byPractice.length === 0 ? <Empty>Nothing invoiced in {fmtMonth(ym)}.</Empty> : (
          <table className="w-full">
            <thead><tr><th className={th}>Practice</th><th className={`${th} text-right`}>Cases</th><th className={`${th} text-right`}>NHS</th><th className={`${th} text-right`}>Private</th><th className={`${th} text-right`}>Invoiced (net)</th></tr></thead>
            <tbody>
              {byPractice.map(p => {
                const isOpen = open.includes(p.practice);
                return (
                  <Fragment key={p.practice}>
                    <tr className="cursor-pointer hover:bg-[#FAFAFD]" onClick={() => setOpen(o => isOpen ? o.filter(x => x !== p.practice) : [...o, p.practice])}>
                      <td className={`${td} font-semibold`}>{isOpen ? <ChevronDown className="w-3.5 h-3.5 inline mr-1" /> : <ChevronRight className="w-3.5 h-3.5 inline mr-1" />}{p.practice} <span className="font-normal text-[#717182]">· {pl(p.dentists.size, 'dentist')}</span></td>
                      <td className={`${td} text-right`}>{p.cases}</td>
                      <td className={`${td} text-right`}>{money(p.nhs)}</td>
                      <td className={`${td} text-right`}>{money(p.net - p.nhs)}</td>
                      <td className={`${td} text-right font-semibold`}>{money(p.net)}</td>
                    </tr>
                    {isOpen && [...p.dentists].sort((a, b) => b[1].net - a[1].net).map(([d, v]) => (
                      <tr key={d} className="bg-[#FAFAFD]">
                        <td className={`${td} pl-9`}>{d}</td>
                        <td className={`${td} text-right`}>{v.cases}</td>
                        <td className={`${td} text-right`}>{money(v.nhs)}</td>
                        <td className={`${td} text-right`}>{money(v.net - v.nhs)}</td>
                        <td className={`${td} text-right`}>{money(v.net)}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Owed vs paid" sub={`Per paying account: invoiced and paid in ${fmtMonth(ym)}, owed today.`} pad={false}>
          {accounts.length === 0 ? <Empty>No activity.</Empty> : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0"><tr><th className={th}>Account</th><th className={`${th} text-right`}>Invoiced</th><th className={`${th} text-right`}>Paid</th><th className={`${th} text-right`}>Owed now</th></tr></thead>
                <tbody>
                  {accounts.map(r => (
                    <tr key={r.a.id} className={readOnly ? '' : 'cursor-pointer hover:bg-[#FAFAFD]'} onClick={() => !readOnly && navigate(`/growth/billing/accounts/${r.a.id}`)}>
                      <td className={td}>{r.a.name}</td>
                      <td className={`${td} text-right`}>{money(r.billed, r.a.currency)}</td>
                      <td className={`${td} text-right text-[#2E7D32]`}>{money(r.paidIn, r.a.currency)}</td>
                      <td className={`${td} text-right`}>{money(r.owed, r.a.currency)}{r.overdue > 0 && <span className="block text-[10px] text-[#C62828]">{money(r.overdue, r.a.currency)} overdue</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Per dentist: NHS and private" sub="For associate pay runs (DSOs). Net of VAT." pad={false}
          actions={<button className={btn} onClick={() => csv([['Dentist', 'Practices', 'Cases', 'NHS', 'Private', 'Total'], ...dentists.map(([d, v]) => [d, [...v.practices].join('; '), v.cases, v.nhs.toFixed(2), (v.net - v.nhs).toFixed(2), v.net.toFixed(2)])], `dentist-nhs-private-${ym}.csv`)}><Download className="w-3.5 h-3.5" /> Export</button>}>
          {dentists.length === 0 ? <Empty>No activity.</Empty> : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0"><tr><th className={th}>Dentist</th><th className={`${th} text-right`}>NHS</th><th className={`${th} text-right`}>Private</th><th className={`${th} text-right`}>Total</th></tr></thead>
                <tbody>
                  {dentists.map(([d, v]) => (
                    <tr key={d}>
                      <td className={td}>{d}<span className="block text-[10px] text-[#717182]">{[...v.practices].join(', ')}</span></td>
                      <td className={`${td} text-right`}>{money(v.nhs)}</td>
                      <td className={`${td} text-right`}>{money(v.net - v.nhs)}</td>
                      <td className={`${td} text-right font-semibold`}>{money(v.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {viewing && (
        <Modal isOpen onClose={() => setViewing(null)} size="lg" title={`${account(s, viewing.accountId)?.name} · ${fmtMonth(viewing.period)}`} footer={
          <div className="flex justify-end gap-2"><button className={btn} onClick={() => printPages([{ key: viewing.id, node: <StatementDoc st={viewing} acc={account(s, viewing.accountId)} /> }], 'Statement')}><Printer className="w-3.5 h-3.5" /> Print / PDF</button><button className={btnPrimary} onClick={() => setViewing(null)}>Close</button></div>
        }>
          <div className="border border-[#E0E0E6] rounded-xl p-5 max-h-[520px] overflow-y-auto"><StatementDoc st={viewing} acc={account(s, viewing.accountId)} /></div>
        </Modal>
      )}
      {sending && <SendModal s={s} ym={ym} onClose={() => setSending(false)} />}
    </div>
  );
}

function SendModal({ s, ym, onClose }: { s: BillingState; ym: string; onClose: () => void }) {
  const { toast } = useToast();
  const list = s.statements.filter(x => x.period === ym);
  const [open, setOpen] = useState(list[0]?.id);
  const st = list.find(x => x.id === open);
  const toSend = list.filter(x => x.status === 'preview').length;
  return (
    <Modal isOpen onClose={onClose} size="xl" title={`Statements · ${fmtMonth(ym)}`} footer={
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-[#717182]"><Lock className="w-3 h-3 inline -mt-0.5" /> Dentists who pay directly get their own; their cases aren't on the practice's statement.</span>
        <button className={btnPrimary} disabled={!toSend} onClick={() => { const n = sendStatements(ym); toast.success(`${pl(n, 'statement')} sent`); onClose(); }}><Send className="w-3.5 h-3.5" /> Send {toSend} statements</button>
      </div>
    }>
      <div className="flex flex-col md:flex-row gap-4 min-h-[420px]">
        <ul className="md:w-56 flex-shrink-0 space-y-1 max-h-[460px] overflow-y-auto">
          {list.map(x => (
            <li key={x.id}>
              <button onClick={() => setOpen(x.id)} className={`w-full text-left px-2.5 py-2 rounded-lg text-xs ${open === x.id ? 'bg-[#EEF4FF]' : 'hover:bg-[#F8F9FC]'}`}>
                <span className="block font-semibold text-[#030213] truncate">{account(s, x.accountId)?.name}</span>
                <span className="text-[#717182]">{money(x.closing, x.currency)} · {x.status === 'sent' ? 'sent' : 'ready'}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex-1 min-w-0 border border-[#E0E0E6] rounded-xl p-5 overflow-y-auto max-h-[460px]">{st ? <StatementDoc st={st} acc={account(s, st.accountId)} /> : <Empty>No statements.</Empty>}</div>
      </div>
    </Modal>
  );
}
