import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Download, FileText, Mail, MessageSquarePlus, Plus, Search, Send, UserPlus, X } from 'lucide-react';
import { useToast } from '../../../src/app/context/ToastContext';
import { saveBlob } from '../../bulk-actions/zip';
import { printPages } from '../../bulk-actions/printForms';
import Modal from '../../../src/app/components/Modal';
import type { BillingAccount, BillingState, Invoice, Statement } from '../types';
import { account, billingCases, covers, dentistAccountId, isOverdue, lineNet, outstanding, termsLabel, toolName, totals } from '../engine';
import { fmtDate, fmtMonth, fmtShort, money, monthOf, pl, prevMonth, round2, today } from '../format';
import { addAccountNote, archiveInvoices, linkDentist, setInvoiceMode, setPayer, unlinkDentist, updateAccount, useBilling } from '../billingStore';
import { REPORTS, toCsv } from '../insights';
import { dentistRows, HEALTH_TONE, practiceDetail, practiceRows, whoToCall, type Health } from '../labInsights';
import { StatementDoc } from '../BillingDocs';
import { useReadOnly } from '../BillingApp';
import { btn, btnPrimary, Card, Empty, Field, input, inputSm, Note, Pill, Seg, td, th, Toggle } from '../ui';
import { ConfirmPracticeModal, dentistUrl, Hint, invoiceUrl, overdueBy, owedBy, plainStatus, practiceUrl, SendInvoicesModal, SendStatementModal, setupLine, unconfirmed } from './shared';
import PricesTab from './PricesTab';

// ── V1 Practices: accounts and insights in one place ──────────────────────────
// The list answers "who owes, who's slipping, who's new". Each practice (and
// each dentist) has one page: the numbers, Send statement / Send invoices,
// their invoices and statements, dentists, their own prices, and setup.
// Practices that arrived with a scan show apart until someone confirms them.

const gbp = (n: number) => money(n, 'GBP', { round: true });
const csv = (rows: (string | number)[][], name: string) => saveBlob(new Blob([rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' }), name);
const Status = ({ h }: { h: Health }) => <Pill tone={HEALTH_TONE[h]}>{h}</Pill>;
function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return <svg width="64" height="18" viewBox="0 0 64 18" role="img" aria-label="Six-month trend"><polyline fill="none" stroke="#4D8EF7" strokeWidth="1.5" points={values.map((v, i) => `${i * 12.4 + 1},${17 - (v / max) * 15}`).join(' ')} /></svg>;
}
const HEALTH_HELP = 'Compared with its own last three months: Growing (25% more), Slowing (25% less), Gone quiet (no case for twice the usual gap), New (first case in the last 60 days).';

type Filter = 'all' | 'owe' | 'overdue' | 'slipping' | 'monthly';

export function PracticesList() {
  const s = useBilling();
  const navigate = useNavigate();
  const readOnly = useReadOnly();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'dentists' ? 'dentists' : 'practices';
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [confirming, setConfirming] = useState<BillingAccount | null>(null);
  const [menu, setMenu] = useState(false);
  const rows = useMemo(() => practiceRows(s), [s]);
  const dRows = useMemo(() => dentistRows(s), [s]);
  const fresh = unconfirmed(s);
  const calls = useMemo(() => whoToCall(s).slice(0, 3), [s]);

  const list = rows.filter(r => {
    const a = r.accountId ? account(s, r.accountId) : undefined;
    if (a?.fromScan && !a.confirmedAt) return false;
    if (q && !r.practice.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'owe') return r.owed > 0.005;
    if (filter === 'overdue') return r.accountId ? overdueBy(s, r.accountId) > 0.005 : false;
    if (filter === 'slipping') return r.status === 'Slowing' || r.status === 'Gone quiet';
    if (filter === 'monthly') return a?.invoiceMode === 'month-end';
    return true;
  });
  const dList = dRows.filter(r => !q || `${r.dentist} ${r.practices.join(' ')}`.toLowerCase().includes(q.toLowerCase())).filter(r => filter !== 'slipping' || r.status === 'Slowing' || r.status === 'Gone quiet');

  const downloads: [string, () => void][] = [
    [view === 'practices' ? 'This list of practices' : 'This list of dentists', () => view === 'practices'
      ? csv([['Practice', 'Status', 'This month', 'Usual a month', 'Owed', 'Overdue', 'Pays in (days)', 'Last case'], ...list.map(r => [r.practice, r.status, r.thisMonth, r.avg, r.owed, r.accountId ? round2(overdueBy(s, r.accountId)) : 0, r.daysToPay != null ? Math.round(r.daysToPay) : '', r.lastCase ?? ''])], `practices-${today()}.csv`)
      : csv([['Dentist', 'Status', 'Practices', 'Usual a month', 'Avg case', 'Top products', 'Scanner', 'On time %', 'Remakes %', 'Last case'], ...dList.map(r => [r.dentist, r.status, r.practices.join('; '), r.avg, r.avgCaseValue, r.topProducts.join('; '), r.scanner ?? '', r.onTimePct != null ? Math.round(r.onTimePct * 100) : '', r.remakeRate != null ? round2(r.remakeRate * 100) : '', r.lastCase ?? ''])], `dentists-${today()}.csv`)],
    ['Billing by practice and dentist, last month (NHS / private)', () => byDentistCsv(s, prevMonth(monthOf(today())))],
    ...REPORTS.filter(r => ['unbilled', 'given-away', 'remakes', 'cash'].includes(r.id)).map(r => {
      const rep = r.fn(s, { from: `${prevMonth(prevMonth(monthOf(today())))}-01`, to: today(), department: 'all', account: 'all' });
      return [`${rep.title} (3 months)`, () => saveBlob(new Blob([toCsv(rep)], { type: 'text/csv' }), `${r.id}-${today()}.csv`)] as [string, () => void];
    }),
  ];

  return (
    <div className="space-y-4">
      {!readOnly && fresh.length > 0 && (
        <Card title={<span className="inline-flex items-center gap-2"><UserPlus className="w-4 h-4 text-[#4D8EF7]" /> New from scans <Pill tone="blue">{fresh.length}</Pill></span>} sub="Added from a scan so the case isn't held up. Confirm who to bill and its invoices go out.">
          <ul className="divide-y divide-[#F0EFF6]">
            {fresh.map(a => {
              const waiting = s.invoices.filter(i => i.accountId === a.id && (i.status === 'draft' || i.status === 'flagged'));
              const who = [...new Set(Object.values(s.cases).filter(m => m.accountId === a.id).map(m => m.info?.dentist ?? billingCases().find(c => c.id === m.caseId)?.dentist).filter(Boolean))];
              return (
                <li key={a.id} className="py-2.5 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]"><button className="text-sm font-semibold hover:underline" onClick={() => navigate(practiceUrl(a.id))}>{a.name}</button><p className="text-xs text-[#717182]">From {who.join(', ') || 'a dentist'} · {pl(waiting.length, 'invoice')} waiting{waiting.length ? `, ${money(waiting.reduce((n, i) => n + totals(i).gross, 0))}` : ''}</p></div>
                  <button className={btnPrimary} onClick={() => setConfirming(a)}>Check and confirm</button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {!readOnly && calls.length > 0 && (
        <Card title="Worth a call" sub="Sending less than usual, most money first. Open one to see why and add a note.">
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {calls.map(c => (
              <li key={c.kind + c.name}>
                <button className="w-full text-left rounded-xl border border-[#F0EFF6] px-3 py-2.5 hover:border-[#C7DAFF]" onClick={() => navigate(c.kind === 'Practice' && c.accountId ? practiceUrl(c.accountId) : dentistUrl(c.name))}>
                  <p className="text-sm font-semibold text-[#030213] flex items-center gap-2">{c.name} <Status h={c.row.status} /></p>
                  <p className="text-xs text-[#717182] mt-0.5">{c.kind} · usually {gbp(c.row.avg)} a month · last case {fmtShort(c.row.lastCase)}</p>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Seg value={view} onChange={v => setParams(v === 'dentists' ? { view: v } : {}, { replace: true })} options={[{ value: 'practices', label: `Practices (${rows.length - fresh.length})` }, { value: 'dentists', label: `Dentists (${dRows.length})` }]} />
        {(view === 'practices' ? [['all', 'All'], ['owe', 'Owe money'], ['overdue', 'Overdue'], ['slipping', 'Slowing or quiet'], ['monthly', 'Billed monthly']] : [['all', 'All'], ['slipping', 'Slowing or quiet']]).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id as Filter)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === id ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]' : 'border-[#E0E0E6] bg-white text-[#5A5568]'}`}>{label}</button>
        ))}
        <div className="flex-1" />
        <div className="relative"><Search className="w-3.5 h-3.5 text-[#A0A0B0] absolute left-2.5 top-1/2 -translate-y-1/2" /><input value={q} onChange={e => setQ(e.target.value)} placeholder={view === 'practices' ? 'Find a practice…' : 'Find a dentist…'} className="pl-8 pr-3 py-1.5 rounded-lg border border-[#E0E0E6] text-xs w-52" /></div>
        <div className="relative">
          <button className={btn} onClick={() => setMenu(m => !m)}><Download className="w-3.5 h-3.5" /> Download <ChevronDown className="w-3 h-3" /></button>
          {menu && (
            <div className="absolute right-0 mt-1 w-80 bg-white border border-[#E0E0E6] rounded-xl shadow-lg z-20 py-1" onMouseLeave={() => setMenu(false)}>
              {downloads.map(([label, fn]) => <button key={label} className="block w-full text-left px-3 py-2 text-xs hover:bg-[#F8F9FC]" onClick={() => { fn(); setMenu(false); }}>{label}</button>)}
            </div>
          )}
        </div>
      </div>

      {view === 'practices' ? (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead><tr><th className={th}>Practice</th><th className={th} title={HEALTH_HELP}>How it's going ⓘ</th><th className={`${th} text-right`}>This month</th><th className={`${th} text-right`}>Owed</th><th className={th}>Pays in</th><th className={th}>Last case</th></tr></thead>
              <tbody>
                {list.map(r => {
                  const a = r.accountId ? account(s, r.accountId) : undefined;
                  const od = r.accountId ? overdueBy(s, r.accountId) : 0;
                  return (
                    <tr key={r.practice} className="cursor-pointer hover:bg-[#FAFAFD]" onClick={() => r.accountId && navigate(practiceUrl(r.accountId))}>
                      <td className={td}>
                        <span className="font-semibold">{r.practice}</span>
                        <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">
                          {a?.invoiceMode === 'month-end' && <Pill tone="blue">Monthly</Pill>}
                          {a?.priceListId && <Pill tone="gray">Own prices</Pill>}
                          {a && a.currency !== 'GBP' && <Pill tone="gray">{a.currency}</Pill>}
                        </span>
                        <span className="block text-[11px] text-[#717182]">{pl(r.dentistsActive, 'dentist')} active</span>
                      </td>
                      <td className={td}><span className="inline-flex items-center gap-2"><Status h={r.status} /><Spark values={r.trend} /></span></td>
                      <td className={`${td} text-right`}>{gbp(r.thisMonth)}<span className="block text-[11px] text-[#717182]">usually {gbp(r.avg)}</span></td>
                      <td className={`${td} text-right`}>{r.owed > 0.005 ? gbp(r.owed) : '—'}{od > 0.005 && <span className="block text-[11px] text-[#C62828] font-semibold">{gbp(od)} overdue</span>}</td>
                      <td className={td}>{r.daysToPay != null ? <span className={r.slow ? 'text-[#C62828] font-semibold' : ''}>{Math.round(r.daysToPay)} days{r.slow ? ' · slow' : ''}</span> : '—'}</td>
                      <td className={td}>{fmtShort(r.lastCase)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!list.length && <Empty>No practices match.</Empty>}
          </div>
        </Card>
      ) : (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead><tr><th className={th}>Dentist</th><th className={th} title={HEALTH_HELP}>How it's going ⓘ</th><th className={`${th} text-right`}>Usual a month</th><th className={`${th} text-right`}>Avg case</th><th className={th}>Sends most</th><th className={th}>Who pays</th><th className={th}>Last case</th></tr></thead>
              <tbody>
                {dList.map(r => {
                  const a = account(s, dentistAccountId(r.dentist));
                  return (
                    <tr key={r.dentist} className="cursor-pointer hover:bg-[#FAFAFD]" onClick={() => navigate(dentistUrl(r.dentist))}>
                      <td className={td}><span className="font-semibold">{r.dentist}</span><span className="block text-[11px] text-[#717182]">{r.practices.join(', ')}</span></td>
                      <td className={td}><span className="inline-flex items-center gap-2"><Status h={r.status} /><Spark values={r.trend} /></span></td>
                      <td className={`${td} text-right`}>{gbp(r.avg)}</td>
                      <td className={`${td} text-right`}>{gbp(r.avgCaseValue)}</td>
                      <td className={td}>{r.topProducts.join(', ')}</td>
                      <td className={td}>{a?.payer === 'dentist' ? <Pill tone="blue">Pays directly</Pill> : <span className="text-[#717182]">The practice</span>}</td>
                      <td className={td}>{fmtShort(r.lastCase)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!dList.length && <Empty>No dentists match.</Empty>}
          </div>
        </Card>
      )}
      <Hint>Open a practice to send its statement or chosen invoices, give it its own prices, or bill it once a month. Dentists who pay for their own cases have a page too.</Hint>
      {confirming && <ConfirmPracticeModal a={confirming} onClose={() => setConfirming(null)} />}
    </div>
  );
}

/** Billing by practice and dentist for a month, NHS / private split (DSOs pay associates from it). */
function byDentistCsv(s: BillingState, ym: string) {
  const rows: (string | number)[][] = [['Practice', 'Dentist', 'Cases', 'Billed', 'NHS', 'Private']];
  const m = new Map<string, { cases: number; net: number; nhs: number }>();
  for (const inv of s.invoices.filter(i => i.issuedAt && i.status !== 'void' && monthOf(i.issuedAt) === ym)) {
    const groups = inv.cases?.length ? inv.cases.map(id => ({ d: billingCases().find(c => c.id === id)?.dentist ?? inv.dentist, ls: inv.lines.filter(l => l.id.startsWith(`${id}:`)) })) : [{ d: inv.dentist, ls: inv.lines }];
    for (const g of groups) {
      const k = `${inv.practice}|${g.d}`; const e = m.get(k) ?? { cases: 0, net: 0, nhs: 0 };
      e.cases++; e.net += g.ls.reduce((n, l) => n + lineNet(l), 0); e.nhs += g.ls.filter(l => l.kind === 'NHS').reduce((n, l) => n + lineNet(l), 0); m.set(k, e);
    }
  }
  [...m].sort().forEach(([k, v]) => { const [p, d] = k.split('|'); rows.push([p, d, v.cases, round2(v.net), round2(v.nhs), round2(v.net - v.nhs)]); });
  csv(rows, `billing-by-dentist-${ym}.csv`);
}

// ── One practice ──────────────────────────────────────────────────────────────

type PTab = 'overview' | 'invoices' | 'dentists' | 'prices' | 'setup';

export function PracticePage({ id }: { id: string }) {
  const s = useBilling();
  const navigate = useNavigate();
  const readOnly = useReadOnly();
  const [params, setParams] = useSearchParams();
  const a = account(s, id) ?? s.accounts.find(x => x.name === id);
  const [modal, setModal] = useState<null | 'statement' | 'invoices' | 'confirm' | 'note'>(null);
  if (!a) return <Card><Empty>Practice not found. <button className="text-[#4D8EF7]" onClick={() => navigate('/growth/billing/practices')}>All practices</button></Empty></Card>;
  if (a.kind === 'dentist') return <DentistPage name={a.name} />;
  const row = practiceRows(s).find(r => r.accountId === a.id);
  const tab = (['overview', 'invoices', 'dentists', 'prices', 'setup'].includes(params.get('tab') ?? '') ? params.get('tab') : 'overview') as PTab;
  const TABS: [PTab, string][] = readOnly ? [['overview', 'Overview'], ['invoices', 'Invoices & statements']] : [['overview', 'Overview'], ['invoices', 'Invoices & statements'], ['dentists', 'Dentists'], ['prices', a.priceListId ? 'Prices · their own' : 'Prices'], ['setup', 'Setup']];
  const owed = owedBy(s, a.id), od = overdueBy(s, a.id);
  const isNew = a.fromScan && !a.confirmedAt;
  const invs = s.invoices.filter(i => i.accountId === a.id);
  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/growth/billing/practices')} className="inline-flex items-center gap-1 text-xs text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-3.5 h-3.5" /> Practices</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-[#030213]">{a.name}</h2>
            {isNew ? <Pill tone="blue">New from a scan</Pill> : row && <Status h={row.status} />}
            {row?.slow && <Pill tone="red">Pays slowly</Pill>}
            {a.paused && s.settings.limitsOn && <Pill tone="red">On hold</Pill>}
          </div>
          <p className="text-xs text-[#717182] mt-1">{setupLine(s, a)}{!readOnly && <> · <button className="text-[#4D8EF7] font-semibold hover:underline" onClick={() => setParams({ tab: 'setup' })}>Change</button></>}</p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <button className={btnPrimary} onClick={() => setModal('statement')}><Send className="w-3.5 h-3.5" /> Send statement</button>
            <button className={btn} onClick={() => setModal('invoices')}><Mail className="w-3.5 h-3.5" /> Send invoices</button>
            <button className={btn} onClick={() => setModal('note')}><MessageSquarePlus className="w-3.5 h-3.5" /> Add a note</button>
          </div>
        )}
      </div>
      {isNew && !readOnly && <Note tone="amber">Arrived with a scan; nobody has checked who to bill yet. <button className="font-semibold underline" onClick={() => setModal('confirm')}>Check and confirm</button>, and its waiting invoices go out.</Note>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Mini label="Owes you" value={gbp(owed)} sub={od > 0.005 ? <span className="text-[#C62828] font-semibold">{gbp(od)} overdue</span> : 'Nothing overdue'} />
        <Mini label="This month" value={gbp(row?.thisMonth ?? 0)} sub={`Usually ${gbp(row?.avg ?? 0)} a month`} />
        <Mini label="Pays in" value={row?.daysToPay != null ? `${Math.round(row.daysToPay)} days` : '—'} sub={`Terms: ${termsLabel(s, a)}`} />
        <Mini label="Dentists" value={String(row?.dentistsTotal ?? 0)} sub={`${row?.dentistsActive ?? 0} sent work in 90 days`} />
      </div>

      <nav className="flex gap-1 border-b border-[#F0EFF6] overflow-x-auto">
        {TABS.map(([t, label]) => <button key={t} onClick={() => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })} className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap ${tab === t ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'}`}>{label}</button>)}
      </nav>

      {tab === 'overview' && <Overview a={a} />}
      {tab === 'invoices' && <InvoicesAndStatements a={a} invs={invs} />}
      {tab === 'dentists' && <DentistsHere a={a} />}
      {tab === 'prices' && <PricesTab a={a} />}
      {tab === 'setup' && <Setup a={a} />}

      {modal === 'statement' && <SendStatementModal a={a} onClose={() => setModal(null)} />}
      {modal === 'invoices' && <SendInvoicesModal invoices={invs} to={a.emails} title={`Send invoices to ${a.name}`} onClose={() => setModal(null)} />}
      {modal === 'confirm' && <ConfirmPracticeModal a={a} onClose={() => setModal(null)} />}
      {modal === 'note' && <NoteModal a={a} onClose={() => setModal(null)} />}
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return <div className="bg-white border border-[#E0E0E6] rounded-xl px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-[#717182]">{label}</p><p className="text-lg font-semibold text-[#030213]">{value}</p><p className="text-[11px] text-[#717182]">{sub}</p></div>;
}

function NoteModal({ a, onClose }: { a: BillingAccount; onClose: () => void }) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  return (
    <Modal isOpen onClose={onClose} title={`Note on ${a.name}`} footer={<div className="flex justify-end gap-2"><button className={btnPrimary} disabled={!text.trim()} onClick={() => { addAccountNote(a.id, text); toast.success('Note saved'); onClose(); }}>Save</button></div>}>
      <textarea className={input} rows={4} autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Called Sarah: new associate starting in March, expect more crowns" />
    </Modal>
  );
}

function Overview({ a }: { a: BillingAccount }) {
  const s = useBilling();
  const d = useMemo(() => practiceDetail(s, a.name), [s, a.name]);
  const max = Math.max(1, ...d.bars.map(b => b.value));
  const mixMax = Math.max(1, ...d.mix.map(m => m.value));
  const payments = s.invoices.filter(i => i.accountId === a.id).flatMap(i => i.payments.map(p => ({ ...p, number: i.number }))).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 5);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <Card title="Last 12 months" sub="Value of the cases they sent each month.">
          <div className="flex items-end gap-1.5 h-32" role="img" aria-label={`Monthly value for ${a.name}`}>
            {d.bars.map(b => (
              <div key={b.ym} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                <span className="text-[9px] text-[#717182]">{b.value ? gbp(b.value) : ''}</span>
                <div className="w-full rounded-t bg-gradient-to-t from-[#4D8EF7] to-[#A59DFF]" style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value ? 2 : 0 }} />
                <span className="text-[10px] text-[#717182]">{fmtMonth(b.ym).slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="What they send">
          {d.mix.length ? <ul className="space-y-1.5">{d.mix.map(m => <li key={m.item} className="text-xs"><div className="flex justify-between"><span>{m.item}</span><span className="text-[#717182]">{gbp(m.value)}</span></div><div className="h-1.5 rounded-full bg-[#F3F3F5] mt-0.5"><div className="h-full rounded-full bg-[#7C6BFF]" style={{ width: `${(m.value / mixMax) * 100}%` }} /></div></li>)}</ul> : <p className="text-xs text-[#A0A0B0]">Nothing yet.</p>}
        </Card>
      </div>
      <div className="space-y-4">
        <Card title="Notes">
          {a.notes?.length ? <ul className="space-y-1.5">{a.notes.map((n, i) => <li key={i} className="text-xs"><span className="text-[#A0A0B0]">{fmtShort(n.at)} · {n.by}:</span> {n.text}</li>)}</ul> : <p className="text-xs text-[#A0A0B0]">No notes yet. Add one after a call.</p>}
        </Card>
        <Card title="Recent payments">
          {payments.length ? <ul className="space-y-1 text-xs">{payments.map(p => <li key={p.id} className="flex justify-between"><span>{fmtShort(p.at)} · {p.number}</span><span className="text-[#2E7D32]">{money(p.amount, a.currency)}</span></li>)}</ul> : <p className="text-xs text-[#A0A0B0]">No payments yet.</p>}
        </Card>
      </div>
    </div>
  );
}

function InvoicesAndStatements({ a, invs }: { a: BillingAccount; invs: Invoice[] }) {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const readOnly = useReadOnly();
  const [ticked, setTicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [viewing, setViewing] = useState<Statement | null>(null);
  const [showAll, setShowAll] = useState(false);
  const list = invs.filter(i => showAll || (!i.archived && i.status !== 'void')).sort((x, y) => (y.issuedAt ?? y.createdAt).localeCompare(x.issuedAt ?? x.createdAt));
  const old = s.xeroOnly.filter(x => x.accountId === a.id && x.amount > x.paid);
  const sts = s.statements.filter(x => x.accountId === a.id).sort((x, y) => y.period.localeCompare(x.period));
  const sel = list.filter(i => ticked.includes(i.id));
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Card className="xl:col-span-2" title="Invoices" sub="Tick some to send them again, to the practice or anyone." pad={false}
        actions={!readOnly && ticked.length ? <>
          <button className={btnPrimary} onClick={() => setSending(true)}><Mail className="w-3.5 h-3.5" /> Send {ticked.length}</button>
          {sel.some(i => i.status === 'paid') && <button className={btn} onClick={() => { const n = archiveInvoices(sel.filter(i => i.status === 'paid').map(i => i.id)); toast.success(`${pl(n, 'invoice')} archived`); setTicked([]); }}>Archive paid</button>}
        </> : <button className="text-[11px] text-[#4D8EF7] font-semibold" onClick={() => setShowAll(x => !x)}>{showAll ? 'Hide archived' : 'Show archived'}</button>}>
        {list.length === 0 && !old.length ? <Empty>No invoices yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead><tr>{!readOnly && <th className={th} />}<th className={th}>Invoice</th><th className={th}>For</th><th className={th}>Date</th><th className={th}>Status</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}>Owed</th></tr></thead>
              <tbody>
                {list.map(i => (
                  <tr key={i.id} className="cursor-pointer hover:bg-[#FAFAFD]" onClick={() => navigate(invoiceUrl(i.id))}>
                    {!readOnly && <td className={td} onClick={e => e.stopPropagation()}>{i.number && <input type="checkbox" checked={ticked.includes(i.id)} onChange={() => setTicked(t => t.includes(i.id) ? t.filter(x => x !== i.id) : [...t, i.id])} aria-label={`Select ${i.number}`} />}</td>}
                    <td className={`${td} font-mono font-semibold`}>{i.number ?? <span className="font-sans text-[#717182]">Not sent</span>}</td>
                    <td className={td}>{i.cases?.length ? `Month invoice · ${pl(i.cases.length, 'case')}` : <>{i.patient} <span className="text-[#717182]">· {i.dentist}</span></>}</td>
                    <td className={td}>{fmtShort(i.issuedAt ?? i.createdAt)}</td>
                    <td className={td}><Pill tone={plainStatus(i) === 'Overdue' ? 'red' : plainStatus(i) === 'Paid' ? 'green' : plainStatus(i) === 'Needs a look' ? 'amber' : 'gray'}>{plainStatus(i)}</Pill></td>
                    <td className={`${td} text-right`}>{money(totals(i).gross, i.currency)}</td>
                    <td className={`${td} text-right ${isOverdue(i) ? 'text-[#C62828] font-semibold' : ''}`}>{i.issuedAt && outstanding(i) > 0 ? money(outstanding(i), i.currency) : '—'}</td>
                  </tr>
                ))}
                {old.map(x => (
                  <tr key={x.number}>{!readOnly && <td className={td} />}<td className={`${td} font-mono`}>{x.number}</td><td className={`${td} text-[#717182]`} colSpan={2}>From your old system ({fmtShort(x.date)})</td><td className={td}><Pill tone={x.due < today() ? 'red' : 'gray'}>{x.due < today() ? 'Overdue' : 'Sent'}</Pill></td><td className={`${td} text-right`}>{money(x.amount, x.currency)}</td><td className={`${td} text-right`}>{money(x.amount - x.paid, x.currency)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Statements" sub="One a month: invoices, payments and what's still owed, with each dentist's share.">
        {sts.length === 0 ? <p className="text-xs text-[#A0A0B0]">None yet.</p> : (
          <ul className="divide-y divide-[#F0EFF6]">
            {sts.map(x => (
              <li key={x.id} className="flex items-center justify-between py-2 text-xs">
                <span>{fmtMonth(x.period)}<span className="block text-[#717182]">{money(x.closing, x.currency)} owed · {x.status === 'sent' ? `sent ${fmtShort(x.sentAt)}` : 'not sent'}</span></span>
                <button className="text-[#4D8EF7] font-semibold hover:underline" onClick={() => setViewing(x)}>View</button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {sending && <SendInvoicesModal invoices={sel} to={a.emails} title={`Send ${pl(sel.length, 'invoice')} to ${a.name}`} onClose={() => { setSending(false); setTicked([]); }} />}
      {viewing && (
        <Modal isOpen onClose={() => setViewing(null)} size="lg" title={`Statement · ${fmtMonth(viewing.period)}`} footer={<div className="flex justify-end"><button className={btn} onClick={() => printPages([{ key: viewing.id, node: <StatementDoc st={viewing} acc={a} /> }], 'Statement')}><FileText className="w-3.5 h-3.5" /> Print / PDF</button></div>}>
          <StatementDoc st={viewing} acc={a} />
        </Modal>
      )}
    </div>
  );
}

function DentistsHere({ a }: { a: BillingAccount }) {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const d = useMemo(() => practiceDetail(s, a.name), [s, a.name]);
  const [adding, setAdding] = useState('');
  const linked = s.accounts.filter(x => x.kind === 'dentist' && (x.practices ?? []).includes(a.name));
  const names = [...new Set([...d.dentists.map(x => x.dentist), ...linked.map(x => x.name)])];
  return (
    <Card title="Dentists here" sub="The practice pays unless a dentist pays directly. Each dentist has their own status." pad={false}>
      <table className="w-full">
        <thead><tr><th className={th}>Dentist</th><th className={th}>How it's going</th><th className={`${th} text-right`}>Usual a month</th><th className={th}>Last case</th><th className={th}>Who pays</th><th className={th} /></tr></thead>
        <tbody>
          {names.map(n => {
            const h = d.dentists.find(x => x.dentist === n);
            const acc = account(s, dentistAccountId(n));
            return (
              <tr key={n}>
                <td className={td}><button className="font-semibold hover:underline" onClick={() => navigate(dentistUrl(n))}>{n}</button>{(acc?.practices?.length ?? 0) > 1 && <span className="block text-[10px] text-[#7C3AED]">Also at {acc!.practices!.filter(p => p !== a.name).join(', ')}</span>}</td>
                <td className={td}>{h ? <span className="inline-flex items-center gap-2"><Status h={h.status} /><Spark values={h.trend} /></span> : '—'}</td>
                <td className={`${td} text-right`}>{h ? gbp(h.avg) : '—'}</td>
                <td className={td}>{fmtShort(h?.lastCase)}</td>
                <td className={td}>
                  <select className={inputSm} value={acc?.payer ?? 'practice'} onChange={e => { if (!acc) linkDentist(a.name, n); setPayer(n, e.target.value as 'practice' | 'dentist'); toast.success(e.target.value === 'dentist' ? `${n} now pays directly: own invoices and statement` : `${n}'s cases go back on ${a.name}'s invoices`); }}>
                    <option value="practice">{a.name.replace(/^Smile Genius /, '')} pays</option><option value="dentist">Pays directly</option>
                  </select>
                </td>
                <td className={`${td} text-right`}>{acc && <button title={`Not at ${a.name} any more`} className="text-[#A0A0B0] hover:text-[#C62828]" onClick={() => { unlinkDentist(a.name, n); toast.success(`${n} removed from ${a.name}`); }}><X className="w-3.5 h-3.5" /></button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex gap-1.5 px-4 py-3 border-t border-[#F0EFF6]">
        <input className={`${inputSm} flex-1`} value={adding} onChange={e => setAdding(e.target.value)} placeholder="Add a dentist who works here…" />
        <button className={btn} disabled={!adding.trim()} onClick={() => { linkDentist(a.name, adding); toast.success(`${adding.trim()} added`); setAdding(''); }}><Plus className="w-3 h-3" /> Add</button>
      </div>
      <p className="px-4 pb-3 text-[11px] text-[#717182]">Changing who pays moves cases that aren't invoiced yet. Invoices already sent stay where they are.</p>
    </Card>
  );
}

function Setup({ a }: { a: BillingAccount }) {
  const s = useBilling();
  const { toast } = useToast();
  const [emails, setEmails] = useState(a.emails.join(', '));
  const [terms, setTerms] = useState(a.termsDays ? String(a.termsDays) : '');
  const [reception, setReception] = useState(a.receptionEmail ?? '');
  const [more, setMore] = useState(false);
  const [limit, setLimit] = useState(a.limit?.amount ? String(a.limit.amount) : '');
  const tool = toolName(s);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card title="Billing">
        <div className="space-y-4">
          <Field label="How do they pay?" hint={a.invoiceMode === 'month-end' ? 'Shipped cases collect in Invoices › Ready to invoice; you send one invoice at month end.' : 'An invoice goes out when each case ships.'}>
            <Seg value={a.invoiceMode ?? 'per-case'} onChange={v => { setInvoiceMode(a.id, v); toast.success(v === 'month-end' ? 'Now billed once a month' : 'Now billed per case'); }} options={[{ value: 'per-case', label: 'An invoice per case' }, { value: 'month-end', label: 'One invoice a month' }]} />
          </Field>
          <Field label="Payment terms (days)" hint={`Empty = your usual terms (${termsLabel(s, undefined).toLowerCase()}).`}>
            <div className="flex gap-1.5"><input className={input} type="number" min="0" value={terms} onChange={e => setTerms(e.target.value)} placeholder="Usual terms" /><button className={btn} onClick={() => { updateAccount(a.id, { termsDays: terms ? Number(terms) : null }); toast.success('Saved: new invoices use these terms'); }}>Save</button></div>
          </Field>
          <Field label="Billing email" hint="Invoices and statements go here only. Several? Separate with commas.">
            <div className="flex gap-1.5"><input className={input} value={emails} onChange={e => setEmails(e.target.value)} /><button className={btn} onClick={() => { updateAccount(a.id, { emails: emails.split(/[,;\s]+/).filter(Boolean) }); toast.success('Saved'); }}>Save</button></div>
          </Field>
          {a.bounced?.length ? <Note tone="red">The last email to {a.bounced[0].email} bounced. Fix the address above, then use Send statement.</Note> : null}
        </div>
      </Card>
      <Card title="Updates for reception" sub="Case updates only (received, accepted, delivered). Never invoices.">
        <div className="space-y-3">
          <div className="flex gap-1.5"><input className={input} value={reception} onChange={e => setReception(e.target.value)} placeholder="reception@practice.co.uk" /><button className={btn} onClick={() => { updateAccount(a.id, { receptionEmail: reception.trim() }); toast.success('Saved'); }}>Save</button></div>
          <Toggle on={!!a.receptionUpdates} onChange={v => updateAccount(a.id, { receptionUpdates: v })} label="Email reception as cases move" />
        </div>
      </Card>
      <Card className="xl:col-span-2">
        <button className="w-full flex items-center justify-between text-xs font-semibold text-[#030213]" onClick={() => setMore(m => !m)}>More: currency, statement of manufacture{s.settings.limitsOn ? ', credit limit' : ''}, {tool ?? 'accounting'} contact <ChevronDown className={`w-4 h-4 transition-transform ${more ? 'rotate-180' : ''}`} /></button>
        {more && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Field label="Currency" hint={a.currency !== 'GBP' ? 'Prices convert at the day\'s rate.' : undefined}><select className={input} value={a.currency} onChange={e => { updateAccount(a.id, { currency: e.target.value as BillingAccount['currency'] }); toast.success(`Invoices go out in ${e.target.value}`); }}>{['GBP', 'EUR', 'USD'].map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Statement of manufacture with each invoice"><Seg value={a.som} onChange={v => updateAccount(a.id, { som: v })} options={[{ value: 'inherit', label: `Lab default (${s.settings.som === 'all' ? 'on' : 'off'})` }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} /></Field>
            {s.settings.limitsOn && <Field label={`Credit limit (${a.currency})`} hint="New cases go on hold above it; a payment releases them. Empty = no limit.">
              <div className="flex gap-1.5"><input className={input} type="number" value={limit} onChange={e => setLimit(e.target.value)} placeholder="No limit" /><button className={btn} onClick={() => { updateAccount(a.id, { limit: limit ? { amount: Number(limit), overdueDays: a.limit?.overdueDays ?? null, atLimit: a.limit?.atLimit ?? 'pause', tellPractice: a.limit?.tellPractice ?? false, message: a.limit?.message ?? '' } : null }); toast.success(limit ? 'Limit saved' : 'Limit removed'); }}>Save</button></div>
            </Field>}
            <Field label={`${tool ?? 'Accounting'} contact`}><p className="text-xs text-[#5A5568] py-2">{a.xeroContactName ?? (a.xeroContactId ? a.name : 'Not linked yet: created when the first invoice posts')}</p></Field>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── One dentist ───────────────────────────────────────────────────────────────

export function DentistPage({ name }: { name: string }) {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const readOnly = useReadOnly();
  const [modal, setModal] = useState<null | 'statement' | 'invoices' | 'practice-statement'>(null);
  const row = dentistRows(s).find(r => r.dentist === name);
  const acc = account(s, dentistAccountId(name));
  const practices = [...new Set([...(acc?.practices ?? []), ...(row?.practices ?? [])])];
  const direct = acc?.payer === 'dentist';
  const caseIds = new Set(Object.values(s.cases).filter(m => (billingCases().find(c => c.id === m.caseId)?.dentist ?? m.info?.dentist) === name).map(m => m.caseId));
  const invs = s.invoices.filter(i => i.status !== 'void' && (i.dentist === name || [...caseIds].some(c => covers(i, c)))).sort((x, y) => (y.issuedAt ?? y.createdAt).localeCompare(x.issuedAt ?? x.createdAt));
  const home = practices[0] ? s.accounts.find(x => x.kind === 'practice' && x.name === practices[0]) : undefined;
  if (!row && !acc) return <Card><Empty>Dentist not found. <button className="text-[#4D8EF7]" onClick={() => navigate('/growth/billing/practices?view=dentists')}>All dentists</button></Empty></Card>;
  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/growth/billing/practices?view=dentists')} className="inline-flex items-center gap-1 text-xs text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-3.5 h-3.5" /> Dentists</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold text-[#030213]">{name}</h2>{row && <Status h={row.status} />}{direct && <Pill tone="blue">Pays directly</Pill>}</div>
          <p className="text-xs text-[#717182] mt-1">Works at {practices.map((p, i) => { const pa = s.accounts.find(x => x.kind === 'practice' && x.name === p); return <span key={p}>{i ? ', ' : ''}{pa ? <button className="hover:underline font-semibold text-[#030213]" onClick={() => navigate(practiceUrl(pa.id))}>{p}</button> : p}</span>; })}{direct && acc ? ` · ${setupLine(s, acc)}` : ` · billed through ${practices.length > 1 ? 'each practice' : 'the practice'}`}</p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            {direct && acc ? <button className={btnPrimary} onClick={() => setModal('statement')}><Send className="w-3.5 h-3.5" /> Send statement</button>
              : home && <button className={btn} onClick={() => setModal('practice-statement')} title={`${name}'s cases are on ${home.name}'s statement`}><Send className="w-3.5 h-3.5" /> Send {home.name.replace(/^Smile Genius /, '')}'s statement</button>}
            <button className={direct ? btn : btnPrimary} onClick={() => setModal('invoices')}><Mail className="w-3.5 h-3.5" /> Send their invoices</button>
          </div>
        )}
      </div>
      {!direct && !readOnly && <Hint>{name}'s invoices go to {practices.length > 1 ? 'the practice each case came from' : practices[0] ?? 'the practice'}. Send their invoices to the dentist or the practice any time; switch "Who pays" if {name} should get their own invoices and statement.</Hint>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Mini label="Usual a month" value={gbp(row?.avg ?? 0)} sub={`${gbp(row?.last30 ?? 0)} in the last 30 days`} />
        <Mini label="Average case" value={gbp(row?.avgCaseValue ?? 0)} sub={row?.topProducts.join(', ') || '—'} />
        <Mini label="On time" value={row?.onTimePct != null ? `${Math.round(row.onTimePct * 100)}%` : '—'} sub={row?.remakeRate != null ? `${(row.remakeRate * 100).toFixed(1)}% remakes` : ''} />
        <Mini label="Scanner" value={row?.scanner ?? '—'} sub={`Last case ${fmtShort(row?.lastCase)}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title="Their invoices" pad={false}>
          {invs.length === 0 ? <Empty>No invoices yet.</Empty> : (
            <table className="w-full">
              <thead><tr><th className={th}>Invoice</th><th className={th}>Patient</th><th className={th}>Bill to</th><th className={th}>Status</th><th className={`${th} text-right`}>Amount</th></tr></thead>
              <tbody>{invs.slice(0, 40).map(i => (
                <tr key={i.id} className="cursor-pointer hover:bg-[#FAFAFD]" onClick={() => navigate(invoiceUrl(i.id))}>
                  <td className={`${td} font-mono font-semibold`}>{i.number ?? 'Not sent'}<span className="block font-sans font-normal text-[#717182]">{fmtShort(i.issuedAt ?? i.createdAt)}</span></td>
                  <td className={td}>{i.cases?.length ? `Month invoice (${pl(i.cases.length, 'case')})` : i.patient}</td>
                  <td className={td}>{account(s, i.accountId)?.name}</td>
                  <td className={td}><Pill tone={plainStatus(i) === 'Overdue' ? 'red' : plainStatus(i) === 'Paid' ? 'green' : 'gray'}>{plainStatus(i)}</Pill></td>
                  <td className={`${td} text-right`}>{money(totals(i).gross, i.currency)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        {!readOnly && (
          <Card title="Who pays for their cases?">
            <Seg value={direct ? 'dentist' : 'practice'} onChange={v => { if (!acc && practices[0]) linkDentist(practices[0], name); setPayer(name, v); toast.success(v === 'dentist' ? `${name} now gets their own invoices and statement` : `${name}'s cases go back on the practice invoices`); }} options={[{ value: 'practice', label: 'The practice' }, { value: 'dentist', label: `${name.replace(/^Dr\.? /, 'Dr ')} directly` }]} />
            <p className="text-[11px] text-[#717182] mt-2">{direct ? `Cases stay with the practice for the work and messages; only the bill comes to ${name}. The practice's statement leaves them out.` : 'Most dentists are billed through their practice. Switch only if this dentist pays you themselves.'}</p>
            {direct && acc && <p className="text-[11px] text-[#717182] mt-2">Billing email: {acc.emails.join(', ') || 'none yet'}</p>}
          </Card>
        )}
      </div>

      {modal === 'statement' && acc && <SendStatementModal a={acc} onClose={() => setModal(null)} />}
      {modal === 'practice-statement' && home && <SendStatementModal a={home} onClose={() => setModal(null)} />}
      {modal === 'invoices' && <SendInvoicesModal invoices={invs} to={direct && acc ? acc.emails : acc?.emails.length ? acc.emails : home?.emails ?? []} title={`Send ${name}'s invoices`} onClose={() => setModal(null)} />}
    </div>
  );
}

export { fmtDate };
