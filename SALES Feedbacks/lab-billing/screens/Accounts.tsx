import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, CircleDollarSign, Link2, Mail, PauseCircle, Plus, Search, Trash2, UserRound, Users, X } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import { useToast } from '../../../src/app/context/ToastContext';
import { printPages } from '../../bulk-actions/printForms';
import type { AccountLimit, BillingAccount, BillingState, Currency, Statement } from '../types';
import { account, billingCases, dentistAccountId, dentistWhere, exposure, isOverdue, limitForecast, limitStage, outstanding, practiceAccountId, totals } from '../engine';
import { daysBetween, fmtDate, fmtMonth, fmtShort, money, pl, today } from '../format';
import { addAccount, linkDentist, resendAccountEmail, savePriceList, setDentistPractices, setPayer, simulateAccountPayment, unlinkDentist, updateAccount, useBilling } from '../billingStore';
import { billingAccounts, payHabit } from '../insights';
import { StatementDoc } from '../BillingDocs';
import { Bar, btn, btnPrimary, Card, Empty, Field, input, InvoiceStatusPill, inputSm, Note, Pill, Seg, td, th, Toggle } from '../ui';

// ── 4. Accounts: everything about one billing account ────────────────────────
// A billing account is a practice, or a dentist who pays their own bills.

const STAGE_PILL = { none: null, ok: null, approaching: <Pill tone="amber">Approaching limit</Pill>, at: <Pill tone="red">At limit</Pill>, paused: <Pill tone="red"><PauseCircle className="w-3 h-3" /> On hold</Pill> } as const;

export function AccountsList() {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | 'practice' | 'dentist'>('all');
  const [adding, setAdding] = useState(false);
  const rows = useMemo(() => billingAccounts(s).filter(a => (type === 'all' || a.kind === type) && (!q || a.name.toLowerCase().includes(q.toLowerCase()))).map(a => {
    const ex = exposure(s, a.id);
    const t = today();
    const overdue = s.invoices.filter(i => i.accountId === a.id && isOverdue(i, t)).reduce((n, i) => n + outstanding(i), 0) + s.xeroOnly.filter(x => x.accountId === a.id && x.due < t).reduce((n, x) => n + x.amount - x.paid, 0);
    return { a, ex, overdue, stage: limitStage(s, a, ex), habit: payHabit(s, a.id) };
  }).sort((x, y) => y.ex.unpaid + y.ex.xero - (x.ex.unpaid + x.ex.xero)), [s, q, type]);
  const viaPractice = s.accounts.filter(a => a.kind === 'dentist' && a.payer === 'practice');
  const unlinked = unlinkedDentists(s);
  return (
    <div className="space-y-4">
      <Card
        title="Billing accounts"
        sub="A billing account is a practice, a dentist at one practice who pays their own bills, or a dentist who works across several practices. Invoices, statements, limits and Xero contacts hang off it."
        actions={<>
          <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#A0A0B0]" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search accounts…" className="pl-8 pr-3 py-1.5 rounded-lg border border-[#E0E0E6] text-xs w-48 focus:outline-none focus:border-[#4D8EF7]" /></div>
          <Seg value={type} onChange={setType} options={[{ value: 'all', label: 'All' }, { value: 'practice', label: 'Practices' }, { value: 'dentist', label: 'Dentists paying directly' }]} />
          <button className={btnPrimary} onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5" /> Add account</button>
        </>}
        pad={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead><tr><th className={th}>Account</th><th className={th}>Pays</th><th className={th}>Price list</th><th className={`${th} text-right`}>Owed</th><th className={`${th} text-right`}>Overdue</th><th className={th}>Limit</th><th className={th}>Pays in</th></tr></thead>
            <tbody>
              {rows.map(({ a, ex, overdue, stage, habit }) => (
                <tr key={a.id} onClick={() => navigate(`/growth/billing/accounts/${a.id}`)} className="cursor-pointer hover:bg-[#FAFAFD]">
                  <td className={td}><span className="inline-flex items-center gap-1.5 font-semibold">{a.kind === 'dentist' ? <UserRound className="w-3.5 h-3.5 text-[#7C3AED]" /> : <Building2 className="w-3.5 h-3.5 text-[#4D8EF7]" />}{a.name}</span>{a.currency !== 'GBP' && <Pill tone="blue">{a.currency}</Pill>} {a.bounced?.length ? <Pill tone="red">Email bounced</Pill> : null}{a.kind === 'dentist' && <span className="block text-[11px] text-[#717182] mt-0.5">{dentistWhere(a)}</span>}</td>
                  <td className={td}>{a.kind === 'dentist' ? (a.scope === 'floating' ? 'Dentist directly (floating)' : 'Dentist directly') : 'Practice'}</td>
                  <td className={td}>{a.priceListId ? s.priceLists.find(p => p.id === a.priceListId)?.name : <span className="text-[#717182]">Lab standard</span>}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>{money(ex.unpaid + ex.xero, a.currency)}</td>
                  <td className={`${td} text-right whitespace-nowrap ${overdue ? 'text-[#C62828] font-semibold' : ''}`}>{overdue ? money(overdue, a.currency) : '—'}</td>
                  <td className={td}>{a.limit?.amount ? <div className="w-32"><div className="flex justify-between text-[10px] text-[#717182] mb-0.5"><span>{Math.round(ex.total / a.limit.amount * 100)}%</span><span>{money(a.limit.amount, a.currency, { round: true })}</span></div><Bar pct={ex.total / a.limit.amount * 100} tone={stage === 'ok' ? 'blue' : stage === 'approaching' ? 'amber' : 'red'} /></div> : <span className="text-[#A0A0B0]">None</span>} {STAGE_PILL[stage]}</td>
                  <td className={td}>{habit != null ? `${Math.round(habit)} days` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty>No accounts match.</Empty>}
        </div>
      </Card>

      {unlinked.length > 0 && (
        <Card title={<span className="inline-flex items-center gap-1.5"><Link2 className="w-4 h-4 text-[#B45309]" /> Unlinked dentists <Pill tone="amber">{unlinked.length}</Pill></span>} sub="Dentists sending cases from a practice they aren't linked to yet. Link them so their cases bill to the right account.">
          <ul className="space-y-1.5">
            {unlinked.map(u => (
              <li key={`${u.dentist}|${u.practice}`} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span><b>{u.dentist}</b> · {pl(u.cases, 'case')} from {u.practice}{u.linkedTo.length ? <span className="text-[#717182]"> (linked to {u.linkedTo.join(', ')})</span> : ''}</span>
                <button className={btn} onClick={() => { const n = linkDentist(u.practice, u.dentist); toast.success(`${u.dentist} linked to ${u.practice}${n ? `; ${pl(n, 'case')} moved` : ''}`); }}><Link2 className="w-3 h-3" /> Link to {u.practice.replace(/^Smile Genius /, '')}</button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Dentists billed through their practice" sub="Their cases go on the practice's invoices and statement. Open one to switch them to paying directly or change their practices.">
        <div className="flex flex-wrap gap-2">
          {viaPractice.map(d => <button key={d.id} onClick={() => navigate(`/growth/billing/accounts/${d.id}`)} className={btn}><UserRound className="w-3.5 h-3.5" /> {d.name} <span className="text-[#717182] font-normal">· {dentistWhere(d)}</span></button>)}
        </div>
      </Card>
      {adding && <AddAccountModal onClose={() => setAdding(false)} onAdded={id => navigate(`/growth/billing/accounts/${id}`)} />}
    </div>
  );
}

/** Dentists with cases from a practice they aren't linked to. */
function unlinkedDentists(s: BillingState) {
  const seen = new Map<string, { dentist: string; practice: string; cases: number; linkedTo: string[] }>();
  for (const c of billingCases()) {
    if (!c.dentist || !c.practice) continue;
    const acc = account(s, dentistAccountId(c.dentist));
    const linked = acc?.practices ?? [];
    if (linked.includes(c.practice)) continue;
    const k = `${c.dentist}|${c.practice}`;
    const x = seen.get(k) ?? { dentist: c.dentist, practice: c.practice, cases: 0, linkedTo: linked };
    x.cases++; seen.set(k, x);
  }
  return [...seen.values()].sort((a, b) => b.cases - a.cases);
}

const XERO_CONTACTS = (s: BillingState) => [...new Set([...s.accounts.filter(a => a.xeroContactName).map(a => a.xeroContactName!), 'SG Bristol Dental Ltd', 'Harbour Dental Care', 'Dr Priya Raman', 'Westgate Dental Practice'])].sort();

function AddAccountModal({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const s = useBilling();
  const { toast } = useToast();
  const [kind, setKind] = useState<'practice' | 'single' | 'floating'>('practice');
  const [name, setName] = useState('');
  const [practices, setPractices] = useState<string[]>([]);
  const [payer, setPayer] = useState<'practice' | 'dentist'>('dentist');
  const [emails, setEmails] = useState('');
  const [currency, setCurrency] = useState<Currency>('GBP');
  const [country, setCountry] = useState('United Kingdom');
  const [priceListId, setPriceListId] = useState('');
  const [limit, setLimit] = useState('');
  const [xero, setXero] = useState('__create');
  const [error, setError] = useState('');
  const practiceNames = [...new Set([...s.accounts.filter(a => a.kind === 'practice').map(a => a.name), ...billingCases().map(c => c.practice).filter(Boolean)])].sort();
  const dentistNames = [...new Set([...s.accounts.filter(a => a.kind === 'dentist').map(a => a.name), ...billingCases().map(c => c.dentist).filter(Boolean)])].sort();
  const existingDentist = kind !== 'practice' ? account(s, dentistAccountId(name.trim())) : undefined;
  const pays = kind === 'floating' ? 'dentist' : payer;

  function save() {
    const list = emails.split(/[,;\s]+/).filter(Boolean);
    const r = kind === 'practice'
      ? addAccount({ kind, name, emails: list.length ? list : [`accounts@${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.co.uk`], currency, country, priceListId: priceListId || null, limit: limit ? { amount: Number(limit), overdueDays: null, atLimit: 'notify', tellPractice: false, message: '' } : null, xero: xero === '__create' ? null : xero })
      : addAccount({ kind, name, practices: kind === 'single' ? practices.slice(0, 1) : practices, payer: pays, emails: list, currency, xero: xero === '__create' ? null : xero });
    if (r.error) { setError(r.error); return; }
    toast.success(kind === 'practice' ? `${name} added` : `${name} ${existingDentist ? 'updated' : 'added'}: ${pays === 'dentist' ? 'pays directly' : 'billed through the practice'}`);
    onClose(); onAdded(r.id!);
  }

  return (
    <Modal isOpen onClose={onClose} size="lg" title="Add a billing account" footer={
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[#C62828]">{error}</span>
        <div className="flex gap-2"><button className={btn} onClick={onClose}>Cancel</button><button className={btnPrimary} onClick={save}>{existingDentist ? 'Update dentist' : 'Add account'}</button></div>
      </div>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {([
            ['practice', 'Practice', 'The practice pays for its dentists', Building2],
            ['single', 'Dentist at one practice', 'Works at one practice', UserRound],
            ['floating', 'Dentist across practices', 'Floats between several; pays directly', Users],
          ] as const).map(([k, label, sub, Icon]) => (
            <button key={k} onClick={() => { setKind(k); setError(''); }} className={`text-left rounded-xl border px-3 py-2.5 ${kind === k ? 'border-[#4D8EF7] bg-[#F5F9FF]' : 'border-[#E0E0E6] hover:border-[#C8D8FC]'}`}>
              <Icon className={`w-4 h-4 ${kind === k ? 'text-[#4D8EF7]' : 'text-[#717182]'}`} />
              <p className="text-xs font-semibold text-[#030213] mt-1">{label}</p>
              <p className="text-[11px] text-[#717182]">{sub}</p>
            </button>
          ))}
        </div>

        <Field label={kind === 'practice' ? 'Practice name' : 'Dentist'} hint={kind === 'practice' ? 'Pick a practice that sends cases, or type a new one.' : existingDentist ? `${name.trim()} already has a record (${dentistWhere(existingDentist)}); saving updates it.` : 'Pick a dentist who sends cases, or type a new name.'}>
          <input className={input} list={kind === 'practice' ? 'sf-practices' : 'sf-dentists'} value={name} onChange={e => setName(e.target.value)} placeholder={kind === 'practice' ? 'e.g. Smile Genius York' : 'e.g. Dr. Patel'} />
          <datalist id="sf-practices">{practiceNames.filter(p => !account(s, practiceAccountId(p))).map(p => <option key={p} value={p} />)}</datalist>
          <datalist id="sf-dentists">{dentistNames.map(d => <option key={d} value={d} />)}</datalist>
        </Field>

        {kind !== 'practice' && (
          <Field label={kind === 'single' ? 'Practice' : 'Practices they work at'} hint={kind === 'floating' ? 'Cases from these practices bill to the dentist; cases from any other practice bill to that practice.' : undefined}>
            {kind === 'single'
              ? <select className={input} value={practices[0] ?? ''} onChange={e => setPractices(e.target.value ? [e.target.value] : [])}><option value="">Pick the practice…</option>{practiceNames.map(p => <option key={p}>{p}</option>)}</select>
              : <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto rounded-lg border border-[#E0E0E6] p-2">{practiceNames.map(p => <label key={p} className="text-xs inline-flex items-center gap-1.5"><input type="checkbox" checked={practices.includes(p)} onChange={() => setPractices(x => x.includes(p) ? x.filter(y => y !== p) : [...x, p])} /> {p}</label>)}</div>}
          </Field>
        )}
        {kind === 'single' && <Field label="Who pays"><Seg value={payer} onChange={setPayer} options={[{ value: 'practice', label: 'The practice' }, { value: 'dentist', label: 'The dentist directly' }]} /></Field>}

        {(kind === 'practice' || pays === 'dentist') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Invoice and statement email" hint="One or more, comma-separated."><input className={input} value={emails} onChange={e => setEmails(e.target.value)} placeholder="accounts@…" /></Field>
            <Field label="Xero contact"><select className={input} value={xero} onChange={e => setXero(e.target.value)}><option value="__create">Create a new contact in Xero</option>{XERO_CONTACTS(s).map(c => <option key={c} value={c}>Match: {c}</option>)}</select></Field>
            <Field label="Currency"><select className={input} value={currency} onChange={e => setCurrency(e.target.value as Currency)}>{['GBP', 'EUR', 'USD'].map(c => <option key={c}>{c}</option>)}</select></Field>
            {kind === 'practice' && <Field label="Country"><input className={input} value={country} onChange={e => setCountry(e.target.value)} /></Field>}
            {kind === 'practice' && <Field label="Price list"><select className={input} value={priceListId} onChange={e => setPriceListId(e.target.value)}><option value="">Lab standard</option>{s.priceLists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
            {kind === 'practice' && <Field label="Account limit (optional)" hint="Notify only; change it on the account."><input className={input} type="number" value={limit} onChange={e => setLimit(e.target.value)} placeholder="None" /></Field>}
          </div>
        )}
        {kind === 'single' && pays === 'practice' && <Note>{name.trim() || 'The dentist'}'s cases go on {practices[0] ?? 'the practice'}'s invoices and statement. Switch to "the dentist directly" any time on their account.</Note>}
      </div>
    </Modal>
  );
}

export function AccountPage({ id }: { id: string }) {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const a = account(s, id);
  const [stmt, setStmt] = useState<Statement | null>(null);
  if (!a) return <Card><Empty>Account not found.</Empty></Card>;
  const ex = exposure(s, a.id);
  const stage = limitStage(s, a, ex);
  const forecast = limitForecast(s, a, ex);
  const invoices = s.invoices.filter(i => i.accountId === a.id).sort((x, y) => (y.issuedAt ?? y.createdAt).localeCompare(x.issuedAt ?? x.createdAt));
  const old = s.xeroOnly.filter(x => x.accountId === a.id);
  const t = today();
  const ageing = { current: 0, d30: 0, d60: 0, d90: 0 };
  const bucket = (due: string, amt: number) => { const late = daysBetween(due, t); if (late <= 0) ageing.current += amt; else if (late <= 30) ageing.d30 += amt; else if (late <= 60) ageing.d60 += amt; else ageing.d90 += amt; };
  invoices.forEach(i => { const o = outstanding(i); if (o) bucket(i.dueAt!, o); });
  old.forEach(x => { if (x.amount > x.paid) bucket(x.due, x.amount - x.paid); });
  const dentistsHere = s.accounts.filter(d => d.kind === 'dentist' && (d.practices ?? []).includes(a.name));
  const direct = dentistsHere.filter(d => d.payer === 'dentist');
  const cur = a.currency;
  const isPayer = a.kind === 'practice' || a.payer === 'dentist';

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/growth/billing/accounts')} className="inline-flex items-center gap-1 text-xs text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-3.5 h-3.5" /> Accounts</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-[#030213]">{a.name}</h2>
            <Pill tone={a.kind === 'dentist' ? 'purple' : 'blue'}>{a.kind === 'dentist' ? 'Dentist' : 'Practice'}</Pill>
            {STAGE_PILL[stage]}
          </div>
          <p className="text-xs text-[#717182] mt-1">{a.kind === 'dentist' ? `${dentistWhere(a)} · ` : ''}{a.xeroContactId ? `Xero contact: ${a.xeroContactName ?? a.name}` : 'No Xero contact (billed through the practice)'} · {a.country} · {cur}</p>
        </div>
        {isPayer && (ex.unpaid + ex.xero) > 0 && <button className={btn} title="Mock: a payment for the oldest invoices arrives in Xero" onClick={() => { const amt = Math.round((ex.unpaid + ex.xero) * 0.6); const rel = simulateAccountPayment(a.id, amt); toast.success(`${money(amt, cur)} read back from Xero${rel.length ? `. Back under the limit: hold lifted, ${pl(rel.length, 'case')} moved into production` : ''}`); }}><CircleDollarSign className="w-3.5 h-3.5" /> Payment arrives in Xero</button>}
      </div>

      {a.paused && <Note tone="red">On hold: new cases from {a.name} wait in the On hold queue; cases already in progress carry on. A payment that brings the account under its limit lifts the hold automatically.{a.limit?.tellPractice ? ' The practice was told.' : ''}</Note>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          {isPayer && <LimitCard a={a} />}
          {isPayer && (
            <Card title="Balance and ageing" sub={`Includes ${money(ex.xero, cur)} still owed on invoices from the old system (kept in Xero).`}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[['Current', ageing.current], ['1–30 days overdue', ageing.d30], ['31–60 days', ageing.d60], ['60+ days', ageing.d90]].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg border border-[#E0E0E6] px-3 py-2"><p className="text-[10px] text-[#717182] uppercase">{k}</p><p className={`text-sm font-semibold ${k !== 'Current' && (v as number) > 0 ? 'text-[#C62828]' : ''}`}>{money(v as number, cur)}</p></div>
                ))}
              </div>
            </Card>
          )}
          {isPayer ? (
            <Card title="Invoices" pad={false}>
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                <table className="w-full min-w-[560px]">
                  <thead className="sticky top-0"><tr><th className={th}>Number</th><th className={th}>Date</th><th className={th}>Case</th><th className={th}>Status</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Owed</th></tr></thead>
                  <tbody>
                    {old.map(x => <tr key={x.number}><td className={`${td} font-mono`}>{x.number}</td><td className={td}>{fmtShort(x.date)}</td><td className={td}><span className="text-[#717182]">Old system (in Xero)</span></td><td className={td}>{x.amount - x.paid > 0 ? <Pill tone={x.due < t ? 'red' : 'purple'}>{x.due < t ? 'Overdue' : 'Open'}</Pill> : <Pill tone="green">Paid</Pill>}</td><td className={`${td} text-right`}>{money(x.amount, x.currency)}</td><td className={`${td} text-right`}>{x.amount - x.paid > 0 ? money(x.amount - x.paid, x.currency) : '—'}</td></tr>)}
                    {invoices.map(i => (
                      <tr key={i.id} onClick={() => navigate(`/growth/billing/invoices/${i.id}`)} className="cursor-pointer hover:bg-[#FAFAFD]">
                        <td className={`${td} font-mono font-semibold whitespace-nowrap`}>{i.number ?? 'Draft'}</td><td className={td}>{fmtShort(i.issuedAt ?? i.createdAt)}</td><td className={td}><span className="font-mono">{i.caseId}</span> <span className="text-[#717182]">{i.patient}</span></td>
                        <td className={td}><InvoiceStatusPill status={i.status} overdue={isOverdue(i)} /></td><td className={`${td} text-right whitespace-nowrap`}>{money(totals(i).gross, i.currency)}</td><td className={`${td} text-right whitespace-nowrap`}>{outstanding(i) ? money(outstanding(i), i.currency) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!invoices.length && !old.length && <Empty>No invoices yet.</Empty>}
              </div>
            </Card>
          ) : (
            <Card title="Billed through the practice"><p className="text-xs text-[#5A5568]">{a.name}'s cases go on the invoices and statement of {(a.practices ?? []).join(' / ') || 'their practice'}. Switch "Who pays" to give them their own account, Xero contact, limit and statement.</p></Card>
          )}
          {isPayer && (
            <Card title="Statements" sub={a.kind === 'practice' && direct.length ? `Leaves out ${direct.map(d => d.name).join(', ')}, who pay${direct.length === 1 ? 's' : ''} directly.` : 'One per month, built from Xero.'}>
              {s.statements.filter(x => x.accountId === a.id).length === 0 ? <p className="text-xs text-[#A0A0B0]">None yet.</p> : (
                <ul className="divide-y divide-[#F0EFF6]">
                  {s.statements.filter(x => x.accountId === a.id).sort((x, y) => y.period.localeCompare(x.period)).map(x => (
                    <li key={x.id} className="flex items-center justify-between py-1.5 text-xs">
                      <span>{fmtMonth(x.period)} · closing {money(x.closing, x.currency)} {x.status === 'preview' ? <Pill tone="blue">Preview</Pill> : <span className="text-[#717182]">sent {fmtShort(x.sentAt)}</span>}</span>
                      <button className="text-[#4D8EF7] font-semibold hover:underline" onClick={() => setStmt(x)}>View</button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <WhoPaysCard a={a} dentistsHere={dentistsHere} />
          {isPayer && <PriceListCard a={a} />}
          {isPayer && <DetailsCard a={a} />}
          {isPayer && <StagedCard a={a} />}
        </div>
      </div>
      {stmt && (
        <Modal isOpen onClose={() => setStmt(null)} size="lg" title={`Statement · ${fmtMonth(stmt.period)}`} footer={<div className="flex justify-end"><button className={btn} onClick={() => printPages([{ key: stmt.id, node: <StatementDoc st={stmt} acc={a} /> }], 'Statement')}>Print</button></div>}>
          <StatementDoc st={stmt} acc={a} />
        </Modal>
      )}
    </div>
  );
}

function LimitCard({ a }: { a: BillingAccount }) {
  const s = useBilling();
  const { toast } = useToast();
  const ex = exposure(s, a.id);
  const stage = limitStage(s, a, ex);
  const forecast = limitForecast(s, a, ex);
  const [editing, setEditing] = useState(() => new URLSearchParams(window.location.search).get('limit') === '1');
  const [draft, setDraft] = useState<AccountLimit>(a.limit ?? { amount: 5000, overdueDays: 60, atLimit: 'notify', tellPractice: false, message: '' });
  const lim = a.limit;
  const pctUsed = lim?.amount ? ex.total / lim.amount * 100 : 0;
  return (
    <Card title="Account limit" sub="Counts unpaid invoices plus work in progress (cases received, not yet invoiced) at their expected price." actions={<button className={btn} onClick={() => setEditing(e => !e)}>{editing ? 'Close' : lim ? 'Change' : 'Set a limit'}</button>}>
      {lim?.amount ? (
        <div className="space-y-2">
          <div className="flex flex-wrap justify-between text-xs"><span><b>{money(ex.total, a.currency)}</b> of {money(lim.amount, a.currency)} ({Math.round(pctUsed)}%)</span><span className="text-[#717182]">{lim.atLimit === 'pause' ? 'Pauses new work at the limit' : 'Notifies at the limit'}{lim.overdueDays ? ` · or anything over ${lim.overdueDays} days unpaid` : ''}</span></div>
          <Bar pct={pctUsed} tone={stage === 'ok' ? 'blue' : stage === 'approaching' ? 'amber' : 'red'} marker={s.settings.limitWarnPct} />
          <div className="flex flex-wrap gap-4 text-[11px] text-[#5A5568]">
            <span>Unpaid invoices {money(ex.unpaid, a.currency)}</span><span>Old system, in Xero {money(ex.xero, a.currency)}</span><span>Work in progress {money(ex.wip, a.currency)} ({pl(ex.wipCases, 'case')})</span>{ex.overdueOldest > 0 && <span className="text-[#C62828]">Oldest overdue {ex.overdueOldest} days</span>}
          </div>
          {forecast != null && stage !== 'paused' && stage !== 'at' && <Note tone={forecast <= 14 ? 'amber' : 'blue'}>At this pace, {a.name} reaches the limit in about {pl(forecast, 'day')}.</Note>}
        </div>
      ) : <p className="text-xs text-[#717182]">No limit. Most accounts don't need one.</p>}
      {editing && (
        <div className="mt-4 pt-4 border-t border-[#F0EFF6] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={`Balance limit (${a.currency})`}><input className={input} type="number" value={draft.amount ?? ''} onChange={e => setDraft(d => ({ ...d, amount: e.target.value ? Number(e.target.value) : null }))} placeholder="None" /></Field>
            <Field label="Or anything unpaid for over (days)"><input className={input} type="number" value={draft.overdueDays ?? ''} onChange={e => setDraft(d => ({ ...d, overdueDays: e.target.value ? Number(e.target.value) : null }))} placeholder="None" /></Field>
          </div>
          <Field label="At the limit"><Seg value={draft.atLimit} onChange={v => setDraft(d => ({ ...d, atLimit: v }))} options={[{ value: 'notify', label: 'Notify only' }, { value: 'pause', label: 'Pause new cases' }]} /></Field>
          <Toggle on={draft.tellPractice} onChange={v => setDraft(d => ({ ...d, tellPractice: v }))} label="Tell the practice" />
          {draft.tellPractice && <Field label="Message" hint="Leave blank to use the limit email template (Billing settings)."><textarea className={input} rows={3} value={draft.message} onChange={e => setDraft(d => ({ ...d, message: e.target.value }))} /></Field>}
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={() => { updateAccount(a.id, { limit: draft.amount == null && draft.overdueDays == null ? null : draft }); setEditing(false); toast.success('Limit saved'); }}>Save limit</button>
            {lim && <button className={btn} onClick={() => { updateAccount(a.id, { limit: null }); setEditing(false); toast.success('Limit removed'); }}>Remove limit</button>}
          </div>
        </div>
      )}
    </Card>
  );
}

function WhoPaysCard({ a, dentistsHere }: { a: BillingAccount; dentistsHere: BillingAccount[] }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const s = useBilling();
  const [newDentist, setNewDentist] = useState('');
  if (a.kind === 'dentist') return <><DentistPayerCard a={a} /><PracticesCard a={a} /></>;
  const known = [...new Set([...s.accounts.filter(d => d.kind === 'dentist').map(d => d.name), ...billingCases().map(c => c.dentist).filter(Boolean)])].filter(d => !dentistsHere.some(x => x.name === d)).sort();
  return (
    <Card title="Dentists at this practice" sub="The practice pays for its dentists unless one pays directly.">
      {dentistsHere.length === 0 ? <p className="text-xs text-[#A0A0B0]">No dentists linked yet.</p> : (
        <ul className="space-y-2">
          {dentistsHere.map(d => {
            const others = (d.practices ?? []).filter(p => p !== a.name);
            return (
              <li key={d.id} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => navigate(`/growth/billing/accounts/${dentistAccountId(d.name)}`)} className="font-semibold hover:underline text-left">{d.name}</button>
                  <span className="inline-flex items-center gap-1">
                    <select className={inputSm} value={d.payer} onChange={e => { setPayer(d.name, e.target.value as 'practice' | 'dentist'); toast.success('Who pays updated; cases not invoiced yet moved'); }}><option value="practice">Practice pays</option><option value="dentist">Pays directly</option></select>
                    <button title={`Unlink from ${a.name}`} className="text-[#A0A0B0] hover:text-[#C62828] p-1" onClick={() => { const n = unlinkDentist(a.name, d.name); toast.success(`${d.name} unlinked from ${a.name}${n ? `; ${pl(n, 'case')} moved` : ''}`); }}><X className="w-3 h-3" /></button>
                  </span>
                </div>
                {others.length > 0 && <p className="text-[10px] text-[#7C3AED]">Also at {others.join(', ')}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-1.5 mt-3 pt-3 border-t border-[#F0EFF6]">
        <input className={`${inputSm} flex-1`} list="sf-dentists-here" value={newDentist} onChange={e => setNewDentist(e.target.value)} placeholder="Add a dentist to this practice…" />
        <datalist id="sf-dentists-here">{known.map(d => <option key={d} value={d} />)}</datalist>
        <button className={btn} disabled={!newDentist.trim()} onClick={() => { const n = linkDentist(a.name, newDentist); toast.success(`${newDentist.trim()} linked to ${a.name}${n ? `; ${pl(n, 'case')} moved` : ''}`); setNewDentist(''); }}><Plus className="w-3 h-3" /> Add</button>
      </div>
    </Card>
  );
}

function DentistPayerCard({ a }: { a: BillingAccount }) {
  const { toast } = useToast();
  const cases = billingCases().filter(c => c.dentist === a.name && (a.practices ?? []).includes(c.practice)).length;
  const where = (a.practices ?? []).join(', ') || 'their practice';
  return (
    <Card title="Who pays">
      <Seg value={a.payer} onChange={v => { setPayer(a.name, v); toast.success(v === 'dentist' ? `${a.name} now pays directly: own Xero contact, invoices and statement` : `${a.name}'s cases go back on the practice invoices`); }} options={[{ value: 'practice', label: 'Practice' }, { value: 'dentist', label: 'Dentist directly' }]} />
      <p className="text-[11px] text-[#717182] mt-2">{a.payer === 'dentist' ? `${a.name}'s ${pl(cases, 'case')} from ${where} stay under the practice for workflow and messages; only the money goes to ${a.name}, on one statement. The practice statements leave them out.` : `Switching is the only step: the dentist gets their own Xero contact (created if missing), email, limit and statement. Invoices already sent stay where they are.`}</p>
    </Card>
  );
}

/** Which practices a dentist works at: one, or several (floating). */
function PracticesCard({ a }: { a: BillingAccount }) {
  const s = useBilling();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [adding, setAdding] = useState('');
  const ps = a.practices ?? [];
  const all = [...new Set([...s.accounts.filter(x => x.kind === 'practice').map(x => x.name), ...billingCases().map(c => c.practice).filter(Boolean)])].filter(p => !ps.includes(p)).sort();
  const fromElsewhere = [...new Set(billingCases().filter(c => c.dentist === a.name && !ps.includes(c.practice)).map(c => c.practice))];
  const apply = (next: string[], msg: string) => { const n = setDentistPractices(a.name, next); toast.success(`${msg}${n ? `; ${pl(n, 'case')} moved` : ''}`); };
  return (
    <Card title="Practices" sub={ps.length > 1 ? 'Floating: works across these practices.' : 'Works at one practice. Add another to make them floating.'}>
      <div className="flex flex-wrap gap-1.5">
        {ps.length === 0 && <span className="text-xs text-[#A0A0B0]">No practice linked.</span>}
        {ps.map(p => (
          <span key={p} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full border border-[#E0E0E6] text-xs">
            <button className="hover:underline" onClick={() => navigate(`/growth/billing/accounts/${practiceAccountId(p)}`)}>{p}</button>
            <button title="Remove" className="text-[#A0A0B0] hover:text-[#C62828]" onClick={() => apply(ps.filter(x => x !== p), `${a.name} removed from ${p}`)}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5 mt-3">
        <input className={`${inputSm} flex-1`} list="sf-practices-add" value={adding} onChange={e => setAdding(e.target.value)} placeholder="Add a practice…" />
        <datalist id="sf-practices-add">{all.map(p => <option key={p} value={p} />)}</datalist>
        <button className={btn} disabled={!adding.trim()} onClick={() => { apply([...ps, adding.trim()], `${a.name} now also works at ${adding.trim()}`); setAdding(''); }}><Plus className="w-3 h-3" /> Add</button>
      </div>
      {fromElsewhere.length > 0 && <Note tone="amber">{a.name} also has cases from {fromElsewhere.join(', ')}, which bill to {fromElsewhere.length === 1 ? 'that practice' : 'those practices'}. <button className="underline font-semibold" onClick={() => apply([...ps, ...fromElsewhere], `${a.name} linked to ${fromElsewhere.join(', ')}`)}>Link {fromElsewhere.length === 1 ? 'it' : 'them'}</button></Note>}
    </Card>
  );
}

function PriceListCard({ a }: { a: BillingAccount }) {
  const s = useBilling();
  const { toast } = useToast();
  const pl0 = s.priceLists.find(p => p.id === a.priceListId);
  const [adding, setAdding] = useState('');
  return (
    <Card title="Price list">
      <select className={input} value={a.priceListId ?? ''} onChange={e => {
        const v = e.target.value;
        if (v === '__new') { const id = `pl-${Date.now().toString(36)}`; savePriceList({ id, name: `${a.name} prices`, prices: {} }); updateAccount(a.id, { priceListId: id }); return; }
        updateAccount(a.id, { priceListId: v || null }); toast.success('Price list updated; drafts repriced');
      }}>
        <option value="">Lab standard</option>
        {s.priceLists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        <option value="__new">+ New custom list for {a.name}</option>
      </select>
      {pl0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] text-[#717182]">Overrides either price, or both. Anything not listed uses the catalog.</p>
          {Object.entries(pl0.prices).map(([itemId, p]) => {
            const it = s.catalog.find(i => i.id === itemId);
            return (
              <div key={itemId} className="flex items-center gap-1.5 text-xs">
                <span className="flex-1 truncate">{it?.name}</span>
                <input className={`${inputSm} w-16`} type="number" placeholder="NHS" value={p.nhs ?? ''} onChange={e => savePriceList({ ...pl0, prices: { ...pl0.prices, [itemId]: { ...p, nhs: e.target.value ? Number(e.target.value) : undefined } } })} />
                <input className={`${inputSm} w-16`} type="number" placeholder="Private" value={p.priv ?? ''} onChange={e => savePriceList({ ...pl0, prices: { ...pl0.prices, [itemId]: { ...p, priv: e.target.value ? Number(e.target.value) : undefined } } })} />
                <button onClick={() => { const n = { ...pl0.prices }; delete n[itemId]; savePriceList({ ...pl0, prices: n }); }} className="text-[#A0A0B0] hover:text-[#C62828]"><Trash2 className="w-3 h-3" /></button>
              </div>
            );
          })}
          <div className="flex gap-1.5">
            <select className={`${inputSm} flex-1`} value={adding} onChange={e => setAdding(e.target.value)}><option value="">Add an item…</option>{s.catalog.filter(i => !pl0.prices[i.id]).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
            <button className={btn} disabled={!adding} onClick={() => { const it = s.catalog.find(i => i.id === adding)!; savePriceList({ ...pl0, prices: { ...pl0.prices, [adding]: { nhs: it.nhs ?? undefined, priv: it.priv ?? undefined } } }); setAdding(''); }}>Add</button>
          </div>
        </div>
      )}
    </Card>
  );
}

function DetailsCard({ a }: { a: BillingAccount }) {
  const s = useBilling();
  const { toast } = useToast();
  const [emails, setEmails] = useState(a.emails.join(', '));
  return (
    <Card title="Invoices, statements and currency">
      <div className="space-y-3">
        <Field label="Invoice and statement email" hint="One or more addresses, comma-separated.">
          <div className="flex gap-1.5"><input className={input} value={emails} onChange={e => setEmails(e.target.value)} /><button className={btn} onClick={() => { updateAccount(a.id, { emails: emails.split(/[,;\s]+/).filter(Boolean) }); toast.success('Saved'); }}>Save</button></div>
        </Field>
        {a.bounced?.length ? (
          <Note tone="red">
            {a.bounced.map(b => <p key={b.at}>{b.what} to {b.email} bounced on {fmtDate(b.at)}.</p>)}
            <button className="mt-1 inline-flex items-center gap-1 font-semibold underline" onClick={() => { resendAccountEmail(a.id); toast.success(`Resent to ${a.emails.join(', ')}`); }}><Mail className="w-3 h-3" /> Resend</button>
          </Note>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Currency"><select className={input} value={a.currency} onChange={e => { updateAccount(a.id, { currency: e.target.value as Currency }); toast.success(`Invoices and statements go out in ${e.target.value}`); }}>{['GBP', 'EUR', 'USD'].map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Country"><input className={input} value={a.country} onChange={e => updateAccount(a.id, { country: e.target.value })} /></Field>
        </div>
        {a.currency !== 'GBP' && <Note tone={s.setup.plan === 'premium' ? 'blue' : 'amber'}>{s.setup.plan === 'premium' ? 'Xero handles the exchange rate and the GBP value.' : 'Multi-currency needs Xero Premium. Your organisation is on Standard: upgrade before sending, or invoices post in GBP.'} Overseas VAT treatment is a separate tax-rate mapping; confirm it with your accountant.</Note>}
        <Field label="Statement of manufacture">
          <Seg value={a.som} onChange={v => updateAccount(a.id, { som: v })} options={[{ value: 'inherit', label: `Inherit (${s.settings.som === 'all' ? 'on' : 'off'})` }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
        </Field>
      </div>
    </Card>
  );
}

function StagedCard({ a }: { a: BillingAccount }) {
  const s = useBilling();
  const staged = s.catalog.filter(i => i.stages?.length);
  return (
    <Card title="Staged billing for this account" sub="Overrides the item setting where you've agreed something different.">
      <div className="space-y-1.5">
        {staged.map(it => {
          const v = a.stagedOverride?.[it.id] ?? 'inherit';
          return (
            <div key={it.id} className="flex items-center justify-between gap-2 text-xs">
              <span>{it.name}</span>
              <select className={inputSm} value={v} onChange={e => { const o = { ...a.stagedOverride }; if (e.target.value === 'inherit') delete o[it.id]; else o[it.id] = e.target.value as 'end' | 'each'; updateAccount(a.id, { stagedOverride: o }); }}>
                <option value="inherit">Item default ({it.staged === 'each' ? 'each stage' : 'at the end'})</option><option value="end">Bill at the end</option><option value="each">Bill each stage</option>
              </select>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export type { BillingState };
